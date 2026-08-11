import { getApiUrl, authFetch } from '../utils/api';

interface CachedSignedUrl {
  url: string;
  expiresAtMs: number;
}

// In-memory cache for short-lived CloudFront signed URLs
const signedUrlCache = new Map<string, CachedSignedUrl>();

/**
 * Requests a temporary CloudFront signed URL from the backend for the given S3 object key.
 * Uses client-side caching to reuse valid signed URLs before they expire.
 * 
 * @param objectKey S3 object key (e.g. "biology/class_11/anatomy_of_flowering_plants/anatomy_of_flowering_plants_1.json" or "index.json")
 * @returns Temporary CloudFront signed URL string
 */
export async function getCloudFrontSignedUrl(objectKey: string): Promise<string> {
  const cleanKey = objectKey.replace(/^\/+/, '').trim();
  
  // Check client-side cache
  const cached = signedUrlCache.get(cleanKey);
  const now = Date.now();
  
  // Reuse cached URL if it exists and has more than 30 seconds left before expiration
  if (cached && cached.expiresAtMs - now > 30000) {
    return cached.url;
  }

  const endpointUrl = getApiUrl('/api/cloudfront/signed-url');

  const response = await authFetch(endpointUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ key: cleanKey }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.error || `Failed to fetch signed URL (HTTP ${response.status})`;
    throw new Error(message);
  }

  const data = await response.json();
  if (!data.url) {
    throw new Error('Invalid response from signed URL endpoint: missing url property');
  }

  const expiresAtMs = data.expiresAt ? new Date(data.expiresAt).getTime() : now + (9 * 60 * 1000);

  // Cache the signed URL
  signedUrlCache.set(cleanKey, {
    url: data.url,
    expiresAtMs,
  });

  return data.url;
}

/**
 * Clears the in-memory signed URL cache.
 */
export function clearSignedUrlCache(): void {
  signedUrlCache.clear();
}
