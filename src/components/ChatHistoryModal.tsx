import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    X, Send, Mic, Camera, Image as ImageIcon, Plus, Loader2,
    CheckCircle, XCircle, Play, Pause, Trash2, Square
} from 'lucide-react';
import { auth, db, storage } from '../lib/firebase';
import { collection, addDoc, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Message } from '../types';
import { subscribeToMessages, sendMessage, uploadMedia } from '../services/chatService';
import { chatWithAI, chatWithAIVoice } from '../services/geminiService';
import { triggerHaptic } from '../utils/haptics';
import { showToast } from '../utils/toast';
import { uploadToUserNoteS3 } from '../utils/s3Upload';
import { registerBackButtonHandler } from '../utils/hardwareBackButton';

interface ChatHistoryModalProps {
    onClose: () => void;
    isLiveActive?: boolean;
    onCloseLive?: () => void;
}

// How far (px) the user must drag a bubble left/right before it counts as
// a "swipe to reply" gesture, matching WhatsApp's feel — short taps and
// small scroll jitters shouldn't accidentally trigger a reply.
const SWIPE_REPLY_THRESHOLD = 55;

function ChatHistoryModal({ onClose, isLiveActive, onCloseLive }: ChatHistoryModalProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [isAiTyping, setIsAiTyping] = useState(false);
    const [replyTarget, setReplyTarget] = useState<{ text: string; senderId: string; mediaType?: string } | null>(null);
    const [expandedImage, setExpandedImage] = useState<string | null>(null);
    const [showAttachMenu, setShowAttachMenu] = useState(false);
    // Photo picked but not yet sent — shown as a small preview above the
    // input bar (WhatsApp-style) so the user can add a caption or back out
    // via the X before it actually goes anywhere.
    const [pendingImage, setPendingImage] = useState<{ file: File; previewUrl: string } | null>(null);
    const [showLiveBanner, setShowLiveBanner] = useState(true);

    // Voice recording & preview
    const [isRecording, setIsRecording] = useState(false);
    const [recordSeconds, setRecordSeconds] = useState(0);
    const [pendingVoice, setPendingVoice] = useState<{ blob: Blob; previewUrl: string; durationSec: number; mimeType: string } | null>(null);
    const [isVoicePreviewPlaying, setIsVoicePreviewPlaying] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordedChunksRef = useRef<Blob[]>([]);
    const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const previewAudioRef = useRef<HTMLAudioElement | null>(null);

    // Screenshot -> Notes flow
    const [showSaveConfirm, setShowSaveConfirm] = useState(false);
    const [showUploadProgress, setShowUploadProgress] = useState(false);
    const [uploadPercent, setUploadPercent] = useState(0);
    const [uploadFailed, setUploadFailed] = useState(false);
    const [uploadErrorDetail, setUploadErrorDetail] = useState('');
    const [isCapturing, setIsCapturing] = useState(false);

    const chatBoxRef = useRef<HTMLDivElement>(null);
    const userScrolledUpRef = useRef(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const messagesCaptureRef = useRef<HTMLDivElement>(null);

    const aiChatId = auth.currentUser ? `${auth.currentUser.uid}_ai` : null;

    // The security rules for chats/{chatId}/messages require the parent
    // chats/{chatId} doc to already exist with a participants array
    // containing this user — otherwise every read/write to the
    // subcollection is silently denied. Nothing else in the app ever
    // creates this parent doc for the "{uid}_ai" chat (only the messages
    // subcollection gets written to directly), so without this, the whole
    // chat silently fails: your message and every AI reply attempt get
    // rejected by Firestore before this popup or console ever sees a
    // useful error.
    useEffect(() => {
        if (!aiChatId || !auth.currentUser) return;
        const uid = auth.currentUser.uid;
        let unsubscribe: (() => void) | null = null;

        const initChat = async () => {
            try {
                const chatDocRef = doc(db, 'chats', aiChatId);
                const snap = await getDoc(chatDocRef);
                if (!snap.exists()) {
                    await setDoc(chatDocRef, {
                        participants: [uid],
                        isSupportChat: false,
                        lastMessage: '',
                        updatedAt: serverTimestamp(),
                    });
                }
            } catch (e) {
                console.error('[ChatHistoryModal] Failed to ensure parent chat doc:', e);
            }

            unsubscribe = subscribeToMessages(aiChatId, (msgs) => setMessages(msgs));
        };

        initChat();

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [aiChatId]);

    // Physical Hardware Back Button Handler for Chat History Modal & Overlays
    useEffect(() => {
        const unregister = registerBackButtonHandler(() => {
            if (expandedImage) {
                setExpandedImage(null);
                return true;
            }
            if (pendingImage) {
                setPendingImage(null);
                return true;
            }
            if (showAttachMenu) {
                setShowAttachMenu(false);
                return true;
            }
            if (showSaveConfirm) {
                setShowSaveConfirm(false);
                return true;
            }
            onClose();
            return true;
        });
        return unregister;
    }, [expandedImage, pendingImage, showAttachMenu, showSaveConfirm, onClose]);

    // Auto-scroll to latest, same pattern as the caption box / live interface.
    useEffect(() => {
        const box = chatBoxRef.current;
        if (!box) return;
        if (!userScrolledUpRef.current) {
            box.scrollTop = box.scrollHeight;
        }
    }, [messages, isAiTyping]);

    const handleScroll = () => {
        const box = chatBoxRef.current;
        if (!box) return;
        const distanceFromBottom = box.scrollHeight - box.scrollTop - box.clientHeight;
        userScrolledUpRef.current = distanceFromBottom > 40;
    };

    // Called right when the user sends their own message — like WhatsApp,
    // sending a message always snaps you to the bottom even if you had
    // scrolled up to read older messages.
    const scrollToBottomOnOwnSend = () => {
        userScrolledUpRef.current = false;
        const box = chatBoxRef.current;
        if (box) box.scrollTop = box.scrollHeight;
    };

    // Helper: convert remote image URL back to base64 for re-attaching when replying to a photo
    const urlToBase64 = async (url: string): Promise<string> => {
        try {
            const res = await fetch(url);
            const blob = await res.blob();
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (e) {
            console.warn('[ChatHistoryModal] Failed to convert image URL to base64:', e);
            return '';
        }
    };

    // ---------- AI reply helpers ----------

    const getRecentContextHistory = useCallback(() => {
        return messages
            .slice(-10)
            .map(m => {
                const role = m.senderId === auth.currentUser?.uid ? 'user' : 'assistant';
                let content = m.text || '';
                if (m.mediaType === 'image') {
                    content = m.text ? `[Photo: "${m.text}"]` : '[Photo Attachment]';
                } else if (m.mediaType === 'audio') {
                    content = '[Voice Message]';
                }
                if (m.replyTo) {
                    content = `[Replying to: "${m.replyTo.text || 'Media'}"] ${content}`;
                }
                return { role, content: content || '(empty message)' };
            });
    }, [messages]);

    const saveUserMessage = async (text: string, mediaUrl?: string, mediaType?: 'image' | 'video' | 'audio') => {
        if (!aiChatId || !auth.currentUser) return;
        const reply = replyTarget ? {
            text: replyTarget.text || (replyTarget.mediaType === 'image' ? '📷 Photo' : replyTarget.mediaType === 'audio' ? '🎤 Voice message' : 'Message'),
            senderId: replyTarget.senderId
        } : null;

        setReplyTarget(null);
        scrollToBottomOnOwnSend();

        // Instant Optimistic Update (0ms delay for text & media display)
        const tempMsgId = 'temp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
        const optimisticMsg: Message = {
            id: tempMsgId,
            senderId: auth.currentUser.uid,
            text,
            mediaUrl,
            mediaType,
            replyTo: reply || undefined,
            timestamp: new Date().toISOString()
        };

        setMessages(prev => {
            if (mediaUrl && prev.some(m => m.mediaUrl === mediaUrl)) return prev;
            return [...prev, optimisticMsg];
        });

        try {
            await sendMessage(aiChatId, auth.currentUser.uid, text, mediaUrl, mediaType, reply);
        } catch (e) {
            console.error('[ChatHistoryModal] Failed to save user message:', e);
            setMessages(prev => prev.filter(m => m.id !== tempMsgId));
            showToast('Message failed to send. Please try again.');
            throw e;
        }
    };

    const saveAIReply = async (text: string) => {
        if (!aiChatId) return;
        try {
            await sendMessage(aiChatId, 'ai', text);
        } catch (e) {
            console.error('[ChatHistoryModal] Failed to save AI reply:', e);
            showToast('AI reply failed to save. Please try again.');
        }
    };

    const requestAIReplyForText = async (text: string) => {
        setIsAiTyping(true);
        try {
            const reply = await chatWithAI(getRecentContextHistory(), text);
            await saveAIReply(reply || "Sorry, I couldn't come up with an answer for that.");
        } catch (e) {
            console.error('[ChatHistoryModal] AI text reply failed:', e);
            const detail = e instanceof Error ? e.message : String(e);
            await saveAIReply(`Sorry, I ran into an error: ${detail}`);
        } finally {
            setIsAiTyping(false);
        }
    };

    const requestAIReplyForImage = async (text: string, base64Image: string) => {
        setIsAiTyping(true);
        try {
            const reply = await chatWithAI(getRecentContextHistory(), text || '(Image sent)', base64Image);
            await saveAIReply(reply || "Sorry, I couldn't read that image.");
        } catch (e) {
            console.error('[ChatHistoryModal] AI image reply failed:', e);
            const detail = e instanceof Error ? e.message : String(e);
            await saveAIReply(`Sorry, I ran into an error processing that image: ${detail}`);
        } finally {
            setIsAiTyping(false);
        }
    };

    const requestAIReplyForVoice = async (base64Audio: string, mimeType: string) => {
        setIsAiTyping(true);
        try {
            const reply = await chatWithAIVoice(base64Audio, mimeType);
            await saveAIReply(reply || "Sorry, I couldn't understand that voice message.");
        } catch (e) {
            console.error('[ChatHistoryModal] AI voice reply failed:', e);
            const detail = e instanceof Error ? e.message : String(e);
            await saveAIReply(`Sorry, I ran into an error processing that voice message: ${detail}`);
        } finally {
            setIsAiTyping(false);
        }
    };

    // ---------- Text send ----------

    const handleSendText = async () => {
        const text = inputText.trim();
        if (isSending || !aiChatId) return;

        if (pendingImage) {
            if (isSending) return;
            setInputText('');
            await sendPendingImage(text);
            return;
        }

        if (!text) return;
        setInputText('');

        // Store reply state reference BEFORE saveUserMessage resets replyTarget
        const activeReply = replyTarget;
        let replyPrompt = text;
        let reattachedImageBase64: string | undefined = undefined;

        if (activeReply) {
            const senderLabel = activeReply.senderId === auth.currentUser?.uid ? 'Student' : 'NEET Tutor (AI)';
            const targetSummary = activeReply.text || (activeReply.mediaType === 'image' ? 'Photo Attachment' : activeReply.mediaType === 'audio' ? 'Voice Message' : 'Message');
            replyPrompt = `[Replying to ${senderLabel}'s message: "${targetSummary}"] ${text}`;

            if (activeReply.mediaType === 'image' && activeReply.mediaUrl) {
                showToast('Re-analyzing photo in context...');
                reattachedImageBase64 = await urlToBase64(activeReply.mediaUrl);
            }
        }

        setIsSending(true);
        try {
            await saveUserMessage(text);
            if (reattachedImageBase64) {
                await requestAIReplyForImage(replyPrompt, reattachedImageBase64);
            } else {
                await requestAIReplyForText(replyPrompt);
            }
        } finally {
            setIsSending(false);
        }
    };

    // ---------- Image send ----------

    // Picking a file only stages it as a preview — nothing is sent until
    // the user hits send (with or without a caption typed alongside it).
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        setShowAttachMenu(false);
        if (file) {
            const previewUrl = URL.createObjectURL(file);
            setPendingImage({ file, previewUrl });
        }
        e.target.value = '';
    };

    const cancelPendingImage = () => {
        if (pendingImage) URL.revokeObjectURL(pendingImage.previewUrl);
        setPendingImage(null);
    };

    const sendPendingImage = async (caption: string) => {
        if (!aiChatId || !auth.currentUser || !pendingImage) return;
        const { file, previewUrl } = pendingImage;
        setPendingImage(null);

        // Instant Optimistic Image Display
        const tempMsgId = 'temp_img_' + Date.now();
        const optimisticMsg: Message = {
            id: tempMsgId,
            senderId: auth.currentUser.uid,
            text: caption,
            mediaUrl: previewUrl,
            mediaType: 'image',
            replyTo: replyTarget ? {
                text: replyTarget.text || (replyTarget.mediaType === 'image' ? '📷 Photo' : '🎤 Voice message'),
                senderId: replyTarget.senderId
            } : undefined,
            timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, optimisticMsg]);
        scrollToBottomOnOwnSend();

        setIsSending(true);
        try {
            // Read to base64 ONCE, immediately
            const base64: string = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = () => reject(new Error(reader.error?.message || 'Failed to read image file'));
                reader.readAsDataURL(file);
            });

            const mediaUrl = await uploadMedia(file, `chats/${auth.currentUser.uid}/images/${Date.now()}_${file.name}`);
            await saveUserMessage(caption, mediaUrl, 'image');
            await requestAIReplyForImage(caption, base64);
        } catch (e) {
            console.error('[ChatHistoryModal] Image send failed:', e);
            setMessages(prev => prev.filter(m => m.id !== tempMsgId));
            const detail = e instanceof Error ? e.message : String(e);
            showToast(`Failed to send image: ${detail}`);
        } finally {
            URL.revokeObjectURL(previewUrl);
            setIsSending(false);
        }
    };

    // ---------- Voice recording ----------

    const startRecording = async () => {
        try {
            if (pendingVoice) {
                cancelPendingVoice();
            }
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
            const recorder = new MediaRecorder(stream, { mimeType });
            recordedChunksRef.current = [];
            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) recordedChunksRef.current.push(e.data);
            };
            recorder.onstop = () => {
                stream.getTracks().forEach(t => t.stop());
            };
            recorder.start();
            mediaRecorderRef.current = recorder;
            setIsRecording(true);
            setRecordSeconds(0);
            triggerHaptic();
            if (recordTimerRef.current) clearInterval(recordTimerRef.current);
            recordTimerRef.current = setInterval(() => setRecordSeconds(s => s + 1), 1000);
        } catch (e) {
            console.error('[ChatHistoryModal] Mic access failed:', e);
            showToast('Microphone access karne me dikkat aayi.');
        }
    };

    const stopRecordingAndPreview = async () => {
        const recorder = mediaRecorderRef.current;
        if (!recorder) return;
        if (recordTimerRef.current) clearInterval(recordTimerRef.current);

        const mimeType = recorder.mimeType || 'audio/webm';
        const duration = recordSeconds;

        const blob: Blob = await new Promise((resolve) => {
            recorder.onstop = () => {
                recorder.stream.getTracks().forEach(t => t.stop());
                resolve(new Blob(recordedChunksRef.current, { type: mimeType }));
            };
            recorder.stop();
        });

        setIsRecording(false);
        mediaRecorderRef.current = null;
        setRecordSeconds(0);

        if (blob.size < 500) {
            showToast('Recording too short!');
            return;
        }

        const previewUrl = URL.createObjectURL(blob);
        setPendingVoice({ blob, previewUrl, durationSec: duration, mimeType });
    };

    const cancelPendingVoice = () => {
        if (pendingVoice) {
            URL.revokeObjectURL(pendingVoice.previewUrl);
        }
        setPendingVoice(null);
        setIsVoicePreviewPlaying(false);
    };

    const sendPendingVoice = async () => {
        if (!aiChatId || !auth.currentUser || !pendingVoice) return;
        const { blob, previewUrl, mimeType } = pendingVoice;
        setPendingVoice(null);
        setIsVoicePreviewPlaying(false);

        setIsSending(true);
        try {
            const file = new File([blob], `voice_${Date.now()}.webm`, { type: mimeType });

            const base64: string = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = () => reject(new Error(reader.error?.message || 'Failed to read audio file'));
                reader.readAsDataURL(blob);
            });

            const mediaUrl = await uploadMedia(file, `chats/${auth.currentUser.uid}/voice/${Date.now()}.webm`);
            await saveUserMessage('', mediaUrl, 'audio');
            await requestAIReplyForVoice(base64, mimeType);
        } catch (e) {
            console.error('[ChatHistoryModal] Voice send failed:', e);
            showToast('Failed to send voice message.');
        } finally {
            setIsSending(false);
            URL.revokeObjectURL(previewUrl);
        }
    };

    const toggleVoicePreviewPlayback = () => {
        if (!previewAudioRef.current) return;
        if (isVoicePreviewPlaying) {
            previewAudioRef.current.pause();
        } else {
            previewAudioRef.current.play();
        }
    };

    const cancelRecording = () => {
        const recorder = mediaRecorderRef.current;
        if (recordTimerRef.current) clearInterval(recordTimerRef.current);
        if (recorder) {
            recorder.onstop = () => recorder.stream.getTracks().forEach(t => t.stop());
            recorder.stop();
        }
        mediaRecorderRef.current = null;
        setIsRecording(false);
        setRecordSeconds(0);
    };

    useEffect(() => {
        return () => {
            if (recordTimerRef.current) clearInterval(recordTimerRef.current);
        };
    }, []);

    // ---------- Screenshot -> Notes ----------

    const handleScreenshotIconClick = () => {
        setShowSaveConfirm(true);
    };

    // Wrap a promise so it can never hang the popup forever — if capture or
    // upload genuinely stalls (large canvas in a WebView, dropped network
    // mid-upload), this turns it into a visible failure instead of an
    // infinite spinner stuck at 0%.
    const withTimeout = <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`)), ms);
            promise.then(
                (val) => { clearTimeout(timer); resolve(val); },
                (err) => { clearTimeout(timer); reject(err); }
            );
        });
    };

    const performScreenshotAndUpload = async () => {
        setShowSaveConfirm(false);
        setShowUploadProgress(true);
        setUploadPercent(0);
        setUploadFailed(false);
        setUploadErrorDetail('');
        setIsCapturing(true);

        try {
            let html2canvasFn;
            try {
                html2canvasFn = (await import('html2canvas-pro')).default;
            } catch (importErr) {
                throw new Error('Screenshot tool not installed — run npm install and rebuild.');
            }
            const target = messagesCaptureRef.current;
            if (!target) throw new Error('Nothing to capture');

            // scale: 1 instead of 2 — a long chat history at 2x device
            // pixel ratio can produce a canvas large enough to stall
            // (sometimes indefinitely) in mobile WebViews.
            const canvas = await withTimeout(
                html2canvasFn(target, { backgroundColor: '#0b141a', useCORS: true, allowTaint: true, scale: 1 }),
                20000,
                'Capturing chat'
            );
            setIsCapturing(false);

            const blob: Blob | null = await withTimeout(
                new Promise((resolve) => (canvas as HTMLCanvasElement).toBlob(resolve, 'image/png', 0.92)),
                10000,
                'Generating image'
            );
            if (!blob) throw new Error('Failed to generate image');

            if (!auth.currentUser) throw new Error('Not signed in');

            const fileName = `Neural Solver 2.0 ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}.png`;
            const storagePath = `users/${auth.currentUser.uid}/notes/${Date.now()}_chat_screenshot.png`;
            const storageRef = ref(storage, storagePath);

            let downloadUrl = '';
            try {
                // 1. Primary Target: AWS S3 Bucket 'user-note'
                const s3Res = await withTimeout(
                    uploadToUserNoteS3(blob, fileName, auth.currentUser.uid, 'screenshots'),
                    12000,
                    'AWS S3 Upload'
                );
                downloadUrl = s3Res.url;
                console.log('[ChatHistoryModal] Successfully uploaded chat screenshot to AWS S3 bucket user-note:', downloadUrl);
            } catch (s3Err) {
                console.warn('[ChatHistoryModal] AWS S3 upload to user-note bucket bypassed/failed, trying Firebase Storage:', s3Err);
                try {
                    // 2. Secondary Fallback: Firebase Storage
                    const snapshot = await withTimeout(
                        uploadBytes(storageRef, blob),
                        8000,
                        'Upload'
                    );
                    downloadUrl = await getDownloadURL(snapshot.ref);
                } catch (storageErr) {
                    console.warn('[ChatHistoryModal] Firebase Storage upload also bypassed, converting to Base64 fallback:', storageErr);
                    // 3. Tertiary Fallback: Base64
                    downloadUrl = await new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result as string);
                        reader.onerror = () => reject(new Error(reader.error?.message || 'Failed to read screenshot blob'));
                        reader.readAsDataURL(blob);
                    });
                }
            }

            const notesRef = collection(db, 'users', auth.currentUser.uid, 'notes');
            await addDoc(notesRef, {
                name: fileName,
                files: [{ url: downloadUrl, name: fileName, type: 'image' }],
                url: downloadUrl,
                type: 'image',
                createdAt: new Date(),
            });

            setUploadPercent(100);
            setTimeout(() => setShowUploadProgress(false), 500);
        } catch (e) {
            console.error('[ChatHistoryModal] Screenshot save failed:', e);
            setIsCapturing(false);
            setUploadFailed(true);
            setUploadErrorDetail(e instanceof Error ? e.message : String(e));
        }
    };

    // ---------- Render helpers ----------

    const formatVoiceDuration = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${m}:${sec.toString().padStart(2, '0')}`;
    };

    return (
        <div className="fixed inset-0 z-[1100] bg-[#0b141a] flex flex-col isolate">
            {/* "AI is Live 🔴" Floating Banner Modal */}
            <AnimatePresence>
                {showLiveBanner && isLiveActive && (
                    <motion.div
                        initial={{ opacity: 0, y: -20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -20, scale: 0.95 }}
                        className="absolute top-16 left-4 right-4 z-[1200] bg-gradient-to-r from-red-950/90 via-[#1f2c34]/95 to-purple-950/90 border border-red-500/40 backdrop-blur-md p-3.5 rounded-2xl shadow-2xl flex items-center justify-between gap-3 text-white"
                    >
                        <div className="flex items-center gap-2.5">
                            <span className="relative flex h-3 w-3 shrink-0">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                            </span>
                            <div>
                                <p className="text-xs font-bold text-white flex items-center gap-1.5">
                                    AI is Live <span className="text-[9px] px-1.5 py-0.2 rounded bg-red-500/30 text-red-300 border border-red-500/40 uppercase font-semibold">Active</span>
                                </p>
                                <p className="text-[11px] text-gray-300">Live AI session background mein chal raha hai.</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                            <button
                                onClick={() => setShowLiveBanner(false)}
                                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition active:scale-95"
                            >
                                Continue
                            </button>
                            <button
                                onClick={() => {
                                    setShowLiveBanner(false);
                                    if (onCloseLive) onCloseLive();
                                }}
                                className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-bold text-white shadow-lg transition active:scale-95"
                            >
                                Close AI Live
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header */}
            <div className="w-full flex items-center gap-3 px-4 py-3 border-b border-white/10 flex-shrink-0 pt-[max(env(safe-area-inset-top,0px),12px)] bg-[#0b141a] z-20 isolate transform-gpu">
                <button onClick={onClose} className="text-white p-1 -ml-1 hover:bg-white/10 rounded-full transition">
                    <X className="h-6 w-6" />
                </button>
                <h2 className="text-lg font-bold text-white flex-1 tracking-wide">Neural Solver 2.0</h2>
                <button onClick={handleScreenshotIconClick} className="text-white p-1 hover:bg-white/10 rounded-full transition" title="Save to Notes">
                    <Camera className="h-6 w-6" />
                </button>
            </div>

            {/* Messages */}
            <div
                ref={chatBoxRef}
                onScroll={handleScroll}
                className="flex-1 min-h-0 overflow-y-auto px-3 py-4"
                style={{
                    backgroundImage: 'radial-gradient(circle at 25px 25px, rgba(255,255,255,0.03) 2px, transparent 0), radial-gradient(circle at 75px 75px, rgba(255,255,255,0.03) 2px, transparent 0)',
                    backgroundSize: '100px 100px',
                }}
            >
                <div ref={messagesCaptureRef} className="flex flex-col gap-2">
                    {messages.length === 0 ? (
                        <p className="text-gray-500 text-sm text-center mt-8">No messages yet — say hi to get started.</p>
                    ) : (
                        messages.map((msg, index) => (
                            <ChatBubble
                                key={msg.id || index}
                                msg={msg}
                                isUser={msg.senderId === auth.currentUser?.uid}
                                onReply={(target) => setReplyTarget(target)}
                                onExpandImage={(url) => setExpandedImage(url)}
                            />
                        ))
                    )}
                </div>
                {isAiTyping && (
                    <div className="flex mt-2">
                        <div className="bg-[#1f2c34] rounded-lg rounded-bl-sm px-3 py-2.5 flex items-center gap-1 w-fit">
                            <motion.span className="w-1.5 h-1.5 rounded-full bg-gray-400" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: 0 }} />
                            <motion.span className="w-1.5 h-1.5 rounded-full bg-gray-400" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: 0.2 }} />
                            <motion.span className="w-1.5 h-1.5 rounded-full bg-gray-400" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: 0.4 }} />
                        </div>
                    </div>
                )}
            </div>

            {/* Pending image preview (staged, not yet sent) */}
            {pendingImage && (
                <div className="flex-shrink-0 px-3 pt-2 bg-[#0b141a]">
                    <div className="relative inline-block">
                        <img src={pendingImage.previewUrl} alt="preview" className="h-20 w-20 object-cover rounded-lg" />
                        <button
                            onClick={cancelPendingImage}
                            className="absolute -top-2 -right-2 bg-gray-800 border border-white/20 rounded-full p-1 text-white"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    </div>
                </div>
            )}

            {/* Reply preview bar */}
            {replyTarget && (
                <div className="flex-shrink-0 px-3 pt-2 bg-[#0b141a]">
                    <div className="flex items-center gap-2 bg-[#1f2c34] rounded-lg px-3 py-2 border-l-4 border-green-500">
                        <div className="flex-1 min-w-0">
                            <p className="text-xs text-green-400 font-semibold">
                                {replyTarget.senderId === auth.currentUser?.uid ? 'You' : 'NeetMaster AI'}
                            </p>
                            <p className="text-xs text-gray-300 truncate">
                                {replyTarget.mediaType === 'image' ? '📷 Photo' : replyTarget.mediaType === 'audio' ? '🎤 Voice message' : replyTarget.text}
                            </p>
                        </div>
                        <button onClick={() => setReplyTarget(null)} className="text-gray-400 p-1">
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* Input bar */}
            <div className="flex-shrink-0 px-3 py-3 pb-[max(env(safe-area-inset-bottom,0px),12px)] bg-[#0b141a] border-t border-white/5 flex items-end gap-2 z-20 isolate transform-gpu">
                <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handleFileChange} />
                <input type="file" ref={cameraInputRef} accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />

                {/* Attachment Plus Menu */}
                <div className="relative">
                    <button
                        onClick={() => setShowAttachMenu(v => !v)}
                        className="p-3 bg-white/10 hover:bg-white/15 rounded-full text-gray-300 flex-shrink-0 transition"
                        title="Add attachment"
                    >
                        <Plus className={`h-5 w-5 transition-transform ${showAttachMenu ? 'rotate-45' : ''}`} />
                    </button>
                    <AnimatePresence>
                        {showAttachMenu && (
                            <motion.div
                                initial={{ opacity: 0, y: 10, scale: 0.9 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 10, scale: 0.9 }}
                                className="absolute bottom-14 left-0 bg-[#1f2c34] rounded-xl p-2 flex flex-col gap-1 shadow-2xl border border-white/10 z-30"
                            >
                                <button
                                    onClick={() => { setShowAttachMenu(false); cameraInputRef.current?.click(); }}
                                    className="flex items-center gap-2.5 px-3 py-2 text-white text-sm hover:bg-white/10 rounded-lg whitespace-nowrap transition"
                                >
                                    <Camera className="h-4 w-4 text-green-400" /> Camera Photo
                                </button>
                                <button
                                    onClick={() => { setShowAttachMenu(false); fileInputRef.current?.click(); }}
                                    className="flex items-center gap-2.5 px-3 py-2 text-white text-sm hover:bg-white/10 rounded-lg whitespace-nowrap transition"
                                >
                                    <ImageIcon className="h-4 w-4 text-purple-400" /> Gallery Photo
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Dynamic Input Center: Recording / Voice Preview / Text Input */}
                {pendingVoice ? (
                    <div className="flex-1 bg-[#1f2c34] rounded-full px-4 py-2 flex items-center gap-3 border border-green-500/30">
                        <audio
                            ref={previewAudioRef}
                            src={pendingVoice.previewUrl}
                            onPlay={() => setIsVoicePreviewPlaying(true)}
                            onPause={() => setIsVoicePreviewPlaying(false)}
                            onEnded={() => setIsVoicePreviewPlaying(false)}
                            className="hidden"
                        />
                        <button
                            onClick={toggleVoicePreviewPlayback}
                            className="p-2 bg-green-600 rounded-full text-white hover:bg-green-500 transition shrink-0 shadow-md"
                        >
                            {isVoicePreviewPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        </button>
                        <div className="flex-1 flex flex-col justify-center min-w-0">
                            <span className="text-white text-xs font-semibold truncate">Voice Note Preview</span>
                            <span className="text-gray-400 text-[10px] font-mono">{formatVoiceDuration(pendingVoice.durationSec)}</span>
                        </div>
                        <button onClick={cancelPendingVoice} className="p-1.5 text-gray-400 hover:text-red-400 transition" title="Delete voice note">
                            <Trash2 className="h-4 w-4" />
                        </button>
                    </div>
                ) : isRecording ? (
                    <div className="flex-1 flex items-center gap-3 bg-[#1f2c34] rounded-full px-4 py-2 border border-red-500/30">
                        <motion.span
                            className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0"
                            animate={{ opacity: [1, 0.3, 1] }}
                            transition={{ duration: 1, repeat: Infinity }}
                        />
                        <span className="text-white text-xs font-mono font-medium flex-1">{formatVoiceDuration(recordSeconds)}</span>
                        <button
                            onClick={stopRecordingAndPreview}
                            className="p-1.5 px-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-full transition flex items-center gap-1.5 text-xs font-bold"
                        >
                            <Square className="h-3.5 w-3.5 fill-red-400" /> Done
                        </button>
                        <button onClick={cancelRecording} className="p-1 text-gray-400 hover:text-gray-200" title="Cancel recording">
                            <Trash2 className="h-4 w-4" />
                        </button>
                    </div>
                ) : (
                    <div className="flex-1 bg-[#1f2c34] rounded-full px-4 py-3 flex items-center">
                        <input
                            type="text"
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleSendText(); }}
                            placeholder="Type a message or doubt..."
                            className="bg-transparent flex-1 text-white text-sm outline-none placeholder:text-gray-500"
                        />
                    </div>
                )}

                {/* Send / Mic Action Button */}
                {pendingVoice ? (
                    <button
                        onClick={sendPendingVoice}
                        disabled={isSending}
                        className="p-3 bg-green-600 rounded-full text-white flex-shrink-0 disabled:opacity-50 hover:bg-green-500 transition shadow-lg"
                        title="Send Voice Note"
                    >
                        {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                    </button>
                ) : (inputText.trim() || pendingImage) ? (
                    <button
                        onClick={handleSendText}
                        disabled={isSending}
                        className="p-3 bg-green-600 rounded-full text-white flex-shrink-0 disabled:opacity-50 hover:bg-green-500 transition shadow-lg"
                        title="Send Message"
                    >
                        {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                    </button>
                ) : !isRecording ? (
                    <button
                        onClick={startRecording}
                        className="p-3 bg-green-600 hover:bg-green-500 rounded-full text-white flex-shrink-0 transition shadow-lg"
                        title="Record Voice Note"
                    >
                        <Mic className="h-5 w-5" />
                    </button>
                ) : null}
            </div>

            {/* Expanded image viewer */}
            <AnimatePresence>
                {expandedImage && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/95 z-[1200] flex items-center justify-center p-4"
                        onClick={() => setExpandedImage(null)}
                    >
                        <button onClick={() => setExpandedImage(null)} className="absolute top-6 right-4 text-white p-2 z-10">
                            <X className="h-7 w-7" />
                        </button>
                        <motion.img
                            initial={{ scale: 0.85 }}
                            animate={{ scale: 1 }}
                            src={expandedImage}
                            alt="expanded"
                            className="max-w-full max-h-full object-contain rounded-lg"
                            onClick={e => e.stopPropagation()}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Save-to-notes confirm popup */}
            <AnimatePresence>
                {showSaveConfirm && (
                    <div className="fixed inset-0 bg-black/60 z-[1300] flex items-center justify-center p-6" onClick={() => setShowSaveConfirm(false)}>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="bg-[#1f2c34] rounded-2xl p-5 w-full max-w-xs"
                            onClick={e => e.stopPropagation()}
                        >
                            <p className="text-white font-semibold mb-1">Save chat to Notes?</p>
                            <p className="text-gray-400 text-sm mb-4">A screenshot of this conversation will be saved to your Notes.</p>
                            <div className="flex gap-3 justify-end">
                                <button onClick={() => setShowSaveConfirm(false)} className="px-4 py-2 text-gray-300 text-sm font-medium">No</button>
                                <button onClick={performScreenshotAndUpload} className="px-4 py-2 bg-green-600 rounded-lg text-white text-sm font-medium">Yes</button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Upload progress popup */}
            <AnimatePresence>
                {showUploadProgress && (
                    <div
                        className="fixed inset-0 bg-black/60 z-[1300] flex items-center justify-center p-6"
                        onClick={() => setShowUploadProgress(false)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="bg-[#1f2c34] rounded-2xl p-5 w-full max-w-xs"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex items-center gap-2 mb-3">
                                {uploadFailed ? (
                                    <XCircle className="h-5 w-5 text-red-500" />
                                ) : uploadPercent >= 100 ? (
                                    <CheckCircle className="h-5 w-5 text-green-500" />
                                ) : (
                                    <Loader2 className="h-5 w-5 text-green-500 animate-spin" />
                                )}
                                <p className="text-white font-semibold text-sm">
                                    {isCapturing ? 'Capturing chat…' : uploadFailed ? 'Upload failed' : uploadPercent >= 100 ? 'Saved to Notes' : 'Uploading to Notes…'}
                                </p>
                            </div>
                            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden relative">
                                {uploadFailed || uploadPercent >= 100 ? (
                                    <motion.div
                                        className={`h-full ${uploadFailed ? 'bg-red-500' : 'bg-green-500'}`}
                                        animate={{ width: `${uploadFailed ? 100 : uploadPercent}%` }}
                                        transition={{ ease: 'easeOut', duration: 0.2 }}
                                    />
                                ) : (
                                    // No real progress is available from a single-shot
                                    // upload — an honest indeterminate sliding bar
                                    // instead of a number that would just be a guess.
                                    <motion.div
                                        className="h-full w-1/3 bg-green-500 rounded-full absolute"
                                        animate={{ left: ['-33%', '100%'] }}
                                        transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
                                    />
                                )}
                            </div>
                            {uploadFailed ? (
                                <p className="text-red-400 text-xs mt-2">{uploadErrorDetail || 'Failed'}</p>
                            ) : uploadPercent >= 100 ? (
                                <p className="text-gray-400 text-xs mt-2 text-right">100%</p>
                            ) : null}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ---------- Chat bubble with swipe-to-reply ----------

function ChatBubble({
    msg,
    isUser,
    onReply,
    onExpandImage,
}: {
    msg: Message;
    isUser: boolean;
    onReply: (target: { text: string; senderId: string; mediaType?: string }) => void;
    onExpandImage: (url: string) => void;
}) {
    const [dragX, setDragX] = useState(0);
    const startXRef = useRef<number | null>(null);
    const draggingRef = useRef(false);

    const handlePointerDown = (clientX: number) => {
        startXRef.current = clientX;
        draggingRef.current = true;
    };

    const handlePointerMove = (clientX: number) => {
        if (!draggingRef.current || startXRef.current === null) return;
        // WhatsApp reply swipe is always to the right, regardless of who
        // sent the bubble — clamp so it can't be dragged the other way.
        const delta = Math.max(0, Math.min(80, clientX - startXRef.current));
        setDragX(delta);
    };

    const handlePointerUp = () => {
        draggingRef.current = false;
        if (dragX > SWIPE_REPLY_THRESHOLD) {
            triggerHaptic();
            onReply({
                text: msg.text,
                senderId: msg.senderId,
                mediaType: msg.mediaType,
            });
        }
        setDragX(0);
        startXRef.current = null;
    };

    if (msg.mediaType === 'image' && msg.mediaUrl) {
        return (
            <div className="relative">
                {msg.replyTo && (
                    <div className={`max-w-[70%] mb-0.5 px-2 py-1 rounded-t-lg text-[11px] bg-black/20 border-l-2 border-green-500 ${isUser ? 'self-end ml-auto' : 'self-start'}`}>
                        <p className="text-green-400 font-medium">{msg.replyTo.senderId === auth.currentUser?.uid ? 'You' : 'NeetMaster AI'}</p>
                        <p className="text-gray-300 truncate">{msg.replyTo.text || 'Media'}</p>
                    </div>
                )}
                <motion.div
                    style={{ x: dragX }}
                    onMouseDown={(e) => handlePointerDown(e.clientX)}
                    onMouseMove={(e) => draggingRef.current && handlePointerMove(e.clientX)}
                    onMouseUp={handlePointerUp}
                    onMouseLeave={() => draggingRef.current && handlePointerUp()}
                    onTouchStart={(e) => handlePointerDown(e.touches[0].clientX)}
                    onTouchMove={(e) => handlePointerMove(e.touches[0].clientX)}
                    onTouchEnd={handlePointerUp}
                    className={`max-w-[65%] rounded-lg overflow-hidden ${isUser ? 'self-end ml-auto bg-[#005c4b]' : 'self-start bg-[#1f2c34]'}`}
                >
                    <img
                        src={msg.mediaUrl}
                        alt="sent"
                        onClick={() => onExpandImage(msg.mediaUrl!)}
                        className="w-full h-auto max-h-52 object-cover cursor-pointer block"
                    />
                    {msg.text && (
                        <div className="px-3 py-2 text-sm text-white whitespace-pre-wrap break-words">
                            <FormattedText text={msg.text} />
                        </div>
                    )}
                </motion.div>
            </div>
        );
    }

    if (msg.mediaType === 'audio' && msg.mediaUrl) {
        return (
            <VoiceBubble msg={msg} isUser={isUser} dragX={dragX}
                onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}
            />
        );
    }

    if (!msg.text) return null;

    return (
        <motion.div
            style={{ x: dragX }}
            onMouseDown={(e) => handlePointerDown(e.clientX)}
            onMouseMove={(e) => draggingRef.current && handlePointerMove(e.clientX)}
            onMouseUp={handlePointerUp}
            onMouseLeave={() => draggingRef.current && handlePointerUp()}
            onTouchStart={(e) => handlePointerDown(e.touches[0].clientX)}
            onTouchMove={(e) => handlePointerMove(e.touches[0].clientX)}
            onTouchEnd={handlePointerUp}
            className={`max-w-[80%] px-3 py-2 rounded-lg text-sm leading-snug whitespace-pre-wrap break-words ${
                isUser
                    ? 'self-end ml-auto bg-[#005c4b] text-white rounded-br-sm'
                    : 'self-start bg-[#1f2c34] text-white rounded-bl-sm'
            }`}
        >
            {msg.replyTo && (
                <div className="mb-1.5 px-2 py-1 rounded bg-black/20 border-l-2 border-green-500">
                    <p className="text-green-400 font-medium text-xs">{msg.replyTo.senderId === auth.currentUser?.uid ? 'You' : 'NeetMaster AI'}</p>
                    <p className="text-gray-300 truncate text-xs">{msg.replyTo.text || 'Media'}</p>
                </div>
            )}
            {msg.text && <FormattedText text={msg.text} />}
        </motion.div>
    );
}

function VoiceBubble({
    msg, isUser, dragX, onPointerDown, onPointerMove, onPointerUp,
}: {
    msg: Message;
    isUser: boolean;
    dragX: number;
    onPointerDown: (x: number) => void;
    onPointerMove: (x: number) => void;
    onPointerUp: () => void;
}) {
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const togglePlay = () => {
        if (!audioRef.current) return;
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
    };

    return (
        <motion.div
            style={{ x: dragX }}
            onMouseDown={(e) => onPointerDown(e.clientX)}
            onMouseMove={(e) => onPointerMove(e.clientX)}
            onMouseUp={onPointerUp}
            onMouseLeave={onPointerUp}
            onTouchStart={(e) => onPointerDown(e.touches[0].clientX)}
            onTouchMove={(e) => onPointerMove(e.touches[0].clientX)}
            onTouchEnd={onPointerUp}
            className={`max-w-[70%] px-3 py-2.5 rounded-lg flex items-center gap-2 ${
                isUser ? 'self-end ml-auto bg-[#005c4b]' : 'self-start bg-[#1f2c34]'
            }`}
        >
            <audio
                ref={audioRef}
                src={msg.mediaUrl}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
                className="hidden"
            />
            <button onClick={togglePlay} className="text-white flex-shrink-0">
                {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
            </button>
            <div className="flex-1 h-1 bg-white/20 rounded-full" />
            <Mic className="h-4 w-4 text-gray-300 flex-shrink-0" />
        </motion.div>
    );
}

// ---------- Lightweight markdown-lite renderer ----------

// The AI is instructed not to use markdown, but as a safety net this turns
// any **bold**, #/##/### headings, and "- "/"* " bullet lines it still
// slips in into real formatting instead of showing literal asterisks and
// hashes (which is what a plain whitespace-pre-wrap text node would do).
function FormattedText({ text }: { text: string }) {
    const renderInline = (line: string, keyPrefix: string) => {
        // Split on **bold** segments, keep everything else as plain text.
        const parts = line.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
        return parts.map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
                return <strong key={`${keyPrefix}-${i}`} className="font-semibold">{part.slice(2, -2)}</strong>;
            }
            return <React.Fragment key={`${keyPrefix}-${i}`}>{part}</React.Fragment>;
        });
    };

    const lines = text.split('\n');

    return (
        <>
            {lines.map((rawLine, idx) => {
                const headingMatch = rawLine.match(/^(#{1,6})\s+(.*)$/);
                if (headingMatch) {
                    return (
                        <p key={idx} className="font-semibold mt-1.5 first:mt-0">
                            {renderInline(headingMatch[2], `h${idx}`)}
                        </p>
                    );
                }
                const bulletMatch = rawLine.match(/^\s*[-*]\s+(.*)$/);
                if (bulletMatch) {
                    return (
                        <p key={idx} className="pl-3 -indent-3">
                            • {renderInline(bulletMatch[1], `b${idx}`)}
                        </p>
                    );
                }
                if (rawLine.trim() === '') {
                    return <br key={idx} />;
                }
                return <p key={idx}>{renderInline(rawLine, `l${idx}`)}</p>;
            })}
        </>
    );
}

export default memo(ChatHistoryModal);
