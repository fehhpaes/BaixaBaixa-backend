const express = require('express');
const cors = require('cors');
const connectDB = require('./db');
const monitor = require('./monitor');
const auth = require('./auth');
const authMiddleware = require('./middleware/auth');
const { Channel } = require('./models');

const app = express();
const allowedOrigin = process.env.ALLOWED_ORIGIN ? process.env.ALLOWED_ORIGIN.replace(/\/$/, "") : '*';
app.use(cors({ origin: allowedOrigin }));
app.use(express.json());

connectDB();

app.get('/api/debug-vars', (req, res) => {
    res.json({
        version: 'v1.7.4',
        GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ? process.env.GOOGLE_CLIENT_ID.substring(0, 5) + '...' : 'MISSING',
        MS_CLIENT_ID: process.env.MS_CLIENT_ID ? process.env.MS_CLIENT_ID.substring(0, 5) + '...' : 'MISSING',
        ALLOWED_ORIGIN: process.env.ALLOWED_ORIGIN || 'NOT SET',
        NODE_ENV: process.env.NODE_ENV
    });
});

app.get('/api/auth/google/login-url', (req, res) => {
    res.json({ url: auth.getGoogleAuthUrl('login') });
});

app.get('/api/auth/google/login-callback', async (req, res) => {
    try {
        const { token } = await auth.handleGoogleLogin(req.query.code);
        res.send(`<script>window.opener.postMessage({ token: "${token}" }, "*"); window.close();</script>`);
    } catch (err) {
        res.status(500).send('Erro no login social');
    }
});

app.get('/api/auth/microsoft/login-url', (req, res) => {
    res.json({ url: auth.getMicrosoftAuthUrl('login') });
});

app.get('/api/auth/microsoft/login-callback', async (req, res) => {
    try {
        const { token } = await auth.handleMicrosoftLogin(req.query.code);
        res.send(`<script>window.opener.postMessage({ token: "${token}" }, "*"); window.close();</script>`);
    } catch (err) {
        res.status(500).send('Erro no login social');
    }
});

app.get('/api/auth/google/callback', async (req, res) => {
    const { code, state } = req.query;
    try {
        await auth.handleGoogleCallback(code, state);
        res.send('<h1>Drive Conectado!</h1><script>setTimeout(() => window.close(), 2000)</script>');
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

app.get('/api/auth/google/url', (req, res) => {
    res.json({ url: auth.getGoogleAuthUrl(req.userId) });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, async () => {
    console.log(`[BaixaBaixa] Backend Engine running on port ${PORT}`);
    const activeChannels = await Channel.find({ auto_download: true });
    activeChannels.forEach(chan => {
        monitor.startMonitoring(chan._id, chan.url, chan.type, chan.save_path, chan.userId);
    });
});