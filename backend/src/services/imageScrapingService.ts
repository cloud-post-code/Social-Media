import puppeteer, { Browser, Page } from 'puppeteer';

/**
 * Extract simplified DOM structure from a website for Gemini analysis
 * Focuses on image elements, headers, and navigation structure
 */
export async function getWebsiteStructure(url: string): Promise<string> {
  let browser: Browser | null = null;
  
  try {
    console.log(`[Scraping Service] Loading website: ${url}`);
    
    // Launch browser with minimal resources
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-web-security'
      ]
    });
    
    const page = await browser.newPage();
    
    // Set a reasonable timeout
    page.setDefaultTimeout(30000);
    
    // Set viewport
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Navigate to the page
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    // Wait a bit for any lazy-loaded content
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Extract simplified DOM structure focusing on images and navigation
    const structure = await page.evaluate(() => {
      // TypeScript doesn't know about browser globals inside evaluate
      // These are available in the browser context where this code runs
      // @ts-expect-error - window is available in browser context
      const win = window;
      // @ts-expect-error - document is available in browser context
      const doc = document;
      
      const result: any = {
        url: win.location.href,
        title: doc.title,
        images: [],
        navigation: [],
        headers: []
      };
      
      // Extract all images with their attributes
      const images = doc.querySelectorAll('img');
      images.forEach((img: any, index: number) => {
        const rect = img.getBoundingClientRect();
        result.images.push({
          src: img.src || img.getAttribute('src') || '',
          alt: img.alt || '',
          width: rect.width,
          height: rect.height,
          className: img.className || '',
          id: img.id || '',
          parentTag: img.parentElement?.tagName || '',
          parentClass: img.parentElement?.className || ''
        });
      });
      
      // Extract navigation structure
      const navElements = doc.querySelectorAll('nav, header, [role="navigation"]');
      navElements.forEach((nav: any, index: number) => {
        if (index < 5) {
          const navImages = nav.querySelectorAll('img');
          result.navigation.push({
            tag: nav.tagName,
            className: nav.className || '',
            id: nav.id || '',
            imageCount: navImages.length,
            images: Array.from(navImages).slice(0, 5).map((img: any) => ({
              src: img.src || img.getAttribute('src') || '',
              alt: img.alt || ''
            }))
          });
        }
      });
      
      // Extract headers (h1-h6)
      const headers = doc.querySelectorAll('h1, h2, h3');
      headers.forEach((header: any, index: number) => {
        if (index < 10) {
          result.headers.push({
            tag: header.tagName,
            text: header.textContent?.substring(0, 100) || '',
            className: header.className || ''
          });
        }
      });
      
      return result;
    });
    
    console.log(`[Scraping Service] Extracted structure: ${structure.images.length} images, ${structure.navigation.length} nav elements`);
    
    return JSON.stringify(structure, null, 2);
  } catch (error: any) {
    console.error(`[Scraping Service] Error extracting structure:`, error.message);
    throw new Error(`Failed to extract website structure: ${error.message}`);
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (closeError: any) {
        console.error(`[Scraping Service] Error closing browser in getWebsiteStructure:`, closeError.message);
      }
    }
  }
}

/**
 * NEW: Direct Puppeteer-based scraping with intelligent heuristics
 * More reliable than AI-generated code approach
 */
