import { AWS_CONFIG } from './awsConfig';
import { getCloudFrontSignedUrl } from './cloudfrontService';

export interface QuestionMetadata {
  question_id: string;
  subject: string;
  branch: string;
  class_level: string;
  topic: string;
  chapter_name: string;
  level: number;
}

export interface QuestionItem {
  type: string;
  metadata: QuestionMetadata;
  question: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correct_option: string;
  explanation: string;
  photo?: string;
}

export interface ChapterSummary {
  chapter_name: string;
  subject: string;
  branch: string;
  class_level: string;
  slug: string;
  total_questions: number;
  levels: {
    level_1: number;
    level_2: number;
    level_3: number;
  };
  files: string[];
}

export interface MasterCatalog {
  total_chapters: number;
  total_questions: number;
  chapters: ChapterSummary[];
}

// In-Memory Fast Cache
const memoryCache = new Map<string, { data: any; timestamp: number }>();

export class AWSQuestionService {
  /**
   * Fetches the Master Index Catalog via CloudFront Signed URL
   */
  static async fetchMasterCatalog(): Promise<MasterCatalog | null> {
    const cacheKey = 'index.json';

    // Check Cache
    if (memoryCache.has(cacheKey)) {
      const cached = memoryCache.get(cacheKey)!;
      if (Date.now() - cached.timestamp < AWS_CONFIG.CACHE_TTL_MS) {
        return cached.data;
      }
    }

    // 1. Check Local Workspace /json/ First (Primary Fresh Source)
    try {
      const localRes = await fetch('/json/index.json');
      if (localRes.ok) {
        const data = await localRes.json();
        memoryCache.set(cacheKey, { data, timestamp: Date.now() });
        return data;
      }
    } catch (localErr) {}

    // 2. Fallback to CloudFront
    try {
      const signedUrl = await getCloudFrontSignedUrl('index.json');
      const res = await fetch(signedUrl);
      if (res.ok) {
        const data = await res.json();
        memoryCache.set(cacheKey, { data, timestamp: Date.now() });
        return data;
      }
    } catch (err) {
      console.warn("Master Catalog fetch error:", err);
    }
    return null;
  }

  /**
   * Fetches a specific chapter JSON chunk via Local Workspace /json/ or CloudFront
   */
  static async fetchChapterQuestions(relPath: string): Promise<QuestionItem[]> {
    const cleanKey = relPath.replace(/^\/+/, '').trim();

    // Check Cache
    if (memoryCache.has(cleanKey)) {
      const cached = memoryCache.get(cleanKey)!;
      if (Date.now() - cached.timestamp < AWS_CONFIG.CACHE_TTL_MS) {
        return cached.data;
      }
    }

    // 1. Try Local Workspace /json/ First
    try {
      const cleanLocalPath = cleanKey.startsWith('json/') ? cleanKey : `json/${cleanKey}`;
      const localRes = await fetch(`/${cleanLocalPath}`);
      if (localRes.ok) {
        const data = await localRes.json();
        memoryCache.set(cleanKey, { data, timestamp: Date.now() });
        return data;
      }
    } catch (localErr) {}

    // 2. Fallback to CloudFront
    try {
      const signedUrl = await getCloudFrontSignedUrl(cleanKey);
      const res = await fetch(signedUrl);
      if (res.ok) {
        const data = await res.json();
        memoryCache.set(cleanKey, { data, timestamp: Date.now() });
        return data;
      }
    } catch (err) {
      console.warn(`Fetch failed for ${relPath}:`, err);
    }
    return [];
  }

  /**
   * Prefetches questions for a subject / class for instant 0ms load
   */
  static async prefetchChapter(relPath: string): Promise<void> {
    this.fetchChapterQuestions(relPath).catch(() => {});
  }
}
