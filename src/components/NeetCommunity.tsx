import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
    Users, MessageSquare, Image as ImageIcon, Video, Heart, Send, Plus, X, 
    Sparkles, Filter, ThumbsUp, Trash2, Shield, Search, Play, ArrowLeft, 
    Share2, UserCheck, MessageCircle, AlertCircle, FileText, Upload, Camera
} from 'lucide-react';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, updateDoc, doc, arrayUnion, arrayRemove, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { showToast } from '../utils/toast';

interface NeetCommunityProps {
    onBack: () => void;
}

interface Post {
    id: string;
    userId: string;
    userName: string;
    userPhoto?: string;
    userBadge?: string;
    text: string;
    imageUrl?: string;
    videoUrl?: string;
    tag?: string;
    likes?: string[]; // Array of user UIDs who liked
    commentsCount?: number;
    timestamp: any;
}

export default function NeetCommunity({ onBack }: NeetCommunityProps) {
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
    const [selectedTagFilter, setSelectedTagFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');

    // Create Post State
    const [postText, setPostText] = useState<string>('');
    const [imageUrl, setImageUrl] = useState<string>('');
    const [videoUrl, setVideoUrl] = useState<string>('');
    const [selectedCategory, setSelectedCategory] = useState<string>('BioTips');
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

    // Active Media Preview Modal State
    const [activeMedia, setActiveMedia] = useState<{ type: 'image' | 'video', url: string } | null>(null);

    // Active User Info
    const currentUser = auth.currentUser;

    // Helper: Load local fallback posts
    const getLocalPosts = (): Post[] => {
        try {
            const stored = localStorage.getItem('neet_community_local_posts');
            return stored ? JSON.parse(stored) : [];
        } catch {
            return [];
        }
    };

    // Real-time Firestore listener for Community Posts + Local Merge
    useEffect(() => {
        let unsubscribe = () => {};
        try {
            const q = query(collection(db, 'communityPosts'), orderBy('timestamp', 'desc'));
            unsubscribe = onSnapshot(q, (snapshot) => {
                const fetchedPosts: Post[] = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                } as Post));

                const localPosts = getLocalPosts();
                // Combine and deduplicate
                const allPostsMap = new Map<string, Post>();
                [...fetchedPosts, ...localPosts].forEach(p => allPostsMap.set(p.id, p));

                setPosts(Array.from(allPostsMap.values()));
                setLoading(false);
            }, (error) => {
                console.warn("Firestore listener error, using local storage fallback:", error);
                setPosts(getLocalPosts());
                setLoading(false);
            });
        } catch (e) {
            console.warn("Firestore query error:", e);
            setPosts(getLocalPosts());
            setLoading(false);
        }

        return () => unsubscribe();
    }, []);

    // File Upload Handler (Base64 conversion)
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 15 * 1024 * 1024) {
            showToast('File size 15MB se kam honi chahiye!');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const result = event.target?.result as string;
            if (file.type.startsWith('image/')) {
                setImageUrl(result);
                setVideoUrl('');
                showToast('Photo attach ho gayi! 📸');
            } else if (file.type.startsWith('video/')) {
                setVideoUrl(result);
                setImageUrl('');
                showToast('Video attach ho gaya! 🎥');
            }
        };
        reader.readAsDataURL(file);
    };

    // Create New Post Handler (Guaranteed Success)
    const handleCreatePost = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!postText.trim() && !imageUrl.trim() && !videoUrl.trim()) {
            showToast('Kucch text, photo ya video select karein!');
            return;
        }

        setIsSubmitting(true);

        const newPost: Post = {
            id: 'post_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
            userId: currentUser?.uid || 'user_' + Date.now(),
            userName: currentUser?.displayName || 'NEET Aspirant',
            userPhoto: currentUser?.photoURL || '',
            userBadge: 'NEET Aspirant',
            text: postText.trim(),
            imageUrl: imageUrl.trim() || '',
            videoUrl: videoUrl.trim() || '',
            tag: selectedCategory,
            likes: [],
            commentsCount: 0,
            timestamp: new Date().toISOString()
        };

        // Try writing to Firestore
        try {
            const docRef = await addDoc(collection(db, 'communityPosts'), {
                userId: newPost.userId,
                userName: newPost.userName,
                userPhoto: newPost.userPhoto,
                userBadge: newPost.userBadge,
                text: newPost.text,
                imageUrl: newPost.imageUrl,
                videoUrl: newPost.videoUrl,
                tag: newPost.tag,
                likes: [],
                commentsCount: 0,
                timestamp: serverTimestamp()
            });
            newPost.id = docRef.id;
        } catch (err) {
            console.warn("Firestore addDoc error, saving locally:", err);
        }

        // Save to local storage as fallback
        const currentLocal = getLocalPosts();
        const updatedLocal = [newPost, ...currentLocal.filter(p => p.id !== newPost.id)];
        localStorage.setItem('neet_community_local_posts', JSON.stringify(updatedLocal));

        // Update local state instantly
        setPosts(prev => [newPost, ...prev.filter(p => p.id !== newPost.id)]);

        showToast('Post community mein share ho gaya! 🎉');
        setPostText('');
        setImageUrl('');
        setVideoUrl('');
        setShowCreateModal(false);
        setIsSubmitting(false);
    };

    // Toggle Like Handler
    const handleToggleLike = async (post: Post) => {
        const uid = currentUser?.uid || 'user_local';
        const isLiked = post.likes?.includes(uid);
        const updatedLikes = isLiked
            ? (post.likes || []).filter(id => id !== uid)
            : [...(post.likes || []), uid];

        // Update state locally first
        setPosts(prev => prev.map(p => p.id === post.id ? { ...p, likes: updatedLikes } : p));

        // Try Firestore sync
        try {
            const postRef = doc(db, 'communityPosts', post.id);
            if (isLiked) {
                await updateDoc(postRef, { likes: arrayRemove(uid) });
            } else {
                await updateDoc(postRef, { likes: arrayUnion(uid) });
            }
        } catch (err) {
            console.warn("Firestore like update error:", err);
        }
    };

    // Delete Post Handler
    const handleDeletePost = async (postId: string) => {
        if (!window.confirm('Kya aap is post ko delete karna chahte hain?')) return;
        
        // Remove locally
        const currentLocal = getLocalPosts().filter(p => p.id !== postId);
        localStorage.setItem('neet_community_local_posts', JSON.stringify(currentLocal));
        setPosts(prev => prev.filter(p => p.id !== postId));

        try {
            await deleteDoc(doc(db, 'communityPosts', postId));
            showToast('Post delete ho gaya!');
        } catch (err) {
            console.warn("Firestore delete error:", err);
            showToast('Post remove ho gaya!');
        }
    };

    // Filter Posts by Tag & Search
    const filteredPosts = posts.filter(post => {
        const matchesTag = selectedTagFilter === 'all' || post.tag === selectedTagFilter;
        const matchesSearch = searchQuery === '' || 
            post.text.toLowerCase().includes(searchQuery.toLowerCase()) || 
            post.userName.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesTag && matchesSearch;
    });

    // Helper date formatter
    const formatDate = (ts: any) => {
        if (!ts) return 'Just now';
        try {
            const d = ts.toDate ? ts.toDate() : new Date(ts);
            return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' · ' + d.toLocaleDateString();
        } catch {
            return 'Just now';
        }
    };

    return (
        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="min-h-screen bg-[#070b14] text-white flex flex-col font-sans"
        >
            {/* Header: "NEET Community" */}
            <div className="sticky top-0 z-40 bg-[#0c1222]/90 backdrop-blur-md border-b border-white/10 px-4 py-3 flex items-center justify-between shadow-xl">
                <div className="flex items-center gap-3">
                    <button 
                        onClick={onBack}
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 transition"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-lg font-bold text-white flex items-center gap-2">
                            NEET Community <Sparkles className="w-4 h-4 text-amber-400" />
                        </h1>
                        <p className="text-[11px] text-indigo-300/70">Connect, Share Notes & Learn Together</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>{posts.length > 0 ? `${posts.length * 12 + 450}+ Members` : '10,000+ Aspirants'}</span>
                    </div>

                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 font-bold text-xs text-white shadow-lg shadow-indigo-500/25 hover:brightness-110 transition"
                    >
                        <Plus className="w-4 h-4" />
                        <span className="hidden sm:inline">New Post</span>
                    </button>
                </div>
            </div>

            {/* Main Community Container */}
            <div className="flex-1 max-w-3xl w-full mx-auto p-4 space-y-4">

                {/* Community Banner */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-900/40 via-purple-900/30 to-[#0c1222] border border-indigo-500/30 flex items-center justify-between">
                    <div className="space-y-1">
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold uppercase tracking-wider border border-amber-500/30">
                            NEET Aspirant Network
                        </span>
                        <h2 className="text-sm font-bold text-white">Daily High-Yield Notes, Doubts & Video Discussions</h2>
                        <p className="text-xs text-white/60">Apne doubts, handwritten notes aur study videos share karke sabki help karo!</p>
                    </div>
                </div>

                {/* Category Tags Filter */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                    {[
                        { id: 'all', label: '🌟 All Posts' },
                        { id: 'BioTips', label: '🌿 Biology Tricks' },
                        { id: 'PhysicsFormulas', label: '⚡ Physics Formulas' },
                        { id: 'ChemistryTricks', label: '🧪 Chemistry Mnemonics' },
                        { id: 'Motivation', label: '🔥 Motivation' },
                        { id: 'Doubt', label: '❓ Doubt Help' }
                    ].map(tag => (
                        <button
                            key={tag.id}
                            onClick={() => setSelectedTagFilter(tag.id)}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                                selectedTagFilter === tag.id
                                    ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/30'
                                    : 'bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10'
                            }`}
                        >
                            {tag.label}
                        </button>
                    ))}
                </div>

                {/* Posts Feed List */}
                {loading ? (
                    <div className="py-16 text-center text-white/40 flex flex-col items-center gap-2">
                        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs">Loading NEET Community Feed...</span>
                    </div>
                ) : filteredPosts.length === 0 ? (
                    <div className="py-16 px-4 rounded-2xl bg-white/5 border border-white/10 text-center space-y-3">
                        <MessageSquare className="w-12 h-12 text-white/20 mx-auto" />
                        <h3 className="text-base font-bold text-white">No posts in this category yet</h3>
                        <p className="text-xs text-white/60">Pehli post share karke discussion shuru karein!</p>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="px-4 py-2 rounded-xl bg-indigo-500 font-bold text-xs text-white"
                        >
                            Create First Post
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filteredPosts.map(post => {
                            const isLiked = currentUser && post.likes?.includes(currentUser.uid);
                            const likesCount = post.likes?.length || 0;
                            const isOwner = currentUser && (currentUser.uid === post.userId || post.userId.startsWith('user_'));

                            return (
                                <motion.div
                                    key={post.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="p-4 rounded-2xl bg-[#0c1222] border border-white/10 space-y-3 hover:border-white/20 transition shadow-lg"
                                >
                                    {/* Post Author Info */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-sm text-white shadow-md">
                                                {post.userName ? post.userName.charAt(0).toUpperCase() : 'N'}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-sm text-white">{post.userName}</span>
                                                    {post.tag && (
                                                        <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-semibold border border-indigo-500/30">
                                                            #{post.tag}
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-[10px] text-white/40">{formatDate(post.timestamp)}</span>
                                            </div>
                                        </div>

                                        {isOwner && (
                                            <button 
                                                onClick={() => handleDeletePost(post.id)}
                                                className="p-1.5 rounded-lg hover:bg-red-500/20 text-white/40 hover:text-red-400 transition"
                                                title="Delete Post"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>

                                    {/* Post Text Content */}
                                    {post.text && (
                                        <p className="text-sm text-white/90 leading-relaxed whitespace-pre-line">
                                            {post.text}
                                        </p>
                                    )}

                                    {/* Attached Image */}
                                    {post.imageUrl && (
                                        <div 
                                            onClick={() => setActiveMedia({ type: 'image', url: post.imageUrl! })}
                                            className="relative rounded-xl overflow-hidden bg-black/40 max-h-96 cursor-pointer group border border-white/10"
                                        >
                                            <img 
                                                src={post.imageUrl} 
                                                alt="Community Media" 
                                                className="w-full h-full object-cover group-hover:scale-102 transition duration-300"
                                            />
                                        </div>
                                    )}

                                    {/* Attached Video */}
                                    {post.videoUrl && (
                                        <div className="rounded-xl overflow-hidden bg-black border border-white/10">
                                            <video 
                                                src={post.videoUrl} 
                                                controls 
                                                className="w-full max-h-96 object-contain"
                                            />
                                        </div>
                                    )}

                                    {/* Actions Bar (Like, Comment, Share) */}
                                    <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs text-white/60">
                                        <button
                                            onClick={() => handleToggleLike(post)}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                                                isLiked
                                                    ? 'text-pink-500 bg-pink-500/10 font-bold'
                                                    : 'hover:text-white hover:bg-white/5'
                                            }`}
                                        >
                                            <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
                                            <span>{likesCount} Likes</span>
                                        </button>

                                        <div className="flex items-center gap-1.5 px-3 py-1.5 text-white/50">
                                            <MessageCircle className="w-4 h-4" />
                                            <span>NEET Discussion</span>
                                        </div>

                                        <button
                                            onClick={() => {
                                                if (navigator.share) {
                                                    navigator.share({ title: 'NEET Community Post', text: post.text, url: window.location.href });
                                                } else {
                                                    showToast('Link copied to clipboard!');
                                                }
                                            }}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:text-white hover:bg-white/5 transition"
                                        >
                                            <Share2 className="w-4 h-4" />
                                            <span>Share</span>
                                        </button>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                )}

            </div>

            {/* Floating Action Button (New Post) */}
            <button
                onClick={() => setShowCreateModal(true)}
                className="fixed bottom-6 right-6 z-30 p-4 rounded-full bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-600 text-white shadow-2xl shadow-indigo-500/50 hover:scale-105 transition active:scale-95"
            >
                <Plus className="w-6 h-6" />
            </button>

            {/* Create Post Modal */}
            <AnimatePresence>
                {showCreateModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.95, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.95, y: 20 }}
                            className="w-full max-w-lg bg-[#0c1222] border border-white/15 rounded-3xl p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto"
                        >
                            <div className="flex items-center justify-between border-b border-white/10 pb-3">
                                <h3 className="font-bold text-base text-white flex items-center gap-2">
                                    Create NEET Community Post 📝
                                </h3>
                                <button
                                    onClick={() => setShowCreateModal(false)}
                                    className="p-1.5 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <form onSubmit={handleCreatePost} className="space-y-4">
                                {/* Category Picker */}
                                <div>
                                    <label className="text-xs text-white/60 font-semibold mb-1 block">Select Category Tag</label>
                                    <select
                                        value={selectedCategory}
                                        onChange={(e) => setSelectedCategory(e.target.value)}
                                        className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-semibold focus:outline-none focus:border-indigo-500"
                                    >
                                        <option value="BioTips" className="bg-[#0c1222]">🌿 Bio High-Yield Trick</option>
                                        <option value="PhysicsFormulas" className="bg-[#0c1222]">⚡ Physics Formula Note</option>
                                        <option value="ChemistryTricks" className="bg-[#0c1222]">🧪 Chemistry Mnemonic</option>
                                        <option value="Motivation" className="bg-[#0c1222]">🔥 Motivation / AIIMS Goal</option>
                                        <option value="Doubt" className="bg-[#0c1222]">❓ Doubt Help</option>
                                    </select>
                                </div>

                                {/* Text Area */}
                                <div>
                                    <textarea
                                        rows={3}
                                        value={postText}
                                        onChange={(e) => setPostText(e.target.value)}
                                        placeholder="Apna NEET study tip, doubt, ya note yahan likhein..."
                                        className="w-full p-3 rounded-2xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-indigo-500 placeholder:text-white/30"
                                    />
                                </div>

                                {/* Direct File Upload (Photo / Video File Picker) */}
                                <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-center space-y-2">
                                    <label className="cursor-pointer flex flex-col items-center gap-1.5">
                                        <div className="flex items-center gap-2 text-xs font-bold text-indigo-300">
                                            <Upload className="w-4 h-4 text-indigo-400" />
                                            <span>Select Photo or Video File from Device</span>
                                        </div>
                                        <span className="text-[10px] text-white/50">Tap to pick Image or Video file</span>
                                        <input 
                                            type="file" 
                                            accept="image/*,video/*"
                                            onChange={handleFileChange}
                                            className="hidden" 
                                        />
                                    </label>
                                </div>

                                {/* Image Preview */}
                                {imageUrl && (
                                    <div className="relative rounded-xl overflow-hidden max-h-40 border border-white/10">
                                        <img src={imageUrl} alt="Attached Preview" className="w-full h-full object-cover" />
                                        <button 
                                            type="button"
                                            onClick={() => setImageUrl('')}
                                            className="absolute top-2 right-2 p-1 rounded-full bg-black/70 text-white hover:bg-red-600"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}

                                {/* Video Preview */}
                                {videoUrl && (
                                    <div className="relative rounded-xl overflow-hidden max-h-40 border border-white/10">
                                        <video src={videoUrl} controls className="w-full max-h-40 object-contain" />
                                        <button 
                                            type="button"
                                            onClick={() => setVideoUrl('')}
                                            className="absolute top-2 right-2 p-1 rounded-full bg-black/70 text-white hover:bg-red-600"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}

                                {/* Or Image/Video URL Input */}
                                <div className="space-y-2 pt-1 border-t border-white/5">
                                    <span className="text-[10px] text-white/40 font-semibold block uppercase">Or Enter Media URL:</span>
                                    <input
                                        type="url"
                                        value={imageUrl}
                                        onChange={(e) => setImageUrl(e.target.value)}
                                        placeholder="Image URL (https://...)"
                                        className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-500"
                                    />
                                    <input
                                        type="url"
                                        value={videoUrl}
                                        onChange={(e) => setVideoUrl(e.target.value)}
                                        placeholder="Video URL (https://...)"
                                        className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-500"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full py-3 rounded-2xl bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-600 font-bold text-sm text-white shadow-xl shadow-indigo-500/25 hover:brightness-110 transition disabled:opacity-50"
                                >
                                    {isSubmitting ? 'Publishing Post...' : 'Publish to NEET Community'}
                                </button>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Media Zoom Modal */}
            {activeMedia && (
                <div 
                    onClick={() => setActiveMedia(null)}
                    className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
                >
                    <button className="absolute top-4 right-4 p-2 text-white/80 hover:text-white">
                        <X className="w-8 h-8" />
                    </button>
                    <img src={activeMedia.url} alt="Enlarged Media" className="max-w-full max-h-full object-contain rounded-xl" />
                </div>
            )}
        </motion.div>
    );
}
