import React, { useState, useRef } from 'react';
import { ChevronLeft, Camera, User, Mail, Phone, Book, GraduationCap, Save, Trash2, X } from 'lucide-react';
import { User as FirebaseUser, updateProfile, updateEmail, deleteUser } from 'firebase/auth';
import { storage, db } from '../lib/firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { doc, updateDoc } from 'firebase/firestore';

export default function EditProfile({ user, onNavigate }: { user: FirebaseUser | null, onNavigate: (view: 'home' | 'study' | 'profile' | 'editProfile') => void }) {
    const [name, setName] = useState(user?.displayName || '');
    const [email, setEmail] = useState(user?.email || '');
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPhotoModal, setShowPhotoModal] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const showError = (message: string) => {
        setErrorMessage(message);
        setTimeout(() => setErrorMessage(null), 2000);
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!user || !event.target.files || event.target.files.length === 0) return;
        const file = event.target.files[0];
        const storageRef = ref(storage, `users/${user.uid}/profile.jpg`);
        
        try {
            await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(storageRef);
            await updateProfile(user, { photoURL: downloadURL });
            await updateDoc(doc(db, 'users', user.uid), { photoURL: downloadURL });
            setShowPhotoModal(false);
        } catch (error) {
            console.error('Error uploading profile picture:', error);
            showError('Failed to upload photo');
        }
    };

    const handleRemovePhoto = async () => {
        if (!user) return;
        const storageRef = ref(storage, `users/${user.uid}/profile.jpg`);
        try {
            await deleteObject(storageRef);
        } catch (error: any) {
            // Ignore if object doesn't exist; it means there's no storage file to delete.
            if (error?.code !== 'storage/object-not-found') {
                console.error('Error removing profile picture from storage:', error);
                showError('Failed to remove photo from storage');
            }
        }
        
        try {
            await updateProfile(user, { photoURL: null });
            await updateDoc(doc(db, 'users', user.uid), { photoURL: null });
            setShowPhotoModal(false);
        } catch (error) {
            console.error('Error updating profile:', error);
            showError('Failed to update profile');
        }
    };

    const handleSave = async () => {
        if (!user) return;
        setLoading(true);
        try {
            if (name !== user.displayName) await updateProfile(user, { displayName: name });
            if (email !== user.email) await updateEmail(user, email);
            alert('Profile updated');
            onNavigate('profile');
        } catch (error) {
            console.error(error);
            alert('Failed to update');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!user) return;
        if (confirm('Are you sure you want to delete your account?')) {
            try {
                await deleteUser(user);
                onNavigate('home');
            } catch (error) {
                console.error(error);
                alert('Failed to delete');
            }
        }
    };

    return (
        <div className="min-h-screen bg-[#0a0f24] text-white p-6 font-sans">
            {errorMessage && (
                <div className="fixed top-4 left-6 right-6 bg-red-600 text-white p-4 rounded-xl z-50 shadow-lg text-center font-bold">
                    {errorMessage}
                </div>
            )}
            {showPhotoModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-6 z-50">
                    <div className="bg-[#161e38] p-6 rounded-2xl w-full max-w-sm">
                        <h3 className="font-bold text-lg mb-4">Change Photo</h3>
                        <button onClick={() => fileInputRef.current?.click()} className="w-full text-left p-3 mb-2 hover:bg-white/10 rounded">Import Photo</button>
                        {user?.photoURL && (
                            <button onClick={handleRemovePhoto} className="w-full text-left p-3 text-red-500 hover:bg-white/10 rounded">Remove Photo</button>
                        )}
                        <button onClick={() => setShowPhotoModal(false)} className="w-full text-center mt-4 p-3 text-gray-400">Cancel</button>
                    </div>
                </div>
            )}
            <div className="flex items-center gap-4 mb-8">
                <ChevronLeft onClick={() => onNavigate('profile')} className="cursor-pointer" />
                <h1 className="text-xl font-bold">Edit Profile</h1>
            </div>
            
            <div className="flex flex-col items-center mb-8">
                <div className="relative w-32 h-32 bg-white/10 rounded-full flex items-center justify-center border-2 border-blue-500 overflow-hidden">
                    {user?.photoURL ? (
                        <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                        <User className="h-16 w-16 text-gray-400" />
                    )}
                    <Camera onClick={() => setShowPhotoModal(true)} className="absolute bottom-2 right-2 bg-black p-1.5 rounded-full text-white cursor-pointer" />
                </div>
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*" 
                    onChange={handleFileChange} 
                />
                <p className="text-blue-400 mt-2 cursor-pointer" onClick={() => setShowPhotoModal(true)}>Change Photo</p>
            </div>

            <div className="space-y-4">
                <div className="bg-[#161e38] p-4 rounded-xl flex items-center justify-between border border-white/5">
                    <div className="flex items-center gap-4">
                         <User className="text-blue-500" />
                         <div>
                            <p className="text-gray-400 text-xs text-left">Full Name</p>
                            <input value={name} onChange={e => setName(e.target.value)} className="bg-transparent text-white font-bold w-full" />
                         </div>
                    </div>
                </div>
                <div className="bg-[#161e38] p-4 rounded-xl flex items-center justify-between border border-white/5">
                    <div className="flex items-center gap-4">
                         <Mail className="text-blue-500" />
                         <div>
                            <p className="text-gray-400 text-xs text-left">Email</p>
                            <input value={email} onChange={e => setEmail(e.target.value)} className="bg-transparent text-white font-bold w-full" />
                         </div>
                    </div>
                </div>
                <div className="bg-[#161e38] p-4 rounded-xl flex items-center justify-between border border-white/5">
                    <div className="flex items-center gap-4">
                         <Phone className="text-blue-500" />
                         <div>
                            <p className="text-gray-400 text-xs text-left">Phone Number</p>
                            <input value={phone} onChange={e => setPhone(e.target.value)} className="bg-transparent text-white font-bold w-full" placeholder="+91..." />
                         </div>
                    </div>
                </div>
                <div className="bg-[#161e38] p-4 rounded-xl flex items-center justify-between border border-white/5">
                     <div className="flex items-center gap-4">
                         <GraduationCap className="text-blue-500" />
                         <div>
                            <p className="text-gray-400 text-xs text-left">Class</p>
                            <p className="font-bold">12th (NEET)</p>
                         </div>
                    </div>
                </div>
                <div className="bg-[#161e38] p-4 rounded-xl flex items-center justify-between border border-white/5">
                     <div className="flex items-center gap-4">
                         <Book className="text-blue-500" />
                         <div>
                            <p className="text-gray-400 text-xs text-left">Interest</p>
                            <p className="font-bold">Physics, Chemistry, Biology</p>
                         </div>
                    </div>
                </div>
            </div>

            <button onClick={handleSave} className="w-full mt-8 bg-gradient-to-r from-blue-600 to-indigo-600 p-4 rounded-xl font-bold flex items-center justify-center gap-2">
                <Save className="h-5 w-5" /> {loading ? 'Saving...' : 'Save Changes'}
            </button>
            <button onClick={handleDelete} className="w-full mt-4 bg-red-900/50 text-red-400 border border-red-500/50 p-4 rounded-xl font-bold flex items-center justify-center gap-2">
                <Trash2 className="h-5 w-5" /> Delete Account
            </button>
        </div>
    );
}
