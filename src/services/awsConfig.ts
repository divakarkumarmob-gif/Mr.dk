export const AWS_CONFIG = {
  // AWS S3 Bucket for 19,937 Question Bank JSONs
  QUESTIONS_BASE_URL: "https://neet-master-question-json.s3.ap-south-1.amazonaws.com",
  
  // AWS S3 Bucket for NCERT Class 11, Class 12 & Classic PYQ PDFs
  PDFS_BASE_URL: "https://ncert-books-dk.s3.ap-south-1.amazonaws.com",

  // AWS S3 Bucket for Latest NEET PYQ Tests (2025 - 2021)
  LATEST_PYQ_BASE_URL: "https://latest-pyq.s3.ap-south-1.amazonaws.com",
  
  // Cache TTL in ms (1 hour)
  CACHE_TTL_MS: 3600000
};

export function getAwsQuestionUrl(relativePath: string): string {
  const cleanPath = relativePath.replace(/^\/+/, '');
  return `${AWS_CONFIG.QUESTIONS_BASE_URL}/${cleanPath}`;
}

export function getAwsPdfUrl(subjectOrClass: string, filename: string): string {
  const cleanSub = subjectOrClass.replace(/^\/+|\/+$/g, '');
  const cleanFile = filename.replace(/^\/+/, '');
  return `${AWS_CONFIG.PDFS_BASE_URL}/${cleanSub}/${cleanFile}`;
}

export function getLatestPyqUrl(year: string, filename: string): string {
  const cleanYear = year.trim();
  const cleanFile = filename.replace(/^\/+/, '');
  return `${AWS_CONFIG.LATEST_PYQ_BASE_URL}/${cleanYear}/${cleanFile}`;
}
