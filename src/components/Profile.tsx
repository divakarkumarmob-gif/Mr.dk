import { User, Settings, Shield, LogOut, ChevronRight, Download, HelpCircle, Mail, Edit } from 'lucide-react';
import { logOut } from '../lib/auth';
import { User as FirebaseUser } from 'firebase/auth';
import { motion } from 'motion/react';
import Pressable from './Pressable';

export default function Profile({ user, onNavigate, onSolverClick }: { user: FirebaseUser | null, onNavigate: (view: 'home' | 'study' | 'profile' | 'editProfile' | 'tests' | 'notes' | 'admin' | 'technicalSupport' | 'notesLibrary' | 'mindHack' | 'aiStudyPlan') => void, onSolverClick: () => void }) {
    const isAdmin = user?.email === 'divakarkumarmob@gmail.com' || user?.email === 'shashikumarmob@gmail.com';
    return (
        <div className="min-h-screen bg-background text-foreground p-2 font-sans pb-16">
            <div className="max-w-full mx-auto w-full">
                {/* Header */}
            <div className="bg-card text-card-foreground rounded-lg p-2 border border-border mb-2 flex flex-col items-center">
                <div className="relative mb-1">
                    <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center overflow-hidden">
                        {user?.photoURL ? (
                            <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                            <User className="h-6 w-6 text-muted-foreground" />
                        )}
                    </div>
                </div>
                <h2 className="text-base font-bold">{user?.displayName || 'Aspirant'}</h2>
                <p className="text-muted-foreground text-[10px] mb-2">{user?.email}</p>
                <Pressable onClick={() => onNavigate('editProfile')} className="bg-primary text-primary-foreground flex items-center gap-0.5 px-1.5 py-0 rounded-full font-bold text-[8px]">
                    <Edit className="h-2 w-2" /> EDIT PROFILE
                </Pressable>
            </div>

            {/* AI Intelligence */}
            <h3 className="text-muted-foreground text-[10px] font-bold mb-1.5 uppercase">AI Intelligence</h3>
            <Pressable onClick={onSolverClick} className="w-full text-left bg-primary text-primary-foreground p-2 rounded-lg mb-3 flex justify-between items-center">
                <div className="flex items-center gap-1.5">
                    <div className="bg-white/20 p-1 rounded-md"><User className="h-4 w-4"/></div>
                    <div>
                        <p className="font-bold text-xs">Neural Doubt Solver</p>
                        <p className="text-[9px] opacity-70">CORE ACCESS V3.1</p>
                    </div>
                </div>
                <ChevronRight className="h-4 w-4 opacity-50" />
            </Pressable>
            
            {/* Mind Hack */}
            <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
            >
                <Pressable onClick={() => onNavigate('mindHack')} className="w-full text-left bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-2 rounded-lg mb-3 flex justify-between items-center shadow-lg">
                    <div className="flex items-center gap-1.5">
                        <div className="bg-white/20 p-1 rounded-md">🧠</div>
                        <p className="font-bold text-xs">Mind Hack</p>
                    </div>
                    <ChevronRight className="h-4 w-4 opacity-50" />
                </Pressable>
            </motion.div>
            
            {/* AI Study Plan */}
            <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
            >
                <Pressable onClick={() => onNavigate('aiStudyPlan')} className="w-full text-left bg-gradient-to-r from-blue-600 to-cyan-600 text-white p-2 rounded-lg mb-3 flex justify-between items-center shadow-lg">
                    <div className="flex items-center gap-1.5">
                        <div className="bg-white/20 p-1 rounded-md">📅</div>
                        <p className="font-bold text-xs">AI Study Plan</p>
                    </div>
                    <ChevronRight className="h-4 w-4 opacity-50" />
                </Pressable>
            </motion.div>

            <h3 className="text-muted-foreground text-[10px] font-bold mb-1.5 uppercase">Memory & Backup</h3>
            <div className="bg-green-600 text-white p-2 rounded-lg mb-1.5 flex justify-between items-center cursor-pointer">
                 <div className="flex items-center gap-1.5">
                    <div className="bg-white/20 p-1 rounded-md"><Download className="h-4 w-4"/></div>
                    <div>
                        <p className="font-bold text-xs">NCERT & Modules</p>
                        <p className="text-[9px] opacity-70">Access uploaded library PDFs</p>
                    </div>
                </div>
                <ChevronRight className="h-4 w-4 opacity-50" />
            </div>
            
            <div className="bg-blue-600 text-white p-2 rounded-lg mb-3 flex justify-between items-center cursor-pointer">
                 <div className="flex items-center gap-1.5">
                    <div className="bg-white/20 p-1 rounded-md"><Shield className="h-4 w-4"/></div>
                    <div>
                        <p className="font-bold text-xs">Memory & Backup</p>
                        <p className="text-[9px] opacity-70">Access secure system data</p>
                    </div>
                </div>
                <ChevronRight className="h-4 w-4 opacity-50" />
            </div>

            {/* Support Network */}
            <h3 className="text-muted-foreground text-[10px] font-bold mb-1.5 uppercase">Support Network</h3>
            <Pressable onClick={() => onNavigate('notesLibrary')} className="w-full text-left bg-orange-500 text-white p-2 rounded-lg mb-2 flex justify-between items-center">
                 <div className="flex items-center gap-1.5">
                    <Download className="h-4 w-4"/>
                    <p className="font-bold text-xs">Download Notes</p>
                </div>
                <ChevronRight className="h-3 w-3" />
            </Pressable>
            
            <div className="space-y-1 mb-3 text-foreground">
                {isAdmin && (
                    <Pressable onClick={() => onNavigate('admin')} className="w-full text-left flex items-center justify-between p-1">
                        <div className="flex items-center gap-1.5 text-xs"><Shield className="h-4 w-4 text-orange-500"/><span>Admin Panel</span></div>
                        <ChevronRight className="h-3 w-3" />
                    </Pressable>
                )}
                <div className="flex items-center justify-between p-1">
                    <a href="https://instagram.com/mr.divakar00" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs"><Mail className="h-4 w-4"/><span>@mr.divakar00</span></a>
                    <ChevronRight className="h-3 w-3" />
                </div>
                <Pressable onClick={() => onNavigate('technicalSupport')} className="w-full text-left flex items-center justify-between p-1">
                    <div className="flex items-center gap-1.5 text-xs"><HelpCircle className="h-4 w-4"/><span>Technical Support</span></div>
                    <ChevronRight className="h-3 w-3" />
                </Pressable>
            </div>

            <Pressable onClick={logOut} className="w-full bg-secondary text-secondary-foreground py-1.5 rounded-md font-bold flex items-center justify-center gap-1 text-[10px]">
                <LogOut className="h-3 w-3" /> END SESSION
            </Pressable>
          </div>
        </div>
    );
}