# How to See Error Messages and Logs

## The Problem
You're not seeing error messages even though logging code has been added.

## Solution: Make Sure Code is Running

### Step 1: Rebuild Backend (IMPORTANT!)
The backend needs to be rebuilt to include the new logging code:

```bash
cd backend
npm run build
```

This compiles TypeScript to JavaScript in the `dist/` folder.

### Step 2: Restart Backend Server
After rebuilding, restart your backend server:

**If running locally:**
```bash
# Stop the current server (Ctrl+C)
# Then restart:
npm start
# OR if using dev mode:
npm run dev
```

**If running on Railway/Production:**
- Railway should auto-deploy after git push
- Check Railway dashboard to ensure deployment completed
- The server will restart automatically

### Step 3: Hard Refresh Frontend
Clear browser cache and reload:

1. Open DevTools (F12)
2. Right-click the refresh button
3. Select "Empty Cache and Hard Reload"
4. OR use Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)

## Where to Look for Logs

### Browser Console (Frontend Logs)
1. Open your website
2. Press **F12** (or right-click → Inspect)
3. Click the **Console** tab
4. Extract a brand from a URL
5. Look for logs starting with `[Extraction]`

**What you should see:**
```
[Extraction] Starting multi-step extraction for: https://...
[Extraction] Step 1/5: Extracting basic info...
[Extraction] Step 1/5: Basic info extracted: Brand Name
[Extraction] Step 2/5: Extracting visual identity...
...
[Extraction] Step 5/5: Extracting brand images from URL: https://...
[Extraction] Step 5/5: Raw images result: {logoUrl: "...", imageUrls: [...]}
```

### Server Terminal/Logs (Backend Logs)
**If running locally:**
- Check the terminal where you ran `npm start` or `npm run dev`
- Look for logs starting with `[Extract Images]` or `[Gemini Service]`

**If running on Railway:**
1. Go to Railway dashboard
2. Click on your backend service
3. Click "Deployments" tab
4. Click on the latest deployment
5. Click "View Logs" or "Logs" tab
6. Look for logs starting with `[Extract Images]` or `[Gemini Service]`

**What you should see:**
```
[Extract Images] Received request: { url: 'https://...' }
[Extract Images] Calling geminiService.extractBrandImages...
[Gemini Service] extractBrandImages called with URL: https://...
[Gemini Service] Calling Gemini API for image extraction...
[Gemini Service] Received response from Gemini (length: 500)
[Gemini Service] Parsed images info: { hasLogoUrl: true, imageUrlsCount: 5 }
```

## If You Still Don't See Logs

### Check 1: Is the code actually running?
Verify the compiled code has the logs:

```bash
cd backend
grep -r "\[Extract Images\]" dist/
```

If nothing is found, the code wasn't rebuilt. Run `npm run build` again.

### Check 2: Are you using the right extraction method?
The new multi-step extraction is in `BrandDNAForm.tsx`. Make sure you're:
- Using URL extraction (not screenshot upload)
- The extraction is actually running (check Network tab for API calls)

### Check 3: Check Network Tab
1. Open DevTools → Network tab
2. Extract a brand
3. Look for requests to `/extract/images`
4. Click on it to see:
   - Request payload (should have `url`)
   - Response (should have `logoUrl` and `imageUrls`)
   - Status code (200 = success, 500 = error)

### Check 4: Enable All Console Logs
In browser console, make sure log levels aren't filtered:
- Click the filter icon (funnel)
- Make sure "All levels" or "Verbose" is selected
- Uncheck any filters

## Quick Test

Try this to verify logging works:

1. **Rebuild backend:**
   ```bash
   cd backend
   npm run build
   ```

2. **Restart backend server**

3. **Open browser console** (F12 → Console tab)

4. **Extract a brand** from a URL like `https://www.apple.com`

5. **You should immediately see:**
   ```
   [Extraction] Starting multi-step extraction for: https://www.apple.com
   ```

If you don't see this, the frontend code isn't loaded. Try hard refresh (Ctrl+Shift+R).

## Still Not Working?

If logs still don't appear:
1. Share a screenshot of your browser console
2. Share your backend server logs
3. Confirm you rebuilt the backend (`npm run build`)
4. Confirm you restarted the server after rebuilding

