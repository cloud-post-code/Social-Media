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

  const prompt = `
    You are an expert Chief Marketing Officer and Creative Director. 
    Analyze the provided ${input.url ? `URL: ${input.url}` : 'attached website screenshot'} to reverse-engineer the company's "Brand DNA."

    Output a strictly formatted JSON object with this structure:
    {
      "name": "Company Name",
      "tagline": "Brand tagline",
      "overview": "Short brand overview paragraph",
      "visual_identity": {
        "primary_color_hex": "Extract dominant brand color",
        "accent_color_hex": "Extract secondary/button color",
        "background_style": "Describe background (e.g. 'Clean white', 'Dark mode gradients')",
        "imagery_style": "Describe photography style for an image generator",
        "font_vibe": "Describe typography personality",
        "logo_style": "Describe the logo's visual characteristics"
      },
      "brand_voice": {
        "tone_adjectives": ["Adj1", "Adj2", "Adj3"],
        "writing_style": "Describe sentence structure",
        "keywords_to_use": ["K1", "K2", "K3"],
        "taboo_words": ["Word1", "Word2", "Word3"]
      },
      "strategic_profile": {
        "target_audience": "Specific audience description",
        "core_value_prop": "Main benefit promised",
        "product_category": "Industry niche"
      },
      "image_generation_prompt_prefix": "Create a detailed prefix for Imagen 3. Example: 'A high-quality professional photo in the style of [Brand]...'"
    }
    
    Return ONLY JSON. No markdown.
  `;

  let contents: any;
  if (input.imageBase64) {
    const base64Data = input.imageBase64.includes(',') 
      ? input.imageBase64.split(',')[1] 
      : input.imageBase64;
    contents = {
      parts: [
        { text: prompt },
        { inlineData: { mimeType: "image/png", data: base64Data } }
      ]
    };
  } else {
    contents = { parts: [{ text: prompt }] };
  }

  const response = await ai.models.generateContent({
    model,
    contents,
    config: { responseMimeType: "application/json" }
  });

  const dna = safeJsonParse(response.text || '{}');
  return { ...dna, id: Date.now().toString() };
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

