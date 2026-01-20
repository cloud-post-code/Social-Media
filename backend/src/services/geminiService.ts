import { GoogleGenAI } from "@google/genai";
import { BrandDNA } from "../types/index.js";
import dotenv from 'dotenv';

dotenv.config();

const getAIClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set');
  }
  return new GoogleGenAI({ apiKey });
};

const safeJsonParse = (str: string) => {
  try {
    const cleaned = str.replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (e) {
    console.error("JSON Parse Error:", e, str);
    return null;
  }
};

export const extractBrandDNA = async (input: { url?: string; imageBase64?: string }): Promise<BrandDNA> => {
  const ai = getAIClient();
  const model = 'gemini-3-flash-preview';
  
  const source = input.url ? `website URL: ${input.url}` : 'attached website screenshot';
  const urlContext = input.url ? `\n\nIMPORTANT: Visit and analyze the website at ${input.url}. Extract information directly from the website content, design, and messaging.` : '';

  // Step 1: Extract Basic Brand Information
  const basicInfoPrompt = `
    You are an expert Chief Marketing Officer and Creative Director.
    Analyze the ${source} to extract the core brand identity information.
    ${urlContext}
    
    Focus specifically on extracting:
    - The company/brand name (exact name as it appears)
    - The brand tagline or main slogan (if present)
    - A comprehensive overview paragraph describing what the brand is about, its mission, and core values
    
    Return ONLY a JSON object with this exact structure:
    {
      "name": "Exact brand name",
      "tagline": "Brand tagline or slogan",
      "overview": "Detailed paragraph describing the brand's mission, values, and essence"
    }
    
    Return ONLY JSON. No markdown, no explanations.
  `;

  let basicContents: any;
  if (input.imageBase64) {
    const base64Data = input.imageBase64.includes(',') 
      ? input.imageBase64.split(',')[1] 
      : input.imageBase64;
    basicContents = {
      parts: [
        { text: basicInfoPrompt },
        { inlineData: { mimeType: "image/png", data: base64Data } }
      ]
    };
  } else {
    basicContents = { parts: [{ text: basicInfoPrompt }] };
  }

  let basicInfo: any = {};
  try {
    const basicResponse = await ai.models.generateContent({
      model,
      contents: basicContents,
      config: { responseMimeType: "application/json" }
    });
    if (!basicResponse.text) {
      throw new Error('No response text from Gemini API');
    }
    basicInfo = safeJsonParse(basicResponse.text || '{}') || {};
  } catch (error: any) {
    console.error('Error extracting basic info:', error);
    // Continue with defaults to allow partial extraction
    basicInfo = {};
  }
  const brandName = basicInfo.name || 'Unknown Brand';

  // Step 2: Extract Visual Identity
  const visualPrompt = `
    You are an expert Brand Designer and Visual Identity Specialist.
    Analyze the ${source} to extract detailed visual identity information.
    ${urlContext}
    
    CRITICAL: You must analyze the ACTUAL colors present on the website/screenshot, not generic brand colors.
    
    Focus specifically on:
    - Primary brand color (the main brand color actually used on the website - look at headers, logos, navigation, primary buttons, and key UI elements. Extract the EXACT hex code from the visual design)
    - Accent color (secondary color used for highlights, CTAs, links, or accent elements. Extract the EXACT hex code from buttons, links, or highlighted elements)
    - Background style (describe the typical background aesthetic - include hex if solid color)
    - Imagery style (describe the photography/image style used)
    - Typography vibe (describe the font personality and style - analyze the actual fonts used)
    - Logo style (describe the logo's visual characteristics - analyze the actual logo if visible)
    
    IMPORTANT COLOR EXTRACTION INSTRUCTIONS:
    1. Look at the website header/navigation bar - what color is it? Extract that hex code.
    2. Look at primary buttons or CTAs - what color are they? Extract that hex code.
    3. Look at links or highlighted text - what color are they? Extract that hex code.
    4. Look at the overall color scheme - identify ALL distinct colors used on the website (not just 2-3).
    5. Extract ALL colors found: primary colors, accent colors, background colors, text colors, border colors, etc.
    6. If analyzing a screenshot, use the actual pixel colors you see, not assumptions.
    7. Return REAL hex codes from the website, not generic brand colors like "#000000" or "#FFFFFF" unless those are actually used.
    8. If the website uses gradients, identify all the colors in the gradient.
    9. Avoid default colors - look for the actual brand colors being used.
    10. Include ALL colors found, even if there are many - do not limit to just 2-3 colors.
    
    Return ONLY a JSON object with this exact structure:
    {
      "primary_color_hex": "#HEXCODE (the most dominant/main brand color, e.g. #1a1a1a or #ff6b6b)",
      "accent_color_hex": "#HEXCODE (the second most prominent color, e.g. #4ecdc4 or #ffe66d)",
      "colors": ["#HEXCODE1", "#HEXCODE2", "#HEXCODE3", ...] (array of ALL distinct colors found on the website, including primary and accent),
      "background_style": "Description of background style (include hex if solid color)",
      "imagery_style": "Description of imagery/photography style",
      "font_vibe": "Description of typography personality",
      "logo_style": "Description of logo characteristics"
    }
    
    Return ONLY JSON. No markdown, no explanations. Ensure hex codes are valid (6 characters after #).
  `;

  let visualContents: any;
  if (input.imageBase64) {
    const base64Data = input.imageBase64.includes(',') 
      ? input.imageBase64.split(',')[1] 
      : input.imageBase64;
    visualContents = {
      parts: [
        { text: visualPrompt },
        { inlineData: { mimeType: "image/png", data: base64Data } }
      ]
    };
  } else {
    visualContents = { parts: [{ text: visualPrompt }] };
  }

  let visualInfo: any = {};
  try {
    const visualResponse = await ai.models.generateContent({
      model,
      contents: visualContents,
      config: { responseMimeType: "application/json" }
    });
    if (!visualResponse.text) {
      throw new Error('No response text from Gemini API');
    }
    visualInfo = safeJsonParse(visualResponse.text || '{}') || {};
  } catch (error: any) {
    console.error('Error extracting visual identity:', error);
    // Continue with defaults instead of throwing to allow partial extraction
    visualInfo = {};
  }

  // Step 3: Extract Brand Voice
  const voicePrompt = `
    You are an expert Copywriter and Brand Voice Strategist.
    Analyze the ${source} to extract the brand's voice and messaging style.
    ${urlContext}
    
    Focus specifically on:
    - Tone adjectives (3-5 words that describe the brand's tone)
    - Writing style (describe sentence structure, formality, length)
    - Keywords to use (3-5 key terms/phrases the brand uses)
    - Taboo words (words the brand avoids or would never use)
    
    Return ONLY a JSON object with this exact structure:
    {
      "tone_adjectives": ["adjective1", "adjective2", "adjective3"],
      "writing_style": "Description of writing style",
      "keywords_to_use": ["keyword1", "keyword2", "keyword3"],
      "taboo_words": ["word1", "word2", "word3"]
    }
    
    Return ONLY JSON. No markdown, no explanations.
  `;

  let voiceContents: any;
  if (input.imageBase64) {
    const base64Data = input.imageBase64.includes(',') 
      ? input.imageBase64.split(',')[1] 
      : input.imageBase64;
    voiceContents = {
      parts: [
        { text: voicePrompt },
        { inlineData: { mimeType: "image/png", data: base64Data } }
      ]
    };
  } else {
    voiceContents = { parts: [{ text: voicePrompt }] };
  }

  let voiceInfo: any = {};
  try {
    const voiceResponse = await ai.models.generateContent({
      model,
      contents: voiceContents,
      config: { responseMimeType: "application/json" }
    });
    if (!voiceResponse.text) {
      throw new Error('No response text from Gemini API');
    }
    voiceInfo = safeJsonParse(voiceResponse.text || '{}') || {};
  } catch (error: any) {
    console.error('Error extracting brand voice:', error);
    // Continue with defaults instead of throwing to allow partial extraction
    voiceInfo = {};
  }

  // Step 4: Extract Strategic Profile
  const strategicPrompt = `
    You are an expert Marketing Strategist and Brand Analyst.
    Analyze the ${source} to extract strategic positioning information.
    ${urlContext}
    
    Focus specifically on:
    - Target audience (specific demographic and psychographic description)
    - Core value proposition (main benefit or promise the brand makes)
    - Product category (industry niche or category)
    
    Return ONLY a JSON object with this exact structure:
    {
      "target_audience": "Specific audience description",
      "core_value_prop": "Main benefit promised",
      "product_category": "Industry niche"
    }
    
    Return ONLY JSON. No markdown, no explanations.
  `;

  let strategicContents: any;
  if (input.imageBase64) {
    const base64Data = input.imageBase64.includes(',') 
      ? input.imageBase64.split(',')[1] 
      : input.imageBase64;
    strategicContents = {
      parts: [
        { text: strategicPrompt },
        { inlineData: { mimeType: "image/png", data: base64Data } }
      ]
    };
  } else {
    strategicContents = { parts: [{ text: strategicPrompt }] };
  }

  let strategicInfo: any = {};
  try {
    const strategicResponse = await ai.models.generateContent({
      model,
      contents: strategicContents,
      config: { responseMimeType: "application/json" }
    });
    if (!strategicResponse.text) {
      throw new Error('No response text from Gemini API');
    }
    strategicInfo = safeJsonParse(strategicResponse.text || '{}') || {};
  } catch (error: any) {
    console.error('Error extracting strategic profile:', error);
    // Continue with defaults instead of throwing to allow partial extraction
    strategicInfo = {};
  }

  // Step 5: Extract Brand Images (Logo + Key Images) - Only when URL is provided
  let imagesInfo: any = {};
  if (input.url) {
    const imagesPrompt = `
      You are an expert Web Scraper and Brand Asset Analyst.
      Analyze the website at ${input.url} to extract brand images.
      ${urlContext}
      
      Your task:
      1. Identify the logo image URL (the main brand logo, typically in header/navbar)
      2. Extract 3-10 key brand images (hero images, product images, lifestyle images, etc.)
         - Prioritize high-quality, representative images
         - Avoid duplicates or very similar images
         - Focus on images that represent the brand visually
         - Look for images in the main content area, hero sections, and product galleries
      
      Return ONLY a JSON object with this exact structure:
      {
        "logo_url": "Full URL to the logo image (or empty string if not found)",
        "image_urls": [
          "Full URL to image 1",
          "Full URL to image 2",
          "Full URL to image 3",
          ...
        ]
      }
      
      Important:
      - Return absolute URLs (include https:// or http://)
      - Return 3-10 images in image_urls array (minimum 3 if available)
      - If logo is not found, return empty string for logo_url
      - Ensure URLs are directly accessible (not relative paths)
      - Return ONLY JSON. No markdown, no explanations.
    `;

    const imagesContents = { parts: [{ text: imagesPrompt }] };

    try {
      const imagesResponse = await ai.models.generateContent({
        model,
        contents: imagesContents,
        config: { responseMimeType: "application/json" }
      });
      if (!imagesResponse.text) {
        throw new Error('No response text from Gemini API');
      }
      imagesInfo = safeJsonParse(imagesResponse.text || '{}') || {};
    } catch (error: any) {
      console.error('Error extracting brand images:', error);
      // Continue with defaults instead of throwing to allow partial extraction
      imagesInfo = {};
    }
  }

  // Combine all extracted data
  const dna: BrandDNA = {
    id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // Add randomness to prevent collisions
    name: basicInfo.name || 'Unknown Brand',
    tagline: basicInfo.tagline || '',
    overview: basicInfo.overview || '',
    visual_identity: {
      primary_color_hex: visualInfo.primary_color_hex || '#4F46E5',
      accent_color_hex: visualInfo.accent_color_hex || '#F59E0B',
      colors: visualInfo.colors && Array.isArray(visualInfo.colors) && visualInfo.colors.length > 0 
        ? visualInfo.colors 
        : [visualInfo.primary_color_hex || '#4F46E5', visualInfo.accent_color_hex || '#F59E0B'].filter(Boolean),
      background_style: visualInfo.background_style || '',
      imagery_style: visualInfo.imagery_style || '',
      font_vibe: visualInfo.font_vibe || '',
      logo_style: visualInfo.logo_style || ''
    },
    brand_voice: {
      tone_adjectives: voiceInfo.tone_adjectives || [],
      writing_style: voiceInfo.writing_style || '',
      keywords_to_use: voiceInfo.keywords_to_use || [],
      taboo_words: voiceInfo.taboo_words || []
    },
    strategic_profile: {
      target_audience: strategicInfo.target_audience || '',
      core_value_prop: strategicInfo.core_value_prop || '',
      product_category: strategicInfo.product_category || ''
    }
  };

  // Return DNA with extracted assets info for saving to brand_assets table
  return {
    ...dna,
    _extractedAssets: {
      logoUrl: imagesInfo.logo_url || undefined,
      imageUrls: imagesInfo.image_urls && imagesInfo.image_urls.length > 0 
        ? imagesInfo.image_urls.slice(0, 10) // Limit to max 10 images
        : undefined
    }
  } as BrandDNA & { _extractedAssets?: { logoUrl?: string; imageUrls?: string[] } };
};

/**
 * Step 1: Extract Basic Brand Information (name, tagline, overview)
 */
export const extractBasicInfo = async (input: { url?: string; imageBase64?: string }): Promise<{ name: string; tagline: string; overview: string }> => {
  const ai = getAIClient();
  const model = 'gemini-3-flash-preview';
  
  const source = input.url ? `website URL: ${input.url}` : 'attached website screenshot';
  const urlContext = input.url ? `\n\nIMPORTANT: Visit and analyze the website at ${input.url}. Extract information directly from the website content, design, and messaging.` : '';

  const basicInfoPrompt = `
    You are an expert Chief Marketing Officer and Creative Director.
    Analyze the ${source} to extract the core brand identity information.
    ${urlContext}
    
    Focus specifically on extracting:
    - The company/brand name (exact name as it appears)
    - The brand tagline or main slogan (if present)
    - A comprehensive overview paragraph describing what the brand is about, its mission, and core values
    
    Return ONLY a JSON object with this exact structure:
    {
      "name": "Exact brand name",
      "tagline": "Brand tagline or slogan",
      "overview": "Detailed paragraph describing the brand's mission, values, and essence"
    }
    
    Return ONLY JSON. No markdown, no explanations.
  `;

  let basicContents: any;
  if (input.imageBase64) {
    const base64Data = input.imageBase64.includes(',') 
      ? input.imageBase64.split(',')[1] 
      : input.imageBase64;
    basicContents = {
      parts: [
        { text: basicInfoPrompt },
        { inlineData: { mimeType: "image/png", data: base64Data } }
      ]
    };
  } else {
    basicContents = { parts: [{ text: basicInfoPrompt }] };
  }

  const basicResponse = await ai.models.generateContent({
    model,
    contents: basicContents,
    config: { responseMimeType: "application/json" }
  });
  
  if (!basicResponse.text) {
    throw new Error('No response text from Gemini API');
  }
  
  const basicInfo = safeJsonParse(basicResponse.text || '{}') || {};
  
  return {
    name: basicInfo.name || 'Unknown Brand',
    tagline: basicInfo.tagline || '',
    overview: basicInfo.overview || ''
  };
};

/**
 * Step 2: Extract Visual Identity (colors, styles)
 */
export const extractVisualIdentity = async (input: { url?: string; imageBase64?: string }): Promise<{
  primary_color_hex: string;
  accent_color_hex: string;
  colors: string[];
  background_style: string;
  imagery_style: string;
  font_vibe: string;
  logo_style: string;
}> => {
  const ai = getAIClient();
  const model = 'gemini-3-flash-preview';
  
  const source = input.url ? `website URL: ${input.url}` : 'attached website screenshot';
  const urlContext = input.url ? `\n\nIMPORTANT: Visit and analyze the website at ${input.url}. Extract information directly from the website content, design, and messaging.` : '';

  const visualPrompt = `
    You are an expert Brand Designer and Visual Identity Specialist.
    Analyze the ${source} to extract detailed visual identity information.
    ${urlContext}
    
    CRITICAL: You must analyze the ACTUAL colors present on the website/screenshot, not generic brand colors.
    
    Focus specifically on:
    - Primary brand color (the main brand color actually used on the website - look at headers, logos, navigation, primary buttons, and key UI elements. Extract the EXACT hex code from the visual design)
    - Accent color (secondary color used for highlights, CTAs, links, or accent elements. Extract the EXACT hex code from buttons, links, or highlighted elements)
    - Background style (describe the typical background aesthetic - include hex if solid color)
    - Imagery style (describe the photography/image style used)
    - Typography vibe (describe the font personality and style - analyze the actual fonts used)
    - Logo style (describe the logo's visual characteristics - analyze the actual logo if visible)
    
    IMPORTANT COLOR EXTRACTION INSTRUCTIONS:
    1. Look at the website header/navigation bar - what color is it? Extract that hex code.
    2. Look at primary buttons or CTAs - what color are they? Extract that hex code.
    3. Look at links or highlighted text - what color are they? Extract that hex code.
    4. Look at the overall color scheme - identify the 2-3 most dominant colors.
    5. If analyzing a screenshot, use the actual pixel colors you see, not assumptions.
    6. Return REAL hex codes from the website, not generic brand colors like "#000000" or "#FFFFFF" unless those are actually the dominant colors.
    7. If the website uses gradients, identify the primary colors in the gradient.
    8. Avoid default colors - look for the actual brand colors being used.
    
    Return ONLY a JSON object with this exact structure:
    {
      "primary_color_hex": "#HEXCODE (exact hex from website, e.g. #1a1a1a or #ff6b6b)",
      "accent_color_hex": "#HEXCODE (exact hex from website, e.g. #4ecdc4 or #ffe66d)",
      "background_style": "Description of background style (include hex if solid color)",
      "imagery_style": "Description of imagery/photography style",
      "font_vibe": "Description of typography personality",
      "logo_style": "Description of logo characteristics"
    }
    
    Return ONLY JSON. No markdown, no explanations. Ensure hex codes are valid (6 characters after #).
  `;

  let visualContents: any;
  if (input.imageBase64) {
    const base64Data = input.imageBase64.includes(',') 
      ? input.imageBase64.split(',')[1] 
      : input.imageBase64;
    visualContents = {
      parts: [
        { text: visualPrompt },
        { inlineData: { mimeType: "image/png", data: base64Data } }
      ]
    };
  } else {
    visualContents = { parts: [{ text: visualPrompt }] };
  }

  const visualResponse = await ai.models.generateContent({
    model,
    contents: visualContents,
    config: { responseMimeType: "application/json" }
  });
  
  if (!visualResponse.text) {
    throw new Error('No response text from Gemini API');
  }
  
  const visualInfo = safeJsonParse(visualResponse.text || '{}') || {};
  
  return {
    primary_color_hex: visualInfo.primary_color_hex || '#4F46E5',
    accent_color_hex: visualInfo.accent_color_hex || '#F59E0B',
    colors: visualInfo.colors && Array.isArray(visualInfo.colors) && visualInfo.colors.length > 0 
      ? visualInfo.colors 
      : [visualInfo.primary_color_hex || '#4F46E5', visualInfo.accent_color_hex || '#F59E0B'].filter(Boolean),
    background_style: visualInfo.background_style || '',
    imagery_style: visualInfo.imagery_style || '',
    font_vibe: visualInfo.font_vibe || '',
    logo_style: visualInfo.logo_style || ''
  };
};

/**
 * Step 3: Extract Brand Voice (tone, writing style, keywords)
 */
export const extractBrandVoice = async (input: { url?: string; imageBase64?: string }): Promise<{
  tone_adjectives: string[];
  writing_style: string;
  keywords_to_use: string[];
  taboo_words: string[];
}> => {
  const ai = getAIClient();
  const model = 'gemini-3-flash-preview';
  
  const source = input.url ? `website URL: ${input.url}` : 'attached website screenshot';
  const urlContext = input.url ? `\n\nIMPORTANT: Visit and analyze the website at ${input.url}. Extract information directly from the website content, design, and messaging.` : '';

  const voicePrompt = `
    You are an expert Copywriter and Brand Voice Strategist.
    Analyze the ${source} to extract the brand's voice and messaging style.
    ${urlContext}
    
    Focus specifically on:
    - Tone adjectives (3-5 words that describe the brand's tone)
    - Writing style (describe sentence structure, formality, length)
    - Keywords to use (3-5 key terms/phrases the brand uses)
    - Taboo words (words the brand avoids or would never use)
    
    Return ONLY a JSON object with this exact structure:
    {
      "tone_adjectives": ["adjective1", "adjective2", "adjective3"],
      "writing_style": "Description of writing style",
      "keywords_to_use": ["keyword1", "keyword2", "keyword3"],
      "taboo_words": ["word1", "word2", "word3"]
    }
    
    Return ONLY JSON. No markdown, no explanations.
  `;

  let voiceContents: any;
  if (input.imageBase64) {
    const base64Data = input.imageBase64.includes(',') 
      ? input.imageBase64.split(',')[1] 
      : input.imageBase64;
    voiceContents = {
      parts: [
        { text: voicePrompt },
        { inlineData: { mimeType: "image/png", data: base64Data } }
      ]
    };
  } else {
    voiceContents = { parts: [{ text: voicePrompt }] };
  }

  const voiceResponse = await ai.models.generateContent({
    model,
    contents: voiceContents,
    config: { responseMimeType: "application/json" }
  });
  
  if (!voiceResponse.text) {
    throw new Error('No response text from Gemini API');
  }
  
  const voiceInfo = safeJsonParse(voiceResponse.text || '{}') || {};
  
  return {
    tone_adjectives: voiceInfo.tone_adjectives || [],
    writing_style: voiceInfo.writing_style || '',
    keywords_to_use: voiceInfo.keywords_to_use || [],
    taboo_words: voiceInfo.taboo_words || []
  };
};

/**
 * Step 4: Extract Strategic Profile (target audience, value prop, category)
 */
export const extractStrategicProfile = async (input: { url?: string; imageBase64?: string }): Promise<{
  target_audience: string;
  core_value_prop: string;
  product_category: string;
}> => {
  const ai = getAIClient();
  const model = 'gemini-3-flash-preview';
  
  const source = input.url ? `website URL: ${input.url}` : 'attached website screenshot';
  const urlContext = input.url ? `\n\nIMPORTANT: Visit and analyze the website at ${input.url}. Extract information directly from the website content, design, and messaging.` : '';

  const strategicPrompt = `
    You are an expert Marketing Strategist and Brand Analyst.
    Analyze the ${source} to extract strategic positioning information.
    ${urlContext}
    
    Focus specifically on:
    - Target audience (specific demographic and psychographic description)
    - Core value proposition (main benefit or promise the brand makes)
    - Product category (industry niche or category)
    
    Return ONLY a JSON object with this exact structure:
    {
      "target_audience": "Specific audience description",
      "core_value_prop": "Main benefit promised",
      "product_category": "Industry niche"
    }
    
    Return ONLY JSON. No markdown, no explanations.
  `;

  let strategicContents: any;
  if (input.imageBase64) {
    const base64Data = input.imageBase64.includes(',') 
      ? input.imageBase64.split(',')[1] 
      : input.imageBase64;
    strategicContents = {
      parts: [
        { text: strategicPrompt },
        { inlineData: { mimeType: "image/png", data: base64Data } }
      ]
    };
  } else {
    strategicContents = { parts: [{ text: strategicPrompt }] };
  }

  const strategicResponse = await ai.models.generateContent({
    model,
    contents: strategicContents,
    config: { responseMimeType: "application/json" }
  });
  
  if (!strategicResponse.text) {
    throw new Error('No response text from Gemini API');
  }
  
  const strategicInfo = safeJsonParse(strategicResponse.text || '{}') || {};
  
  return {
    target_audience: strategicInfo.target_audience || '',
    core_value_prop: strategicInfo.core_value_prop || '',
    product_category: strategicInfo.product_category || ''
  };
};

/**
 * Step 5: Extract Brand Images (logo and key images) - Only works with URL
 */
export const extractBrandImages = async (url: string): Promise<{ logoUrl?: string; imageUrls?: string[] }> => {
  if (!url) {
    throw new Error('URL is required for image extraction');
  }
  
  console.log(`[Gemini Service] extractBrandImages called with URL: ${url}`);
  
  const ai = getAIClient();
  const model = 'gemini-3-flash-preview';
  const urlContext = `\n\nIMPORTANT: Visit and analyze the website at ${url}. Extract information directly from the website content, design, and messaging.`;

  const imagesPrompt = `
    You are an expert Web Scraper and Brand Asset Analyst.
    Analyze the website at ${url} to extract brand images.
    ${urlContext}
    
    Your task:
    1. Identify the logo image URL (the main brand logo, typically in header/navbar)
    2. Extract 3-10 key brand images (hero images, product images, lifestyle images, etc.)
       - Prioritize high-quality, representative images
       - Avoid duplicates or very similar images
       - Focus on images that represent the brand visually
       - Look for images in the main content area, hero sections, and product galleries
    
    Return ONLY a JSON object with this exact structure:
    {
      "logo_url": "Full URL to the logo image (or empty string if not found)",
      "image_urls": [
        "Full URL to image 1",
        "Full URL to image 2",
        "Full URL to image 3",
        ...
      ]
    }
    
    Important:
    - Return absolute URLs (include https:// or http://)
    - Return 3-10 images in image_urls array (minimum 3 if available)
    - If logo is not found, return empty string for logo_url
    - Ensure URLs are directly accessible (not relative paths)
    - Return ONLY JSON. No markdown, no explanations.
  `;

  const imagesContents = { parts: [{ text: imagesPrompt }] };

  console.log(`[Gemini Service] Calling Gemini API for image extraction...`);
  
  try {
    const imagesResponse = await ai.models.generateContent({
      model,
      contents: imagesContents,
      config: { responseMimeType: "application/json" }
    });
    
    if (!imagesResponse.text) {
      console.error('[Gemini Service] No response text from Gemini API');
      throw new Error('No response text from Gemini API');
    }
    
    console.log(`[Gemini Service] Received response from Gemini (length: ${imagesResponse.text.length})`);
    console.log(`[Gemini Service] Raw response preview: ${imagesResponse.text.substring(0, 200)}...`);
    
    const imagesInfo = safeJsonParse(imagesResponse.text || '{}') || {};
    
    console.log(`[Gemini Service] Parsed images info:`, {
      hasLogoUrl: !!imagesInfo.logo_url,
      logoUrl: imagesInfo.logo_url?.substring(0, 100),
      imageUrlsCount: imagesInfo.image_urls?.length || 0,
      imageUrls: imagesInfo.image_urls?.slice(0, 3).map((u: string) => u.substring(0, 100))
    });
    
    const result = {
      logoUrl: imagesInfo.logo_url || undefined,
      imageUrls: imagesInfo.image_urls && imagesInfo.image_urls.length > 0 
        ? imagesInfo.image_urls.slice(0, 10) // Limit to max 10 images
        : undefined
    };
    
    console.log(`[Gemini Service] Returning result:`, {
      hasLogo: !!result.logoUrl,
      imageCount: result.imageUrls?.length || 0
    });
    
    return result;
  } catch (error: any) {
    console.error(`[Gemini Service] Error in extractBrandImages:`, error);
    console.error(`[Gemini Service] Error details:`, {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    throw error;
  }
};

/**
 * Step 1: Generate image prompt for product in use
 */
export const generateProductImagePrompt = async (
  brandDNA: BrandDNA,
  productFocus: string,
  referenceImageBase64?: string
): Promise<{ imagen_prompt_final: string; reasoning: string; includes_person: boolean; composition_notes: string; step_1_analysis?: any }> => {
  const ai = getAIClient();
  const model = 'gemini-3-pro-preview';

  const prompt = `
You are an elite Product Photographer and Art Director.
Goal: Create a highly technical image generation prompt that captures the *exact* physical reality of the product while placing it in a lifestyle context.

### INPUT DATA
Brand DNA: ${JSON.stringify(brandDNA)}
Product Focus: ${productFocus}

### CRITICAL INSTRUCTION: VISUAL ANCHORING
You must prevent "product hallucination." Before writing the final prompt, you must mentally isolate the product's **Material Physics**:
1. **Texture:** Is it ribbed? Woven? Smooth? Matte? Glossy?
2. **Weight/Drape:** Does it hang heavily (like wool) or float light (like silk)?
3. **Imperfections:** Real products have grain and weave. Mentioning these creates realism.

### OUTPUT FORMAT (JSON)
Return ONLY:
{
  "step_1_analysis": {
    "texture_lock": "A few words describing the specific material surface (e.g., 'coarse woven linen', 'ribbed wool knit').",
    "lighting_strategy": "How light hits the texture (e.g., 'Raking side light to accentuate the weave').",
    "composition_logic": "Where the subject is placed to leave 'Negative Space' for text overlay later."
  },
  "reasoning": "Brief explanation of the visual strategy",
  "includes_person": boolean,
  "composition_notes": "Notes about composition and placement",
  "imagen_prompt_final": "A prompt following this strict structure: [SUBJECT DEFINITION: detailed description of ${productFocus} focusing on texture, weave, and material weight] + [CONTEXT: The model/lifestyle setting, ensuring the product is the hero] + [LIGHTING: Specific lighting to highlight material quality] + [TECH SPECS: 8k, macro details, commercial photography, depth of field]. NO text in image."
}
  `;

  let parts: any[] = [{ text: prompt }];
  if (referenceImageBase64) {
    const base64Data = referenceImageBase64.includes(',') 
      ? referenceImageBase64.split(',')[1] 
      : referenceImageBase64;
    parts.push({ inlineData: { mimeType: "image/png", data: base64Data } });
  }

  const response = await ai.models.generateContent({
    model,
    contents: { parts },
    config: { responseMimeType: "application/json" }
  });

  const result = safeJsonParse(response.text || '{}');
  return {
    imagen_prompt_final: result.imagen_prompt_final || '',
    reasoning: result.reasoning || '',
    includes_person: result.includes_person || false,
    composition_notes: result.composition_notes || '',
    step_1_analysis: result.step_1_analysis || null
  };
};

/**
 * Step 2: Generate title and subtitle for the marketing post
 */
export const generateProductTitleSubtitle = async (
  brandDNA: BrandDNA,
  productFocus: string,
  productImageBase64: string
): Promise<{ title: string; subtitle: string }> => {
  const ai = getAIClient();
  const model = 'gemini-3-pro-preview';

  const prompt = `
You are a Lead Copywriter for a luxury brand.
Goal: Write a title and subtitle that fits the *visual mood* established in the Brand DNA.

### INPUT DATA
Brand DNA: ${JSON.stringify(brandDNA)}
Product Focus: ${productFocus}

### INSTRUCTIONS
- **Title (max 5 words):** Punchy, attention-grabbing, emotion-driven. This is the hero text.
- **Subtitle (max 15 words):** Supporting detail that expands on the title. Can include benefit or feature.
- **Less is More:** High-end brands use fewer words.
- **Visual Connection:** If the product is soft/cozy, the words should feel soft. If the product is sleek/hard, the words should be punchy.
- **Voice Check:** Ensure the tone matches: ${brandDNA.brand_voice.tone_adjectives.join(', ')}.
- **Writing Style:** ${brandDNA.brand_voice.writing_style}
- **Keywords to use:** ${brandDNA.brand_voice.keywords_to_use.join(', ')}
- **Taboo words (avoid):** ${brandDNA.brand_voice.taboo_words.join(', ')}

### OUTPUT FORMAT (JSON)
Return ONLY:
{
  "title": "Punchy title, max 5 words",
  "subtitle": "Supporting subtitle, max 15 words"
}

CRITICAL: Return plain text only. Do NOT use markdown formatting (no **, no *, no _, no backticks). Just plain text strings.
  `;

  const parts = [{ text: prompt }];

  const response = await ai.models.generateContent({
    model,
    contents: { parts },
    config: { responseMimeType: "application/json" }
  });

  const result = safeJsonParse(response.text || '{}');
  
  // Clean markdown from title and subtitle
  const cleanMarkdown = (text: string): string => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '$1')  // Remove **bold**
      .replace(/\*(.*?)\*/g, '$1')       // Remove *italic*
      .replace(/__(.*?)__/g, '$1')       // Remove __bold__
      .replace(/_(.*?)_/g, '$1')         // Remove _italic_
      .replace(/~~(.*?)~~/g, '$1')       // Remove ~~strikethrough~~
      .replace(/`(.*?)`/g, '$1')         // Remove `code`
      .trim();
  };
  
  return {
    title: cleanMarkdown(result.title || ''),
    subtitle: cleanMarkdown(result.subtitle || '')
  };
};

/**
 * Step 3: Design text overlay strategy based on brand DNA
 */
export const designTextOverlay = async (
  brandDNA: BrandDNA,
  title: string,
  subtitle: string,
  productImageBase64: string
): Promise<{
  font_family: 'sans-serif' | 'serif' | 'cursive' | 'handwritten';
  font_weight: 'light' | 'regular' | 'bold';
  font_transform: 'uppercase' | 'lowercase' | 'capitalize' | 'none';
  letter_spacing: 'normal' | 'wide';
  text_color_hex: string;
  position: 'top-center' | 'bottom-left' | 'bottom-right' | 'center-middle' | 'top-left' | 'top-right' | 'center-left' | 'center-right' | 'floating-center';
  max_width_percent: number;
  opacity: number;
  reasoning: string;
}> => {
  const ai = getAIClient();
  const model = 'gemini-3-pro-preview';

  const prompt = `
You are a UI/UX Designer specializing in Social Media aesthetics.
Goal: Determine the CSS/Design properties to overlay the title and subtitle onto the image.

### INPUT DATA
Brand DNA: ${JSON.stringify(brandDNA)}
Title: "${title}"
Subtitle: "${subtitle}"

### INSTRUCTIONS
- Design styling that works for both title (larger, bolder) and subtitle (smaller, supporting)
- Consider spacing between title and subtitle (typically 8-12px)
- Ensure good contrast and readability
- Position should leave room for both text elements

### OUTPUT FORMAT (JSON)
Return ONLY:
{
  "design_strategy": {
    "font_family_category": "sans-serif" | "serif" | "handwritten",
    "font_weight": "light" | "regular" | "bold",
    "text_transform": "uppercase" | "lowercase" | "capitalize",
    "letter_spacing": "normal" | "wide",
    "text_color_hex": "Choose a color from ${brandDNA.visual_identity.primary_color_hex} OR white/black depending on contrast needs.",
    "suggested_position": "top-center" | "bottom-right" | "center-left" | "floating-center",
    "opacity": 1.0
  },
  "reasoning": "Why this font and position complements the 'luxury product' vibe and works for both title and subtitle."
}
  `;

  const base64Data = productImageBase64.includes(',') 
    ? productImageBase64.split(',')[1] 
    : productImageBase64;

  const response = await ai.models.generateContent({
    model,
    contents: {
      parts: [
        { text: prompt },
        { inlineData: { mimeType: "image/png", data: base64Data } }
      ]
    },
    config: { responseMimeType: "application/json" }
  });

  const result = safeJsonParse(response.text || '{}');
  const designStrategy = result.design_strategy || {};
  
  return {
    font_family: designStrategy.font_family_category || result.font_family || 'sans-serif',
    font_weight: designStrategy.font_weight || result.font_weight || 'bold',
    font_transform: designStrategy.text_transform || result.font_transform || 'none',
    letter_spacing: designStrategy.letter_spacing || result.letter_spacing || 'normal',
    text_color_hex: designStrategy.text_color_hex || result.text_color_hex || brandDNA.visual_identity.primary_color_hex,
    position: designStrategy.suggested_position || result.position || 'bottom-right',
    max_width_percent: result.max_width_percent || 80,
    opacity: designStrategy.opacity !== undefined ? designStrategy.opacity : (result.opacity !== undefined ? result.opacity : 1.0),
    reasoning: result.reasoning || ''
  };
};

export const generateNonProductStrategy = async (brandDNA: BrandDNA, userPurpose: string) => {
  const ai = getAIClient();
  const model = 'gemini-3-pro-preview';

  const prompt = `
    You are an expert Creative Director. Create a "Non-Product" Brand Moment post.
    Brand DNA: ${JSON.stringify(brandDNA)}
    User Purpose: ${userPurpose}

    ### FINAL OUTPUT FORMAT (JSON)
    {
      "step_1_visual_concept": {
        "visual_metaphor_reasoning": "Explanation",
        "includes_person": boolean,
        "imagen_prompt_final": "Detailed prompt for Imagen 3."
      },
      "step_2_message_strategy": {
        "headline_text": "Main text hook",
        "body_caption_draft": "Optional short caption",
        "design_instructions": { "text_overlay_strength": "Heavy"|"Subtle", "suggested_text_color": "Hex", "suggested_position": "Center-Middle"|"Bottom-Right" }
      }
    }
  `;

  const response = await ai.models.generateContent({
    model,
    contents: { parts: [{ text: prompt }] },
    config: { responseMimeType: "application/json" }
  });

  return safeJsonParse(response.text || '{}');
};

export const generateCampaignStrategy = async (brandDNA: BrandDNA, campaignDetails: string, postCount: number) => {
  const ai = getAIClient();
  const model = 'gemini-3-pro-preview';

  const prompt = `
    Create a coordinated campaign of ${postCount} posts.
    Brand DNA: ${JSON.stringify(brandDNA)}
    Campaign Goal: ${campaignDetails}

    Return JSON as an array of strategies:
    {
      "posts": [
        {
          "visual_prompt": "Imagen 3 prompt for this post",
          "headline": "Headline for this post",
          "reasoning": "Why this fits the sequence"
        }
      ]
    }
  `;

  const response = await ai.models.generateContent({
    model,
    contents: { parts: [{ text: prompt }] },
    config: { responseMimeType: "application/json" }
  });

  return safeJsonParse(response.text || '{}');
};

export const generateImage = async (prompt: string, width: number = 1080, height: number = 1080): Promise<string> => {
  const ai = getAIClient();
  
  // Calculate aspect ratio from dimensions (simplify to common ratios)
  // Gemini API supports: "1:1", "9:16", "16:9", "4:3", "3:4"
  let aspectRatio: string;
  const ratio = width / height;
  
  // Define supported aspect ratios with their values
  const supportedRatios = [
    { name: "1:1", value: 1.0 },
    { name: "9:16", value: 9/16 },      // Portrait/Story (0.5625)
    { name: "16:9", value: 16/9 },      // Landscape (1.777...)
    { name: "4:3", value: 4/3 },          // Landscape (1.333...)
    { name: "3:4", value: 3/4 }           // Portrait (0.75)
  ];
  
  // Find the closest matching aspect ratio
  let closestRatio = supportedRatios[0]; // Default to 1:1
  let minDifference = Math.abs(ratio - closestRatio.value);
  
  for (const supportedRatio of supportedRatios) {
    const difference = Math.abs(ratio - supportedRatio.value);
    if (difference < minDifference) {
      minDifference = difference;
      closestRatio = supportedRatio;
    }
  }
  
  // Use the closest ratio, but apply logic based on orientation
  if (ratio < 0.7) {
    // Very tall/portrait - prefer 9:16 or 3:4
    aspectRatio = Math.abs(ratio - 9/16) < Math.abs(ratio - 3/4) ? "9:16" : "3:4";
  } else if (ratio > 1.5) {
    // Very wide/landscape - prefer 16:9 or 4:3
    aspectRatio = Math.abs(ratio - 16/9) < Math.abs(ratio - 4/3) ? "16:9" : "4:3";
  } else {
    // Square-ish or moderate ratios - use closest match
    aspectRatio = closestRatio.name;
  }
  
  // Determine image size based on larger dimension
  const imageSize = Math.max(width, height) >= 2048 ? "4K" : "2K";
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview', // Nano Banana Pro - higher fidelity, up to 4K output
    contents: { parts: [{ text: prompt }] },
    config: { 
      imageConfig: { 
        aspectRatio: aspectRatio as any, 
        imageSize: imageSize as any 
      } 
    }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  throw new Error("Failed to generate image");
};

export const editImage = async (originalImageBase64: string, feedback: string): Promise<string> => {
  const ai = getAIClient();
  const base64Data = originalImageBase64.includes(',') 
    ? originalImageBase64.split(',')[1] 
    : originalImageBase64;
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview', // Nano Banana Pro - higher fidelity, up to 4K output
    contents: {
      parts: [
        { inlineData: { mimeType: "image/png", data: base64Data } },
        { text: `Edit this image based on feedback: ${feedback}` }
      ]
    },
    config: { imageConfig: { aspectRatio: "1:1", imageSize: "2K" } }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  throw new Error("Failed to edit image");
};

