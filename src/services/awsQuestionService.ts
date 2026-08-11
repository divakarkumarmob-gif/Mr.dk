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

    try {
      const signedUrl = await getCloudFrontSignedUrl('index.json');
      const res = await fetch(signedUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status} fetching catalog from CloudFront`);
      const data = await res.json();
      memoryCache.set(cacheKey, { data, timestamp: Date.now() });
      return data;
    } catch (err) {
      console.warn("CloudFront Master Catalog fetch error, falling back to local /json/index.json:", err);
      try {
        const localRes = await fetch('/json/index.json');
        if (localRes.ok) return await localRes.json();
      } catch (localErr) {}
      return null;
    }
  }

  /**
   * Fetches a specific chapter JSON chunk via CloudFront Signed URL
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

    try {
      const signedUrl = await getCloudFrontSignedUrl(cleanKey);
      const res = await fetch(signedUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status} fetching chunk from CloudFront`);
      const data = await res.json();
      memoryCache.set(cleanKey, { data, timestamp: Date.now() });
      return data;
    } catch (err) {
      console.warn(`CloudFront fetch failed for ${relPath}, trying local fallback:`, err);
      try {
        const cleanLocalPath = cleanKey.startsWith('json/') ? cleanKey : `json/${cleanKey}`;
        const localRes = await fetch(`/${cleanLocalPath}`);
        if (localRes.ok) return await localRes.json();
      } catch (localErr) {}
      return [];
    }
  }

  /**
   * Prefetches questions for a subject / class for instant 0ms load
   */
  static async prefetchChapter(relPath: string): Promise<void> {
    this.fetchChapterQuestions(relPath).catch(() => {});
  }
}
