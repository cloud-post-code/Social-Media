import pool from '../config/database.js';
import { BrandAsset, BrandAssetRow } from '../types/index.js';

/**
 * Fetch an external image URL and convert it to base64 data URL
 * Includes retry logic with exponential backoff
 */
async function fetchImageAsBase64(imageUrl: string, retries: number = 3): Promise<string> {
  const maxRetries = retries;
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutMs = 30000 + (attempt - 1) * 10000; // 30s, 40s, 50s
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    try {
      console.log(`[Image Fetch] Attempt ${attempt}/${maxRetries} for: ${imageUrl.substring(0, 100)}...`);
      
      // Build headers with referer
      const urlObj = new URL(imageUrl);
      const referer = `${urlObj.protocol}//${urlObj.host}`;
      
      const response = await fetch(imageUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': referer,
          'Cache-Control': 'no-cache'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorMsg = `HTTP ${response.status}: ${response.statusText}`;
        if (response.status === 404) {
          throw new Error(`Image not found (404): ${imageUrl}`);
        } else if (response.status >= 500 && attempt < maxRetries) {
          // Retry on server errors
          console.warn(`[Image Fetch] Server error ${response.status}, will retry...`);
          lastError = new Error(errorMsg);
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000)); // Exponential backoff
          continue;
        }
        throw new Error(errorMsg);
      }
      
      const contentType = response.headers.get('content-type') || '';
      
      // Validate content type
      const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp'];
      const isImage = validImageTypes.some(type => contentType.toLowerCase().includes(type)) || 
                     contentType.startsWith('image/');
      
      if (!isImage && contentType) {
        console.warn(`[Image Fetch] Unexpected content-type: ${contentType} for ${imageUrl}`);
        // Still try to process it - might be an image with wrong content-type
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      // Validate image size (min 100 bytes, max 10MB)
      if (buffer.length < 100) {
        throw new Error(`Image too small (${buffer.length} bytes), likely invalid`);
      }
      if (buffer.length > 10 * 1024 * 1024) {
        throw new Error(`Image too large (${Math.round(buffer.length / 1024 / 1024)}MB), max 10MB`);
      }
      
      // Basic image validation: check for common image magic bytes
      const magicBytes = buffer.slice(0, 4);
      const isValidImage = 
        magicBytes[0] === 0xFF && magicBytes[1] === 0xD8 && magicBytes[2] === 0xFF || // JPEG
        magicBytes[0] === 0x89 && magicBytes[1] === 0x50 && magicBytes[2] === 0x4E && magicBytes[3] === 0x47 || // PNG
        magicBytes[0] === 0x47 && magicBytes[1] === 0x49 && magicBytes[2] === 0x46 || // GIF
        buffer.slice(0, 2).toString() === 'BM' || // BMP
        buffer.slice(0, 4).toString() === 'RIFF'; // WebP (simplified check)
      
      if (!isValidImage && !contentType.includes('svg')) {
        console.warn(`[Image Fetch] Image magic bytes validation failed for ${imageUrl}, but continuing...`);
      }
      
      const base64 = buffer.toString('base64');
      const finalContentType = contentType && contentType.startsWith('image/') 
        ? contentType.split(';')[0] // Remove charset if present
        : 'image/png';
      
      const dataUrl = `data:${finalContentType};base64,${base64}`;
      console.log(`[Image Fetch] Successfully converted ${imageUrl.substring(0, 50)}... to base64 (${Math.round(buffer.length / 1024)}KB) on attempt ${attempt}`);
      
      return dataUrl;
    } catch (error: any) {
      clearTimeout(timeoutId);
      const errorMsg = error.name === 'AbortError' 
        ? `Request timeout after ${timeoutMs}ms`
        : error.message || 'Unknown error';
      
      lastError = error;
      
      if (attempt < maxRetries) {
        const backoffMs = Math.pow(2, attempt) * 1000; // Exponential backoff: 2s, 4s, 8s
        console.warn(`[Image Fetch] Attempt ${attempt} failed: ${errorMsg}. Retrying in ${backoffMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      } else {
        console.error(`[Image Fetch] All ${maxRetries} attempts failed for ${imageUrl}:`, errorMsg);
      }
    }
  }
  
  // All retries failed
  throw new Error(`Failed to fetch image from ${imageUrl} after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`);
}

export const getBrandAssets = async (
  brandId: string,
  assetType?: 'logo' | 'brand_image'
): Promise<BrandAsset[]> => {
  let query = 'SELECT * FROM brand_assets WHERE brand_id = $1';
  const params: any[] = [brandId];
  
  if (assetType) {
    query += ' AND asset_type = $2';
    params.push(assetType);
  }
  
  query += ' ORDER BY created_at ASC';
  
  const result = await pool.query<BrandAssetRow>(query, params);
  return result.rows.map(rowToBrandAsset);
};

export const getBrandLogo = async (brandId: string): Promise<BrandAsset | null> => {
  const result = await pool.query<BrandAssetRow>(
    'SELECT * FROM brand_assets WHERE brand_id = $1 AND asset_type = $2 LIMIT 1',
    [brandId, 'logo']
  );
  
  if (result.rows.length === 0) return null;
  return rowToBrandAsset(result.rows[0]);
};

export const createBrandAsset = async (
  brandId: string,
  imageUrl: string,
  assetType: 'logo' | 'brand_image'
): Promise<BrandAsset> => {
  // If imageUrl is an external URL (starts with http), fetch and convert to base64
  let finalImageUrl = imageUrl;
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    console.log(`[Brand Asset] Converting external URL to base64: ${imageUrl.substring(0, 100)}...`);
    try {
      finalImageUrl = await fetchImageAsBase64(imageUrl);
      console.log(`[Brand Asset] Successfully converted external image to base64`);
    } catch (error: any) {
      // Don't silently fall back - external URLs will fail due to CORS
      // Log the error and rethrow so the caller knows it failed
      console.error(`[Brand Asset] CRITICAL: Failed to convert external image to base64: ${imageUrl}`, error.message);
      throw new Error(`Unable to fetch and convert image from ${imageUrl}. The image may be inaccessible or the URL may be invalid: ${error.message}`);
    }
  }
  
  // Validate that we have a valid image URL (either base64 data URL or relative path)
  if (!finalImageUrl || finalImageUrl.trim().length === 0) {
    throw new Error('Invalid image URL: empty or whitespace');
  }
  
  // Verify it's either base64 or not an external URL
  if (finalImageUrl.startsWith('http://') || finalImageUrl.startsWith('https://')) {
    throw new Error(`Image conversion failed: URL is still external: ${finalImageUrl.substring(0, 100)}`);
  }
  
  // For logos, check if one already exists and overwrite it
  if (assetType === 'logo') {
    const existingLogo = await getBrandLogo(brandId);
    if (existingLogo) {
      console.log(`[Brand Asset] Logo already exists, updating existing logo: ${existingLogo.id}`);
      const result = await pool.query<BrandAssetRow>(
        'UPDATE brand_assets SET image_url = $1, created_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
        [finalImageUrl, existingLogo.id]
      );
      console.log(`[Brand Asset] Successfully updated logo: ${existingLogo.id}`);
      return rowToBrandAsset(result.rows[0]);
    }
  }
  
  // For brand images, check if an identical image already exists and overwrite it
  if (assetType === 'brand_image') {
    const existingImages = await getBrandAssets(brandId, 'brand_image');
    const existingImage = existingImages.find(img => img.image_url === finalImageUrl);
    if (existingImage) {
      console.log(`[Brand Asset] Identical brand image already exists, updating: ${existingImage.id}`);
      const result = await pool.query<BrandAssetRow>(
        'UPDATE brand_assets SET image_url = $1, created_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
        [finalImageUrl, existingImage.id]
      );
      console.log(`[Brand Asset] Successfully updated brand image: ${existingImage.id}`);
      return rowToBrandAsset(result.rows[0]);
    }
  }
  
  // Generate unique ID: assetType_brandId_timestamp_random
  // Use performance.now() for better precision and ensure single timestamp
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 11); // 9 chars
  const id = `${assetType}_${brandId}_${timestamp}_${randomStr}`;
  
  // Validate ID format before inserting
  if (id.length > 255) {
    throw new Error(`Generated asset ID is too long: ${id.length} characters`);
  }
  
  console.log(`[Brand Asset] Creating new asset with ID: ${id.substring(0, 80)}...`);
  
  const result = await pool.query<BrandAssetRow>(
    'INSERT INTO brand_assets (id, brand_id, image_url, asset_type) VALUES ($1, $2, $3, $4) RETURNING *',
    [id, brandId, finalImageUrl, assetType]
  );
  
  console.log(`[Brand Asset] Successfully created asset: ${result.rows[0].id}`);
  return rowToBrandAsset(result.rows[0]);
};

export const deleteBrandAsset = async (assetId: string): Promise<void> => {
  console.log(`[Brand Asset] Attempting to delete asset with ID: ${assetId}`);
  
  // First check if asset exists
  const checkResult = await pool.query<BrandAssetRow>(
    'SELECT id, brand_id, asset_type FROM brand_assets WHERE id = $1',
    [assetId]
  );
  
  if (checkResult.rows.length === 0) {
    console.error(`[Brand Asset] Asset not found for deletion: ${assetId}`);
    // Try to find similar IDs for debugging
    const similarAssets = await pool.query<BrandAssetRow>(
      'SELECT id FROM brand_assets WHERE id LIKE $1 LIMIT 5',
      [`%${assetId.split('_').slice(-2).join('_')}%`]
    );
    if (similarAssets.rows.length > 0) {
      console.log(`[Brand Asset] Found similar asset IDs:`, similarAssets.rows.map(r => r.id));
    }
    throw new Error(`Brand asset with id ${assetId} not found`);
  }
  
  const asset = checkResult.rows[0];
  console.log(`[Brand Asset] Found asset to delete: ${asset.id}, type: ${asset.asset_type}, brand: ${asset.brand_id}`);
  
  const result = await pool.query('DELETE FROM brand_assets WHERE id = $1', [assetId]);
  if (result.rowCount === 0) {
    throw new Error(`Failed to delete brand asset with id ${assetId}`);
  }
  
  console.log(`[Brand Asset] Successfully deleted asset: ${assetId}`);
};

export const migrateBrandAssets = async (
  brandId: string,
  logoUrl?: string,
  brandImages?: string[]
): Promise<void> => {
  if (logoUrl) {
    const existingLogo = await getBrandLogo(brandId);
    if (!existingLogo) {
      await createBrandAsset(brandId, logoUrl, 'logo');
    }
  }
  
  if (brandImages && brandImages.length > 0) {
    const existingImages = await getBrandAssets(brandId, 'brand_image');
    const existingUrls = new Set(existingImages.map(img => img.image_url));
    
    for (const imageUrl of brandImages.slice(0, 10 - existingImages.length)) {
      if (!existingUrls.has(imageUrl)) {
        await createBrandAsset(brandId, imageUrl, 'brand_image');
      }
    }
  }
};

function rowToBrandAsset(row: BrandAssetRow): BrandAsset {
  return {
    id: row.id,
    brand_id: row.brand_id,
    image_url: row.image_url,
    asset_type: row.asset_type as 'logo' | 'brand_image',
    created_at: row.created_at
  };
}

