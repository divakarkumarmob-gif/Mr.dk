
import { GoogleGenAI } from "@google/genai";
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseConfig from '../../firebase-applet-config.json' assert { type: 'json' };

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// IMPORTANT: this project uses a non-default named Firestore database
// (firebaseConfig.firestoreDatabaseId), same as every Firestore call in
// server.ts. admin.firestore() with no arguments always points at the
// "(default)" database, which is a DIFFERENT, empty database here — so
// every query this service made was silently looking in the wrong place
// (hence composite-index/NOT_FOUND errors and summaries that could never
// be found even once generated). Must match server.ts's
// getFirestore(app, firebaseConfig.firestoreDatabaseId) exactly.
const getDb = () => getFirestore(admin.app(), firebaseConfig.firestoreDatabaseId);

export const summarizeChat = async (chatId: string, messages: any[]): Promise<string> => {
    const prompt = `Summarize this conversation in under 200 words. Keep only information useful for future study conversations: learning goals, current topics, weak and strong subjects, doubts, mistakes, progress, important decisions, and unresolved questions. Exclude greetings, filler, casual chat, and temporary details. Write in concise bullet points.

    Conversation:
    ${JSON.stringify(messages.map(m => ({ text: m.text, sender: m.senderId })))}
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: { parts: [{ text: prompt }] }
        });
        return response.text || "";
    } catch (error) {
        console.error("Summarization error:", error);
        throw error;
    }
};

export const getSummaryForUser = async (userId: string, timeRange: string): Promise<string | null> => {
    const db = getDb();
    const chatsRef = db.collection('chats');
    
    // Calculate cutoff time
    const now = Date.now();
    let cutoff: number;
    if (timeRange === 'Last 1 day') cutoff = now - 24 * 60 * 60 * 1000;
    else if (timeRange === 'Last 3 days') cutoff = now - 3 * 24 * 60 * 60 * 1000;
    else cutoff = now - 90 * 24 * 60 * 60 * 1000; // 3 months

    // Query for the user's chat document. The user chat ID is likely {userId}_ai
    const chatId = `${userId}_ai`;
    const docRef = chatsRef.doc(chatId);
    const doc = await docRef.get();

    // IMPORTANT: do NOT return null here just because doc.exists is false.
    // saveVoiceMessage only ever writes into the `messages` SUBCOLLECTION —
    // it never sets any field directly on the {userId}_ai parent document
    // itself. In Firestore, a document with no fields of its own reports
    // exists === false even when it has subcollections full of data (this
    // is exactly what the Firestore console showed: "This document does
    // not exist" on the parent doc, right next to a populated `messages`
    // subcollection). Returning early here was skipping the raw-message
    // fallback below on every single session, which is why memory never
    // worked even though messages were being saved correctly.
    const data = doc.exists ? doc.data() : undefined;

    // Fast path: a background-generated summary exists and is still within
    // the selected time range — this is the cheap, pre-compressed case.
    // (summaryGenerated writes DO set fields on the parent doc via
    // doc.ref.update(), so doc.exists will correctly be true once a
    // background summary has ever been generated.)
    if (data && data.summary && data.summaryGeneratedAt) {
        const summaryTimestamp = typeof data.summaryGeneratedAt?.toMillis === 'function' ? data.summaryGeneratedAt.toMillis() : 0;
        if (summaryTimestamp >= cutoff) {
            return data.summary;
        }
    }

    // Fallback path: no fresh background summary yet — most commonly
    // because the user ended a session and restarted within the 20-30
    // minute window before checkAndSummarizeStaleSessions got to it.
    // Rather than returning nothing (and the AI "forgetting" a
    // conversation that just happened), pull the last handful of raw
    // messages directly and hand them over as lightweight context. This
    // is intentionally NOT summarized via an extra AI call (that would
    // reintroduce the exact latency this was meant to avoid) — it's just
    // recent turns, verbatim.
    //
    // FALLBACK_MESSAGE_LIMIT trade-off: higher = less chance of missing
    // something from earlier in a long recent session, but adds more
    // tokens to the system instruction (slightly higher cost/latency per
    // session start). 30 raw turns is still cheap relative to a live
    // audio session and covers most single-sitting conversations in full;
    // bump it further if study sessions commonly run long before ending.
    const FALLBACK_MESSAGE_LIMIT = 30;
    try {
        const recentMessagesSnapshot = await doc.ref
            .collection('messages')
            .orderBy('timestamp', 'desc')
            .limit(FALLBACK_MESSAGE_LIMIT)
            .get();

        if (recentMessagesSnapshot.empty) return null;

        const totalMessagesInChat = (await doc.ref.collection('messages').count().get()).data().count;
        const truncated = totalMessagesInChat > recentMessagesSnapshot.size;

        const recentTurns = recentMessagesSnapshot.docs
            .map(m => m.data())
            .reverse() // back to chronological order
            .filter(m => m.text) // skip image-only/media entries here
            .map(m => `${m.senderId === userId ? 'User' : 'AI'}: ${m.text}`)
            .join('\n');

        if (!recentTurns) return null;

        const prefix = truncated
            ? `Recent conversation (not yet summarized; showing only the most recent ${recentMessagesSnapshot.size} of ${totalMessagesInChat} messages, earlier context may be missing):\n`
            : `Recent conversation (not yet summarized, shown as-is):\n`;

        return `${prefix}${recentTurns}`;
    } catch (err) {
        console.error("Fallback recent-messages lookup failed:", err);
        return null;
    }
};

export const checkAndSummarizeStaleSessions = async () => {
    console.log("[Summarization] Checking for stale sessions...");
    const db = getDb();
    const chatsRef = db.collection('chats');
    const now = Date.now();
    const twentyMinutesAgo = now - 20 * 60 * 1000;

    const staleSessionsQuery = chatsRef
        .where('lastInteraction', '<', twentyMinutesAgo)
        .where('summaryGenerated', '==', false);

    let snapshot;
    try {
        snapshot = await staleSessionsQuery.get();
    } catch (error) {
        // This compound query (range filter + equality filter) needs a
        // Firestore composite index. If it's missing, .get() throws
        // (code 5 / NOT_FOUND) and — since this runs inside a setInterval
        // with no surrounding try/catch — an uncaught rejection here was
        // crashing the whole process every 10 minutes. Never let this
        // background job take down the server.
        console.error("[Summarization] Failed to query stale sessions (likely missing Firestore composite index for lastInteraction+summaryGenerated):", error);
        return;
    }

    for (const doc of snapshot.docs) {

        const messagesSnapshot = await doc.ref.collection('messages').orderBy('timestamp', 'asc').get();
        const messages = messagesSnapshot.docs.map(m => m.data());

        try {
            const summary = await summarizeChat(doc.id, messages);
            await doc.ref.update({
                summary: summary,
                summaryGenerated: true,
                summaryGeneratedAt: admin.firestore.Timestamp.now()
            });
            console.log(`[Summarization] Summary generated for chat: ${doc.id}`);
        } catch (error) {
            console.error(`[Summarization] Error summarizing chat ${doc.id}:`, error);
        }
    }
};
