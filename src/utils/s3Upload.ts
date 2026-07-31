import { getApiUrl } from './api';

export interface S3UploadResult {
  url: string;
  key: string;
  name: string;
  fileType: 'image' | 'pdf';
}

/**
 * Uploads a file or screenshot blob to AWS S3 bucket 'user-note'.
 */
export async function uploadToUserNoteS3(
  file: File | Blob,
  fileName: string,
  userId?: string,
  category: 'notes' | 'screenshots' = 'notes'
): Promise<S3UploadResult> {
  const formData = new FormData();
  formData.append('files', file, fileName);
  if (userId) formData.append('userId', userId);
  formData.append('category', category);

  const response = await fetch(getApiUrl('/api/user-notes/upload'), {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`AWS S3 Upload server error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  if (data.success && data.results && data.results[0] && data.results[0].success) {
    return {
      url: data.results[0].url,
      key: data.results[0].key,
      name: data.results[0].name,
      fileType: data.results[0].fileType || 'image',
    };
  }

  const firstErr = data.results?.[0]?.error || data.error || 'S3 upload failed';
  throw new Error(firstErr);
}