export async function scrapeBrandAssetsDirect(
  url: string
): Promise<{ logo_url?: string; image_urls?: string[] }> {
  let browser: Browser | null = null;
  
  try {
    console.log(`[Scraping Service] Starting direct scraping for: ${url}`);
    
    // Launch browser
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-web-security'
      ]
    });
    
    const page = await browser.newPage();
    page.setDefaultTimeout(30000);
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Navigate to the page
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    // Wait for content to load, especially lazy-loaded images
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Scroll down to trigger lazy loading
    await page.evaluate(() => {
      // @ts-expect-error - browser globals
      window.scrollTo(0, document.body.scrollHeight / 2);
    });
    await new Promise(resolve => setTimeout(resolve, 1000));
    await page.evaluate(() => {
      // @ts-expect-error - browser globals
      window.scrollTo(0, document.body.scrollHeight);
    });
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Extract all images with detailed metadata
    const imageData = await page.evaluate((baseUrl: string) => {
      // @ts-expect-error - browser globals
      const doc = document;
      // @ts-expect-error - browser globals
      const win = window;
      
      const images: Array<{
        src: string;
        alt: string;
        width: number;
        height: number;
        naturalWidth: number;
        naturalHeight: number;
        className: string;
        id: string;
        parentTag: string;
        parentClass: string;
        isInHeader: boolean;
        isInNav: boolean;
        isInHero: boolean;
        isInGallery: boolean;
        isVisible: boolean;
        aspectRatio: number;
        area: number;
      }> = [];
      
      const allImages = doc.querySelectorAll('img');
      const baseUrlObj = new URL(baseUrl);
      
      allImages.forEach((img: any) => {
        try {
          // Get image source (handle lazy loading attributes)
          let src = img.src || img.getAttribute('src') || img.getAttribute('data-src') || 
                    img.getAttribute('data-lazy-src') || img.getAttribute('data-original') || '';
          
          // Skip data URLs and empty sources
          if (!src || src.startsWith('data:') || src.trim() === '') return;
          
          // Convert relative URLs to absolute
          try {
            if (src.startsWith('//')) {
              src = `${baseUrlObj.protocol}${src}`;
            } else if (src.startsWith('/')) {
              src = `${baseUrlObj.protocol}//${baseUrlObj.host}${src}`;
            } else if (!src.startsWith('http')) {
              src = new URL(src, baseUrl).href;
            }
          } catch (e) {
            // Invalid URL, skip
            return;
          }
          
          const rect = img.getBoundingClientRect();
          const naturalWidth = img.naturalWidth || rect.width;
          const naturalHeight = img.naturalHeight || rect.height;
          
          // Skip very small images (likely icons)
          if (naturalWidth < 50 || naturalHeight < 50) return;
          
          // Check if image is in header/nav
          let isInHeader = false;
          let isInNav = false;
          let parent = img.parentElement;
          let depth = 0;
          while (parent && depth < 5) {
            const tagName = parent.tagName?.toLowerCase();
            const className = parent.className?.toLowerCase() || '';
            const id = parent.id?.toLowerCase() || '';
            
            if (tagName === 'header' || className.includes('header') || id.includes('header')) {
              isInHeader = true;
            }
            if (tagName === 'nav' || className.includes('nav') || id.includes('nav') || 
                parent.getAttribute('role') === 'navigation') {
              isInNav = true;
            }
            parent = parent.parentElement;
            depth++;
          }
          
          // Check if in hero section
          const isInHero = img.closest('[class*="hero"], [class*="banner"], [id*="hero"], [id*="banner"]') !== null;
          
          // Check if in gallery/carousel
          const isInGallery = img.closest('[class*="gallery"], [class*="carousel"], [class*="slider"], [class*="product"]') !== null;
          
          // Check visibility
          const isVisible = rect.width > 0 && rect.height > 0 && 
                           win.getComputedStyle(img).display !== 'none' &&
                           win.getComputedStyle(img).visibility !== 'hidden' &&
                           win.getComputedStyle(img).opacity !== '0';
          
          const area = naturalWidth * naturalHeight;
          const aspectRatio = naturalHeight > 0 ? naturalWidth / naturalHeight : 1;
          
          images.push({
            src,
            alt: img.alt || '',
            width: rect.width,
            height: rect.height,
            naturalWidth,
            naturalHeight,
            className: img.className || '',
            id: img.id || '',
            parentTag: img.parentElement?.tagName || '',
            parentClass: img.parentElement?.className || '',
            isInHeader,
            isInNav,
            isInHero,
            isInGallery,
            isVisible,
            aspectRatio,
            area
          });
        } catch (e) {
          // Skip images that cause errors
        }
      });
      
      return images;
    }, url);
    
    console.log(`[Scraping Service] Found ${imageData.length} images`);
    
    // Find logo (prioritize images in header/nav, with logo-related keywords)
    const logoKeywords = ['logo', 'brand', 'logotype'];
    const logoCandidates = imageData
      .filter(img => {
        const altLower = img.alt.toLowerCase();
        const classNameLower = img.className.toLowerCase();
        const idLower = img.id.toLowerCase();
        
        const hasLogoKeyword = logoKeywords.some(keyword => 
          altLower.includes(keyword) || classNameLower.includes(keyword) || idLower.includes(keyword)
        );
        
        // Logo is usually in header/nav, square-ish, and not too large
        return (img.isInHeader || img.isInNav) && 
               img.isVisible &&
               img.area > 1000 && // At least 32x32px
               img.area < 500000 && // Not huge
               (hasLogoKeyword || (img.aspectRatio > 0.5 && img.aspectRatio < 2.5)); // Roughly square
      })
      .sort((a, b) => {
        // Prioritize: has logo keyword > larger area > better aspect ratio
        const aHasKeyword = logoKeywords.some(k => 
          a.alt.toLowerCase().includes(k) || a.className.toLowerCase().includes(k)
        );
        const bHasKeyword = logoKeywords.some(k => 
          b.alt.toLowerCase().includes(k) || b.className.toLowerCase().includes(k)
        );
        
        if (aHasKeyword && !bHasKeyword) return -1;
        if (!aHasKeyword && bHasKeyword) return 1;
        
        // Prefer images closer to square (aspect ratio near 1)
        const aSquareScore = 1 - Math.abs(1 - a.aspectRatio);
        const bSquareScore = 1 - Math.abs(1 - b.aspectRatio);
        
        if (Math.abs(aSquareScore - bSquareScore) > 0.2) {
          return bSquareScore - aSquareScore;
        }
        
        return b.area - a.area;
      });
    
    const logo_url = logoCandidates.length > 0 ? logoCandidates[0].src : undefined;
    
    if (logo_url) {
      console.log(`[Scraping Service] Found logo: ${logo_url.substring(0, 80)}...`);
    }
    
    // Find brand images (hero, gallery, product images)
    // Filter out: icons, logos, very small images, hidden images
    const brandImageCandidates = imageData
      .filter(img => {
        // Skip if it's the logo
        if (logo_url && img.src === logo_url) return false;
        
        // Must be visible and reasonably sized
        if (!img.isVisible || img.area < 50000) return false; // At least ~224x224px
        
        // Skip icons (very small or square small images)
        if (img.area < 10000 && img.aspectRatio > 0.8 && img.aspectRatio < 1.2) return false;
        
        // Skip avatars/profile images (usually small and square)
        const altLower = img.alt.toLowerCase();
        const classNameLower = img.className.toLowerCase();
        if ((altLower.includes('avatar') || altLower.includes('profile') || classNameLower.includes('avatar')) &&
            img.area < 25000) {
          return false;
        }
        
        return true;
      })
      .sort((a, b) => {
        // Prioritize: hero images > gallery images > larger images > better positioned
        let aScore = 0;
        let bScore = 0;
        
        if (a.isInHero) aScore += 100;
        if (b.isInHero) bScore += 100;
        
        if (a.isInGallery) aScore += 50;
        if (b.isInGallery) bScore += 50;
        
        // Prefer landscape images (common for hero/product images)
        if (a.aspectRatio > 1.2 && a.aspectRatio < 3) aScore += 20;
        if (b.aspectRatio > 1.2 && b.aspectRatio < 3) bScore += 20;
        
        // Prefer larger images
        aScore += Math.min(a.area / 10000, 30);
        bScore += Math.min(b.area / 10000, 30);
        
        return bScore - aScore;
      });
    
    // Remove duplicates and limit to top 10-15 images
    const seenUrls = new Set<string>();
    const uniqueImages: string[] = [];
    
    for (const img of brandImageCandidates) {
      if (seenUrls.has(img.src)) continue;
      
      // Check for similar URLs (different sizes/parameters)
      const baseUrl = img.src.split('?')[0].split('#')[0];
      const isDuplicate = Array.from(seenUrls).some(seen => {
        const seenBase = seen.split('?')[0].split('#')[0];
        return baseUrl === seenBase;
      });
      
      if (!isDuplicate) {
        seenUrls.add(img.src);
        uniqueImages.push(img.src);
        
        if (uniqueImages.length >= 15) break;
      }
    }
    
    console.log(`[Scraping Service] Found ${uniqueImages.length} brand images`);
    
    // Validate URLs
    const validatedImages = uniqueImages.filter(imgUrl => {
      try {
        const urlObj = new URL(imgUrl);
        return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
      } catch {
        return false;
      }
    });
    
    return {
      logo_url: logo_url ? (() => {
        try {
          const urlObj = new URL(logo_url);
          return (urlObj.protocol === 'http:' || urlObj.protocol === 'https:') ? logo_url : undefined;
        } catch {
          return undefined;
        }
      })() : undefined,
      image_urls: validatedImages.length > 0 ? validatedImages : undefined
    };
    
  } catch (error: any) {
    console.error(`[Scraping Service] Error in direct scraping:`, error.message);
    console.error(`[Scraping Service] Error stack:`, error.stack);
    throw new Error(`Failed to scrape brand assets: ${error.message}`);
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (closeError: any) {
        console.error(`[Scraping Service] Error closing browser:`, closeError.message);
      }
    }
  }
}

