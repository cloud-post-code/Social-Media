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
 * Maps frontend font family choices (including Google Fonts) to server-available fonts
 */
const getFontFamily = (family: string): string => {
  // Map Google Fonts to categories based on their type
  // Serif fonts
  const serifFonts = ['Merriweather', 'Roboto Slab', 'Playfair Display', 'Lora', 'Bitter'];
  // Handwriting/Cursive fonts
  const handwritingFonts = ['Dancing Script', 'Pacifico', 'Kalam', 'Permanent Marker', 'Caveat', 
    'Indie Flower', 'Shadows Into Light', 'Great Vibes', 'Sacramento', 'Satisfy'];
  // Display fonts (usually sans-serif)
  const displayFonts = ['Amatic SC', 'Press Start 2P', 'Bangers', 'Creepster', 'Metal Mania', 'Monoton'];
  
  // Check if it's a Google Font and map to category
  if (serifFonts.includes(family)) {
    return 'DejaVu Serif, Liberation Serif, Times New Roman, Times, serif';
  }
  if (handwritingFonts.includes(family)) {
    return 'DejaVu Serif, Liberation Serif, serif';
  }
  
  // Map old font names
  switch (family) {
    case 'serif':
      return 'DejaVu Serif, Liberation Serif, Times New Roman, Times, serif';
    case 'cursive':
    case 'handwritten':
      return 'DejaVu Serif, Liberation Serif, serif';
    case 'sans-serif':
    default:
      // Default to sans-serif for all other fonts (including Google Fonts like Roboto, Open Sans, etc.)
      return 'DejaVu Sans, Liberation Sans, Arial, Helvetica, sans-serif';
  }
};

/**
 * Strip markdown syntax from text
 */
const stripMarkdown = (text: string): string => {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .trim();
};

// ============================================================
// FONT SIZE PERCENTAGE CONVERSION (Canva-style)
// Font sizes are stored as percentage of image width for resolution independence
// ============================================================

/**
 * Convert percentage to pixel font size
 */
const percentToFontSize = (percent: number, imageWidth: number): number => {
  return (percent / 100) * imageWidth;
};

/**
 * Normalize font size - handles backward compatibility with legacy pixel values
 * If value > 20, assume it's legacy pixels; otherwise treat as percentage
 */
const normalizeFontSize = (value: number | undefined, imageWidth: number, isTitle: boolean): number => {
  if (value === undefined) {
    // Default: 10% for title, 6% for subtitle (similar to imageWidth/10 and imageWidth/16)
    return isTitle ? percentToFontSize(10, imageWidth) : percentToFontSize(6, imageWidth);
  }
  
  // If value > 20, it's likely a percentage value from frontend
  // If value <= 20, it could be a very small percentage or legacy
  if (value <= 20) {
    // Treat as percentage
    return percentToFontSize(value, imageWidth);
  }
  
  // Value > 20 - this is likely already in pixels (legacy), use as-is
  return value;
};

/**
 * Transform text based on transform type
 */
const transformText = (text: string, transform: 'uppercase' | 'lowercase' | 'capitalize' | 'none'): string => {
  const cleaned = stripMarkdown(text);
      
  if (transform === 'uppercase') {
        return cleaned.toUpperCase();
  } else if (transform === 'lowercase') {
        return cleaned.toLowerCase();
  } else if (transform === 'capitalize') {
        return cleaned.split(' ').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');
      }
      return cleaned;
    };
    
/**
 * Process text into lines (respecting manual line breaks and auto-wrapping)
 */
const processTextLines = (
  text: string,
  fontSize: number,
  maxWidth: number,
  fontWeight: 'light' | 'regular' | 'bold'
): string[] => {
  // First, split by manual line breaks
  const manualLines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  // If we have manual line breaks, use them
  if (manualLines.length > 1) {
    return manualLines;
  }
  
  // Otherwise, auto-wrap the text
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  const charWidthMultiplier = fontWeight === 'bold' ? 0.7 : 0.6;
      
  for (const word of words) {
    // Check if the word itself is longer than maxWidth - if so, break it
    const wordWidth = word.length * fontSize * charWidthMultiplier;
    
    if (wordWidth > maxWidth) {
      // Word is too long - break it into characters
      if (currentLine) {
        lines.push(currentLine);
        currentLine = '';
      }
      
      // Break the long word into chunks that fit within maxWidth
      let wordChunk = '';
      for (const char of word) {
        const testChunk = wordChunk + char;
        const chunkWidth = testChunk.length * fontSize * charWidthMultiplier;
        if (chunkWidth <= maxWidth) {
          wordChunk = testChunk;
        } else {
          if (wordChunk) {
            lines.push(wordChunk);
          }
          wordChunk = char;
        }
      }
      if (wordChunk) {
        currentLine = wordChunk;
      }
    } else {
      // Word fits - try to add it to current line
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const estimatedWidth = testLine.length * fontSize * charWidthMultiplier;
      
      if (estimatedWidth <= maxWidth) {
        currentLine = testLine;
      } else {
        // Current line is full - start a new line with this word
        if (currentLine) {
          lines.push(currentLine);
        }
        currentLine = word;
      }
    }
  }
  
  if (currentLine) {
    lines.push(currentLine);
  }
  
  return lines;
};
    
