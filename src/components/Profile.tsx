import { User, Settings, Shield, LogOut, ChevronRight, Download, HelpCircle, Mail, Edit } from 'lucide-react';
import { logOut } from '../lib/auth';
import { User as FirebaseUser } from 'firebase/auth';

export default function Profile({ user, onNavigate, onSolverClick }: { user: FirebaseUser | null, onNavigate: (view: 'home' | 'study' | 'profile' | 'editProfile' | 'tests' | 'notes' | 'admin' | 'technicalSupport' | 'notesLibrary') => void, onSolverClick: () => void }) {
    const isAdmin = user?.email === 'divakarkumarmob@gmail.com' || user?.email === 'shashikumarmob@gmail.com';
    return (
        <div className="min-h-screen bg-[#0a0f24] text-white p-2 font-sans pb-16">
            <div className="max-w-full mx-auto w-full">
                {/* Header */}
            <div className="bg-[#161e38] rounded-lg p-2 border border-white/10 mb-2 flex flex-col items-center">
                <div className="relative mb-1">
                    <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center overflow-hidden">
                        {user?.photoURL ? (
                            <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                            <User className="h-6 w-6 text-gray-400" />
                        )}
                    </div>
                </div>
                <h2 className="text-base font-bold">{user?.displayName || 'Aspirant'}</h2>
                <p className="text-gray-400 text-[10px] mb-2">{user?.email}</p>
                <button onClick={() => onNavigate('editProfile')} className="bg-orange-500 flex items-center gap-0.5 px-1.5 py-0 rounded-full font-bold text-[8px]">
                    <Edit className="h-2 w-2" /> EDIT PROFILE
                </button>
            </div>

            {/* AI Intelligence */}
            <h3 className="text-gray-500 text-[10px] font-bold mb-1.5 uppercase">AI Intelligence</h3>
            <div onClick={onSolverClick} className="bg-gradient-to-r from-purple-600 to-indigo-600 p-2 rounded-lg mb-3 flex justify-between items-center cursor-pointer">
                <div className="flex items-center gap-1.5">
                    <div className="bg-white/20 p-1 rounded-md"><User className="h-4 w-4 text-white"/></div>
                    <div>
                        <p className="font-bold text-xs">Neural Doubt Solver</p>
                        <p className="text-[9px] text-white/70">CORE ACCESS V3.1</p>
                    </div>
                </div>
                <ChevronRight className="h-4 w-4 text-white/50" />
            </div>

            {/* Memory & Backup */}
            <h3 className="text-gray-500 text-[10px] font-bold mb-1.5 uppercase">Memory & Backup</h3>
            <div className="bg-green-500 p-2 rounded-lg mb-1.5 flex justify-between items-center cursor-pointer">
                 <div className="flex items-center gap-1.5">
                    <div className="bg-white/20 p-1 rounded-md"><Download className="h-4 w-4 text-white"/></div>
                    <div>
                        <p className="font-bold text-xs">NCERT & Modules</p>
                        <p className="text-[9px] text-white/70">Access uploaded library PDFs</p>
                    </div>
                </div>
                <ChevronRight className="h-4 w-4 text-white/50" />
            </div>
            
            <div className="bg-blue-600 p-2 rounded-lg mb-3 flex justify-between items-center cursor-pointer">
                 <div className="flex items-center gap-1.5">
                    <div className="bg-white/20 p-1 rounded-md"><Shield className="h-4 w-4 text-white"/></div>
                    <div>
                        <p className="font-bold text-xs">Memory & Backup</p>
                        <p className="text-[9px] text-white/70">Access secure system data</p>
                    </div>
                </div>
                <ChevronRight className="h-4 w-4 text-white/50" />
            </div>

            {/* System Preference */}
            <h3 className="text-gray-500 text-[10px] font-bold mb-1.5 uppercase">System Preference</h3>
            <div className="bg-[#161e38] border border-white/10 p-2 rounded-lg mb-3 flex justify-between items-center">
                 <div className="flex items-center gap-1.5">
                    <div className="bg-white/10 p-1 rounded-md"><Settings className="h-4 w-4 text-gray-300"/></div>
                    <p className="font-bold text-xs">Dark Mode</p>
                </div>
                <div className="w-8 h-5 bg-white rounded-full relative">
                    <div className="absolute right-0.5 top-0.5 bg-black w-4 h-4 rounded-full"></div>
                </div>
            </div>

            {/* Support Network */}
            <h3 className="text-gray-500 text-[10px] font-bold mb-1.5 uppercase">Support Network</h3>
            <div onClick={() => onNavigate('notesLibrary')} className="bg-orange-500 p-2 rounded-lg mb-2 flex justify-between items-center cursor-pointer">
                 <div className="flex items-center gap-1.5">
                    <Download className="h-4 w-4 text-white"/>
                    <p className="font-bold text-xs">Download Notes</p>
                </div>
                <ChevronRight className="h-3 w-3" />
            </div>
            
            <div className="space-y-1 mb-3">
                {isAdmin && (
                    <div onClick={() => onNavigate('admin')} className="flex items-center justify-between p-1 cursor-pointer">
                        <div className="flex items-center gap-1.5 text-xs"><Shield className="h-4 w-4 text-orange-500"/><span>Admin Panel</span></div>
                        <ChevronRight className="h-3 w-3 text-gray-500" />
                    </div>
                )}
                <div className="flex items-center justify-between p-1">
                    <a href="https://instagram.com/mr.divakar00" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs"><Mail className="h-4 w-4 text-gray-400"/><span>@mr.divakar00</span></a>
                    <ChevronRight className="h-3 w-3 text-gray-500" />
                </div>
                <div onClick={() => onNavigate('technicalSupport')} className="flex items-center justify-between p-1 cursor-pointer">
                    <div className="flex items-center gap-1.5 text-xs"><HelpCircle className="h-4 w-4 text-gray-400"/><span>Technical Support</span></div>
                    <ChevronRight className="h-3 w-3 text-gray-500" />
                </div>
            </div>

            <button onClick={logOut} className="w-full bg-[#1e293b] text-white py-1.5 rounded-md font-bold flex items-center justify-center gap-1 text-[10px]">
                <LogOut className="h-3 w-3" /> END SESSION
            </button>
          </div>
        </div>
    );
}
