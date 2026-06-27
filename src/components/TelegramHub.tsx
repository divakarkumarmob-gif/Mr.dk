import React, { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, query, deleteDoc, doc, orderBy } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Send, Trash2, Play, Plus, Video, ExternalLink, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import VideoPlayer from './VideoPlayer';

export default function TelegramHub({ onClose }: { onClose: () => void }) {
    const [lectures, setLectures] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [newLabel, setNewLabel] = useState('');
    const [newUrl, setNewUrl] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [activeVideo, setActiveVideo] = useState<{title: string, url: string} | null>(null);

    useEffect(() => {
        if (!auth.currentUser) return;

        const q = query(
            collection(db, 'users', auth.currentUser.uid, 'telegramLectures'),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setLectures(list);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newLabel || !newUrl || !auth.currentUser) return;

        setIsAdding(true);
        try {
            await addDoc(collection(db, 'users', auth.currentUser.uid, 'telegramLectures'), {
                label: newLabel,
                url: newUrl,
                createdAt: new Date(),
            });
            setNewLabel('');
            setNewUrl('');
        } catch (error) {
            console.error("Error adding lecture:", error);
            alert("Failed to add lecture. Check your connection.");
        } finally {
            setIsAdding(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!auth.currentUser) return;
        if (!confirm("Are you sure you want to delete this lecture?")) return;
        
        try {
            await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'telegramLectures', id));
        } catch (error) {
            console.error("Error deleting lecture:", error);
        }
    };

    return (
        <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="fixed inset-0 bg-[#0a0f24] z-[150] flex flex-col p-4"
        >
            {activeVideo && (
                <VideoPlayer topic={activeVideo.title} directUrl={activeVideo.url} onClose={() => setActiveVideo(null)} />
            )}

            <div className="max-w-2xl mx-auto w-full flex flex-col h-full">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-white tracking-tight">Telegram Lectures</h2>
                        <p className="text-gray-500 text-xs mt-1">Host your private lectures for free using Telegram links</p>
                    </div>
                    <button 
                        onClick={onClose}
                        className="bg-white/5 hover:bg-white/10 p-2 rounded-xl text-gray-400 transition"
                    >
                        <Trash2 className="h-5 w-5 rotate-45" />
                    </button>
                </div>

                {/* ADD FORM */}
                <form onSubmit={handleAdd} className="bg-white/5 p-4 rounded-2xl border border-white/10 mb-8 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">Chapter / Title</label>
                            <input 
                                type="text" 
                                value={newLabel}
                                onChange={(e) => setNewLabel(e.target.value)}
                                placeholder="e.g. Physics - Kinematics"
                                className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500/50 transition"
                                required
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">Stream Link (from Telegram Bot)</label>
                            <input 
                                type="url" 
                                value={newUrl}
                                onChange={(e) => setNewUrl(e.target.value)}
                                placeholder="https://t.me/..."
                                className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500/50 transition"
                                required
                            />
                        </div>
                    </div>
                    <button 
                        type="submit"
                        disabled={isAdding}
                        className="w-full bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2"
                    >
                        {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        {isAdding ? "Adding..." : "Add Lecture"}
                    </button>
                    <p className="text-[10px] text-gray-500 text-center italic">
                        Tip: Use bots like @FileStreamBot on Telegram to get direct streaming links for your videos.
                    </p>
                </form>

                {/* LIST */}
                <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                            <Loader2 className="h-8 w-8 animate-spin mb-2" />
                            <p className="text-sm">Loading your library...</p>
                        </div>
                    ) : lectures.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-gray-500 text-center">
                            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
                                <Video className="h-8 w-8 text-white/20" />
                            </div>
                            <h3 className="font-bold text-white mb-1">Your library is empty</h3>
                            <p className="text-xs max-w-xs mx-auto">Add your Telegram lecture links above to start building your private study vault.</p>
                        </div>
                    ) : (
                        lectures.map((lec) => (
                            <motion.div 
                                layout
                                key={lec.id}
                                className="group bg-[#161e38] border border-white/5 rounded-2xl p-4 flex items-center justify-between hover:border-orange-500/30 transition-all"
                            >
                                <div className="flex items-center gap-4 flex-1 min-w-0">
                                    <div className="w-10 h-10 bg-orange-500/10 rounded-xl flex items-center justify-center text-orange-500 group-hover:bg-orange-500 group-hover:text-white transition-colors">
                                        <Play className="h-5 w-5 fill-current" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-bold text-sm text-white truncate">{lec.label}</h4>
                                        <p className="text-[10px] text-gray-500 truncate flex items-center gap-1 mt-0.5">
                                            <ExternalLink className="h-2.5 w-2.5" /> {lec.url}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 ml-4">
                                    <button 
                                        onClick={() => setActiveVideo({ title: lec.label, url: lec.url })}
                                        className="bg-orange-600/10 hover:bg-orange-600 text-orange-500 hover:text-white px-4 py-2 rounded-lg text-xs font-bold transition"
                                    >
                                        WATCH
                                    </button>
                                    <button 
                                        onClick={() => handleDelete(lec.id)}
                                        className="p-2 text-gray-600 hover:text-red-500 transition"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            </motion.div>
                        ))
                    )}
                </div>
            </div>
        </motion.div>
    );
}
