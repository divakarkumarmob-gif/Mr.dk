import { AWS_CONFIG, getAwsQuestionUrl } from './awsConfig';

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
   * Fetches the Master Index Catalog from AWS S3
   */
  static async fetchMasterCatalog(): Promise<MasterCatalog | null> {
    const catalogUrl = getAwsQuestionUrl('index.json');
    
    // Check Cache
    if (memoryCache.has(catalogUrl)) {
      const cached = memoryCache.get(catalogUrl)!;
      if (Date.now() - cached.timestamp < AWS_CONFIG.CACHE_TTL_MS) {
        return cached.data;
      }
    }

    try {
      const res = await fetch(catalogUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status} fetching catalog from S3`);
      const data = await res.json();
      memoryCache.set(catalogUrl, { data, timestamp: Date.now() });
      return data;
    } catch (err) {
      console.warn("AWS S3 Master Catalog fetch error, falling back to local /json/index.json:", err);
      try {
        const localRes = await fetch('/json/index.json');
        if (localRes.ok) return await localRes.json();
      } catch (localErr) {}
      return null;
    }
  }

  /**
   * Fetches a specific chapter JSON chunk from AWS S3
   */
  static async fetchChapterQuestions(relPath: string): Promise<QuestionItem[]> {
    const url = getAwsQuestionUrl(relPath);

    // Check Cache
    if (memoryCache.has(url)) {
      const cached = memoryCache.get(url)!;
      if (Date.now() - cached.timestamp < AWS_CONFIG.CACHE_TTL_MS) {
        return cached.data;
      }
    }

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status} fetching chunk from S3`);
      const data = await res.json();
      memoryCache.set(url, { data, timestamp: Date.now() });
      return data;
    } catch (err) {
      console.warn(`AWS S3 fetch failed for ${relPath}, trying local fallback:`, err);
      try {
        const cleanLocalPath = relPath.startsWith('json/') ? relPath : `json/${relPath}`;
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
