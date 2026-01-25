// Frontend type definitions (camelCase, may include snake_case from API)

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
  title_font_family: string; // Can be 'sans-serif' | 'serif' | 'cursive' | 'handwritten' or any Google Font name
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
  subtitle_font_family: string; // Can be 'sans-serif' | 'serif' | 'cursive' | 'handwritten' or any Google Font name
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
  type: 'product' | 'campaign' | 'non-product' | 'background';
  image_url: string;
  campaign_images?: string[];
  strategy: any;
  overlay_config?: OverlayConfig;
  base_image_url?: string;
  user_prompt?: string;
  feedback_history?: string[];
  created_at?: Date;
  // Frontend convenience fields (converted from backend)
  timestamp?: number;
  brandId?: string;
  imageUrl?: string;
  campaignImages?: string[];
  overlayConfig?: OverlayConfig;
  baseImageUrl?: string;
  userPrompt?: string;
  feedbackHistory?: string[];
}

export interface BrandAsset {
  id: string;
  brand_id: string;
  image_url: string;
  asset_type: 'logo' | 'brand_image';
  created_at?: Date;
}

export type GenerationOption = 'product' | 'non-product' | 'background';

