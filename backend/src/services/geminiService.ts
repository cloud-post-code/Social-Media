import { GoogleGenAI } from "@google/genai";
import { BrandDNA, ScrapingCodeResponse } from "../types/index.js";
import { getWebsiteStructure, executeScrapingCode, extractBrandColors, scrapeBrandAssetsDirect } from "./imageScrapingService.js";
import sharp from 'sharp';
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
    You are an expert UI/UX Designer and Visual Identity Specialist.

    Analyze the ${source} to extract a comprehensive and accurate visual identity system.

    ${urlContext}

    CRITICAL ANALYSIS RULES:

    1. **UI Elements > Content Images:** Prioritize colors found in the User Interface (buttons, navigation bars, backgrounds, icons, typography) over colors found inside product photos or temporary banners.

    2. **Contrast & Hierarchy:** Look for colors that establish hierarchy. The "Primary" color is usually the one used for the main Call-to-Action (like a "Search" or "Buy" button) or the active state in navigation.

    3. **Neutral Foundation:** A valid design system always contains neutrals (backgrounds and text). You must identify these distinct from the brand colors.

    SPECIFIC EXTRACTION TASKS:

    1. **Identify Neutral Colors (Mandatory: Find at least 2):**

       - **Page Background:** Look for the main background color (often #FFFFFF or a very light grey).

       - **Typography/Text:** Look for the primary font color (often #000000 or a dark grey like #333333).

       - **UI Structure:** Look for border colors or card background colors.

    2. **Identify Primary Brand Color:**

       - Look for the distinct "Action" color. Check the "Search" button, "Add to Cart" buttons, or the main logo element. 

       - (Note: If there is a bright pop color for buttons, this is likely the Primary or High-Level Accent).

    3. **Identify Secondary/Accent Color:**

       - Look for supporting colors used in the logo, secondary links, or icons.

    4. **Identify Recurring Colors:**

       - List any other colors that appear consistently in the interface elements (not photos).

    Return ONLY a JSON object with this exact structure:

    {

      "primary_color_hex": "#HEXCODE (The main action/brand color)",

      "secondary_color_hex": "#HEXCODE (Supporting accent color)",

      "neutrals": ["#HEXCODE1", "#HEXCODE2", "#HEXCODE3"] (Array of background and text colors, e.g., white, dark grey),

      "additional_brand_colors": ["#HEXCODE", ...] (Array of other distinct UI colors found),

      "background_style": "Description of background (e.g., Clean white with soft shadows)",

      "imagery_style": "Description of photography style",

      "font_vibe": "Description of typography personality",

      "logo_style": "Description of logo characteristics"

    }

    Return ONLY JSON. No markdown.
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
    // If URL is provided, try Puppeteer-based color extraction first
    if (input.url) {
      try {
        console.log('[Gemini Service] Attempting Puppeteer-based color extraction...');
        const puppeteerColors = await extractBrandColors(input.url);
        console.log('[Gemini Service] Puppeteer extracted colors:', {
          primary: puppeteerColors.primary_color_hex,
          secondary: puppeteerColors.secondary_color_hex,
          colorCount: puppeteerColors.colors?.length || 0
        });
        
        // Use Puppeteer colors if available, otherwise fall back to Gemini
        if (puppeteerColors.primary_color_hex || puppeteerColors.colors?.length) {
          visualInfo = {
            primary_color_hex: puppeteerColors.primary_color_hex,
            secondary_color_hex: puppeteerColors.secondary_color_hex,
            neutrals: [],
            additional_brand_colors: puppeteerColors.colors || [],
            background_style: '',
            imagery_style: '',
            font_vibe: '',
            logo_style: ''
          };
          console.log('[Gemini Service] Using Puppeteer-extracted colors');
        } else {
          // Fall back to Gemini extraction
          throw new Error('Puppeteer extraction returned no colors, falling back to Gemini');
        }
      } catch (puppeteerError: any) {
        console.log('[Gemini Service] Puppeteer color extraction failed, using Gemini:', puppeteerError.message);
        // Fall through to Gemini extraction
        const visualResponse = await ai.models.generateContent({
          model,
          contents: visualContents,
          config: { responseMimeType: "application/json" }
        });
        if (!visualResponse.text) {
          throw new Error('No response text from Gemini API');
        }
        visualInfo = safeJsonParse(visualResponse.text || '{}') || {};
      }
    } else {
      // No URL, use Gemini extraction
      const visualResponse = await ai.models.generateContent({
        model,
        contents: visualContents,
        config: { responseMimeType: "application/json" }
      });
      if (!visualResponse.text) {
        throw new Error('No response text from Gemini API');
      }
      visualInfo = safeJsonParse(visualResponse.text || '{}') || {};
    }
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
    try {
      // Use the new AI-powered scraping approach
      const extractedImages = await extractBrandImages(input.url);
      imagesInfo = {
        logo_url: extractedImages.logoUrl || '',
        image_urls: extractedImages.imageUrls || []
      };
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
    visual_identity: (() => {
      // Combine neutrals, primary, secondary, and additional brand colors
      const neutrals = Array.isArray(visualInfo.neutrals) ? visualInfo.neutrals : [];
      const additionalColors = Array.isArray(visualInfo.additional_brand_colors) ? visualInfo.additional_brand_colors : [];
      const primaryColor = visualInfo.primary_color_hex || '#4F46E5';
      const secondaryColor = visualInfo.secondary_color_hex || visualInfo.accent_color_hex || '#F59E0B';
      
      // Combine all colors, removing duplicates
      const allColors = [
        primaryColor,
        secondaryColor,
        ...neutrals,
        ...additionalColors
      ].filter((color, index, self) => 
        color && typeof color === 'string' && self.indexOf(color) === index
      );
      
      // Ensure minimum of 4 colors
      while (allColors.length < 4) {
        if (allColors.length === 0) {
          allColors.push('#4F46E5', '#F59E0B', '#FFFFFF', '#000000');
        } else if (allColors.length === 1) {
          allColors.push('#F59E0B', '#FFFFFF', '#000000');
        } else if (allColors.length === 2) {
          allColors.push('#FFFFFF', '#000000');
        } else if (allColors.length === 3) {
          allColors.push('#808080');
        }
      }
      
      return {
        primary_color_hex: primaryColor,
        accent_color_hex: secondaryColor,
        colors: allColors.slice(0, Math.max(4, allColors.length)), // Ensure at least 4 colors
        background_style: visualInfo.background_style || '',
        imagery_style: visualInfo.imagery_style || '',
        font_vibe: visualInfo.font_vibe || '',
        logo_style: visualInfo.logo_style || ''
      };
    })(),
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
        ? imagesInfo.image_urls.slice(0, 50) // Limit to max 50 images
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
    You are an expert UI/UX Designer and Visual Identity Specialist.

    Analyze the ${source} to extract a comprehensive and accurate visual identity system.

    ${urlContext}

    CRITICAL ANALYSIS RULES:

    1. **UI Elements > Content Images:** Prioritize colors found in the User Interface (buttons, navigation bars, backgrounds, icons, typography) over colors found inside product photos or temporary banners.

    2. **Contrast & Hierarchy:** Look for colors that establish hierarchy. The "Primary" color is usually the one used for the main Call-to-Action (like a "Search" or "Buy" button) or the active state in navigation.

    3. **Neutral Foundation:** A valid design system always contains neutrals (backgrounds and text). You must identify these distinct from the brand colors.

    SPECIFIC EXTRACTION TASKS:

    1. **Identify Neutral Colors (Mandatory: Find at least 2):**

       - **Page Background:** Look for the main background color (often #FFFFFF or a very light grey).

       - **Typography/Text:** Look for the primary font color (often #000000 or a dark grey like #333333).

       - **UI Structure:** Look for border colors or card background colors.

    2. **Identify Primary Brand Color:**

       - Look for the distinct "Action" color. Check the "Search" button, "Add to Cart" buttons, or the main logo element. 

       - (Note: If there is a bright pop color for buttons, this is likely the Primary or High-Level Accent).

    3. **Identify Secondary/Accent Color:**

       - Look for supporting colors used in the logo, secondary links, or icons.

    4. **Identify Recurring Colors:**

       - List any other colors that appear consistently in the interface elements (not photos).

    Return ONLY a JSON object with this exact structure:

    {

      "primary_color_hex": "#HEXCODE (The main action/brand color)",

      "secondary_color_hex": "#HEXCODE (Supporting accent color)",

      "neutrals": ["#HEXCODE1", "#HEXCODE2", "#HEXCODE3"] (Array of background and text colors, e.g., white, dark grey),

      "additional_brand_colors": ["#HEXCODE", ...] (Array of other distinct UI colors found),

      "background_style": "Description of background (e.g., Clean white with soft shadows)",

      "imagery_style": "Description of photography style",

      "font_vibe": "Description of typography personality",

      "logo_style": "Description of logo characteristics"

    }

    Return ONLY JSON. No markdown.
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
  
  // Combine neutrals, primary, secondary, and additional brand colors
  const neutrals = Array.isArray(visualInfo.neutrals) ? visualInfo.neutrals : [];
  const additionalColors = Array.isArray(visualInfo.additional_brand_colors) ? visualInfo.additional_brand_colors : [];
  const primaryColor = visualInfo.primary_color_hex || '#4F46E5';
  const secondaryColor = visualInfo.secondary_color_hex || visualInfo.accent_color_hex || '#F59E0B';
  
  // Combine all colors, removing duplicates
  const allColors = [
    primaryColor,
    secondaryColor,
    ...neutrals,
    ...additionalColors
  ].filter((color, index, self) => 
    color && typeof color === 'string' && self.indexOf(color) === index
  );
  
  // Ensure minimum of 4 colors
  while (allColors.length < 4) {
    if (allColors.length === 0) {
      allColors.push('#4F46E5', '#F59E0B', '#FFFFFF', '#000000');
    } else if (allColors.length === 1) {
      allColors.push('#F59E0B', '#FFFFFF', '#000000');
    } else if (allColors.length === 2) {
      allColors.push('#FFFFFF', '#000000');
    } else if (allColors.length === 3) {
      allColors.push('#808080');
    }
  }
  
  return {
    primary_color_hex: primaryColor,
    accent_color_hex: secondaryColor,
    colors: allColors.slice(0, Math.max(4, allColors.length)), // Ensure at least 4 colors
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
 * Uses new direct Puppeteer scraping with intelligent heuristics (more reliable)
 * Falls back to AI-generated code approach if direct scraping fails
 */
export const extractBrandImages = async (url: string): Promise<{ logoUrl?: string; imageUrls?: string[] }> => {
  if (!url) {
    throw new Error('URL is required for image extraction');
  }
  
  console.log(`[Gemini Service] extractBrandImages called with URL: ${url}`);
  
  try {
    // Try new direct scraping method first (more reliable)
    console.log(`[Gemini Service] Attempting direct scraping method...`);
    try {
      const directResult = await scrapeBrandAssetsDirect(url);
      
      if (directResult.logo_url || (directResult.image_urls && directResult.image_urls.length > 0)) {
        console.log(`[Gemini Service] Direct scraping succeeded:`, {
          hasLogo: !!directResult.logo_url,
          imageCount: directResult.image_urls?.length || 0
        });
        
        return {
          logoUrl: directResult.logo_url || undefined,
          imageUrls: directResult.image_urls && directResult.image_urls.length > 0 
            ? directResult.image_urls.slice(0, 50) // Limit to max 50 images
            : undefined
        };
      } else {
        console.log(`[Gemini Service] Direct scraping found no images, trying AI-generated code approach...`);
      }
    } catch (directError: any) {
      console.warn(`[Gemini Service] Direct scraping failed, trying AI-generated code approach:`, directError.message);
    }
    
    // Fallback to AI-generated code approach
    console.log(`[Gemini Service] Using AI-generated code approach...`);
    
    // Step 1: Extract website structure using Puppeteer
    console.log(`[Gemini Service] Step 1/4: Extracting website structure...`);
    const domStructure = await getWebsiteStructure(url);
    console.log(`[Gemini Service] Step 1/4: Structure extracted (${domStructure.length} chars)`);
    
    // Step 2: Send structure to Gemini to generate scraping code
    console.log(`[Gemini Service] Step 2/4: Requesting scraping code from Gemini...`);
    const ai = getAIClient();
    const model = 'gemini-3-flash-preview';
    
    const imagesPrompt = `
      You are an expert Web Scraper and JavaScript Developer.
      
      I will provide you with the DOM structure of a website. Your task is to write executable Puppeteer JavaScript code that will scrape images from this website.
      
      Website URL: ${url}
      
      DOM Structure:
      ${domStructure}
      
      Your task:
      1. Analyze the DOM structure to understand where images are located
      2. Write executable JavaScript code that uses Puppeteer to:
         - Identify the logo image (typically in header/navbar - look for images in navigation elements)
         - Extract 3-10 key brand images (hero images, product images, lifestyle images, etc.)
           - Prioritize high-quality, representative images
           - Avoid duplicates or very similar images
           - Focus on images that represent the brand visually
           - Look for images in the main content area, hero sections, and product galleries
      
      IMPORTANT CODE REQUIREMENTS:
      - The code will run in a Node.js VM with a Puppeteer Page object already available as 'page'
      - The page is already navigated to the target URL
      - You must return an object with this exact structure: { logo_url: string, image_urls: string[] }
      - logo_url should be a full absolute URL (or empty string if not found)
      - image_urls should be an array of full absolute URLs (3-10 images)
      - Use page.$eval() or page.$$eval() to extract image src attributes
      - Handle relative URLs by converting them to absolute URLs using new URL(src, page.url())
      - Filter out small images (icons, avatars) - focus on images larger than 100x100px
      - Handle lazy-loaded images (check data-src, data-lazy-src attributes)
      - Return ONLY the code that will be executed - no explanations, no markdown
      
      Return ONLY a JSON object with this exact structure:
      {
        "scraping_code": "async function scrapeImages(page) {\\n  // Your Puppeteer code here\\n  const logo = await page.$eval('...', el => el.src);\\n  const images = await page.$$eval('...', els => els.map(el => el.src));\\n  return { logo_url: logo || '', image_urls: images.filter(url => url) };\\n}\\n\\nreturn await scrapeImages(page);",
        "reasoning": "Brief explanation of your scraping strategy"
      }
      
      Return ONLY JSON. No markdown, no explanations outside the JSON.
    `;

    const imagesContents = { parts: [{ text: imagesPrompt }] };

    const imagesResponse = await ai.models.generateContent({
      model,
      contents: imagesContents,
      config: { responseMimeType: "application/json" }
    });
    
    if (!imagesResponse.text) {
      console.error('[Gemini Service] No response text from Gemini API');
      throw new Error('No response text from Gemini API');
    }
    
    console.log(`[Gemini Service] Step 2/4: Received response from Gemini (length: ${imagesResponse.text.length})`);
    
    const codeResponse = safeJsonParse(imagesResponse.text || '{}') as ScrapingCodeResponse;
    
    if (!codeResponse.scraping_code) {
      throw new Error('Gemini did not return scraping_code in response');
    }
    
    console.log(`[Gemini Service] Step 2/4: Parsed scraping code (${codeResponse.scraping_code.length} chars)`);
    if (codeResponse.reasoning) {
      console.log(`[Gemini Service] Reasoning: ${codeResponse.reasoning}`);
    }
    console.log(`[Gemini Service] Generated scraping code (first 1000 chars):`, codeResponse.scraping_code.substring(0, 1000));
    
    // Step 3: Execute the generated scraping code
    console.log(`[Gemini Service] Step 3/4: Executing scraping code...`);
    const scrapingResult = await executeScrapingCode(codeResponse.scraping_code, url);
    
    console.log(`[Gemini Service] Step 3/4: Scraping completed:`, {
      hasLogo: !!scrapingResult.logo_url,
      imageCount: scrapingResult.image_urls?.length || 0
    });
    
    // Step 4: Convert URLs to base64 (if needed) and return
    // Note: The existing brandAssetService.createBrandAsset() handles URL to base64 conversion
    // So we can return URLs directly - they'll be converted when saved
    const result = {
      logoUrl: scrapingResult.logo_url || undefined,
      imageUrls: scrapingResult.image_urls && scrapingResult.image_urls.length > 0 
        ? scrapingResult.image_urls.slice(0, 50) // Limit to max 50 images
        : undefined
    };
    
    console.log(`[Gemini Service] Step 4/4: Returning result:`, {
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
    
    // Fallback to old URL-based approach if scraping fails
    console.log(`[Gemini Service] Falling back to old URL-based extraction...`);
    try {
      return await extractBrandImagesFallback(url);
    } catch (fallbackError: any) {
      console.error(`[Gemini Service] Fallback also failed:`, fallbackError.message);
      throw new Error(`Image extraction failed: ${error.message}. Fallback also failed: ${fallbackError.message}`);
    }
  }
};

/**
 * Fallback method: Old URL-based extraction approach
 * Used when the new scraping code approach fails
 */
async function extractBrandImagesFallback(url: string): Promise<{ logoUrl?: string; imageUrls?: string[] }> {
  console.log(`[Gemini Service] Using fallback URL-based extraction for: ${url}`);
  
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

  const imagesResponse = await ai.models.generateContent({
    model,
    contents: imagesContents,
    config: { responseMimeType: "application/json" }
  });
  
  if (!imagesResponse.text) {
    throw new Error('No response text from Gemini API');
  }
  
  const imagesInfo = safeJsonParse(imagesResponse.text || '{}') || {};
  
  return {
    logoUrl: imagesInfo.logo_url || undefined,
    imageUrls: imagesInfo.image_urls && imagesInfo.image_urls.length > 0 
      ? imagesInfo.image_urls.slice(0, 10)
      : undefined
  };
}

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

  // Get all available colors from the brand DNA
  const allColors = brandDNA.visual_identity.colors && brandDNA.visual_identity.colors.length > 0
    ? brandDNA.visual_identity.colors
    : [brandDNA.visual_identity.primary_color_hex, brandDNA.visual_identity.accent_color_hex].filter(Boolean);
  
  const colorsList = allColors.join(', ');

  const prompt = `
You are an elite Product Photographer and Art Director.
Goal: Create a highly technical image generation prompt that captures the *exact* physical reality of the product while placing it in a lifestyle context.

### INPUT DATA
Brand DNA: ${JSON.stringify(brandDNA)}
Product Focus: ${productFocus}

### BRAND COLOR PALETTE
All brand colors: ${allColors.join(', ')}
Primary color (most important): ${brandDNA.visual_identity.primary_color_hex}
Accent color (secondary): ${brandDNA.visual_identity.accent_color_hex}
Use ALL these colors strategically in the image composition - incorporate brand colors naturally into backgrounds, props, lighting, or environmental elements where appropriate. Don't limit yourself to just primary and accent - use the full color palette.

### CRITICAL INSTRUCTION: VISUAL ANCHORING
You must prevent "product hallucination." Before writing the final prompt, you must mentally isolate the product's **Material Physics**:
1. **Texture:** Is it ribbed? Woven? Smooth? Matte? Glossy?
2. **Weight/Drape:** Does it hang heavily (like wool) or float light (like silk)?
3. **Imperfections:** Real products have grain and weave. Mentioning these creates realism.

### CRITICAL INSTRUCTION: TEXT OVERLAY SPACE PLANNING
This image will have marketing text overlays (title and subtitle) added later. You MUST plan the composition to accommodate text:

1. **Negative Space Strategy:**
   - Create areas with simpler, less busy backgrounds (top, bottom, or sides)
   - Avoid placing important product details in areas where text will likely be placed
   - Consider leaving 20-30% of the image with simpler backgrounds (solid colors, gradients, or minimal detail)

2. **Background Zones for Text:**
   - **Top area (top 25%):** Often ideal for text - ensure this area has simpler backgrounds if text will be placed here
   - **Bottom area (bottom 25%):** Common text placement - create clean, less cluttered backgrounds
   - **Center areas:** Only if background is uniform and provides good contrast

3. **Visual Hierarchy:**
   - Keep the product as the hero in the center or prominent position
   - Use depth of field or lighting to create natural separation between product and background areas
   - Ensure background areas (especially top/bottom) have sufficient contrast for text readability

4. **Composition Notes:**
   - Mention in composition_logic where you're creating negative space for text
   - Describe the background characteristics in text overlay zones (e.g., "soft gradient background at top", "clean minimal background at bottom")

### OUTPUT FORMAT (JSON)
Return ONLY:
{
  "step_1_analysis": {
    "texture_lock": "A few words describing the specific material surface (e.g., 'coarse woven linen', 'ribbed wool knit').",
    "lighting_strategy": "How light hits the texture (e.g., 'Raking side light to accentuate the weave').",
    "composition_logic": "Where the subject is placed to leave 'Negative Space' for text overlay later. Specifically describe which areas (top/bottom/sides) have simpler backgrounds suitable for text placement, and how the composition creates visual separation between product and text overlay zones."
  },
  "reasoning": "Brief explanation of the visual strategy",
  "includes_person": boolean,
  "composition_notes": "Notes about composition and placement",
  "imagen_prompt_final": "A prompt following this strict structure: [SUBJECT DEFINITION: detailed description of ${productFocus} focusing on texture, weave, and material weight] + [CONTEXT: The model/lifestyle setting, ensuring the product is the hero] + [COMPOSITION: Create negative space areas (top/bottom/sides) with simpler backgrounds suitable for text overlays - use depth of field or lighting to separate product from background zones] + [LIGHTING: Specific lighting to highlight material quality and create contrast in background areas] + [TECH SPECS: 8k, macro details, commercial photography, depth of field]. NO text in image. NO watermark. NO branding sections. NO logos. Clean image only. Ensure background areas where text will be placed have simpler, less busy compositions."
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
  overlay_background_type?: 'gradient' | 'solid' | 'blur' | 'shape' | 'none';
  overlay_background_color?: string;
  overlay_background_opacity?: number;
  overlay_background_shape?: 'rectangle' | 'rounded' | 'pill' | 'circle';
  overlay_background_padding?: number;
  reasoning: string;
}> => {
  const ai = getAIClient();
  const model = 'gemini-3-pro-preview';

  // Get all available colors from the brand DNA
  const allColors = brandDNA.visual_identity.colors && brandDNA.visual_identity.colors.length > 0
    ? brandDNA.visual_identity.colors
    : [brandDNA.visual_identity.primary_color_hex, brandDNA.visual_identity.accent_color_hex].filter(Boolean);
  
  const colorsList = allColors.join(', ');

  const prompt = `
You are a UI/UX Designer specializing in Social Media aesthetics and accessibility.
Goal: Determine the CSS/Design properties to overlay the title and subtitle onto the image with MAXIMUM READABILITY.

### INPUT DATA
Brand DNA: ${JSON.stringify(brandDNA)}
Title: "${title}"
Subtitle: "${subtitle}"

### BRAND COLOR PALETTE
All brand colors: ${allColors.join(', ')}
Primary color (most important): ${brandDNA.visual_identity.primary_color_hex}
Accent color (secondary): ${brandDNA.visual_identity.accent_color_hex}

### CRITICAL READABILITY ANALYSIS
Before determining placement, you MUST analyze the image:

1. **Contrast Analysis:**
   - Identify areas with sufficient brightness contrast (light backgrounds need dark text, dark backgrounds need light text)
   - Look for zones with minimal visual clutter (avoid busy/complex areas)
   - Find areas with consistent color/brightness that won't interfere with text legibility

2. **Readability Zones:**
   - Top areas: Often work well if image has simpler backgrounds at top
   - Bottom areas: Common choice, but ensure sufficient contrast
   - Center areas: Use only if background is uniform and provides good contrast
   - Avoid: Areas with high detail, busy patterns, or extreme brightness variations

3. **Text Length Consideration:**
   - Title length: "${title.length}" characters
   - Subtitle length: "${subtitle.length}" characters
   - Position must accommodate both text blocks without overlapping important image elements

4. **Accessibility Standards:**
   - Ensure text meets WCAG contrast ratio of at least 4.5:1 for normal text, 3:1 for large text
   - Test color combinations: If background is light, use dark text; if background is dark, use light text
   - Consider adding subtle text shadows or backgrounds if contrast is borderline

5. **Overlay Background Elements Analysis:**
   - Analyze the image at the chosen text position
   - Determine if overlay elements (gradients, shapes, blur) would improve readability
   - Consider: Is the background too busy? Too bright/dark? Does it need visual separation?
   - If overlay elements are needed, choose:
     - **Type**: 'gradient' (smooth color transition), 'solid' (solid color background), 'blur' (blurred background), 'shape' (geometric shape), or 'none' (no overlay needed)
     - **Color**: Choose from brand colors [${allColors.join(', ')}] or derive from image analysis
     - **Opacity**: 0.3-0.7 for subtle, 0.7-0.9 for stronger (ensure text remains readable)
     - **Shape**: 'rectangle' (sharp corners), 'rounded' (slightly rounded), 'pill' (very rounded), 'circle' (circular)
     - **Padding**: 20-40 pixels around text for comfortable spacing
   - Overlay elements should be NON-INTRUSIVE and match the brand's visual style
   - Only suggest overlay elements if they genuinely improve readability without detracting from the image

### INSTRUCTIONS
- **PRIORITY: READABILITY FIRST** - Choose position and color that maximizes text legibility
- Design styling that works for both title (larger, bolder) and subtitle (smaller, supporting)
- Consider spacing between title and subtitle (typically 8-12px)
- Position should leave room for both text elements AND avoid busy/complex image areas
- **COLOR SELECTION**: Analyze the image background at the chosen position. Choose the BEST color from ALL available brand colors (${allColors.join(', ')}) OR white/black depending on contrast needs. The chosen color MUST provide excellent contrast against the background at the selected position.
- **POSITION SELECTION**: Choose position based on readability analysis, not just aesthetics. Prefer positions with simpler backgrounds and better contrast.

### OUTPUT FORMAT (JSON)
Return ONLY:
{
  "design_strategy": {
    "font_family_category": "sans-serif" | "serif" | "handwritten",
    "font_weight": "light" | "regular" | "bold",
    "text_transform": "uppercase" | "lowercase" | "capitalize",
    "letter_spacing": "normal" | "wide",
    "text_color_hex": "Choose the BEST color from the brand palette [${allColors.join(', ')}] OR white/black for contrast. Select the color that provides MAXIMUM readability against the background at the chosen position.",
    "suggested_position": "top-center" | "bottom-right" | "center-left" | "floating-center" | "top-left" | "top-right" | "bottom-left" | "bottom-center" | "center-right" | "center-middle",
    "opacity": 1.0,
    "max_width_percent": 80,
    "overlay_background_type": "gradient" | "solid" | "blur" | "shape" | "none",
    "overlay_background_color": "Hex color from brand palette or derived from image (e.g., #FFFFFF, #000000, or brand color)",
    "overlay_background_opacity": 0.0-1.0,
    "overlay_background_shape": "rectangle" | "rounded" | "pill" | "circle",
    "overlay_background_padding": 20-40
  },
  "reasoning": "Explain: (1) Which area of the image you analyzed for readability, (2) Why this position provides optimal contrast and avoids visual clutter, (3) Which brand color you chose and why it provides excellent readability, (4) How this placement accommodates both title and subtitle without overlapping important image elements, (5) Whether overlay elements are needed and why (or why not), (6) If overlay elements are suggested, explain how they improve readability while matching brand style."
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
  
  // Use the first color from the array as fallback, or primary color
  const fallbackColor = allColors.length > 0 ? allColors[0] : brandDNA.visual_identity.primary_color_hex;
  
  return {
    font_family: designStrategy.font_family_category || result.font_family || 'sans-serif',
    font_weight: designStrategy.font_weight || result.font_weight || 'bold',
    font_transform: designStrategy.text_transform || result.font_transform || 'none',
    letter_spacing: designStrategy.letter_spacing || result.letter_spacing || 'normal',
    text_color_hex: designStrategy.text_color_hex || result.text_color_hex || fallbackColor,
    position: designStrategy.suggested_position || result.position || 'bottom-right',
    max_width_percent: designStrategy.max_width_percent || result.max_width_percent || 80,
    opacity: designStrategy.opacity !== undefined ? designStrategy.opacity : (result.opacity !== undefined ? result.opacity : 1.0),
    overlay_background_type: designStrategy.overlay_background_type || result.overlay_background_type || 'none',
    overlay_background_color: designStrategy.overlay_background_color || result.overlay_background_color,
    overlay_background_opacity: designStrategy.overlay_background_opacity !== undefined ? designStrategy.overlay_background_opacity : (result.overlay_background_opacity !== undefined ? result.overlay_background_opacity : 0.5),
    overlay_background_shape: designStrategy.overlay_background_shape || result.overlay_background_shape || 'rounded',
    overlay_background_padding: designStrategy.overlay_background_padding !== undefined ? designStrategy.overlay_background_padding : (result.overlay_background_padding !== undefined ? result.overlay_background_padding : 30),
    reasoning: result.reasoning || ''
  };
};

export const generateNonProductStrategy = async (brandDNA: BrandDNA, userPurpose: string) => {
  const ai = getAIClient();
  const model = 'gemini-3-pro-preview';

  // Get all available colors from the brand DNA
  const allColors = brandDNA.visual_identity.colors && brandDNA.visual_identity.colors.length > 0
    ? brandDNA.visual_identity.colors
    : [brandDNA.visual_identity.primary_color_hex, brandDNA.visual_identity.accent_color_hex].filter(Boolean);
  
  const colorsList = allColors.join(', ');

  const prompt = `
    You are an expert Creative Director. Create a "Non-Product" Brand Moment post.
    Brand DNA: ${JSON.stringify(brandDNA)}
    User Purpose: ${userPurpose}

    ### BRAND COLOR PALETTE
    All brand colors: ${allColors.join(', ')}
    Primary color (most important): ${brandDNA.visual_identity.primary_color_hex}
    Accent color (secondary): ${brandDNA.visual_identity.accent_color_hex}
    Use ALL these colors strategically in the visual concept and design. Incorporate brand colors naturally into the image composition. Don't limit yourself to just primary and accent - use the full color palette.

    ### FINAL OUTPUT FORMAT (JSON)
    {
      "step_1_visual_concept": {
        "visual_metaphor_reasoning": "Explanation",
        "includes_person": boolean,
        "imagen_prompt_final": "Detailed prompt for Imagen 3. Incorporate brand colors [${allColors.join(', ')}] naturally into the composition. NO watermark. NO branding sections. NO logos. NO text overlays. Clean image only."
      },
      "step_2_message_strategy": {
        "headline_text": "Main text hook",
        "body_caption_draft": "Optional short caption",
        "design_instructions": { 
          "text_overlay_strength": "Heavy"|"Subtle", 
          "suggested_text_color": "Choose the BEST color from brand palette [${allColors.join(', ')}] OR white/black for contrast", 
          "suggested_position": "Center-Middle"|"Bottom-Right" 
        }
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

  // Get all available colors from the brand DNA
  const allColors = brandDNA.visual_identity.colors && brandDNA.visual_identity.colors.length > 0
    ? brandDNA.visual_identity.colors
    : [brandDNA.visual_identity.primary_color_hex, brandDNA.visual_identity.accent_color_hex].filter(Boolean);
  
  const colorsList = allColors.join(', ');

  const prompt = `
    Create a coordinated campaign of ${postCount} posts.
    Brand DNA: ${JSON.stringify(brandDNA)}
    Campaign Goal: ${campaignDetails}

    ### BRAND COLOR PALETTE
    All brand colors: ${allColors.join(', ')}
    Primary color (most important): ${brandDNA.visual_identity.primary_color_hex}
    Accent color (secondary): ${brandDNA.visual_identity.accent_color_hex}
    Use ALL these colors strategically across the campaign. Vary which colors are used in each post to create visual interest while maintaining brand consistency. Each post should use colors from the full brand palette [${allColors.join(', ')}]. Don't limit yourself to just primary and accent colors.

    Return JSON as an array of strategies:
    {
      "posts": [
        {
          "visual_prompt": "Imagen 3 prompt for this post. Incorporate brand colors [${allColors.join(', ')}] naturally into the composition. NO watermark. NO branding sections. NO logos. NO text overlays. Clean image only.",
          "headline": "Headline for this post",
          "suggested_text_color": "Choose the BEST color from brand palette [${allColors.join(', ')}] OR white/black for contrast",
          "reasoning": "Why this fits the sequence and which brand colors are used"
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
  
  // Extract image dimensions to preserve aspect ratio
  let aspectRatio: string = "1:1"; // Default to square
  let imageSize: "2K" | "4K" = "2K"; // Default size
  
  try {
    const imageBuffer = Buffer.from(base64Data, 'base64');
    const metadata = await sharp(imageBuffer).metadata();
    const width = metadata.width || 1080;
    const height = metadata.height || 1080;
    
    // Calculate aspect ratio
    const ratio = width / height;
    
    // Map to supported aspect ratios (same logic as generateImage)
    if (ratio < 0.7) {
      // Very tall/portrait - prefer 9:16 or 3:4
      aspectRatio = Math.abs(ratio - 9/16) < Math.abs(ratio - 3/4) ? "9:16" : "3:4";
    } else if (ratio > 1.5) {
      // Very wide/landscape - prefer 16:9 or 4:3
      aspectRatio = Math.abs(ratio - 16/9) < Math.abs(ratio - 4/3) ? "16:9" : "4:3";
    } else {
      // Square-ish or moderate ratios
      const supportedRatios = [
        { name: "1:1", value: 1.0 },
        { name: "9:16", value: 9/16 },
        { name: "16:9", value: 16/9 },
        { name: "4:3", value: 4/3 },
        { name: "3:4", value: 3/4 }
      ];
      
      let closestRatio = supportedRatios[0];
      let minDifference = Math.abs(ratio - closestRatio.value);
      
      for (const supportedRatio of supportedRatios) {
        const difference = Math.abs(ratio - supportedRatio.value);
        if (difference < minDifference) {
          minDifference = difference;
          closestRatio = supportedRatio;
        }
      }
      
      aspectRatio = closestRatio.name;
    }
    
    // Determine image size based on larger dimension
    imageSize = Math.max(width, height) >= 2048 ? "4K" : "2K";
  } catch (error) {
    console.warn('[editImage] Failed to extract image dimensions, using defaults:', error);
    // Continue with defaults
  }
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview', // Nano Banana Pro - higher fidelity, up to 4K output
    contents: {
      parts: [
        { inlineData: { mimeType: "image/png", data: base64Data } },
        { text: `Edit this image based on feedback: ${feedback}. Ensure NO watermark, NO branding sections, NO logos, and NO text overlays remain in the image. Clean image only.` }
      ]
    },
    config: { imageConfig: { aspectRatio: aspectRatio as any, imageSize: imageSize as any } }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  throw new Error("Failed to edit image");
};

