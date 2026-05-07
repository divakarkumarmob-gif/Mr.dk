import { User, Settings, Shield, LogOut, ChevronRight, Download, HelpCircle, Mail, Edit } from 'lucide-react';
import { logOut } from '../lib/auth';
import { User as FirebaseUser } from 'firebase/auth';

export default function Profile({ user, onNavigate }: { user: FirebaseUser | null, onNavigate: (view: 'home' | 'study' | 'profile' | 'editProfile' | 'tests' | 'notes' | 'admin') => void }) {
    const isAdmin = user?.email === 'divakarkumarmob@gmail.com';
    return (
        <div className="min-h-screen bg-[#0a0f24] text-white p-6 font-sans pb-24">
            
            {/* Header */}
            <div className="bg-[#161e38] rounded-2xl p-6 border border-white/10 mb-8 flex flex-col items-center">
                <div className="relative mb-4">
                    <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center overflow-hidden">
                        {user?.photoURL ? (
                            <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                            <User className="h-10 w-10 text-gray-400" />
                        )}
                    </div>
                </div>
                <h2 className="text-xl font-bold">{user?.displayName || 'Aspirant'}</h2>
                <p className="text-gray-400 text-sm mb-6">{user?.email}</p>
                <button onClick={() => onNavigate('editProfile')} className="bg-orange-500 flex items-center gap-2 px-6 py-2 rounded-full font-bold text-sm">
                    <Edit className="h-4 w-4" /> EDIT PROFILE
                </button>
            </div>

            {/* AI Intelligence */}
            <h3 className="text-gray-500 text-xs font-bold mb-4 uppercase">AI Intelligence</h3>
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-4 rounded-xl mb-6 flex justify-between items-center cursor-pointer">
                <div className="flex items-center gap-3">
                    <div className="bg-white/20 p-2 rounded-lg"><User className="h-6 w-6 text-white"/></div>
                    <div>
                        <p className="font-bold">Neural Doubt Solver</p>
                        <p className="text-xs text-white/70">CORE ACCESS V3.1</p>
                    </div>
                </div>
                <ChevronRight className="h-6 w-6 text-white/50" />
            </div>

            {/* Memory & Backup */}
            <h3 className="text-gray-500 text-xs font-bold mb-4 uppercase">Memory & Backup</h3>
            <div className="bg-green-500 p-4 rounded-xl mb-3 flex justify-between items-center cursor-pointer">
                 <div className="flex items-center gap-3">
                    <div className="bg-white/20 p-2 rounded-lg"><Download className="h-6 w-6 text-white"/></div>
                    <div>
                        <p className="font-bold">NCERT & Modules</p>
                        <p className="text-xs text-white/70">Access uploaded library PDFs</p>
                    </div>
                </div>
                <ChevronRight className="h-6 w-6 text-white/50" />
            </div>
            
            <div className="bg-blue-600 p-4 rounded-xl mb-6 flex justify-between items-center cursor-pointer">
                 <div className="flex items-center gap-3">
                    <div className="bg-white/20 p-2 rounded-lg"><Shield className="h-6 w-6 text-white"/></div>
                    <div>
                        <p className="font-bold">Memory & Backup</p>
                        <p className="text-xs text-white/70">Access secure system data</p>
                    </div>
                </div>
                <ChevronRight className="h-6 w-6 text-white/50" />
            </div>

            {/* System Preference */}
            <h3 className="text-gray-500 text-xs font-bold mb-4 uppercase">System Preference</h3>
            <div className="bg-[#161e38] border border-white/10 p-4 rounded-xl mb-8 flex justify-between items-center">
                 <div className="flex items-center gap-3">
                    <div className="bg-white/10 p-2 rounded-lg"><Settings className="h-6 w-6 text-gray-300"/></div>
                    <p className="font-bold">Dark Mode</p>
                </div>
                <div className="w-10 h-6 bg-white rounded-full relative">
                    <div className="absolute right-1 top-1 bg-black w-4 h-4 rounded-full"></div>
                </div>
            </div>

            {/* Support Network */}
            <h3 className="text-gray-500 text-xs font-bold mb-4 uppercase">Support Network</h3>
            <div className="bg-orange-500 p-4 rounded-xl mb-4 flex justify-between items-center cursor-pointer">
                 <div className="flex items-center gap-3">
                    <Download className="h-6 w-6 text-white"/>
                    <p className="font-bold">Download Notes</p>
                </div>
                <ChevronRight className="h-4 w-4" />
            </div>
            
            <div className="space-y-4 mb-8">
                {isAdmin && (
                    <div onClick={() => onNavigate('admin')} className="flex items-center justify-between p-2 cursor-pointer">
                        <div className="flex items-center gap-3"><Shield className="h-5 w-5 text-orange-500"/><span>Admin Panel</span></div>
                        <ChevronRight className="h-4 w-4 text-gray-500" />
                    </div>
                )}
                <div className="flex items-center justify-between p-2">
                    <a href="https://instagram.com/mr.divakar00" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3"><Mail className="h-5 w-5 text-gray-400"/><span>@mr.divakar00</span></a>
                    <ChevronRight className="h-4 w-4 text-gray-500" />
                </div>
                <div className="flex items-center justify-between p-2">
                    <div className="flex items-center gap-3"><HelpCircle className="h-5 w-5 text-gray-400"/><span>Technical Support</span></div>
                    <ChevronRight className="h-4 w-4 text-gray-500" />
                </div>
            </div>

            <button onClick={logOut} className="w-full bg-[#1e293b] text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2">
                <LogOut className="h-5 w-5" /> END SESSION
            </button>
        </div>
    );
}
