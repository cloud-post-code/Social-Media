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
 * Using fonts that are installed on the Linux server via Dockerfile
 * Installed fonts: DejaVu Sans, DejaVu Serif, Liberation Sans, Liberation Serif, Noto Sans, Noto Serif
 */
const getFontFamily = (family: OverlayConfig['font_family']): string => {
  switch (family) {
    case 'serif':
      // Use DejaVu Serif or Liberation Serif (both installed)
      return 'DejaVu Serif, Liberation Serif, serif';
    case 'cursive':
    case 'handwritten':
      // Use serif fonts for cursive/handwritten (closest match with installed fonts)
      return 'DejaVu Serif, Liberation Serif, serif';
    case 'sans-serif':
    default:
      // Use DejaVu Sans or Liberation Sans (both installed)
      return 'DejaVu Sans, Liberation Sans, sans-serif';
  }
};

/**
 * Calculate text position based on position string
 */
const calculatePosition = (
  position: string | undefined,
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
  
  const pos = position || 'center-middle';
  
  // Horizontal positioning
  if (pos.includes('left')) {
    x = padding;
  } else if (pos.includes('right')) {
    x = imageWidth - Math.min(textWidth, actualMaxWidth) - padding;
  } else if (pos.includes('center') || pos.includes('middle')) {
    // center
    x = (imageWidth - Math.min(textWidth, actualMaxWidth)) / 2;
  } else {
    // Default to center
    x = (imageWidth - Math.min(textWidth, actualMaxWidth)) / 2;
  }
  
  // Vertical positioning
  if (pos.includes('top')) {
    y = padding;
  } else if (pos.includes('bottom')) {
    y = imageHeight - textHeight - padding;
  } else if (pos.includes('middle') || pos.includes('center')) {
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
    // Use separate colors for title and subtitle, fallback to text_color_hex for backward compatibility
    const titleColor = overlayConfig.title_color_hex || overlayConfig.text_color_hex;
    const subtitleColor = overlayConfig.subtitle_color_hex || overlayConfig.text_color_hex;
    const opacity = overlayConfig.opacity !== undefined ? overlayConfig.opacity : 1.0;
    const letterSpacing = overlayConfig.letter_spacing === 'wide' ? '0.15em' : 'normal';
    
    // Font sizes - use custom sizes if provided, otherwise auto-calculate
    const titleFontSize = overlayConfig.title_font_size || Math.max(56, Math.min(width / 10, 120));
    const subtitleFontSize = overlayConfig.subtitle_font_size || Math.max(32, Math.min(width / 16, 64));
    const lineSpacing = subtitleFontSize * 0.3; // Space between title and subtitle
    const titleLineHeight = titleFontSize * 1.2; // Line height for title
    const subtitleLineHeight = subtitleFontSize * 1.2; // Line height for subtitle
    
    // Strip markdown syntax from text
    const stripMarkdown = (text: string): string => {
      return text
        .replace(/\*\*(.*?)\*\*/g, '$1')  // Remove **bold**
        .replace(/\*(.*?)\*/g, '$1')       // Remove *italic*
        .replace(/__(.*?)__/g, '$1')       // Remove __bold__
        .replace(/_(.*?)_/g, '$1')         // Remove _italic_
        .replace(/~~(.*?)~~/g, '$1')       // Remove ~~strikethrough~~
        .replace(/`(.*?)`/g, '$1')         // Remove `code`
        .trim();
    };
    
    // Handle text transform and strip markdown
    const transformText = (text: string) => {
      // First strip markdown syntax
      let cleaned = stripMarkdown(text);
      
      // Then apply text transform
      if (overlayConfig.font_transform === 'uppercase') {
        return cleaned.toUpperCase();
      } else if (overlayConfig.font_transform === 'lowercase') {
        return cleaned.toLowerCase();
      } else if (overlayConfig.font_transform === 'capitalize') {
        return cleaned.split(' ').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');
      }
      return cleaned;
    };
    
    const titleText = transformText(title);
    const subtitleText = subtitle ? transformText(subtitle) : '';
    
    // Function to split text by manual line breaks (\n) and then wrap if needed
    const processTextLines = (text: string, fontSize: number, maxWidth: number, maxLines: number): string[] => {
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
      
      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        // Estimate width: approximate character width based on font size
        const charWidthMultiplier = overlayConfig.font_weight === 'bold' ? 0.7 : 0.6;
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
    
    // Process text into lines (respecting manual line breaks)
    const maxTitleLines = overlayConfig.title_max_lines || 3; // Increased default to allow more lines
    const maxSubtitleLines = overlayConfig.subtitle_max_lines || 3; // Increased default
    const maxWidth = (width * overlayConfig.max_width_percent) / 100;
    const titleLines = processTextLines(titleText, titleFontSize, maxWidth, maxTitleLines);
    const subtitleLines = subtitleText ? processTextLines(subtitleText, subtitleFontSize, maxWidth, maxSubtitleLines) : [];
    
    // Calculate total text height including all lines
    const titleHeight = titleLines.length * titleLineHeight;
    const subtitleHeight = subtitleLines.length * subtitleLineHeight;
    const totalTextHeight = titleHeight + (subtitleLines.length > 0 ? (lineSpacing + subtitleHeight) : 0);
    
    // Calculate position - estimate max text width from longest line
    const charWidthMultiplier = overlayConfig.font_weight === 'bold' ? 0.7 : 0.6;
    const maxTitleLineWidth = Math.max(...titleLines.map(line => line.length * titleFontSize * charWidthMultiplier));
    const maxSubtitleLineWidth = subtitleLines.length > 0 
      ? Math.max(...subtitleLines.map(line => line.length * subtitleFontSize * charWidthMultiplier))
      : 0;
    const maxTextWidth = Math.max(maxTitleLineWidth, maxSubtitleLineWidth);
    const actualMaxWidth = Math.min(maxTextWidth, (width * overlayConfig.max_width_percent) / 100);
    
    // Use pixel-based positioning if provided, otherwise fall back to string-based
    let titleX: number;
    let titleY: number;
    let subtitleX: number;
    let subtitleY: number;
    let textAnchor: 'start' | 'middle' | 'end';
    let titleTextAnchor: 'start' | 'middle' | 'end';
    let subtitleTextAnchor: 'start' | 'middle' | 'end';
    
    // Check if separate positions are provided for title and subtitle
    const hasSeparatePositions = overlayConfig.title_x_percent !== undefined && 
                                  overlayConfig.title_y_percent !== undefined &&
                                  overlayConfig.subtitle_x_percent !== undefined && 
                                  overlayConfig.subtitle_y_percent !== undefined;
    
    // Boundary validation helper
    const padding = Math.max(30, Math.min(width, height) * 0.03);
    const clampPosition = (requestedX: number, requestedY: number, textWidth: number, textHeight: number, anchor: 'start' | 'middle' | 'end') => {
      const halfTextWidth = textWidth / 2;
      const halfTextHeight = textHeight / 2;
      
      let clampedX: number;
      if (anchor === 'start') {
        clampedX = Math.max(padding, Math.min(requestedX, width - textWidth - padding));
      } else if (anchor === 'end') {
        clampedX = Math.max(textWidth + padding, Math.min(requestedX, width - padding));
      } else {
        clampedX = Math.max(halfTextWidth + padding, Math.min(requestedX, width - halfTextWidth - padding));
      }
      
      const clampedY = Math.max(halfTextHeight + padding, Math.min(requestedY, height - halfTextHeight - padding));
      return { x: clampedX, y: clampedY };
    };
    
    if (hasSeparatePositions) {
      // Use separate positions for title and subtitle
      const titleRequestedX = (width * overlayConfig.title_x_percent!) / 100;
      const titleRequestedY = (height * overlayConfig.title_y_percent!) / 100;
      const subtitleRequestedX = (width * overlayConfig.subtitle_x_percent!) / 100;
      const subtitleRequestedY = (height * overlayConfig.subtitle_y_percent!) / 100;
      
      titleTextAnchor = overlayConfig.title_text_anchor || overlayConfig.text_anchor || 'middle';
      subtitleTextAnchor = overlayConfig.subtitle_text_anchor || overlayConfig.text_anchor || 'middle';
      textAnchor = overlayConfig.text_anchor || 'middle';
      
      // Calculate title width and height for boundary validation
      const titleMaxWidth = (width * overlayConfig.max_width_percent) / 100;
      // titleY represents the center anchor point, convert to first line Y position
      const titleCenterY = titleRequestedY;
      const titleClamped = clampPosition(titleRequestedX, titleCenterY, Math.min(titleMaxWidth, maxTitleLineWidth), titleHeight, titleTextAnchor);
      titleX = titleClamped.x;
      // Convert center Y to first line Y position (center - half height + line height)
      titleY = titleClamped.y - (titleHeight / 2) + titleLineHeight;
      
      // Calculate subtitle width and height for boundary validation
      const subtitleMaxWidth = (width * overlayConfig.max_width_percent) / 100;
      // subtitleY represents the center anchor point, convert to first line Y position
      const subtitleCenterY = subtitleRequestedY;
      const subtitleClamped = clampPosition(subtitleRequestedX, subtitleCenterY, Math.min(subtitleMaxWidth, maxSubtitleLineWidth), subtitleHeight, subtitleTextAnchor);
      subtitleX = subtitleClamped.x;
      // Convert center Y to first line Y position (center - half height + line height)
      subtitleY = subtitleClamped.y - (subtitleHeight / 2) + subtitleLineHeight;
    } else if (overlayConfig.x_percent !== undefined && overlayConfig.y_percent !== undefined) {
      // Use legacy pixel-based positioning (single position for both)
      const requestedX = (width * overlayConfig.x_percent) / 100;
      const requestedY = (height * overlayConfig.y_percent) / 100;
      textAnchor = overlayConfig.text_anchor || 'middle';
      titleTextAnchor = overlayConfig.title_text_anchor || overlayConfig.text_anchor || 'middle';
      subtitleTextAnchor = overlayConfig.subtitle_text_anchor || overlayConfig.text_anchor || 'middle';
      
      const halfTextWidth = actualMaxWidth / 2;
      const halfTextHeight = totalTextHeight / 2;
      
      // Adjust X based on title text anchor (primary anchor) to keep text within bounds
      const anchorForBounds = titleTextAnchor;
      if (anchorForBounds === 'start') {
        titleX = Math.max(padding, Math.min(requestedX, width - actualMaxWidth - padding));
      } else if (anchorForBounds === 'end') {
        titleX = Math.max(actualMaxWidth + padding, Math.min(requestedX, width - padding));
      } else {
        titleX = Math.max(halfTextWidth + padding, Math.min(requestedX, width - halfTextWidth - padding));
      }
      
      // Use same X for subtitle
      subtitleX = titleX;
      
      // Adjust Y to keep text within bounds
      const y = Math.max(halfTextHeight + padding, Math.min(requestedY, height - halfTextHeight - padding));
      
      // Position title and subtitle relative to the anchor point
      titleY = y - (totalTextHeight / 2) + titleLineHeight;
      subtitleY = titleY + titleHeight + lineSpacing + subtitleLineHeight;
    } else {
      // Fall back to string-based positioning (legacy)
      const positionResult = calculatePosition(
        overlayConfig.position || 'center-middle',
        width,
        height,
        maxTextWidth,
        totalTextHeight,
        overlayConfig.max_width_percent
      );
      titleX = positionResult.x;
      subtitleX = positionResult.x;
      
      if (overlayConfig.position === 'floating-center') {
        titleX = width / 2;
        subtitleX = width / 2;
      }
      
      textAnchor = overlayConfig.position?.includes('right') 
        ? 'end' 
        : overlayConfig.position?.includes('left') 
        ? 'start' 
        : 'middle';
      titleTextAnchor = overlayConfig.title_text_anchor || textAnchor;
      subtitleTextAnchor = overlayConfig.subtitle_text_anchor || textAnchor;
      
      const y = overlayConfig.position === 'floating-center' ? height / 2 : positionResult.y;
      
      // Calculate Y positions based on position string
      const position = overlayConfig.position || 'center-middle';
      if (position.includes('top')) {
        titleY = y + titleLineHeight;
        subtitleY = titleY + titleHeight + lineSpacing + subtitleLineHeight;
      } else if (position.includes('bottom')) {
        subtitleY = y - subtitleHeight + subtitleLineHeight;
        titleY = subtitleY - lineSpacing - titleHeight + titleLineHeight;
      } else {
        // Center - position title in middle, subtitle below
        const centerY = position === 'floating-center' ? height / 2 : y;
        titleY = centerY - (subtitleLines.length > 0 ? (lineSpacing + subtitleHeight) / 2 : 0) - titleHeight / 2 + titleLineHeight;
        subtitleY = titleY + titleHeight + lineSpacing + subtitleLineHeight;
      }
    }
    
    // Calculate Y positions for title and subtitle (accounting for multiple lines)
    // titleY and subtitleY are now the anchor points (middle of first line)
    let titleStartY = titleY;
    let subtitleStartY = subtitleY;
    
    // Escape XML special characters
    const escapeXml = (text: string) => {
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    };
    
    // Escape each line
    const escapedTitleLines = titleLines.map(line => escapeXml(line));
    const escapedSubtitleLines = subtitleLines.map(line => escapeXml(line));
    
    // Generate overlay background elements if configured
    const generateOverlayBackground = (): string => {
      const overlayType = overlayConfig.overlay_background_type || 'none';
      if (overlayType === 'none' || !overlayConfig.overlay_background_color) {
        return '';
      }
      
      // Calculate text bounding box
      const padding = overlayConfig.overlay_background_padding || 30;
      const charWidthMultiplier = overlayConfig.font_weight === 'bold' ? 0.7 : 0.6;
      const maxTitleLineWidth = Math.max(...titleLines.map(line => line.length * titleFontSize * charWidthMultiplier));
      const maxSubtitleLineWidth = subtitleLines.length > 0 
        ? Math.max(...subtitleLines.map(line => line.length * subtitleFontSize * charWidthMultiplier))
        : 0;
      const textWidth = Math.max(maxTitleLineWidth, maxSubtitleLineWidth);
      const textHeight = totalTextHeight;
      
      // Calculate overlay dimensions
      const overlayWidth = Math.min(textWidth + (padding * 2), width * 0.9);
      const overlayHeight = textHeight + (padding * 2);
      
      // Calculate overlay position (centered on text)
      let overlayX: number;
      if (titleTextAnchor === 'start') {
        overlayX = titleX - padding;
      } else if (titleTextAnchor === 'end') {
        overlayX = titleX - overlayWidth + padding;
      } else {
        overlayX = titleX - (overlayWidth / 2);
      }
      
      // Ensure overlay stays within image bounds
      overlayX = Math.max(padding, Math.min(overlayX, width - overlayWidth - padding));
      const overlayY = Math.min(titleStartY, subtitleStartY || titleStartY) - padding - (textHeight / 2);
      const clampedOverlayY = Math.max(padding, Math.min(overlayY, height - overlayHeight - padding));
      
      const bgColor = overlayConfig.overlay_background_color;
      const bgOpacity = overlayConfig.overlay_background_opacity !== undefined ? overlayConfig.overlay_background_opacity : 0.5;
      const shape = overlayConfig.overlay_background_shape || 'rounded';
      
      // Calculate corner radius based on shape
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
        // Create gradient definition
        const gradientId = 'overlayGradient';
        const gradientDef = `<defs>
    <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:${bgColor};stop-opacity:${bgOpacity * 0.8}" />
      <stop offset="100%" style="stop-color:${bgColor};stop-opacity:${bgOpacity}" />
    </linearGradient>
  </defs>`;
        
        return `${gradientDef}
  <rect x="${overlayX}" y="${clampedOverlayY}" width="${overlayWidth}" height="${overlayHeight}" rx="${rx}" fill="url(#${gradientId})"/>`;
      } else if (overlayType === 'blur') {
        // For blur, we'll use a semi-transparent background with a filter
        const blurFilterId = 'overlayBlur';
        const blurDef = `<defs>
    <filter id="${blurFilterId}" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="10"/>
    </filter>
  </defs>`;
        return `${blurDef}
  <rect x="${overlayX}" y="${clampedOverlayY}" width="${overlayWidth}" height="${overlayHeight}" rx="${rx}" fill="${bgColor}" opacity="${bgOpacity}" filter="url(#${blurFilterId})"/>`;
      } else {
        // Solid or shape
        return `<rect x="${overlayX}" y="${clampedOverlayY}" width="${overlayWidth}" height="${overlayHeight}" rx="${rx}" fill="${bgColor}" opacity="${bgOpacity}"/>`;
      }
    };
    
    // Generate SVG text elements for each line
    const generateTextElements = (lines: string[], xPos: number, startY: number, fontSize: number, lineHeight: number, fontWeight: string, opacity: number, color: string, anchor: 'start' | 'middle' | 'end') => {
      return lines.map((line, index) => {
        const yPos = startY + (index * lineHeight);
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
  >${line}</text>`;
      }).join('\n  ');
    };
    
    // Generate overlay background
    const overlayBackground = generateOverlayBackground();
    
    // Create SVG with overlay background (if any), then title and subtitle (multiple lines)
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
  ${overlayBackground}
  ${generateTextElements(escapedTitleLines, titleX, titleStartY, titleFontSize, titleLineHeight, fontWeight, opacity, titleColor, titleTextAnchor)}
  ${subtitleLines.length > 0 ? generateTextElements(escapedSubtitleLines, subtitleX, subtitleStartY, subtitleFontSize, subtitleLineHeight, fontWeight === '700' ? '400' : fontWeight, opacity * 0.9, subtitleColor, subtitleTextAnchor) : ''}
</svg>`;
    
    // Debug logging
    console.log('Applying overlay:', {
      title: titleText,
      subtitle: subtitleText,
      titleLines: titleLines.length,
      subtitleLines: subtitleLines.length,
      titleLinesText: titleLines,
      subtitleLinesText: subtitleLines,
      fontFamily,
      fontWeight,
      position: overlayConfig.position,
      color: overlayConfig.text_color_hex,
      titleFontSize,
      subtitleFontSize,
      titleX,
      titleY,
      subtitleX,
      subtitleY,
      titleStartY,
      subtitleStartY,
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

