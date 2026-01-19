import React, { useState, useRef, useEffect } from 'react';

interface ColorPickerProps {
  value: string; // Hex color value
  onChange: (hex: string) => void;
}

// Helper functions for color conversion
const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
};

const rgbToHex = (r: number, g: number, b: number): string => {
  return '#' + [r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('').toUpperCase();
};

const rgbToHsl = (r: number, g: number, b: number): { h: number; s: number; l: number } => {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
};

const hslToRgb = (h: number, s: number, l: number): { r: number; g: number; b: number } => {
  h /= 360;
  s /= 100;
  l /= 100;
  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
};

const ColorPicker: React.FC<ColorPickerProps> = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hsl, setHsl] = useState({ h: 0, s: 100, l: 50 });
  const [rgb, setRgb] = useState({ r: 0, g: 0, b: 0 });
  const pickerRef = useRef<HTMLDivElement>(null);
  const saturationRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isDraggingHue, setIsDraggingHue] = useState(false);
  const isInternalUpdate = useRef(false);
  const hslRef = useRef(hsl);

  // Initialize from hex value (only when value prop changes externally)
  useEffect(() => {
    if (!isInternalUpdate.current) {
      const rgbVal = hexToRgb(value || '#000000');
      const hslVal = rgbToHsl(rgbVal.r, rgbVal.g, rgbVal.b);
      setRgb(rgbVal);
      setHsl(hslVal);
      hslRef.current = hslVal;
    }
    isInternalUpdate.current = false;
  }, [value]);

  // Keep ref in sync with state
  useEffect(() => {
    hslRef.current = hsl;
  }, [hsl]);

  const updateColorFromHsl = (newHsl: { h: number; s: number; l: number }) => {
    const rgbVal = hslToRgb(newHsl.h, newHsl.s, newHsl.l);
    setRgb(rgbVal);
    const hex = rgbToHex(rgbVal.r, rgbVal.g, rgbVal.b);
    isInternalUpdate.current = true;
    onChange(hex);
  };

  const handleSaturationClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!saturationRef.current) return;
    const rect = saturationRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    const newHsl = { ...hsl, s: x * 100, l: (1 - y) * 100 };
    setHsl(newHsl);
    updateColorFromHsl(newHsl);
  };

  const handleSaturationDrag = (e: MouseEvent) => {
    if (!saturationRef.current || !isDragging) return;
    const rect = saturationRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    const newHsl = { ...hslRef.current, s: x * 100, l: (1 - y) * 100 };
    setHsl(newHsl);
    updateColorFromHsl(newHsl);
  };

  const handleHueClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newHsl = { ...hsl, h: x * 360 };
    setHsl(newHsl);
    updateColorFromHsl(newHsl);
  };

  const handleHueDrag = (e: MouseEvent) => {
    if (!isDraggingHue) return;
    const hueSlider = document.querySelector('.hue-slider') as HTMLDivElement;
    if (!hueSlider) return;
    const rect = hueSlider.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newHsl = { ...hslRef.current, h: x * 360 };
    setHsl(newHsl);
    updateColorFromHsl(newHsl);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleSaturationDrag);
      window.addEventListener('mouseup', () => setIsDragging(false));
      return () => {
        window.removeEventListener('mousemove', handleSaturationDrag);
        window.removeEventListener('mouseup', () => setIsDragging(false));
      };
    }
  }, [isDragging]);

  useEffect(() => {
    if (isDraggingHue) {
      window.addEventListener('mousemove', handleHueDrag);
      window.addEventListener('mouseup', () => setIsDraggingHue(false));
      return () => {
        window.removeEventListener('mousemove', handleHueDrag);
        window.removeEventListener('mouseup', () => setIsDraggingHue(false));
      };
    }
  }, [isDraggingHue]);

  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let hex = e.target.value.toUpperCase().replace(/[^0-9A-F#]/g, '');
    if (hex.length > 0 && hex[0] !== '#') hex = '#' + hex;
    if (hex.length > 7) hex = hex.slice(0, 7);
    if (hex.match(/^#[0-9A-F]{6}$/i)) {
      onChange(hex);
    }
  };

  const handleRgbChange = (channel: 'r' | 'g' | 'b', val: string) => {
    const num = parseInt(val) || 0;
    const clamped = Math.max(0, Math.min(255, num));
    const newRgb = { ...rgb, [channel]: clamped };
    setRgb(newRgb);
    const hex = rgbToHex(newRgb.r, newRgb.g, newRgb.b);
    isInternalUpdate.current = true;
    onChange(hex);
    const newHsl = rgbToHsl(newRgb.r, newRgb.g, newRgb.b);
    setHsl(newHsl);
  };

  const handleEyedropper = async () => {
    try {
      // @ts-ignore - EyeDropper API is not in all TypeScript definitions
      const eyeDropper = new EyeDropper();
      const result = await eyeDropper.open();
      onChange(result.sRGBHex.toUpperCase());
    } catch (err) {
      // User cancelled or browser doesn't support EyeDropper
      console.log('EyeDropper cancelled or not supported');
    }
  };

  const currentHex = value || '#000000';
  const hueColor = `hsl(${hsl.h}, 100%, 50%)`;
  const saturationBg = `linear-gradient(to right, white, ${hueColor}), linear-gradient(to top, black, transparent)`;

  return (
    <div className="relative" ref={pickerRef}>
      {/* Hex Input with Color Swatch */}
      <div className="flex gap-2 items-center mb-2">
        <div
          className="w-8 h-8 rounded-lg border border-slate-200 shadow-sm cursor-pointer"
          style={{ backgroundColor: currentHex }}
          onClick={() => setIsOpen(!isOpen)}
        />
        <input
          type="text"
          value={currentHex}
          onChange={handleHexChange}
          onBlur={(e) => {
            if (!e.target.value.match(/^#[0-9A-F]{6}$/i)) {
              onChange(currentHex);
            }
          }}
          className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="#000000"
        />
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="px-3 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition"
        >
          {isOpen ? '▼' : '▲'}
        </button>
      </div>

      {/* Color Picker Popup */}
      {isOpen && (
        <div className="absolute z-50 bg-white border border-slate-200 rounded-xl shadow-2xl p-4 w-64 mt-2">
          {/* Main Color Selection Area */}
          <div
            ref={saturationRef}
            className="w-full h-40 rounded-lg mb-3 cursor-crosshair relative border border-slate-200"
            style={{
              background: saturationBg,
            }}
            onClick={handleSaturationClick}
            onMouseDown={(e) => {
              e.preventDefault();
              setIsDragging(true);
              handleSaturationClick(e);
            }}
          >
            {/* Selector Circle */}
            <div
              className="absolute w-4 h-4 border-2 border-white rounded-full shadow-lg pointer-events-none"
              style={{
                left: `${hsl.s}%`,
                top: `${100 - hsl.l}%`,
                transform: 'translate(-50%, -50%)',
              }}
            />
          </div>

          {/* Hue Slider */}
          <div className="flex items-center gap-2 mb-3">
            {/* Eyedropper */}
            <button
              onClick={handleEyedropper}
              className="w-8 h-8 flex items-center justify-center border border-slate-200 rounded-lg hover:bg-slate-50 transition"
              title="Pick color from screen"
            >
              <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
              </svg>
            </button>

            {/* Current Color Swatch */}
            <div
              className="w-8 h-8 rounded-lg border border-slate-200 shadow-sm"
              style={{ backgroundColor: currentHex }}
            />

            {/* Hue Slider */}
            <div
              className="hue-slider flex-1 h-6 rounded-lg cursor-pointer relative border border-slate-200"
              style={{
                background: 'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)',
              }}
              onClick={handleHueClick}
              onMouseDown={(e) => {
                e.preventDefault();
                setIsDraggingHue(true);
                handleHueClick(e);
              }}
            >
              <div
                className="absolute w-3 h-full border-2 border-white rounded pointer-events-none"
                style={{
                  left: `${(hsl.h / 360) * 100}%`,
                  transform: 'translateX(-50%)',
                }}
              />
            </div>
          </div>

          {/* RGB Inputs */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">R</label>
              <input
                type="number"
                min="0"
                max="255"
                value={rgb.r}
                onChange={(e) => handleRgbChange('r', e.target.value)}
                className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">G</label>
              <input
                type="number"
                min="0"
                max="255"
                value={rgb.g}
                onChange={(e) => handleRgbChange('g', e.target.value)}
                className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">B</label>
              <input
                type="number"
                min="0"
                max="255"
                value={rgb.b}
                onChange={(e) => handleRgbChange('b', e.target.value)}
                className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ColorPicker;
