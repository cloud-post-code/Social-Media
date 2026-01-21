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
    font_family?: 'sans-serif' | 'serif' | 'cursive' | 'handwritten';
    font_weight?: 'light' | 'regular' | 'bold';
    font_transform?: 'uppercase' | 'lowercase' | 'capitalize' | 'none';
    letter_spacing?: 'normal' | 'wide';
    text_color_hex?: string; // Legacy
    title_color_hex?: string; // Separate color for title
    subtitle_color_hex?: string; // Separate color for subtitle
    // New: Pixel-based positioning
    x_percent?: number;
    y_percent?: number;
    text_anchor?: 'start' | 'middle' | 'end';
    title_text_anchor?: 'start' | 'middle' | 'end'; // Separate anchor for title
    subtitle_text_anchor?: 'start' | 'middle' | 'end'; // Separate anchor for subtitle
    // Legacy: String-based position
    position?: 'top-center' | 'bottom-left' | 'bottom-right' | 'center-middle' | 'top-left' | 'top-right' | 'center-left' | 'center-right' | 'floating-center';
    max_width_percent?: number;
    opacity?: number;
    title_font_size?: number;
    subtitle_font_size?: number;
    title_max_lines?: number;
    subtitle_max_lines?: number;
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
  const imageContainerRef = useRef<HTMLDivElement>(null);
  
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
  const getOverlayPosition = (xPercent: number, yPercent: number): React.CSSProperties => {
    const dims = getDisplayedImageDimensions();
    if (!dims) {
      return { left: `${xPercent}%`, top: `${yPercent}%`, transform: 'translate(-50%, -50%)' };
    }
    
    // Calculate position relative to container, accounting for letterboxing
    const left = dims.offsetX + (dims.displayWidth * xPercent / 100);
    const top = dims.offsetY + (dims.displayHeight * yPercent / 100);
    
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
    const percent = Math.min(maxWidthPercent || 80, 85);
    return `${(dims.displayWidth * percent) / 100}px`;
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
  
  // Handle mouse move and up events globally when dragging
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && dragStart && currentAsset && editingOverlay && draggingElement) {
        const imageContainer = document.querySelector('.image-preview-container');
        if (imageContainer && imageDimensions) {
          const imageBounds = getImageDisplayBounds(imageContainer);
          if (imageBounds) {
            // Calculate position relative to the actual displayed image area
            const relativeX = e.clientX - imageBounds.x;
            const relativeY = e.clientY - imageBounds.y;
            
            // Convert to percentage based on actual image dimensions
            const x = (relativeX / imageBounds.width) * 100;
            const y = (relativeY / imageBounds.height) * 100;
            
            // Better boundary validation: account for text dimensions
            // Use more conservative bounds (15% to 85%) to ensure text never overlaps edges
            // This matches the grid preset positions
            const clampedX = Math.max(15, Math.min(85, x));
            const clampedY = Math.max(15, Math.min(85, y));
            
            if (draggingElement === 'title') {
              setOverlayEdit(prev => ({
                ...prev,
                title_x_percent: clampedX,
                title_y_percent: clampedY,
                x_percent: clampedX, // Keep legacy for backward compatibility
                y_percent: clampedY
              }));
            } else {
              setOverlayEdit(prev => ({
                ...prev,
                subtitle_x_percent: clampedX,
                subtitle_y_percent: clampedY
              }));
            }
          } else {
            // Fallback to container-based calculation if image bounds can't be determined
            const rect = imageContainer.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 100;
            const y = ((e.clientY - rect.top) / rect.height) * 100;
            const clampedX = Math.max(15, Math.min(85, x));
            const clampedY = Math.max(15, Math.min(85, y));
            if (draggingElement === 'title') {
              setOverlayEdit(prev => ({
                ...prev,
                title_x_percent: clampedX,
                title_y_percent: clampedY,
                x_percent: clampedX,
                y_percent: clampedY
              }));
            } else {
              setOverlayEdit(prev => ({
                ...prev,
                subtitle_x_percent: clampedX,
                subtitle_y_percent: clampedY
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
    };
    
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragStart, currentAsset, editingOverlay, draggingElement, imageDimensions]);

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
      const updated = await assetApi.updateOverlay(currentAsset.id, overlayEdit);
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
              <div ref={imageContainerRef} className="image-preview-container relative w-full" style={getAspectRatioStyle()}>
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
                      // Use title-specific positions first, then fallback to legacy x_percent/y_percent, but never use subtitle positions
                      const titleXPercent = overlayEdit.title_x_percent !== undefined 
                        ? overlayEdit.title_x_percent 
                        : (displayAsset.overlayConfig.title_x_percent !== undefined 
                          ? displayAsset.overlayConfig.title_x_percent 
                          : (overlayEdit.x_percent !== undefined 
                            ? overlayEdit.x_percent 
                            : (displayAsset.overlayConfig.x_percent !== undefined 
                              ? displayAsset.overlayConfig.x_percent 
                              : 50)));
                      const titleYPercent = overlayEdit.title_y_percent !== undefined 
                        ? overlayEdit.title_y_percent 
                        : (displayAsset.overlayConfig.title_y_percent !== undefined 
                          ? displayAsset.overlayConfig.title_y_percent 
                          : (overlayEdit.y_percent !== undefined 
                            ? overlayEdit.y_percent 
                            : (displayAsset.overlayConfig.y_percent !== undefined 
                              ? displayAsset.overlayConfig.y_percent 
                              : 30)));
                      const titleFontSize = overlayEdit.title_font_size || displayAsset.overlayConfig?.title_font_size;
                      
                      return (
                        <div
                          className="absolute cursor-move select-none border-2 border-dashed border-indigo-400 bg-indigo-50/20 rounded-lg p-3 backdrop-blur-sm"
                          style={{
                            ...getOverlayPosition(titleXPercent, titleYPercent),
                            textAlign: (overlayEdit.title_text_anchor || displayAsset.overlayConfig?.title_text_anchor || overlayEdit.text_anchor || displayAsset.overlayConfig?.text_anchor || 'middle') === 'start' ? 'left' : (overlayEdit.title_text_anchor || displayAsset.overlayConfig?.title_text_anchor || overlayEdit.text_anchor || displayAsset.overlayConfig?.text_anchor || 'middle') === 'end' ? 'right' : 'center',
                            maxWidth: getMaxWidthPixels(overlayEdit.max_width_percent || displayAsset.overlayConfig.max_width_percent),
                            padding: '0.5rem',
                            color: overlayEdit.title_color_hex || overlayEdit.text_color_hex || displayAsset.overlayConfig?.title_color_hex || displayAsset.overlayConfig?.text_color_hex || '#FFFFFF',
                            opacity: overlayEdit.opacity !== undefined ? overlayEdit.opacity : (displayAsset.overlayConfig.opacity !== undefined ? displayAsset.overlayConfig.opacity : 1),
                            fontFamily: overlayEdit.font_family || displayAsset.overlayConfig.font_family || 'sans-serif',
                            fontWeight: overlayEdit.font_weight === 'bold' ? 'bold' : overlayEdit.font_weight === 'light' ? '300' : 'normal',
                            fontSize: getFontSize(titleFontSize, true),
                            letterSpacing: overlayEdit.letter_spacing === 'wide' ? '0.15em' : 'normal',
                            textTransform: overlayEdit.font_transform || 'none',
                            filter: 'drop-shadow(2px 2px 4px rgba(0,0,0,0.7))',
                            pointerEvents: 'all',
                            zIndex: draggingElement === 'title' ? 20 : 10,
                            minWidth: 'fit-content',
                            wordWrap: 'break-word',
                            overflowWrap: 'break-word',
                            wordBreak: 'normal'
                          }}
                          onMouseDown={(e) => {
                            if (eyedropperActive) {
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
                                const x = (relativeX / imageBounds.width) * 100;
                                const y = (relativeY / imageBounds.height) * 100;
                                setDragStart({ x, y });
                              } else {
                                const rect = imageContainer.getBoundingClientRect();
                                const x = ((e.clientX - rect.left) / rect.width) * 100;
                                const y = ((e.clientY - rect.top) / rect.height) * 100;
                                setDragStart({ x, y });
                              }
                            }
                          }}
                        >
                          <div style={{ whiteSpace: 'pre-wrap', pointerEvents: 'none', wordBreak: 'normal', overflowWrap: 'break-word' }}>
                            {overlayEdit.title || displayAsset.overlayConfig.title || ''}
                          </div>
                        </div>
                      );
                    })()}
                    
                    {/* Subtitle Textbox */}
                    {(overlayEdit.subtitle || displayAsset.overlayConfig.subtitle) && (() => {
                      // Use subtitle-specific positions first, then fallback to legacy x_percent/y_percent, but never use title positions
                      const subtitleXPercent = overlayEdit.subtitle_x_percent !== undefined 
                        ? overlayEdit.subtitle_x_percent 
                        : (displayAsset.overlayConfig.subtitle_x_percent !== undefined 
                          ? displayAsset.overlayConfig.subtitle_x_percent 
                          : (overlayEdit.x_percent !== undefined 
                            ? overlayEdit.x_percent 
                            : (displayAsset.overlayConfig.x_percent !== undefined 
                              ? displayAsset.overlayConfig.x_percent 
                              : 50)));
                      const subtitleYPercent = overlayEdit.subtitle_y_percent !== undefined 
                        ? overlayEdit.subtitle_y_percent 
                        : (displayAsset.overlayConfig.subtitle_y_percent !== undefined 
                          ? displayAsset.overlayConfig.subtitle_y_percent 
                          : (overlayEdit.y_percent !== undefined 
                            ? overlayEdit.y_percent 
                            : (displayAsset.overlayConfig.y_percent !== undefined 
                              ? displayAsset.overlayConfig.y_percent 
                              : 80)));
                      const subtitleFontSize = overlayEdit.subtitle_font_size || displayAsset.overlayConfig?.subtitle_font_size;
                      
                      return (
                        <div
                          className="absolute cursor-move select-none border-2 border-dashed border-blue-400 bg-blue-50/20 rounded-lg p-3 backdrop-blur-sm"
                          style={{
                            ...getOverlayPosition(subtitleXPercent, subtitleYPercent),
                            textAlign: (overlayEdit.subtitle_text_anchor || displayAsset.overlayConfig?.subtitle_text_anchor || overlayEdit.text_anchor || displayAsset.overlayConfig?.text_anchor || 'middle') === 'start' ? 'left' : (overlayEdit.subtitle_text_anchor || displayAsset.overlayConfig?.subtitle_text_anchor || overlayEdit.text_anchor || displayAsset.overlayConfig?.text_anchor || 'middle') === 'end' ? 'right' : 'center',
                            maxWidth: getMaxWidthPixels(overlayEdit.max_width_percent || displayAsset.overlayConfig.max_width_percent),
                            padding: '0.5rem',
                            color: overlayEdit.subtitle_color_hex || overlayEdit.text_color_hex || displayAsset.overlayConfig?.subtitle_color_hex || displayAsset.overlayConfig?.text_color_hex || '#FFFFFF',
                            opacity: (overlayEdit.opacity !== undefined ? overlayEdit.opacity : (displayAsset.overlayConfig.opacity !== undefined ? displayAsset.overlayConfig.opacity : 1)) * 0.9,
                            fontFamily: overlayEdit.font_family || displayAsset.overlayConfig.font_family || 'sans-serif',
                            fontWeight: overlayEdit.font_weight === 'bold' ? 'bold' : overlayEdit.font_weight === 'light' ? '300' : 'normal',
                            fontSize: getFontSize(subtitleFontSize, false),
                            letterSpacing: overlayEdit.letter_spacing === 'wide' ? '0.15em' : 'normal',
                            textTransform: overlayEdit.font_transform || 'none',
                            filter: 'drop-shadow(2px 2px 4px rgba(0,0,0,0.7))',
                            pointerEvents: 'all',
                            zIndex: draggingElement === 'subtitle' ? 20 : 10,
                            minWidth: 'fit-content',
                            wordWrap: 'break-word',
                            overflowWrap: 'break-word',
                            wordBreak: 'normal'
                          }}
                          onMouseDown={(e) => {
                            if (eyedropperActive) {
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
                                const x = (relativeX / imageBounds.width) * 100;
                                const y = (relativeY / imageBounds.height) * 100;
                                setDragStart({ x, y });
                              } else {
                                const rect = imageContainer.getBoundingClientRect();
                                const x = ((e.clientX - rect.left) / rect.width) * 100;
                                const y = ((e.clientY - rect.top) / rect.height) * 100;
                                setDragStart({ x, y });
                              }
                            }
                          }}
                        >
                          <div style={{ whiteSpace: 'pre-wrap', pointerEvents: 'none', wordBreak: 'normal', overflowWrap: 'break-word' }}>
                            {overlayEdit.subtitle || displayAsset.overlayConfig.subtitle}
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
                          title: displayAsset.overlayConfig?.title || displayAsset.overlayConfig?.text || '',
                          subtitle: displayAsset.overlayConfig?.subtitle || '',
                          font_family: displayAsset.overlayConfig?.font_family,
                          font_weight: displayAsset.overlayConfig?.font_weight,
                          font_transform: displayAsset.overlayConfig?.font_transform,
                          text_color_hex: displayAsset.overlayConfig?.text_color_hex,
                          title_color_hex: displayAsset.overlayConfig?.title_color_hex || displayAsset.overlayConfig?.text_color_hex,
                          subtitle_color_hex: displayAsset.overlayConfig?.subtitle_color_hex || displayAsset.overlayConfig?.text_color_hex,
                          position: displayAsset.overlayConfig?.position,
                          max_width_percent: displayAsset.overlayConfig?.max_width_percent,
                          opacity: displayAsset.overlayConfig?.opacity,
                          title_font_size: displayAsset.overlayConfig?.title_font_size,
                          subtitle_font_size: displayAsset.overlayConfig?.subtitle_font_size,
                          title_max_lines: displayAsset.overlayConfig?.title_max_lines || 3,
                          subtitle_max_lines: displayAsset.overlayConfig?.subtitle_max_lines || 3,
                          x_percent: displayAsset.overlayConfig?.x_percent !== undefined ? displayAsset.overlayConfig.x_percent : 50,
                          y_percent: displayAsset.overlayConfig?.y_percent !== undefined ? displayAsset.overlayConfig.y_percent : 80,
                          // Ensure title and subtitle have separate default positions
                          title_x_percent: displayAsset.overlayConfig?.title_x_percent !== undefined 
                            ? displayAsset.overlayConfig.title_x_percent 
                            : (displayAsset.overlayConfig?.x_percent !== undefined ? displayAsset.overlayConfig.x_percent : 50),
                          title_y_percent: displayAsset.overlayConfig?.title_y_percent !== undefined 
                            ? displayAsset.overlayConfig.title_y_percent 
                            : (displayAsset.overlayConfig?.y_percent !== undefined ? displayAsset.overlayConfig.y_percent : 30),
                          subtitle_x_percent: displayAsset.overlayConfig?.subtitle_x_percent !== undefined 
                            ? displayAsset.overlayConfig.subtitle_x_percent 
                            : (displayAsset.overlayConfig?.x_percent !== undefined ? displayAsset.overlayConfig.x_percent : 50),
                          subtitle_y_percent: displayAsset.overlayConfig?.subtitle_y_percent !== undefined 
                            ? displayAsset.overlayConfig.subtitle_y_percent 
                            : (displayAsset.overlayConfig?.y_percent !== undefined ? displayAsset.overlayConfig.y_percent : 80),
                          text_anchor: displayAsset.overlayConfig?.text_anchor || 'middle',
                          title_text_anchor: displayAsset.overlayConfig?.title_text_anchor || displayAsset.overlayConfig?.text_anchor || 'middle',
                          subtitle_text_anchor: displayAsset.overlayConfig?.subtitle_text_anchor || displayAsset.overlayConfig?.text_anchor || 'middle'
                        });
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
                      <p className="text-xl font-black text-slate-800">{stripMarkdown(displayAsset.overlayConfig.title || displayAsset.overlayConfig.text || '')}</p>
                      {displayAsset.overlayConfig.subtitle && (
                        <p className="text-sm font-medium text-slate-600 mt-1">{stripMarkdown(displayAsset.overlayConfig.subtitle)}</p>
                      )}
                    </div>
                    <div className="flex gap-4 text-xs text-slate-500">
                      <span>{displayAsset.overlayConfig.font_family}</span>
                      <span>•</span>
                      <span>{displayAsset.overlayConfig.font_weight}</span>
                      <span>•</span>
                      <span>{displayAsset.overlayConfig.position}</span>
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
                            onClick={() => setOverlayEdit({...overlayEdit, title: ''})}
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
                          onChange={e => setOverlayEdit({...overlayEdit, title: e.target.value})}
                          rows={3}
                          className="w-full p-3 bg-white border border-slate-200 rounded-xl text-slate-800 font-bold resize-y"
                          placeholder="Enter title... (Press Enter for new line)"
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
                              value={overlayEdit.title_color_hex || overlayEdit.text_color_hex || displayAsset.overlayConfig?.title_color_hex || displayAsset.overlayConfig?.text_color_hex || '#FFFFFF'}
                              onChange={e => setOverlayEdit({...overlayEdit, title_color_hex: e.target.value})}
                              className="w-16 h-12 rounded-xl border-2 border-slate-200 cursor-pointer"
                            />
                            <input
                              type="text"
                              value={overlayEdit.title_color_hex || overlayEdit.text_color_hex || displayAsset.overlayConfig?.title_color_hex || displayAsset.overlayConfig?.text_color_hex || '#FFFFFF'}
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
                            onClick={() => setOverlayEdit({...overlayEdit, subtitle: ''})}
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
                          onChange={e => setOverlayEdit({...overlayEdit, subtitle: e.target.value})}
                          rows={3}
                          className="w-full p-3 bg-white border border-slate-200 rounded-xl text-slate-800 font-medium resize-y"
                          placeholder="Enter subtitle... (Press Enter for new line)"
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
                              value={overlayEdit.subtitle_color_hex || overlayEdit.text_color_hex || displayAsset.overlayConfig?.subtitle_color_hex || displayAsset.overlayConfig?.text_color_hex || '#FFFFFF'}
                              onChange={e => setOverlayEdit({...overlayEdit, subtitle_color_hex: e.target.value})}
                              className="w-16 h-12 rounded-xl border-2 border-slate-200 cursor-pointer"
                            />
                            <input
                              type="text"
                              value={overlayEdit.subtitle_color_hex || overlayEdit.text_color_hex || displayAsset.overlayConfig?.subtitle_color_hex || displayAsset.overlayConfig?.text_color_hex || '#FFFFFF'}
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

                    {/* Shared Settings */}
                    <div className="space-y-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <h3 className="text-xs font-black text-slate-600 uppercase tracking-wider">Shared Settings</h3>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Font</label>
                          <select
                            value={overlayEdit.font_family || 'sans-serif'}
                            onChange={e => setOverlayEdit({...overlayEdit, font_family: e.target.value as any})}
                            className="w-full p-3 bg-white border border-slate-200 rounded-xl text-slate-800 font-bold"
                          >
                            <option value="sans-serif">Sans-serif</option>
                            <option value="serif">Serif</option>
                            <option value="cursive">Cursive</option>
                            <option value="handwritten">Handwritten</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Weight</label>
                          <select
                            value={overlayEdit.font_weight || 'bold'}
                            onChange={e => setOverlayEdit({...overlayEdit, font_weight: e.target.value as any})}
                            className="w-full p-3 bg-white border border-slate-200 rounded-xl text-slate-800 font-bold"
                          >
                            <option value="light">Light</option>
                            <option value="regular">Regular</option>
                            <option value="bold">Bold</option>
                          </select>
                        </div>
                      </div>

                      {/* Position - 9-Grid Preset Layout */}
                      <div>
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2">
                          Position (Drag text on image or click a preset)
                        </label>
                        <div className="grid grid-cols-3 gap-2 mb-3">
                        {[
                          // Top row: y=15% to leave room for text height
                          { label: 'TL', x: 15, y: 15, anchor: 'start' as const, name: 'Top Left' },
                          { label: 'TC', x: 50, y: 15, anchor: 'middle' as const, name: 'Top Center' },
                          { label: 'TR', x: 85, y: 15, anchor: 'end' as const, name: 'Top Right' },
                          // Center row: y=50% (middle)
                          { label: 'CL', x: 15, y: 50, anchor: 'start' as const, name: 'Center Left' },
                          { label: 'C', x: 50, y: 50, anchor: 'middle' as const, name: 'Center' },
                          { label: 'CR', x: 85, y: 50, anchor: 'end' as const, name: 'Center Right' },
                          // Bottom row: y=85% to leave room for text height
                          { label: 'BL', x: 15, y: 85, anchor: 'start' as const, name: 'Bottom Left' },
                          { label: 'BC', x: 50, y: 85, anchor: 'middle' as const, name: 'Bottom Center' },
                          { label: 'BR', x: 85, y: 85, anchor: 'end' as const, name: 'Bottom Right' },
                        ].map((preset) => {
                            const isSelected = overlayEdit.x_percent === preset.x && 
                                             overlayEdit.y_percent === preset.y && 
                                             (overlayEdit.text_anchor || 'middle') === preset.anchor;
                            return (
                              <button
                                key={preset.label}
                                onClick={() => setOverlayEdit({
                                  ...overlayEdit,
                                  x_percent: preset.x,
                                  y_percent: preset.y,
                                  text_anchor: preset.anchor
                                })}
                                className={`p-3 rounded-lg border-2 transition-all font-bold text-xs ${
                                  isSelected
                                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                                    : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:bg-indigo-50/50'
                                }`}
                                title={preset.name}
                              >
                                {preset.label}
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-xs text-slate-400">
                          💡 Drag the text on the image to position it, or click a preset above.
                        </p>
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

          {/* Strategy & Feedback Chat */}
          <div className="lg:col-span-6 flex flex-col gap-8">
            <div className="bg-white p-12 rounded-[3rem] border border-slate-200 shadow-sm flex-1">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black italic">CD</div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Director's Rationale</h3>
              </div>
              <div className="space-y-8">
                <p className="text-slate-700 italic leading-relaxed text-2xl font-semibold">
                  "{displayAsset.strategy?.step_1_image_generation?.reasoning || 
                    displayAsset.strategy?.step_1_visual_strategy?.reasoning || 
                    displayAsset.strategy?.step_1_visual_concept?.visual_metaphor_reasoning || 
                    "Campaign coordinated sequence focusing on multi-touch narrative."}"
                </p>
                {displayAsset.type === 'product' && displayAsset.strategy?.step_2_title_subtitle && (
                  <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">Title & Subtitle</p>
                    <p className="text-lg font-black text-indigo-900 mb-1">{displayAsset.strategy.step_2_title_subtitle.title}</p>
                    {displayAsset.strategy.step_2_title_subtitle.subtitle && (
                      <p className="text-sm font-medium text-indigo-700">{displayAsset.strategy.step_2_title_subtitle.subtitle}</p>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Visual Tone</p>
                    <p className="text-sm font-black text-slate-800">{activeBrand.visual_identity.font_vibe}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Composition</p>
                    <p className="text-sm font-black text-slate-800">{displayAsset.strategy?.step_1_image_generation?.composition_notes || displayAsset.strategy?.step_1_visual_strategy?.composition_notes || 'Metaphorical'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Chat Box for Feedback */}
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

