const express = require('express');
const cors = require('cors');
const connectDB = require('./db');
const { Channel, Model } = require('./models');

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
        const { status, message } = req.body;
        const channel = await Channel.findByIdAndUpdate(req.params.id, { 
            status, 
            message: message || '',
            last_checked: new Date() 
        }, { new: true });
        res.json(channel);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 4b. Agent Update Progress (Channel)
app.post('/api/agent/:id/progress', apiKeyMiddleware, async (req, res) => {
    try {
        const { downloaded_files } = req.body;
        const channel = await Channel.findByIdAndUpdate(req.params.id, { 
            downloaded_files,
            last_checked: new Date() 
        }, { new: true });
        res.json(channel);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 5. Retry (Reset status to pending)
app.post('/api/channels/:id/retry', apiKeyMiddleware, async (req, res) => {
    try {
        const channel = await Channel.findByIdAndUpdate(req.params.id, { 
            status: 'pending',
            message: '',
            last_checked: new Date() 
        }, { new: true });
        res.json(channel);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 6. Delete link
app.delete('/api/channels/:id', apiKeyMiddleware, async (req, res) => {
    await Channel.findByIdAndDelete(req.params.id);
    res.json({ success: true });
});

// =============================================
// == CAM CLOUD RECORDER: Models API ==
// =============================================

function detectPlatform(url) {
    const u = url.toLowerCase();
    if (u.includes('chaturbate')) return 'chaturbate';
    if (u.includes('stripchat')) return 'stripchat';
    if (u.includes('bongacams')) return 'bongacams';
    if (u.includes('cam4')) return 'cam4';
    if (u.includes('myfreecams')) return 'myfreecams';
    if (u.includes('twitch')) return 'twitch';
    if (u.includes('youtube') || u.includes('youtu.be')) return 'youtube';
    if (u.includes('kick')) return 'kick';
    return 'other';
}

// List all models
app.get('/api/models', apiKeyMiddleware, async (req, res) => {
    try {
        const models = await Model.find().sort({ is_recording: -1, is_online: -1, createdAt: -1 });
        res.json(models);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Add a model
app.post('/api/models', apiKeyMiddleware, async (req, res) => {
    try {
        const { name, url, save_path, quality, auto_record, type } = req.body;
        const platform = detectPlatform(url);
        // Posts-type models start in scanning state; live models start idle
        const scan_status = (type === 'posts') ? 'scanning' : 'idle';
        const model = new Model({ 
            name, url, platform, 
            type: type || 'live',
            scan_status,
            scan_total: 0, // Default value for new models
            scan_total_size: 0, // Default value for new models
            auto_record: (type === 'posts') ? false : (auto_record !== undefined ? auto_record : true), // posts wait for user to confirm after scan
            save_path: save_path || 'recordings',
            quality: quality || '1080',
        });
        await model.save();
        res.json(model);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Update a model
app.put('/api/models/:id', apiKeyMiddleware, async (req, res) => {
    try {
        const updates = req.body;
        if (updates.url) updates.platform = detectPlatform(updates.url);
        const model = await Model.findByIdAndUpdate(req.params.id, updates, { new: true });
        if (!model) return res.status(404).json({ message: 'Model not found' });
        res.json(model);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Delete a model
app.delete('/api/models/:id', apiKeyMiddleware, async (req, res) => {
    try {
        await Model.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Force record a model (manual trigger)
app.post('/api/models/:id/record', apiKeyMiddleware, async (req, res) => {
    try {
        const model = await Model.findByIdAndUpdate(req.params.id, { 
            auto_record: true,
            error_message: '',
            last_recorded: null  // Reset so posts-type models sync immediately on next poll
        }, { new: true });
        if (!model) return res.status(404).json({ message: 'Model not found' });
        res.json(model);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Force stop recording a model
app.post('/api/models/:id/stop', apiKeyMiddleware, async (req, res) => {
    try {
        const model = await Model.findByIdAndUpdate(req.params.id, { 
            is_recording: false,
            auto_record: false,
            current_recording_start: null 
        }, { new: true });
        if (!model) return res.status(404).json({ message: 'Model not found' });
        res.json(model);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Agent: Get models to monitor (auto_record enabled OR pending scan)
app.get('/api/agent/models', apiKeyMiddleware, async (req, res) => {
    try {
        const models = await Model.find({
            $or: [
                { auto_record: true },
                { scan_status: 'scanning' }
            ]
        });
        res.json(models);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Agent: Update model status (online/recording/offline/error)
app.post('/api/agent/models/:id/status', apiKeyMiddleware, async (req, res) => {
    try {
        const { is_online, is_recording, error_message, recording_seconds, agent_id } = req.body;
        const updates = {};
        
        if (is_online !== undefined) {
            updates.is_online = is_online;
            if (is_online) updates.last_online = new Date();
        }
        if (is_recording !== undefined) {
            updates.is_recording = is_recording;
            if (is_recording && !updates.current_recording_start) {
                updates.current_recording_start = new Date();
            }
            if (!is_recording) {
                updates.current_recording_start = null;
                if (recording_seconds) {
                    updates.$inc = { 
                        recording_seconds: recording_seconds,
                        total_recordings: 1 
                    };
                    updates.last_recorded = new Date();
                }
            }
        }
        if (error_message !== undefined) updates.error_message = error_message;
        if (agent_id) updates.agent_id = agent_id;

        // Handle $inc separately
        const incUpdates = updates.$inc;
        delete updates.$inc;
        
        const updateOps = { $set: updates };
        if (incUpdates) updateOps.$inc = incUpdates;

        const model = await Model.findByIdAndUpdate(req.params.id, updateOps, { new: true });
        if (!model) return res.status(404).json({ message: 'Model not found' });
        res.json(model);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Agent: Update model progress (downloaded files)
app.post('/api/agent/models/:id/progress', apiKeyMiddleware, async (req, res) => {
    try {
        const { downloaded_files } = req.body;
        const model = await Model.findByIdAndUpdate(req.params.id, { 
            downloaded_files,
            last_recorded: new Date() 
        }, { new: true });
        if (!model) return res.status(404).json({ message: 'Model not found' });
        res.json(model);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Agent: Update scan progress (files discovered so far)
app.post('/api/agent/models/:id/scan-progress', apiKeyMiddleware, async (req, res) => {
    try {
        const { scan_total, scan_total_size } = req.body;
        const model = await Model.findByIdAndUpdate(req.params.id, {
            scan_total,
            scan_total_size: scan_total_size || 0,
            scan_status: 'scanning'
        }, { new: true });
        if (!model) return res.status(404).json({ message: 'Model not found' });
        res.json(model);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Agent: Finalize scan (mark as scanned with total count)
app.post('/api/agent/models/:id/scan-complete', apiKeyMiddleware, async (req, res) => {
    try {
        const { scan_total, scan_total_size } = req.body;
        const model = await Model.findByIdAndUpdate(req.params.id, {
            scan_total,
            scan_total_size: scan_total_size || 0,
            scan_status: 'scanned'
        }, { new: true });
        if (!model) return res.status(404).json({ message: 'Model not found' });
        res.json(model);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
    console.log("[BaixaBaixa] Cloud Coordinator API running on port " + PORT);
});