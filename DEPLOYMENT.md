# Opinion Deal Calculator — Deployment Guide

This guide covers the security review, migration to GitHub, and deployment on a live Ubuntu server.

## 🛡️ Security Audit & Best Practices

Before deploying, we verified the following security aspects:
1.  **API Key Protection**: Your `OPINION_API_KEY` is securely stored in `.env.local`. It is **never** exposed to the client browser. All requests go through your Next.js API proxy (`/src/app/api/*`).
2.  **Input Sanitization**: All `marketId` inputs are parsed as integers before being sent to the backend, preventing injection attacks.
3.  **Git Safety**: The `.gitignore` file correctly excludes sensitive files (`.env`, `.env.local`, `node_modules`).

**Recommendation for Production**:
*   Ensure your server's firewall (UFW) only allows ports 22 (SSH), 80 (HTTP), and 443 (HTTPS).
*   For very high traffic, consider adding Rate Limiting to Nginx (configuration provided below).

---

## 🚀 Part 1: Moving to GitHub

You need to initialize a Git repository and push your code to GitHub.

1.  **Initialize Git** (if not already done):
    ```powershell
    cd d:\00003_OPINION_PROJECTS\001_My_checker
    git init
    ```

2.  **Check .gitignore**:
    Ensure `.env.local` is ignored so you don't leak your API key.
    ```powershell
    # Verify .gitignore exists and contains .env.local
    Get-Content .gitignore
    ```

3.  **Commit Your Code**:
    ```powershell
    git add .
    git commit -m "Initial commit: Opinion Deal Calculator with Multi-Market Support"
    ```

4.  **Push to GitHub**:
    *   Go to [GitHub.com](https://github.com) and create a **New Repository** (e.g., `opinion-deal-calculator`).
    *   **Do not** initialize with README/license (keep it empty).
    *   Copy the commands from the "…or push an existing repository from the command line" section.
    *   Run them in your terminal:
    ```powershell
    # Example (replace YOUR_USERNAME):
    git branch -M main
    git remote add origin https://github.com/YOUR_USERNAME/opinion-deal-calculator.git
    git push -u origin main
    ```

---

## 🌍 Part 2: Deploying on Ubuntu Server

These steps assume you have a fresh Ubuntu 22.04/24.04 server with root/sudo access.

### 1. Server Preparation
Connect to your server via SSH:
```bash
ssh root@your_server_ip
```

Update system and install dependencies:
```bash
# Update packages
sudo apt update && sudo apt upgrade -y

# Install Curl, Git, and Unzip
sudo apt install -y curl git unzip
```

### 2. Install Node.js (v20 LTS recommended)
We'll use NVM (Node Version Manager) or the official repository. Here is the official setup:
```bash
# Download and setup NodeSource repo
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Install Node.js
sudo apt install -y nodejs

# Verify install
node -v
npm -v
```

### 3. Install Process Manager (PM2)
PM2 keeps your app running 24/7 and restarts it if it crashes.
```bash
sudo npm install -g pm2
```

### 4. Clone & Setup Project
Navigate to the web directory (standard practice):
```bash
cd /var/www

# Clone your repo
git clone https://github.com/YOUR_USERNAME/opinion-deal-calculator.git
cd opinion-deal-calculator

# Install dependencies
npm install
```

### 5. Configure Environment
Create the production environment file. You **must** manually paste your API key here.
```bash
nano .env.local
```
Paste the following (right-click to paste):
```env
OPINION_API_KEY=your_actual_api_key_here
```
Press `Ctrl+O`, `Enter` to save, then `Ctrl+X` to exit.

### 6. Build the Application
Compile the Next.js app for production.
```bash
npm run build
```

### 7. Start with PM2
Start the app on port 3000.
```bash
pm2 start npm --name "deal-calculator" -- start
pm2 save
pm2 startup
# (Run the command output by 'pm2 startup' to enable auto-start on reboot)
```

Your app is now running on `http://localhost:3000` (internal to server).

---

## 🔒 Part 3: Nginx & HTTPS (SSL)

To make the site accessible via a domain (e.g., `calculator.yourdomain.com`) with secure HTTPS.

### 1. Install Nginx & Certbot
```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

### 2. Configure Nginx Proxy
Create a new config file for your site:
```bash
sudo nano /etc/nginx/sites-available/opinion-calculator
```

Paste this configuration (replace `yourdomain.com` with your actual domain/IP):
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        
        # Basic Rate Limiting (Optional)
        # limit_req zone=mylimit burst=20 nodelay;
    }
}
```
Save and exit (`Ctrl+O`, `Enter`, `Ctrl+X`).

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/opinion-calculator /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default  # Remove default welcome page
sudo nginx -t  # Test config
sudo systemctl restart nginx
```

### 3. Enable HTTPS (SSL)
Run Certbot to automatically get a free Let's Encrypt certificate:
```bash
sudo certbot --nginx -d yourdomain.com
```
Follow the prompts (enter email, agree to terms). Certbot will automatically update your Nginx config to use HTTPS.

### 🎉 Done!
Your application fits production standards and is accessible at `https://yourdomain.com`.

---

## 🔄 Updating in the Future

When you push new code to GitHub, update the server with:
```bash
cd /var/www/opinion-deal-calculator
git pull
npm install  # (Only if you added new packages)
npm run build
pm2 restart deal-calculator
```
