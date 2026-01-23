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
const getFontFamily = (family: 'sans-serif' | 'serif' | 'cursive' | 'handwritten'): string => {
  switch (family) {
    case 'serif':
      return 'DejaVu Serif, Liberation Serif, serif';
    case 'cursive':
    case 'handwritten':
      return 'DejaVu Serif, Liberation Serif, serif';
    case 'sans-serif':
    default:
      return 'DejaVu Sans, Liberation Sans, sans-serif';
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
  maxLines: number,
  fontWeight: 'light' | 'regular' | 'bold'
): string[] => {
  // First, split by manual line breaks
  const manualLines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  // If we have manual line breaks, use them (but respect maxLines)
  if (manualLines.length > 1) {
    return manualLines.slice(0, maxLines);
  }
  
  // Otherwise, auto-wrap the text
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  
  const charWidthMultiplier = fontWeight === 'bold' ? 0.7 : 0.6;
  
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const estimatedWidth = testLine.length * fontSize * charWidthMultiplier;
    
    if (estimatedWidth <= maxWidth || currentLine === '') {
      currentLine = testLine;
    } else {
      if (lines.length < maxLines - 1) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        // Last line - add ellipsis if needed
        const lastLine = currentLine + ' ' + word;
        if (lastLine.length * fontSize * charWidthMultiplier > maxWidth) {
          currentLine = currentLine + '...';
        } else {
          currentLine = lastLine;
        }
        break;
      }
    }
  }
  
  if (currentLine) {
    lines.push(currentLine);
  }
  
  return lines.slice(0, maxLines);
};

/**
 * Calculate text dimensions and position for a single text element
 */
