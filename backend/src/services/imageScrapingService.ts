import puppeteer, { Browser, Page } from 'puppeteer';
import * as vm from 'vm';

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
    await page.waitForTimeout(2000);
    
    // Extract simplified DOM structure focusing on images and navigation
    const structure = await page.evaluate(() => {
      const result: any = {
        url: window.location.href,
        title: document.title,
        images: [],
        navigation: [],
        headers: []
      };
      
      // Extract all images with their attributes
      const images = document.querySelectorAll('img');
      images.forEach((img, index) => {
        if (index < 50) { // Limit to first 50 images
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
        }
      });
      
      // Extract navigation structure
      const navElements = document.querySelectorAll('nav, header, [role="navigation"]');
      navElements.forEach((nav, index) => {
        if (index < 5) {
          const images = nav.querySelectorAll('img');
          result.navigation.push({
            tag: nav.tagName,
            className: nav.className || '',
            id: nav.id || '',
            imageCount: images.length,
            images: Array.from(images).slice(0, 5).map(img => ({
              src: img.src || img.getAttribute('src') || '',
              alt: img.alt || ''
            }))
          });
        }
      });
      
      // Extract headers (h1-h6)
      const headers = document.querySelectorAll('h1, h2, h3');
      headers.forEach((header, index) => {
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
 * Execute Gemini-generated scraping code in a sandboxed VM
 * The code should return an object with logo_url and image_urls
 */
export async function executeScrapingCode(
  code: string,
  url: string
): Promise<{ logo_url?: string; image_urls?: string[] }> {
  let browser: Browser | null = null;
  
  try {
    console.log(`[Scraping Service] Executing scraping code for: ${url}`);
    console.log(`[Scraping Service] Code length: ${code.length} characters`);
    
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
    await page.waitForTimeout(2000);
    
    // Create sandboxed VM context
    const vmContext = vm.createContext({
      page: page,
      browser: browser,
      // Provide safe console
      console: {
        log: (...args: any[]) => console.log('[Scraped Code]', ...args),
        error: (...args: any[]) => console.error('[Scraped Code]', ...args),
        warn: (...args: any[]) => console.warn('[Scraped Code]', ...args)
      },
      // Provide URL helper
      URL: URL,
      // Provide setTimeout/setInterval for async operations
      setTimeout: setTimeout,
      setInterval: setInterval,
      clearTimeout: clearTimeout,
      clearInterval: clearInterval,
      // Provide Promise for async/await
      Promise: Promise
    });
    
    // Wrap code in async function and execute
    const wrappedCode = `
      (async function() {
        ${code}
      })()
    `;
    
    // Execute in VM with timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('Scraping code execution timeout (30s)'));
      }, 30000);
    });
    
    const executePromise = (async () => {
      try {
        const script = new vm.Script(wrappedCode, { timeout: 30000 });
        const result = script.runInContext(vmContext);
        // If result is a Promise, await it; otherwise return directly
        return result instanceof Promise ? await result : result;
      } catch (error: any) {
        throw new Error(`Code execution error: ${error.message}`);
      }
    })();
    
    // Race between execution and timeout
    const result = await Promise.race([executePromise, timeoutPromise]);
    
    console.log(`[Scraping Service] Code execution result:`, {
      hasLogo: !!result?.logo_url,
      imageCount: result?.image_urls?.length || 0
    });
    
    // Validate result format
    if (!result || typeof result !== 'object') {
      throw new Error('Scraping code did not return a valid object');
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
    
    return {
      logo_url: validated_logo_url,
      image_urls: image_urls.length > 0 ? image_urls : undefined
    };
  } catch (error: any) {
    console.error(`[Scraping Service] Error executing scraping code:`, error.message);
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

