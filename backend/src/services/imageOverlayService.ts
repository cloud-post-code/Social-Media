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
    case 'handwritten':
      return 'Brush Script MT, "Lucida Handwriting", cursive';
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
    // Use larger font size for better visibility
    const fontSize = Math.max(48, Math.min(width / 12, 96));
    const fontFamily = getFontFamily(overlayConfig.font_family);
    // Map font weights: light -> 300, regular -> 400, bold -> 700
    const fontWeight = overlayConfig.font_weight === 'bold' ? '700' : 
                      overlayConfig.font_weight === 'light' ? '300' : '400';
    // Handle text transform
    let textToTransform = overlayConfig.text;
    if (overlayConfig.font_transform === 'uppercase') {
      textToTransform = overlayConfig.text.toUpperCase();
    } else if (overlayConfig.font_transform === 'lowercase') {
      textToTransform = overlayConfig.text.toLowerCase();
    } else if (overlayConfig.font_transform === 'capitalize') {
      textToTransform = overlayConfig.text.split(' ').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      ).join(' ');
    }
    const textColor = overlayConfig.text_color_hex;
    const opacity = overlayConfig.opacity !== undefined ? overlayConfig.opacity : 1.0;
    const letterSpacing = overlayConfig.letter_spacing === 'wide' ? '0.15em' : 'normal';
    
    // Estimate text width (rough approximation - wider for bold)
    const charWidthMultiplier = fontWeight === 'bold' ? 0.7 : 0.6;
    const avgCharWidth = fontSize * charWidthMultiplier;
    const textWidth = overlayConfig.text.length * avgCharWidth;
    const textHeight = fontSize * 1.4; // More space for descenders
    const maxWidth = (width * overlayConfig.max_width_percent) / 100;
    
    const { x, y } = calculatePosition(
      overlayConfig.position,
      width,
      height,
      textWidth,
      textHeight,
      overlayConfig.max_width_percent
    );
    
    // Adjust y position - SVG text y is the baseline
    let textY = y;
    if (overlayConfig.position.includes('top')) {
      textY = y + fontSize; // Baseline position for top-aligned text
    } else if (overlayConfig.position.includes('bottom')) {
      textY = y; // y already accounts for text height
    } else {
      textY = y + fontSize / 2; // Center baseline
    }
    
    // Handle floating-center position
    if (overlayConfig.position === 'floating-center') {
      x = width / 2;
      textY = height / 2;
    }
    
    // Escape XML special characters
    const escapedText = textToTransform
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
    
    const textAnchor = overlayConfig.position.includes('right') 
      ? 'end' 
      : overlayConfig.position.includes('left') 
      ? 'start' 
      : 'middle';
    
    // Create SVG with clean filter-based shadow (no double text, no stroke artifacts)
    const svgText = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="textShadow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="2"/>
      <feOffset dx="2" dy="2" result="offsetblur"/>
      <feComponentTransfer>
        <feFuncA type="linear" slope="0.5"/>
      </feComponentTransfer>
      <feMerge>
        <feMergeNode/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <text
    x="${x}"
    y="${textY}"
    font-family="${fontFamily}"
    font-size="${fontSize}"
    font-weight="${fontWeight}"
    fill="${textColor}"
    text-anchor="${textAnchor}"
    letter-spacing="${letterSpacing}"
    opacity="${opacity}"
    filter="url(#textShadow)"
  >${escapedText}</text>
</svg>`;
    
    // Debug logging
    console.log('Applying overlay:', {
      text: overlayConfig.text,
      position: overlayConfig.position,
      color: overlayConfig.text_color_hex,
      fontSize,
      x,
      y: textY,
      imageSize: `${width}x${height}`,
      svgPreview: svgText.substring(0, 200)
    });
    
    const svgBuffer = Buffer.from(svgText);
    
    // Composite the text overlay onto the image
    // Sharp will auto-detect SVG format from the buffer
    const outputBuffer = await image
      .composite([
        {
          input: svgBuffer,
          top: 0,
          left: 0,
          blend: 'over'
        },
      ])
      .png()
      .toBuffer();
    
    return bufferToBase64(outputBuffer);
  } catch (error) {
    console.error('Error applying text overlay:', error);
    console.error('Overlay config:', overlayConfig);
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

