import sharp from 'sharp';
import { OverlayConfig } from '../types/index.js';

/**
 * Convert base64 image to Buffer
 */
const base64ToBuffer = (base64: string): Buffer => {
  const base64Data = base64.includes(',') 
    ? base64.split(',')[1] 
    : base64;
  return Buffer.from(base64Data, 'base64');
};

/**
 * Convert Buffer to base64 data URL
 */
const bufferToBase64 = (buffer: Buffer, mimeType: string = 'image/png'): string => {
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
};

/**
 * Get font family name for SVG
 */
const getFontFamily = (family: OverlayConfig['font_family']): string => {
  switch (family) {
    case 'serif':
      return 'Georgia, serif';
    case 'cursive':
      return 'Brush Script MT, cursive';
    case 'sans-serif':
    default:
      return 'Arial, Helvetica, sans-serif';
  }
};

/**
 * Calculate text position based on position string
 */
const calculatePosition = (
  position: OverlayConfig['position'],
  imageWidth: number,
  imageHeight: number,
  textWidth: number,
  textHeight: number,
  maxWidth: number
): { x: number; y: number } => {
  const actualMaxWidth = (imageWidth * maxWidth) / 100;
  const padding = 40;
  
  let x = 0;
  let y = 0;
  
  // Horizontal positioning
  if (position.includes('left')) {
    x = padding;
  } else if (position.includes('right')) {
    x = imageWidth - Math.min(textWidth, actualMaxWidth) - padding;
  } else if (position.includes('center') || position.includes('middle')) {
    // center
    x = (imageWidth - Math.min(textWidth, actualMaxWidth)) / 2;
  } else {
    // Default to center
    x = (imageWidth - Math.min(textWidth, actualMaxWidth)) / 2;
  }
  
  // Vertical positioning
  if (position.includes('top')) {
    y = padding;
  } else if (position.includes('bottom')) {
    y = imageHeight - textHeight - padding;
  } else if (position.includes('middle') || position.includes('center')) {
    // middle/center
    y = (imageHeight - textHeight) / 2;
  } else {
    // Default to center
    y = (imageHeight - textHeight) / 2;
  }
  
  return { x, y };
};

/**
 * Apply text overlay to an image
 */
export const applyTextOverlay = async (
  imageBase64: string,
  overlayConfig: OverlayConfig
): Promise<string> => {
  try {
    const imageBuffer = base64ToBuffer(imageBase64);
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();
    const width = metadata.width || 1024;
    const height = metadata.height || 1024;
    
    // Calculate text dimensions (approximate)
    const fontSize = Math.max(32, Math.min(width / 15, 72));
    const fontFamily = getFontFamily(overlayConfig.font_family);
    const fontWeight = overlayConfig.font_weight === 'bold' ? 'bold' : 'normal';
    const textTransform = overlayConfig.font_transform === 'uppercase' ? 'uppercase' : 'none';
    const textColor = overlayConfig.text_color_hex;
    
    // Estimate text width (rough approximation)
    const avgCharWidth = fontSize * 0.6;
    const textWidth = overlayConfig.text.length * avgCharWidth;
    const textHeight = fontSize * 1.2;
    const maxWidth = (width * overlayConfig.max_width_percent) / 100;
    
    const { x, y } = calculatePosition(
      overlayConfig.position,
      width,
      height,
      textWidth,
      textHeight,
      overlayConfig.max_width_percent
    );
    
    // Create SVG text overlay
    const textToRender = textTransform === 'uppercase' 
      ? overlayConfig.text.toUpperCase() 
      : overlayConfig.text;
    
    const svgText = `
      <svg width="${width}" height="${height}">
        <text
          x="${x}"
          y="${y + fontSize}"
          font-family="${fontFamily}"
          font-size="${fontSize}"
          font-weight="${fontWeight}"
          fill="${textColor}"
          text-anchor="${overlayConfig.position.includes('right') ? 'end' : overlayConfig.position.includes('left') ? 'start' : 'middle'}"
          style="text-shadow: 2px 2px 4px rgba(0,0,0,0.5);"
        >
          ${textToRender.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}
        </text>
      </svg>
    `;
    
    const svgBuffer = Buffer.from(svgText);
    
    // Composite the text overlay onto the image
    const outputBuffer = await image
      .composite([
        {
          input: svgBuffer,
          top: 0,
          left: 0,
        },
      ])
      .png()
      .toBuffer();
    
    return bufferToBase64(outputBuffer);
  } catch (error) {
    console.error('Error applying text overlay:', error);
    throw new Error(`Failed to apply text overlay: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Update overlay on an existing image
 */
export const updateOverlay = async (
  baseImageBase64: string,
  newOverlayConfig: OverlayConfig
): Promise<string> => {
  return applyTextOverlay(baseImageBase64, newOverlayConfig);
};