/**
 * Calculate text dimensions and position for a single text element
 * Matches frontend simple percentage-based positioning
 */
const calculateTextElement = (
  text: string,
  config: {
    fontFamily: string;
    fontWeight: string;
    fontSize: number;
    maxWidthPercent: number;
    xPercent: number;
    yPercent: number;
    textAnchor: 'start' | 'middle' | 'end';
    fontWeightValue: 'light' | 'regular' | 'bold';
  },
  imageWidth: number,
  imageHeight: number,
  preCalculatedLines?: string[]
): {
  lines: string[];
  x: number;
  y: number;
  width: number;
  height: number;
  lineHeight: number;
} => {
  const maxWidth = (imageWidth * config.maxWidthPercent) / 100;
  const lineHeight = config.fontSize * 1.2;
  
  // Use pre-calculated lines if provided (from frontend Canvas API), otherwise calculate
  const lines = preCalculatedLines && preCalculatedLines.length > 0
    ? preCalculatedLines
    : processTextLines(text, config.fontSize, maxWidth, config.fontWeightValue);
  const height = lines.length * lineHeight;
    
  // Calculate width from longest line
  const charWidthMultiplier = config.fontWeightValue === 'bold' ? 0.7 : 0.6;
  const width = Math.max(...lines.map(line => line.length * config.fontSize * charWidthMultiplier));
  
  // Simple percentage-based positioning (matching frontend)
  // Frontend uses: left = offsetX + (displayWidth * xPercent / 100) with translate(-50%, -50%)
  // The div is centered at xPercent, yPercent, and text-align controls alignment within the div
  // For SVG, we position at the center and use text-anchor to match text-align behavior
  const centerX = (imageWidth * config.xPercent) / 100;
  const centerY = (imageHeight * config.yPercent) / 100;
    
  // Calculate x position based on text-anchor
  // For middle: x is at center (matches text-align: center)
  // For start: x is at center - half width (so text starts at left edge of centered div)
  // For end: x is at center + half width (so text ends at right edge of centered div)
  let x: number;
  if (config.textAnchor === 'start') {
    // Position so text starts at the left edge of the centered area
    // The centered area is at centerX, so left edge is centerX - maxWidth/2
    x = centerX - (maxWidth / 2);
  } else if (config.textAnchor === 'end') {
    // Position so text ends at the right edge of the centered area
    x = centerX + (maxWidth / 2);
      } else {
    // Middle: text centered at centerX
    x = centerX;
  }
  
  // For y, we need to position the center of the text block at centerY
  // First line Y = center Y - (height / 2) + lineHeight
  const firstLineY = centerY - (height / 2) + lineHeight;
  
  return {
    lines,
    x,
    y: firstLineY,
        width,
        height,
    lineHeight
  };
};

/**
 * Generate overlay background for a single text element
 */
