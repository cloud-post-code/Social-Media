import React, { useEffect, useRef, useState } from 'react';
import { OverlayConfig } from '../models/types';
import { GOOGLE_FONTS, loadGoogleFont, getFontFamilyString, FONT_MAPPING, GoogleFont } from '../utils/googleFonts';

interface TextToolbarProps {
  elementType: 'title' | 'subtitle';
  overlayConfig: OverlayConfig | undefined;
  overlayEdit: Partial<OverlayConfig>;
  onUpdate: (updates: Partial<OverlayConfig>) => void;
  textElementRef: React.RefObject<HTMLDivElement>;
  activeBrand: any;
  onEyedropperClick: (type: 'title' | 'subtitle') => void;
  imageDimensions?: { width: number; height: number } | null;
  getDisplayedImageDimensions?: () => { displayWidth: number; displayHeight: number; offsetX: number; offsetY: number } | null;
}

// Local storage key for recent colors
const RECENT_COLORS_KEY = 'brandgenius_recent_colors';

// Get recent colors from localStorage
const getRecentColors = (): string[] => {
  try {
    const stored = localStorage.getItem(RECENT_COLORS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

// Save a color to recent colors
const saveRecentColor = (color: string) => {
  try {
    const recent = getRecentColors();
    // Remove if already exists, add to front
    const filtered = recent.filter(c => c.toLowerCase() !== color.toLowerCase());
    const updated = [color, ...filtered].slice(0, 8); // Keep last 8
    localStorage.setItem(RECENT_COLORS_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [color];
  }
};

const TextToolbar: React.FC<TextToolbarProps> = ({
  elementType,
  overlayConfig,
  overlayEdit,
  onUpdate,
  textElementRef,
  activeBrand,
  onEyedropperClick,
  imageDimensions,
  getDisplayedImageDimensions
}) => {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [fontSearch, setFontSearch] = useState('');
  const [showFontDropdown, setShowFontDropdown] = useState(false);
  const [showColorDropdown, setShowColorDropdown] = useState(false);
  const [recentColors, setRecentColors] = useState<string[]>(getRecentColors());
  const fontDropdownRef = useRef<HTMLDivElement>(null);
  const colorDropdownRef = useRef<HTMLDivElement>(null);

  // Update toolbar position based on text element position
  useEffect(() => {
    const updatePosition = () => {
      if (!textElementRef.current) return;

      const textRect = textElementRef.current.getBoundingClientRect();
      const toolbar = toolbarRef.current;
      if (!toolbar) return;

      const toolbarHeight = toolbar.offsetHeight;
      const toolbarWidth = toolbar.offsetWidth;
      
      // Position above the text element, centered horizontally
      let top = textRect.top - toolbarHeight - 12; // 12px gap
      let left = textRect.left + (textRect.width / 2) - (toolbarWidth / 2);

      // Adjust if near viewport edges
      const padding = 12;
      if (left < padding) {
        left = padding;
      } else if (left + toolbarWidth > window.innerWidth - padding) {
        left = window.innerWidth - toolbarWidth - padding;
      }

      // If toolbar would go above viewport, position below instead
      if (top < padding) {
        top = textRect.bottom + 12;
      }

      setPosition({ top, left });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [textElementRef, overlayEdit, elementType]);

  const prefix = elementType === 'title' ? 'title' : 'subtitle';
  
  const fontFamilyRaw = overlayEdit[`${prefix}_font_family` as keyof OverlayConfig] as string || 
    overlayConfig?.[`${prefix}_font_family` as keyof OverlayConfig] as string || 'sans-serif';
  
  // Map old font names to Google Fonts for display
  const fontFamily = FONT_MAPPING[fontFamilyRaw] || fontFamilyRaw;
  
  // Get display name for the dropdown button - show actual font name
  const getDisplayName = (fontName: string): string => {
    // If it's a mapped generic name, show the actual font
    const mappedFont = FONT_MAPPING[fontName];
    if (mappedFont) {
      return mappedFont; // Show actual font name (e.g., "Inter" instead of "sans-serif")
    }
    // If it's already an actual font name, show it
    return fontName;
  };
  
  const displayFontName = getDisplayName(fontFamilyRaw);
  
  const fontWeight = overlayEdit[`${prefix}_font_weight` as keyof OverlayConfig] as string || 
    overlayConfig?.[`${prefix}_font_weight` as keyof OverlayConfig] as string || (elementType === 'title' ? 'bold' : 'regular');
  
  // Font size is stored as percentage of image width
  const storedFontSizePercent = overlayEdit[`${prefix}_font_size` as keyof OverlayConfig] as number | undefined || 
    overlayConfig?.[`${prefix}_font_size` as keyof OverlayConfig] as number | undefined;
  
  // Convert stored percentage to display pixels for the slider
  const getDisplayFontSize = (): number => {
    const dims = getDisplayedImageDimensions?.();
    if (!dims || !imageDimensions) {
      return elementType === 'title' ? 56 : 32; // Default
    }
    
    // Normalize: if value > 20, it's legacy pixels; otherwise it's percentage
    let fontSizePercent: number;
    if (storedFontSizePercent === undefined) {
      fontSizePercent = elementType === 'title' ? 10 : 6; // Default percentage
    } else if (storedFontSizePercent > 20) {
      // Legacy pixel value - convert to percentage first
      fontSizePercent = (storedFontSizePercent / imageDimensions.width) * 100;
    } else {
      fontSizePercent = storedFontSizePercent;
    }
    
    // Convert percentage to actual pixels at full resolution
    const actualPx = (fontSizePercent / 100) * imageDimensions.width;
    
    // Scale to display pixels
    const scale = dims.displayWidth / imageDimensions.width;
    return Math.round(actualPx * scale);
  };
  
  const displayFontSize = getDisplayFontSize();
  
  const colorHex = overlayEdit[`${prefix}_color_hex` as keyof OverlayConfig] as string || 
    overlayConfig?.[`${prefix}_color_hex` as keyof OverlayConfig] as string || '#FFFFFF';
  
  const textAnchor = overlayEdit[`${prefix}_text_anchor` as keyof OverlayConfig] as 'start' | 'middle' | 'end' || 
    overlayConfig?.[`${prefix}_text_anchor` as keyof OverlayConfig] as 'start' | 'middle' | 'end' || 'middle';
  
  // Get current text transform value
  const fontTransform = overlayEdit[`${prefix}_font_transform` as keyof OverlayConfig] as 'uppercase' | 'lowercase' | 'capitalize' | 'none' || 
    overlayConfig?.[`${prefix}_font_transform` as keyof OverlayConfig] as 'uppercase' | 'lowercase' | 'capitalize' | 'none' || 'none';

  const handleFontTransformChange = (value: 'uppercase' | 'lowercase' | 'capitalize' | 'none') => {
    onUpdate({ [`${prefix}_font_transform`]: value } as any);
  };

  const handleFontFamilyChange = async (e: React.MouseEvent, font: FontWithDisplay) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Use the actual font family name for loading
    const actualFontFamily = font.family;
    
    // Store the value (generic name if available for backward compatibility, otherwise actual font name)
    const valueToStore = font.storedValue || actualFontFamily;
    
    // Update state immediately before font loads - this ensures immediate visual update
    onUpdate({ [`${prefix}_font_family`]: valueToStore } as any);
    
    // Close dropdown immediately
    setShowFontDropdown(false);
    setFontSearch('');
    
    // Load the font asynchronously in the background (font will apply once loaded)
    const isGoogleFont = GOOGLE_FONTS.some(f => f.family === actualFontFamily);
    if (isGoogleFont) {
      // Don't await - let it load in background
      loadGoogleFont(actualFontFamily).catch(err => {
        console.error('Failed to load font:', err);
      });
    }
  };

  // Load current font on mount
  useEffect(() => {
    const isGoogleFont = GOOGLE_FONTS.some(f => f.family === fontFamily);
    if (isGoogleFont) {
      loadGoogleFont(fontFamily).catch(err => console.error('Failed to load font:', err));
    }
  }, [fontFamily]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (fontDropdownRef.current && !fontDropdownRef.current.contains(event.target as Node)) {
        setShowFontDropdown(false);
        setFontSearch('');
      }
      if (colorDropdownRef.current && !colorDropdownRef.current.contains(event.target as Node)) {
        setShowColorDropdown(false);
      }
    };
    if (showFontDropdown || showColorDropdown) {
      // Use capture phase to catch events before they bubble
      document.addEventListener('mousedown', handleClickOutside, true);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside, true);
      };
    }
  }, [showFontDropdown, showColorDropdown]);

  // Show actual font names in dropdown, but allow selection by generic name for backward compatibility
  type FontWithDisplay = GoogleFont & { displayName?: string; genericName?: string; storedValue?: string };
  
  const ALL_FONTS: FontWithDisplay[] = GOOGLE_FONTS.map(font => {
    // Find if this font is mapped from a generic name
    const genericName = Object.keys(FONT_MAPPING).find(key => FONT_MAPPING[key] === font.family);
    if (genericName) {
      // Show the actual font name, but store the generic name for backward compatibility
      return { 
        ...font, 
        displayName: font.family, // Show actual font name
        genericName,
        storedValue: genericName // Store generic name for compatibility
      };
    }
    return { ...font, displayName: font.family, storedValue: font.family };
  });
  
  // Filter fonts based on search
  const filteredFonts = ALL_FONTS.filter(font => {
    const searchTerm = fontSearch.toLowerCase();
    return font.family.toLowerCase().includes(searchTerm) || 
           (font.displayName && font.displayName.toLowerCase().includes(searchTerm));
  });

  const handleFontWeightChange = (value: string) => {
    onUpdate({ [`${prefix}_font_weight`]: value } as any);
  };

  const handleFontSizeChange = (value: number) => {
    onUpdate({ [`${prefix}_font_size`]: value } as any);
  };

  const handleColorChange = (value: string, saveToRecent: boolean = true) => {
    onUpdate({ [`${prefix}_color_hex`]: value } as any);
    if (saveToRecent && value && value.startsWith('#')) {
      const updated = saveRecentColor(value);
      setRecentColors(updated);
    }
  };
  
  const handleColorSelect = (value: string) => {
    handleColorChange(value, true);
    setShowColorDropdown(false);
  };

  const handleAlignmentChange = (value: 'start' | 'middle' | 'end') => {
    onUpdate({ [`${prefix}_text_anchor`]: value } as any);
  };

  return (
    <div
      ref={toolbarRef}
      className="fixed bg-white rounded-xl shadow-2xl border-2 border-slate-200 p-3 z-50 flex items-center gap-3"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        transform: 'translateX(0)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Font Family - Searchable Dropdown */}
      <div className="relative" ref={fontDropdownRef}>
        <button
          type="button"
          onClick={() => setShowFontDropdown(!showFontDropdown)}
          className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-700 cursor-pointer hover:border-indigo-400 transition-colors min-w-[180px] text-left flex items-center justify-between"
          style={{ fontFamily: getFontFamilyString(fontFamily) }}
        >
          <span>{displayFontName}</span>
          <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {showFontDropdown && (
          <div className="absolute top-full left-0 mt-1 bg-white border border-slate-300 rounded-lg shadow-xl z-50 max-h-96 overflow-hidden flex flex-col min-w-[280px]">
            <input
              type="text"
              placeholder="Search fonts..."
              value={fontSearch}
              onChange={(e) => setFontSearch(e.target.value)}
              className="px-3 py-2 border-b border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              autoFocus
            />
            <div className="overflow-y-auto max-h-80 custom-scrollbar">
              {filteredFonts.length > 0 ? (
                filteredFonts.map((font) => {
                  // Check if this font is selected (by actual name or by stored value)
                  const isSelected = fontFamily === font.family || 
                                    (font.storedValue && fontFamily === font.storedValue) ||
                                    FONT_MAPPING[fontFamily] === font.family ||
                                    (font.genericName && fontFamily === font.genericName);
                  return (
                    <button
                      key={font.family}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent click from bubbling to document
                        handleFontFamilyChange(e, font);
                      }}
                      onMouseDown={(e) => e.stopPropagation()} // Prevent mousedown from bubbling
                      className={`w-full px-3 py-2 text-left hover:bg-indigo-50 transition-colors flex items-center justify-between ${
                        isSelected ? 'bg-indigo-100 font-bold' : ''
                      }`}
                      style={{ fontFamily: getFontFamilyString(font.family) }}
                    >
                      <span style={{ fontFamily: getFontFamilyString(font.family) }}>{font.displayName || font.family}</span>
                      <span className="text-xs text-slate-500 capitalize">{font.category}</span>
                    </button>
                  );
                })
              ) : (
                <div className="px-3 py-2 text-sm text-slate-500">No fonts found</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Font Weight */}
      <select
        value={fontWeight}
        onChange={(e) => handleFontWeightChange(e.target.value)}
        className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-700 cursor-pointer hover:border-indigo-400 transition-colors"
      >
        <option value="light">Light</option>
        <option value="regular">Regular</option>
        <option value="bold">Bold</option>
      </select>

      {/* Font Size - displays in display pixels, converts to percentage on change */}
      <div className="flex items-center gap-2">
        <input
          type="range"
          min="12"
          max="200"
          value={displayFontSize}
          onChange={(e) => handleFontSizeChange(parseInt(e.target.value))}
          className="w-24"
        />
        <input
          type="number"
          min="12"
          max="500"
          value={displayFontSize}
          onChange={(e) => handleFontSizeChange(e.target.value ? parseInt(e.target.value) : displayFontSize)}
          className="w-16 px-2 py-1 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-700"
          placeholder="Auto"
        />
        <span className="text-xs font-bold text-slate-500">px</span>
      </div>

      {/* Divider */}
      <div className="w-px h-8 bg-slate-300" />

      {/* Color Picker Dropdown */}
      <div className="relative flex items-center gap-2" ref={colorDropdownRef}>
        {/* Current color button - opens dropdown */}
        <button
          type="button"
          onClick={() => setShowColorDropdown(!showColorDropdown)}
          className="w-10 h-10 rounded-lg border-2 border-slate-300 hover:border-indigo-400 transition-all shadow-sm flex items-center justify-center"
          style={{ backgroundColor: colorHex }}
          title="Select Color"
        >
          <svg className="w-4 h-4 opacity-50" fill="none" stroke={colorHex === '#FFFFFF' || colorHex === '#ffffff' ? '#000' : '#fff'} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        {/* Color dropdown */}
        {showColorDropdown && (
          <div className="absolute top-full left-0 mt-2 bg-white border border-slate-300 rounded-xl shadow-xl z-50 p-4 min-w-[280px]">
            {/* Brand Colors Section */}
            {activeBrand && (
              <>
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Brand Colors</div>
                <div className="flex flex-wrap gap-2 mb-3">
                  {/* Primary Color */}
                  <button
                    onClick={() => handleColorSelect(activeBrand.visual_identity.primary_color_hex)}
                    className={`w-10 h-10 rounded-lg border-2 transition-all shadow-sm flex flex-col items-center justify-center ${
                      colorHex.toLowerCase() === activeBrand.visual_identity.primary_color_hex.toLowerCase()
                        ? 'border-indigo-600 ring-2 ring-indigo-200'
                        : 'border-slate-300 hover:border-indigo-400'
                    }`}
                    style={{ backgroundColor: activeBrand.visual_identity.primary_color_hex }}
                    title="Primary"
                  />
                  
                  {/* Accent Color */}
                  <button
                    onClick={() => handleColorSelect(activeBrand.visual_identity.accent_color_hex)}
                    className={`w-10 h-10 rounded-lg border-2 transition-all shadow-sm ${
                      colorHex.toLowerCase() === activeBrand.visual_identity.accent_color_hex.toLowerCase()
                        ? 'border-indigo-600 ring-2 ring-indigo-200'
                        : 'border-slate-300 hover:border-indigo-400'
                    }`}
                    style={{ backgroundColor: activeBrand.visual_identity.accent_color_hex }}
                    title="Accent"
                  />
                  
                  {/* Additional brand colors */}
                  {activeBrand.visual_identity.colors?.map((color: string, i: number) => (
                    <button
                      key={`brand-color-${i}`}
                      onClick={() => handleColorSelect(color)}
                      className={`w-10 h-10 rounded-lg border-2 transition-all shadow-sm ${
                        colorHex.toLowerCase() === color.toLowerCase()
                          ? 'border-indigo-600 ring-2 ring-indigo-200'
                          : 'border-slate-300 hover:border-indigo-400'
                      }`}
                      style={{ backgroundColor: color }}
                      title={`Brand Color ${i + 1}`}
                    />
                  ))}
                </div>
              </>
            )}
            
            {/* Quick Colors */}
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Quick Colors</div>
            <div className="flex flex-wrap gap-2 mb-3">
              {['#FFFFFF', '#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF'].map((color) => (
                <button
                  key={color}
                  onClick={() => handleColorSelect(color)}
                  className={`w-8 h-8 rounded-lg border-2 transition-all ${
                    colorHex.toLowerCase() === color.toLowerCase()
                      ? 'border-indigo-600 ring-2 ring-indigo-200'
                      : 'border-slate-300 hover:border-indigo-400'
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
            
            {/* Recent Colors */}
            {recentColors.length > 0 && (
              <>
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Recent</div>
                <div className="flex flex-wrap gap-2 mb-3">
                  {recentColors.map((color, i) => (
                    <button
                      key={`recent-${i}`}
                      onClick={() => handleColorSelect(color)}
                      className={`w-8 h-8 rounded-lg border-2 transition-all ${
                        colorHex.toLowerCase() === color.toLowerCase()
                          ? 'border-indigo-600 ring-2 ring-indigo-200'
                          : 'border-slate-300 hover:border-indigo-400'
                      }`}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </>
            )}
            
            {/* Divider */}
            <div className="border-t border-slate-200 my-3" />
            
            {/* Custom Color & Tools */}
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={colorHex}
                onChange={(e) => handleColorChange(e.target.value, true)}
                className="w-10 h-10 rounded-lg border-2 border-slate-300 cursor-pointer hover:border-indigo-400 transition-colors"
                title="Custom Color"
              />
              <input
                type="text"
                value={colorHex}
                onChange={(e) => handleColorChange(e.target.value, false)}
                onBlur={(e) => {
                  if (e.target.value && e.target.value.startsWith('#')) {
                    const updated = saveRecentColor(e.target.value);
                    setRecentColors(updated);
                  }
                }}
                className="flex-1 px-2 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-700"
                placeholder="#FFFFFF"
              />
              <button
                onClick={() => {
                  onEyedropperClick(elementType);
                  setShowColorDropdown(false);
                }}
                className="w-10 h-10 rounded-lg border-2 border-slate-300 hover:border-indigo-400 transition-all shadow-sm bg-white flex items-center justify-center"
                title="Pick color from image"
              >
                <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="w-px h-8 bg-slate-300" />

      {/* Text Transform (Capitalization) */}
      <div className="flex gap-1">
        <button
          onClick={() => handleFontTransformChange('none')}
          className={`px-2 py-1 rounded-lg border-2 text-xs font-bold transition-all ${
            fontTransform === 'none'
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'bg-white border-slate-300 text-slate-600 hover:border-indigo-400'
          }`}
          title="No Transform"
        >
          Aa
        </button>
        <button
          onClick={() => handleFontTransformChange('uppercase')}
          className={`px-2 py-1 rounded-lg border-2 text-xs font-bold transition-all ${
            fontTransform === 'uppercase'
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'bg-white border-slate-300 text-slate-600 hover:border-indigo-400'
          }`}
          title="UPPERCASE"
        >
          AA
        </button>
        <button
          onClick={() => handleFontTransformChange('lowercase')}
          className={`px-2 py-1 rounded-lg border-2 text-xs font-bold transition-all ${
            fontTransform === 'lowercase'
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'bg-white border-slate-300 text-slate-600 hover:border-indigo-400'
          }`}
          title="lowercase"
        >
          aa
        </button>
        <button
          onClick={() => handleFontTransformChange('capitalize')}
          className={`px-2 py-1 rounded-lg border-2 text-xs font-bold transition-all ${
            fontTransform === 'capitalize'
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'bg-white border-slate-300 text-slate-600 hover:border-indigo-400'
          }`}
          title="Title Case"
        >
          Ab
        </button>
      </div>

      {/* Divider */}
      <div className="w-px h-8 bg-slate-300" />

      {/* Alignment */}
      <div className="flex gap-1">
        <button
          onClick={() => handleAlignmentChange('start')}
          className={`p-2 rounded-lg border-2 transition-all ${
            textAnchor === 'start'
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'bg-white border-slate-300 text-slate-600 hover:border-indigo-400'
          }`}
          title="Align Left"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h10M4 18h16" />
          </svg>
        </button>
        <button
          onClick={() => handleAlignmentChange('middle')}
          className={`p-2 rounded-lg border-2 transition-all ${
            textAnchor === 'middle'
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'bg-white border-slate-300 text-slate-600 hover:border-indigo-400'
          }`}
          title="Align Center"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M7 12h10M4 18h16" />
          </svg>
        </button>
        <button
          onClick={() => handleAlignmentChange('end')}
          className={`p-2 rounded-lg border-2 transition-all ${
            textAnchor === 'end'
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'bg-white border-slate-300 text-slate-600 hover:border-indigo-400'
          }`}
          title="Align Right"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M10 12h10M4 18h16" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default TextToolbar;

