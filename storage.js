const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const auth = require('./auth');
const { Setting } = require('./models');

class StorageManager {
    constructor() {
        this.initializeRcloneConfig();
    }

    initializeRcloneConfig() {
        const configData = process.env.RCLONE_CONFIG_DATA;
        if (configData) {
            const os = require('os');
            const configPath = path.join(os.homedir(), '.config', 'rclone', 'rclone.conf');
            if (!fs.existsSync(path.dirname(configPath))) fs.mkdirSync(path.dirname(configPath), { recursive: true });
            fs.writeFileSync(configPath, configData);
        }
    }

    async moveFile(localPath, remoteSubDir = '', userId) {
        const googleTokens = await auth.getTokens(userId, 'google');
        if (googleTokens) {
            return this.uploadToGoogle(localPath, remoteSubDir, userId);
        }

        const remoteName = process.env.RCLONE_REMOTE_NAME || 'remote';
        const cmd = `rclone move "${localPath}" "${remoteName}:${remoteSubDir}" --delete-empty-src-dirs`;
        exec(cmd);
    }

    async uploadToGoogle(localPath, remoteSubDir = '', userId) {
        try {
            await auth.refreshGoogleTokens(userId);
            const drive = google.drive({ version: 'v3', auth: auth.googleClient });

            const stats = fs.statSync(localPath);
            if (stats.isDirectory()) {
                const files = fs.readdirSync(localPath);
                for (const file of files) await this.uploadToGoogle(path.join(localPath, file), remoteSubDir, userId);
                return;
            }

            console.log(`[Storage] Native Google Upload for ${path.basename(localPath)} (User: ${userId})`);
            await drive.files.create({
                requestBody: { name: path.basename(localPath) },
                media: { body: fs.createReadStream(localPath) },
            });
            fs.unlinkSync(localPath);
        } catch (err) {
            console.error('[Storage] Native Upload failed:', err);
        }
    }
}

module.exports = new StorageManager();
