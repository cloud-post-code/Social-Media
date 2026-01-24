// Google Fonts utility
// Loads fonts dynamically and provides a list of popular Google Fonts

export interface GoogleFont {
  family: string;
  category: 'sans-serif' | 'serif' | 'display' | 'handwriting' | 'monospace';
}

// Popular Google Fonts - reduced to 10 for faster builds
export const GOOGLE_FONTS: GoogleFont[] = [
  // Sans-serif (most popular)
  { family: 'Inter', category: 'sans-serif' },
  { family: 'Roboto', category: 'sans-serif' },
  { family: 'Open Sans', category: 'sans-serif' },
  { family: 'Montserrat', category: 'sans-serif' },
  
  // Serif
  { family: 'Merriweather', category: 'serif' },
  { family: 'Playfair Display', category: 'serif' },
  
  // Handwriting/Cursive
  { family: 'Dancing Script', category: 'handwriting' },
  { family: 'Kalam', category: 'handwriting' },
  
  // Display
  { family: 'Oswald', category: 'display' },
  { family: 'Bangers', category: 'display' },
];

// Map old font names to Google Fonts
export const FONT_MAPPING: Record<string, string> = {
  'sans-serif': 'Inter',
  'serif': 'Merriweather',
  'cursive': 'Dancing Script',
  'handwritten': 'Kalam',
};

// Load a Google Font dynamically
export const loadGoogleFont = (fontFamily: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Check if font is already loaded
    if (document.fonts.check(`16px "${fontFamily}"`)) {
      resolve();
      return;
    }

    // Check if link already exists
    const existingLink = document.querySelector(`link[href*="${encodeURIComponent(fontFamily)}"]`);
    if (existingLink) {
      resolve();
      return;
    }

    // Create link element to load font
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontFamily)}:wght@300;400;500;600;700&display=swap`;
    
    link.onload = () => resolve();
    link.onerror = () => reject(new Error(`Failed to load font: ${fontFamily}`));
    
    document.head.appendChild(link);
  });
};

// Get font family string for CSS
export const getFontFamilyString = (fontName: string): string => {
  // If it's a mapped font (old system), use the mapping
  if (FONT_MAPPING[fontName]) {
    return `"${FONT_MAPPING[fontName]}", ${fontName === 'cursive' || fontName === 'handwritten' ? 'cursive' : fontName}`;
  }
  
  // If it's already a Google Font name, use it directly
  const isGoogleFont = GOOGLE_FONTS.some(f => f.family === fontName);
  if (isGoogleFont) {
    return `"${fontName}", sans-serif`;
  }
  
  // Fallback to system fonts
  switch (fontName) {
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

// Get font category for filtering
export const getFontCategory = (fontName: string): string => {
  const font = GOOGLE_FONTS.find(f => f.family === fontName);
  if (font) return font.category;
  
  // Map old system fonts
  if (fontName === 'sans-serif') return 'sans-serif';
  if (fontName === 'serif') return 'serif';
  if (fontName === 'cursive' || fontName === 'handwritten') return 'handwriting';
  
  return 'sans-serif';
};

