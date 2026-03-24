const express = require('express');
const cors = require('cors');
const connectDB = require('./db');
const { Channel } = require('./models');

const app = express();
app.use(cors());
app.use(express.json());

connectDB();

// Simple Security Key
const API_KEY = process.env.API_KEY || 'baixabaixa-secret-2026';

const apiKeyMiddleware = (req, res, next) => {
    const key = req.headers['x-api-key'];
    if (key !== API_KEY) return res.status(401).json({ message: 'Acesso não autorizado' });
    next();
};

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// 1. Submit Link (Used by Vercel Frontend)
app.post('/api/channels', apiKeyMiddleware, async (req, res) => {
    try {
        const { name, url, type, save_path } = req.body;
        const channel = new Channel({ name, url, type, save_path, status: 'pending' });
        await channel.save();
        res.json(channel);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 2. List Links (Used by Web & Agent)
app.get('/api/channels', apiKeyMiddleware, async (req, res) => {
    const channels = await Channel.find().sort({ createdAt: -1 }).limit(50);
    res.json(channels);
});

// 3. Agent Fetch (Get one pending work)
app.get('/api/agent/work', apiKeyMiddleware, async (req, res) => {
    const work = await Channel.findOne({ status: 'pending', auto_download: true });
    if (!work) return res.json({ message: 'No pending work' });
    
    // Mark as downloading immediately to prevent double-picks
    work.status = 'downloading';
    await work.save();
    res.json(work);
});

// 4. Agent Update (Report completion or error)
app.post('/api/agent/:id/status', apiKeyMiddleware, async (req, res) => {
    try {
        const { status } = req.body;
        const channel = await Channel.findByIdAndUpdate(req.params.id, { 
            status, 
            last_checked: new Date() 
        }, { new: true });
        res.json(channel);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 5. Delete link
app.delete('/api/channels/:id', apiKeyMiddleware, async (req, res) => {
    await Channel.findByIdAndDelete(req.params.id);
    res.json({ success: true });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
    console.log("[BaixaBaixa] Cloud Coordinator API running on port " + PORT);
});