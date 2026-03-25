const mongoose = require('mongoose');

const ChannelSchema = new mongoose.Schema({
    name: { type: String, required: true },
    url: { type: String, required: true },
    type: { type: String, enum: ['live', 'posts'], default: 'live' },
    save_path: { type: String },
    status: { type: String, enum: ['pending', 'downloading', 'completed', 'error', 'idle'], default: 'pending' },
    message: { type: String },
    downloaded_files: { type: Number, default: 0 },
    auto_download: { type: Boolean, default: true },
    last_checked: { type: Date, default: Date.now }
}, { timestamps: true });

const Channel = mongoose.model('Channel', ChannelSchema);

// --- Cam Cloud Recorder: Model Schema ---
const ModelSchema = new mongoose.Schema({
    name: { type: String, required: true },
    url: { type: String, required: true },
    platform: { type: String, default: 'auto' },
    type: { type: String, enum: ['live', 'posts'], default: 'live' },
    is_online: { type: Boolean, default: false },
    is_recording: { type: Boolean, default: false },
    auto_record: { type: Boolean, default: true },
    save_path: { type: String, default: 'recordings' },
    quality: { type: String, enum: ['best', '1080', '720', '480'], default: '1080' },
    schedule: {
        enabled: { type: Boolean, default: false },
        start_hour: { type: Number, default: 0 },
        end_hour: { type: Number, default: 24 },
    },
    last_online: { type: Date },
    last_recorded: { type: Date },
    total_recordings: { type: Number, default: 0 },
    recording_seconds: { type: Number, default: 0 },
    downloaded_files: { type: Number, default: 0 },
    scan_status: { type: String, enum: ['idle', 'scanning', 'scanned'], default: 'idle' },
    scan_total: { type: Number, default: 0 },
    current_recording_start: { type: Date },
    agent_id: { type: String },          // Which agent is handling this model
    error_message: { type: String },
}, { timestamps: true });

const Model = mongoose.model('Model', ModelSchema);

module.exports = { Channel, Model };
