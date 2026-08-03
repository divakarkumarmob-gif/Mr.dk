import React, { useState, useRef, useEffect } from 'react';
import { X, Mic, Sparkles, Plus, Loader2, Image as ImageIcon, Settings, ChevronDown, Captions, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Capacitor } from '@capacitor/core';
import AgentFace from './AgentFace';
import HomeScreenShortcutPrompt from './HomeScreenShortcutPrompt';
import ChatHistoryModal from './ChatHistoryModal';
import { auth } from '../lib/firebase';
import { saveAIMessage, subscribeToMessages, uploadMedia } from '../services/chatService';
import { Message } from '../types';
import { takePhoto } from '../utils/camera';
import { LiveSession } from '../utils/liveSession';
import { enableScreenshot, disableScreenshot } from '../utils/screenSecurity';
import { registerBackButtonHandler } from '../utils/hardwareBackButton';

interface LiveAIInterfaceProps {
    onClose: () => void;
}

// Helper: Convert PCM Float32Array to Base64
function pcmToBase64(pcm: Float32Array): string {
    if (!pcm || pcm.length === 0) return "";
    const buffer = new Int16Array(pcm.length);
    for (let i = 0; i < pcm.length; i++) {
        buffer[i] = Math.max(-1, Math.min(1, pcm[i])) * 32767;
    }
    const binary = new Uint8Array(buffer.buffer);
    let base64 = "";
    for (let i = 0; i < binary.length; i++) {
        base64 += String.fromCharCode(binary[i]);
    }
    return btoa(base64);
}

function createAudioContext(sampleRate?: number): AudioContext {
    try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (sampleRate) {
            try {
                return new AudioCtx({ sampleRate });
            } catch (e) {
                console.warn(`AudioContext with sampleRate ${sampleRate} failed, falling back to default`, e);
            }
        }
        return new AudioCtx();
    } catch (e) {
        console.error("Failed to create AudioContext:", e);
        throw e;
    }
}

// Helper: Play Base64 Audio Chunk
async function playAudioChunk(audioCtx: AudioContext, base64Audio: string, nextStartTime: { current: number }, isAiSpeaking: { current: boolean }) {
    try {
        if (!base64Audio || !audioCtx || audioCtx.state === 'closed') return;
        const binary = atob(base64Audio);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        
        // Assuming 24kHz, 16-bit mono PCM
        const sampleCount = Math.floor(bytes.length / 2);
        if (sampleCount <= 0) return;

        const buffer = audioCtx.createBuffer(1, sampleCount, 24000);
        const channelData = buffer.getChannelData(0);
        for (let i = 0; i < sampleCount; i++) {
            const sample = (bytes[i * 2 + 1] << 8) | bytes[i * 2];
            channelData[i] = ((sample << 16) >> 16) / 32768;
        }

        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(audioCtx.destination);
        
        source.onended = () => {
            if (audioCtx.currentTime >= nextStartTime.current - 0.1) {
                isAiSpeaking.current = false;
            }
        };

        const startTime = Math.max(audioCtx.currentTime, nextStartTime.current);
        source.start(startTime);
        nextStartTime.current = startTime + buffer.duration;
        isAiSpeaking.current = true;
    } catch (e) {
        console.error("Error playing audio chunk:", e);
    }
}

