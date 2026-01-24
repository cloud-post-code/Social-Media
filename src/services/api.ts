// Base HTTP client

// Get and normalize API URL
let API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Normalize the URL - ensure it has protocol and /api suffix
if (API_BASE_URL && !API_BASE_URL.startsWith('http://') && !API_BASE_URL.startsWith('https://')) {
  // Add https:// if protocol is missing
  API_BASE_URL = `https://${API_BASE_URL}`;
}

// Ensure /api suffix is present
if (API_BASE_URL && !API_BASE_URL.endsWith('/api')) {
  // Remove trailing slash if present, then add /api
  API_BASE_URL = API_BASE_URL.replace(/\/$/, '') + '/api';
}

// Log API URL for debugging
console.log('[API] API_BASE_URL (normalized):', API_BASE_URL);
console.log('[API] VITE_API_URL env var (raw):', import.meta.env.VITE_API_URL || 'not set');

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const config: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  const response = await fetch(url, config);

  // Handle 204 No Content responses (common for DELETE requests)
  if (response.status === 204) {
    return undefined as T;
  }

  // Check content type before parsing
  const contentType = response.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');

  if (!response.ok) {
    let errorMessage = response.statusText;
    if (isJson) {
      try {
        const error = await response.json();
        errorMessage = error.error?.message || error.message || response.statusText;
      } catch (e) {
        // If JSON parsing fails, use status text
        errorMessage = response.statusText;
      }
    } else {
      // If response is HTML (like a 404 page), try to get text
      try {
        const text = await response.text();
        if (text.includes('<!DOCTYPE') || text.includes('<html')) {
          errorMessage = `Server returned HTML instead of JSON. This usually means the endpoint doesn't exist or the server isn't running. Status: ${response.status}`;
        } else {
          errorMessage = text.substring(0, 200) || response.statusText;
        }
      } catch (e) {
        errorMessage = `HTTP error! status: ${response.status}`;
      }
    }
    throw new Error(errorMessage);
  }

  if (!isJson) {
    const text = await response.text();
    let errorMessage = `Expected JSON but received: ${contentType || 'unknown content type'}`;
    
    if (text.includes('<!DOCTYPE') || text.includes('<html')) {
      errorMessage += '\n\n⚠️ Server returned HTML instead of JSON.';
      errorMessage += `\nRequest URL: ${url}`;
      errorMessage += `\nThis usually means:`;
      errorMessage += '\n1. VITE_API_URL is pointing to the frontend URL instead of backend';
      errorMessage += '\n2. The backend server is not running';
      errorMessage += '\n3. The API endpoint doesn\'t exist';
      errorMessage += `\n\nCurrent VITE_API_URL: ${import.meta.env.VITE_API_URL || 'not set (using default: http://localhost:3001/api)'}`;
      
      if (!import.meta.env.VITE_API_URL) {
        errorMessage += '\n\n❌ VITE_API_URL is not set!';
        errorMessage += '\nSet it in Railway: Frontend Service → Variables → VITE_API_URL = https://social-media-production-cf45.up.railway.app/api';
      } else if (import.meta.env.VITE_API_URL.includes('amused-generosity')) {
        errorMessage += '\n\n❌ VITE_API_URL appears to be pointing to the FRONTEND URL!';
        errorMessage += '\nIt should point to the BACKEND URL: https://social-media-production-cf45.up.railway.app/api';
      } else if (!import.meta.env.VITE_API_URL.endsWith('/api')) {
        errorMessage += '\n\n❌ VITE_API_URL is missing /api suffix!';
        errorMessage += '\nIt should end with /api: https://social-media-production-cf45.up.railway.app/api';
      }
    } else {
      errorMessage += `. Response: ${text.substring(0, 200)}`;
    }
    
    throw new Error(errorMessage);
  }

  return response.json();
}

export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint, { method: 'GET' }),
  post: <T>(endpoint: string, data?: any) =>
    request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  put: <T>(endpoint: string, data?: any) =>
    request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' }),
};

