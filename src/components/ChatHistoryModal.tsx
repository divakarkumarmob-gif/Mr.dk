import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    X, Send, Mic, Camera, Image as ImageIcon, Plus, Loader2,
    CheckCircle, XCircle, Play, Pause, Trash2
} from 'lucide-react';
import { auth, db, storage } from '../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Message } from '../types';
import { subscribeToMessages, sendMessage, uploadMedia } from '../services/chatService';
import { chatWithAI, chatWithAIVoice } from '../services/geminiService';
import { triggerHaptic } from '../utils/haptics';
import { showToast } from '../utils/toast';

interface ChatHistoryModalProps {
    onClose: () => void;
}

// How far (px) the user must drag a bubble left/right before it counts as
// a "swipe to reply" gesture, matching WhatsApp's feel — short taps and
// small scroll jitters shouldn't accidentally trigger a reply.
const SWIPE_REPLY_THRESHOLD = 55;

export default function ChatHistoryModal({ onClose }: ChatHistoryModalProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [replyTarget, setReplyTarget] = useState<{ text: string; senderId: string; mediaType?: string } | null>(null);
    const [expandedImage, setExpandedImage] = useState<string | null>(null);
    const [showAttachMenu, setShowAttachMenu] = useState(false);

    // Voice recording
    const [isRecording, setIsRecording] = useState(false);
    const [recordSeconds, setRecordSeconds] = useState(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordedChunksRef = useRef<Blob[]>([]);
    const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Screenshot -> Notes flow
    const [showSaveConfirm, setShowSaveConfirm] = useState(false);
    const [showUploadProgress, setShowUploadProgress] = useState(false);
    const [uploadPercent, setUploadPercent] = useState(0);
    const [uploadFailed, setUploadFailed] = useState(false);
    const [isCapturing, setIsCapturing] = useState(false);

    const chatBoxRef = useRef<HTMLDivElement>(null);
    const userScrolledUpRef = useRef(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const messagesCaptureRef = useRef<HTMLDivElement>(null);

    const aiChatId = auth.currentUser ? `${auth.currentUser.uid}_ai` : null;

    useEffect(() => {
        if (!aiChatId) return;
        const unsubscribe = subscribeToMessages(aiChatId, (msgs) => setMessages(msgs));
        return () => unsubscribe();
    }, [aiChatId]);

    // Auto-scroll to latest, same pattern as the caption box / live interface.
    useEffect(() => {
        const box = chatBoxRef.current;
        if (!box) return;
        if (!userScrolledUpRef.current) {
            box.scrollTop = box.scrollHeight;
        }
    }, [messages]);

    const handleScroll = () => {
        const box = chatBoxRef.current;
        if (!box) return;
        const distanceFromBottom = box.scrollHeight - box.scrollTop - box.clientHeight;
        userScrolledUpRef.current = distanceFromBottom > 40;
    };

    // ---------- AI reply helpers ----------

    const getRecentTextHistory = useCallback(() => {
        return messages
            .filter(m => m.text)
            .slice(-12)
            .map(m => ({
                role: m.senderId === auth.currentUser?.uid ? 'user' : 'assistant',
                content: m.text,
            }));
    }, [messages]);

    const saveUserMessage = async (text: string, mediaUrl?: string, mediaType?: 'image' | 'video' | 'audio') => {
        if (!aiChatId || !auth.currentUser) return;
        const reply = replyTarget ? { text: replyTarget.text, senderId: replyTarget.senderId } : null;
        setReplyTarget(null);
        await sendMessage(aiChatId, auth.currentUser.uid, text, mediaUrl, mediaType, reply);
    };

    const saveAIReply = async (text: string) => {
        if (!aiChatId) return;
        await sendMessage(aiChatId, 'ai', text);
    };

    const requestAIReplyForText = async (text: string) => {
        try {
            const reply = await chatWithAI(getRecentTextHistory(), text);
            await saveAIReply(reply || "Sorry, I couldn't come up with an answer for that.");
        } catch (e) {
            console.error('[ChatHistoryModal] AI text reply failed:', e);
            await saveAIReply("Sorry, I'm having trouble responding right now. Please try again.");
        }
    };

    const requestAIReplyForImage = async (text: string, base64Image: string) => {
        try {
            const reply = await chatWithAI(getRecentTextHistory(), text || '(Image sent)', base64Image);
            await saveAIReply(reply || "Sorry, I couldn't read that image.");
        } catch (e) {
            console.error('[ChatHistoryModal] AI image reply failed:', e);
            await saveAIReply("Sorry, I couldn't process that image. Please try again.");
        }
    };

    const requestAIReplyForVoice = async (base64Audio: string, mimeType: string) => {
        try {
            const reply = await chatWithAIVoice(base64Audio, mimeType);
            await saveAIReply(reply || "Sorry, I couldn't understand that voice message.");
        } catch (e) {
            console.error('[ChatHistoryModal] AI voice reply failed:', e);
            await saveAIReply("Sorry, I couldn't process that voice message. Please try again.");
        }
    };

    // ---------- Text send ----------

    const handleSendText = async () => {
        const text = inputText.trim();
        if (!text || isSending || !aiChatId) return;
        setInputText('');
        setIsSending(true);
        try {
            await saveUserMessage(text);
            await requestAIReplyForText(text);
        } finally {
            setIsSending(false);
        }
    };

    // ---------- Image send ----------

    const handleImageChosen = async (file: File) => {
        if (!aiChatId || !auth.currentUser) return;
        setShowAttachMenu(false);
        setIsSending(true);
        try {
            const mediaUrl = await uploadMedia(file, `chats/${auth.currentUser.uid}/images/${Date.now()}_${file.name}`);
            await saveUserMessage('', mediaUrl, 'image');

            const base64: string = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
            await requestAIReplyForImage('', base64);
        } catch (e) {
            console.error('[ChatHistoryModal] Image send failed:', e);
            showToast('Failed to send image. Please try again.');
        } finally {
            setIsSending(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleImageChosen(file);
        e.target.value = '';
    };

    // ---------- Voice recording ----------

    const startRecording = async () => {
        try {
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
            recordTimerRef.current = setInterval(() => setRecordSeconds(s => s + 1), 1000);
        } catch (e) {
            console.error('[ChatHistoryModal] Mic access failed:', e);
            showToast('Could not access microphone.');
        }
    };

    const stopRecordingAndSend = async () => {
        const recorder = mediaRecorderRef.current;
        if (!recorder) return;
        if (recordTimerRef.current) clearInterval(recordTimerRef.current);

        const mimeType = recorder.mimeType || 'audio/webm';
        const blob: Blob = await new Promise((resolve) => {
            recorder.onstop = () => {
                recorder.stream.getTracks().forEach(t => t.stop());
                resolve(new Blob(recordedChunksRef.current, { type: mimeType }));
            };
            recorder.stop();
        });
        setIsRecording(false);
        mediaRecorderRef.current = null;

        if (blob.size < 500) return; // Accidental tap, essentially empty.

        if (!aiChatId || !auth.currentUser) return;
        setIsSending(true);
        try {
            const file = new File([blob], `voice_${Date.now()}.webm`, { type: mimeType });
            const mediaUrl = await uploadMedia(file, `chats/${auth.currentUser.uid}/voice/${Date.now()}.webm`);
            await saveUserMessage('', mediaUrl, 'audio');

            const base64: string = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
            await requestAIReplyForVoice(base64, mimeType);
        } catch (e) {
            console.error('[ChatHistoryModal] Voice send failed:', e);
            showToast('Failed to send voice message.');
        } finally {
            setIsSending(false);
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

    const performScreenshotAndUpload = async () => {
        setShowSaveConfirm(false);
        setShowUploadProgress(true);
        setUploadPercent(0);
        setUploadFailed(false);
        setIsCapturing(true);

        try {
            const html2canvas = (await import('html2canvas')).default;
            const target = messagesCaptureRef.current;
            if (!target) throw new Error('Nothing to capture');

            const canvas = await html2canvas(target, {
                backgroundColor: '#0b141a',
                useCORS: true,
                scale: 2,
            });
            setIsCapturing(false);

            const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png', 0.95));
            if (!blob) throw new Error('Failed to generate image');

            if (!auth.currentUser) throw new Error('Not signed in');

            const fileName = `Chat History ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}.png`;
            const storagePath = `users/${auth.currentUser.uid}/notes/${Date.now()}_chat_screenshot.png`;
            const storageRef = ref(storage, storagePath);
            const uploadTask = uploadBytesResumable(storageRef, blob);

            await new Promise<void>((resolve, reject) => {
                uploadTask.on(
                    'state_changed',
                    (snapshot) => {
                        const pct = snapshot.totalBytes > 0
                            ? Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
                            : 0;
                        setUploadPercent(pct);
                    },
                    (error) => reject(error),
                    () => resolve()
                );
            });

            const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);

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
        }
    };

    // ---------- Render helpers ----------

    const formatVoiceDuration = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${m}:${sec.toString().padStart(2, '0')}`;
    };

    return (
        <div className="fixed inset-0 z-[1100] bg-[#0b141a] flex flex-col">
            {/* Header */}
            <div className="w-full flex items-center gap-3 px-4 py-3 border-b border-white/10 flex-shrink-0 pt-[max(env(safe-area-inset-top,0px),12px)]">
                <button onClick={onClose} className="text-white p-1 -ml-1">
                    <X className="h-6 w-6" />
                </button>
                <h2 className="text-lg font-bold text-white flex-1">Chat History</h2>
                <button onClick={handleScreenshotIconClick} className="text-white p-1" title="Save chat to Notes">
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
            </div>

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
            <div className="flex-shrink-0 px-3 py-3 pb-[max(env(safe-area-inset-bottom,0px),12px)] bg-[#0b141a] flex items-end gap-2">
                <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handleFileChange} />

                <div className="relative">
                    <button
                        onClick={() => setShowAttachMenu(v => !v)}
                        className="p-3 bg-white/10 rounded-full text-gray-300 flex-shrink-0"
                    >
                        <Plus className={`h-5 w-5 transition-transform ${showAttachMenu ? 'rotate-45' : ''}`} />
                    </button>
                    <AnimatePresence>
                        {showAttachMenu && (
                            <motion.div
                                initial={{ opacity: 0, y: 10, scale: 0.9 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 10, scale: 0.9 }}
                                className="absolute bottom-14 left-0 bg-[#1f2c34] rounded-xl p-2 flex flex-col gap-1 shadow-lg"
                            >
                                <button
                                    onClick={() => { setShowAttachMenu(false); fileInputRef.current?.click(); }}
                                    className="flex items-center gap-2 px-3 py-2 text-white text-sm hover:bg-white/5 rounded-lg whitespace-nowrap"
                                >
                                    <ImageIcon className="h-4 w-4 text-purple-400" /> Photo
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {isRecording ? (
                    <div className="flex-1 flex items-center gap-3 bg-[#1f2c34] rounded-full px-4 py-3">
                        <motion.span
                            className="w-2.5 h-2.5 rounded-full bg-red-500"
                            animate={{ opacity: [1, 0.3, 1] }}
                            transition={{ duration: 1, repeat: Infinity }}
                        />
                        <span className="text-white text-sm flex-1">{formatVoiceDuration(recordSeconds)}</span>
                        <button onClick={cancelRecording} className="text-gray-400">
                            <Trash2 className="h-5 w-5" />
                        </button>
                    </div>
                ) : (
                    <div className="flex-1 bg-[#1f2c34] rounded-full px-4 py-3 flex items-center">
                        <input
                            type="text"
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleSendText(); }}
                            placeholder="Type a message"
                            className="bg-transparent flex-1 text-white text-sm outline-none placeholder:text-gray-500"
                        />
                    </div>
                )}

                {inputText.trim() ? (
                    <button
                        onClick={handleSendText}
                        disabled={isSending}
                        className="p-3 bg-green-600 rounded-full text-white flex-shrink-0 disabled:opacity-50"
                    >
                        {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                    </button>
                ) : (
                    <button
                        onMouseDown={startRecording}
                        onMouseUp={stopRecordingAndSend}
                        onTouchStart={startRecording}
                        onTouchEnd={stopRecordingAndSend}
                        className={`p-3 rounded-full text-white flex-shrink-0 transition-colors ${isRecording ? 'bg-red-500' : 'bg-green-600'}`}
                    >
                        <Mic className="h-5 w-5" />
                    </button>
                )}
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
                            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                                <motion.div
                                    className={`h-full ${uploadFailed ? 'bg-red-500' : 'bg-green-500'}`}
                                    animate={{ width: `${uploadFailed ? 100 : uploadPercent}%` }}
                                    transition={{ ease: 'easeOut', duration: 0.2 }}
                                />
                            </div>
                            {uploadFailed ? (
                                <p className="text-red-400 text-xs mt-2">Failed</p>
                            ) : (
                                <p className="text-gray-400 text-xs mt-2 text-right">{isCapturing ? '' : `${uploadPercent}%`}</p>
                            )}
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
                    className={`max-w-[55%] rounded-lg overflow-hidden ${isUser ? 'self-end ml-auto' : 'self-start'}`}
                >
                    <img
                        src={msg.mediaUrl}
                        alt="sent"
                        onClick={() => onExpandImage(msg.mediaUrl!)}
                        className="w-full h-auto max-h-52 object-cover cursor-pointer"
                    />
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
            {msg.text}
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
