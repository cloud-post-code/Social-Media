import pool from '../config/database.js';
import { BrandAsset, BrandAssetRow } from '../types/index.js';

/**
 * Fetch an external image URL and convert it to base64 data URL
 */
async function fetchImageAsBase64(imageUrl: string): Promise<string> {
  try {
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'image/*'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');
    const contentType = response.headers.get('content-type') || 'image/png';
    
    return `data:${contentType};base64,${base64}`;
  } catch (error: any) {
    console.error(`Error fetching image ${imageUrl}:`, error.message);
    throw new Error(`Failed to fetch image from ${imageUrl}: ${error.message}`);
  }
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
  // Check limits
  if (assetType === 'logo') {
    const existingLogo = await getBrandLogo(brandId);
    if (existingLogo) {
      throw new Error('Brand already has a logo. Delete the existing logo first.');
    }
  } else if (assetType === 'brand_image') {
    const existingImages = await getBrandAssets(brandId, 'brand_image');
    if (existingImages.length >= 10) {
      throw new Error('Maximum of 10 brand images allowed');
    }
  }
  
  // If imageUrl is an external URL (starts with http), fetch and convert to base64
  let finalImageUrl = imageUrl;
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    try {
      console.log(`Fetching external image: ${imageUrl}`);
      finalImageUrl = await fetchImageAsBase64(imageUrl);
      console.log(`Successfully converted external image to base64`);
    } catch (error: any) {
      console.error(`Failed to fetch image ${imageUrl}, using URL as-is:`, error.message);
      // Fallback: use URL as-is (might fail due to CORS, but at least we tried)
      // In production, you might want to throw here instead
    }
  }
  
  const id = `${assetType}_${brandId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const result = await pool.query<BrandAssetRow>(
    'INSERT INTO brand_assets (id, brand_id, image_url, asset_type) VALUES ($1, $2, $3, $4) RETURNING *',
    [id, brandId, finalImageUrl, assetType]
  );
  
  return rowToBrandAsset(result.rows[0]);
};

export const deleteBrandAsset = async (assetId: string): Promise<void> => {
  const result = await pool.query('DELETE FROM brand_assets WHERE id = $1', [assetId]);
  if (result.rowCount === 0) {
    throw new Error(`Brand asset with id ${assetId} not found`);
  }
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

