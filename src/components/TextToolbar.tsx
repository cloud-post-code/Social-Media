import React, { useEffect, useRef, useState } from 'react';
import { OverlayConfig } from '../models/types';

interface TextToolbarProps {
  elementType: 'title' | 'subtitle';
  overlayConfig: OverlayConfig | undefined;
  overlayEdit: Partial<OverlayConfig>;
  onUpdate: (updates: Partial<OverlayConfig>) => void;
  textElementRef: React.RefObject<HTMLDivElement>;
  activeBrand: any;
  onEyedropperClick: (type: 'title' | 'subtitle') => void;
}

const TextToolbar: React.FC<TextToolbarProps> = ({
  elementType,
  overlayConfig,
  overlayEdit,
  onUpdate,
  textElementRef,
  activeBrand,
  onEyedropperClick
}) => {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

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
  
  const fontFamily = overlayEdit[`${prefix}_font_family` as keyof OverlayConfig] as string || 
    overlayConfig?.[`${prefix}_font_family` as keyof OverlayConfig] as string || 'sans-serif';
  
  const fontWeight = overlayEdit[`${prefix}_font_weight` as keyof OverlayConfig] as string || 
    overlayConfig?.[`${prefix}_font_weight` as keyof OverlayConfig] as string || (elementType === 'title' ? 'bold' : 'regular');
  
  const fontSize = overlayEdit[`${prefix}_font_size` as keyof OverlayConfig] as number | undefined || 
    overlayConfig?.[`${prefix}_font_size` as keyof OverlayConfig] as number | undefined;
  
  const colorHex = overlayEdit[`${prefix}_color_hex` as keyof OverlayConfig] as string || 
    overlayConfig?.[`${prefix}_color_hex` as keyof OverlayConfig] as string || '#FFFFFF';
  
  const textAnchor = overlayEdit[`${prefix}_text_anchor` as keyof OverlayConfig] as 'start' | 'middle' | 'end' || 
    overlayConfig?.[`${prefix}_text_anchor` as keyof OverlayConfig] as 'start' | 'middle' | 'end' || 'middle';

  const handleFontFamilyChange = (value: string) => {
    onUpdate({ [`${prefix}_font_family`]: value } as any);
  };

  const handleFontWeightChange = (value: string) => {
    onUpdate({ [`${prefix}_font_weight`]: value } as any);
  };

  const handleFontSizeChange = (value: number) => {
    onUpdate({ [`${prefix}_font_size`]: value } as any);
  };

  const handleColorChange = (value: string) => {
    onUpdate({ [`${prefix}_color_hex`]: value } as any);
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
      {/* Font Family */}
      <select
        value={fontFamily}
        onChange={(e) => handleFontFamilyChange(e.target.value)}
        className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-700 cursor-pointer hover:border-indigo-400 transition-colors"
      >
        <option value="sans-serif">Sans-serif</option>
        <option value="serif">Serif</option>
        <option value="cursive">Cursive</option>
        <option value="handwritten">Handwritten</option>
      </select>

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

      {/* Font Size */}
      <div className="flex items-center gap-2">
        <input
          type="range"
          min="12"
          max="200"
          value={fontSize || (elementType === 'title' ? 56 : 32)}
          onChange={(e) => handleFontSizeChange(parseInt(e.target.value))}
          className="w-24"
        />
        <input
          type="number"
          min="12"
          max="200"
          value={fontSize || ''}
          onChange={(e) => handleFontSizeChange(e.target.value ? parseInt(e.target.value) : undefined as any)}
          className="w-16 px-2 py-1 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-700"
          placeholder="Auto"
        />
        <span className="text-xs font-bold text-slate-500">px</span>
      </div>

      {/* Divider */}
      <div className="w-px h-8 bg-slate-300" />

      {/* Color Picker */}
      <div className="flex items-center gap-2">
        {activeBrand && (
          <>
            <button
              onClick={() => handleColorChange(activeBrand.visual_identity.primary_color_hex)}
              className="w-8 h-8 rounded-lg border-2 border-slate-300 hover:border-indigo-400 transition-all shadow-sm"
              style={{ backgroundColor: activeBrand.visual_identity.primary_color_hex }}
              title="Primary Brand Color"
            />
            <button
              onClick={() => handleColorChange(activeBrand.visual_identity.accent_color_hex)}
              className="w-8 h-8 rounded-lg border-2 border-slate-300 hover:border-indigo-400 transition-all shadow-sm"
              style={{ backgroundColor: activeBrand.visual_identity.accent_color_hex }}
              title="Accent Brand Color"
            />
            <button
              onClick={() => onEyedropperClick(elementType)}
              className="w-8 h-8 rounded-lg border-2 border-slate-300 hover:border-indigo-400 transition-all shadow-sm bg-white flex items-center justify-center"
              title="Pick color from image"
            >
              <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
              </svg>
            </button>
          </>
        )}
        <input
          type="color"
          value={colorHex}
          onChange={(e) => handleColorChange(e.target.value)}
          className="w-10 h-10 rounded-lg border-2 border-slate-300 cursor-pointer hover:border-indigo-400 transition-colors"
        />
        <input
          type="text"
          value={colorHex}
          onChange={(e) => handleColorChange(e.target.value)}
          className="w-20 px-2 py-1 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-700"
          placeholder="#FFFFFF"
        />
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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h8" />
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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h8" />
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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default TextToolbar;

