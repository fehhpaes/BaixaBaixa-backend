const { spawn, exec } = require('child_process');
const path = require('path');
const { Channel } = require('./models');
const storage = require('./storage');

class MonitorManager {
    constructor() {
        this.processes = new Map(); // channelId -> ChildProcess (for Live)
        this.pollers = new Map(); // channelId -> Timeout/Interval (for Posts)
    }

    startMonitoring(channelId, url, type = 'live', savePath = null, userId) {
        if (type === 'live') {
            this.startLiveMonitoring(channelId, url, savePath, userId);
        } else {
            this.startPostMonitoring(channelId, url, savePath, userId);
        }
    }

    async startLiveMonitoring(channelId, url, savePath = null, userId) {
        if (this.processes.has(channelId.toString())) return;

        console.log(`[Live Monitor] Starting for ${url} (User: ${userId})`);
        const ytDlpPath = process.platform === 'win32' 
            ? path.resolve(__dirname, '../yt-dlp.exe') 
            : 'yt-dlp';
        
        const isCloudStreaming = process.env.STREAM_TO_CLOUD === 'true';
        const downloadDir = savePath ? savePath : 'downloads';
        const filename = `%(uploader)s/%(title)s [%(upload_date)s-%(timestamp)s] [%(id)s].mp4`;

        let proc;

        if (isCloudStreaming) {
            const remoteName = process.env.RCLONE_REMOTE_NAME || 'remote';
            const cmd = `"${ytDlpPath}" "${url}" -f "best[height<=1080][ext=mp4]/best" -o - | rclone rcat "${remoteName}:${downloadDir}/${filename.replace(/%[a-z_()s]+/g, 'video')}.mp4"`;
            proc = exec(cmd);
        } else {
            const outputTemplate = path.join(path.resolve(__dirname, downloadDir), filename);
            const args = [
                url,
                '--format', 'bestvideo[height<=1080]+bestaudio/best[height<=1080]/best',
                '--merge-output-format', 'mp4',
                '--wait-for-video', '60',
                '--live-from-start',
                '--output', outputTemplate,
                '--newline',
                '--progress'
            ];
            proc = spawn(ytDlpPath, args);
        }

        this.processes.set(channelId.toString(), proc);
        await Channel.findByIdAndUpdate(channelId, { status: 'monitoring' });

        proc.on('close', async () => {
            this.processes.delete(channelId.toString());
            await Channel.findByIdAndUpdate(channelId, { status: 'idle' });
            
            if (!isCloudStreaming && savePath) {
                storage.moveFile(path.resolve(__dirname, savePath), '', userId);
            }
        });
    }

    startPostMonitoring(channelId, url, savePath = null, userId) {
        if (this.pollers.has(channelId.toString())) return;
        
        console.log(`[Post Monitor] Starting for ${url}`);
        this.runGalleryDl(channelId, url, savePath, userId);
        const interval = setInterval(() => this.runGalleryDl(channelId, url, savePath, userId), 30 * 60 * 1000);
        this.pollers.set(channelId.toString(), interval);
    }

    async runGalleryDl(channelId, url, savePath = null, userId) {
        const galleryPath = process.platform === 'win32' 
            ? path.resolve(__dirname, '../gallery-dl.exe') 
            : 'gallery-dl';
        const downloadDir = savePath ? path.resolve(__dirname, savePath) : path.resolve(__dirname, 'downloads');

        await Channel.findByIdAndUpdate(channelId, { status: 'downloading' });

        const cmd = `"${galleryPath}" --directory "${downloadDir}" "${url}"`;
        exec(cmd, async () => {
            await Channel.findByIdAndUpdate(channelId, { status: 'monitoring', last_checked: new Date() });
            if (savePath) storage.moveFile(downloadDir, '', userId);
        });
    }

    async downloadAll(channelId, url, type, savePath = null, userId) {
        const downloadDir = savePath ? savePath : 'downloads';
        if (type === 'live') {
            const ytDlpPath = process.platform === 'win32' 
                ? path.resolve(__dirname, '../yt-dlp.exe') 
                : 'yt-dlp';
            const outputTemplate = path.join(path.resolve(__dirname, downloadDir), `%(uploader)s/%(title)s [%(upload_date)s-%(timestamp)s].%(ext)s`);
            const args = [url, '--yes-playlist', '--format', 'bestvideo[height<=1080]+bestaudio/best[height<=1080]/best', '--merge-output-format', 'mp4', '--output', outputTemplate];
            spawn(ytDlpPath, args);
        } else {
            const galleryPath = process.platform === 'win32' 
                ? path.resolve(__dirname, '../gallery-dl.exe') 
                : 'gallery-dl';
            const targetDir = path.resolve(__dirname, downloadDir);
            exec(`"${galleryPath}" --directory "${targetDir}" "${url}"`, () => {
                storage.moveFile(targetDir, '', userId);
            });
        }
    }

    stopMonitoring(channelId) {
        const idStr = channelId.toString();
        if (this.processes.has(idStr)) {
            this.processes.get(idStr).kill();
            this.processes.delete(idStr);
        }
        if (this.pollers.has(idStr)) {
            clearInterval(this.pollers.get(idStr));
            this.pollers.delete(idStr);
        }
    }
}

module.exports = new MonitorManager();
