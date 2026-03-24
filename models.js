const mongoose = require('mongoose');

const ChannelSchema = new mongoose.Schema({
    name: { type: String, required: true },
    url: { type: String, required: true },
    type: { type: String, enum: ['live', 'posts'], default: 'live' },
    save_path: { type: String },
    status: { type: String, enum: ['pending', 'downloading', 'completed', 'error', 'idle'], default: 'pending' },
    auto_download: { type: Boolean, default: true },
    last_checked: { type: Date, default: Date.now }
}, { timestamps: true });

const Channel = mongoose.model('Channel', ChannelSchema);

module.exports = { Channel };
