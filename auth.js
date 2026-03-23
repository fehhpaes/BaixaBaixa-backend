const { google } = require('googleapis');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { User, Setting } = require('./models');

class AuthManager {
    constructor() {
        this.googleClient = null;
        this.initGoogle();
    }

    initGoogle() {
        if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
            this.googleClient = new google.auth.OAuth2(
                process.env.GOOGLE_CLIENT_ID,
                process.env.GOOGLE_CLIENT_SECRET,
                process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/auth/google/callback'
            );
        }
    }

    // --- USER AUTH ---
    async register(email, password) {
        const user = new User({ email, password });
        await user.save();
        return this.generateToken(user);
    }

    async login(email, password) {
        const user = await User.findOne({ email });
        if (!user || !(await user.comparePassword(password))) {
            throw new Error('Credenciais inválidas');
        }
        return this.generateToken(user);
    }

    generateToken(user) {
        return jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET || 'baixabaixa-secret-key-2026',
            { expiresIn: '7d' }
        );
    }

    // --- SOCIAL LOGIN HANDLERS ---
    async handleGoogleLogin(code) {
        if (!this.googleClient) {
            throw new Error('Google client not initialized.');
        }
        const { tokens } = await this.googleClient.getToken(code);
        this.googleClient.setCredentials(tokens); // Set credentials for idToken verification
        const ticket = await this.googleClient.verifyIdToken({
            idToken: tokens.id_token,
            audience: process.env.GOOGLE_CLIENT_ID
        });
        const payload = ticket.getPayload();
        
        let user = await User.findOne({ 
            $or: [{ googleId: payload.sub }, { email: payload.email }] 
        });

        if (!user) {
            user = new User({ email: payload.email, googleId: payload.sub });
            await user.save();
        } else if (!user.googleId) {
            user.googleId = payload.sub;
            await user.save();
        }

        const token = this.generateToken(user); // Use existing generateToken method
        return { token, user };
    }

    async handleMicrosoftLogin(code) {
        const redirectUri = process.env.MS_REDIRECT_URI || 'http://localhost:3001/api/auth/microsoft/login-callback';
        const response = await axios.post('https://login.microsoftonline.com/common/oauth2/v2.0/token', new URLSearchParams({
            client_id: process.env.MS_CLIENT_ID,
            client_secret: process.env.MS_CLIENT_SECRET,
            code,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code'
        }));

        const profile = await axios.get('https://graph.microsoft.com/v1.0/me', {
            headers: { Authorization: `Bearer ${response.data.access_token}` }
        });

        let user = await User.findOne({ 
            $or: [{ microsoftId: profile.data.id }, { email: profile.data.mail || profile.data.userPrincipalName }] 
        });

        if (!user) {
            user = new User({ 
                email: profile.data.mail || profile.data.userPrincipalName, 
                microsoftId: profile.data.id 
            });
            await user.save();
        } else if (!user.microsoftId) {
            user.microsoftId = profile.data.id;
            await user.save();
        }

        const token = this.generateToken(user);
        return { token, user };
    }

    // --- CLOUD AUTH ---
    getGoogleAuthUrl(state = 'login') {
        if (!this.googleClient) this.initGoogle(); if (!this.googleClient) throw new Error('Google Auth não configurado no servidor (Variáveis de Ambiente faltando).');
        return this.googleClient.generateAuthUrl({
            access_type: 'offline',
            scope: ['https://www.googleapis.com/auth/drive.file', 'openid', 'email', 'profile'],
            prompt: 'consent',
            state: state // Pass userId OR 'login' to callback
        });
    }

    async handleGoogleCallback(code, userId) {
        const { tokens } = await this.googleClient.getToken(code);
        await this.saveTokens(userId, 'google', tokens);
        return tokens;
    }

    getMicrosoftAuthUrl(state = 'login') {
        const clientId = process.env.MS_CLIENT_ID;
        const redirectUri = process.env.MS_REDIRECT_URI || 'http://localhost:3001/api/auth/microsoft/callback';
        // For login, use a different callback if needed, but here we'll use state to distinguish
        const actualRedirect = state === 'login' 
            ? (process.env.MS_LOGIN_REDIRECT_URI || 'http://localhost:3001/api/auth/microsoft/login-callback')
            : redirectUri;

        const scope = 'files.readwrite offline_access User.Read';
        return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(actualRedirect)}&response_mode=query&scope=${encodeURIComponent(scope)}&state=${state}`;
    }

    async handleMicrosoftCallback(code, userId) {
        const redirectUri = process.env.MS_REDIRECT_URI || 'http://localhost:3001/api/auth/microsoft/callback';
        const response = await axios.post('https://login.microsoftonline.com/common/oauth2/v2.0/token', new URLSearchParams({
            client_id: process.env.MS_CLIENT_ID,
            client_secret: process.env.MS_CLIENT_SECRET,
            code,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code'
        }));
        await this.saveTokens(userId, 'microsoft', response.data);
        return response.data;
    }

    async saveTokens(userId, platform, tokens) {
        await Setting.findOneAndUpdate(
            { userId, key: `${platform}_tokens` },
            { value: JSON.stringify(tokens) },
            { upsidert: true, new: true, upsert: true }
        );
    }

    async getTokens(userId, platform) {
        const setting = await Setting.findOne({ userId, key: `${platform}_tokens` });
        return setting ? JSON.parse(setting.value) : null;
    }

    async refreshGoogleTokens(userId) {
        const tokens = await this.getTokens(userId, 'google');
        if (!tokens || !tokens.refresh_token) return null;
        this.googleClient.setCredentials(tokens);
        const { credentials } = await this.googleClient.refreshAccessToken();
        await this.saveTokens(userId, 'google', credentials);
        return credentials;
    }
}

module.exports = new AuthManager();
