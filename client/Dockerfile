# Use a lightweight Node.js image
FROM node:20-slim

# Install system dependencies (Python, FFmpeg)
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    ffmpeg \
    curl \
    rclone \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Create a virtual environment for Python tools
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install download tools via pip
RUN pip install --no-cache-dir yt-dlp gallery-dl

# Set working directory
WORKDIR /app

# Copy root package.json for workspace management
COPY package*.json ./

# Copy backend and frontend dependencies
COPY server/package*.json ./server/
COPY client/package*.json ./client/

# Install dependencies (use ci for faster, more reliable builds)
RUN npm install --prefix server
RUN npm install --prefix client

# Copy the rest of the application
COPY . .

# Build the frontend
RUN npm run build --prefix client

# Expose the backend port
EXPOSE 3001

# The backend will serve the static frontend files in a production Docker setup
# (Note: We'll need a small tweak in server/index.js to serve the 'dist' folder)
ENV NODE_ENV=production

# Start the application
CMD ["npm", "run", "server"]
