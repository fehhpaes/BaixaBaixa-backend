const express = require('express');
const cors = require('cors');
const connectDB = require('./db');
const monitor = require('./monitor');
const auth = require('./auth');
const authMiddleware = require('./middleware/auth');
const { Channel } = require('./models');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const allowedOrigin = process.env.ALLOWED_ORIGIN ? process.env.ALLOWED_ORIGIN.replace(/\/$/, "") : '*';
app.use(cors({ origin: allowedOrigin }));
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));


connectDB();

app.get('/api/config/status', async (req, res) => { 
    res.json({ 
        google: !!process.env.GOOGLE_CLIENT_ID, 
        microsoft: !!process.env.MS_CLIENT_ID, 
        version: 'v1.8.2' 
    }); 
});

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';

app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = new User({ email, password });
        await user.save();
        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token });
    } catch (err) {
        res.status(400).json({ message: 'Erro ao registrar usuário: ' + err.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user || !user.password) return res.status(401).json({ message: 'Credenciais inválidas' });
        const isMatch = await user.comparePassword(password);
        if (!isMatch) return res.status(401).json({ message: 'Credenciais inválidas' });
        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token });
    } catch (err) {
        res.status(500).json({ message: 'Erro interno no servidor' });
    }
});


app.get('/api/debug-vars', (req, res) => {
    res.json({
        version: 'v1.8.2',
        GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ? 'SET' : 'MISSING',
        MS_CLIENT_ID: process.env.MS_CLIENT_ID ? 'SET' : 'MISSING'
    });
});

app.get('/api/auth/google/login-url', async (req, res) => {
    res.json({ url: await auth.getGoogleAuthUrl('login') });
});

app.get('/api/auth/google/login-callback', async (req, res) => {
    try {
        const { token } = await auth.handleGoogleLogin(req.query.code);
        res.send('<script>window.opener.postMessage({ token: "' + token + '" }, "*"); window.close();</script>');
    } catch (err) {
        console.error('[Login Error]:', err.response?.data || err.message || err);
        res.status(500).send('Erro no login social');
    }
});

app.get('/api/auth/microsoft/login-url', async (req, res) => {
    res.json({ url: await auth.getMicrosoftAuthUrl('login') });
});

app.get('/api/auth/microsoft/login-callback', async (req, res) => {
    try {
        const { token } = await auth.handleMicrosoftLogin(req.query.code);
        res.send('<script>window.opener.postMessage({ token: "' + token + '" }, "*"); window.close();</script>');
    } catch (err) {
        console.error('[Login Error]:', err.response?.data || err.message || err);
        res.status(500).send('Erro no login social');
    }
});

app.get('/api/auth/google/callback', async (req, res) => {
    const { code, state } = req.query;
    try {
        await auth.handleGoogleCallback(code, state);
        res.send("<h1>Drive Conectado!</h1><script>setTimeout(() => window.close(), 2000)</script>");
    } catch (err) {
        res.status(500).send('Erro na conexão: ' + err.message);
    }
});

app.use('/api', authMiddleware);

app.get('/api/channels', async (req, res) => {
    const channels = await Channel.find({ userId: req.userId });
    res.json(channels);
});

app.post('/api/channels', async (req, res) => {
    const { name, url, type, save_path } = req.body;
    const channel = new Channel({ userId: req.userId, name, url, type, save_path });
    await channel.save();
    res.json(channel);
});

app.post('/api/channels/:id/toggle', async (req, res) => {
    const channel = await Channel.findOne({ _id: req.params.id, userId: req.userId });
    if (!channel) return res.status(404).json({ message: 'Canal não encontrado' });
    channel.auto_download = !channel.auto_download;
    await channel.save();
    if (channel.auto_download) {
        monitor.startMonitoring(channel._id, channel.url, channel.type, channel.save_path, req.userId);
    } else {
        monitor.stopMonitoring(channel._id);
    }
    res.json(channel);
});

app.delete('/api/channels/:id', async (req, res) => {
    await Channel.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    monitor.stopMonitoring(req.params.id);
    res.json({ success: true });
});

app.get('/api/auth/status', async (req, res) => {
    const google = await auth.getTokens(req.userId, 'google');
    const microsoft = await auth.getTokens(req.userId, 'microsoft');
    res.json({ google: !!google, microsoft: !!microsoft });
});

// Master Google Auth (Admin Only)
app.get('/api/admin/google/auth', async (req, res) => {
    res.json({ url: await auth.getGoogleAuthUrl('master') });
});

app.get('/api/admin/google/callback', async (req, res) => {
    const { code } = req.query;
    try {
        await auth.handleGoogleLogin(code, 'master');
        res.send("<h1>Google Drive Mestre Conectado com Sucesso!</h1><p>Você pode fechar esta aba.</p>");
    } catch (err) {
        console.error('[Master Auth Error]:', err);
        res.status(500).send('Erro na conexão mestre: ' + err.message);
    }
});

const PORT = process.env.PORT || 3001;


app.listen(PORT, '0.0.0.0', async () => {
    console.log("[BaixaBaixa] Backend Engine running on port " + PORT);
    const activeChannels = await Channel.find({ auto_download: true });
    activeChannels.forEach(chan => {
        monitor.startMonitoring(chan._id, chan.url, chan.type, chan.save_path, chan.userId);
    });
});