const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://devfpaes_db_user:qLO8FBmyBWUlgSzn@baixabaixa.ryv2awm.mongodb.net/?appName=baixabaixa';

const connectDB = async () => {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('[Database] Connected to MongoDB Atlas');
    } catch (err) {
        console.error('[Database] Connection failed:', err.message);
        process.exit(1);
    }
};

module.exports = connectDB;
