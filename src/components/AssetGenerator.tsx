import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BrandDNA, GeneratedAsset } from '../models/types.js';
import { assetApi } from '../services/assetApi.js';
import TextToolbar from './TextToolbar.js';
import { getFontFamilyString, loadGoogleFont, GOOGLE_FONTS, FONT_MAPPING } from '../utils/googleFonts.js';
import { useBrandAssets } from '../hooks/useBrandAssets.js';

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
  const [loading, setLoading] = useState(false);
  const [currentAsset, setCurrentAsset] = useState<GeneratedAsset | null>(null);
  const [feedback, setFeedback] = useState('');
  const [editingTextElement, setEditingTextElement] = useState<'title' | 'subtitle' | null>(null);
  const [overlayEdit, setOverlayEdit] = useState<{
    title?: string;
    subtitle?: string;
    // Title properties - completely separate
    title_font_family?: string;
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
    subtitle_font_family?: string;
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
  
  const [eyedropperActive, setEyedropperActive] = useState<'title' | 'subtitle' | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  
  const [isDragging, setIsDragging] = useState(false);
  const [draggingElement, setDraggingElement] = useState<'title' | 'subtitle' | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w' | null>(null);
  const [resizeStart, setResizeStart] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const titleTextRef = useRef<HTMLDivElement>(null);
  const subtitleTextRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const { uploadAsset } = useBrandAssets(activeBrand?.id);
  
  // Helper to get effective transform value (checks overlayEdit first, then displayAsset config)
  const getEffectiveTransform = (
    type: 'title' | 'subtitle'
  ): 'uppercase' | 'lowercase' | 'capitalize' | 'none' => {
    const key = type === 'title' ? 'title_font_transform' : 'subtitle_font_transform';
    if (overlayEdit[key] !== undefined) {
      return overlayEdit[key] as 'uppercase' | 'lowercase' | 'capitalize' | 'none';
    }
    return (displayAsset?.overlayConfig?.[key] as 'uppercase' | 'lowercase' | 'capitalize' | 'none') || 'none';
  };

  // Helper to apply text transform (matching backend behavior)
  const applyTextTransform = (
    text: string,
    transform: 'uppercase' | 'lowercase' | 'capitalize' | 'none'
  ): string => {
    if (!text) return '';
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
  
  // Store calculated line breaks for preview display
  const [calculatedTitleLines, setCalculatedTitleLines] = useState<string[]>([]);
  const [calculatedSubtitleLines, setCalculatedSubtitleLines] = useState<string[]>([]);
  
  // Compute display asset and image URL from current asset
  const displayAsset = currentAsset;
  // Use base image URL (without overlays) so we can render our own overlay on top
  const imageUrl = currentAsset?.baseImageUrl || currentAsset?.base_image_url || currentAsset?.imageUrl || currentAsset?.image_url || '';
  // For download, use the final image_url with overlays applied (from backend)
  const finalImageUrl = currentAsset?.imageUrl || currentAsset?.image_url || imageUrl;
  
  // Generate image from frontend preview (exact match)
  const generateImageFromPreview = async (): Promise<string> => {
    if (!imageUrl || !imageDimensions) {
      throw new Error('Image not loaded');
    }

    // Wait for fonts to load
    await document.fonts.ready;

    // Create canvas with actual image dimensions
    const canvas = document.createElement('canvas');
    canvas.width = imageDimensions.width;
    canvas.height = imageDimensions.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');

    // Load and draw base image
    const img = new Image();
    img.crossOrigin = imageUrl.startsWith('data:') ? undefined : 'anonymous';
    
    await new Promise<void>((resolve, reject) => {
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve();
      };
      img.onerror = reject;
      img.src = imageUrl;
    });

    // Get overlay config values
    const titleText = overlayEdit.title !== undefined 
      ? overlayEdit.title 
      : (displayAsset?.overlayConfig?.title || '');
    const subtitleText = overlayEdit.subtitle !== undefined 
      ? overlayEdit.subtitle 
      : (displayAsset?.overlayConfig?.subtitle || '');

    // Draw title if exists
    if (titleText) {
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
      
      const titleFontSize = getFontSizeNumeric(
        overlayEdit.title_font_size !== undefined 
          ? overlayEdit.title_font_size 
          : displayAsset?.overlayConfig?.title_font_size,
        true
      );
      
      const titleFontFamilyRaw = overlayEdit.title_font_family || displayAsset.overlayConfig.title_font_family || 'sans-serif';
      const titleFontFamilyMapped = FONT_MAPPING[titleFontFamilyRaw] || titleFontFamilyRaw;
      const titleFontFamily = getFontStackForMeasurement(titleFontFamilyRaw);
      
      const titleColor = overlayEdit.title_color_hex || displayAsset.overlayConfig?.title_color_hex || '#FFFFFF';
      const titleOpacity = overlayEdit.title_opacity !== undefined ? overlayEdit.title_opacity : (displayAsset.overlayConfig.title_opacity !== undefined ? displayAsset.overlayConfig.title_opacity : 1);
      const titleTransform = getEffectiveTransform('title');
      const titleTextTransformed = applyTextTransform(titleText, titleTransform);
      
      const titleMaxWidthPercent = overlayEdit.title_max_width_percent !== undefined
        ? overlayEdit.title_max_width_percent
        : (displayAsset?.overlayConfig?.title_max_width_percent || 80);
      const titleMaxWidthPx = (canvas.width * titleMaxWidthPercent) / 100;
      
      const titleFontWeight = overlayEdit.title_font_weight === 'bold' ? 'bold' : overlayEdit.title_font_weight === 'light' ? '300' : 'normal';
      const titleLetterSpacing = overlayEdit.title_letter_spacing === 'wide' ? '0.15em' : 'normal';
      
      // Calculate lines using same method as preview
      const titleLines = await calculateTextLinesWithCanvas(
        titleTextTransformed,
        titleMaxWidthPx,
        titleFontSize,
        titleFontFamilyMapped,
        titleFontWeight,
        titleLetterSpacing
      );

      // Set font
      ctx.font = `${titleFontWeight} ${titleFontSize}px ${titleFontFamily}`;
      ctx.fillStyle = titleColor;
      ctx.globalAlpha = titleOpacity;
      ctx.textAlign = (overlayEdit.title_text_anchor || displayAsset.overlayConfig?.title_text_anchor || 'middle') === 'start' ? 'left' : 
                      (overlayEdit.title_text_anchor || displayAsset.overlayConfig?.title_text_anchor || 'middle') === 'end' ? 'right' : 'center';
      ctx.textBaseline = 'top';
      
      // Apply letter spacing (approximate)
      const letterSpacingValue = overlayEdit.title_letter_spacing === 'wide' ? titleFontSize * 0.15 : 0;
      
      // Calculate position
      const centerX = (canvas.width * titleXPercent) / 100;
      const centerY = (canvas.height * titleYPercent) / 100;
      const lineHeight = titleFontSize * 1.2;
      const totalHeight = titleLines.length * lineHeight;
      const startY = centerY - (totalHeight / 2) + lineHeight;
      
      // Draw each line
      titleLines.forEach((line, index) => {
        const y = startY + (index * lineHeight);
        let x = centerX;
        
        if (ctx.textAlign === 'left') {
          x = centerX - (titleMaxWidthPx / 2);
        } else if (ctx.textAlign === 'right') {
          x = centerX + (titleMaxWidthPx / 2);
        }
        
        // Draw text with letter spacing approximation
        if (letterSpacingValue > 0) {
          let currentX = x;
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            ctx.fillText(char, currentX, y);
            const charWidth = ctx.measureText(char).width;
            currentX += charWidth + letterSpacingValue;
          }
        } else {
          ctx.fillText(line, x, y);
        }
      });
      
      ctx.globalAlpha = 1;
    }

    // Draw subtitle if exists
    if (subtitleText) {
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
      
      const subtitleFontSize = getFontSizeNumeric(
        overlayEdit.subtitle_font_size !== undefined 
          ? overlayEdit.subtitle_font_size 
          : displayAsset?.overlayConfig?.subtitle_font_size,
        false
      );
      
      const subtitleFontFamilyRaw = overlayEdit.subtitle_font_family || displayAsset.overlayConfig.subtitle_font_family || 'sans-serif';
      const subtitleFontFamilyMapped = FONT_MAPPING[subtitleFontFamilyRaw] || subtitleFontFamilyRaw;
      const subtitleFontFamily = getFontStackForMeasurement(subtitleFontFamilyRaw);
      
      const subtitleColor = overlayEdit.subtitle_color_hex || displayAsset.overlayConfig?.subtitle_color_hex || '#FFFFFF';
      const subtitleOpacity = overlayEdit.subtitle_opacity !== undefined ? overlayEdit.subtitle_opacity : (displayAsset.overlayConfig.subtitle_opacity !== undefined ? displayAsset.overlayConfig.subtitle_opacity : 0.9);
      const subtitleTransform = getEffectiveTransform('subtitle');
      const subtitleTextTransformed = applyTextTransform(subtitleText, subtitleTransform);
      
      const subtitleMaxWidthPercent = overlayEdit.subtitle_max_width_percent !== undefined
        ? overlayEdit.subtitle_max_width_percent
        : (displayAsset?.overlayConfig?.subtitle_max_width_percent || 80);
      const subtitleMaxWidthPx = (canvas.width * subtitleMaxWidthPercent) / 100;
      
      const subtitleFontWeight = overlayEdit.subtitle_font_weight === 'bold' ? 'bold' : overlayEdit.subtitle_font_weight === 'light' ? '300' : 'normal';
      const subtitleLetterSpacing = overlayEdit.subtitle_letter_spacing === 'wide' ? '0.15em' : 'normal';
      
      // Calculate lines using same method as preview
      const subtitleLines = await calculateTextLinesWithCanvas(
        subtitleTextTransformed,
        subtitleMaxWidthPx,
        subtitleFontSize,
        subtitleFontFamilyMapped,
        subtitleFontWeight,
        subtitleLetterSpacing
      );

      // Set font
      ctx.font = `${subtitleFontWeight} ${subtitleFontSize}px ${subtitleFontFamily}`;
      ctx.fillStyle = subtitleColor;
      ctx.globalAlpha = subtitleOpacity;
      ctx.textAlign = (overlayEdit.subtitle_text_anchor || displayAsset.overlayConfig?.subtitle_text_anchor || 'middle') === 'start' ? 'left' : 
                      (overlayEdit.subtitle_text_anchor || displayAsset.overlayConfig?.subtitle_text_anchor || 'middle') === 'end' ? 'right' : 'center';
      ctx.textBaseline = 'top';
      
      // Apply letter spacing (approximate)
      const letterSpacingValue = overlayEdit.subtitle_letter_spacing === 'wide' ? subtitleFontSize * 0.15 : 0;
      
      // Calculate position
      const centerX = (canvas.width * subtitleXPercent) / 100;
      const centerY = (canvas.height * subtitleYPercent) / 100;
      const lineHeight = subtitleFontSize * 1.2;
      const totalHeight = subtitleLines.length * lineHeight;
      const startY = centerY - (totalHeight / 2) + lineHeight;
      
      // Draw each line
      subtitleLines.forEach((line, index) => {
        const y = startY + (index * lineHeight);
        let x = centerX;
        
        if (ctx.textAlign === 'left') {
          x = centerX - (subtitleMaxWidthPx / 2);
        } else if (ctx.textAlign === 'right') {
          x = centerX + (subtitleMaxWidthPx / 2);
        }
        
        // Draw text with letter spacing approximation
        if (letterSpacingValue > 0) {
          let currentX = x;
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            ctx.fillText(char, currentX, y);
            const charWidth = ctx.measureText(char).width;
            currentX += charWidth + letterSpacingValue;
          }
        } else {
          ctx.fillText(line, x, y);
        }
      });
      
      ctx.globalAlpha = 1;
    }

    return canvas.toDataURL('image/png');
  };

  // Download handler - downloads the frontend-generated image (exact match with preview)
  const handleDownload = async () => {
    if (!imageUrl || !imageDimensions || !currentAsset) return;
    
    try {
      const dataUrl = await generateImageFromPreview();
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `asset-${currentAsset.id || Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Download failed:', err);
      alert('Failed to generate download. Please try again.');
    }
  };

  // Save handler - saves overlay changes and then uploads the final image to brand assets
  const handleSave = async () => {
    if (!currentAsset || !activeBrand?.id) {
      alert('Please select a brand first');
      return;
    }

    try {
      setSaving(true);
      
      // First, save any pending overlay changes using saveOverlay
      // This will update the asset with the latest overlay config and regenerate the image
      await saveOverlay(overlayEdit);
      
      // Wait for state to update and get the latest final image URL
      // The saveOverlay function updates currentAsset state, so we need to wait a moment
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Get the updated final image URL from the current asset state
      // Since saveOverlay updates currentAsset, finalImageUrl will be updated
      const imageToSave = currentAsset?.imageUrl || currentAsset?.image_url;
      
      if (!imageToSave) {
        alert('No image available to save');
        setSaving(false);
        return;
      }

      // Convert image URL to base64
      const response = await fetch(imageToSave);
      if (!response.ok) {
        throw new Error('Failed to fetch image');
      }
      
      const blob = await response.blob();
      const reader = new FileReader();
      
      reader.onloadend = async () => {
        const base64data = reader.result as string;
        try {
          await uploadAsset(base64data, 'brand_image');
          alert('Image saved to brand assets successfully!');
        } catch (err) {
          console.error('Upload failed:', err);
          alert('Failed to upload image. Please try again.');
        } finally {
          setSaving(false);
        }
      };
      
      reader.onerror = () => {
        setSaving(false);
        alert('Failed to process image. Please try again.');
      };
      
      reader.readAsDataURL(blob);
    } catch (err) {
      console.error('Save failed:', err);
      setSaving(false);
      alert('Failed to save image. Please try again.');
    }
  };
  
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
        
        const titleFontFamilyRaw = overlayEdit.title_font_family || 
          displayAsset?.overlayConfig?.title_font_family || 
          'sans-serif';
        const titleFontFamily = FONT_MAPPING[titleFontFamilyRaw] || titleFontFamilyRaw;
        // Load Google Font if needed
        if (GOOGLE_FONTS.some(f => f.family === titleFontFamily)) {
          loadGoogleFont(titleFontFamily).catch(() => {});
        }
        const titleFontWeight = overlayEdit.title_font_weight === 'bold' 
          ? 'bold' 
          : overlayEdit.title_font_weight === 'light' 
            ? '300' 
            : 'normal';
        const titleLetterSpacing = overlayEdit.title_letter_spacing === 'wide' 
          ? '0.15em' 
          : 'normal';
        
        // Apply transform before calculating lines to match backend behavior
        const titleTransform = getEffectiveTransform('title');
        const titleTextTransformed = applyTextTransform(titleText, titleTransform);
        
        const titleLines = await calculateTextLinesWithCanvas(
          titleTextTransformed,
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
        
        const subtitleFontFamilyRaw = overlayEdit.subtitle_font_family || 
          displayAsset?.overlayConfig?.subtitle_font_family || 
          'sans-serif';
        const subtitleFontFamily = FONT_MAPPING[subtitleFontFamilyRaw] || subtitleFontFamilyRaw;
        // Load Google Font if needed
        if (GOOGLE_FONTS.some(f => f.family === subtitleFontFamily)) {
          loadGoogleFont(subtitleFontFamily).catch(() => {});
        }
        const subtitleFontWeight = overlayEdit.subtitle_font_weight === 'bold' 
          ? 'bold' 
          : overlayEdit.subtitle_font_weight === 'light' 
            ? '300' 
            : 'normal';
        const subtitleLetterSpacing = overlayEdit.subtitle_letter_spacing === 'wide' 
          ? '0.15em' 
          : 'normal';
        
        // Apply transform before calculating lines to match backend behavior
        const subtitleTransform = getEffectiveTransform('subtitle');
        const subtitleTextTransformed = applyTextTransform(subtitleText, subtitleTransform);
        
        const subtitleLines = await calculateTextLinesWithCanvas(
          subtitleTextTransformed,
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

  // Load fonts when they change and force re-render when loaded
  useEffect(() => {
    const loadFonts = async () => {
      if (!displayAsset?.overlayConfig) {
        setFontsLoaded(true);
        return;
      }
      
      setFontsLoaded(false);
      
      const titleFontFamilyRaw = overlayEdit.title_font_family || displayAsset.overlayConfig.title_font_family || 'sans-serif';
      const titleFontFamilyMapped = FONT_MAPPING[titleFontFamilyRaw] || titleFontFamilyRaw;
      const titleIsGoogleFont = GOOGLE_FONTS.some(f => f.family === titleFontFamilyMapped);
      
      const subtitleFontFamilyRaw = overlayEdit.subtitle_font_family || displayAsset.overlayConfig.subtitle_font_family || 'sans-serif';
      const subtitleFontFamilyMapped = FONT_MAPPING[subtitleFontFamilyRaw] || subtitleFontFamilyRaw;
      const subtitleIsGoogleFont = GOOGLE_FONTS.some(f => f.family === subtitleFontFamilyMapped);
      
      const loadPromises: Promise<void>[] = [];
      
      if (titleIsGoogleFont) {
        loadPromises.push(loadGoogleFont(titleFontFamilyMapped).catch(() => {}));
      }
      
      if (subtitleIsGoogleFont) {
        loadPromises.push(loadGoogleFont(subtitleFontFamilyMapped).catch(() => {}));
      }
      
      await Promise.all(loadPromises);
      setFontsLoaded(true);
    };
    
    loadFonts();
  }, [overlayEdit.title_font_family, overlayEdit.subtitle_font_family, displayAsset?.overlayConfig]);
  
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
  const getFontStackForMeasurement = (family: string): string => {
    // Map old font names to Google Fonts
    const mappedFamily = FONT_MAPPING[family] || family;
    
    // Check if it's a Google Font
    const isGoogleFont = GOOGLE_FONTS.some(f => f.family === mappedFamily);
    if (isGoogleFont) {
      // Load font synchronously - it will be loaded by useEffect before render
      // But ensure it's loaded here too for immediate updates
      loadGoogleFont(mappedFamily).catch(() => {});
      return getFontFamilyString(mappedFamily);
    }
    
    // Fallback for old system fonts
    switch (family) {
      case 'serif':
        return 'Times New Roman, Times, serif';
      case 'cursive':
      case 'handwritten':
        return 'Times New Roman, Times, serif';
      case 'sans-serif':
      default:
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
              const isTitle = element === 'title';
              const currentWidth = isTitle
                ? (overlayEdit.title_max_width_percent !== undefined
                    ? overlayEdit.title_max_width_percent
                    : (displayAsset?.overlayConfig?.title_max_width_percent || 80))
                : (overlayEdit.subtitle_max_width_percent !== undefined
                    ? overlayEdit.subtitle_max_width_percent
                    : (displayAsset?.overlayConfig?.subtitle_max_width_percent || 80));
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
              const isTitle = element === 'title';
              const currentWidth = isTitle
                ? (overlayEdit.title_max_width_percent !== undefined
                    ? overlayEdit.title_max_width_percent
                    : (displayAsset?.overlayConfig?.title_max_width_percent || 80))
                : (overlayEdit.subtitle_max_width_percent !== undefined
                    ? overlayEdit.subtitle_max_width_percent
                    : (displayAsset?.overlayConfig?.subtitle_max_width_percent || 80));
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
              const isTitle = element === 'title';
              const currentWidth = isTitle
                ? (overlayEdit.title_max_width_percent !== undefined
                    ? overlayEdit.title_max_width_percent
                    : (displayAsset?.overlayConfig?.title_max_width_percent || 80))
                : (overlayEdit.subtitle_max_width_percent !== undefined
                    ? overlayEdit.subtitle_max_width_percent
                    : (displayAsset?.overlayConfig?.subtitle_max_width_percent || 80));
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
              const isTitle = element === 'title';
              const currentWidth = isTitle
                ? (overlayEdit.title_max_width_percent !== undefined
                    ? overlayEdit.title_max_width_percent
                    : (displayAsset?.overlayConfig?.title_max_width_percent || 80))
                : (overlayEdit.subtitle_max_width_percent !== undefined
                    ? overlayEdit.subtitle_max_width_percent
                    : (displayAsset?.overlayConfig?.subtitle_max_width_percent || 80));
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
              const isTitle = element === 'title';
              const currentWidth = isTitle
                ? (overlayEdit.title_max_width_percent !== undefined
                    ? overlayEdit.title_max_width_percent
                    : (displayAsset?.overlayConfig?.title_max_width_percent || 80))
                : (overlayEdit.subtitle_max_width_percent !== undefined
                    ? overlayEdit.subtitle_max_width_percent
                    : (displayAsset?.overlayConfig?.subtitle_max_width_percent || 80));
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
              const isTitle = element === 'title';
              const currentWidth = isTitle
                ? (overlayEdit.title_max_width_percent !== undefined
                    ? overlayEdit.title_max_width_percent
                    : (displayAsset?.overlayConfig?.title_max_width_percent || 80))
                : (overlayEdit.subtitle_max_width_percent !== undefined
                    ? overlayEdit.subtitle_max_width_percent
                    : (displayAsset?.overlayConfig?.subtitle_max_width_percent || 80));
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
            
            // Determine which element is being resized based on editingTextElement
            const isResizingTitle = editingTextElement === 'title';
            const currentMaxWidth = isResizingTitle
              ? (overlayEdit.title_max_width_percent !== undefined
                  ? overlayEdit.title_max_width_percent
                  : (displayAsset?.overlayConfig?.title_max_width_percent || 80))
              : (overlayEdit.subtitle_max_width_percent !== undefined
                  ? overlayEdit.subtitle_max_width_percent
                  : (displayAsset?.overlayConfig?.subtitle_max_width_percent || 80));
            
            let newWidthPercent = currentMaxWidth;
            const currentXPercent = isResizingTitle
              ? (overlayEdit.title_x_percent !== undefined
                  ? overlayEdit.title_x_percent
                  : (displayAsset?.overlayConfig?.title_x_percent || 50))
              : (overlayEdit.subtitle_x_percent !== undefined
                  ? overlayEdit.subtitle_x_percent
                  : (displayAsset?.overlayConfig?.subtitle_x_percent || 50));
            let newXPercent = currentXPercent;
            
            if (resizeHandle.includes('e')) {
              newWidthPercent = Math.max(20, Math.min(95, resizeStart.width + deltaXPercent));
            }
            if (resizeHandle.includes('w')) {
              newWidthPercent = Math.max(20, Math.min(95, resizeStart.width - deltaXPercent));
              // Adjust X position when resizing from left
              newXPercent = Math.max(5, Math.min(95, currentXPercent - deltaXPercent / 2));
            }
            
            const updates: any = {};
            if (isResizingTitle) {
              updates.title_max_width_percent = newWidthPercent;
              if (resizeHandle.includes('w')) {
                updates.title_x_percent = newXPercent;
              }
            } else {
              updates.subtitle_max_width_percent = newWidthPercent;
              if (resizeHandle.includes('w')) {
                updates.subtitle_x_percent = newXPercent;
              }
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
            
            // Use the stored draggingElement instead of recalculating
            if (draggingElement === 'title') {
              setOverlayEdit(prev => ({
                ...prev,
                title_x_percent: x,
                title_y_percent: y
              }));
              autoSaveOverlay({
                title_x_percent: x,
                title_y_percent: y
              });
            } else if (draggingElement === 'subtitle') {
              setOverlayEdit(prev => ({
                ...prev,
                subtitle_x_percent: x,
                subtitle_y_percent: y
              }));
              autoSaveOverlay({
                subtitle_x_percent: x,
                subtitle_y_percent: y
              });
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
            // Use the stored draggingElement instead of recalculating
            if (draggingElement === 'title') {
              setOverlayEdit(prev => ({
                ...prev,
                title_x_percent: x,
                title_y_percent: y
              }));
              autoSaveOverlay({
                title_x_percent: x,
                title_y_percent: y
              });
            } else if (draggingElement === 'subtitle') {
              setOverlayEdit(prev => ({
                ...prev,
                subtitle_x_percent: x,
                subtitle_y_percent: y
              }));
              autoSaveOverlay({
                subtitle_x_percent: x,
                subtitle_y_percent: y
              });
            }
          }
        }
      }
    };
    
    const handleMouseUp = () => {
      setIsDragging(false);
      setDraggingElement(null);
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
  }, [isDragging, isResizing, dragStart, resizeStart, resizeHandle, draggingElement, currentAsset, imageDimensions, overlayEdit, displayAsset]);

  const handleRegenerate = async () => {
    if (!currentAsset || !feedback) return;
    setLoading(true);
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
      const overlayConfigToSend: any = { ...configToSave };
      
      // Always include transform values using the helper to ensure backend gets correct value
      overlayConfigToSend.title_font_transform = getEffectiveTransform('title');
      overlayConfigToSend.subtitle_font_transform = getEffectiveTransform('subtitle');
      
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
        
        const titleFontFamilyRaw = configToSave.title_font_family || 
          displayAsset?.overlayConfig?.title_font_family || 
          'sans-serif';
        const titleFontFamily = FONT_MAPPING[titleFontFamilyRaw] || titleFontFamilyRaw;
        const titleFontWeight = configToSave.title_font_weight === 'bold' 
          ? 'bold' 
          : configToSave.title_font_weight === 'light' 
            ? '300' 
            : 'normal';
        const titleLetterSpacing = configToSave.title_letter_spacing === 'wide' 
          ? '0.15em' 
          : 'normal';
        
        // Apply transform before calculating lines to match backend behavior
        const titleTransform = getEffectiveTransform('title');
        const titleTextTransformed = applyTextTransform(titleText, titleTransform);
        
        const titleLines = await calculateTextLinesWithCanvas(
          titleTextTransformed,
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
        
        const subtitleFontFamilyRaw = configToSave.subtitle_font_family || 
          displayAsset?.overlayConfig?.subtitle_font_family || 
          'sans-serif';
        const subtitleFontFamily = FONT_MAPPING[subtitleFontFamilyRaw] || subtitleFontFamilyRaw;
        const subtitleFontWeight = configToSave.subtitle_font_weight === 'bold' 
          ? 'bold' 
          : configToSave.subtitle_font_weight === 'light' 
            ? '300' 
            : 'normal';
        const subtitleLetterSpacing = configToSave.subtitle_letter_spacing === 'wide' 
          ? '0.15em' 
          : 'normal';
        
        // Apply transform before calculating lines to match backend behavior
        const subtitleTransform = getEffectiveTransform('subtitle');
        const subtitleTextTransformed = applyTextTransform(subtitleText, subtitleTransform);
        
        const subtitleLines = await calculateTextLinesWithCanvas(
          subtitleTextTransformed,
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

  // Immediate auto-save function (no debounce)
  const autoSaveOverlay = useCallback((updates?: Partial<typeof overlayEdit>) => {
    // Use a ref to get the latest overlayEdit state
    const latestOverlayEdit = overlayEditRef.current;
    // Merge updates with current overlayEdit state
    const mergedUpdates = updates ? { ...latestOverlayEdit, ...updates } : latestOverlayEdit;
    saveOverlay(mergedUpdates);
  }, []);

  // Ref to track latest overlayEdit for auto-save
  const overlayEditRef = useRef(overlayEdit);
  useEffect(() => {
    overlayEditRef.current = overlayEdit;
  }, [overlayEdit]);
  
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

  if (!displayAsset) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-10">
      <div className="bg-indigo-50 p-6 rounded-full mb-6">
        <svg className="w-12 h-12 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
      </div>
      <h2 className="text-2xl font-black text-slate-800 mb-2">No Asset Selected</h2>
      <p className="text-slate-500 max-w-md">Create a new asset to start editing.</p>
    </div>
  );

  const campaignImages = displayAsset?.campaignImages || displayAsset?.campaign_images || [];

  return (
    <div className="space-y-12 max-w-6xl mx-auto pb-20 px-4 sm:px-0">
      {/* Output / Results View */}
      {displayAsset && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 animate-in fade-in slide-in-from-bottom-12 duration-1000">
          <div className="lg:col-span-6 space-y-8">
            {/* Visual Preview with Draggable Text Overlay */}
            <div className="relative group rounded-[4rem] overflow-hidden shadow-[0_48px_80px_-24px_rgba(0,0,0,0.3)] ring-1 ring-slate-200">
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
                
                {/* Two Separate Text Overlays - Title and Subtitle */}
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
                      
                      // Get font family and ensure it's loaded
                      const titleFontFamilyRaw = overlayEdit.title_font_family || displayAsset.overlayConfig.title_font_family || 'sans-serif';
                      const titleFontFamilyMapped = FONT_MAPPING[titleFontFamilyRaw] || titleFontFamilyRaw;
                      const titleFontFamily = getFontStackForMeasurement(titleFontFamilyRaw);
                      
                      return (
                        <div
                          key={`title-${titleFontFamilyRaw}-${overlayEdit.title_font_size || displayAsset.overlayConfig.title_font_size || ''}`}
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
                            fontFamily: titleFontFamily,
                            fontWeight: overlayEdit.title_font_weight === 'bold' ? 'bold' : overlayEdit.title_font_weight === 'light' ? '300' : 'normal',
                            fontSize: getFontSize(titleFontSize, true),
                            letterSpacing: overlayEdit.title_letter_spacing === 'wide' ? '0.15em' : 'normal',
                            textTransform: getEffectiveTransform('title'),
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
                            setDraggingElement('title');
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
                    
                    {/* Subtitle Text Block */}
                    {(overlayEdit.subtitle !== undefined ? overlayEdit.subtitle : displayAsset.overlayConfig.subtitle) && (() => {
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
                      const isEditing = editingTextElement === 'subtitle';
                      const subtitleText = overlayEdit.subtitle !== undefined 
                        ? overlayEdit.subtitle 
                        : (displayAsset.overlayConfig.subtitle || '');
                      
                      // Get font family and ensure it's loaded
                      const subtitleFontFamilyRaw = overlayEdit.subtitle_font_family || displayAsset.overlayConfig.subtitle_font_family || 'sans-serif';
                      const subtitleFontFamilyMapped = FONT_MAPPING[subtitleFontFamilyRaw] || subtitleFontFamilyRaw;
                      const subtitleFontFamily = getFontStackForMeasurement(subtitleFontFamilyRaw);
                      
                      return (
                        <div
                          key={`subtitle-${subtitleFontFamilyRaw}-${overlayEdit.subtitle_font_size || displayAsset.overlayConfig.subtitle_font_size || ''}`}
                          ref={subtitleTextRef}
                          className={`absolute select-none border-2 ${isEditing ? 'border-dashed border-blue-400' : 'border-transparent'} ${isEditing ? 'bg-blue-50/20' : 'bg-transparent'} rounded-lg p-3 ${isEditing ? 'backdrop-blur-sm' : ''} ${isEditing ? 'cursor-text' : 'cursor-move'}`}
                          style={{
                            ...getOverlayPosition(subtitleXPercent, subtitleYPercent),
                            textAlign: (overlayEdit.subtitle_text_anchor || displayAsset.overlayConfig?.subtitle_text_anchor || 'middle') === 'start' ? 'left' : (overlayEdit.subtitle_text_anchor || displayAsset.overlayConfig?.subtitle_text_anchor || 'middle') === 'end' ? 'right' : 'center',
                            width: getMaxWidthPixels(overlayEdit.subtitle_max_width_percent !== undefined ? overlayEdit.subtitle_max_width_percent : (displayAsset.overlayConfig.subtitle_max_width_percent || 80)),
                            maxWidth: getMaxWidthPixels(overlayEdit.subtitle_max_width_percent !== undefined ? overlayEdit.subtitle_max_width_percent : (displayAsset.overlayConfig.subtitle_max_width_percent || 80)),
                            padding: '0.5rem',
                            color: overlayEdit.subtitle_color_hex || displayAsset.overlayConfig?.subtitle_color_hex || '#FFFFFF',
                            opacity: overlayEdit.subtitle_opacity !== undefined ? overlayEdit.subtitle_opacity : (displayAsset.overlayConfig.subtitle_opacity !== undefined ? displayAsset.overlayConfig.subtitle_opacity : 0.9),
                            fontFamily: subtitleFontFamily,
                            fontWeight: overlayEdit.subtitle_font_weight === 'bold' ? 'bold' : overlayEdit.subtitle_font_weight === 'light' ? '300' : 'normal',
                            fontSize: getFontSize(subtitleFontSize, false),
                            letterSpacing: overlayEdit.subtitle_letter_spacing === 'wide' ? '0.15em' : 'normal',
                            textTransform: getEffectiveTransform('subtitle'),
                            filter: 'drop-shadow(2px 2px 4px rgba(0,0,0,0.7))',
                            pointerEvents: 'all',
                            zIndex: isDragging || isEditing ? 20 : 10,
                            wordWrap: 'break-word',
                            overflowWrap: 'break-word',
                            wordBreak: 'normal'
                          }}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            setEditingTextElement(isEditing ? null : 'subtitle');
                          }}
                          onBlur={(e) => {
                            const newText = e.currentTarget.textContent || '';
                            if (newText !== subtitleText) {
                              setOverlayEdit(prev => ({ ...prev, subtitle: newText }));
                              autoSaveOverlay({ subtitle: newText });
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
                            setDraggingElement('subtitle');
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
                          {isEditing && renderResizeHandles('subtitle')}
                          {calculatedSubtitleLines.length > 0 
                            ? calculatedSubtitleLines.join('\n')
                            : subtitleText}
                        </div>
                      );
                    })()}

                    {/* Floating Text Toolbar */}
                    {editingTextElement && activeBrand && (
                      <TextToolbar
                        elementType={editingTextElement}
                        overlayConfig={displayAsset.overlayConfig}
                        overlayEdit={overlayEdit}
                        onUpdate={(updates) => {
                          setOverlayEdit(prev => ({ ...prev, ...updates }));
                          autoSaveOverlay(updates);
                        }}
                        textElementRef={editingTextElement === 'title' ? titleTextRef : subtitleTextRef}
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
                  <div className="flex items-center gap-3">
                    {saving && (
                      <span className="text-xs font-medium text-indigo-600">Saving...</span>
                    )}
                    <button
                      onClick={handleDownload}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={!activeBrand?.id || saving || !currentAsset}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                      Save
                    </button>
                  </div>
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

