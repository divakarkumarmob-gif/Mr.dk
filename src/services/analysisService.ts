import { getApiUrl } from '@/utils/api';

export async function analyzeTestPerformance(questions: any[], answers: Record<string, string>) {
    const response = await fetch(getApiUrl('/api/analysis'), {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ questions, answers }),
    });

    if (!response.ok) {
        throw new Error("Failed to get analysis");
    }

    const data = await response.json();
    return data.analysis;
}
