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
  image_generation_prompt_prefix: string;
  created_at?: Date;
  updated_at?: Date;
}

export interface GeneratedAsset {
  id: string;
  brand_id: string;
  type: 'product' | 'campaign' | 'non-product';
  image_url: string;
  campaign_images?: string[];
  strategy: any;
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
  image_generation_prompt_prefix: string;
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

