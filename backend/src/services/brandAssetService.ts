import pool from '../config/database.js';
import { BrandAsset, BrandAssetRow } from '../types/index.js';

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
  
  const id = `${assetType}_${brandId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const result = await pool.query<BrandAssetRow>(
    'INSERT INTO brand_assets (id, brand_id, image_url, asset_type) VALUES ($1, $2, $3, $4) RETURNING *',
    [id, brandId, imageUrl, assetType]
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

