// Base HTTP client

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

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
    throw new Error(`Expected JSON but received: ${contentType || 'unknown content type'}. Response: ${text.substring(0, 200)}`);
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