/**
 * Execute Gemini-generated scraping code directly (not in VM to avoid Puppeteer context issues)
 * The code should return an object with logo_url and image_urls
 * @deprecated Use scrapeBrandAssetsDirect instead for more reliable results
 */
export async function executeScrapingCode(
  code: string,
  url: string
): Promise<{ logo_url?: string; image_urls?: string[] }> {
  let browser: Browser | null = null;
  
  try {
    console.log(`[Scraping Service] Executing scraping code for: ${url}`);
    console.log(`[Scraping Service] Code length: ${code.length} characters`);
    console.log(`[Scraping Service] Code preview (first 500 chars):`, code.substring(0, 500));
    
    // Launch browser
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-web-security'
      ]
    });
    
    const page = await browser.newPage();
    page.setDefaultTimeout(30000);
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Navigate to the page
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    // Wait for content to load
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Create a console object for the scraping code to use
    const logConsole = {
      log: (...args: any[]) => console.log('[Scraped Code]', ...args),
      error: (...args: any[]) => console.error('[Scraped Code]', ...args),
      warn: (...args: any[]) => console.warn('[Scraped Code]', ...args)
    };
    
    // Execute code directly using Function constructor
    // The code from Gemini should be executable code that uses 'page' variable
    // We pass 'page', 'URL', and 'console' as parameters that will be available in the code's scope
    // Wrap the code in an async IIFE so it executes immediately
    // Note: The code from Gemini should end with something like: return await scrapeImages(page);
    const wrappedCode = `
      ${code}
    `;
    
    // Create the scraping function
    // Note: Using Function constructor allows the code to access 'page', 'URL', and 'console' parameters
    // This is necessary because Puppeteer page objects don't work in VM contexts
    // The code will execute in a closure where 'page', 'URL', and 'console' are available
    const scrapingFunction = new Function('page', 'URL', 'console', `
      return (async function() {
        ${wrappedCode}
      })();
    `);
    
    // Execute with timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('Scraping code execution timeout (30s)'));
      }, 30000);
    });
    
    const executePromise = (async () => {
      try {
        console.log(`[Scraping Service] About to execute scraping function...`);
        const result = await scrapingFunction(page, URL, logConsole);
        console.log(`[Scraping Service] Scraping function completed, result type:`, typeof result);
        return result;
      } catch (error: any) {
        console.error(`[Scraping Service] Code execution error:`, error);
        console.error(`[Scraping Service] Error stack:`, error.stack);
        throw new Error(`Code execution error: ${error.message}`);
      }
    })();
    
    // Race between execution and timeout
    const result = await Promise.race([executePromise, timeoutPromise]);
    
    console.log(`[Scraping Service] Code execution result:`, {
      hasLogo: !!result?.logo_url,
      imageCount: result?.image_urls?.length || 0,
      resultType: typeof result,
      resultKeys: result ? Object.keys(result) : []
    });
    
    // Validate result format
    if (!result || typeof result !== 'object') {
      console.error(`[Scraping Service] Invalid result format:`, result);
      throw new Error(`Scraping code did not return a valid object. Got: ${typeof result}`);
    }
    
    // Ensure logo_url is a non-empty string or undefined
    const logo_url = result.logo_url && typeof result.logo_url === 'string' && result.logo_url.trim().length > 0
      ? result.logo_url.trim()
      : undefined;
    

    // Ensure image_urls is an array and validate URLs
    const image_urls = Array.isArray(result.image_urls) 
      ? result.image_urls
          .filter((url: any) => typeof url === 'string' && url.trim().length > 0)
          .map((url: string) => url.trim())
          .filter((url: string) => {
            // Validate URL format
            try {
              const urlObj = new URL(url);
              // Only allow http/https protocols
              return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
            } catch {
              return false; // Invalid URL format
            }
          })
      : [];
    
    // Validate logo_url if present
    let validated_logo_url = logo_url;
    if (logo_url) {
      try {
        const urlObj = new URL(logo_url);
        if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
          validated_logo_url = undefined;
        }
      } catch {
        validated_logo_url = undefined; // Invalid URL format
      }
    }
    
    console.log(`[Scraping Service] Final validated result:`, {
      logo_url: validated_logo_url ? `${validated_logo_url.substring(0, 50)}...` : 'none',
      image_count: image_urls.length,
      image_urls_preview: image_urls.slice(0, 3).map((u: string) => u.substring(0, 50))
    });
    
    return {
      logo_url: validated_logo_url,
      image_urls: image_urls.length > 0 ? image_urls : undefined
    };
  } catch (error: any) {
    console.error(`[Scraping Service] Error executing scraping code:`, error.message);
    console.error(`[Scraping Service] Error stack:`, error.stack);
    throw new Error(`Failed to execute scraping code: ${error.message}`);
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (closeError: any) {
        console.error(`[Scraping Service] Error closing browser in executeScrapingCode:`, closeError.message);
      }
    }
  }
}

