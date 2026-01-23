// Backend type definitions (snake_case to match database)

export interface BrandDNA {
  id: string;
  name: string;
  tagline?: string;
  overview?: string;
  visual_identity: {
    primary_color_hex: string;
    accent_color_hex: string;
    colors?: string[];
    background_style: string;
    imagery_style: string;
    font_vibe: string;
    logo_style?: string;
  };
  brand_voice: {
    tone_adjectives: string[];
    writing_style: string;
    keywords_to_use: string[];
    taboo_words: string[];
  };
  strategic_profile: {
    target_audience: string;
    core_value_prop: string;
    product_category: string;
  };
  created_at?: Date;
  updated_at?: Date;
}

export interface OverlayConfig {
  title: string;
  subtitle: string;
  // Title properties - completely separate
  title_font_family: 'sans-serif' | 'serif' | 'cursive' | 'handwritten';
  title_font_weight: 'light' | 'regular' | 'bold';
  title_font_transform: 'uppercase' | 'lowercase' | 'capitalize' | 'none';
  title_letter_spacing: 'normal' | 'wide';
  title_color_hex: string;
  title_x_percent: number;
  title_y_percent: number;
  title_text_anchor: 'start' | 'middle' | 'end';
  title_max_width_percent: number;
  title_opacity: number;
  title_font_size?: number;
  title_overlay_background_type?: 'gradient' | 'solid' | 'blur' | 'shape' | 'none';
  title_overlay_background_color?: string;
  title_overlay_background_opacity?: number;
  title_overlay_background_shape?: 'rectangle' | 'rounded' | 'pill' | 'circle';
  title_overlay_background_padding?: number;
  title_lines?: string[]; // Pre-calculated line breaks for exact frontend match
  // Subtitle properties - completely separate
  subtitle_font_family: 'sans-serif' | 'serif' | 'cursive' | 'handwritten';
  subtitle_font_weight: 'light' | 'regular' | 'bold';
  subtitle_font_transform: 'uppercase' | 'lowercase' | 'capitalize' | 'none';
  subtitle_letter_spacing: 'normal' | 'wide';
  subtitle_color_hex: string;
  subtitle_x_percent: number;
  subtitle_y_percent: number;
  subtitle_text_anchor: 'start' | 'middle' | 'end';
  subtitle_max_width_percent: number;
  subtitle_opacity: number;
  subtitle_font_size?: number;
  subtitle_overlay_background_type?: 'gradient' | 'solid' | 'blur' | 'shape' | 'none';
  subtitle_overlay_background_color?: string;
  subtitle_overlay_background_opacity?: number;
  subtitle_overlay_background_shape?: 'rectangle' | 'rounded' | 'pill' | 'circle';
  subtitle_overlay_background_padding?: number;
  subtitle_lines?: string[]; // Pre-calculated line breaks for exact frontend match
}

export interface GeneratedAsset {
  id: string;
  brand_id: string;
  type: 'product' | 'campaign' | 'non-product';
  image_url: string;
  campaign_images?: string[];
  strategy: any;
  overlay_config?: OverlayConfig;
  base_image_url?: string; // Original image before overlay
  user_prompt?: string;
  feedback_history?: string[];
  created_at?: Date;
}

export interface BrandAsset {
  id: string;
  brand_id: string;
  image_url: string;
  asset_type: 'logo' | 'brand_image';
  created_at?: Date;
}

export interface BrandAssetRow {
  id: string;
  brand_id: string;
  image_url: string;
  asset_type: string;
  created_at: Date;
}

export interface BrandRow {
  id: string;
  name: string;
  tagline?: string;
  overview?: string;
  logo_url?: string;
  brand_images?: any;
  visual_identity: any;
  brand_voice: any;
  strategic_profile: any;
  created_at: Date;
  updated_at: Date;
}

export interface AssetRow {
  id: string;
  brand_id: string;
  type: string;
  image_url: string;
  campaign_images?: any;
  strategy: any;
  user_prompt?: string;
  feedback_history?: any;
  created_at: Date;
}

export interface ScrapingCodeResponse {
  scraping_code: string;
  reasoning?: string;
}

