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
    
    Focus specifically on:
    - Primary brand color (dominant color used throughout - return as hex code like #FF5733)
    - Accent color (secondary color used for buttons, highlights - return as hex code)
    - Background style (describe the typical background aesthetic)
    - Imagery style (describe the photography/image style used)
    - Typography vibe (describe the font personality and style)
    - Logo style (describe the logo's visual characteristics)
    
    Return ONLY a JSON object with this exact structure:
    {
      "primary_color_hex": "#HEXCODE",
      "accent_color_hex": "#HEXCODE",
      "background_style": "Description of background style",
      "imagery_style": "Description of imagery/photography style",
      "font_vibe": "Description of typography personality",
      "logo_style": "Description of logo characteristics"
    }
    
    Return ONLY JSON. No markdown, no explanations.
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

  // Combine all extracted data
  const dna: BrandDNA = {
    id: Date.now().toString(),
    name: basicInfo.name || 'Unknown Brand',
    tagline: basicInfo.tagline || '',
    overview: basicInfo.overview || '',
    visual_identity: {
      primary_color_hex: visualInfo.primary_color_hex || '#4F46E5',
      accent_color_hex: visualInfo.accent_color_hex || '#F59E0B',
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

  return dna;
};

export const generateProductStrategy = async (brandDNA: BrandDNA, productFocus: string, referenceImageBase64?: string) => {
  const ai = getAIClient();
  const model = 'gemini-3-pro-preview';

  const prompt = `
    You are an elite Creative Director and Lead Copywriter.
    Goal: Design a single social media product post aligning with the provided Brand DNA.

    ### INPUT DATA
    Brand DNA JSON: ${JSON.stringify(brandDNA)}
    Product Focus: ${productFocus}

    ### FINAL OUTPUT FORMAT (JSON)
    Return ONLY:
    {
      "step_1_visual_strategy": {
        "reasoning": "Strategy explanation",
        "includes_person": boolean,
        "composition_notes": "Placement notes",
        "imagen_prompt_final": "Detailed prompt for Imagen 3 using DNA prefix. No text requests."
      },
      "step_2_design_strategy": {
        "headline_text": "Punchy line (max 10 words)",
        "font_css_instructions": { "family_type": "sans-serif"|"serif"|"cursive", "weight": "bold"|"normal", "transform": "uppercase"|"none" },
        "text_overlay_instructions": { "text_color_hex": "DNA color or contrast", "suggested_position": "top-center"|"bottom-left"|"center-right", "max_width_percent": "e.g. 80%" }
      }
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

  return safeJsonParse(response.text || '{}');
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

export const generateImage = async (prompt: string): Promise<string> => {
  const ai = getAIClient();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts: [{ text: prompt }] },
    config: { imageConfig: { aspectRatio: "1:1" } }
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
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { inlineData: { mimeType: "image/png", data: base64Data } },
        { text: `Edit this image based on feedback: ${feedback}` }
      ]
    }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  throw new Error("Failed to edit image");
};

