const { google } = require('googleapis');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { User, Setting } = require('./models');

class AuthManager {
    constructor() {
        this.googleClient = null;
        // initGoogle is now async, so we'll call it where needed or via a startup trigger
    }

    async initGoogle() {
        const gID = process.env.GOOGLE_CLIENT_ID;
        const gSecret = process.env.GOOGLE_CLIENT_SECRET;
        const gRedirect = process.env.GOOGLE_REDIRECT_URI || 'https://baixabaixa.onrender.com/api/auth/google/login-callback';
        
        if (gID && gSecret) {
            this.googleClient = new google.auth.OAuth2(gID, gSecret, gRedirect);
        }
    }

    // --- SYSTEM CONFIG ---
    async getSystemSetting(key) {
        const setting = await Setting.findOne({ key, userId: null });
        return setting ? setting.value : null;
    }

    async saveSystemSetting(key, value) {
        await Setting.findOneAndUpdate(
            { key, userId: null },
            { value },
            { upsert: true, new: true }
        );
    }

    // --- USER AUTH ---
    generateToken(user) {
        return jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET || 'baixabaixa-secret-key-2026',
            { expiresIn: '7d' }
        );
    }

    // --- SOCIAL LOGIN HANDLERS ---
    async handleGoogleLogin(code, mode = 'user') {
        if (!this.googleClient) await this.initGoogle();
        if (!this.googleClient) throw new Error('Google Auth não configurado no servidor.');

        const { tokens } = await this.googleClient.getToken(code);
        this.googleClient.setCredentials(tokens);
        
        // Use a reserved ID for master token
        const userId = mode === 'master' ? '000000000000000000000000' : null;
        
        if (mode === 'master') {
            await this.saveTokens(userId, 'google', tokens);
            return { success: true };
        }

        const ticket = await this.googleClient.verifyIdToken({
            idToken: tokens.id_token,
            audience: this.googleClient._clientId
        });
        const payload = ticket.getPayload();
        
        // Standard user login logic...
        const User = require('./models').User;
        let user = await User.findOne({ email: payload.email });
        if (!user) {
            user = new User({ 
                email: payload.email, 
                googleId: payload.sub 
            });
            await user.save();
        }
        
        await this.saveTokens(user._id, tokens, 'google');
        const jwt = require('jsonwebtoken');
        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || 'baixabaixa-secret-key-2026', { expiresIn: '7d' });
        return { token };
    }

    async handleMicrosoftLogin(code) {
        const mID = process.env.MS_CLIENT_ID;
        const mSecret = process.env.MS_CLIENT_SECRET;
        const mLoginRedirect = process.env.MS_LOGIN_REDIRECT_URI || 'https://baixabaixa.onrender.com/api/auth/microsoft/login-callback';

        if (!mID || !mSecret) throw new Error('Microsoft Auth não configurado no servidor.');
        const response = await axios.post('https://login.microsoftonline.com/common/oauth2/v2.0/token', new URLSearchParams({
            client_id: mID,
            client_secret: mSecret,
            code,
            redirect_uri: mLoginRedirect,
            grant_type: 'authorization_code'
        }));

        const profile = await axios.get('https://graph.microsoft.com/v1.0/me', {
            headers: { Authorization: `Bearer ${response.data.access_token}` }
        });

        let user = await User.findOne({ $or: [{ microsoftId: profile.data.id }, { email: profile.data.mail || profile.data.userPrincipalName }] });
        if (!user) {
            user = new User({ email: profile.data.mail || profile.data.userPrincipalName, microsoftId: profile.data.id });
            await user.save();
        } else if (!user.microsoftId) {
            user.microsoftId = profile.data.id;
            await user.save();
        }
        return { token: this.generateToken(user), user };
    }

    async getGoogleAuthUrl(userIdOrMode) {
        if (!this.googleClient) await this.initGoogle();
        if (!this.googleClient) return null;

        const scopes = [
            'openid', 'email', 'profile',
            'https://www.googleapis.com/auth/drive.file'
        ];
        
        const isMaster = userIdOrMode === 'master';
        const redirectUri = isMaster 
            ? 'https://baixabaixa.onrender.com/api/admin/google/callback'
            : (process.env.GOOGLE_REDIRECT_URI || 'https://baixabaixa.onrender.com/api/auth/google/login-callback');

        return this.googleClient.generateAuthUrl({
            access_type: 'offline',
            scope: scopes,
            prompt: 'consent', // Use consent for master to ensure refresh token
            redirect_uri: redirectUri,
            state: isMaster ? 'master' : userIdOrMode
        });
    }

    async getMicrosoftAuthUrl(state = 'login') {
        const mID = process.env.MS_CLIENT_ID;
        const mRedirect = (state === 'login') 
            ? (process.env.MS_LOGIN_REDIRECT_URI || 'https://baixabaixa.onrender.com/api/auth/microsoft/login-callback')
            : (process.env.MS_REDIRECT_URI || 'https://baixabaixa.onrender.com/api/auth/microsoft/callback');

        if (!mID) return null;
        const scope = 'files.readwrite offline_access User.Read';
        return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${mID}&response_type=code&redirect_uri=${encodeURIComponent(mRedirect)}&response_mode=query&scope=${encodeURIComponent(scope)}&state=${state}`;
    }

    async handleGoogleCallback(code, userId) {
        if (!this.googleClient) await this.initGoogle();
        const { tokens } = await this.googleClient.getToken(code);
        await this.saveTokens(userId, 'google', tokens);
        return tokens;
    }

    async handleMicrosoftCallback(code, userId) {
        const mID = process.env.MS_CLIENT_ID;
        const mSecret = process.env.MS_CLIENT_SECRET;
        const mRedirect = process.env.MS_REDIRECT_URI || 'https://baixabaixa.onrender.com/api/auth/microsoft/callback';

        const response = await axios.post('https://login.microsoftonline.com/common/oauth2/v2.0/token', new URLSearchParams({
            client_id: mID,
            client_secret: mSecret,
            code,
            redirect_uri: mRedirect,
            grant_type: 'authorization_code'
        }));
        await this.saveTokens(userId, 'microsoft', response.data);
        return response.data;
    }

    async saveTokens(userId, platform, tokens) {
        await Setting.findOneAndUpdate(
            { userId, key: `${platform}_tokens` },
            { value: JSON.stringify(tokens) },
            { upsert: true }
        );
    }

    async getTokens(userId, platform) {
        let setting = await Setting.findOne({ userId, key: `${platform}_tokens` });
        if (!setting && userId !== '000000000000000000000000') {
            // Fallback to Master Token if user-specific token is missing
            setting = await Setting.findOne({ userId: '000000000000000000000000', key: `${platform}_tokens` });
        }
        return setting ? JSON.parse(setting.value) : null;
    }
}

module.exports = new AuthManager();