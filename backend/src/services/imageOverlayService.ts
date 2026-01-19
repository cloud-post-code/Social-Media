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
    
    // Get title and subtitle (support legacy 'text' field for backward compatibility)
    const title = overlayConfig.title || overlayConfig.text || '';
    const subtitle = overlayConfig.subtitle || '';
    
    if (!title) {
      throw new Error('Title is required for overlay');
    }
    
    const fontFamily = getFontFamily(overlayConfig.font_family);
    const fontWeight = overlayConfig.font_weight === 'bold' ? '700' : 
                      overlayConfig.font_weight === 'light' ? '300' : '400';
    const textColor = overlayConfig.text_color_hex;
    const opacity = overlayConfig.opacity !== undefined ? overlayConfig.opacity : 1.0;
    const letterSpacing = overlayConfig.letter_spacing === 'wide' ? '0.15em' : 'normal';
    
    // Font sizes - title larger, subtitle smaller
    const titleFontSize = Math.max(56, Math.min(width / 10, 120));
    const subtitleFontSize = Math.max(32, Math.min(width / 16, 64));
    const lineSpacing = subtitleFontSize * 0.3; // Space between title and subtitle
    
    // Handle text transform
    const transformText = (text: string) => {
      if (overlayConfig.font_transform === 'uppercase') {
        return text.toUpperCase();
      } else if (overlayConfig.font_transform === 'lowercase') {
        return text.toLowerCase();
      } else if (overlayConfig.font_transform === 'capitalize') {
        return text.split(' ').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');
      }
      return text;
    };
    
    const titleText = transformText(title);
    const subtitleText = subtitle ? transformText(subtitle) : '';
    
    // Estimate total text height (title + spacing + subtitle)
    const totalTextHeight = titleFontSize + (subtitleText ? (lineSpacing + subtitleFontSize) : 0);
    
    // Calculate position
    const charWidthMultiplier = overlayConfig.font_weight === 'bold' ? 0.7 : 0.6;
    const maxTitleWidth = title.length * titleFontSize * charWidthMultiplier;
    const maxSubtitleWidth = subtitleText.length * subtitleFontSize * charWidthMultiplier;
    const maxTextWidth = Math.max(maxTitleWidth, maxSubtitleWidth);
    const maxWidth = (width * overlayConfig.max_width_percent) / 100;
    
    const positionResult = calculatePosition(
      overlayConfig.position,
      width,
      height,
      maxTextWidth,
      totalTextHeight,
      overlayConfig.max_width_percent
    );
    
    // Handle floating-center position
    let x = positionResult.x;
    let y = positionResult.y;
    if (overlayConfig.position === 'floating-center') {
      x = width / 2;
      y = height / 2;
    }
    
    // Calculate text anchor
    const textAnchor = overlayConfig.position.includes('right') 
      ? 'end' 
      : overlayConfig.position.includes('left') 
      ? 'start' 
      : 'middle';
    
    // Calculate Y positions for title and subtitle
    let titleY = y;
    let subtitleY = y;
    
    if (overlayConfig.position.includes('top')) {
      titleY = y + titleFontSize;
      subtitleY = titleY + lineSpacing + subtitleFontSize;
    } else if (overlayConfig.position.includes('bottom')) {
      subtitleY = y;
      titleY = subtitleY - lineSpacing - titleFontSize;
    } else {
      // Center - position title in middle, subtitle below
      const centerY = overlayConfig.position === 'floating-center' ? height / 2 : y;
      titleY = centerY - (subtitleText ? lineSpacing / 2 : 0);
      subtitleY = titleY + lineSpacing + subtitleFontSize;
    }
    
    // Escape XML special characters
    const escapeXml = (text: string) => {
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    };
    
    const escapedTitle = escapeXml(titleText);
    const escapedSubtitle = subtitleText ? escapeXml(subtitleText) : '';
    
    // Create SVG with title and subtitle
    // Use simpler approach - render SVG to PNG first to ensure it works
    const svgText = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="textShadow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="3"/>
      <feOffset dx="2" dy="2" result="offsetblur"/>
      <feComponentTransfer result="shadow">
        <feFuncA type="linear" slope="0.6"/>
      </feComponentTransfer>
      <feMerge>
        <feMergeNode in="shadow"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <text
    x="${x}"
    y="${titleY}"
    font-family="${fontFamily}"
    font-size="${titleFontSize}"
    font-weight="${fontWeight}"
    fill="${textColor}"
    text-anchor="${textAnchor}"
    letter-spacing="${letterSpacing}"
    opacity="${opacity}"
    filter="url(#textShadow)"
  >${escapedTitle}</text>
  ${subtitleText ? `<text
    x="${x}"
    y="${subtitleY}"
    font-family="${fontFamily}"
    font-size="${subtitleFontSize}"
    font-weight="${fontWeight === '700' ? '400' : fontWeight}"
    fill="${textColor}"
    text-anchor="${textAnchor}"
    letter-spacing="${letterSpacing}"
    opacity="${opacity * 0.9}"
    filter="url(#textShadow)"
  >${escapedSubtitle}</text>` : ''}
</svg>`;
    
    // Debug logging
    console.log('Applying overlay:', {
      title,
      subtitle,
      position: overlayConfig.position,
      color: overlayConfig.text_color_hex,
      titleFontSize,
      subtitleFontSize,
      x,
      titleY,
      subtitleY,
      imageSize: `${width}x${height}`
    });
    
    // Render SVG to PNG buffer first, then composite
    // This ensures the SVG is properly rendered
    // Use higher density for better text quality
    const svgBuffer = Buffer.from(svgText);
    
    try {
      // Try rendering SVG with density first
      const svgImage = sharp(svgBuffer, { density: 300 });
      const svgRendered = await svgImage
        .resize(width, height, { fit: 'fill' })
        .png()
        .toBuffer();
      
      // Composite the rendered SVG onto the image
      const outputBuffer = await image
        .composite([
          {
            input: svgRendered,
            top: 0,
            left: 0,
            blend: 'over'
          },
        ])
        .png()
        .toBuffer();
      
      return bufferToBase64(outputBuffer);
    } catch (svgError) {
      console.warn('SVG rendering with density failed, trying direct composite:', svgError);
      // Fallback: try direct SVG composite
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
    }
    
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