const generateElementOverlayBackground = (
  element: {
    x: number;
    y: number;
    width: number;
    height: number;
    lineHeight: number;
  },
  config: {
    overlayBackgroundType?: 'gradient' | 'solid' | 'blur' | 'shape' | 'none';
    overlayBackgroundColor?: string;
    overlayBackgroundOpacity?: number;
    overlayBackgroundShape?: 'rectangle' | 'rounded' | 'pill' | 'circle';
    overlayBackgroundPadding?: number;
    textAnchor: 'start' | 'middle' | 'end';
  },
  imageWidth: number,
  imageHeight: number
): string => {
  const overlayType = config.overlayBackgroundType || 'none';
  if (overlayType === 'none' || !config.overlayBackgroundColor) {
        return '';
      }
      
  const padding = config.overlayBackgroundPadding || 30;
  const overlayWidth = element.width + (padding * 2);
  const overlayHeight = element.height + (padding * 2);
      
  // Calculate overlay position (centered on text, matching frontend)
  // element.x is the center X position, element.y is first line baseline
  // Center Y of text = element.y - lineHeight + (height / 2)
  const centerY = element.y - element.lineHeight + (element.height / 2);
  
      let overlayX: number;
  if (config.textAnchor === 'start') {
    // For start anchor, element.x is the start position
    overlayX = element.x - padding;
  } else if (config.textAnchor === 'end') {
    // For end anchor, element.x is the end position
    overlayX = element.x - overlayWidth + padding;
      } else {
    // For middle anchor, element.x is the center position
    overlayX = element.x - (overlayWidth / 2);
  }
  
  // Position overlay centered vertically on text
  const overlayY = centerY - (overlayHeight / 2);
      
  const bgColor = config.overlayBackgroundColor;
  const bgOpacity = config.overlayBackgroundOpacity !== undefined ? config.overlayBackgroundOpacity : 0.5;
  const shape = config.overlayBackgroundShape || 'rounded';
      
  // Calculate corner radius
      let rx = 0;
      if (shape === 'rounded') {
        rx = 12;
      } else if (shape === 'pill') {
        rx = overlayHeight / 2;
      } else if (shape === 'circle') {
        const size = Math.min(overlayWidth, overlayHeight);
        return `<circle cx="${overlayX + overlayWidth / 2}" cy="${overlayY + overlayHeight / 2}" r="${size / 2}" fill="${bgColor}" opacity="${bgOpacity}"/>`;
      }
      
      if (overlayType === 'gradient') {
    const gradientId = `overlayGradient_${Math.random().toString(36).substr(2, 9)}`;
        const gradientDef = `<defs>
    <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:${bgColor};stop-opacity:${bgOpacity * 0.8}" />
      <stop offset="100%" style="stop-color:${bgColor};stop-opacity:${bgOpacity}" />
    </linearGradient>
  </defs>`;
        
        return `${gradientDef}
  <rect x="${overlayX}" y="${overlayY}" width="${overlayWidth}" height="${overlayHeight}" rx="${rx}" fill="url(#${gradientId})"/>`;
      } else if (overlayType === 'blur') {
    const blurFilterId = `overlayBlur_${Math.random().toString(36).substr(2, 9)}`;
        const blurDef = `<defs>
    <filter id="${blurFilterId}" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="10"/>
    </filter>
  </defs>`;
        return `${blurDef}
  <rect x="${overlayX}" y="${overlayY}" width="${overlayWidth}" height="${overlayHeight}" rx="${rx}" fill="${bgColor}" opacity="${bgOpacity}" filter="url(#${blurFilterId})"/>`;
      } else {
        return `<rect x="${overlayX}" y="${overlayY}" width="${overlayWidth}" height="${overlayHeight}" rx="${rx}" fill="${bgColor}" opacity="${bgOpacity}"/>`;
      }
    };
    
/**
 * Generate SVG text elements for lines
 */