export default function LiveAIInterface({ onClose }: LiveAIInterfaceProps) {
    const [isRecording, setIsRecording] = useState(false);
    const [status, setStatus] = useState("Idle");
    const [volume, setVolume] = useState(0);
    const [selectedImages, setSelectedImages] = useState<{ id: string; file: File; status: 'uploading' | 'uploaded' }[]>([]);
    const [previewImage, setPreviewImage] = useState<{ id: string; file: File } | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [showShortcutPrompt, setShowShortcutPrompt] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [memoryEnabled, setMemoryEnabled] = useState(() => localStorage.getItem('memoryEnabled') === 'true');
    const [timeRange, setTimeRange] = useState(() => localStorage.getItem('timeRange') || 'Last 1 day');
    const [showTimeRangeDropdown, setShowTimeRangeDropdown] = useState(false);
    const [selectedVoice, setSelectedVoice] = useState('Aoede');
    const [showVoiceDropdown, setShowVoiceDropdown] = useState(false);
    const [thinkingLevel, setThinkingLevel] = useState(() => localStorage.getItem('thinkingLevel') || 'high');
    const [accurateMode, setAccurateMode] = useState(() => localStorage.getItem('accurateMode') === 'true');
    const [answerLength, setAnswerLength] = useState(() => localStorage.getItem('answerLength') || 'short');
    const [googleSearchMode, setGoogleSearchMode] = useState(() => localStorage.getItem('googleSearchMode') === 'true');
    const [showCaptions, setShowCaptions] = useState(true);
    const [captionText, setCaptionText] = useState('');
    const [showChatHistory, setShowChatHistory] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const captionBoxRef = useRef<HTMLDivElement>(null);
    const userScrolledUpRef = useRef(false);
    // True once the *first* text chunk of the current AI turn has arrived.
    // Lets us reset captionText the instant a fresh answer starts, instead
    // of relying only on turnComplete (which can race with the next turn's
    // first chunk and cause old + new captions to visually run together).
    const captionTurnStartedRef = useRef(false);
    const [messages, setMessages] = useState<Message[]>([]);
    // Prefetched as soon as this screen opens (see effect below), so that
    // by the time the user taps the mic, session init can send the
    // summary straight to the server instead of the server having to hit
    // Firestore on the critical path. undefined = not fetched yet /
    // fetch failed (server falls back to its own Firestore lookup);
    // null = fetched, no summary exists yet.
    const prefetchedSummaryRef = useRef<string | null | undefined>(undefined);
    // Mirrors prefetchedSummaryRef but as state, purely to drive the status
    // dot in Settings (refs don't trigger re-renders, so the ref alone
    // can't make the dot flip color when the fetch resolves).
    const [memoryFetchStatus, setMemoryFetchStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
    

    useEffect(() => {
        enableScreenshot();
        return () => {
            disableScreenshot();
        };
    }, []);

    // Push history state whenever an overlay opens in Live AI Interface so device back button pops overlay first
    useEffect(() => {
        if (showSettings || showChatHistory || previewImage || showShortcutPrompt) {
            window.history.pushState({ ...window.history.state, liveAiOverlay: true }, '', window.location.href);
        }
    }, [showSettings, showChatHistory, previewImage, showShortcutPrompt]);

    // Android Hardware Physical Back Button Handler
    useEffect(() => {
        const unregister = registerBackButtonHandler(() => {
            if (showTimeRangeDropdown) {
                setShowTimeRangeDropdown(false);
                return true;
            }
            if (showVoiceDropdown) {
                setShowVoiceDropdown(false);
                return true;
            }
            if (showChatHistory) {
                setShowChatHistory(false);
                return true;
            }
            if (showSettings) {
                setShowSettings(false);
                return true;
            }
            if (showShortcutPrompt) {
                setShowShortcutPrompt(false);
                return true;
            }
            if (previewImage) {
                setPreviewImage(null);
                return true;
            }
            onClose();
            return true;
        });
        return unregister;
    }, [showTimeRangeDropdown, showVoiceDropdown, showChatHistory, showSettings, showShortcutPrompt, previewImage, onClose]);

    // Desktop-Only 1-Time Add to Home Screen Prompt Check (Mobile users NEVER see this)
    useEffect(() => {
        const isMobile = Capacitor.isNativePlatform() || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
        const hasSeenShortcutPrompt = localStorage.getItem('has_seen_pwa_shortcut_prompt') === 'true';

        if (!isMobile && !hasSeenShortcutPrompt) {
            setShowShortcutPrompt(true);
        }
    }, []);

    useEffect(() => {
        if (!auth.currentUser) return;
        const aiChatId = `${auth.currentUser.uid}_ai`;
        const unsubscribe = subscribeToMessages(aiChatId, (msgs) => {
            const fiveDaysAgo = new Date();
            fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
            setMessages(msgs.filter(msg => {
                if (!msg.timestamp) return true;
                const date = (msg.timestamp as any).toDate ? (msg.timestamp as any).toDate() : new Date(msg.timestamp);
                return date >= fiveDaysAgo;
            }));
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        localStorage.setItem('memoryEnabled', memoryEnabled.toString());
        localStorage.setItem('timeRange', timeRange);
        localStorage.setItem('thinkingLevel', thinkingLevel);
        localStorage.setItem('accurateMode', accurateMode.toString());
        localStorage.setItem('answerLength', answerLength);
        localStorage.setItem('googleSearchMode', googleSearchMode.toString());
    }, [memoryEnabled, timeRange, thinkingLevel, accurateMode, answerLength, googleSearchMode]);

    // Auto-scroll captions to the latest text as the AI speaks, like a
    // live-captioning UI in a big app (YouTube Live, Instagram Live, etc).
    // If the user has manually scrolled up to re-read something, we don't
    // yank them back down — only resume auto-scroll once they're back near
    // the bottom themselves.
    useEffect(() => {
        const box = captionBoxRef.current;
        if (!box) return;
        if (!userScrolledUpRef.current) {
            box.scrollTop = box.scrollHeight;
        }
    }, [captionText]);

    // Prefetch the memory summary the moment this screen is open (before
    // the user has even tapped the mic), so session init never has to wait
    // on Firestore. Re-runs if the user flips memory on/off or changes the
    // time range in Settings so the cached value stays in sync.
    useEffect(() => {
        if (!memoryEnabled || !auth.currentUser) {
            prefetchedSummaryRef.current = undefined;
            setMemoryFetchStatus('idle');
            return;
        }
        let cancelled = false;
        prefetchedSummaryRef.current = undefined; // stale until this resolves
        setMemoryFetchStatus('loading');
        const apiHost = (import.meta.env.VITE_APP_URL || 'mrdk.onrender.com').replace(/\/$/, '');
        const base = apiHost.startsWith('http') ? apiHost : `https://${apiHost}`;
        fetch(`${base}/api/memory-summary?userId=${encodeURIComponent(auth.currentUser.uid)}&range=${encodeURIComponent(timeRange)}`)
            .then(res => res.json())
            .then(data => {
                if (cancelled) return;
                prefetchedSummaryRef.current = data.summary ?? null;
                setMemoryFetchStatus('ready');
            })
            .catch(err => {
                console.warn("Memory summary prefetch failed, will fall back to server-side lookup:", err);
                // leave ref as undefined — server does its own Firestore lookup
                if (!cancelled) setMemoryFetchStatus('error');
            });
        return () => { cancelled = true; };
    }, [memoryEnabled, timeRange]);

    useEffect(() => {
        const hasShownShortcut = localStorage.getItem('hasShownShortcut');
        if (!hasShownShortcut) {
            const timer = setTimeout(() => {
                setShowShortcutPrompt(true);
                localStorage.setItem('hasShownShortcut', 'true');
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, []);

    useEffect(() => {
        const interval = setInterval(() => {
            if (!isAiSpeaking.current && status === "Speaking...") {
                setStatus("Listening...");
            }
        }, 200);
        return () => clearInterval(interval);
    }, [status]);

    // Safety net: some mobile browsers/WebViews re-suspend an AudioContext
    // when the tab loses focus, the screen locks, or the app briefly goes to
    // background. If that happens mid-recording, onaudioprocess silently
    // stops firing again with no visible error. Keep nudging it awake.
    useEffect(() => {
        if (!isRecording) return;
        const interval = setInterval(() => {
            if (inputAudioCtx.current && inputAudioCtx.current.state === 'suspended') {
                console.warn("inputAudioCtx was suspended mid-recording, resuming...");
                inputAudioCtx.current.resume();
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [isRecording]);

    useEffect(() => {
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            isInitializedRef.current = false;
            ws.current.send(JSON.stringify({ 
                type: 'init', 
                userId: auth.currentUser?.uid, 
                memorySettings: { enabled: memoryEnabled, range: timeRange },
                voice: selectedVoice,
                thinkingLevel: thinkingLevel,
                accurateMode: accurateMode,
                answerLength: answerLength,
                googleSearchMode: googleSearchMode,
                prefetchedSummary: prefetchedSummaryRef.current
            }));
        }
    }, [memoryEnabled, timeRange, selectedVoice, thinkingLevel, accurateMode, answerLength, googleSearchMode]);

    const ws = useRef<WebSocket | null>(null);
    const inputAudioCtx = useRef<AudioContext | null>(null);
    const outputAudioCtx = useRef<AudioContext | null>(null);
    const processor = useRef<ScriptProcessorNode | null>(null);
    const nextStartTime = useRef<number>(0);
    const isAiSpeaking = useRef<boolean>(false);
    const isInitializedRef = useRef<boolean>(false);
    const initAckTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Tracks the MediaStream so we can toggle track.enabled on mute/unmute
    // from the notification without closing the WebSocket.
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const isMutedRef = useRef<boolean>(false);

    const fileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                const result = reader.result as string;
                resolve(result.split(',')[1]);
            };
            reader.onerror = error => reject(error);
        });
    };

    const sendImageToWebSocket = async (image: { id: string; file: File; caption?: string }) => {
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            const base64 = await fileToBase64(image.file);
            ws.current.send(JSON.stringify({ image: base64, mimeType: image.file.type, imageId: image.id, caption: image.caption || '' }));
            
            // Save to Firestore history
            if (auth.currentUser) {
                try {
                    const mediaUrl = await uploadMedia(image.file, `chats/${auth.currentUser.uid}/images/${Date.now()}_${image.id}.jpg`);
                    saveAIMessage(auth.currentUser.uid, {
                        senderId: auth.currentUser.uid,
                        mediaType: 'image',
                        mediaUrl: mediaUrl
                    });
                } catch (e) {
                    console.error("Error uploading image to history:", e);
                    // Fallback to placeholder if upload fails
                    saveAIMessage(auth.currentUser.uid, {
                        senderId: auth.currentUser.uid,
                        mediaType: 'image',
                        mediaUrl: 'upload_failed'
                    });
                }
            }
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            const newImages = files.map(file => ({
                id: Math.random().toString(36).substr(2, 9),
                file,
                status: 'uploading' as const
            }));
            
            setSelectedImages(prev => [...prev, ...newImages]);

            ensureConnection(false).then(() => {
                newImages.forEach(image => {
                    sendImageToWebSocket(image);
                });
            });
        }
    };

    const handleRemoveImage = (id: string) => {
        setSelectedImages(prev => prev.filter(img => img.id !== id));
    };

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const isDrawing = useRef(false);

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        isDrawing.current = true;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = (('touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX) - rect.left) * scaleX;
        const y = (('touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY) - rect.top) * scaleY;
        ctx.beginPath();
        ctx.moveTo(x, y);
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = (('touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX) - rect.left) * scaleX;
        const y = (('touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY) - rect.top) * scaleY;
        ctx.lineTo(x, y);
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 5;
        ctx.stroke();
    };

    const stopDrawing = () => {
        isDrawing.current = false;
    };

    const handleSubmitEdit = () => {
        const canvas = canvasRef.current;
        if (canvas && previewImage) {
            canvas.toBlob(blob => {
                if (blob) {
                    const editedFile = new File([blob], previewImage.file.name, { type: blob.type });
                    setSelectedImages(prev => prev.map(img => img.id === previewImage.id ? { ...img, file: editedFile } : img));
                    setPreviewImage(null);
                    setIsEditing(false);
                }
            });
        }
    };

    useEffect(() => {
        if (isEditing && previewImage && canvasRef.current) {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            const img = new Image();
            img.src = URL.createObjectURL(previewImage.file);
            img.onload = () => {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx?.drawImage(img, 0, 0);
            };
        }
    }, [isEditing, previewImage]);

    const selectedImagesRef = useRef(selectedImages);
    useEffect(() => {
        selectedImagesRef.current = selectedImages;
    }, [selectedImages]);

    const stopAudio = () => {
        if (outputAudioCtx.current && outputAudioCtx.current.state !== 'closed') {
            try { outputAudioCtx.current.close(); } catch (e) {}
            outputAudioCtx.current = createAudioContext(24000);
        }
    };

    const stopRecording = () => {
        console.log("Stopping recording...");
        if (initAckTimeoutRef.current) {
            clearTimeout(initAckTimeoutRef.current);
            initAckTimeoutRef.current = null;
        }
        ws.current?.close();
        processor.current?.disconnect();
        if (inputAudioCtx.current && inputAudioCtx.current.state !== 'closed') {
            inputAudioCtx.current.close();
        }
        // Stop all mic tracks and clear the ref
        mediaStreamRef.current?.getTracks().forEach(t => t.stop());
        mediaStreamRef.current = null;
        isMutedRef.current = false;
        stopAudio();
        setIsRecording(false);
        setStatus("Idle");
        // Stop the native foreground service / CallStyle notification
        if (Capacitor.isNativePlatform()) {
            try { LiveSession.stopSession(); } catch (e) { console.warn('LiveSession.stopSession failed:', e); }
        }
    };

    const handleInterrupt = () => {
        console.log("Interrupting AI...");
        ws.current?.send(JSON.stringify({ interrupt: true }));
        stopAudio();
        setStatus("Listening...");
    };

    useEffect(() => {
        return () => {
            stopRecording();
        };
    }, []);

    // Listen for notification button events from native Android service.
    // callEnded  → user tapped end-call in notification → close everything
    // muteToggled → user tapped mic in notification → toggle mic tracks
    useEffect(() => {
        if (!Capacitor.isNativePlatform()) return;

        const endCallHandle = LiveSession.addListener('callEnded', () => {
            console.log('Notification: callEnded received');
            stopRecording();
            onClose();
        });

        const muteHandle = LiveSession.addListener('muteToggled', () => {
            console.log('Notification: muteToggled received');
            const stream = mediaStreamRef.current;
            if (!stream) return;
            // Toggle all audio tracks
            const newMuted = !isMutedRef.current;
            stream.getAudioTracks().forEach(track => {
                track.enabled = !newMuted;
            });
            isMutedRef.current = newMuted;
            // Sync the notification icon
            try { LiveSession.updateMute({ muted: newMuted }); } catch (e) { /* ignore */ }
        });

        return () => {
            endCallHandle.then(h => h.remove()).catch(() => {});
            muteHandle.then(h => h.remove()).catch(() => {});
        };
    }, []);

    // Sets up the microphone capture pipeline on an already-open socket.
    // Extracted so we can call it both from a fresh connection AND from
    // an existing connection that was opened without mic (e.g. image-only).
    const setupMic = async (): Promise<boolean> => {
        setStatus("Requesting Microphone...");
        let stream: MediaStream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (err) {
            console.error("Error accessing audio", err);
            setStatus("Error: Mic Access Failed");
            return false;
        }

        setIsRecording(true);
        setStatus("Listening...");
        nextStartTime.current = 0;
        mediaStreamRef.current = stream;
        // Start native CallStyle notification
        if (Capacitor.isNativePlatform()) {
            try { LiveSession.startSession(); } catch (e) { console.warn('LiveSession.startSession failed:', e); }
        }

        inputAudioCtx.current = createAudioContext(16000);
        outputAudioCtx.current = createAudioContext(24000);

        try {
            await inputAudioCtx.current.resume();
            await outputAudioCtx.current.resume();
        } catch (e) {
            console.error("Failed to resume AudioContext:", e);
        }

        const source = inputAudioCtx.current.createMediaStreamSource(stream);
        processor.current = inputAudioCtx.current.createScriptProcessor(4096, 1, 1);
        source.connect(processor.current);
        processor.current.connect(inputAudioCtx.current.destination);

        processor.current.onaudioprocess = (e) => {
            if (isAiSpeaking.current || !isInitializedRef.current) return;
            const base64 = pcmToBase64(e.inputBuffer.getChannelData(0));
            ws.current?.send(JSON.stringify({ audio: base64 }));
            const pcm = e.inputBuffer.getChannelData(0);
            let sum = 0;
            for (let i = 0; i < pcm.length; i++) sum += Math.abs(pcm[i]);
            setVolume((sum / pcm.length) * 1000);
        };
        return true;
    };

    const ensureConnection = async (withMic: boolean) => {
        // If a connection already exists (e.g. opened earlier just to send an
        // image), and we now need the mic, set the mic up on that same socket
        // instead of silently no-op'ing (this was the "photo then tap-to-talk
        // gives no reply" bug — the mic pipeline was never created).
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            if (withMic && !isRecording) {
                await setupMic();
            }
            return;
        }

        console.log("Ensuring connection...");
        setStatus("Connecting...");
        
        let stream: MediaStream | undefined;
        if (withMic) {
            setStatus("Requesting Microphone...");
            try {
                stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                setStatus("Connecting...");
            } catch (err) {
                console.error("Error accessing audio", err);
                setStatus("Error: Mic Access Failed");
                return;
            }
        }

        const apiHost = (import.meta.env.VITE_APP_URL || 'mrdk.onrender.com')
            .replace(/^https?:\/\//, '')
            .replace(/^wss?:\/\//, '');
        const socket = new WebSocket(`wss://${apiHost}/live`);
        ws.current = socket;

        socket.onopen = async () => {
            console.log("WebSocket open");
            setIsRecording(withMic);
            setStatus(withMic ? "Listening..." : "Connected");
            nextStartTime.current = 0;

            // Start the native foreground service (CallStyle notification)
            // the moment we have a mic-active live session.
            if (withMic && Capacitor.isNativePlatform()) {
                try { LiveSession.startSession(); } catch (e) { console.warn('LiveSession.startSession failed:', e); }
            }

            // CRITICAL: the server only creates a Gemini Live session once it
            // receives an 'init' message. Without this, the socket looks
            // "open" and mic capture starts fine, but every audio chunk we
            // send is silently dropped server-side (session === undefined),
            // so the AI never hears anything and never replies.
            isInitializedRef.current = false;
            socket.send(JSON.stringify({
                type: 'init',
                userId: auth.currentUser?.uid,
                memorySettings: { enabled: memoryEnabled, range: timeRange },
                voice: selectedVoice,
                thinkingLevel: thinkingLevel,
                accurateMode: accurateMode,
                answerLength: answerLength,
                googleSearchMode: googleSearchMode,
                prefetchedSummary: prefetchedSummaryRef.current
            }));

            // If the server takes unusually long to confirm the session
            // (e.g. cold start), let the user know instead of leaving them
            // talking into a mic that's silently discarding everything.
            const initAckTimeout = setTimeout(() => {
                if (!isInitializedRef.current) {
                    setStatus("Starting up, please wait...");
                }
            }, 3000);
            initAckTimeoutRef.current = initAckTimeout;

            // Send pending images and history
            const imageMessages = selectedImagesRef.current.filter(img => img.status === 'uploading');
            imageMessages.forEach(image => {
                sendImageToWebSocket(image);
            });
            
            // NOTE: Removed automatic sending of last 25 images to prevent AI from pre-emptively analyzing them.

            if (withMic && stream) {
                // Save the stream ref so notification mute-toggle can
                // flip track.enabled without closing the socket.
                mediaStreamRef.current = stream;
                inputAudioCtx.current = createAudioContext(16000);
                outputAudioCtx.current = createAudioContext(24000);

                // CRITICAL: on mobile browsers / WebViews (Capacitor), a newly
                // created AudioContext can start life in "suspended" state
                // even though it was created inside a user gesture. If it's
                // suspended, ScriptProcessorNode.onaudioprocess NEVER fires.
                // We must explicitly resume it.
                try {
                    await inputAudioCtx.current.resume();
                    await outputAudioCtx.current.resume();
                } catch (e) {
                    console.error("Failed to resume AudioContext:", e);
                }

                const source = inputAudioCtx.current.createMediaStreamSource(stream);
                processor.current = inputAudioCtx.current.createScriptProcessor(4096, 1, 1);
                source.connect(processor.current);
                processor.current.connect(inputAudioCtx.current.destination);

                processor.current.onaudioprocess = (e) => {
                    if (isAiSpeaking.current || !isInitializedRef.current) return;
                    const base64 = pcmToBase64(e.inputBuffer.getChannelData(0));
                    ws.current?.send(JSON.stringify({ audio: base64 }));
                    const pcm = e.inputBuffer.getChannelData(0);
                    let sum = 0;
                    for (let i = 0; i < pcm.length; i++) sum += Math.abs(pcm[i]);
                    setVolume((sum / pcm.length) * 1000);
                };
            }
        };
        
        socket.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            if (msg.audio) {
                if (outputAudioCtx.current) {
                    setStatus("Speaking...");
                    playAudioChunk(outputAudioCtx.current, msg.audio, nextStartTime, isAiSpeaking);
                }
            } else if (msg.type === 'thinking') {
                setStatus("Thinking...");
            } else if (msg.text) {
                console.log("Caption received:", msg.text);
                if (!captionTurnStartedRef.current) {
                    // First chunk of a brand-new turn — replace, don't
                    // append, so the previous answer's leftover caption
                    // (if turnComplete hasn't landed/rendered yet) can never
                    // get glued to the front of this one.
                    captionTurnStartedRef.current = true;
                    setCaptionText(msg.text);
                } else {
                    setCaptionText(prev => prev + msg.text);
                }
            } else if (msg.turnComplete) {
                // Reliable end-of-turn signal from the server (Gemini's
                // serverContent.turnComplete) — this is the correct moment
                // to clear the caption for the next turn. We deliberately do
                // NOT clear on every audio chunk or on the "Speaking..." ->
                // "Listening..." status flicker, because Gemini can pause
                // mid-turn (brief gap between audio chunks) without the turn
                // actually ending; clearing there was wiping captions
                // mid-sentence even though the AI was still talking.
                captionTurnStartedRef.current = false;
                setCaptionText('');
            } else if (msg.type === 'init_ack') {
                isInitializedRef.current = true;
                console.log("Gemini session initialized");
                if (initAckTimeoutRef.current) {
                    clearTimeout(initAckTimeoutRef.current);
                    initAckTimeoutRef.current = null;
                }
                if (status === "Starting up, please wait...") {
                    setStatus("Listening...");
                }
            } else if (msg.interrupted) {
                isAiSpeaking.current = false;
                nextStartTime.current = outputAudioCtx.current?.currentTime || 0;
                setStatus("Listening...");
            } else if (msg.error === "session_not_initialized") {
                console.error("Server dropped a message: Gemini session wasn't initialized yet.");
            } else if (msg.error === "session_init_failed") {
                console.error("Server failed to create the Gemini Live session.");
                setStatus("Error: AI session failed to start");
            } else if (msg.imageAck) {
                console.log("Image acknowledged by AI");
                setSelectedImages(prev => prev.map(img => 
                    img.id === msg.imageId ? { ...img, status: 'uploaded' } : img
                ));
                // The image itself never sets isAiSpeaking, but if the mic
                // pipeline was stalled waiting on a previous response this
                // guarantees we're not stuck "muted" once the image lands.
                if (status !== "Speaking...") {
                    isAiSpeaking.current = false;
                }
            } else {
                console.log("Received message:", msg);
            }
        };

        socket.onclose = () => {
            console.log("WebSocket closed");
            isInitializedRef.current = false;
            setIsRecording(false);
            setStatus("Idle");
            stream?.getTracks().forEach(track => track.stop());
        };

        socket.onerror = (error) => {
            console.error("WebSocket error", error);
            setStatus("Error: Connection Failed");
            stream?.getTracks().forEach(track => track.stop());
        };
    };

    const handleToggleRecording = async () => {
        console.log("handleToggleRecording called, isRecording:", isRecording);
        if (isRecording) {
            stopRecording();
        } else {
            await ensureConnection(true);
        }
    };

    const handlePlusClick = async () => {
        try {
            const photo = await takePhoto();
            if (photo) {
                const newImage = {
                    id: Math.random().toString(36).substr(2, 9),
                    file: photo,
                    status: 'uploading' as const
                };

                setSelectedImages(prev => [...prev, newImage]);

                ensureConnection(false).then(() => {
                    sendImageToWebSocket(newImage);
                });
            }
        } catch (e) {
            console.error("Failed to open camera/gallery:", e);
            setStatus("Error opening camera/gallery");
        }
    };

    const handleClose = () => {
        if (isRecording) stopRecording();
        onClose();
    };

    return (
        <div 
            className="fixed inset-0 z-[1000] bg-gradient-to-b from-[#0a0f24] via-[#0a0f24] via-60% to-black text-white flex flex-col items-center pt-[env(safe-area-inset-top,0px)] px-6 pb-[max(env(safe-area-inset-bottom,0px),12px)] overflow-hidden"
            onClick={handleClose}
        >
            <div className="w-full h-full flex flex-col flex-1 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="absolute inset-0 pointer-events-none text-[10px]">
                <motion.span animate={{ opacity: [0.4, 0.8, 0.4], scale: [1, 1.2, 1] }} transition={{ duration: 3, repeat: Infinity }} className="absolute top-[5%] left-[5%] opacity-40 scale-[0.4]">⭐</motion.span>
                <motion.span animate={{ opacity: [0.6, 1, 0.6], scale: [1, 1.3, 1] }} transition={{ duration: 2.5, repeat: Infinity }} className="absolute top-[12%] left-[15%] opacity-60 scale-[0.4]">⭐</motion.span>
                <motion.span animate={{ opacity: [0.5, 0.9, 0.5], scale: [1, 1.1, 1] }} transition={{ duration: 3.5, repeat: Infinity }} className="absolute top-[8%] left-[30%] opacity-50 scale-[0.4]">⭐</motion.span>
                <motion.span animate={{ opacity: [0.7, 1, 0.7], scale: [1, 1.2, 1] }} transition={{ duration: 2.8, repeat: Infinity }} className="absolute top-[20%] left-[45%] opacity-70 scale-[0.4]">⭐</motion.span>
                <motion.span animate={{ opacity: [0.3, 0.7, 0.3], scale: [1, 1.4, 1] }} transition={{ duration: 4, repeat: Infinity }} className="absolute top-[5%] left-[60%] opacity-30 scale-[0.4]">⭐</motion.span>
                <motion.span animate={{ opacity: [0.9, 1, 0.9], scale: [1, 1.1, 1] }} transition={{ duration: 2.2, repeat: Infinity }} className="absolute top-[15%] left-[75%] opacity-90 scale-[0.4]">⭐</motion.span>
                <motion.span animate={{ opacity: [0.5, 0.9, 0.5], scale: [1, 1.2, 1] }} transition={{ duration: 3.2, repeat: Infinity }} className="absolute top-[28%] left-[90%] opacity-50 scale-[0.4]">⭐</motion.span>
                <motion.span animate={{ opacity: [0.6, 1, 0.6], scale: [1, 1.1, 1] }} transition={{ duration: 2.6, repeat: Infinity }} className="absolute top-[35%] left-[10%] opacity-60 scale-[0.4]">⭐</motion.span>
                <motion.span animate={{ opacity: [0.4, 0.8, 0.4], scale: [1, 1.3, 1] }} transition={{ duration: 3.8, repeat: Infinity }} className="absolute top-[40%] left-[25%] opacity-40 scale-[0.4]">⭐</motion.span>
                <motion.span animate={{ opacity: [0.8, 1, 0.8], scale: [1, 1.2, 1] }} transition={{ duration: 2.4, repeat: Infinity }} className="absolute top-[45%] left-[50%] opacity-80 scale-[0.4]">⭐</motion.span>
                <motion.span animate={{ opacity: [0.5, 0.9, 0.5], scale: [1, 1.1, 1] }} transition={{ duration: 3.5, repeat: Infinity }} className="absolute top-[38%] left-[65%] opacity-50 scale-[0.4]">⭐</motion.span>
                <motion.span animate={{ opacity: [0.7, 1, 0.7], scale: [1, 1.3, 1] }} transition={{ duration: 2.9, repeat: Infinity }} className="absolute top-[50%] left-[85%] opacity-70 scale-[0.4]">⭐</motion.span>
                <motion.span animate={{ opacity: [0.6, 1, 0.6], scale: [1, 1.2, 1] }} transition={{ duration: 3.1, repeat: Infinity }} className="absolute top-[2%] left-[95%] opacity-60 scale-[0.4]">⭐</motion.span>
                <motion.span animate={{ opacity: [0.8, 1, 0.8], scale: [1, 1.1, 1] }} transition={{ duration: 2.3, repeat: Infinity }} className="absolute top-[22%] left-[2%] opacity-80 scale-[0.4]">⭐</motion.span>

                <motion.span animate={{ opacity: [0.2, 0.4, 0.2], y: [0, -10, 0] }} transition={{ duration: 4, repeat: Infinity }} className="absolute top-[10%] left-[20%] opacity-30 text-blue-300 font-bold">⚛️ F=ma</motion.span>
                <motion.span animate={{ opacity: [0.2, 0.4, 0.2], y: [0, 10, 0] }} transition={{ duration: 5, repeat: Infinity }} className="absolute top-[60%] left-[80%] opacity-30 text-purple-300 font-bold">💧 H₂O</motion.span>
                <motion.span animate={{ opacity: [0.2, 0.4, 0.2], x: [0, -10, 0] }} transition={{ duration: 6, repeat: Infinity }} className="absolute top-[70%] left-[10%] opacity-30 text-green-300 font-bold">🧬 DNA</motion.span>
                <motion.span animate={{ opacity: [0.2, 0.4, 0.2], x: [0, 10, 0] }} transition={{ duration: 4.5, repeat: Infinity }} className="absolute top-[30%] left-[80%] opacity-30 text-blue-300 font-bold">⚡ E=mc²</motion.span>
                <motion.span animate={{ opacity: [0.2, 0.4, 0.2], y: [0, -15, 0] }} transition={{ duration: 5.5, repeat: Infinity }} className="absolute top-[80%] left-[50%] opacity-30 text-green-300 font-bold">🧩 Enzyme</motion.span>
                <motion.span animate={{ opacity: [0.2, 0.4, 0.2], x: [-10, 0, -10] }} transition={{ duration: 4, repeat: Infinity }} className="absolute top-[15%] left-[90%] opacity-30 text-purple-300 font-bold">💨 CO₂</motion.span>
                <motion.span animate={{ opacity: [0.2, 0.4, 0.2], y: [0, 5, 0] }} transition={{ duration: 6, repeat: Infinity }} className="absolute top-[50%] left-[5%] opacity-30 text-green-300 font-bold">⚙️ Ribosome</motion.span>
                
                <motion.span animate={{ rotate: 360 }} transition={{ duration: 10, repeat: Infinity, ease: "linear" }} className="absolute top-[60%] left-[20%] opacity-30 text-yellow-300 font-bold">
                    <svg viewBox="0 0 52 30" width="30" height="20" stroke="currentColor" fill="none" strokeWidth="2">
                        <path d="M5 15 L10 5 L20 5 L25 15 L20 25 L10 25 Z M25 15 L35 5 L45 5 L50 15 L45 25 L35 25 Z" />
                    </svg>
                </motion.span>
            </div>
            <div className="w-full flex justify-between items-center mb-6">
                <h1 className="text-lg font-bold flex items-center gap-2">NeetMaster <span className="text-blue-400">AI</span></h1>
                <div className="flex items-center gap-4">
                    <button onClick={() => setShowCaptions(!showCaptions)} className={`${showCaptions ? 'text-green-500' : 'text-white'}`}>
                        <Captions className="h-6 w-6" />
                    </button>
                    <button onClick={() => setShowSettings(true)} className="text-white">
                        <Settings className="h-6 w-6" />
                    </button>
                    <button onClick={handleClose} className="text-white">
                        <X className="h-6 w-6" />
                    </button>
                </div>
            </div>
            
            <h2 className="text-lg font-bold mb-1 -mt-4">Hello, Future Doctor! 👋</h2>
            
            <p className="text-gray-400 mb-8 text-center text-sm -mt-1">I'm your AI study companion for NEET.</p>

            <div className={`relative flex items-center justify-center gap-4 transition-all ${selectedImages.length > 0 ? 'mb-2 scale-75 -mt-2' : 'mb-8 -mt-4'}`}>
                <div className="flex flex-col gap-3">
                    <motion.div 
                        className="flex flex-col items-center gap-1"
                        whileHover={{ scale: 1.1, rotate: 5 }}
                        whileTap={{ scale: 0.95 }}
                        animate={{ y: [0, -8, 0] }}
                        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    >
                        <div className="w-9 h-9 rounded-full bg-blue-900/50 flex items-center justify-center border border-blue-500/30">
                            <span className="text-base">⚛️</span>
                        </div>
                        <span className="text-xs text-gray-400">Physics</span>
                    </motion.div>
                    <motion.div 
                        className="flex flex-col items-center gap-1"
                        whileHover={{ scale: 1.1, rotate: 5 }}
                        whileTap={{ scale: 0.95 }}
                        animate={{ y: [0, -6, 0] }}
                        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                    >
                        <div className="w-9 h-9 rounded-full bg-purple-900/50 flex items-center justify-center border border-purple-500/30">
                            <span className="text-base">🧪</span>
                        </div>
                        <span className="text-xs text-gray-400">Chemistry</span>
                    </motion.div>
                </div>
                <div className="flex flex-col items-center">
                    <AgentFace status={status} volume={isAiSpeaking.current ? volume : 0} size={110} colorIndex={0} />
                    {status === "Speaking..." && (
                        <button
                            onClick={handleInterrupt}
                            className="text-[10px] text-red-400 bg-red-950/30 px-2 py-0.5 rounded-full mt-2 border border-red-500/20 hover:bg-red-950/50"
                        >
                            Tap to interrupt
                        </button>
                    )}
                </div>
                <motion.div 
                    className="flex flex-col items-center gap-1"
                    whileHover={{ scale: 1.1, rotate: -5 }}
                    whileTap={{ scale: 0.95 }}
                    animate={{ y: [0, -12, 0] }}
                    transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
                >
                    <div className="w-9 h-9 rounded-full bg-green-900/50 flex items-center justify-center border border-green-500/30">
                        <span className="text-base">🌿</span>
                    </div>
                    <span className="text-xs text-gray-400">Biology</span>
                </motion.div>
            </div>

            {!isRecording && (
                <h3 className={`font-semibold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 transition-all ${selectedImages.length > 0 ? 'text-lg mb-0' : 'text-2xl mb-2'}`}>Tap to talk</h3>
            )}
            {isRecording && (
                <h3 className={`font-semibold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 transition-all ${selectedImages.length > 0 ? 'text-lg mb-0' : 'text-2xl mb-2'}`}>{status}</h3>
            )}
            {selectedImages.length === 0 && (
                <p className="text-gray-400 mb-3 text-center text-sm -mt-1">Ask me anything about NEET</p>
            )}
            <div className="flex-1 min-h-0 overflow-hidden w-full mb-2 flex flex-col gap-2">
                {showCaptions && (
                    <div
                        ref={captionBoxRef}
                        onScroll={() => {
                            const box = captionBoxRef.current;
                            if (!box) return;
                            const distanceFromBottom = box.scrollHeight - box.scrollTop - box.clientHeight;
                            // Small threshold so "basically at the bottom" still counts as
                            // following along, not as having scrolled away.
                            userScrolledUpRef.current = distanceFromBottom > 40;
                        }}
                        className="w-full flex-1 bg-gray-800 rounded-lg p-3 overflow-y-auto text-sm text-gray-200"
                    >
                        {captionText || "AI ke liye captions yaha show honge..."}
                    </div>
                )}
                {selectedImages.length === 0 && (
                    <div className="w-full flex-1 overflow-y-auto space-y-2">
                        {messages.slice(-5).map((msg, index) => (
                            msg.text && (
                                <div key={index} className={`p-2 rounded-lg text-xs ${msg.senderId === auth.currentUser?.uid ? 'bg-blue-600/50 self-end' : 'bg-gray-800/50 self-start'}`}>
                                    {msg.text}
                                </div>
                            )
                        ))}
                    </div>
                )}
            </div>

            <div className="w-full flex flex-col items-center px-4 mt-auto flex-shrink-0">
                <AnimatePresence>
                    {selectedImages.length > 0 && (
                        <motion.div 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 20 }}
                            className="flex gap-2 mb-4 overflow-x-auto max-w-full pb-2 max-h-24"
                        >
                            {selectedImages.map((image) => (
                                <div key={image.id} className="relative w-16 h-16 rounded-xl overflow-hidden border border-white/10 cursor-pointer" onClick={() => setPreviewImage({id: image.id, file: image.file})}>
                                    <img src={URL.createObjectURL(image.file)} alt="preview" className="w-full h-full object-cover" />
                                    {image.status === 'uploading' && (
                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                            <Loader2 className="h-6 w-6 text-white animate-spin" />
                                        </div>
                                    )}
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleRemoveImage(image.id); }}
                                        className="absolute top-0 right-0 bg-red-500 rounded-full p-0.5"
                                    >
                                        <X className="h-3 w-3 text-white" />
                                    </button>
                                </div>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>
                
                <div className="w-full flex justify-between items-center mb-2">
                    <div className="w-12"></div>
                    <div className="flex items-center gap-4">
                        <button onClick={handlePlusClick} className="p-4 bg-white/10 rounded-full">
                            <Plus className="h-6 w-6 text-gray-200" />
                        </button>
                        <input type="file" ref={fileInputRef} multiple accept="image/*" className="hidden" onChange={handleFileChange} />
                        
                        <div className="flex flex-col items-center">
                            <div className="relative w-20 h-20 flex items-center justify-center">
                                {isRecording && status !== "Speaking..." && (
                                    <>
                                        <motion.span
                                            className="absolute inset-0 rounded-full bg-red-500/40"
                                            animate={{ scale: [1, 1.6, 1], opacity: [0.6, 0, 0.6] }}
                                            transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
                                        />
                                        <motion.span
                                            className="absolute inset-0 rounded-full bg-red-500/30"
                                            animate={{ scale: [1, 1.35, 1], opacity: [0.7, 0, 0.7] }}
                                            transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut", delay: 0.3 }}
                                        />
                                    </>
                                )}
                                <motion.button
                                    onClick={handleToggleRecording}
                                    animate={isRecording && status !== "Speaking..." ? { scale: [1, 1.06, 1] } : { scale: 1 }}
                                    transition={isRecording && status !== "Speaking..." ? { duration: 1.2, repeat: Infinity, ease: "easeInOut" } : {}}
                                    whileTap={{ scale: 0.9 }}
                                    className={`relative w-20 h-20 rounded-full flex items-center justify-center ${isRecording ? 'bg-red-500' : 'bg-gradient-to-r from-blue-500 to-purple-500'}`}
                                >
                                    <Mic className="h-8 w-8 text-white" />
                                </motion.button>
                            </div>
                            <span className="mt-2 text-xs text-gray-400">{isRecording ? status : "Tap to talk"}</span>
                        </div>

                        <button onClick={() => setShowChatHistory(true)} className="p-4 bg-white/10 rounded-full text-white">
                            <MessageSquare className="h-6 w-6" />
                        </button>
                    </div>
                    <div className="w-12"></div>
                </div>
            </div>

            {previewImage && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setPreviewImage(null)}>
                    <div className="relative bg-black rounded-2xl max-w-lg w-full p-4 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <button onClick={() => { setPreviewImage(null); setIsEditing(false); }} className="absolute top-2 right-2 bg-gray-800 rounded-full p-2 z-10">
                            <X className="h-6 w-6 text-white" />
                        </button>
                        {isEditing ? (
                            <canvas 
                                ref={canvasRef}
                                className="w-full max-h-[60vh] object-contain rounded-lg"
                                onMouseDown={startDrawing}
                                onMouseMove={draw}
                                onMouseUp={stopDrawing}
                                onMouseLeave={stopDrawing}
                                onTouchStart={startDrawing}
                                onTouchMove={draw}
                                onTouchEnd={stopDrawing}
                            />
                        ) : (
                            <img src={URL.createObjectURL(previewImage.file)} alt="preview" className="w-full max-h-[60vh] object-contain rounded-lg" />
                        )}
                        <div className="mt-4 flex justify-end gap-2">
                            {!isEditing && <button onClick={() => setIsEditing(true)} className="p-2 bg-blue-600 rounded-full"><span className="text-white">✏️</span></button>}
                            {isEditing && <button onClick={handleSubmitEdit} className="p-2 bg-green-600 rounded-full text-white">Submit</button>}
                        </div>
                    </div>
                </div>
            )}
            {showChatHistory && (
                <ChatHistoryModal onClose={() => setShowChatHistory(false)} />
            )}
            {showShortcutPrompt && (
                <HomeScreenShortcutPrompt onClose={() => {
                    localStorage.setItem('has_seen_pwa_shortcut_prompt', 'true');
                    setShowShortcutPrompt(false);
                }} />
            )}
            {showSettings && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setShowSettings(false)}>
                    <div className="relative bg-gray-900 rounded-2xl max-w-sm w-full p-6 text-white" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold">Settings</h2>
                            <button onClick={() => setShowSettings(false)} className="text-gray-400">
                                <X className="h-6 w-6" />
                            </button>
                        </div>

                        {/* Voice Section */}
                        <div className="mb-6">
                            <h3 className="text-sm font-semibold text-gray-400 mb-2">Voice</h3>
                            <div className="relative">
                                <button 
                                    onClick={() => setShowVoiceDropdown(!showVoiceDropdown)}
                                    className="w-full bg-gray-800 p-3 rounded-lg flex justify-between items-center"
                                >
                                    <span>{selectedVoice}</span>
                                    <ChevronDown className="h-5 w-5 text-gray-400" />
                                </button>
                                {showVoiceDropdown && (
                                    <div className="absolute top-full left-0 right-0 bg-gray-800 rounded-lg mt-2 py-2 border border-gray-700 z-10">
                                        {['Aoede', 'Kore', 'Fenrir', 'Achernar', 'Sulafat', 'Achird'].map(option => (
                                            <button 
                                                key={option}
                                                onClick={() => { setSelectedVoice(option); setShowVoiceDropdown(false); }}
                                                className="w-full text-left px-4 py-2 hover:bg-gray-700"
                                            >
                                                {option}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Thinking Level Section */}
                        <div className="mb-6">
                            <h3 className="text-sm font-semibold text-gray-400 mb-1">Thinking Level</h3>
                            <p className="text-xs text-gray-500 mb-2">Higher = more accurate answers, slightly slower replies.</p>
                            <div className="grid grid-cols-3 gap-2">
                                {(['low', 'medium', 'high'] as const).map(level => (
                                    <button
                                        key={level}
                                        onClick={() => setThinkingLevel(level)}
                                        className={`py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                                            thinkingLevel === level
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                                        }`}
                                    >
                                        {level}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Accurate Mode Toggle */}
                        <div className="mb-6">
                            <h3 className="text-sm font-semibold text-gray-400 mb-1">Accurate Mode</h3>
                            <p className="text-xs text-gray-500 mb-2">AI will double-check calculations & facts internally before answering. Slower but more accurate.</p>
                            <div className="flex justify-between items-center">
                                <span>Enable Accurate Mode</span>
                                <button 
                                    onClick={() => setAccurateMode(!accurateMode)}
                                    className={`w-12 h-6 rounded-full transition-colors flex items-center p-1 ${accurateMode ? 'bg-blue-600' : 'bg-gray-600'}`}
                                >
                                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${accurateMode ? 'translate-x-6' : 'translate-x-0'}`} />
                                </button>
                            </div>
                        </div>

                        {/* Answer Length Toggle */}
                        <div className="mb-6">
                            <h3 className="text-sm font-semibold text-gray-400 mb-1">Answer Length</h3>
                            <p className="text-xs text-gray-500 mb-2">Short = direct answer only. Detailed = answer + brief explanation.</p>
                            <div className="grid grid-cols-2 gap-2">
                                {(['short', 'detailed'] as const).map(length => (
                                    <button
                                        key={length}
                                        onClick={() => setAnswerLength(length)}
                                        className={`py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                                            answerLength === length
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                                        }`}
                                    >
                                        {length}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Google Search Toggle */}
                        <div className="mb-6">
                            <h3 className="text-sm font-semibold text-gray-400 mb-1">Google Search</h3>
                            <p className="text-xs text-gray-500 mb-2">Let AI search Google to verify facts & constants. More accurate but slightly slower.</p>
                            <div className="flex justify-between items-center">
                                <span>Enable Google Search</span>
                                <button 
                                    onClick={() => setGoogleSearchMode(!googleSearchMode)}
                                    className={`w-12 h-6 rounded-full transition-colors flex items-center p-1 ${googleSearchMode ? 'bg-green-600' : 'bg-gray-600'}`}
                                >
                                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${googleSearchMode ? 'translate-x-6' : 'translate-x-0'}`} />
                                </button>
                            </div>
                        </div>

                        {/* Memory Section */}
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <h3 className="text-sm font-semibold text-gray-400">Memory</h3>
                                {memoryEnabled && (
                                    <span
                                        title={
                                            memoryFetchStatus === 'ready' ? 'Memory loaded and ready' :
                                            memoryFetchStatus === 'loading' ? 'Loading memory...' :
                                            memoryFetchStatus === 'error' ? 'Failed to preload (will still work, just slightly slower)' :
                                            'Memory idle'
                                        }
                                        className={`h-2 w-2 rounded-full ${
                                            memoryFetchStatus === 'ready' ? 'bg-green-500' :
                                            memoryFetchStatus === 'loading' ? 'bg-yellow-500 animate-pulse' :
                                            memoryFetchStatus === 'error' ? 'bg-red-500' :
                                            'bg-gray-600'
                                        }`}
                                    />
                                )}
                            </div>
                            <div className="flex justify-between items-center mb-4">
                                <span>Enable Memory</span>
                                <button 
                                    onClick={() => setMemoryEnabled(!memoryEnabled)}
                                    className={`w-12 h-6 rounded-full transition-colors flex items-center p-1 ${memoryEnabled ? 'bg-blue-600' : 'bg-gray-600'}`}
                                >
                                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${memoryEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                                </button>
                            </div>
                            <div className="relative">
                                <button 
                                    onClick={() => setShowTimeRangeDropdown(!showTimeRangeDropdown)}
                                    className="w-full bg-gray-800 p-3 rounded-lg flex justify-between items-center"
                                >
                                    <span>{timeRange}</span>
                                    <ChevronDown className="h-5 w-5 text-gray-400" />
                                </button>
                                {showTimeRangeDropdown && (
                                    <div className="absolute bottom-full left-0 right-0 bg-gray-800 rounded-lg mb-2 py-2 border border-gray-700 z-10">
                                        {['Last 1 day', 'Last 3 days', 'Long term'].map(option => (
                                            <button 
                                                key={option}
                                                onClick={() => { setTimeRange(option); setShowTimeRangeDropdown(false); }}
                                                className="w-full text-left px-4 py-2 hover:bg-gray-700"
                                            >
                                                {option}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
        </div>
    );
}
