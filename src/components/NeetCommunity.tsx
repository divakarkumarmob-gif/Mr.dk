import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
    Users, MessageSquare, Image as ImageIcon, Video, Heart, Send, Plus, X, 
    Sparkles, Filter, ThumbsUp, Trash2, Shield, Search, Play, ArrowLeft, 
    Share2, UserCheck, MessageCircle, AlertCircle, FileText, Upload, Camera, Eye, 
    CornerDownRight, DoorOpen, Radio, Home, Flag
} from 'lucide-react';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, updateDoc, doc, arrayUnion, arrayRemove, deleteDoc, increment } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { showToast } from '../utils/toast';
import StudyRoomChat, { StudyRoom, RoomMode } from './StudyRoomChat';
import DirectChat, { DirectUser } from './DirectChat';

interface NeetCommunityProps {
    onBack: () => void;
}

interface CommentItem {
    id: string;
    userName: string;
    text: string;
    timestamp: any;
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
    viewsCount?: number; // Real Unique Views Tracker
    viewedBy?: string[]; // Array of unique viewer IDs
    roomData?: StudyRoom; // Embedded Study Room data if post is a room invite
    timestamp: any;
}

export default function NeetCommunity({ onBack }: NeetCommunityProps) {
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
    const [showCreateRoomModal, setShowCreateRoomModal] = useState<boolean>(false);
    const [selectedTagFilter, setSelectedTagFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');

    // Active Live Room State (When user joins a room)
    const [activeRoom, setActiveRoom] = useState<StudyRoom | null>(null);

    // Active 1v1 Direct Chat User State
    const [activeDirectChatUser, setActiveDirectChatUser] = useState<DirectUser | null>(null);

    // Create Room State
    const [roomName, setRoomName] = useState<string>('');
    const [roomTopic, setRoomTopic] = useState<string>('Physics');
    const [roomDescription, setRoomDescription] = useState<string>('');
    const [roomMaxMembers, setRoomMaxMembers] = useState<number>(50);
    const [roomMode, setRoomMode] = useState<RoomMode>('doubt_solving');
    const [roomExpiryOption, setRoomExpiryOption] = useState<string>('none');

    // Create Post State
    const [postText, setPostText] = useState<string>('');
    const [imageUrl, setImageUrl] = useState<string>('');
    const [videoUrl, setVideoUrl] = useState<string>('');
    const [selectedCategory, setSelectedCategory] = useState<string>('BioTips');
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

    // Comments Section State
    const [openCommentPostId, setOpenCommentPostId] = useState<string | null>(null);
    const [commentInputMap, setCommentInputMap] = useState<Record<string, string>>({});
    const [postCommentsMap, setPostCommentsMap] = useState<Record<string, CommentItem[]>>({});

    // Active Media Preview Modal State
    const [activeMedia, setActiveMedia] = useState<{ type: 'image' | 'video', url: string } | null>(null);

    // User Profile Quick Modal & Report System State
    const [selectedUserProfile, setSelectedUserProfile] = useState<{
        userId: string;
        userName: string;
        userPhoto?: string;
        userBadge?: string;
        postId?: string;
    } | null>(null);

    const [showReportModal, setShowReportModal] = useState<boolean>(false);
    const [reportReason, setReportReason] = useState<string>('');

    // Active User Info
    const currentUser = auth.currentUser;

    // Session ref to avoid duplicate calls in same render loop
    const viewedPostsRef = useRef<Set<string>>(new Set());

    // Persistent Unique Device / User ID generator
    const getViewerId = (): string => {
        if (currentUser?.uid) return currentUser.uid;
        let stored = localStorage.getItem('neet_unique_viewer_id');
        if (!stored) {
            stored = 'viewer_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
            localStorage.setItem('neet_unique_viewer_id', stored);
        }
        return stored;
    };

    // Check if post was already viewed by this unique user/device
    const hasAlreadyViewedPost = (postId: string): boolean => {
        const viewerId = getViewerId();
        try {
            const viewedMap = JSON.parse(localStorage.getItem('neet_viewed_posts_history') || '{}');
            return !!viewedMap[postId + '_' + viewerId];
        } catch {
            return false;
        }
    };

    // Mark post as viewed persistently in history
    const markPostAsViewedInHistory = (postId: string) => {
        const viewerId = getViewerId();
        try {
            const viewedMap = JSON.parse(localStorage.getItem('neet_viewed_posts_history') || '{}');
            viewedMap[postId + '_' + viewerId] = true;
            localStorage.setItem('neet_viewed_posts_history', JSON.stringify(viewedMap));
        } catch {}
    };

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

    // Strict Unique Views Counter Trigger (No Repeated Counting for Same User)
    useEffect(() => {
        if (posts.length === 0) return;

        posts.forEach(post => {
            if (!viewedPostsRef.current.has(post.id)) {
                viewedPostsRef.current.add(post.id);
                recordPostView(post.id, post);
            }
        });
    }, [posts]);

    const recordPostView = async (postId: string, postObj?: Post) => {
        const viewerId = getViewerId();

        // STRICT DEDUPLICATION: If already viewed by this user/device, DO NOT count again!
        if (hasAlreadyViewedPost(postId) || (postObj?.viewedBy && postObj.viewedBy.includes(viewerId))) {
            return;
        }

        // Record persistently in history so future re-opens also don't recount
        markPostAsViewedInHistory(postId);

        // Optimistic local update (+1 for new unique user)
        setPosts(prev => prev.map(p => {
            if (p.id === postId) {
                const currentViews = p.viewsCount || 0;
                const currentViewers = p.viewedBy || [];
                return { ...p, viewsCount: currentViews + 1, viewedBy: [...currentViewers, viewerId] };
            }
            return p;
        }));

        // LocalStorage fallback update
        try {
            const localPosts: Post[] = getLocalPosts();
            const updatedLocal = localPosts.map(p => {
                if (p.id === postId) {
                    const currentViews = p.viewsCount || 0;
                    const currentViewers = p.viewedBy || [];
                    return { ...p, viewsCount: currentViews + 1, viewedBy: [...currentViewers, viewerId] };
                }
                return p;
            });
            localStorage.setItem('neet_community_local_posts', JSON.stringify(updatedLocal));
        } catch {}

        // Firestore sync with atomic arrayUnion & increment
        try {
            const postRef = doc(db, 'communityPosts', postId);
            await updateDoc(postRef, {
                viewedBy: arrayUnion(viewerId),
                viewsCount: increment(1)
            });
        } catch (e) {
            console.warn("Firestore unique view increment error:", e);
        }
    };

    // Create New Custom Study Room Handler
    const handleCreateStudyRoom = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!roomName.trim()) {
            showToast('Study Room ka naam likhein!');
            return;
        }

        setIsSubmitting(true);
        const hostUid = currentUser?.uid || 'user_host_' + Date.now();
        const hostName = currentUser?.displayName || 'NEET Aspirant';

        let expiresAt: string | null = null;
        if (roomExpiryOption === '1_hour') {
            expiresAt = new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString();
        } else if (roomExpiryOption === '3_hours') {
            expiresAt = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
        } else if (roomExpiryOption === '6_hours') {
            expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
        } else if (roomExpiryOption === '24_hours') {
            expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        }

        const roomObj: StudyRoom = {
            id: 'room_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
            name: roomName.trim(),
            topic: roomTopic,
            description: roomDescription.trim() || 'Live study & doubt room for NEET aspirants!',
            hostId: hostUid,
            hostName: hostName,
            members: [hostUid],
            blockedUsers: [],
            maxMembers: roomMaxMembers,
            roomMode: roomMode,
            expiryOption: roomExpiryOption,
            expiresAt: expiresAt,
            isClosed: false,
            createdAt: new Date().toISOString()
        };

        // Save Room to Firestore
        try {
            const docRef = await addDoc(collection(db, 'studyRooms'), {
                name: roomObj.name,
                topic: roomObj.topic,
                description: roomObj.description,
                hostId: roomObj.hostId,
                hostName: roomObj.hostName,
                members: [hostUid],
                blockedUsers: [],
                maxMembers: roomMaxMembers,
                roomMode: roomMode,
                expiryOption: roomExpiryOption,
                expiresAt: expiresAt,
                isClosed: false,
                createdAt: serverTimestamp()
            });
            roomObj.id = docRef.id;
        } catch (err) {
            console.warn("Firestore studyRoom creation fallback:", err);
        }

        // Post Room Announcement into NEET Community feed
        const roomPost: Post = {
            id: 'post_room_' + Date.now(),
            userId: hostUid,
            userName: hostName,
            text: `🔴 Live Study Room Open: "${roomObj.name}"! Join karke physics, bio & chemistry doubts solve karein!`,
            tag: roomObj.topic,
            roomData: roomObj,
            likes: [],
            commentsCount: 0,
            viewsCount: 1,
            viewedBy: [getViewerId()],
            timestamp: new Date().toISOString()
        };

        // Save Post locally
        const currentLocal = getLocalPosts();
        localStorage.setItem('neet_community_local_posts', JSON.stringify([roomPost, ...currentLocal]));
        setPosts(prev => [roomPost, ...prev]);

        // Publish to Firestore communityPosts
        try {
            await addDoc(collection(db, 'communityPosts'), {
                userId: roomPost.userId,
                userName: roomPost.userName,
                text: roomPost.text,
                tag: roomPost.tag,
                roomData: roomObj,
                likes: [],
                commentsCount: 0,
                viewsCount: 1,
                viewedBy: [getViewerId()],
                timestamp: serverTimestamp()
            });
        } catch {}

        showToast('Study Room ban gaya! 🚀 Join button par tap karein.');
        setRoomName('');
        setRoomDescription('');
        setShowCreateRoomModal(false);
        setIsSubmitting(false);

        // Open Room Chat directly for Host
        setActiveRoom(roomObj);
    };

    // Join Room Handler with Block & Expiry Check
    const handleJoinRoom = (roomData: StudyRoom) => {
        const viewerId = getViewerId();

        if (roomData.blockedUsers?.includes(viewerId) || roomData.blockedUsers?.includes(currentUser?.uid || '')) {
            showToast('⚠️ Host (Admin) ne aapko is study room se block kiya hai!');
            return;
        }

        const isExpired = roomData.expiresAt ? new Date(roomData.expiresAt).getTime() <= Date.now() : false;
        if (roomData.isClosed || isExpired) {
            showToast('🔴 Is room ko close kar diya gaya hai. Read-only mode mein open ho raha hai.');
        }

        // Open Room Chat (StudyRoomChat handles read-only lock if room is closed)
        setActiveRoom(roomData);
    };

    // Load comments for a post
    const toggleCommentsForPost = (postId: string) => {
        if (openCommentPostId === postId) {
            setOpenCommentPostId(null);
            return;
        }

        setOpenCommentPostId(postId);

        // Load local comments fallback
        try {
            const stored = localStorage.getItem('neet_community_comments_' + postId);
            if (stored) {
                setPostCommentsMap(prev => ({ ...prev, [postId]: JSON.parse(stored) }));
            }
        } catch {}

        // Listen to Firestore comments subcollection
        try {
            const q = query(collection(db, 'communityPosts', postId, 'comments'), orderBy('timestamp', 'asc'));
            onSnapshot(q, (snapshot) => {
                const fetchedComments: CommentItem[] = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                } as CommentItem));
                
                if (fetchedComments.length > 0) {
                    setPostCommentsMap(prev => ({ ...prev, [postId]: fetchedComments }));
                }
            });
        } catch (e) {
            console.warn("Firestore comments fetch error:", e);
        }
    };

    // Add Comment Handler
    const handleAddComment = async (postId: string) => {
        const text = commentInputMap[postId]?.trim();
        if (!text) {
            showToast('Comment text likhein!');
            return;
        }

        const newComment: CommentItem = {
            id: 'comment_' + Date.now(),
            userName: currentUser?.displayName || 'NEET Aspirant',
            text: text,
            timestamp: new Date().toISOString()
        };

        // Update local state for comments
        const currentComments = postCommentsMap[postId] || [];
        const updatedComments = [...currentComments, newComment];
        setPostCommentsMap(prev => ({ ...prev, [postId]: updatedComments }));

        // Update comment count on post
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, commentsCount: (p.commentsCount || 0) + 1 } : p));

        // Clear input field
        setCommentInputMap(prev => ({ ...prev, [postId]: '' }));

        // Save to LocalStorage fallback
        try {
            localStorage.setItem('neet_community_comments_' + postId, JSON.stringify(updatedComments));
        } catch {}

        showToast('Comment add ho gaya! 💬');

        // Try Firestore write
        try {
            await addDoc(collection(db, 'communityPosts', postId, 'comments'), {
                userName: newComment.userName,
                text: newComment.text,
                timestamp: serverTimestamp()
            });
            await updateDoc(doc(db, 'communityPosts', postId), {
                commentsCount: increment(1)
            });
        } catch (e) {
            console.warn("Firestore comment add error:", e);
        }
    };

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
        const viewerId = getViewerId();

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
            viewsCount: 1, // Author's first view
            viewedBy: [viewerId],
            timestamp: new Date().toISOString()
        };

        // Mark in persistent history for author
        viewedPostsRef.current.add(newPost.id);
        markPostAsViewedInHistory(newPost.id);

        // Try writing to Firestore for permanent cloud storage across app reinstalls
        try {
            const docRef = await addDoc(collection(db, 'communityPosts'), {
                userId: newPost.userId || 'anonymous',
                userName: newPost.userName || 'NEET Aspirant',
                userPhoto: newPost.userPhoto || '',
                userBadge: newPost.userBadge || 'NEET Aspirant',
                text: newPost.text || '',
                imageUrl: newPost.imageUrl || '',
                videoUrl: newPost.videoUrl || '',
                tag: newPost.tag || 'BioTips',
                likes: [],
                commentsCount: 0,
                viewsCount: 1,
                viewedBy: [viewerId],
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

    // Delete Post Handler (If Room Post, warns Admin and Purges all Room Data & Messages)
    const handleDeletePost = async (post: Post) => {
        const isRoom = !!post.roomData;
        const confirmMsg = isRoom
            ? '⚠️ WARNING: Is Room Post ko delete karne se is study room ki saari CHATS, VOICE NOTES, PHOTOS aur DATA hamesha ke liye PERMANENTLY DELETE ho jayega! Kya aap ise delete karna chahte hain?'
            : 'Kya aap is post ko delete karna chahte hain?';

        if (!window.confirm(confirmMsg)) return;

        // Remove locally
        const currentLocal = getLocalPosts().filter(p => p.id !== post.id);
        localStorage.setItem('neet_community_local_posts', JSON.stringify(currentLocal));
        setPosts(prev => prev.filter(p => p.id !== post.id));

        if (isRoom && post.roomData) {
            try {
                localStorage.removeItem('study_room_msgs_' + post.roomData.id);
            } catch {}
        }

        try {
            await deleteDoc(doc(db, 'communityPosts', post.id));
            if (isRoom && post.roomData) {
                await deleteDoc(doc(db, 'studyRooms', post.roomData.id));
            }
            showToast(isRoom ? 'Study Room aur sara data permanently delete ho gaya! 🗑️' : 'Post delete ho gaya!');
        } catch (err) {
            console.warn("Firestore delete error:", err);
            showToast('Post remove ho gaya!');
        }
    };

    // Report User to Real App Admin Handler
    const handleReportUser = async () => {
        if (!selectedUserProfile) return;
        if (!reportReason.trim()) {
            showToast('Report ka reason likhein!');
            return;
        }

        const reporterUid = currentUser?.uid || getViewerId();
        const reporterName = currentUser?.displayName || 'NEET Aspirant';

        const reportData = {
            reportedUserId: selectedUserProfile.userId,
            reportedUserName: selectedUserProfile.userName,
            reporterUserId: reporterUid,
            reporterUserName: reporterName,
            reason: reportReason.trim(),
            postId: selectedUserProfile.postId || '',
            timestamp: serverTimestamp(),
            status: 'pending'
        };

        // Save Report to Firestore userReports collection
        try {
            await addDoc(collection(db, 'userReports'), reportData);
        } catch (e) {
            console.warn("Firestore userReports fallback:", e);
        }

        // Send Alert Notification directly to Real App Admin Dashboard
        try {
            await addDoc(collection(db, 'adminNotifications'), {
                type: 'user_reported',
                title: '🚨 User Reported by Community Member',
                message: `User "${selectedUserProfile.userName}" ko "${reporterName}" dwara report kiya gaya hai. Reason: "${reportReason.trim()}"`,
                reportedUser: selectedUserProfile.userName,
                reportedBy: reporterName,
                timestamp: serverTimestamp()
            });
        } catch (e) {}

        showToast(`User "${selectedUserProfile.userName}" ki report App Admin ko bhej di gayi hai! 🚨`);
        setShowReportModal(false);
        setReportReason('');
        setSelectedUserProfile(null);
    };

    // Filter Posts by Tag & Search
    const filteredPosts = posts.filter(post => {
        let matchesTag = false;
        const myUid = currentUser?.uid || 'user_host_';

        if (selectedTagFilter === 'all') {
            matchesTag = true;
        } else if (selectedTagFilter === 'rooms') {
            matchesTag = !!post.roomData;
        } else if (selectedTagFilter === 'myRooms') {
            // Show rooms created by current user / admin
            matchesTag = !!post.roomData && (
                post.roomData.hostId === myUid || 
                post.userId === myUid ||
                (myUid.startsWith('user_') && post.userId.startsWith('user_')) ||
                (myUid.startsWith('user_') && post.roomData.hostId.startsWith('user_'))
            );
        } else {
            matchesTag = post.tag === selectedTagFilter;
        }

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

    // Render Live Study Room View if active
    if (activeRoom) {
        return <StudyRoomChat room={activeRoom} onBack={() => setActiveRoom(null)} />;
    }

    // Render 1v1 Direct Private Chat View if active
    if (activeDirectChatUser) {
        return <DirectChat targetUser={activeDirectChatUser} onBack={() => setActiveDirectChatUser(null)} />;
    }

    return (
        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="min-h-screen bg-[#070b14] text-white flex flex-col font-sans"
        >
            {/* Header: "NEET Community" */}
            <div className="sticky top-0 z-40 bg-[#0c1222]/95 backdrop-blur-md border-b border-white/10 px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2 shadow-xl overflow-hidden">
                <div className="flex items-center gap-2 shrink-0">
                    <button 
                        onClick={onBack}
                        className="p-1.5 sm:p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 transition"
                    >
                        <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                    <div>
                        <h1 className="text-sm sm:text-lg font-bold text-white flex items-center gap-1">
                            NEET Community <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
                        </h1>
                        <p className="text-[10px] sm:text-[11px] text-indigo-300/70 hidden sm:block">Connect, Share Notes & Learn Together</p>
                    </div>
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                    <button
                        onClick={() => setSelectedTagFilter('myRooms')}
                        className={`flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl font-bold text-[11px] sm:text-xs transition ${
                            selectedTagFilter === 'myRooms'
                                ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/30 font-extrabold'
                                : 'bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30'
                        }`}
                        title="My Created Rooms"
                    >
                        <Shield className="w-3.5 h-3.5 text-amber-400" />
                        <span className="hidden xs:inline sm:inline">My Rooms</span>
                    </button>

                    <button
                        onClick={() => setShowCreateRoomModal(true)}
                        className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 font-bold text-[11px] sm:text-xs hover:bg-indigo-500/30 transition"
                        title="Create Study Room"
                    >
                        <Radio className="w-3.5 h-3.5 text-red-400 animate-pulse" />
                        <span className="hidden sm:inline">Create Room</span>
                    </button>

                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 font-bold text-[11px] sm:text-xs text-white shadow-lg shadow-indigo-500/25 hover:brightness-110 transition"
                        title="Create New Post"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        <span className="hidden xs:inline sm:inline">New Post</span>
                    </button>
                </div>
            </div>

            {/* Main Community Container */}
            <div className="flex-1 max-w-3xl w-full mx-auto px-3 sm:px-4 py-4 pb-28 space-y-4">

                {/* Community Banner */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-900/40 via-purple-900/30 to-[#0c1222] border border-indigo-500/30 flex items-center justify-between">
                    <div className="space-y-1">
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold uppercase tracking-wider border border-amber-500/30">
                            NEET Aspirant Network
                        </span>
                        <h2 className="text-sm font-bold text-white">Daily High-Yield Notes, Doubts & Live Group Rooms</h2>
                        <p className="text-xs text-white/60">Apne study rooms banao, members ko join/remove/block karo aur doubts solve karo!</p>
                    </div>
                </div>

                {/* Category Tags Filter */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                    {[
                        { id: 'all', label: '🌟 All Posts' },
                        { id: 'myRooms', label: '👑 My Rooms' },
                        { id: 'rooms', label: '📻 All Live Rooms' },
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
                            const commentsCount = post.commentsCount || (postCommentsMap[post.id]?.length || 0);
                            const viewsCount = post.viewsCount || 1;
                            const isOwner = currentUser && (currentUser.uid === post.userId || post.userId.startsWith('user_'));
                            const isCommentsOpen = openCommentPostId === post.id;
                            const postComments = postCommentsMap[post.id] || [];

                            return (
                                <motion.div
                                    key={post.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="p-4 rounded-2xl bg-[#0c1222] border border-white/10 space-y-3 hover:border-white/20 transition shadow-lg"
                                >
                                    {/* Post Author Info */}
                                    <div className="flex items-center justify-between">
                                        <div 
                                            onClick={() => setSelectedUserProfile({
                                                userId: post.userId,
                                                userName: post.userName,
                                                userPhoto: post.userPhoto,
                                                userBadge: post.userBadge,
                                                postId: post.id
                                            })}
                                            className="flex items-center gap-3 cursor-pointer group/user"
                                            title="Click to view profile & report user"
                                        >
                                            {post.userPhoto ? (
                                                <img 
                                                    src={post.userPhoto} 
                                                    alt={post.userName} 
                                                    className="w-10 h-10 rounded-full object-cover border border-white/20 group-hover/user:border-indigo-400 transition" 
                                                />
                                            ) : (
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-sm text-white shadow-md group-hover/user:scale-105 transition">
                                                    {post.userName ? post.userName.charAt(0).toUpperCase() : 'N'}
                                                </div>
                                            )}
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-sm text-white group-hover/user:text-indigo-300 transition">{post.userName}</span>
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
                                                onClick={() => handleDeletePost(post)}
                                                className="p-1.5 rounded-lg hover:bg-red-500/20 text-white/40 hover:text-red-400 transition"
                                                title="Delete Post & Room Data"
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

                                    {/* Embedded Live Study Room Join Card if post is a Room */}
                                    {post.roomData && (
                                        <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-indigo-950 to-purple-950 border border-indigo-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xl my-2">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <Radio className="w-4 h-4 text-red-400 animate-pulse shrink-0" />
                                                    <span className="font-bold text-sm text-white">{post.roomData.name}</span>
                                                </div>
                                                <p className="text-xs text-indigo-200/80">{post.roomData.description}</p>
                                                <span className="text-[10px] text-emerald-400 font-semibold block">
                                                    {post.roomData.members?.length || 1} Members Active in Chat
                                                </span>
                                            </div>

                                            <button
                                                onClick={() => handleJoinRoom(post.roomData!)}
                                                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 font-bold text-xs text-white shadow-lg hover:brightness-110 transition flex items-center justify-center gap-1.5 shrink-0"
                                            >
                                                <DoorOpen className="w-4 h-4" />
                                                <span>Join Room</span>
                                            </button>
                                        </div>
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

                                    {/* Actions Bar (Likes, Comments, Unique Views, Share) */}
                                    <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs text-white/60">
                                        {/* Likes Button */}
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

                                        {/* Comments Button */}
                                        <button
                                            onClick={() => toggleCommentsForPost(post.id)}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                                                isCommentsOpen
                                                    ? 'text-indigo-400 bg-indigo-500/20 font-bold'
                                                    : 'hover:text-white hover:bg-white/5'
                                            }`}
                                        >
                                            <MessageCircle className="w-4 h-4" />
                                            <span>{commentsCount} Comments</span>
                                        </button>

                                        {/* Strict Unique Views Counter Pill */}
                                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 font-semibold text-xs" title="Unique Viewers Count">
                                            <Eye className="w-3.5 h-3.5 text-indigo-400" />
                                            <span>{viewsCount} Unique Views</span>
                                        </div>

                                        {/* Share Button */}
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

                                    {/* Expandable Comments Drawer Section */}
                                    <AnimatePresence>
                                        {isCommentsOpen && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                className="pt-3 border-t border-white/10 space-y-3 overflow-hidden"
                                            >
                                                <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                                                    <MessageSquare className="w-3.5 h-3.5" />
                                                    <span>NEET Community Discussion ({postComments.length})</span>
                                                </h4>

                                                {/* Comments List */}
                                                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                                                    {postComments.length === 0 ? (
                                                        <p className="text-xs text-white/40 italic">Koi comment nahi hai abhi. Pehla comment aap karo!</p>
                                                    ) : (
                                                        postComments.map(c => (
                                                            <div key={c.id} className="p-2.5 rounded-xl bg-white/5 border border-white/5 space-y-1">
                                                                <div className="flex items-center justify-between text-[11px]">
                                                                    <span className="font-bold text-indigo-300">{c.userName}</span>
                                                                    <span className="text-white/40 text-[9px]">{formatDate(c.timestamp)}</span>
                                                                </div>
                                                                <p className="text-xs text-white/80 leading-snug">{c.text}</p>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>

                                                {/* Add Comment Input Box */}
                                                <div className="flex items-center gap-2 pt-1">
                                                    <input
                                                        type="text"
                                                        value={commentInputMap[post.id] || ''}
                                                        onChange={(e) => setCommentInputMap({ ...commentInputMap, [post.id]: e.target.value })}
                                                        onKeyDown={(e) => { if (e.key === 'Enter') handleAddComment(post.id); }}
                                                        placeholder="Apna comment ya doubt yahan likhein..."
                                                        className="flex-1 p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-indigo-500 placeholder:text-white/30"
                                                    />
                                                    <button
                                                        onClick={() => handleAddComment(post.id)}
                                                        className="p-2.5 rounded-xl bg-indigo-500 text-white font-bold hover:bg-indigo-600 transition"
                                                    >
                                                        <Send className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                </motion.div>
                            );
                        })}
                    </div>
                )}

            </div>

            {/* Floating Action Buttons */}
            <div className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-30 flex flex-col gap-2.5 items-end">
                <button
                    onClick={() => setShowCreateRoomModal(true)}
                    title="Create Live Study Room"
                    className="p-3.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-xl shadow-emerald-500/30 hover:scale-110 transition active:scale-95 border border-emerald-400/40"
                >
                    <DoorOpen className="w-6 h-6 text-white" />
                </button>

                <button
                    onClick={() => setShowCreateModal(true)}
                    title="Create Post"
                    className="p-4 rounded-full bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-600 text-white shadow-2xl shadow-indigo-500/50 hover:scale-110 transition active:scale-95"
                >
                    <Plus className="w-6 h-6" />
                </button>
            </div>

            {/* Create Room Modal */}
            <AnimatePresence>
                {showCreateRoomModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.95, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.95, y: 20 }}
                            className="w-full max-w-lg bg-[#0c1222] border border-white/15 rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto"
                        >
                            <div className="flex items-center justify-between border-b border-white/10 pb-3">
                                <h3 className="font-bold text-base text-white flex items-center gap-2">
                                    Create Live Study Room 🚀
                                </h3>
                                <button
                                    onClick={() => setShowCreateRoomModal(false)}
                                    className="p-1.5 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <form onSubmit={handleCreateStudyRoom} className="space-y-4">
                                <div>
                                    <label className="text-xs text-white/60 font-semibold mb-1 block">Study Room Name</label>
                                    <input
                                        type="text"
                                        value={roomName}
                                        onChange={(e) => setRoomName(e.target.value)}
                                        placeholder="e.g. Physics Optics Doubts & Problem Solving"
                                        className="w-full p-3 rounded-2xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-indigo-500"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="text-xs text-white/60 font-semibold mb-1 block">Subject Tag</label>
                                    <select
                                        value={roomTopic}
                                        onChange={(e) => setRoomTopic(e.target.value)}
                                        className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-semibold focus:outline-none focus:border-indigo-500"
                                    >
                                        <option value="Physics" className="bg-[#0c1222]">⚡ Physics</option>
                                        <option value="Chemistry" className="bg-[#0c1222]">🧪 Chemistry</option>
                                        <option value="Biology" className="bg-[#0c1222]">🌿 Biology</option>
                                        <option value="General" className="bg-[#0c1222]">📚 General Discussion</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="text-xs text-white/60 font-semibold mb-1 block">Select Room Purpose / Mode</label>
                                    <select
                                        value={roomMode}
                                        onChange={(e) => setRoomMode(e.target.value as RoomMode)}
                                        className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-semibold focus:outline-none focus:border-indigo-500"
                                    >
                                        <option value="doubt_solving" className="bg-[#0c1222]">🔴 Live Doubt Solving Mode</option>
                                        <option value="silent_study" className="bg-[#0c1222]">📖 Silent Group Study Mode</option>
                                        <option value="mcq_battle" className="bg-[#0c1222]">🧪 MCQ Speed Battle Mode</option>
                                        <option value="general" className="bg-[#0c1222]">📚 General Discussion Mode</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="text-xs text-white/60 font-semibold mb-1 block">Room Description</label>
                                    <textarea
                                        rows={2}
                                        value={roomDescription}
                                        onChange={(e) => setRoomDescription(e.target.value)}
                                        placeholder="Room purpose and rules..."
                                        className="w-full p-3 rounded-2xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-500"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs text-white/60 font-semibold mb-1 block">Max Members Capacity Limit</label>
                                    <select
                                        value={roomMaxMembers}
                                        onChange={(e) => setRoomMaxMembers(parseInt(e.target.value))}
                                        className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-semibold focus:outline-none focus:border-indigo-500"
                                    >
                                        <option value={5} className="bg-[#0c1222]">5 Members (Small Focus Group)</option>
                                        <option value={10} className="bg-[#0c1222]">10 Members (Intimate Group)</option>
                                        <option value={25} className="bg-[#0c1222]">25 Members (Classroom Group)</option>
                                        <option value={50} className="bg-[#0c1222]">50 Members (Standard Room)</option>
                                        <option value={100} className="bg-[#0c1222]">100 Members (Large Batch)</option>
                                        <option value={500} className="bg-[#0c1222]">500 Members (Mega Seminar)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="text-xs text-white/60 font-semibold mb-1 block">Room Expiry Duration (Countdown Timer)</label>
                                    <select
                                        value={roomExpiryOption}
                                        onChange={(e) => setRoomExpiryOption(e.target.value)}
                                        className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-semibold focus:outline-none focus:border-indigo-500"
                                    >
                                        <option value="none" className="bg-[#0c1222]">♾️ None (No Expiry - Runs until closed by Admin)</option>
                                        <option value="1_hour" className="bg-[#0c1222]">⏱️ 1 Hour Expiry</option>
                                        <option value="3_hours" className="bg-[#0c1222]">⏱️ 3 Hours Expiry</option>
                                        <option value="6_hours" className="bg-[#0c1222]">⏱️ 6 Hours Expiry</option>
                                        <option value="24_hours" className="bg-[#0c1222]">⏱️ 24 Hours Expiry</option>
                                    </select>
                                </div>

                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 font-bold text-sm text-white shadow-xl hover:brightness-110 transition disabled:opacity-50"
                                >
                                    {isSubmitting ? 'Creating Room...' : 'Launch Live Study Room'}
                                </button>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

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

            {/* User Profile Quick View Modal */}
            <AnimatePresence>
                {selectedUserProfile && (
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
                            className="w-full max-w-sm bg-[#0c1222] border border-white/15 rounded-3xl p-6 space-y-5 text-center shadow-2xl relative"
                        >
                            <button
                                onClick={() => setSelectedUserProfile(null)}
                                className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition"
                            >
                                <X className="w-5 h-5" />
                            </button>

                            {/* User Avatar */}
                            <div className="mx-auto w-20 h-20 rounded-full overflow-hidden border-2 border-indigo-500 shadow-xl flex items-center justify-center bg-gradient-to-tr from-indigo-500 to-purple-600 font-bold text-2xl text-white">
                                {selectedUserProfile.userPhoto ? (
                                    <img src={selectedUserProfile.userPhoto} alt={selectedUserProfile.userName} className="w-full h-full object-cover" />
                                ) : (
                                    selectedUserProfile.userName ? selectedUserProfile.userName.charAt(0).toUpperCase() : 'N'
                                )}
                            </div>

                            {/* User Name & Badge */}
                            <div>
                                <h3 className="font-bold text-lg text-white">{selectedUserProfile.userName}</h3>
                                <span className="px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold border border-indigo-500/30 inline-block mt-1">
                                    {selectedUserProfile.userBadge || 'NEET Aspirant 🌟'}
                                </span>
                            </div>

                            {/* Actions: Send Message & Report User */}
                            <div className="space-y-2 pt-2 border-t border-white/10">
                                <button
                                    onClick={() => {
                                        setActiveDirectChatUser({
                                            uid: selectedUserProfile.userId,
                                            name: selectedUserProfile.userName,
                                            photoURL: selectedUserProfile.userPhoto,
                                            badge: selectedUserProfile.userBadge
                                        });
                                        setSelectedUserProfile(null);
                                    }}
                                    className="w-full py-2.5 rounded-xl bg-indigo-500 font-bold text-xs text-white hover:bg-indigo-600 transition flex items-center justify-center gap-2"
                                >
                                    <MessageSquare className="w-4 h-4" />
                                    <span>Send Direct Message (1v1 Private Chat)</span>
                                </button>

                                <button
                                    onClick={() => setShowReportModal(true)}
                                    className="w-full py-2.5 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 font-bold text-xs hover:bg-red-500/30 transition flex items-center justify-center gap-2"
                                >
                                    <Flag className="w-4 h-4 text-red-400" />
                                    <span>Report User to Real App Admin</span>
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Report User Modal */}
            <AnimatePresence>
                {showReportModal && selectedUserProfile && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.95 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0.95 }}
                            className="w-full max-w-md bg-[#0c1222] border border-red-500/40 rounded-3xl p-6 space-y-4 shadow-2xl"
                        >
                            <div className="flex items-center justify-between border-b border-white/10 pb-3">
                                <h3 className="font-bold text-base text-red-400 flex items-center gap-2">
                                    <AlertCircle className="w-5 h-5" />
                                    <span>Report User to Real App Admin</span>
                                </h3>
                                <button onClick={() => setShowReportModal(false)} className="p-1 text-white/60 hover:text-white">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <p className="text-xs text-white/70">
                                Aap <strong>"{selectedUserProfile.userName}"</strong> ko report kar rahe hain. Real App Admin is report ko review karega.
                            </p>

                            <div>
                                <label className="text-xs text-white/60 font-semibold mb-1 block">Report Reason</label>
                                <textarea
                                    rows={3}
                                    value={reportReason}
                                    onChange={(e) => setReportReason(e.target.value)}
                                    placeholder="Abusive language, fake notes, spam, etc..."
                                    className="w-full p-3 rounded-2xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-red-500"
                                    required
                                />
                            </div>

                            <div className="flex items-center gap-2 pt-2">
                                <button
                                    onClick={() => setShowReportModal(false)}
                                    className="flex-1 py-2.5 rounded-xl bg-white/10 font-bold text-xs text-white"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleReportUser}
                                    className="flex-1 py-2.5 rounded-xl bg-red-600 font-bold text-xs text-white hover:bg-red-700 transition flex items-center justify-center gap-1.5"
                                >
                                    <Flag className="w-4 h-4" />
                                    <span>Submit Report to Admin</span>
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