const generateTextElements = (
  lines: string[],
  xPos: number,
  startY: number,
  fontSize: number,
  lineHeight: number,
  fontWeight: string,
  opacity: number,
  color: string,
  anchor: 'start' | 'middle' | 'end',
  fontFamily: string,
  letterSpacing: string
): string => {
  const escapeXml = (text: string) => {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  };
  
      return lines.map((line, index) => {
        const yPos = startY + (index * lineHeight);
    const escapedLine = escapeXml(line);
        return `<text
    x="${xPos}"
    y="${yPos}"
    font-family="${fontFamily}"
    font-size="${fontSize}"
    font-weight="${fontWeight}"
    fill="${color}"
    text-anchor="${anchor}"
    letter-spacing="${letterSpacing}"
    opacity="${opacity}"
    filter="url(#textShadow)"
  >${escapedLine}</text>`;
      }).join('\n  ');
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
    
    const title = overlayConfig.title || '';
    const subtitle = overlayConfig.subtitle || '';
    
    if (!title && !subtitle) {
      throw new Error('At least one of title or subtitle is required');
    }
    
    // Process title if present
    let titleElement: {
      lines: string[];
      x: number;
      y: number;
      width: number;
      height: number;
      lineHeight: number;
    } | null = null;
    
    if (title) {
      const titleText = transformText(title, overlayConfig.title_font_transform);
      // Use percentage-based font size with backward compatibility
      const titleFontSize = normalizeFontSize(overlayConfig.title_font_size, width, true);
      const titleFontFamily = getFontFamily(overlayConfig.title_font_family);
      const titleFontWeight = overlayConfig.title_font_weight === 'bold' ? '700' : 
                             overlayConfig.title_font_weight === 'light' ? '300' : '400';
      const titleLetterSpacing = overlayConfig.title_letter_spacing === 'wide' ? '0.15em' : 'normal';
      
      // Use pre-calculated lines from frontend if available (already transformed), otherwise calculate
      const titleLines = overlayConfig.title_lines && overlayConfig.title_lines.length > 0
        ? overlayConfig.title_lines  // Use lines as-is, they're already transformed by frontend
        : undefined;
      
      titleElement = calculateTextElement(
        titleText,
        {
          fontFamily: titleFontFamily,
          fontWeight: titleFontWeight,
          fontSize: titleFontSize,
          maxWidthPercent: overlayConfig.title_max_width_percent,
          xPercent: overlayConfig.title_x_percent,
          yPercent: overlayConfig.title_y_percent,
          textAnchor: overlayConfig.title_text_anchor,
          fontWeightValue: overlayConfig.title_font_weight
        },
        width,
        height,
        titleLines
      );
    }
    
    // Process subtitle if present
    let subtitleElement: {
      lines: string[];
      x: number;
      y: number;
      width: number;
      height: number;
      lineHeight: number;
    } | null = null;
    
    if (subtitle) {
      const subtitleText = transformText(subtitle, overlayConfig.subtitle_font_transform);
      // Use percentage-based font size with backward compatibility
      const subtitleFontSize = normalizeFontSize(overlayConfig.subtitle_font_size, width, false);
      const subtitleFontFamily = getFontFamily(overlayConfig.subtitle_font_family);
      const subtitleFontWeight = overlayConfig.subtitle_font_weight === 'bold' ? '700' : 
                                 overlayConfig.subtitle_font_weight === 'light' ? '300' : '400';
      const subtitleLetterSpacing = overlayConfig.subtitle_letter_spacing === 'wide' ? '0.15em' : 'normal';
      
      // Use pre-calculated lines from frontend if available (already transformed), otherwise calculate
      const subtitleLines = overlayConfig.subtitle_lines && overlayConfig.subtitle_lines.length > 0
        ? overlayConfig.subtitle_lines  // Use lines as-is, they're already transformed by frontend
        : undefined;
      
      subtitleElement = calculateTextElement(
        subtitleText,
        {
          fontFamily: subtitleFontFamily,
          fontWeight: subtitleFontWeight,
          fontSize: subtitleFontSize,
          maxWidthPercent: overlayConfig.subtitle_max_width_percent,
          xPercent: overlayConfig.subtitle_x_percent,
          yPercent: overlayConfig.subtitle_y_percent,
          textAnchor: overlayConfig.subtitle_text_anchor,
          fontWeightValue: overlayConfig.subtitle_font_weight
        },
        width,
        height,
        subtitleLines
      );
    }
    
    // Generate overlay backgrounds independently
    const titleBackground = titleElement ? generateElementOverlayBackground(
      titleElement,
      {
        overlayBackgroundType: overlayConfig.title_overlay_background_type,
        overlayBackgroundColor: overlayConfig.title_overlay_background_color,
        overlayBackgroundOpacity: overlayConfig.title_overlay_background_opacity,
        overlayBackgroundShape: overlayConfig.title_overlay_background_shape,
        overlayBackgroundPadding: overlayConfig.title_overlay_background_padding,
        textAnchor: overlayConfig.title_text_anchor
      },
      width,
      height
    ) : '';
    
    const subtitleBackground = subtitleElement ? generateElementOverlayBackground(
      subtitleElement,
      {
        overlayBackgroundType: overlayConfig.subtitle_overlay_background_type,
        overlayBackgroundColor: overlayConfig.subtitle_overlay_background_color,
        overlayBackgroundOpacity: overlayConfig.subtitle_overlay_background_opacity,
        overlayBackgroundShape: overlayConfig.subtitle_overlay_background_shape,
        overlayBackgroundPadding: overlayConfig.subtitle_overlay_background_padding,
        textAnchor: overlayConfig.subtitle_text_anchor
      },
      width,
      height
    ) : '';
    
    // Generate text elements
    const titleFontFamily = titleElement ? getFontFamily(overlayConfig.title_font_family) : '';
    const titleFontWeight = titleElement ? (overlayConfig.title_font_weight === 'bold' ? '700' : 
                                            overlayConfig.title_font_weight === 'light' ? '300' : '400') : '';
    const titleLetterSpacing = titleElement ? (overlayConfig.title_letter_spacing === 'wide' ? '0.15em' : 'normal') : '';
    const titleTextElements = titleElement ? generateTextElements(
      titleElement.lines,
      titleElement.x,
      titleElement.y,
      normalizeFontSize(overlayConfig.title_font_size, width, true),
      titleElement.lineHeight,
      titleFontWeight,
      overlayConfig.title_opacity,
      overlayConfig.title_color_hex,
      overlayConfig.title_text_anchor,
      titleFontFamily,
      titleLetterSpacing
    ) : '';
    
    const subtitleFontFamily = subtitleElement ? getFontFamily(overlayConfig.subtitle_font_family) : '';
    const subtitleFontWeight = subtitleElement ? (overlayConfig.subtitle_font_weight === 'bold' ? '700' : 
                                                  overlayConfig.subtitle_font_weight === 'light' ? '300' : '400') : '';
    const subtitleLetterSpacing = subtitleElement ? (overlayConfig.subtitle_letter_spacing === 'wide' ? '0.15em' : 'normal') : '';
    const subtitleTextElements = subtitleElement ? generateTextElements(
      subtitleElement.lines,
      subtitleElement.x,
      subtitleElement.y,
      normalizeFontSize(overlayConfig.subtitle_font_size, width, false),
      subtitleElement.lineHeight,
      subtitleFontWeight,
      overlayConfig.subtitle_opacity,
      overlayConfig.subtitle_color_hex,
      overlayConfig.subtitle_text_anchor,
      subtitleFontFamily,
      subtitleLetterSpacing
    ) : '';
    
    // Create SVG
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
  ${titleBackground}
  ${subtitleBackground}
  ${titleTextElements}
  ${subtitleTextElements}
</svg>`;
    
    // Render SVG to PNG buffer
    const svgBuffer = Buffer.from(svgText);
    
    try {
      const svgImage = sharp(svgBuffer, { density: 300 });
      const svgRendered = await svgImage
        .resize(width, height, { fit: 'fill' })
        .png()
        .toBuffer();
      
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

/**
 * Optimize image compression before storing
 * Converts images to WebP format for better compression
 */
export const optimizeImage = async (
  imageBase64: string,
  quality: number = 85
): Promise<string> => {
  try {
    const base64Data = imageBase64.includes(',') 
      ? imageBase64.split(',')[1] 
      : imageBase64;
    const imageBuffer = Buffer.from(base64Data, 'base64');
    
    // Get image metadata
    const metadata = await sharp(imageBuffer).metadata();
    const format = metadata.format || 'png';
    
    let optimizedBuffer: Buffer;
    
    // Convert to WebP for better compression (smaller file size)
    // WebP is supported by all modern browsers
    optimizedBuffer = await sharp(imageBuffer)
      .webp({ quality, effort: 6 })
      .toBuffer();
    
    return bufferToBase64(optimizedBuffer, 'image/webp');
  } catch (error) {
    console.warn('[Image Optimization] Failed to optimize, using original:', error);
    // Return original if optimization fails
    return imageBase64;
  }
};

/**
 * Generate thumbnail version of image for list views
 * Creates a smaller, optimized version for faster loading
 */
export const generateThumbnail = async (
  imageBase64: string,
  width: number = 300,
  height: number = 300
): Promise<string> => {
  try {
    const base64Data = imageBase64.includes(',') 
      ? imageBase64.split(',')[1] 
      : imageBase64;
    const imageBuffer = Buffer.from(base64Data, 'base64');
    
    const thumbnailBuffer = await sharp(imageBuffer)
      .resize(width, height, { 
        fit: 'cover',
        withoutEnlargement: true,
        position: 'center'
      })
      .webp({ quality: 75, effort: 6 })
      .toBuffer();
    
    return bufferToBase64(thumbnailBuffer, 'image/webp');
  } catch (error) {
    console.warn('[Thumbnail] Failed to generate thumbnail, using original:', error);
    return imageBase64;
  }
};
