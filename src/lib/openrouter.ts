import OpenAI from 'openai';

const apiKey = process.env.OPENROUTER_API_KEY;

export const openai = new OpenAI({
  apiKey: apiKey,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': process.env.APP_URL || 'https://ais-dev-grroz2fukjc4b4szeneyqk-889714482537.asia-southeast1.run.app',
    'X-Title': 'NEET Master',
  }
});
