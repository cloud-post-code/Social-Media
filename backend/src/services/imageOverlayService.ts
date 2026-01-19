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
    
    // Calculate Y positions for title and subtitle (accounting for multiple lines)
    let titleStartY = y;
    let subtitleStartY = y;
    
    if (overlayConfig.position.includes('top')) {
      titleStartY = y + titleLineHeight;
      subtitleStartY = titleStartY + titleHeight + lineSpacing + subtitleLineHeight;
    } else if (overlayConfig.position.includes('bottom')) {
      subtitleStartY = y - subtitleHeight + subtitleLineHeight;
      titleStartY = subtitleStartY - lineSpacing - titleHeight + titleLineHeight;
    } else {
      // Center - position title in middle, subtitle below
      const centerY = overlayConfig.position === 'floating-center' ? height / 2 : y;
      titleStartY = centerY - (subtitleLines.length > 0 ? (lineSpacing + subtitleHeight) / 2 : 0) - titleHeight / 2 + titleLineHeight;
      subtitleStartY = titleStartY + titleHeight + lineSpacing + subtitleLineHeight;
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
    
    // Escape each line
    const escapedTitleLines = titleLines.map(line => escapeXml(line));
    const escapedSubtitleLines = subtitleLines.map(line => escapeXml(line));
    
    // Generate SVG text elements for each line
    const generateTextElements = (lines: string[], startY: number, fontSize: number, lineHeight: number, fontWeight: string, opacity: number) => {
      return lines.map((line, index) => {
        const yPos = startY + (index * lineHeight);
        return `<text
    x="${x}"
    y="${yPos}"
    font-family="${fontFamily}"
    font-size="${fontSize}"
    font-weight="${fontWeight}"
    fill="${textColor}"
    text-anchor="${textAnchor}"
    letter-spacing="${letterSpacing}"
    opacity="${opacity}"
    filter="url(#textShadow)"
  >${line}</text>`;
      }).join('\n  ');
    };
    
    // Create SVG with title and subtitle (multiple lines)
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
  ${generateTextElements(escapedTitleLines, titleStartY, titleFontSize, titleLineHeight, fontWeight, opacity)}
  ${subtitleLines.length > 0 ? generateTextElements(escapedSubtitleLines, subtitleStartY, subtitleFontSize, subtitleLineHeight, fontWeight === '700' ? '400' : fontWeight, opacity * 0.9) : ''}
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
      x,
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

