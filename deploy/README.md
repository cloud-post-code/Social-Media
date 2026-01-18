# Railway Deployment Agent

This directory contains automated deployment scripts for Railway.

## Quick Start

### Option 1: Automated Setup (Recommended)

**Using Node.js script:**
```bash
npm install -g @railway/cli
node deploy/railway-setup.js
```

**Using Bash script:**
```bash
chmod +x deploy/railway-setup.sh
./deploy/railway-setup.sh
```

### Option 2: Manual Setup via Railway Dashboard

1. **Install Railway CLI** (if not already installed):
   ```bash
   npm install -g @railway/cli
   ```

2. **Login to Railway**:
   ```bash
   railway login
   ```

3. **Create/Link Project**:
   ```bash
   railway init  # or railway link for existing project
   ```

4. **Add PostgreSQL Database**:
   - Go to Railway Dashboard
   - Click "+ New" → Database → Add PostgreSQL
   - Copy the `DATABASE_URL` from variables

5. **Deploy Backend**:
   ```bash
   cd backend
   railway up
   ```
   
   Set environment variables:
   - `DATABASE_URL` (link from PostgreSQL service)
   - `GEMINI_API_KEY` (your API key)
   - `NODE_ENV=production`

6. **Run Migrations**:
   ```bash
   railway run npm run migrate
   ```

7. **Deploy Frontend**:
   ```bash
   cd ..
   railway up
   ```
   
   Set environment variable:
   - `VITE_API_URL` (your backend URL + `/api`)

## Configuration Files

- `railway.json` - Root Railway configuration
- `backend/railway.json` - Backend service configuration
- `backend/nixpacks.toml` - Build configuration for backend

## Environment Variables

### Backend
- `DATABASE_URL` - PostgreSQL connection string (from Railway PostgreSQL service)
- `GEMINI_API_KEY` - Your Google Gemini API key
- `NODE_ENV` - Set to `production`
- `PORT` - Automatically set by Railway

### Frontend
- `VITE_API_URL` - Backend API URL (e.g., `https://your-backend.railway.app/api`)

## Troubleshooting

### Railway CLI not found
```bash
npm install -g @railway/cli
```

### Database connection issues
- Verify `DATABASE_URL` is correctly linked from PostgreSQL service
- Check PostgreSQL service is running in Railway dashboard
- Ensure migrations have run successfully

### Build failures
- Check Node.js version (Railway uses Node 18 by default)
- Verify all dependencies are in `package.json`
- Check build logs in Railway dashboard

### Frontend can't connect to backend
- Verify `VITE_API_URL` is set correctly
- Check backend CORS settings
- Ensure backend is deployed and running
- Check Railway service URLs

## Manual Deployment Steps

If automated scripts don't work, follow these manual steps:

1. **Create Railway Project**
   - Go to https://railway.app
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository

2. **Add PostgreSQL**
   - In project, click "+ New"
   - Select "Database" → "Add PostgreSQL"
   - Wait for provisioning

3. **Deploy Backend Service**
   - Click "+ New" → "GitHub Repo"
   - Select your repository
   - Settings → Root Directory: `backend`
   - Build Command: `npm ci && npm run build`
   - Start Command: `npm start`
   - Variables:
     - Link `DATABASE_URL` from PostgreSQL
     - Add `GEMINI_API_KEY`
     - Add `NODE_ENV=production`

4. **Run Migrations**
   - Backend service → Deployments → Latest → Shell
   - Run: `npm run migrate`

5. **Deploy Frontend Service**
   - Click "+ New" → "GitHub Repo"
   - Select your repository
   - Build Command: `npm ci && npm run build`
   - Start Command: `npx serve dist -s -l 3000`
   - Variables:
     - Add `VITE_API_URL` (backend URL + `/api`)

## Post-Deployment

1. Get service URLs from Railway dashboard
2. Test backend: `curl https://your-backend.railway.app/health`
3. Visit frontend URL
4. Monitor logs in Railway dashboard

## Support

For Railway-specific issues, check:
- Railway Documentation: https://docs.railway.app
- Railway Discord: https://discord.gg/railway

