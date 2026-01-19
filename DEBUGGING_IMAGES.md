# Debugging Image Extraction Issues

## Quick Debugging Steps

### 1. Check Browser Console (Frontend)
Open your browser's Developer Tools (F12) and check the Console tab. Look for:
- `[Extraction]` logs - these show each step of the extraction process
- `[Extraction] Step 5/5` - this is the image extraction step
- Any red error messages

**What to look for:**
- Does Step 5/5 show "Brand images extracted" with image counts?
- Are there any errors about failed image extraction?
- Check the "Raw images result" log to see what Gemini returned

### 2. Check Server Logs (Backend)
Check your backend server console/terminal. Look for:
- `[Extract Images]` logs - shows the API endpoint being called
- `[Gemini Service]` logs - shows the Gemini API call and response
- `[Brand Asset]` logs - shows image downloading and conversion
- `[Image Fetch]` logs - shows individual image fetch attempts

**What to look for:**
- Does `[Extract Images]` show the URL being processed?
- Does `[Gemini Service]` show a response with image URLs?
- Are there any "Failed to fetch image" errors?
- Check if images are being converted to base64 successfully

### 3. Test Individual Steps

#### Test Image Extraction API Directly
Use curl or Postman to test the image extraction endpoint:

```bash
curl -X POST http://localhost:3000/api/brands/extract/images \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```

Check the response - does it return `logoUrl` and `imageUrls`?

#### Test Image Downloading
Check if individual image URLs can be downloaded. Look for:
- CORS errors
- 404 errors
- Timeout errors
- Invalid image format errors

### 4. Common Issues and Solutions

#### Issue: No images returned from Gemini
**Symptoms:** Step 5/5 shows 0 images
**Check:**
- Is the URL accessible? Try opening it in a browser
- Check Gemini API response in server logs
- The website might not have extractable images

#### Issue: Images extracted but not saved
**Symptoms:** Step 5/5 shows images found, but they don't appear in UI
**Check:**
- Look for `[Extraction] ✗ Failed to save` errors
- Check if image URLs are valid (not relative paths)
- Check if image download/conversion is failing
- Verify brand ID exists before saving assets

#### Issue: Images fail to download
**Symptoms:** `[Image Fetch] Failed to fetch` errors
**Possible causes:**
- CORS blocking (should be fixed with base64 conversion)
- Invalid URLs (relative paths instead of absolute)
- Images require authentication
- Images are behind a CDN that blocks requests

#### Issue: Empty extractedAssets object
**Symptoms:** `[Extraction] No assets to save` log
**Check:**
- Did Step 5/5 complete successfully?
- Check if `extractedAssets` has `logoUrl` or `imageUrls`
- Verify the API response structure matches expected format

### 5. Enable More Detailed Logging

The code now includes comprehensive logging. To see more details:

**Frontend:** All logs are prefixed with `[Extraction]`
**Backend:** Logs are prefixed with:
- `[Extract Images]` - API endpoint
- `[Gemini Service]` - Gemini API calls
- `[Brand Asset]` - Asset creation
- `[Image Fetch]` - Image downloading

### 6. Manual Testing Checklist

1. ✅ Extract a brand DNA from a URL
2. ✅ Check browser console for `[Extraction]` logs
3. ✅ Verify Step 5/5 shows image extraction attempt
4. ✅ Check if images are found (logoUrl and imageUrls count)
5. ✅ Verify images are being saved (check `[Extraction] ✓ Logo saved` logs)
6. ✅ Check server logs for image download attempts
7. ✅ Verify images appear in the UI after extraction

### 7. Network Tab Inspection

In browser DevTools → Network tab:
- Filter by "extract" to see extraction API calls
- Check the `/extract/images` request/response
- Verify the response contains `logoUrl` and `imageUrls`
- Check if image URLs in response are valid absolute URLs

### 8. Database Check

If images are saved but not showing:
```sql
SELECT * FROM brand_assets WHERE brand_id = 'YOUR_BRAND_ID';
```

Check:
- Are records being created?
- Are `image_url` values base64 data URLs (start with `data:image/`)?
- Or are they still external URLs (start with `http://`)?

### 9. Quick Fixes to Try

1. **Clear browser cache** and reload
2. **Restart backend server** to ensure latest code is running
3. **Check environment variables** - is `GEMINI_API_KEY` set?
4. **Try a different URL** - some websites block scraping
5. **Check network connectivity** - can backend reach external URLs?

## Reporting Issues

When reporting issues, include:
1. Browser console logs (especially `[Extraction]` logs)
2. Server logs (especially `[Extract Images]` and `[Gemini Service]` logs)
3. Network tab screenshot of the `/extract/images` request
4. The URL you're trying to extract from
5. Any error messages you see

