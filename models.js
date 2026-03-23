const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// User Schema
const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String }, // Optional for OAuth-only users
    googleId: { type: String, unique: true, sparse: true },
    microsoftId: { type: String, unique: true, sparse: true },
    createdAt: { type: Date, default: Date.now }
});

UserSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

UserSchema.methods.comparePassword = function(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

// Channel Schema
const ChannelSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    url: { type: String, required: true },
    type: { type: String, enum: ['live', 'posts'], default: 'live' },
    save_path: { type: String },
    status: { type: String, default: 'idle' },
    auto_download: { type: Boolean, default: true },
    last_checked: { type: Date, default: Date.now }
});

// Setting Schema (Encrypted tokens/configs)
const SettingSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    key: { type: String, required: true },
    value: { type: String, required: true } // Should be encrypted in the logic layer
});

const User = mongoose.model('User', UserSchema);
const Channel = mongoose.model('Channel', ChannelSchema);
const Setting = mongoose.model('Setting', SettingSchema);

module.exports = { User, Channel, Setting };
