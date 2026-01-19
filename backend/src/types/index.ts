// Backend type definitions (snake_case to match database)

export interface BrandDNA {
  id: string;
  name: string;
  tagline?: string;
  overview?: string;
  logo_url?: string;
  visual_identity: {
    primary_color_hex: string;
    accent_color_hex: string;
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
  font_family: 'sans-serif' | 'serif' | 'cursive' | 'handwritten';
  font_weight: 'light' | 'regular' | 'bold';
  font_transform: 'uppercase' | 'lowercase' | 'capitalize' | 'none';
  letter_spacing: 'normal' | 'wide';
  text_color_hex: string; // Legacy: single color for both title and subtitle
  title_color_hex?: string; // Separate color for title
  subtitle_color_hex?: string; // Separate color for subtitle
  // New: Pixel-based positioning (percentages 0-100)
  x_percent?: number; // Horizontal position as percentage (0 = left, 100 = right)
  y_percent?: number; // Vertical position as percentage (0 = top, 100 = bottom)
  text_anchor?: 'start' | 'middle' | 'end'; // Horizontal alignment of text (legacy, applies to both)
  title_text_anchor?: 'start' | 'middle' | 'end'; // Separate anchor for title
  subtitle_text_anchor?: 'start' | 'middle' | 'end'; // Separate anchor for subtitle
  // Legacy: String-based position (for backward compatibility)
  position?: 'top-center' | 'bottom-left' | 'bottom-right' | 'center-middle' | 'top-left' | 'top-right' | 'center-left' | 'center-right' | 'floating-center';
  max_width_percent: number;
  opacity?: number;
  title_font_size?: number;
  subtitle_font_size?: number;
  title_max_lines?: number;
  subtitle_max_lines?: number;
  // Legacy support - will be removed
  text?: string;
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

export interface BrandRow {
  id: string;
  name: string;
  tagline?: string;
  overview?: string;
  logo_url?: string;
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