const calculateTextElement = (
  text: string,
  config: {
    fontFamily: string;
    fontWeight: string;
    fontSize: number;
    maxWidthPercent: number;
    maxLines: number;
    xPercent: number;
    yPercent: number;
    textAnchor: 'start' | 'middle' | 'end';
    fontWeightValue: 'light' | 'regular' | 'bold';
  },
  imageWidth: number,
  imageHeight: number
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
  
  const lines = processTextLines(text, config.fontSize, maxWidth, config.maxLines, config.fontWeightValue);
  const height = lines.length * lineHeight;
  
  // Calculate width from longest line
  const charWidthMultiplier = config.fontWeightValue === 'bold' ? 0.7 : 0.6;
  const width = Math.max(...lines.map(line => line.length * config.fontSize * charWidthMultiplier));
  
  // Calculate position
  const requestedX = (imageWidth * config.xPercent) / 100;
  const requestedY = (imageHeight * config.yPercent) / 100;
  
  const padding = Math.max(30, Math.min(imageWidth, imageHeight) * 0.03);
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  
  // Clamp X position based on anchor
  let x: number;
  if (config.textAnchor === 'start') {
    x = Math.max(padding, Math.min(requestedX, imageWidth - width - padding));
  } else if (config.textAnchor === 'end') {
    x = Math.max(width + padding, Math.min(requestedX, imageWidth - padding));
  } else {
    x = Math.max(halfWidth + padding, Math.min(requestedX, imageWidth - halfWidth - padding));
  }
  
  // Clamp Y position
  const y = Math.max(halfHeight + padding, Math.min(requestedY, imageHeight - halfHeight - padding));
  
  // Convert center Y to first line Y position
  const firstLineY = y - (height / 2) + lineHeight;
  
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
  const overlayWidth = Math.min(element.width + (padding * 2), imageWidth * 0.9);
  const overlayHeight = element.height + (padding * 2);
  
  // Calculate overlay position
  let overlayX: number;
  if (config.textAnchor === 'start') {
    overlayX = element.x - padding;
  } else if (config.textAnchor === 'end') {
    overlayX = element.x - overlayWidth + padding;
  } else {
    overlayX = element.x - (overlayWidth / 2);
  }
  
  // Clamp overlay position
  const imagePadding = Math.max(30, Math.min(imageWidth, imageHeight) * 0.03);
  overlayX = Math.max(imagePadding, Math.min(overlayX, imageWidth - overlayWidth - imagePadding));
  const centerY = element.y + (element.height / 2) - element.lineHeight;
  const overlayY = centerY - (overlayHeight / 2);
  const clampedOverlayY = Math.max(imagePadding, Math.min(overlayY, imageHeight - overlayHeight - imagePadding));
  
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
    return `<circle cx="${overlayX + overlayWidth / 2}" cy="${clampedOverlayY + overlayHeight / 2}" r="${size / 2}" fill="${bgColor}" opacity="${bgOpacity}"/>`;
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
  <rect x="${overlayX}" y="${clampedOverlayY}" width="${overlayWidth}" height="${overlayHeight}" rx="${rx}" fill="url(#${gradientId})"/>`;
  } else if (overlayType === 'blur') {
    const blurFilterId = `overlayBlur_${Math.random().toString(36).substr(2, 9)}`;
    const blurDef = `<defs>
    <filter id="${blurFilterId}" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="10"/>
    </filter>
  </defs>`;
    return `${blurDef}
  <rect x="${overlayX}" y="${clampedOverlayY}" width="${overlayWidth}" height="${overlayHeight}" rx="${rx}" fill="${bgColor}" opacity="${bgOpacity}" filter="url(#${blurFilterId})"/>`;
  } else {
    return `<rect x="${overlayX}" y="${clampedOverlayY}" width="${overlayWidth}" height="${overlayHeight}" rx="${rx}" fill="${bgColor}" opacity="${bgOpacity}"/>`;
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
      const titleFontSize = overlayConfig.title_font_size || Math.max(56, Math.min(width / 10, 120));
      const titleFontFamily = getFontFamily(overlayConfig.title_font_family);
      const titleFontWeight = overlayConfig.title_font_weight === 'bold' ? '700' : 
                             overlayConfig.title_font_weight === 'light' ? '300' : '400';
      const titleLetterSpacing = overlayConfig.title_letter_spacing === 'wide' ? '0.15em' : 'normal';
      
      titleElement = calculateTextElement(
        titleText,
        {
          fontFamily: titleFontFamily,
          fontWeight: titleFontWeight,
          fontSize: titleFontSize,
          maxWidthPercent: overlayConfig.title_max_width_percent,
          maxLines: overlayConfig.title_max_lines || 3,
          xPercent: overlayConfig.title_x_percent,
          yPercent: overlayConfig.title_y_percent,
          textAnchor: overlayConfig.title_text_anchor,
          fontWeightValue: overlayConfig.title_font_weight
        },
        width,
        height
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
      const subtitleFontSize = overlayConfig.subtitle_font_size || Math.max(32, Math.min(width / 16, 64));
      const subtitleFontFamily = getFontFamily(overlayConfig.subtitle_font_family);
      const subtitleFontWeight = overlayConfig.subtitle_font_weight === 'bold' ? '700' : 
                                 overlayConfig.subtitle_font_weight === 'light' ? '300' : '400';
      const subtitleLetterSpacing = overlayConfig.subtitle_letter_spacing === 'wide' ? '0.15em' : 'normal';
      
      subtitleElement = calculateTextElement(
        subtitleText,
        {
          fontFamily: subtitleFontFamily,
          fontWeight: subtitleFontWeight,
          fontSize: subtitleFontSize,
          maxWidthPercent: overlayConfig.subtitle_max_width_percent,
          maxLines: overlayConfig.subtitle_max_lines || 3,
          xPercent: overlayConfig.subtitle_x_percent,
          yPercent: overlayConfig.subtitle_y_percent,
          textAnchor: overlayConfig.subtitle_text_anchor,
          fontWeightValue: overlayConfig.subtitle_font_weight
        },
        width,
        height
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
      overlayConfig.title_font_size || Math.max(56, Math.min(width / 10, 120)),
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
      overlayConfig.subtitle_font_size || Math.max(32, Math.min(width / 16, 64)),
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
