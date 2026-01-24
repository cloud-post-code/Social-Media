import pool from '../config/database.js';
import { GeneratedAsset, AssetRow, OverlayConfig } from '../types/index.js';

// Utility function to strip markdown syntax from text
const stripMarkdown = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')  // Remove **bold**
    .replace(/\*(.*?)\*/g, '$1')       // Remove *italic*
    .replace(/__(.*?)__/g, '$1')       // Remove __bold__
    .replace(/_(.*?)_/g, '$1')         // Remove _italic_
    .replace(/~~(.*?)~~/g, '$1')       // Remove ~~strikethrough~~
    .replace(/`(.*?)`/g, '$1')         // Remove `code`
    .trim();
};

// Clean markdown from overlay config
const cleanOverlayConfig = (config: any): OverlayConfig | undefined => {
  if (!config) return undefined;
  return {
    ...config,
    title: config.title ? stripMarkdown(config.title) : config.title,
    subtitle: config.subtitle ? stripMarkdown(config.subtitle) : config.subtitle,
    text: config.text ? stripMarkdown(config.text) : config.text
  };
};

export const getAllAssets = async (brandId?: string, limit?: number): Promise<GeneratedAsset[]> => {
  let query = 'SELECT * FROM generated_assets';
  const params: any[] = [];
  let paramIndex = 1;
  
  if (brandId) {
    query += ` WHERE brand_id = $${paramIndex}`;
    params.push(brandId);
    paramIndex++;
  }
  
  query += ' ORDER BY created_at DESC';
  
  // Limit results to improve performance (default to 20 for sidebar, can be overridden)
  const limitValue = limit || 20;
  query += ` LIMIT $${paramIndex}`;
  params.push(limitValue);
  
  const result = await pool.query<AssetRow>(query, params);
  return result.rows.map(rowToAsset);
};

export const getAssetById = async (id: string): Promise<GeneratedAsset | null> => {
  const result = await pool.query<AssetRow>(
    'SELECT * FROM generated_assets WHERE id = $1',
    [id]
  );
  if (result.rows.length === 0) return null;
  return rowToAsset(result.rows[0]);
};

export const createAsset = async (asset: GeneratedAsset): Promise<GeneratedAsset> => {
  // Store overlay_config and base_image_url in strategy for now (no migration needed)
  const strategyWithMetadata = {
    ...asset.strategy,
    _overlay_config: asset.overlay_config,
    _base_image_url: asset.base_image_url
  };

  const result = await pool.query<AssetRow>(
    `INSERT INTO generated_assets (
      id, brand_id, type, image_url, campaign_images, 
      strategy, user_prompt, feedback_history
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *`,
    [
      asset.id,
      asset.brand_id,
      asset.type,
      asset.image_url,
      asset.campaign_images ? JSON.stringify(asset.campaign_images) : null,
      JSON.stringify(strategyWithMetadata),
      asset.user_prompt || null,
      asset.feedback_history ? JSON.stringify(asset.feedback_history) : null
    ]
  );
  return rowToAsset(result.rows[0]);
};

export const updateAsset = async (id: string, asset: Partial<GeneratedAsset>): Promise<GeneratedAsset> => {
  const existing = await getAssetById(id);
  if (!existing) {
    throw new Error(`Asset with id ${id} not found`);
  }

  const updated = { ...existing, ...asset };
  
  // Store overlay_config and base_image_url in strategy
  const strategyWithMetadata = {
    ...updated.strategy,
    _overlay_config: updated.overlay_config,
    _base_image_url: updated.base_image_url
  };
  
  const result = await pool.query<AssetRow>(
    `UPDATE generated_assets SET
      image_url = $1, campaign_images = $2, strategy = $3,
      user_prompt = $4, feedback_history = $5
    WHERE id = $6
    RETURNING *`,
    [
      updated.image_url,
      updated.campaign_images ? JSON.stringify(updated.campaign_images) : null,
      JSON.stringify(strategyWithMetadata),
      updated.user_prompt || null,
      updated.feedback_history ? JSON.stringify(updated.feedback_history) : null,
      id
    ]
  );
  return rowToAsset(result.rows[0]);
};

export const deleteAsset = async (id: string): Promise<void> => {
  const result = await pool.query('DELETE FROM generated_assets WHERE id = $1', [id]);
  if (result.rowCount === 0) {
    throw new Error(`Asset with id ${id} not found`);
  }
};

function rowToAsset(row: AssetRow): GeneratedAsset {
  // Extract overlay_config and base_image_url from strategy if present
  const strategy = row.strategy || {};
  const overlay_config = strategy._overlay_config || undefined;
  const base_image_url = strategy._base_image_url || undefined;
  
  // Remove metadata from strategy before returning
  const { _overlay_config, _base_image_url, ...cleanStrategy } = strategy;
  
  // Clean markdown from overlay_config when retrieving from database
  const cleanedOverlayConfig = cleanOverlayConfig(overlay_config);
  
  return {
    id: row.id,
    brand_id: row.brand_id,
    type: row.type as 'product' | 'campaign' | 'non-product',
    image_url: row.image_url,
    campaign_images: row.campaign_images || undefined,
    strategy: cleanStrategy,
    overlay_config: cleanedOverlayConfig,
    base_image_url,
    user_prompt: row.user_prompt || undefined,
    feedback_history: row.feedback_history || undefined,
    created_at: row.created_at
  };
}

