// Frontend type definitions (camelCase, may include snake_case from API)

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
  text: string;
  font_family: 'sans-serif' | 'serif' | 'cursive';
  font_weight: 'bold' | 'normal';
  font_transform: 'uppercase' | 'none';
  text_color_hex: string;
  position: 'top-center' | 'bottom-left' | 'bottom-right' | 'center-middle' | 'top-left' | 'top-right' | 'center-left' | 'center-right';
  max_width_percent: number;
}

export interface GeneratedAsset {
  id: string;
  brand_id: string;
  type: 'product' | 'campaign' | 'non-product';
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

export type GenerationOption = 'product' | 'campaign' | 'non-product';

