import React, { useState, useEffect, useRef } from 'react';
import { BrandDNA, GenerationOption, GeneratedAsset } from '../models/types.js';
import { assetApi } from '../services/assetApi.js';

// Utility function to strip markdown syntax from text
const stripMarkdown = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')  // Remove **bold**
    .replace(/\*(.*?)\*/g, '$1')       // Remove *italic*
    .replace(/__(.*?)__/g, '$1')       // Remove __bold__
    .replace(/_(.*?)_/g, '$1')         // Remove _italic_
    .replace(/~~(.*?)~~/g, '$1')       // Remove ~~strikethrough~~
    .replace(/`(.*?)`/g, '$1')         // Remove `code`
    .trim();
};

interface AssetGeneratorProps {
  activeBrand: BrandDNA | null;
  onAssetCreated: (asset: GeneratedAsset) => void;
  initialAsset?: GeneratedAsset | null;
}

const AssetGenerator: React.FC<AssetGeneratorProps> = ({ activeBrand, onAssetCreated, initialAsset }) => {
  const [option, setOption] = useState<GenerationOption>('product');
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState('');
  
  const [productFocus, setProductFocus] = useState('');
  const [userPurpose, setUserPurpose] = useState('');
  const [productImage, setProductImage] = useState<string | null>(null);
  
  const [currentAsset, setCurrentAsset] = useState<GeneratedAsset | null>(null);
  const [feedback, setFeedback] = useState('');
  const [editingOverlay, setEditingOverlay] = useState(false);
  const [overlayEdit, setOverlayEdit] = useState<{
    title?: string;
    subtitle?: string;
    // Title properties - completely separate
    title_font_family?: 'sans-serif' | 'serif' | 'cursive' | 'handwritten';
    title_font_weight?: 'light' | 'regular' | 'bold';
    title_font_transform?: 'uppercase' | 'lowercase' | 'capitalize' | 'none';
    title_letter_spacing?: 'normal' | 'wide';
    title_color_hex?: string;
    title_x_percent?: number;
    title_y_percent?: number;
    title_text_anchor?: 'start' | 'middle' | 'end';
    title_max_width_percent?: number;
    title_opacity?: number;
    title_font_size?: number;
    title_overlay_background_type?: 'gradient' | 'solid' | 'blur' | 'shape' | 'none';
    title_overlay_background_color?: string;
    title_overlay_background_opacity?: number;
    title_overlay_background_shape?: 'rectangle' | 'rounded' | 'pill' | 'circle';
    title_overlay_background_padding?: number;
    // Subtitle properties - completely separate
    subtitle_font_family?: 'sans-serif' | 'serif' | 'cursive' | 'handwritten';
    subtitle_font_weight?: 'light' | 'regular' | 'bold';
    subtitle_font_transform?: 'uppercase' | 'lowercase' | 'capitalize' | 'none';
    subtitle_letter_spacing?: 'normal' | 'wide';
    subtitle_color_hex?: string;
    subtitle_x_percent?: number;
    subtitle_y_percent?: number;
    subtitle_text_anchor?: 'start' | 'middle' | 'end';
    subtitle_max_width_percent?: number;
    subtitle_opacity?: number;
    subtitle_font_size?: number;
    subtitle_overlay_background_type?: 'gradient' | 'solid' | 'blur' | 'shape' | 'none';
    subtitle_overlay_background_color?: string;
    subtitle_overlay_background_opacity?: number;
    subtitle_overlay_background_shape?: 'rectangle' | 'rounded' | 'pill' | 'circle';
    subtitle_overlay_background_padding?: number;
  }>({});
  
  // Image size selector state
  const [imageSizePreset, setImageSizePreset] = useState<'story' | 'square' | 'custom'>('square');
  const [customWidth, setCustomWidth] = useState<number>(1080);
  const [customHeight, setCustomHeight] = useState<number>(1080);
  
  const [eyedropperActive, setEyedropperActive] = useState<'title' | 'subtitle' | null>(null);
  const [dragModeActive, setDragModeActive] = useState(false);
  const [editingText, setEditingText] = useState<'title' | 'subtitle' | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [draggingElement, setDraggingElement] = useState<'title' | 'subtitle' | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [resizingElement, setResizingElement] = useState<'title' | 'subtitle' | null>(null);
  const [resizeHandle, setResizeHandle] = useState<'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w' | null>(null);
  const [resizeStart, setResizeStart] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [editingTextBlock, setEditingTextBlock] = useState<'title' | 'subtitle' | null>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  
  // Store calculated line breaks for preview display
  const [calculatedTitleLines, setCalculatedTitleLines] = useState<string[]>([]);
  const [calculatedSubtitleLines, setCalculatedSubtitleLines] = useState<string[]>([]);
  
  // Compute display asset and image URL from current asset
  const displayAsset = currentAsset;
  const imageUrl = currentAsset?.imageUrl || currentAsset?.image_url || '';
  
  // Load initial asset when provided
  useEffect(() => {
    if (initialAsset) {
      // Convert backend format to frontend format
      const frontendAsset: GeneratedAsset = {
        ...initialAsset,
        imageUrl: initialAsset.image_url || initialAsset.imageUrl,
        brandId: initialAsset.brand_id || initialAsset.brandId,
        campaignImages: initialAsset.campaign_images || initialAsset.campaignImages,
        overlayConfig: initialAsset.overlay_config || initialAsset.overlayConfig,
        baseImageUrl: initialAsset.base_image_url || initialAsset.baseImageUrl,
        userPrompt: initialAsset.user_prompt || initialAsset.userPrompt,
        feedbackHistory: initialAsset.feedback_history || initialAsset.feedbackHistory,
        timestamp: initialAsset.created_at ? new Date(initialAsset.created_at).getTime() : initialAsset.timestamp || Date.now()
      };
      setCurrentAsset(frontendAsset);
      
      // Set the appropriate option based on asset type
      setOption(initialAsset.type || 'product');
    } else if (initialAsset === null) {
      // Reset when explicitly set to null
      setCurrentAsset(null);
    }
  }, [initialAsset]);

  // Get actual image dimensions for accurate font scaling and aspect ratio
  useEffect(() => {
    if (imageUrl) {
      const img = new Image();
      img.onload = () => {
        setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.src = imageUrl;
    }
  }, [imageUrl]);

  // Recalculate line breaks in real-time when text or font properties change
  useEffect(() => {
    if (!editingOverlay || !imageDimensions) return;

    const recalculateLines = async () => {
      // Calculate title lines
      const titleText = overlayEdit.title !== undefined 
        ? overlayEdit.title 
        : (displayAsset?.overlayConfig?.title || '');
      
      if (titleText) {
        const titleMaxWidthPercent = overlayEdit.title_max_width_percent !== undefined
          ? overlayEdit.title_max_width_percent
          : (displayAsset?.overlayConfig?.title_max_width_percent || 80);
        const titleMaxWidthPx = getMaxWidthPixelsNumeric(titleMaxWidthPercent);
        
        const titleFontSize = getFontSizeNumeric(
          overlayEdit.title_font_size !== undefined 
            ? overlayEdit.title_font_size 
            : displayAsset?.overlayConfig?.title_font_size,
          true
        );
        
        const titleFontFamily = overlayEdit.title_font_family || 
          displayAsset?.overlayConfig?.title_font_family || 
          'sans-serif';
        const titleFontWeight = overlayEdit.title_font_weight === 'bold' 
          ? 'bold' 
          : overlayEdit.title_font_weight === 'light' 
            ? '300' 
            : 'normal';
        const titleLetterSpacing = overlayEdit.title_letter_spacing === 'wide' 
          ? '0.15em' 
          : 'normal';
        
        const titleLines = await calculateTextLinesWithCanvas(
          titleText,
          titleMaxWidthPx,
          titleFontSize,
          titleFontFamily,
          titleFontWeight,
          titleLetterSpacing
        );
        
        setCalculatedTitleLines(titleLines);
      } else {
        setCalculatedTitleLines([]);
      }

      // Calculate subtitle lines
      const subtitleText = overlayEdit.subtitle !== undefined 
        ? overlayEdit.subtitle 
        : (displayAsset?.overlayConfig?.subtitle || '');
      
      if (subtitleText) {
        const subtitleMaxWidthPercent = overlayEdit.subtitle_max_width_percent !== undefined
          ? overlayEdit.subtitle_max_width_percent
          : (displayAsset?.overlayConfig?.subtitle_max_width_percent || 80);
        const subtitleMaxWidthPx = getMaxWidthPixelsNumeric(subtitleMaxWidthPercent);
        
        const subtitleFontSize = getFontSizeNumeric(
          overlayEdit.subtitle_font_size !== undefined 
            ? overlayEdit.subtitle_font_size 
            : displayAsset?.overlayConfig?.subtitle_font_size,
          false
        );
        
        const subtitleFontFamily = overlayEdit.subtitle_font_family || 
          displayAsset?.overlayConfig?.subtitle_font_family || 
          'sans-serif';
        const subtitleFontWeight = overlayEdit.subtitle_font_weight === 'bold' 
          ? 'bold' 
          : overlayEdit.subtitle_font_weight === 'light' 
            ? '300' 
            : 'normal';
        const subtitleLetterSpacing = overlayEdit.subtitle_letter_spacing === 'wide' 
          ? '0.15em' 
          : 'normal';
        
        const subtitleLines = await calculateTextLinesWithCanvas(
          subtitleText,
          subtitleMaxWidthPx,
          subtitleFontSize,
          subtitleFontFamily,
          subtitleFontWeight,
          subtitleLetterSpacing
        );
        
        setCalculatedSubtitleLines(subtitleLines);
      } else {
        setCalculatedSubtitleLines([]);
      }
    };

    recalculateLines();
  }, [
    editingOverlay,
    imageDimensions,
    overlayEdit.title,
    overlayEdit.subtitle,
    overlayEdit.title_font_family,
    overlayEdit.title_font_weight,
    overlayEdit.title_font_size,
    overlayEdit.title_letter_spacing,
    overlayEdit.title_max_width_percent,
    overlayEdit.subtitle_font_family,
    overlayEdit.subtitle_font_weight,
    overlayEdit.subtitle_font_size,
    overlayEdit.subtitle_letter_spacing,
    overlayEdit.subtitle_max_width_percent,
    displayAsset?.overlayConfig
  ]);
  
  // Calculate scale factor for font sizes to match preview with actual rendering
  const getFontScale = () => {
    if (!imageDimensions) return 1;
    const container = document.querySelector('.image-preview-container');
    if (!container) return 1;
    const rect = container.getBoundingClientRect();
    // Calculate actual displayed image size (accounting for object-contain)
    const containerAspect = rect.width / rect.height;
    const imageAspect = imageDimensions.width / imageDimensions.height;
    let displayWidth: number;
    let displayHeight: number;
    
    if (imageAspect > containerAspect) {
      // Image is wider - fit to width
      displayWidth = rect.width;
      displayHeight = rect.width / imageAspect;
    } else {
      // Image is taller - fit to height
      displayHeight = rect.height;
      displayWidth = rect.height * imageAspect;
    }
    
    // Scale factor = displayed image size / actual image size
    const scaleX = displayWidth / imageDimensions.width;
    const scaleY = displayHeight / imageDimensions.height;
    return Math.min(scaleX, scaleY); // Use smaller to ensure text fits
  };
  
  // Calculate font size based on actual image dimensions (matching backend logic)
  const getFontSize = (baseFontSize: number | undefined, isTitle: boolean) => {
    const dims = getDisplayedImageDimensions();
    if (!dims || !imageDimensions) {
      return isTitle ? 'clamp(1.5rem, 4vw, 3rem)' : 'clamp(1rem, 2.5vw, 2rem)';
    }
    
    // Calculate font size using the ACTUAL image width (not displayed width) to match backend
    // Backend uses: Math.max(56, Math.min(width / 10, 120)) for title
    // Backend uses: Math.max(32, Math.min(width / 16, 64)) for subtitle
    let calculatedFontSize: number;
    if (baseFontSize) {
      // If custom font size is provided, use it directly (it's already calculated for actual image width)
      calculatedFontSize = baseFontSize;
    } else {
      // Calculate using actual image width (matching backend exactly)
      if (isTitle) {
        calculatedFontSize = Math.max(56, Math.min(imageDimensions.width / 10, 120));
      } else {
        calculatedFontSize = Math.max(32, Math.min(imageDimensions.width / 16, 64));
      }
    }
    
    // Now scale the font size to match the displayed image size
    // This ensures the preview matches what will be rendered
    const scale = dims.displayWidth / imageDimensions.width;
    return `${calculatedFontSize * scale}px`;
  };
  
  // Calculate aspect ratio for the image container
  const getAspectRatioStyle = () => {
    if (!imageDimensions) {
      return { aspectRatio: '1 / 1' }; // Default to square if dimensions not loaded yet
    }
    return { aspectRatio: `${imageDimensions.width} / ${imageDimensions.height}` };
  };
  
  // Get displayed image dimensions (accounting for object-contain letterboxing)
  const getDisplayedImageDimensions = () => {
    if (!imageDimensions || !imageContainerRef.current) {
      return null;
    }
    
    const container = imageContainerRef.current;
    const containerRect = container.getBoundingClientRect();
    const containerAspect = containerRect.width / containerRect.height;
    const imageAspect = imageDimensions.width / imageDimensions.height;
    
    let displayWidth: number;
    let displayHeight: number;
    let offsetX: number;
    let offsetY: number;
    
    if (imageAspect > containerAspect) {
      // Image is wider - fit to width, letterbox top/bottom
      displayWidth = containerRect.width;
      displayHeight = containerRect.width / imageAspect;
      offsetX = 0;
      offsetY = (containerRect.height - displayHeight) / 2;
    } else {
      // Image is taller - fit to height, letterbox left/right
      displayHeight = containerRect.height;
      displayWidth = containerRect.height * imageAspect;
      offsetX = (containerRect.width - displayWidth) / 2;
      offsetY = 0;
    }
    
    return { displayWidth, displayHeight, offsetX, offsetY };
  };

  // Calculate overlay position accounting for actual image display area (letterboxing)
  // xPercent and yPercent are percentages of ACTUAL image dimensions (matching backend)
  // We need to convert to displayed image position for preview
  const getOverlayPosition = (xPercent: number, yPercent: number): React.CSSProperties => {
    const dims = getDisplayedImageDimensions();
    if (!dims || !imageDimensions) {
      return { left: `${xPercent}%`, top: `${yPercent}%`, transform: 'translate(-50%, -50%)' };
    }
    
    // Convert actual image percentage to actual image pixel position
    const actualX = (imageDimensions.width * xPercent) / 100;
    const actualY = (imageDimensions.height * yPercent) / 100;
    
    // Scale to displayed dimensions (accounting for letterboxing)
    const scaleX = dims.displayWidth / imageDimensions.width;
    const scaleY = dims.displayHeight / imageDimensions.height;
    
    // Calculate displayed position
    const displayedX = actualX * scaleX;
    const displayedY = actualY * scaleY;
    
    // Position relative to container
    const left = dims.offsetX + displayedX;
    const top = dims.offsetY + displayedY;
    
    return {
      left: `${left}px`,
      top: `${top}px`,
      transform: 'translate(-50%, -50%)'
    };
  };

  // Calculate max width in pixels based on displayed image width
  const getMaxWidthPixels = (maxWidthPercent: number | undefined) => {
    const dims = getDisplayedImageDimensions();
    if (!dims) {
      return '80%'; // Fallback to percentage if dimensions not available
    }
    const percent = Math.min(maxWidthPercent || 80, 95);
    return `${(dims.displayWidth * percent) / 100}px`;
  };

  // Get numeric pixel value from getMaxWidthPixels for calculations
  const getMaxWidthPixelsNumeric = (maxWidthPercent: number | undefined): number => {
    const dims = getDisplayedImageDimensions();
    if (!dims) {
      return 0;
    }
    const percent = Math.min(maxWidthPercent || 80, 95);
    return (dims.displayWidth * percent) / 100;
  };

  // Get numeric font size for calculations
  const getFontSizeNumeric = (baseFontSize: number | undefined, isTitle: boolean): number => {
    if (!imageDimensions) {
      return isTitle ? 56 : 32;
    }
    
    if (baseFontSize) {
      return baseFontSize;
    }
    
    if (isTitle) {
      return Math.max(56, Math.min(imageDimensions.width / 10, 120));
    } else {
      return Math.max(32, Math.min(imageDimensions.width / 16, 64));
    }
  };

  // Map font family choice to font stack that matches server-side rendering
  // Server uses DejaVu fonts, so we use Arial/Times which have similar metrics
  const getFontStackForMeasurement = (family: 'sans-serif' | 'serif' | 'cursive' | 'handwritten'): string => {
    switch (family) {
      case 'serif':
        // Times New Roman has similar metrics to DejaVu Serif
        return 'Times New Roman, Times, serif';
      case 'cursive':
      case 'handwritten':
        // Use serif fallback for cursive/handwritten
        return 'Times New Roman, Times, serif';
      case 'sans-serif':
      default:
        // Arial has similar metrics to DejaVu Sans
        return 'Arial, Helvetica, sans-serif';
    }
  };

  // Calculate text lines using Canvas API for exact measurement
  const calculateTextLinesWithCanvas = async (
    text: string,
    maxWidthPx: number,
    fontSize: number,
    fontFamily: string,
    fontWeight: string,
    letterSpacing: string
  ): Promise<string[]> => {
    if (!text.trim()) {
      return [];
    }

    // Wait for fonts to load
    await document.fonts.ready;

    // Create canvas for measurement
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      // Fallback to simple word wrapping if canvas not available
      const words = text.split(' ');
      const lines: string[] = [];
      let currentLine = '';
      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        if (testLine.length * fontSize * 0.6 <= maxWidthPx || currentLine === '') {
          currentLine = testLine;
        } else {
          lines.push(currentLine);
          currentLine = word;
        }
      }
      if (currentLine) {
        lines.push(currentLine);
      }
      return lines;
    }

    // Map font family to font stack that matches server-side rendering
    // Convert generic names (sans-serif, serif) to specific font stacks
    let measurementFontFamily: string;
    if (fontFamily === 'sans-serif' || fontFamily === 'serif' || fontFamily === 'cursive' || fontFamily === 'handwritten') {
      measurementFontFamily = getFontStackForMeasurement(fontFamily as 'sans-serif' | 'serif' | 'cursive' | 'handwritten');
    } else {
      // If a specific font is provided, use it as-is
      measurementFontFamily = fontFamily;
    }

    // Build font string matching server-side rendering
    const fontWeightValue = fontWeight === 'bold' ? 'bold' : fontWeight === 'light' ? '300' : 'normal';
    const fontString = `${fontWeightValue} ${fontSize}px ${measurementFontFamily}`;
    ctx.font = fontString;
    
    // Canvas API doesn't support letterSpacing directly, so we'll approximate
    // For 'wide' spacing, we'll add extra space between characters
    // This is an approximation - actual CSS letter-spacing may vary slightly
    const letterSpacingValue = letterSpacing === 'wide' ? fontSize * 0.15 : 0;

    // First, handle manual line breaks (\n)
    const manualSections = text.split('\n');
    const allLines: string[] = [];

    for (const section of manualSections) {
      if (!section.trim()) {
        continue; // Skip empty sections
      }

      const words = section.trim().split(/\s+/);
      let currentLine = '';

      for (const word of words) {
        // Measure word with letter spacing adjustment
        let wordWidth = ctx.measureText(word).width;
        if (letterSpacingValue > 0 && word.length > 1) {
          wordWidth += letterSpacingValue * (word.length - 1);
        }
        
        if (wordWidth > maxWidthPx) {
          // Word is too long - break it into characters
          if (currentLine) {
            allLines.push(currentLine.trim());
            currentLine = '';
          }
          
          // Break long word character by character
          let wordChunk = '';
          for (const char of word) {
            const testChunk = wordChunk + char;
            let chunkWidth = ctx.measureText(testChunk).width;
            if (letterSpacingValue > 0 && testChunk.length > 1) {
              chunkWidth += letterSpacingValue * (testChunk.length - 1);
            }
            if (chunkWidth <= maxWidthPx) {
              wordChunk = testChunk;
            } else {
              if (wordChunk) {
                allLines.push(wordChunk);
              }
              wordChunk = char;
            }
          }
          if (wordChunk) {
            currentLine = wordChunk;
          }
        } else {
          // Word fits - try to add it to current line
          const separator = currentLine ? ' ' : '';
          const testLine = currentLine ? `${currentLine}${separator}${word}` : word;
          let testWidth = ctx.measureText(testLine).width;
          // Add letter spacing adjustment for the entire line
          if (letterSpacingValue > 0 && testLine.length > 1) {
            testWidth += letterSpacingValue * (testLine.length - 1);
          }
          
          if (testWidth <= maxWidthPx || currentLine === '') {
            currentLine = testLine;
          } else {
            // Current line is full - start new line with this word
            if (currentLine) {
              allLines.push(currentLine.trim());
            }
            currentLine = word;
          }
        }
      }

      if (currentLine) {
        allLines.push(currentLine.trim());
      }
    }

    return allLines.filter(line => line.length > 0);
  };
  
  // Render resize handles for text blocks
  const renderResizeHandles = (element: 'title' | 'subtitle') => {
    if (editingTextBlock === element) {
      return (
        <>
          {/* Corner handles */}
          <div
            className="absolute -top-1 -left-1 w-3 h-3 bg-indigo-600 border border-white rounded-sm cursor-nwse-resize z-30"
            onMouseDown={(e) => {
              e.stopPropagation();
              setIsResizing(true);
              setResizingElement(element);
              setResizeHandle('nw');
              const currentWidth = element === 'title' 
                ? (overlayEdit.title_max_width_percent !== undefined ? overlayEdit.title_max_width_percent : (displayAsset?.overlayConfig?.title_max_width_percent || 80))
                : (overlayEdit.subtitle_max_width_percent !== undefined ? overlayEdit.subtitle_max_width_percent : (displayAsset?.overlayConfig?.subtitle_max_width_percent || 80));
              setResizeStart({
                x: e.clientX,
                y: e.clientY,
                width: currentWidth,
                height: 0
              });
            }}
          />
          <div
            className="absolute -top-1 -right-1 w-3 h-3 bg-indigo-600 border border-white rounded-sm cursor-nesw-resize z-30"
            onMouseDown={(e) => {
              e.stopPropagation();
              setIsResizing(true);
              setResizingElement(element);
              setResizeHandle('ne');
              const currentWidth = element === 'title' 
                ? (overlayEdit.title_max_width_percent !== undefined ? overlayEdit.title_max_width_percent : (displayAsset?.overlayConfig?.title_max_width_percent || 80))
                : (overlayEdit.subtitle_max_width_percent !== undefined ? overlayEdit.subtitle_max_width_percent : (displayAsset?.overlayConfig?.subtitle_max_width_percent || 80));
              setResizeStart({
                x: e.clientX,
                y: e.clientY,
                width: currentWidth,
                height: 0
              });
            }}
          />
          <div
            className="absolute -bottom-1 -left-1 w-3 h-3 bg-indigo-600 border border-white rounded-sm cursor-nesw-resize z-30"
            onMouseDown={(e) => {
              e.stopPropagation();
              setIsResizing(true);
              setResizingElement(element);
              setResizeHandle('sw');
              const currentWidth = element === 'title' 
                ? (overlayEdit.title_max_width_percent !== undefined ? overlayEdit.title_max_width_percent : (displayAsset?.overlayConfig?.title_max_width_percent || 80))
                : (overlayEdit.subtitle_max_width_percent !== undefined ? overlayEdit.subtitle_max_width_percent : (displayAsset?.overlayConfig?.subtitle_max_width_percent || 80));
              setResizeStart({
                x: e.clientX,
                y: e.clientY,
                width: currentWidth,
                height: 0
              });
            }}
          />
          <div
            className="absolute -bottom-1 -right-1 w-3 h-3 bg-indigo-600 border border-white rounded-sm cursor-nwse-resize z-30"
            onMouseDown={(e) => {
              e.stopPropagation();
              setIsResizing(true);
              setResizingElement(element);
              setResizeHandle('se');
              const currentWidth = element === 'title' 
                ? (overlayEdit.title_max_width_percent !== undefined ? overlayEdit.title_max_width_percent : (displayAsset?.overlayConfig?.title_max_width_percent || 80))
                : (overlayEdit.subtitle_max_width_percent !== undefined ? overlayEdit.subtitle_max_width_percent : (displayAsset?.overlayConfig?.subtitle_max_width_percent || 80));
              setResizeStart({
                x: e.clientX,
                y: e.clientY,
                width: currentWidth,
                height: 0
              });
            }}
          />
          {/* Side handles */}
          <div
            className="absolute -top-1 left-1/2 -translate-x-1/2 w-8 h-1 bg-indigo-600 border border-white rounded-sm cursor-ns-resize z-30"
            onMouseDown={(e) => {
              e.stopPropagation();
              setIsResizing(true);
              setResizingElement(element);
              setResizeHandle('n');
            }}
          />
          <div
            className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-1 bg-indigo-600 border border-white rounded-sm cursor-ns-resize z-30"
            onMouseDown={(e) => {
              e.stopPropagation();
              setIsResizing(true);
              setResizingElement(element);
              setResizeHandle('s');
            }}
          />
          <div
            className="absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-8 bg-indigo-600 border border-white rounded-sm cursor-ew-resize z-30"
            onMouseDown={(e) => {
              e.stopPropagation();
              setIsResizing(true);
              setResizingElement(element);
              setResizeHandle('w');
              const currentWidth = element === 'title' 
                ? (overlayEdit.title_max_width_percent !== undefined ? overlayEdit.title_max_width_percent : (displayAsset?.overlayConfig?.title_max_width_percent || 80))
                : (overlayEdit.subtitle_max_width_percent !== undefined ? overlayEdit.subtitle_max_width_percent : (displayAsset?.overlayConfig?.subtitle_max_width_percent || 80));
              setResizeStart({
                x: e.clientX,
                y: e.clientY,
                width: currentWidth,
                height: 0
              });
            }}
          />
          <div
            className="absolute -right-1 top-1/2 -translate-y-1/2 w-1 h-8 bg-indigo-600 border border-white rounded-sm cursor-ew-resize z-30"
            onMouseDown={(e) => {
              e.stopPropagation();
              setIsResizing(true);
              setResizingElement(element);
              setResizeHandle('e');
              const currentWidth = element === 'title' 
                ? (overlayEdit.title_max_width_percent !== undefined ? overlayEdit.title_max_width_percent : (displayAsset?.overlayConfig?.title_max_width_percent || 80))
                : (overlayEdit.subtitle_max_width_percent !== undefined ? overlayEdit.subtitle_max_width_percent : (displayAsset?.overlayConfig?.subtitle_max_width_percent || 80));
              setResizeStart({
                x: e.clientX,
                y: e.clientY,
                width: currentWidth,
                height: 0
              });
            }}
          />
        </>
      );
    }
    return null;
  };
  
  // Function to pick color from image using canvas
  const pickColorFromImage = async (e: React.MouseEvent<HTMLImageElement>, target: 'title' | 'subtitle') => {
    if (!eyedropperActive || eyedropperActive !== target) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const img = e.currentTarget as HTMLImageElement;
    
    // Ensure image is loaded
    if (!img.complete || img.naturalWidth === 0 || img.naturalHeight === 0) {
      console.warn('[Eyedropper] Image not fully loaded yet');
      alert('Please wait for the image to load completely before picking colors.');
      setEyedropperActive(null);
      return;
    }
    
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      
      if (!ctx) {
        console.error('[Eyedropper] Could not get canvas context');
        alert('Unable to access image data. Please try again.');
        setEyedropperActive(null);
        return;
      }
      
      // Set canvas dimensions to match image natural size
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      
      // Draw image to canvas
      // For base64 images, this should work without CORS issues
      ctx.drawImage(img, 0, 0);
      
      // Calculate click position relative to image natural size
      const rect = img.getBoundingClientRect();
      const scaleX = img.naturalWidth / rect.width;
      const scaleY = img.naturalHeight / rect.height;
      
      const x = Math.floor((e.clientX - rect.left) * scaleX);
      const y = Math.floor((e.clientY - rect.top) * scaleY);
      
      // Ensure coordinates are within bounds
      const clampedX = Math.max(0, Math.min(x, canvas.width - 1));
      const clampedY = Math.max(0, Math.min(y, canvas.height - 1));
      
      // Get pixel data
      const imageData = ctx.getImageData(clampedX, clampedY, 1, 1);
      const [r, g, b, a] = imageData.data;
      
      // Convert to hex
      const hex = `#${[r, g, b].map(x => {
        const hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      }).join('')}`;
      
      console.log(`[Eyedropper] Picked color ${hex} at (${clampedX}, ${clampedY}) from image`);
      
      // Update overlay edit state
      if (target === 'title') {
        setOverlayEdit(prev => ({...prev, title_color_hex: hex}));
      } else {
        setOverlayEdit(prev => ({...prev, subtitle_color_hex: hex}));
      }
      
      setEyedropperActive(null);
    } catch (error: any) {
      console.error('[Eyedropper] Error picking color:', error);
      alert(`Failed to pick color: ${error.message || 'Unknown error'}`);
      setEyedropperActive(null);
    }
  };
  
  // Calculate the actual displayed image bounds within the container (accounting for object-contain)
  const getImageDisplayBounds = (container: Element) => {
    if (!imageDimensions) return null;
    
    const containerRect = container.getBoundingClientRect();
    const containerAspect = containerRect.width / containerRect.height;
    const imageAspect = imageDimensions.width / imageDimensions.height;
    
    let displayWidth: number;
    let displayHeight: number;
    let offsetX: number;
    let offsetY: number;
    
    if (imageAspect > containerAspect) {
      // Image is wider - fit to width, letterbox top/bottom
      displayWidth = containerRect.width;
      displayHeight = containerRect.width / imageAspect;
      offsetX = 0;
      offsetY = (containerRect.height - displayHeight) / 2;
    } else {
      // Image is taller - fit to height, letterbox left/right
      displayHeight = containerRect.height;
      displayWidth = containerRect.height * imageAspect;
      offsetX = (containerRect.width - displayWidth) / 2;
      offsetY = 0;
    }
    
    return {
      x: containerRect.left + offsetX,
      y: containerRect.top + offsetY,
      width: displayWidth,
      height: displayHeight
    };
  };
  
  // Handle mouse move and up events globally when dragging or resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizing && resizeStart && resizeHandle && resizingElement && currentAsset && editingOverlay) {
        const imageContainer = document.querySelector('.image-preview-container');
        if (imageContainer && imageDimensions) {
          const imageBounds = getImageDisplayBounds(imageContainer);
          if (imageBounds) {
            const deltaX = e.clientX - resizeStart.x;
            const deltaY = e.clientY - resizeStart.y;
            
            // Convert pixel deltas to percentage changes
            const deltaXPercent = (deltaX / imageBounds.width) * 100;
            const deltaYPercent = (deltaY / imageBounds.height) * 100;
            
            // Calculate new width and height based on resize handle
            const currentMaxWidth = resizingElement === 'title'
              ? (overlayEdit.title_max_width_percent !== undefined ? overlayEdit.title_max_width_percent : (displayAsset?.overlayConfig?.title_max_width_percent || 80))
              : (overlayEdit.subtitle_max_width_percent !== undefined ? overlayEdit.subtitle_max_width_percent : (displayAsset?.overlayConfig?.subtitle_max_width_percent || 80));
            
            let newWidthPercent = currentMaxWidth;
            let newXPercent = resizingElement === 'title'
              ? (overlayEdit.title_x_percent !== undefined ? overlayEdit.title_x_percent : (displayAsset?.overlayConfig?.title_x_percent || 50))
              : (overlayEdit.subtitle_x_percent !== undefined ? overlayEdit.subtitle_x_percent : (displayAsset?.overlayConfig?.subtitle_x_percent || 50));
            
            if (resizeHandle.includes('e')) {
              newWidthPercent = Math.max(20, Math.min(95, resizeStart.width + deltaXPercent));
            }
            if (resizeHandle.includes('w')) {
              newWidthPercent = Math.max(20, Math.min(95, resizeStart.width - deltaXPercent));
              // Adjust X position when resizing from left
              newXPercent = Math.max(5, Math.min(95, newXPercent - deltaXPercent / 2));
            }
            
            setOverlayEdit(prev => ({
              ...prev,
              ...(resizingElement === 'title' ? { title_max_width_percent: newWidthPercent } : { subtitle_max_width_percent: newWidthPercent }),
              ...(resizeHandle.includes('w') && resizingElement === 'title' ? { title_x_percent: newXPercent } : {}),
              ...(resizeHandle.includes('w') && resizingElement === 'subtitle' ? { subtitle_x_percent: newXPercent } : {})
            }));
          }
        }
      } else if (isDragging && dragStart && currentAsset && editingOverlay && draggingElement) {
        const imageContainer = document.querySelector('.image-preview-container');
        if (imageContainer && imageDimensions) {
          const imageBounds = getImageDisplayBounds(imageContainer);
          if (imageBounds) {
            // Calculate position relative to the displayed image area
            const relativeX = e.clientX - imageBounds.x;
            const relativeY = e.clientY - imageBounds.y;
            
            // Convert displayed position to actual image position
            // Since imageBounds accounts for letterboxing, we need to convert to actual image coordinates
            // The displayed image maintains aspect ratio, so we can scale the position
            const scaleX = imageDimensions.width / imageBounds.width;
            const scaleY = imageDimensions.height / imageBounds.height;
            
            // Calculate actual image position
            const actualX = relativeX * scaleX;
            const actualY = relativeY * scaleY;
            
            // Convert to percentage based on ACTUAL image dimensions (matching backend)
            const x = (actualX / imageDimensions.width) * 100;
            const y = (actualY / imageDimensions.height) * 100;
            
            if (draggingElement === 'title') {
              setOverlayEdit(prev => ({
                ...prev,
                title_x_percent: x,
                title_y_percent: y,
                x_percent: x, // Keep legacy for backward compatibility
                y_percent: y
              }));
            } else {
              setOverlayEdit(prev => ({
                ...prev,
                subtitle_x_percent: x,
                subtitle_y_percent: y
              }));
            }
          } else {
            // Fallback to container-based calculation if image bounds can't be determined
            // This shouldn't happen, but if it does, use container dimensions
            const rect = imageContainer.getBoundingClientRect();
            // Try to estimate displayed image size (assuming it fills container maintaining aspect ratio)
            const containerAspect = rect.width / rect.height;
            const imageAspect = imageDimensions.width / imageDimensions.height;
            let displayWidth: number, displayHeight: number;
            if (imageAspect > containerAspect) {
              displayWidth = rect.width;
              displayHeight = rect.width / imageAspect;
            } else {
              displayHeight = rect.height;
              displayWidth = rect.height * imageAspect;
            }
            const relativeX = e.clientX - rect.left - (rect.width - displayWidth) / 2;
            const relativeY = e.clientY - rect.top - (rect.height - displayHeight) / 2;
            const scaleX = imageDimensions.width / displayWidth;
            const scaleY = imageDimensions.height / displayHeight;
            const actualX = relativeX * scaleX;
            const actualY = relativeY * scaleY;
            const x = (actualX / imageDimensions.width) * 100;
            const y = (actualY / imageDimensions.height) * 100;
            if (draggingElement === 'title') {
              setOverlayEdit(prev => ({
                ...prev,
                title_x_percent: x,
                title_y_percent: y,
                x_percent: x,
                y_percent: y
              }));
            } else {
              setOverlayEdit(prev => ({
                ...prev,
                subtitle_x_percent: x,
                subtitle_y_percent: y
              }));
            }
          }
        }
      }
    };
    
    const handleMouseUp = () => {
      setIsDragging(false);
      setDragStart(null);
      setDraggingElement(null);
      setIsResizing(false);
      setResizingElement(null);
      setResizeHandle(null);
      setResizeStart(null);
    };
    
    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, dragStart, resizeStart, resizeHandle, resizingElement, currentAsset, editingOverlay, draggingElement, imageDimensions, overlayEdit, displayAsset]);

  const handleProductImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setProductImage(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  // Helper function to get image dimensions based on preset
  const getImageDimensions = () => {
    switch (imageSizePreset) {
      case 'story':
        return { width: 1080, height: 1920 };
      case 'square':
        return { width: 1080, height: 1080 };
      case 'custom':
        return { width: customWidth, height: customHeight };
      default:
        return { width: 1080, height: 1080 };
    }
  };

  const handleGenerate = async () => {
    if (!activeBrand) return;
    setLoading(true);
    setStatusText('Creative Director is mapping the vision...');
    
    try {
      let asset: GeneratedAsset;

      if (option === 'product') {
        const dimensions = getImageDimensions();
        asset = await assetApi.generateProduct({
          brandId: activeBrand.id,
          productFocus,
          referenceImageBase64: productImage || undefined,
          width: dimensions.width,
          height: dimensions.height
        });
        setStatusText('Capturing high-fidelity visual...');
      } else {
        asset = await assetApi.generateNonProduct({
          brandId: activeBrand.id,
          userPurpose
        });
        setStatusText('Visualizing abstract metaphor...');
      }

      // Convert backend format to frontend format for display
      const frontendAsset: GeneratedAsset = {
        ...asset,
        imageUrl: asset.image_url,
        brandId: asset.brand_id,
        campaignImages: asset.campaign_images,
        overlayConfig: asset.overlay_config,
        baseImageUrl: asset.base_image_url,
        userPrompt: asset.user_prompt,
        feedbackHistory: asset.feedback_history,
        timestamp: asset.created_at ? new Date(asset.created_at).getTime() : Date.now()
      };

      setCurrentAsset(frontendAsset);
      onAssetCreated(frontendAsset);
    } catch (err) {
      console.error(err);
      alert('Generation failed: ' + (err as Error).message);
    } finally {
      setLoading(false);
      setStatusText('');
    }
  };

  const handleRegenerate = async () => {
    if (!currentAsset || !feedback) return;
    setLoading(true);
    setStatusText('Refining based on feedback...');
    try {
      const updated = await assetApi.editImage(currentAsset.id, feedback);
      const frontendAsset: GeneratedAsset = {
        ...updated,
        imageUrl: updated.image_url,
        brandId: updated.brand_id,
        campaignImages: updated.campaign_images,
        overlayConfig: updated.overlay_config,
        baseImageUrl: updated.base_image_url,
        userPrompt: updated.user_prompt,
        feedbackHistory: updated.feedback_history,
        timestamp: updated.created_at ? new Date(updated.created_at).getTime() : Date.now()
      };
      setCurrentAsset(frontendAsset);
      setFeedback('');
    } catch (err) {
      alert('Revision failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateOverlay = async () => {
    if (!currentAsset || currentAsset.type !== 'product') return;
    setLoading(true);
    setStatusText('Updating overlay...');
    try {
      // Calculate line breaks using Canvas API for exact match
      const overlayConfigToSend = { ...overlayEdit };
      
      // Get current text values
      const titleText = overlayEdit.title !== undefined 
        ? overlayEdit.title 
        : (displayAsset?.overlayConfig?.title || '');
      const subtitleText = overlayEdit.subtitle !== undefined 
        ? overlayEdit.subtitle 
        : (displayAsset?.overlayConfig?.subtitle || '');

      // Calculate title lines if title exists
      if (titleText) {
        const titleMaxWidthPercent = overlayEdit.title_max_width_percent !== undefined
          ? overlayEdit.title_max_width_percent
          : (displayAsset?.overlayConfig?.title_max_width_percent || 80);
        const titleMaxWidthPx = getMaxWidthPixelsNumeric(titleMaxWidthPercent);
        
        const titleFontSize = getFontSizeNumeric(
          overlayEdit.title_font_size !== undefined 
            ? overlayEdit.title_font_size 
            : displayAsset?.overlayConfig?.title_font_size,
          true
        );
        
        const titleFontFamily = overlayEdit.title_font_family || 
          displayAsset?.overlayConfig?.title_font_family || 
          'sans-serif';
        const titleFontWeight = overlayEdit.title_font_weight === 'bold' 
          ? 'bold' 
          : overlayEdit.title_font_weight === 'light' 
            ? '300' 
            : 'normal';
        const titleLetterSpacing = overlayEdit.title_letter_spacing === 'wide' 
          ? '0.15em' 
          : 'normal';
        
        const titleLines = await calculateTextLinesWithCanvas(
          titleText,
          titleMaxWidthPx,
          titleFontSize,
          titleFontFamily,
          titleFontWeight,
          titleLetterSpacing
        );
        
        overlayConfigToSend.title_lines = titleLines;
      }

      // Calculate subtitle lines if subtitle exists
      if (subtitleText) {
        const subtitleMaxWidthPercent = overlayEdit.subtitle_max_width_percent !== undefined
          ? overlayEdit.subtitle_max_width_percent
          : (displayAsset?.overlayConfig?.subtitle_max_width_percent || 80);
        const subtitleMaxWidthPx = getMaxWidthPixelsNumeric(subtitleMaxWidthPercent);
        
        const subtitleFontSize = getFontSizeNumeric(
          overlayEdit.subtitle_font_size !== undefined 
            ? overlayEdit.subtitle_font_size 
            : displayAsset?.overlayConfig?.subtitle_font_size,
          false
        );
        
        const subtitleFontFamily = overlayEdit.subtitle_font_family || 
          displayAsset?.overlayConfig?.subtitle_font_family || 
          'sans-serif';
        const subtitleFontWeight = overlayEdit.subtitle_font_weight === 'bold' 
          ? 'bold' 
          : overlayEdit.subtitle_font_weight === 'light' 
            ? '300' 
            : 'normal';
        const subtitleLetterSpacing = overlayEdit.subtitle_letter_spacing === 'wide' 
          ? '0.15em' 
          : 'normal';
        
        const subtitleLines = await calculateTextLinesWithCanvas(
          subtitleText,
          subtitleMaxWidthPx,
          subtitleFontSize,
          subtitleFontFamily,
          subtitleFontWeight,
          subtitleLetterSpacing
        );
        
        overlayConfigToSend.subtitle_lines = subtitleLines;
      }

      const updated = await assetApi.updateOverlay(currentAsset.id, overlayConfigToSend);
      const frontendAsset: GeneratedAsset = {
        ...updated,
        imageUrl: updated.image_url,
        brandId: updated.brand_id,
        campaignImages: updated.campaign_images,
        overlayConfig: updated.overlay_config,
        baseImageUrl: updated.base_image_url,
        userPrompt: updated.user_prompt,
        feedbackHistory: updated.feedback_history,
        timestamp: updated.created_at ? new Date(updated.created_at).getTime() : Date.now()
      };
      setCurrentAsset(frontendAsset);
      setEditingOverlay(false);
      setOverlayEdit({});
    } catch (err) {
      alert('Overlay update failed: ' + (err as Error).message);
    } finally {
      setLoading(false);
      setStatusText('');
    }
  };

  if (!activeBrand) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-10">
      <div className="bg-indigo-50 p-6 rounded-full mb-6">
        <svg className="w-12 h-12 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      </div>
      <h2 className="text-2xl font-black text-slate-800 mb-2">No Active Brand</h2>
      <p className="text-slate-500 max-w-md">Select or create a brand library from the sidebar to start generating marketing assets.</p>
    </div>
  );

  const campaignImages = displayAsset?.campaignImages || displayAsset?.campaign_images || [];

  return (
    <div className="space-y-12 max-w-6xl mx-auto pb-20 px-4 sm:px-0">
      {/* Instructions & Title */}
      <div className="flex flex-col md:flex-row justify-between items-start gap-10">
        <div className="flex-1">
          <h2 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">Content Studio</h2>
          <div className="p-6 bg-slate-900/5 rounded-3xl border border-slate-200/50 backdrop-blur-sm">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">How to use</h3>
            <ul className="space-y-2 text-sm text-slate-600 font-medium">
              <li className="flex gap-2">
                <span className="text-indigo-500 font-black">01.</span> Select a generation type based on your campaign goal.
              </li>
              <li className="flex gap-2">
                <span className="text-indigo-500 font-black">02.</span> Provide specific details or references for the AI Creative Director.
              </li>
              <li className="flex gap-2">
                <span className="text-indigo-500 font-black">03.</span> Review the strategy and visual, then refine using the chat feedback loop.
              </li>
            </ul>
          </div>
        </div>
        
        <div className="flex bg-white/50 backdrop-blur-md p-2 rounded-[2rem] border border-slate-200 shadow-xl shadow-slate-200/50">
          {(['product', 'non-product'] as const).map(opt => (
            <button 
              key={opt}
              onClick={() => { setOption(opt); setCurrentAsset(null); }}
              className={`px-8 py-3.5 rounded-2xl text-xs font-black transition-all capitalize whitespace-nowrap ${option === opt ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
            >
              {opt.replace('-', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Input Section */}
      <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-2xl shadow-slate-200/40 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/50 blur-3xl -z-10 rounded-full"></div>
        
        <div className="space-y-8">
          {option === 'product' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
              <div className="lg:col-span-4 space-y-4">
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest ml-4">Reference Hero Image</label>
                <div className="aspect-square bg-slate-50 border-4 border-dashed border-slate-200 rounded-[2.5rem] flex flex-col items-center justify-center relative overflow-hidden group hover:border-indigo-400 transition-all cursor-pointer shadow-inner">
                  {productImage ? (
                    <>
                      <img src={productImage} className="w-full h-full object-cover" />
                      <button onClick={(e) => { e.stopPropagation(); setProductImage(null); }} className="absolute top-6 right-6 bg-white/95 p-3 rounded-2xl shadow-2xl opacity-0 group-hover:opacity-100 transition-all hover:scale-110">
                         <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </>
                  ) : (
                    <label className="cursor-pointer text-center p-12 w-full h-full flex flex-col items-center justify-center">
                      <div className="bg-white w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl text-indigo-600 group-hover:scale-110 transition">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
                      </div>
                      <span className="text-sm font-black text-slate-500">Add Product Reference</span>
                      <p className="text-xs text-slate-400 mt-2 font-medium">PNG, JPG up to 10MB</p>
                      <input type="file" className="hidden" accept="image/*" onChange={handleProductImageUpload} />
                    </label>
                  )}
                </div>
              </div>
              <div className="lg:col-span-8 flex flex-col justify-center space-y-8">
                <div className="space-y-3">
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest ml-4">What are we selling today?</label>
                  <textarea 
                    value={productFocus}
                    onChange={e => setProductFocus(e.target.value)}
                    placeholder="Describe the product context, features, or seasonal vibe..."
                    className="w-full h-52 p-8 bg-slate-50 border-2 border-slate-100 rounded-[2.5rem] outline-none focus:bg-white focus:ring-4 focus:ring-indigo-50/50 focus:border-indigo-500 transition-all text-xl font-medium leading-relaxed"
                  />
                </div>
                
                {/* Image Size Selector */}
                <div className="space-y-3">
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest ml-4">Image Size</label>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      onClick={() => setImageSizePreset('story')}
                      className={`p-4 rounded-2xl border-2 transition-all font-bold text-sm ${
                        imageSizePreset === 'story' 
                          ? 'bg-indigo-600 text-white border-indigo-600' 
                          : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'
                      }`}
                    >
                      Story<br/><span className="text-xs opacity-80">1080×1920</span>
                    </button>
                    <button
                      onClick={() => setImageSizePreset('square')}
                      className={`p-4 rounded-2xl border-2 transition-all font-bold text-sm ${
                        imageSizePreset === 'square' 
                          ? 'bg-indigo-600 text-white border-indigo-600' 
                          : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'
                      }`}
                    >
                      Square<br/><span className="text-xs opacity-80">1080×1080</span>
                    </button>
                    <button
                      onClick={() => setImageSizePreset('custom')}
                      className={`p-4 rounded-2xl border-2 transition-all font-bold text-sm ${
                        imageSizePreset === 'custom' 
                          ? 'bg-indigo-600 text-white border-indigo-600' 
                          : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'
                      }`}
                    >
                      Custom
                    </button>
                  </div>
                  {imageSizePreset === 'custom' && (
                    <div className="flex gap-3 items-center">
                      <div className="flex-1">
                        <label className="block text-xs font-bold text-slate-500 mb-1">Width</label>
                        <input
                          type="number"
                          min="100"
                          max="4096"
                          value={customWidth}
                          onChange={e => setCustomWidth(parseInt(e.target.value) || 1080)}
                          className="w-full p-3 bg-white border-2 border-slate-200 rounded-xl text-slate-800 font-bold"
                        />
                      </div>
                      <span className="text-2xl font-black text-slate-400 mt-6">×</span>
                      <div className="flex-1">
                        <label className="block text-xs font-bold text-slate-500 mb-1">Height</label>
                        <input
                          type="number"
                          min="100"
                          max="4096"
                          value={customHeight}
                          onChange={e => setCustomHeight(parseInt(e.target.value) || 1080)}
                          className="w-full p-3 bg-white border-2 border-slate-200 rounded-xl text-slate-800 font-bold"
                        />
                      </div>
                    </div>
                  )}
                </div>
                
                <button 
                  onClick={handleGenerate}
                  disabled={loading || !productFocus}
                  className="w-full py-6 bg-slate-900 text-white rounded-[2rem] font-black text-xl shadow-2xl shadow-slate-300 hover:bg-indigo-600 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {loading ? statusText : 'Draft Product Masterpiece'}
                </button>
              </div>
            </div>
          )}

          {option === 'non-product' && (
            <div className="space-y-10">
              <div className="space-y-3">
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest ml-4">The Brand Moment Purpose</label>
                <textarea 
                  value={userPurpose}
                  onChange={e => setUserPurpose(e.target.value)}
                  placeholder="Hiring? Milestone? Holiday? Thought leadership?"
                  className="w-full p-8 bg-slate-50 border-2 border-slate-100 rounded-[2.5rem] h-52 font-medium text-2xl"
                />
              </div>
              <button 
                onClick={handleGenerate}
                disabled={loading || !userPurpose}
                className="w-full py-6 bg-slate-900 text-white rounded-[2rem] font-black text-xl shadow-2xl shadow-slate-300"
              >
                {loading ? statusText : 'Generate Brand DNA Asset'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Output / Results View */}
      {displayAsset && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 animate-in fade-in slide-in-from-bottom-12 duration-1000">
          <div className="lg:col-span-6 space-y-8">
            {/* Visual Preview with Draggable Text Overlay */}
            <div className="relative group rounded-[4rem] overflow-hidden shadow-[0_48px_80px_-24px_rgba(0,0,0,0.3)] border-[20px] border-white ring-1 ring-slate-200">
              <div 
                ref={imageContainerRef} 
                className="image-preview-container relative w-full" 
                style={getAspectRatioStyle()}
                onClick={(e) => {
                  // Close editing mode when clicking outside text blocks
                  if (editingTextBlock && (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'IMG')) {
                    setEditingTextBlock(null);
                  }
                }}
              >
                <img 
                  src={imageUrl} 
                  className={`w-full h-full object-contain transition duration-700 group-hover:scale-105 ${eyedropperActive ? 'cursor-crosshair' : ''}`}
                  onClick={(e) => {
                    if (eyedropperActive) {
                      pickColorFromImage(e, eyedropperActive);
                    }
                  }}
                  onLoad={(e) => {
                    console.log('[Eyedropper] Image loaded, ready for color picking');
                    // Ensure image dimensions are set when image loads (important for edit mode)
                    const img = e.currentTarget;
                    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                      setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
                    }
                  }}
                  onError={(e) => {
                    console.error('[Eyedropper] Image failed to load:', imageUrl);
                    if (eyedropperActive) {
                      alert('Image failed to load. Cannot pick colors.');
                      setEyedropperActive(null);
                    }
                  }}
                  style={eyedropperActive ? { cursor: 'crosshair', pointerEvents: 'auto' } : {}}
                  crossOrigin={imageUrl.startsWith('data:') ? undefined : 'anonymous'}
                />
                {eyedropperActive && (
                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center pointer-events-none z-20">
                    <div className="bg-white px-4 py-2 rounded-lg shadow-lg text-sm font-bold text-slate-800">
                      Click on the image to pick {eyedropperActive === 'title' ? 'title' : 'subtitle'} color
                    </div>
                  </div>
                )}
                
                {/* Draggable Text Overlay Preview (only when editing product assets) - Separate boxes for title and subtitle */}
                {editingOverlay && displayAsset.type === 'product' && displayAsset.overlayConfig && (
                  <>
                    {/* Title Textbox */}
                    {(overlayEdit.title || displayAsset.overlayConfig.title) && (() => {
                      const titleXPercent = overlayEdit.title_x_percent !== undefined 
                        ? overlayEdit.title_x_percent 
                        : (displayAsset.overlayConfig.title_x_percent !== undefined 
                          ? displayAsset.overlayConfig.title_x_percent 
                          : 50);
                      const titleYPercent = overlayEdit.title_y_percent !== undefined 
                        ? overlayEdit.title_y_percent 
                        : (displayAsset.overlayConfig.title_y_percent !== undefined 
                          ? displayAsset.overlayConfig.title_y_percent 
                          : 30);
                      const titleFontSize = overlayEdit.title_font_size || displayAsset.overlayConfig?.title_font_size;
                      
                      return (
                        <div
                          className={`absolute select-none border-2 ${editingTextBlock === 'title' ? 'border-indigo-600' : 'border-dashed border-indigo-400'} bg-indigo-50/20 rounded-lg p-3 backdrop-blur-sm ${editingTextBlock === 'title' ? 'cursor-default' : 'cursor-move'}`}
                          style={{
                            ...getOverlayPosition(titleXPercent, titleYPercent),
                            textAlign: (overlayEdit.title_text_anchor || displayAsset.overlayConfig?.title_text_anchor || 'middle') === 'start' ? 'left' : (overlayEdit.title_text_anchor || displayAsset.overlayConfig?.title_text_anchor || 'middle') === 'end' ? 'right' : 'center',
                            width: getMaxWidthPixels(overlayEdit.title_max_width_percent !== undefined ? overlayEdit.title_max_width_percent : (displayAsset.overlayConfig.title_max_width_percent || 80)),
                            maxWidth: getMaxWidthPixels(overlayEdit.title_max_width_percent !== undefined ? overlayEdit.title_max_width_percent : (displayAsset.overlayConfig.title_max_width_percent || 80)),
                            padding: '0.5rem',
                            color: overlayEdit.title_color_hex || displayAsset.overlayConfig?.title_color_hex || '#FFFFFF',
                            opacity: overlayEdit.title_opacity !== undefined ? overlayEdit.title_opacity : (displayAsset.overlayConfig.title_opacity !== undefined ? displayAsset.overlayConfig.title_opacity : 1),
                            fontFamily: getFontStackForMeasurement((overlayEdit.title_font_family || displayAsset.overlayConfig.title_font_family || 'sans-serif') as 'sans-serif' | 'serif' | 'cursive' | 'handwritten'),
                            fontWeight: overlayEdit.title_font_weight === 'bold' ? 'bold' : overlayEdit.title_font_weight === 'light' ? '300' : 'normal',
                            fontSize: getFontSize(titleFontSize, true),
                            letterSpacing: overlayEdit.title_letter_spacing === 'wide' ? '0.15em' : 'normal',
                            textTransform: overlayEdit.title_font_transform || 'none',
                            filter: 'drop-shadow(2px 2px 4px rgba(0,0,0,0.7))',
                            pointerEvents: 'all',
                            zIndex: draggingElement === 'title' || editingTextBlock === 'title' ? 20 : 10,
                            wordWrap: 'break-word',
                            overflowWrap: 'break-word',
                            wordBreak: 'normal'
                          }}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            setEditingTextBlock(editingTextBlock === 'title' ? null : 'title');
                          }}
                          onMouseDown={(e) => {
                            if (eyedropperActive || editingTextBlock === 'title') {
                              e.stopPropagation();
                              return;
                            }
                            e.preventDefault();
                            setIsDragging(true);
                            setDraggingElement('title');
                            const imageContainer = e.currentTarget.parentElement;
                            if (imageContainer && imageDimensions) {
                              const imageBounds = getImageDisplayBounds(imageContainer);
                              if (imageBounds) {
                                const relativeX = e.clientX - imageBounds.x;
                                const relativeY = e.clientY - imageBounds.y;
                                // Convert to actual image coordinates
                                const scaleX = imageDimensions.width / imageBounds.width;
                                const scaleY = imageDimensions.height / imageBounds.height;
                                const actualX = relativeX * scaleX;
                                const actualY = relativeY * scaleY;
                                const x = (actualX / imageDimensions.width) * 100;
                                const y = (actualY / imageDimensions.height) * 100;
                                setDragStart({ x, y });
                              } else {
                                const rect = imageContainer.getBoundingClientRect();
                                const containerAspect = rect.width / rect.height;
                                const imageAspect = imageDimensions.width / imageDimensions.height;
                                let displayWidth: number, displayHeight: number;
                                if (imageAspect > containerAspect) {
                                  displayWidth = rect.width;
                                  displayHeight = rect.width / imageAspect;
                                } else {
                                  displayHeight = rect.height;
                                  displayWidth = rect.height * imageAspect;
                                }
                                const relativeX = e.clientX - rect.left - (rect.width - displayWidth) / 2;
                                const relativeY = e.clientY - rect.top - (rect.height - displayHeight) / 2;
                                const scaleX = imageDimensions.width / displayWidth;
                                const scaleY = imageDimensions.height / displayHeight;
                                const actualX = relativeX * scaleX;
                                const actualY = relativeY * scaleY;
                                const x = (actualX / imageDimensions.width) * 100;
                                const y = (actualY / imageDimensions.height) * 100;
                                setDragStart({ x, y });
                              }
                            }
                          }}
                        >
                          {renderResizeHandles('title')}
                          <div style={{ whiteSpace: 'pre-wrap', pointerEvents: editingTextBlock === 'title' ? 'auto' : 'none', wordBreak: 'normal', overflowWrap: 'break-word', width: '100%' }}>
                            {calculatedTitleLines.length > 0 
                              ? calculatedTitleLines.join('\n')
                              : (overlayEdit.title || displayAsset.overlayConfig.title || '')}
                          </div>
                        </div>
                      );
                    })()}
                    
                    {/* Subtitle Textbox */}
                    {(overlayEdit.subtitle || displayAsset.overlayConfig.subtitle) && (() => {
                      const subtitleXPercent = overlayEdit.subtitle_x_percent !== undefined 
                        ? overlayEdit.subtitle_x_percent 
                        : (displayAsset.overlayConfig.subtitle_x_percent !== undefined 
                          ? displayAsset.overlayConfig.subtitle_x_percent 
                          : 50);
                      const subtitleYPercent = overlayEdit.subtitle_y_percent !== undefined 
                        ? overlayEdit.subtitle_y_percent 
                        : (displayAsset.overlayConfig.subtitle_y_percent !== undefined 
                          ? displayAsset.overlayConfig.subtitle_y_percent 
                          : 80);
                      const subtitleFontSize = overlayEdit.subtitle_font_size || displayAsset.overlayConfig?.subtitle_font_size;
                      
                      return (
                        <div
                          className={`absolute select-none border-2 ${editingTextBlock === 'subtitle' ? 'border-blue-600' : 'border-dashed border-blue-400'} bg-blue-50/20 rounded-lg p-3 backdrop-blur-sm ${editingTextBlock === 'subtitle' ? 'cursor-default' : 'cursor-move'}`}
                          style={{
                            ...getOverlayPosition(subtitleXPercent, subtitleYPercent),
                            textAlign: (overlayEdit.subtitle_text_anchor || displayAsset.overlayConfig?.subtitle_text_anchor || 'middle') === 'start' ? 'left' : (overlayEdit.subtitle_text_anchor || displayAsset.overlayConfig?.subtitle_text_anchor || 'middle') === 'end' ? 'right' : 'center',
                            width: getMaxWidthPixels(overlayEdit.subtitle_max_width_percent !== undefined ? overlayEdit.subtitle_max_width_percent : (displayAsset.overlayConfig.subtitle_max_width_percent || 80)),
                            maxWidth: getMaxWidthPixels(overlayEdit.subtitle_max_width_percent !== undefined ? overlayEdit.subtitle_max_width_percent : (displayAsset.overlayConfig.subtitle_max_width_percent || 80)),
                            padding: '0.5rem',
                            color: overlayEdit.subtitle_color_hex || displayAsset.overlayConfig?.subtitle_color_hex || '#FFFFFF',
                            opacity: overlayEdit.subtitle_opacity !== undefined ? overlayEdit.subtitle_opacity : (displayAsset.overlayConfig.subtitle_opacity !== undefined ? displayAsset.overlayConfig.subtitle_opacity : 0.9),
                            fontFamily: getFontStackForMeasurement((overlayEdit.subtitle_font_family || displayAsset.overlayConfig.subtitle_font_family || 'sans-serif') as 'sans-serif' | 'serif' | 'cursive' | 'handwritten'),
                            fontWeight: overlayEdit.subtitle_font_weight === 'bold' ? 'bold' : overlayEdit.subtitle_font_weight === 'light' ? '300' : 'normal',
                            fontSize: getFontSize(subtitleFontSize, false),
                            letterSpacing: overlayEdit.subtitle_letter_spacing === 'wide' ? '0.15em' : 'normal',
                            textTransform: overlayEdit.subtitle_font_transform || 'none',
                            filter: 'drop-shadow(2px 2px 4px rgba(0,0,0,0.7))',
                            pointerEvents: 'all',
                            zIndex: draggingElement === 'subtitle' || editingTextBlock === 'subtitle' ? 20 : 10,
                            wordWrap: 'break-word',
                            overflowWrap: 'break-word',
                            wordBreak: 'normal'
                          }}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            setEditingTextBlock(editingTextBlock === 'subtitle' ? null : 'subtitle');
                          }}
                          onMouseDown={(e) => {
                            if (eyedropperActive || editingTextBlock === 'subtitle') {
                              e.stopPropagation();
                              return;
                            }
                            e.preventDefault();
                            setIsDragging(true);
                            setDraggingElement('subtitle');
                            const imageContainer = e.currentTarget.parentElement;
                            if (imageContainer && imageDimensions) {
                              const imageBounds = getImageDisplayBounds(imageContainer);
                              if (imageBounds) {
                                const relativeX = e.clientX - imageBounds.x;
                                const relativeY = e.clientY - imageBounds.y;
                                // Convert to actual image coordinates
                                const scaleX = imageDimensions.width / imageBounds.width;
                                const scaleY = imageDimensions.height / imageBounds.height;
                                const actualX = relativeX * scaleX;
                                const actualY = relativeY * scaleY;
                                const x = (actualX / imageDimensions.width) * 100;
                                const y = (actualY / imageDimensions.height) * 100;
                                setDragStart({ x, y });
                              } else {
                                const rect = imageContainer.getBoundingClientRect();
                                const containerAspect = rect.width / rect.height;
                                const imageAspect = imageDimensions.width / imageDimensions.height;
                                let displayWidth: number, displayHeight: number;
                                if (imageAspect > containerAspect) {
                                  displayWidth = rect.width;
                                  displayHeight = rect.width / imageAspect;
                                } else {
                                  displayHeight = rect.height;
                                  displayWidth = rect.height * imageAspect;
                                }
                                const relativeX = e.clientX - rect.left - (rect.width - displayWidth) / 2;
                                const relativeY = e.clientY - rect.top - (rect.height - displayHeight) / 2;
                                const scaleX = imageDimensions.width / displayWidth;
                                const scaleY = imageDimensions.height / displayHeight;
                                const actualX = relativeX * scaleX;
                                const actualY = relativeY * scaleY;
                                const x = (actualX / imageDimensions.width) * 100;
                                const y = (actualY / imageDimensions.height) * 100;
                                setDragStart({ x, y });
                              }
                            }
                          }}
                        >
                          {renderResizeHandles('subtitle')}
                          <div style={{ whiteSpace: 'pre-wrap', pointerEvents: editingTextBlock === 'subtitle' ? 'auto' : 'none', wordBreak: 'normal', overflowWrap: 'break-word', width: '100%' }}>
                            {calculatedSubtitleLines.length > 0 
                              ? calculatedSubtitleLines.join('\n')
                              : (overlayEdit.subtitle || displayAsset.overlayConfig.subtitle || '')}
                          </div>
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>
              
              {/* For non-product assets, show CSS overlay if needed */}
              {displayAsset.type !== 'product' && (
                <div className={`absolute inset-0 flex flex-col p-16 pointer-events-none
                  ${(displayAsset.strategy?.step_2_message_strategy?.design_instructions?.suggested_position || 'center-middle')
                     .toLowerCase().includes('top') ? 'justify-start' : 
                     (displayAsset.strategy?.step_2_message_strategy?.design_instructions?.suggested_position || 'center-middle')
                     .toLowerCase().includes('bottom') ? 'justify-end' : 'justify-center'}
                  ${(displayAsset.strategy?.step_2_message_strategy?.design_instructions?.suggested_position || 'center-middle')
                     .toLowerCase().includes('left') ? 'items-start text-left' : 
                     (displayAsset.strategy?.step_2_message_strategy?.design_instructions?.suggested_position || 'center-middle')
                     .toLowerCase().includes('right') ? 'items-end text-right' : 'items-center text-center'}
                `}>
                  <h1 
                    className="text-4xl md:text-5xl lg:text-6xl font-black leading-[1.05] drop-shadow-2xl"
                    style={{
                      color: displayAsset.strategy?.step_2_message_strategy?.design_instructions?.suggested_text_color || 'white',
                      maxWidth: '90%'
                    }}
                  >
                    {displayAsset.strategy?.step_2_message_strategy?.headline_text}
                  </h1>
                  {displayAsset.strategy?.step_2_message_strategy?.body_caption_draft && (
                     <p className="mt-6 text-xl font-bold opacity-90 drop-shadow-xl text-white max-w-md">
                        {displayAsset.strategy?.step_2_message_strategy?.body_caption_draft}
                     </p>
                  )}
                </div>
              )}
            </div>

            {displayAsset.type === 'campaign' && campaignImages.length > 0 && (
              <div className="flex gap-4 overflow-x-auto py-4 custom-scrollbar px-2">
                {campaignImages.map((img, i) => (
                  <button 
                    key={i} 
                    onClick={() => setCurrentAsset({...displayAsset, imageUrl: img, image_url: img})}
                    className={`w-32 h-32 shrink-0 rounded-3xl overflow-hidden border-4 transition-all ${imageUrl === img ? 'border-indigo-600 scale-95 shadow-inner' : 'border-white hover:border-indigo-200'}`}
                  >
                    <img src={img} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            {/* Overlay Editing UI for Product Assets */}
            {displayAsset.type === 'product' && displayAsset.overlayConfig && (
              <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Text Overlay</h3>
                  <button
                    onClick={() => {
                      if (editingOverlay) {
                        setEditingOverlay(false);
                        setOverlayEdit({});
                      } else {
                        setEditingOverlay(true);
                        // Ensure image dimensions are loaded before editing starts
                        if (imageUrl && !imageDimensions) {
                          const img = new Image();
                          img.onload = () => {
                            setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
                          };
                          img.src = imageUrl;
                        }
                        setOverlayEdit({
                          title: displayAsset.overlayConfig?.title || '',
                          subtitle: displayAsset.overlayConfig?.subtitle || '',
                          // Title properties - completely separate
                          title_font_family: displayAsset.overlayConfig?.title_font_family || 'sans-serif',
                          title_font_weight: displayAsset.overlayConfig?.title_font_weight || 'bold',
                          title_font_transform: displayAsset.overlayConfig?.title_font_transform || 'none',
                          title_letter_spacing: displayAsset.overlayConfig?.title_letter_spacing || 'normal',
                          title_color_hex: displayAsset.overlayConfig?.title_color_hex || '#FFFFFF',
                          title_x_percent: displayAsset.overlayConfig?.title_x_percent || 50,
                          title_y_percent: displayAsset.overlayConfig?.title_y_percent || 30,
                          title_text_anchor: displayAsset.overlayConfig?.title_text_anchor || 'middle',
                          title_max_width_percent: displayAsset.overlayConfig?.title_max_width_percent || 80,
                          title_opacity: displayAsset.overlayConfig?.title_opacity !== undefined ? displayAsset.overlayConfig.title_opacity : 1.0,
                          title_font_size: displayAsset.overlayConfig?.title_font_size,
                          title_overlay_background_type: displayAsset.overlayConfig?.title_overlay_background_type,
                          title_overlay_background_color: displayAsset.overlayConfig?.title_overlay_background_color,
                          title_overlay_background_opacity: displayAsset.overlayConfig?.title_overlay_background_opacity,
                          title_overlay_background_shape: displayAsset.overlayConfig?.title_overlay_background_shape,
                          title_overlay_background_padding: displayAsset.overlayConfig?.title_overlay_background_padding,
                          // Subtitle properties - completely separate
                          subtitle_font_family: displayAsset.overlayConfig?.subtitle_font_family || 'sans-serif',
                          subtitle_font_weight: displayAsset.overlayConfig?.subtitle_font_weight || 'regular',
                          subtitle_font_transform: displayAsset.overlayConfig?.subtitle_font_transform || 'none',
                          subtitle_letter_spacing: displayAsset.overlayConfig?.subtitle_letter_spacing || 'normal',
                          subtitle_color_hex: displayAsset.overlayConfig?.subtitle_color_hex || '#FFFFFF',
                          subtitle_x_percent: displayAsset.overlayConfig?.subtitle_x_percent || 50,
                          subtitle_y_percent: displayAsset.overlayConfig?.subtitle_y_percent || 80,
                          subtitle_text_anchor: displayAsset.overlayConfig?.subtitle_text_anchor || 'middle',
                          subtitle_max_width_percent: displayAsset.overlayConfig?.subtitle_max_width_percent || 80,
                          subtitle_opacity: displayAsset.overlayConfig?.subtitle_opacity !== undefined ? displayAsset.overlayConfig.subtitle_opacity : 0.9,
                          subtitle_font_size: displayAsset.overlayConfig?.subtitle_font_size,
                          subtitle_overlay_background_type: displayAsset.overlayConfig?.subtitle_overlay_background_type,
                          subtitle_overlay_background_color: displayAsset.overlayConfig?.subtitle_overlay_background_color,
                          subtitle_overlay_background_opacity: displayAsset.overlayConfig?.subtitle_overlay_background_opacity,
                          subtitle_overlay_background_shape: displayAsset.overlayConfig?.subtitle_overlay_background_shape,
                          subtitle_overlay_background_padding: displayAsset.overlayConfig?.subtitle_overlay_background_padding
                        });
                        // Initialize calculated lines from saved config if available
                        if (displayAsset.overlayConfig?.title_lines) {
                          setCalculatedTitleLines(displayAsset.overlayConfig.title_lines);
                        }
                        if (displayAsset.overlayConfig?.subtitle_lines) {
                          setCalculatedSubtitleLines(displayAsset.overlayConfig.subtitle_lines);
                        }
                      }
                    }}
                    className="text-xs font-black text-indigo-600 hover:text-indigo-700"
                  >
                    {editingOverlay ? 'Cancel' : 'Edit'}
                  </button>
                </div>

                {!editingOverlay ? (
                  <div className="space-y-3">
                    <div>
                      <p className="text-xl font-black text-slate-800">{stripMarkdown(displayAsset.overlayConfig.title || '')}</p>
                      {displayAsset.overlayConfig.subtitle && (
                        <p className="text-sm font-medium text-slate-600 mt-1">{stripMarkdown(displayAsset.overlayConfig.subtitle)}</p>
                      )}
                    </div>
                    <div className="flex gap-4 text-xs text-slate-500">
                      <span>Title: {displayAsset.overlayConfig.title_font_family}</span>
                      <span>•</span>
                      <span>{displayAsset.overlayConfig.title_font_weight}</span>
                      <span>•</span>
                      <span>Subtitle: {displayAsset.overlayConfig.subtitle_font_family}</span>
                      <span>•</span>
                      <span>{displayAsset.overlayConfig.subtitle_font_weight}</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Title Section */}
                    <div className="space-y-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-black text-slate-600 uppercase tracking-wider">Title</h3>
                        {(overlayEdit.title !== undefined && overlayEdit.title !== '') || displayAsset.overlayConfig?.title ? (
                          <button
                            onClick={async () => {
                              setOverlayEdit({...overlayEdit, title: ''});
                              // Immediately save the deletion
                              if (currentAsset && currentAsset.type === 'product') {
                                try {
                                  const updated = await assetApi.updateOverlay(currentAsset.id, {...overlayEdit, title: ''});
                                  const frontendAsset: GeneratedAsset = {
                                    ...updated,
                                    imageUrl: updated.image_url,
                                    brandId: updated.brand_id,
                                    campaignImages: updated.campaign_images,
                                    overlayConfig: updated.overlay_config,
                                    baseImageUrl: updated.base_image_url,
                                    userPrompt: updated.user_prompt,
                                    feedbackHistory: updated.feedback_history,
                                    timestamp: updated.created_at ? new Date(updated.created_at).getTime() : Date.now()
                                  };
                                  setCurrentAsset(frontendAsset);
                                } catch (err) {
                                  console.error('Failed to delete title:', err);
                                }
                              }
                            }}
                            className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 transition-all"
                            title="Delete title"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        ) : null}
                      </div>
                      
                      <div>
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2">
                          Text (Press Enter for new line)
                        </label>
                        <textarea
                          value={overlayEdit.title || ''}
                          onChange={e => {
                            setOverlayEdit({...overlayEdit, title: e.target.value});
                            // Auto-resize textarea
                            e.target.style.height = 'auto';
                            e.target.style.height = `${e.target.scrollHeight}px`;
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              // Allow Enter to create new line
                              // Textarea will auto-resize via onChange
                            }
                          }}
                          rows={3}
                          className="w-full p-3 bg-white border border-slate-200 rounded-xl text-slate-800 font-bold resize-y overflow-hidden"
                          placeholder="Enter title... (Press Enter for new line)"
                          style={{ minHeight: '3rem' }}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Color</label>
                        <div className="space-y-2">
                          {activeBrand && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => setOverlayEdit({...overlayEdit, title_color_hex: activeBrand.visual_identity.primary_color_hex})}
                                className="w-10 h-10 rounded-lg border-2 border-slate-200 hover:border-indigo-400 transition-all shadow-sm"
                                style={{ backgroundColor: activeBrand.visual_identity.primary_color_hex }}
                                title="Primary Brand Color"
                              />
                              <button
                                onClick={() => setOverlayEdit({...overlayEdit, title_color_hex: activeBrand.visual_identity.accent_color_hex})}
                                className="w-10 h-10 rounded-lg border-2 border-slate-200 hover:border-indigo-400 transition-all shadow-sm"
                                style={{ backgroundColor: activeBrand.visual_identity.accent_color_hex }}
                                title="Accent Brand Color"
                              />
                              <button
                                onClick={() => setEyedropperActive('title')}
                                className="w-10 h-10 rounded-lg border-2 border-slate-200 hover:border-indigo-400 transition-all shadow-sm bg-white flex items-center justify-center"
                                title="Pick color from image"
                              >
                                <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                                </svg>
                              </button>
                            </div>
                          )}
                          <div className="flex gap-2">
                            <input
                              type="color"
                              value={overlayEdit.title_color_hex || displayAsset.overlayConfig?.title_color_hex || '#FFFFFF'}
                              onChange={e => setOverlayEdit({...overlayEdit, title_color_hex: e.target.value})}
                              className="w-16 h-12 rounded-xl border-2 border-slate-200 cursor-pointer"
                            />
                            <input
                              type="text"
                              value={overlayEdit.title_color_hex || displayAsset.overlayConfig?.title_color_hex || '#FFFFFF'}
                              onChange={e => setOverlayEdit({...overlayEdit, title_color_hex: e.target.value})}
                              className="flex-1 p-3 bg-white border border-slate-200 rounded-xl text-slate-800 font-bold"
                              placeholder="#FFFFFF"
                            />
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Font Size</label>
                        <div className="flex gap-2 items-center">
                          <input
                            type="number"
                            min="12"
                            max="200"
                            value={overlayEdit.title_font_size || ''}
                            onChange={e => {
                              const val = e.target.value;
                              setOverlayEdit({...overlayEdit, title_font_size: val ? parseInt(val) : undefined});
                            }}
                            className="flex-1 p-3 bg-white border border-slate-200 rounded-xl text-slate-800 font-bold"
                            placeholder="Auto"
                          />
                          <span className="text-sm font-bold text-slate-500">px</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Font Family</label>
                          <select
                            value={overlayEdit.title_font_family || displayAsset.overlayConfig?.title_font_family || 'sans-serif'}
                            onChange={e => setOverlayEdit({...overlayEdit, title_font_family: e.target.value as any})}
                            className="w-full p-3 bg-white border border-slate-200 rounded-xl text-slate-800 font-bold"
                          >
                            <option value="sans-serif">Sans-serif</option>
                            <option value="serif">Serif</option>
                            <option value="cursive">Cursive</option>
                            <option value="handwritten">Handwritten</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Font Weight</label>
                          <select
                            value={overlayEdit.title_font_weight || displayAsset.overlayConfig?.title_font_weight || 'bold'}
                            onChange={e => setOverlayEdit({...overlayEdit, title_font_weight: e.target.value as any})}
                            className="w-full p-3 bg-white border border-slate-200 rounded-xl text-slate-800 font-bold"
                          >
                            <option value="light">Light</option>
                            <option value="regular">Regular</option>
                            <option value="bold">Bold</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Text Alignment</label>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setOverlayEdit({...overlayEdit, title_text_anchor: 'start'})}
                            className={`flex-1 p-3 rounded-xl border-2 transition-all font-bold text-sm ${
                              (overlayEdit.title_text_anchor || displayAsset.overlayConfig?.title_text_anchor || 'middle') === 'start'
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'
                            }`}
                          >
                            Left
                          </button>
                          <button
                            onClick={() => setOverlayEdit({...overlayEdit, title_text_anchor: 'middle'})}
                            className={`flex-1 p-3 rounded-xl border-2 transition-all font-bold text-sm ${
                              (overlayEdit.title_text_anchor || displayAsset.overlayConfig?.title_text_anchor || 'middle') === 'middle'
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'
                            }`}
                          >
                            Center
                          </button>
                          <button
                            onClick={() => setOverlayEdit({...overlayEdit, title_text_anchor: 'end'})}
                            className={`flex-1 p-3 rounded-xl border-2 transition-all font-bold text-sm ${
                              (overlayEdit.title_text_anchor || displayAsset.overlayConfig?.title_text_anchor || 'middle') === 'end'
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'
                            }`}
                          >
                            Right
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Subtitle Section */}
                    <div className="space-y-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-black text-slate-600 uppercase tracking-wider">Subtitle</h3>
                        {(overlayEdit.subtitle !== undefined && overlayEdit.subtitle !== '') || displayAsset.overlayConfig?.subtitle ? (
                          <button
                            onClick={async () => {
                              setOverlayEdit({...overlayEdit, subtitle: ''});
                              // Immediately save the deletion
                              if (currentAsset && currentAsset.type === 'product') {
                                try {
                                  const updated = await assetApi.updateOverlay(currentAsset.id, {...overlayEdit, subtitle: ''});
                                  const frontendAsset: GeneratedAsset = {
                                    ...updated,
                                    imageUrl: updated.image_url,
                                    brandId: updated.brand_id,
                                    campaignImages: updated.campaign_images,
                                    overlayConfig: updated.overlay_config,
                                    baseImageUrl: updated.base_image_url,
                                    userPrompt: updated.user_prompt,
                                    feedbackHistory: updated.feedback_history,
                                    timestamp: updated.created_at ? new Date(updated.created_at).getTime() : Date.now()
                                  };
                                  setCurrentAsset(frontendAsset);
                                } catch (err) {
                                  console.error('Failed to delete subtitle:', err);
                                }
                              }
                            }}
                            className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 transition-all"
                            title="Delete subtitle"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        ) : null}
                      </div>
                      
                      <div>
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2">
                          Text (Press Enter for new line)
                        </label>
                        <textarea
                          value={overlayEdit.subtitle || ''}
                          onChange={e => {
                            setOverlayEdit({...overlayEdit, subtitle: e.target.value});
                            // Auto-resize textarea
                            e.target.style.height = 'auto';
                            e.target.style.height = `${e.target.scrollHeight}px`;
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              // Allow Enter to create new line
                              // Textarea will auto-resize via onChange
                            }
                          }}
                          rows={3}
                          className="w-full p-3 bg-white border border-slate-200 rounded-xl text-slate-800 font-medium resize-y overflow-hidden"
                          placeholder="Enter subtitle... (Press Enter for new line)"
                          style={{ minHeight: '3rem' }}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Color</label>
                        <div className="space-y-2">
                          {activeBrand && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => setOverlayEdit({...overlayEdit, subtitle_color_hex: activeBrand.visual_identity.primary_color_hex})}
                                className="w-10 h-10 rounded-lg border-2 border-slate-200 hover:border-indigo-400 transition-all shadow-sm"
                                style={{ backgroundColor: activeBrand.visual_identity.primary_color_hex }}
                                title="Primary Brand Color"
                              />
                              <button
                                onClick={() => setOverlayEdit({...overlayEdit, subtitle_color_hex: activeBrand.visual_identity.accent_color_hex})}
                                className="w-10 h-10 rounded-lg border-2 border-slate-200 hover:border-indigo-400 transition-all shadow-sm"
                                style={{ backgroundColor: activeBrand.visual_identity.accent_color_hex }}
                                title="Accent Brand Color"
                              />
                              <button
                                onClick={() => setEyedropperActive('subtitle')}
                                className="w-10 h-10 rounded-lg border-2 border-slate-200 hover:border-indigo-400 transition-all shadow-sm bg-white flex items-center justify-center"
                                title="Pick color from image"
                              >
                                <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                                </svg>
                              </button>
                            </div>
                          )}
                          <div className="flex gap-2">
                            <input
                              type="color"
                              value={overlayEdit.subtitle_color_hex || displayAsset.overlayConfig?.subtitle_color_hex || '#FFFFFF'}
                              onChange={e => setOverlayEdit({...overlayEdit, subtitle_color_hex: e.target.value})}
                              className="w-16 h-12 rounded-xl border-2 border-slate-200 cursor-pointer"
                            />
                            <input
                              type="text"
                              value={overlayEdit.subtitle_color_hex || displayAsset.overlayConfig?.subtitle_color_hex || '#FFFFFF'}
                              onChange={e => setOverlayEdit({...overlayEdit, subtitle_color_hex: e.target.value})}
                              className="flex-1 p-3 bg-white border border-slate-200 rounded-xl text-slate-800 font-bold"
                              placeholder="#FFFFFF"
                            />
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Font Size</label>
                        <div className="flex gap-2 items-center">
                          <input
                            type="number"
                            min="12"
                            max="200"
                            value={overlayEdit.subtitle_font_size || ''}
                            onChange={e => {
                              const val = e.target.value;
                              setOverlayEdit({...overlayEdit, subtitle_font_size: val ? parseInt(val) : undefined});
                            }}
                            className="flex-1 p-3 bg-white border border-slate-200 rounded-xl text-slate-800 font-bold"
                            placeholder="Auto"
                          />
                          <span className="text-sm font-bold text-slate-500">px</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Font Family</label>
                          <select
                            value={overlayEdit.subtitle_font_family || displayAsset.overlayConfig?.subtitle_font_family || 'sans-serif'}
                            onChange={e => setOverlayEdit({...overlayEdit, subtitle_font_family: e.target.value as any})}
                            className="w-full p-3 bg-white border border-slate-200 rounded-xl text-slate-800 font-bold"
                          >
                            <option value="sans-serif">Sans-serif</option>
                            <option value="serif">Serif</option>
                            <option value="cursive">Cursive</option>
                            <option value="handwritten">Handwritten</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Font Weight</label>
                          <select
                            value={overlayEdit.subtitle_font_weight || displayAsset.overlayConfig?.subtitle_font_weight || 'regular'}
                            onChange={e => setOverlayEdit({...overlayEdit, subtitle_font_weight: e.target.value as any})}
                            className="w-full p-3 bg-white border border-slate-200 rounded-xl text-slate-800 font-bold"
                          >
                            <option value="light">Light</option>
                            <option value="regular">Regular</option>
                            <option value="bold">Bold</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Text Alignment</label>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setOverlayEdit({...overlayEdit, subtitle_text_anchor: 'start'})}
                            className={`flex-1 p-3 rounded-xl border-2 transition-all font-bold text-sm ${
                              (overlayEdit.subtitle_text_anchor || displayAsset.overlayConfig?.subtitle_text_anchor || 'middle') === 'start'
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'
                            }`}
                          >
                            Left
                          </button>
                          <button
                            onClick={() => setOverlayEdit({...overlayEdit, subtitle_text_anchor: 'middle'})}
                            className={`flex-1 p-3 rounded-xl border-2 transition-all font-bold text-sm ${
                              (overlayEdit.subtitle_text_anchor || displayAsset.overlayConfig?.subtitle_text_anchor || 'middle') === 'middle'
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'
                            }`}
                          >
                            Center
                          </button>
                          <button
                            onClick={() => setOverlayEdit({...overlayEdit, subtitle_text_anchor: 'end'})}
                            className={`flex-1 p-3 rounded-xl border-2 transition-all font-bold text-sm ${
                              (overlayEdit.subtitle_text_anchor || displayAsset.overlayConfig?.subtitle_text_anchor || 'middle') === 'end'
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'
                            }`}
                          >
                            Right
                          </button>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={handleUpdateOverlay}
                      disabled={loading}
                      className="w-full bg-indigo-600 text-white py-4 rounded-xl font-black hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50"
                    >
                      {loading ? 'Updating...' : 'Apply Changes'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Feedback Chat */}
          <div className="lg:col-span-6">
            <div className="bg-slate-950 p-12 rounded-[3rem] text-white shadow-2xl relative overflow-hidden flex flex-col gap-6">
              <div className="relative z-10">
                <h3 className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-6">Feedback Loop</h3>
                
                {/* Message list simulation */}
                <div className="max-h-40 overflow-y-auto mb-6 space-y-4 custom-scrollbar pr-4">
                  <div className="flex justify-start">
                    <div className="bg-white/10 p-4 rounded-2xl rounded-tl-none text-sm font-medium border border-white/10 max-w-[80%]">
                      Ready to polish this asset. Any adjustments needed?
                    </div>
                  </div>
                  {(displayAsset.feedbackHistory || displayAsset.feedback_history || []).map((f, i) => (
                    <div key={i} className="flex justify-end">
                      <div className="bg-indigo-600 p-4 rounded-2xl rounded-tr-none text-sm font-black max-w-[80%]">
                        {f}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-4">
                  <input 
                    value={feedback}
                    onChange={e => setFeedback(e.target.value)}
                    placeholder="e.g. 'Make it darker', 'Move the focus'..."
                    className="flex-1 bg-white/10 border-2 border-white/20 rounded-[1.5rem] px-8 py-5 outline-none focus:bg-white/20 focus:border-indigo-400 transition-all font-bold placeholder:text-white/30"
                    onKeyDown={e => e.key === 'Enter' && handleRegenerate()}
                  />
                  <button 
                    onClick={handleRegenerate}
                    disabled={loading || !feedback}
                    className="bg-white text-slate-900 px-10 py-5 rounded-[1.5rem] font-black hover:bg-indigo-50 transition-all active:scale-95 disabled:opacity-30 flex items-center gap-2"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
                    )}
                  </button>
                </div>
              </div>
              <div className="absolute -left-20 -top-20 w-80 h-80 bg-indigo-600/10 blur-[100px] rounded-full"></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssetGenerator;

