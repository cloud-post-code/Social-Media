// Google Fonts utility
// Loads fonts dynamically and provides a list of popular Google Fonts

export interface GoogleFont {
  family: string;
  category: 'sans-serif' | 'serif' | 'display' | 'handwriting' | 'monospace';
}

// Popular Google Fonts organized by category
export const GOOGLE_FONTS: GoogleFont[] = [
  // Sans-serif
  { family: 'Roboto', category: 'sans-serif' },
  { family: 'Open Sans', category: 'sans-serif' },
  { family: 'Lato', category: 'sans-serif' },
  { family: 'Montserrat', category: 'sans-serif' },
  { family: 'Raleway', category: 'sans-serif' },
  { family: 'Poppins', category: 'sans-serif' },
  { family: 'Source Sans Pro', category: 'sans-serif' },
  { family: 'Ubuntu', category: 'sans-serif' },
  { family: 'Nunito', category: 'sans-serif' },
  { family: 'Inter', category: 'sans-serif' },
  { family: 'Work Sans', category: 'sans-serif' },
  { family: 'DM Sans', category: 'sans-serif' },
  { family: 'Manrope', category: 'sans-serif' },
  { family: 'Plus Jakarta Sans', category: 'sans-serif' },
  { family: 'Figtree', category: 'sans-serif' },
  
  // Serif
  { family: 'Merriweather', category: 'serif' },
  { family: 'Lora', category: 'serif' },
  { family: 'Playfair Display', category: 'serif' },
  { family: 'Crimson Text', category: 'serif' },
  { family: 'PT Serif', category: 'serif' },
  { family: 'Libre Baskerville', category: 'serif' },
  { family: 'Cormorant Garamond', category: 'serif' },
  { family: 'EB Garamond', category: 'serif' },
  { family: 'Bitter', category: 'serif' },
  { family: 'Vollkorn', category: 'serif' },
  
  // Display
  { family: 'Oswald', category: 'display' },
  { family: 'Bebas Neue', category: 'display' },
  { family: 'Righteous', category: 'display' },
  { family: 'Bangers', category: 'display' },
  { family: 'Fredoka One', category: 'display' },
  { family: 'Abril Fatface', category: 'display' },
  { family: 'Anton', category: 'display' },
  { family: 'Bungee', category: 'display' },
  { family: 'Creepster', category: 'display' },
  { family: 'Fugaz One', category: 'display' },
  
  // Handwriting/Cursive
  { family: 'Dancing Script', category: 'handwriting' },
  { family: 'Pacifico', category: 'handwriting' },
  { family: 'Great Vibes', category: 'handwriting' },
  { family: 'Kalam', category: 'handwriting' },
  { family: 'Caveat', category: 'handwriting' },
  { family: 'Permanent Marker', category: 'handwriting' },
  { family: 'Satisfy', category: 'handwriting' },
  { family: 'Amatic SC', category: 'handwriting' },
  { family: 'Shadows Into Light', category: 'handwriting' },
  { family: 'Indie Flower', category: 'handwriting' },
  { family: 'Comfortaa', category: 'handwriting' },
  { family: 'Kaushan Script', category: 'handwriting' },
  { family: 'Lobster', category: 'handwriting' },
  { family: 'Allura', category: 'handwriting' },
  { family: 'Parisienne', category: 'handwriting' },
  
  // Monospace (for completeness)
  { family: 'Roboto Mono', category: 'monospace' },
  { family: 'Source Code Pro', category: 'monospace' },
  { family: 'Fira Code', category: 'monospace' },
  { family: 'JetBrains Mono', category: 'monospace' },
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

