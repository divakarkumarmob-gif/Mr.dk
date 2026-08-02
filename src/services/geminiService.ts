import { getApiUrl, authFetch } from '@/utils/api';

export async function chatWithAI(messages: { role: string; content: string }[], newMessage: string, imageData?: string) {
    const updatedMessages = [...messages, { role: 'user', content: newMessage }];

    const response = await authFetch(getApiUrl('/api/tutor'), {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages: updatedMessages, base64Image: imageData }),
    });

    if (!response.ok) {
        const errBody = await response.json().catch(() => null);
        throw new Error(errBody?.detail || errBody?.error || "Failed to get tutor response");
    }

    const data = await response.json();
    return data.reply;
}

// Voice message: send the recorded audio straight to the AI (transcribes +
// answers in one call) — used by the WhatsApp-style chat history's mic.
export async function chatWithAIVoice(base64Audio: string, mimeType: string) {
    const response = await authFetch(getApiUrl('/api/tutor-voice'), {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ base64Audio, mimeType }),
    });

    if (!response.ok) {
        const errBody = await response.json().catch(() => null);
        throw new Error(errBody?.detail || errBody?.error || "Failed to get tutor voice response");
    }

    const data = await response.json();
    return data.reply;
}
