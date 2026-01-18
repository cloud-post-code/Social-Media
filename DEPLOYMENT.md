# Railway Deployment Guide

Complete guide for deploying BrandGenius AI to Railway.

## Prerequisites

- GitHub account with repository pushed
- Railway account (sign up at https://railway.app)
- Google Gemini API key

## Quick Deploy (Automated)

### Option 1: Using Deployment Script

```bash
# Install Railway CLI
npm install -g @railway/cli

# Run automated setup
npm run deploy:railway
```

### Option 2: Using Bash Script

```bash
chmod +x deploy/railway-setup.sh
./deploy/railway-setup.sh
```

## Manual Deployment Steps

### Step 1: Install Railway CLI

```bash
npm install -g @railway/cli
railway login
```

### Step 2: Create Railway Project

1. Go to https://railway.app
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Authorize Railway to access GitHub
5. Select repository: `cloud-post-code/Social-Media`

### Step 3: Add PostgreSQL Database

1. In your Railway project, click "+ New"
2. Select "Database" → "Add PostgreSQL"
3. Wait for provisioning (takes ~30 seconds)
4. Click on PostgreSQL service
5. Go to "Variables" tab
6. Copy the `DATABASE_URL` (you'll need this)

### Step 4: Deploy Backend Service

1. In Railway project, click "+ New" → "GitHub Repo"
2. Select `cloud-post-code/Social-Media` again
3. Railway will create a new service
4. Click on the service → "Settings"
5. Configure:
   - **Root Directory**: `backend`
   - **Build Command**: `npm ci && npm run build`
   - **Start Command**: `npm start`
6. Go to "Variables" tab:
   - Click "New Variable" → "Reference Variable"
   - Select PostgreSQL service → `DATABASE_URL`
   - Add new variable: `GEMINI_API_KEY` = [your API key]
   - Add new variable: `NODE_ENV` = `production`
7. Railway will automatically deploy

### Step 5: Run Database Migrations

**Option A: Via Railway Dashboard**
1. Go to backend service → "Deployments"
2. Click on latest deployment
3. Click "Shell" tab
4. Run: `npm run migrate`

**Option B: Via Railway CLI**
```bash
cd backend
railway link  # Link to your project
railway run npm run migrate
```

### Step 6: Get Backend URL

1. Go to backend service → "Settings"
2. Click "Generate Domain" (if not already generated)
3. Copy the URL (e.g., `https://brandgenius-backend-production.up.railway.app`)

### Step 7: Deploy Frontend Service

1. In Railway project, click "+ New" → "GitHub Repo"
2. Select `cloud-post-code/Social-Media` again
3. Click on the service → "Settings"
4. Configure:
   - **Root Directory**: `/` (leave empty for root)
   - **Build Command**: `npm ci && npm run build`
   - **Start Command**: `npx serve dist -s -l 3000`
5. Go to "Variables" tab:
   - Add: `VITE_API_URL` = `https://[your-backend-url]/api`
   - Replace `[your-backend-url]` with your actual backend URL
6. Railway will automatically deploy

### Step 8: Get Frontend URL

1. Go to frontend service → "Settings"
2. Click "Generate Domain"
3. Copy the URL

## Verify Deployment

1. **Test Backend Health Endpoint**:
   ```bash
   curl https://your-backend.railway.app/health
   ```
   Should return: `{"status":"ok","timestamp":"..."}`

2. **Test Backend API**:
   ```bash
   curl https://your-backend.railway.app/api/brands
   ```
   Should return: `[]` (empty array)

3. **Visit Frontend**:
   - Open your frontend URL in browser
   - Should see the BrandGenius AI interface

## Environment Variables Reference

### Backend Service
| Variable | Source | Required | Description |
|----------|--------|----------|-------------|
| `DATABASE_URL` | PostgreSQL service | Yes | Auto-linked from PostgreSQL |
| `GEMINI_API_KEY` | Manual | Yes | Your Google Gemini API key |
| `NODE_ENV` | Manual | Yes | Set to `production` |
| `PORT` | Railway | Auto | Automatically set by Railway |

### Frontend Service
| Variable | Source | Required | Description |
|----------|--------|----------|-------------|
| `VITE_API_URL` | Manual | Yes | Backend URL + `/api` |

## Troubleshooting

### Backend won't start
- Check logs: Backend service → Logs tab
- Verify `DATABASE_URL` is correctly linked
- Ensure `GEMINI_API_KEY` is set
- Check build logs for TypeScript errors

### Database connection errors
- Verify PostgreSQL service is running
- Check `DATABASE_URL` format is correct
- Ensure migrations have run: `railway run npm run migrate`

### Frontend can't connect to backend
- Verify `VITE_API_URL` is correct (includes `/api`)
- Check backend CORS settings (already configured)
- Ensure backend is deployed and accessible
- Check browser console for errors

### Build failures
- Check Node.js version (Railway uses Node 18)
- Verify all dependencies in `package.json`
- Check build logs in Railway dashboard
- Ensure `package-lock.json` is committed

### Migrations fail
- Verify `DATABASE_URL` is correct
- Check PostgreSQL service is running
- Run migrations manually via Railway shell
- Check migration logs for specific errors

## Monitoring

- **Logs**: View real-time logs in Railway dashboard → Service → Logs
- **Metrics**: Check CPU, memory, and network usage
- **Deployments**: View deployment history and status

## Updating Deployment

Railway automatically redeploys when you push to GitHub:

1. Make changes locally
2. Commit and push to GitHub:
   ```bash
   git add .
   git commit -m "Your changes"
   git push origin main
   ```
3. Railway detects changes and redeploys automatically

## Cost Estimation

Railway pricing (as of 2024):
- **Free tier**: $5 credit/month
- **PostgreSQL**: ~$5/month for starter plan
- **Services**: Pay for usage (usually free tier covers small apps)

## Support

- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- Railway Status: https://status.railway.app

## Next Steps

After deployment:
1. Set up custom domains (optional)
2. Configure monitoring and alerts
3. Set up CI/CD for automatic deployments
4. Configure backups for PostgreSQL database