/**
 * Extract brand colors from a website using Puppeteer
 * Similar to how images are extracted, but focuses on CSS colors
 */
export async function extractBrandColors(url: string): Promise<{
  primary_color_hex?: string;
  secondary_color_hex?: string;
  colors?: string[];
}> {
  let browser: Browser | null = null;
  
  try {
    console.log(`[Scraping Service] Extracting colors from: ${url}`);
    
    // Launch browser
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-web-security'
      ]
    });
    
    const page = await browser.newPage();
    page.setDefaultTimeout(30000);
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Navigate to the page
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    // Wait for content to load
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Extract colors from the page
    const colors = await page.evaluate(() => {
      // TypeScript doesn't know about browser globals inside evaluate
      // @ts-expect-error - document is available in browser context
      const doc = document;
      
      // Helper function to convert RGB/RGBA to hex
      const rgbToHex = (r: number, g: number, b: number): string => {
        const toHex = (n: number) => {
          const hex = Math.round(n).toString(16);
          return hex.length === 1 ? '0' + hex : hex;
        };
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
      };
      
      // Helper function to parse color string
      const parseColor = (colorStr: string): string | null => {
        if (!colorStr) return null;
        
        // Already hex
        if (colorStr.startsWith('#')) {
          return colorStr.length === 7 ? colorStr.toUpperCase() : null;
        }
        
        // RGB/RGBA
        const rgbMatch = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (rgbMatch) {
          return rgbToHex(parseInt(rgbMatch[1]), parseInt(rgbMatch[2]), parseInt(rgbMatch[3]));
        }
        
        // Named colors (basic set)
        const namedColors: { [key: string]: string } = {
          'white': '#FFFFFF', 'black': '#000000', 'red': '#FF0000',
          'green': '#00FF00', 'blue': '#0000FF', 'yellow': '#FFFF00',
          'cyan': '#00FFFF', 'magenta': '#FF00FF', 'gray': '#808080',
          'grey': '#808080', 'orange': '#FFA500', 'purple': '#800080',
          'pink': '#FFC0CB', 'brown': '#A52A2A', 'navy': '#000080'
        };
        
        const lower = colorStr.toLowerCase().trim();
        return namedColors[lower] || null;
      };
      
      // Collect colors from various sources
      const colorSet = new Set<string>();
      
      // 1. Extract from computed styles of key UI elements
      const uiElements = [
        ...doc.querySelectorAll('button, a, [role="button"]'),
        ...doc.querySelectorAll('header, nav, [role="navigation"]'),
        ...doc.querySelectorAll('[class*="btn"], [class*="button"], [class*="cta"]'),
        ...doc.querySelectorAll('h1, h2, h3, .logo, [class*="logo"]')
      ];
      
      uiElements.forEach((el: any) => {
        try {
          // @ts-expect-error - window is available in browser context
          const styles = window.getComputedStyle(el);
          const bgColor = parseColor(styles.backgroundColor);
          const textColor = parseColor(styles.color);
          const borderColor = parseColor(styles.borderColor);
          
          if (bgColor && bgColor !== '#FFFFFF' && bgColor !== '#000000') colorSet.add(bgColor);
          if (textColor && textColor !== '#FFFFFF' && textColor !== '#000000') colorSet.add(textColor);
          if (borderColor && borderColor !== '#FFFFFF' && borderColor !== '#000000') colorSet.add(borderColor);
        } catch (e) {
          // Ignore errors for individual elements
        }
      });
      
      // 2. Extract from CSS variables
      // @ts-expect-error - window is available in browser context
      const rootStyles = window.getComputedStyle(doc.documentElement);
      for (let i = 0; i < rootStyles.length; i++) {
        const prop = rootStyles[i];
        if (prop.startsWith('--')) {
          const value = rootStyles.getPropertyValue(prop).trim();
          const color = parseColor(value);
          if (color && color !== '#FFFFFF' && color !== '#000000') {
            colorSet.add(color);
          }
        }
      }
      
      // 3. Extract from inline styles
      const elementsWithStyles = doc.querySelectorAll('[style]');
      elementsWithStyles.forEach((el: any) => {
        const style = el.getAttribute('style') || '';
        const colorMatches = style.match(/(?:color|background-color|border-color):\s*([^;]+)/gi);
        if (colorMatches) {
          colorMatches.forEach((match: string) => {
            const colorStr = match.split(':')[1]?.trim();
            if (colorStr) {
              const color = parseColor(colorStr);
              if (color && color !== '#FFFFFF' && color !== '#000000') {
                colorSet.add(color);
              }
            }
          });
        }
      });
      
      // Convert to array and filter out common neutrals
      const colors = Array.from(colorSet).filter(color => {
        // Filter out very light grays (likely backgrounds)
        const rgb = parseInt(color.slice(1), 16);
        const r = (rgb >> 16) & 0xFF;
        const g = (rgb >> 8) & 0xFF;
        const b = rgb & 0xFF;
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        
        // Keep colors that are not too light (brightness < 240) and not pure black/white
        return brightness < 240 && color !== '#FFFFFF' && color !== '#000000';
      });
      
      // Sort by frequency (simple heuristic: prioritize colors found in buttons/CTAs)
      const colorFrequency: { [key: string]: number } = {};
      colors.forEach(color => {
        colorFrequency[color] = (colorFrequency[color] || 0) + 1;
      });
      
      const sortedColors = colors.sort((a, b) => {
        return (colorFrequency[b] || 0) - (colorFrequency[a] || 0);
      });
      
      // Return top colors
      return {
        colors: sortedColors.slice(0, 10), // Top 10 colors
        primary: sortedColors[0] || null,
        secondary: sortedColors[1] || null
      };
    });
    
    console.log(`[Scraping Service] Extracted ${colors.colors?.length || 0} colors`);
    
    return {
      primary_color_hex: colors.primary || undefined,
      secondary_color_hex: colors.secondary || undefined,
      colors: colors.colors && colors.colors.length > 0 ? colors.colors : undefined
    };
  } catch (error: any) {
    console.error(`[Scraping Service] Error extracting colors:`, error.message);
    throw new Error(`Failed to extract brand colors: ${error.message}`);
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (closeError: any) {
        console.error(`[Scraping Service] Error closing browser in extractBrandColors:`, closeError.message);
      }
    }
  }
}

