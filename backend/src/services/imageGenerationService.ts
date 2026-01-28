import { fal } from '@fal-ai/client';
import { ImageModel } from '../types/index.js';

// Configure fal client with API key
const configureFal = () => {
  const apiKey = process.env.FAL_KEY;
  if (!apiKey) {
    throw new Error('FAL_KEY environment variable is not set');
  }
  fal.config({ credentials: apiKey });
};

// Model endpoint mapping
const MODEL_ENDPOINTS: Record<ImageModel, string> = {
  'flux-2-dev': 'fal-ai/flux-2-dev',
  'seedream-4.5': 'fal-ai/bytedance/seedream/v4.5/text-to-image',
  'recraft-v3': 'fal-ai/recraft-v3',
};

// Model-specific default configurations
const MODEL_CONFIGS: Record<ImageModel, {
  guidance_scale?: number;
  num_inference_steps?: number;
  scheduler?: string;
}> = {
  'flux-2-dev': {
    guidance_scale: 3.5,
    num_inference_steps: 28,
  },
  'seedream-4.5': {
    guidance_scale: 5.0,
    num_inference_steps: 30,
  },
  'recraft-v3': {
    // Recraft v3 uses different parameters
  },
};

interface FalImageResult {
  images: Array<{
    url: string;
    content_type?: string;
  }>;
}

/**
 * Convert an image URL or base64 to a format fal.ai accepts
 */
const prepareImageInput = async (imageBase64: string): Promise<string> => {
  // If it's already a URL, return it
  if (imageBase64.startsWith('http://') || imageBase64.startsWith('https://')) {
    return imageBase64;
  }
  
  // If it's a data URI, extract the base64 part and return as data URI
  // fal.ai accepts data URIs for image inputs
  if (imageBase64.startsWith('data:')) {
    return imageBase64;
  }
  
  // If it's raw base64, wrap it as a data URI
  return `data:image/png;base64,${imageBase64}`;
};

/**
 * Fetch image from URL and convert to base64 data URI
 */
const urlToBase64 = async (imageUrl: string): Promise<string> => {
  const response = await fetch(imageUrl);
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const base64 = buffer.toString('base64');
  const contentType = response.headers.get('content-type') || 'image/png';
  return `data:${contentType};base64,${base64}`;
};

/**
 * Generate an image using the specified model through fal.ai
 * 
 * @param model - The image generation model to use
 * @param prompt - The text prompt describing the image
 * @param width - Image width (default 1080)
 * @param height - Image height (default 1080)
 * @param referenceImageBase64 - Optional reference image for image-to-image generation
 * @returns Base64 data URI of the generated image
 */
export const generateImage = async (
  model: ImageModel,
  prompt: string,
  width: number = 1080,
  height: number = 1080,
  referenceImageBase64?: string
): Promise<string> => {
  configureFal();
  
  const endpoint = MODEL_ENDPOINTS[model];
  const config = MODEL_CONFIGS[model];
  
  if (!endpoint) {
    throw new Error(`Unknown image model: ${model}`);
  }
  
  console.log(`[ImageGeneration] Using model: ${model} (${endpoint})`);
  console.log(`[ImageGeneration] Dimensions: ${width}x${height}`);
  
  // Build the input object based on model requirements
  let input: Record<string, any> = {
    prompt,
    image_size: {
      width,
      height,
    },
    ...config,
  };
  
  // Handle reference image for image-to-image generation
  if (referenceImageBase64) {
    const imageInput = await prepareImageInput(referenceImageBase64);
    
    if (model === 'flux-2-dev') {
      // FLUX.2 uses 'image' parameter for image-to-image
      input.image = imageInput;
      input.strength = 0.75; // How much to transform the reference image
    } else if (model === 'seedream-4.5') {
      // Seedream uses 'image' parameter for editing
      input.image = imageInput;
    }
    // Recraft v3 handles reference images differently - primarily text-to-image
  }
  
  try {
    const result = await fal.subscribe(endpoint, {
      input,
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === 'IN_PROGRESS') {
          console.log(`[ImageGeneration] Progress: ${update.logs?.map(log => log.message).join(', ') || 'processing...'}`);
        }
      },
    }) as FalImageResult;
    
    if (!result.images || result.images.length === 0) {
      throw new Error('No images returned from fal.ai');
    }
    
    const imageUrl = result.images[0].url;
    console.log(`[ImageGeneration] Generated image URL: ${imageUrl}`);
    
    // Convert the URL to base64 data URI to match existing system format
    const base64DataUri = await urlToBase64(imageUrl);
    
    return base64DataUri;
  } catch (error: any) {
    console.error(`[ImageGeneration] Error generating image with ${model}:`, error);
    
    // Provide more helpful error messages
    if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
      throw new Error('Invalid FAL_KEY. Please check your fal.ai API key.');
    }
    if (error.message?.includes('429') || error.message?.includes('rate limit')) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }
    if (error.message?.includes('400') || error.message?.includes('Bad Request')) {
      throw new Error(`Invalid request parameters for ${model}: ${error.message}`);
    }
    
    throw new Error(`Failed to generate image with ${model}: ${error.message}`);
  }
};

/**
 * Check if a model is valid
 */
export const isValidModel = (model: string): model is ImageModel => {
  return model in MODEL_ENDPOINTS;
};

/**
 * Get available models
 */
export const getAvailableModels = (): ImageModel[] => {
  return Object.keys(MODEL_ENDPOINTS) as ImageModel[];
};
