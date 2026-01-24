import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BrandDNA, GenerationOption, GeneratedAsset } from '../models/types.js';
import { assetApi } from '../services/assetApi.js';
import TextToolbar from './TextToolbar.js';

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
  const [editingTextElement, setEditingTextElement] = useState<'title' | 'subtitle' | null>(null);
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
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w' | null>(null);
  const [resizeStart, setResizeStart] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const titleTextRef = useRef<HTMLDivElement>(null);
  const subtitleTextRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  
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

  // Handle click outside to deselect text
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (editingTextElement) {
        const target = e.target as HTMLElement;
        if (!target.closest('[contenteditable="true"]') && 
            !target.closest('.fixed') && // Don't close when clicking toolbar
            !target.closest('[class*="resize"]')) { // Don't close when clicking resize handles
          setEditingTextElement(null);
        }
      }
    };

    if (editingTextElement) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [editingTextElement]);

  // Recalculate line breaks in real-time when text or font properties change
  useEffect(() => {
    if (!imageDimensions || !displayAsset?.overlayConfig) return;

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

  // Get numeric font size for calculations (scaled to match displayed/preview dimensions)
  const getFontSizeNumeric = (baseFontSize: number | undefined, isTitle: boolean): number => {
    const dims = getDisplayedImageDimensions();
    if (!dims || !imageDimensions) {
      return isTitle ? 56 : 32;
    }
    
    // Calculate font size using the ACTUAL image width (matching backend logic)
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
    
    // Scale the font size to match the displayed image size
    // This ensures the Canvas measurement matches the preview display
    const scale = dims.displayWidth / imageDimensions.width;
    return calculatedFontSize * scale;
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
    if (editingTextElement === element) {
      return (
        <>
          {/* Corner handles */}
          <div
            className="absolute -top-1 -left-1 w-3 h-3 bg-indigo-600 border border-white rounded-sm cursor-nwse-resize z-30"
            onMouseDown={(e) => {
              e.stopPropagation();
              setIsResizing(true);
              setResizeHandle('nw');
              const currentWidth = overlayEdit.title_max_width_percent !== undefined
                ? overlayEdit.title_max_width_percent
                : (displayAsset?.overlayConfig?.title_max_width_percent || 80);
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
              setResizeHandle('ne');
              const currentWidth = overlayEdit.title_max_width_percent !== undefined
                ? overlayEdit.title_max_width_percent
                : (displayAsset?.overlayConfig?.title_max_width_percent || 80);
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
              setResizeHandle('sw');
              const currentWidth = overlayEdit.title_max_width_percent !== undefined
                ? overlayEdit.title_max_width_percent
                : (displayAsset?.overlayConfig?.title_max_width_percent || 80);
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
              setResizeHandle('se');
              const currentWidth = overlayEdit.title_max_width_percent !== undefined
                ? overlayEdit.title_max_width_percent
                : (displayAsset?.overlayConfig?.title_max_width_percent || 80);
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
              setResizeHandle('n');
            }}
          />
          <div
            className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-1 bg-indigo-600 border border-white rounded-sm cursor-ns-resize z-30"
            onMouseDown={(e) => {
              e.stopPropagation();
              setIsResizing(true);
              setResizeHandle('s');
            }}
          />
          <div
            className="absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-8 bg-indigo-600 border border-white rounded-sm cursor-ew-resize z-30"
            onMouseDown={(e) => {
              e.stopPropagation();
              setIsResizing(true);
              setResizeHandle('w');
              const currentWidth = overlayEdit.title_max_width_percent !== undefined
                ? overlayEdit.title_max_width_percent
                : (displayAsset?.overlayConfig?.title_max_width_percent || 80);
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
              setResizeHandle('e');
              const currentWidth = overlayEdit.title_max_width_percent !== undefined
                ? overlayEdit.title_max_width_percent
                : (displayAsset?.overlayConfig?.title_max_width_percent || 80);
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
      
      // Update overlay edit state for the target element
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
      if (isResizing && resizeStart && resizeHandle && currentAsset) {
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
            const currentMaxWidth = overlayEdit.title_max_width_percent !== undefined
              ? overlayEdit.title_max_width_percent
              : (displayAsset?.overlayConfig?.title_max_width_percent || 80);
            
            let newWidthPercent = currentMaxWidth;
            const currentXPercent = overlayEdit.title_x_percent !== undefined
              ? overlayEdit.title_x_percent
              : (displayAsset?.overlayConfig?.title_x_percent || 50);
            let newXPercent = currentXPercent;
            
            if (resizeHandle.includes('e')) {
              newWidthPercent = Math.max(20, Math.min(95, resizeStart.width + deltaXPercent));
            }
            if (resizeHandle.includes('w')) {
              newWidthPercent = Math.max(20, Math.min(95, resizeStart.width - deltaXPercent));
              // Adjust X position when resizing from left
              newXPercent = Math.max(5, Math.min(95, currentXPercent - deltaXPercent / 2));
            }
            
            const updates: any = {
              title_max_width_percent: newWidthPercent
            };
            if (resizeHandle.includes('w')) {
              updates.title_x_percent = newXPercent;
            }
            setOverlayEdit(prev => ({ ...prev, ...updates }));
            autoSaveOverlay(updates);
          }
        }
      } else if (isDragging && dragStart && currentAsset) {
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
            
            // Update title position
            setOverlayEdit(prev => ({
              ...prev,
              title_x_percent: x,
              title_y_percent: y
            }));
            autoSaveOverlay({
              title_x_percent: x,
              title_y_percent: y
            });
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
            // Update title position
            setOverlayEdit(prev => ({
              ...prev,
              title_x_percent: x,
              title_y_percent: y
            }));
            autoSaveOverlay({
              title_x_percent: x,
              title_y_percent: y
            });
          }
        }
      }
    };
    
    const handleMouseUp = () => {
      setIsDragging(false);
      setDragStart(null);
      setIsResizing(false);
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
  }, [isDragging, isResizing, dragStart, resizeStart, resizeHandle, currentAsset, imageDimensions, overlayEdit, displayAsset]);

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

  const saveOverlay = async (updates?: Partial<typeof overlayEdit>) => {
    if (!currentAsset || currentAsset.type !== 'product') return;
    
    const configToSave = updates ? { ...overlayEdit, ...updates } : overlayEdit;
    
    try {
      setSaving(true);
      // Calculate line breaks using Canvas API for exact match
      const overlayConfigToSend = { ...configToSave };
      
      // Get current text values
      const titleText = configToSave.title !== undefined 
        ? configToSave.title 
        : (displayAsset?.overlayConfig?.title || '');
      const subtitleText = configToSave.subtitle !== undefined 
        ? configToSave.subtitle 
        : (displayAsset?.overlayConfig?.subtitle || '');

      // Calculate title lines if title exists
      if (titleText) {
        const titleMaxWidthPercent = configToSave.title_max_width_percent !== undefined
          ? configToSave.title_max_width_percent
          : (displayAsset?.overlayConfig?.title_max_width_percent || 80);
        const titleMaxWidthPx = getMaxWidthPixelsNumeric(titleMaxWidthPercent);
        
        const titleFontSize = getFontSizeNumeric(
          configToSave.title_font_size !== undefined 
            ? configToSave.title_font_size 
            : displayAsset?.overlayConfig?.title_font_size,
          true
        );
        
        const titleFontFamily = configToSave.title_font_family || 
          displayAsset?.overlayConfig?.title_font_family || 
          'sans-serif';
        const titleFontWeight = configToSave.title_font_weight === 'bold' 
          ? 'bold' 
          : configToSave.title_font_weight === 'light' 
            ? '300' 
            : 'normal';
        const titleLetterSpacing = configToSave.title_letter_spacing === 'wide' 
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
        const subtitleMaxWidthPercent = configToSave.subtitle_max_width_percent !== undefined
          ? configToSave.subtitle_max_width_percent
          : (displayAsset?.overlayConfig?.subtitle_max_width_percent || 80);
        const subtitleMaxWidthPx = getMaxWidthPixelsNumeric(subtitleMaxWidthPercent);
        
        const subtitleFontSize = getFontSizeNumeric(
          configToSave.subtitle_font_size !== undefined 
            ? configToSave.subtitle_font_size 
            : displayAsset?.overlayConfig?.subtitle_font_size,
          false
        );
        
        const subtitleFontFamily = configToSave.subtitle_font_family || 
          displayAsset?.overlayConfig?.subtitle_font_family || 
          'sans-serif';
        const subtitleFontWeight = configToSave.subtitle_font_weight === 'bold' 
          ? 'bold' 
          : configToSave.subtitle_font_weight === 'light' 
            ? '300' 
            : 'normal';
        const subtitleLetterSpacing = configToSave.subtitle_letter_spacing === 'wide' 
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
      // Merge saved changes into overlayEdit to keep UI in sync
      setOverlayEdit({});
    } catch (err) {
      console.error('Overlay update failed:', err);
      // Don't show alert for auto-save failures, just log
    } finally {
      setSaving(false);
    }
  };

  // Debounced auto-save function
  const debouncedSaveRef = useRef<NodeJS.Timeout | null>(null);
  const autoSaveOverlay = useCallback((updates?: Partial<typeof overlayEdit>) => {
    if (debouncedSaveRef.current) {
      clearTimeout(debouncedSaveRef.current);
    }
    debouncedSaveRef.current = setTimeout(() => {
      // Merge updates with current overlayEdit state
      const mergedUpdates = updates ? { ...overlayEdit, ...updates } : overlayEdit;
      saveOverlay(mergedUpdates);
    }, 500);
  }, [overlayEdit]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debouncedSaveRef.current) {
        clearTimeout(debouncedSaveRef.current);
      }
    };
  }, []);
  
  // Auto-save after drag/resize ends
  useEffect(() => {
    if (!isDragging && !isResizing && (dragStart !== null || resizeStart !== null)) {
      autoSaveOverlay();
    }
  }, [isDragging, isResizing, dragStart, resizeStart, autoSaveOverlay]);

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
                  // Close active text element when clicking outside
                  if (editingTextElement && !(e.target as HTMLElement).closest('[contenteditable="true"]')) {
                    setEditingTextElement(null);
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
                      Click on the image to pick title color
                    </div>
                  </div>
                )}
                
                {/* Single Text Overlay */}
                {displayAsset.type === 'product' && displayAsset.overlayConfig && (
                  <>
                    {/* Title Text Block */}
                    {(overlayEdit.title !== undefined ? overlayEdit.title : displayAsset.overlayConfig.title) && (() => {
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
                      const isEditing = editingTextElement === 'title';
                      const titleText = overlayEdit.title !== undefined 
                        ? overlayEdit.title 
                        : (displayAsset.overlayConfig.title || '');
                      
                      return (
                        <div
                          ref={titleTextRef}
                          className={`absolute select-none border-2 ${isEditing ? 'border-dashed border-indigo-400' : 'border-transparent'} ${isEditing ? 'bg-indigo-50/20' : 'bg-transparent'} rounded-lg p-3 ${isEditing ? 'backdrop-blur-sm' : ''} ${isEditing ? 'cursor-text' : 'cursor-move'}`}
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
                            zIndex: isDragging || isEditing ? 20 : 10,
                            wordWrap: 'break-word',
                            overflowWrap: 'break-word',
                            wordBreak: 'normal'
                          }}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            setEditingTextElement(isEditing ? null : 'title');
                          }}
                          onBlur={(e) => {
                            const newText = e.currentTarget.textContent || '';
                            if (newText !== titleText) {
                              setOverlayEdit(prev => ({ ...prev, title: newText }));
                              autoSaveOverlay({ title: newText });
                            }
                            setEditingTextElement(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                              e.currentTarget.blur();
                              setEditingTextElement(null);
                            }
                          }}
                          onPaste={(e) => {
                            e.preventDefault();
                            const text = e.clipboardData.getData('text/plain');
                            document.execCommand('insertText', false, text);
                          }}
                          onMouseDown={(e) => {
                            if (eyedropperActive || isEditing) {
                              if (!isEditing) {
                                e.stopPropagation();
                              }
                              return;
                            }
                            e.preventDefault();
                            setIsDragging(true);
                            const imageContainer = e.currentTarget.parentElement;
                            if (imageContainer && imageDimensions) {
                              const imageBounds = getImageDisplayBounds(imageContainer);
                              if (imageBounds) {
                                const relativeX = e.clientX - imageBounds.x;
                                const relativeY = e.clientY - imageBounds.y;
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
                          contentEditable={isEditing}
                          suppressContentEditableWarning={true}
                        >
                          {isEditing && renderResizeHandles('title')}
                          {calculatedTitleLines.length > 0 
                            ? calculatedTitleLines.join('\n')
                            : titleText}
                        </div>
                      );
                    })()}

                    {/* Floating Text Toolbar */}
                    {editingTextElement === 'title' && activeBrand && (
                      <TextToolbar
                        elementType="title"
                        overlayConfig={displayAsset.overlayConfig}
                        overlayEdit={overlayEdit}
                        onUpdate={(updates) => {
                          setOverlayEdit(prev => ({ ...prev, ...updates }));
                          autoSaveOverlay(updates);
                        }}
                        textElementRef={titleTextRef}
                        activeBrand={activeBrand}
                        onEyedropperClick={setEyedropperActive}
                      />
                    )}
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

            {/* Overlay Info for Product Assets */}
            {displayAsset.type === 'product' && displayAsset.overlayConfig && (
              <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Text Overlay</h3>
                  {saving && (
                    <span className="text-xs font-medium text-indigo-600">Saving...</span>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="text-xl font-black text-slate-800">{stripMarkdown(displayAsset.overlayConfig.title || '')}</p>
                  </div>
                  <div className="flex gap-4 text-xs text-slate-500">
                    <span>Title: {displayAsset.overlayConfig.title_font_family}</span>
                    <span>•</span>
                    <span>{displayAsset.overlayConfig.title_font_weight}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-4">Double-click text on the image to edit • Drag to move • Use resize handles to adjust size</p>
                </div>
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

