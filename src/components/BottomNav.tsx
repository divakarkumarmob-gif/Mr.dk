import React from 'react';
import { Home, BarChart2, FileText, User as UserIcon, Book } from 'lucide-react';

export default function BottomNav({ currentView, onNavigate }: { currentView: 'home' | 'study' | 'profile' | 'editProfile' | 'tests' | 'notes' | 'technicalSupport' | 'analytics', onNavigate: (view: 'home' | 'study' | 'profile' | 'editProfile' | 'tests' | 'notes' | 'technicalSupport' | 'analytics') => void }) {
    return (
        <div className="fixed bottom-0 left-0 w-full bg-[#0a0e1a] border-t border-[#1E293B] p-2 z-[999]">
            <div className="max-w-md mx-auto flex justify-around">
                <div className={`flex flex-col items-center cursor-pointer ${currentView === 'home' ? 'text-[#3B82F6]' : 'text-[#64748B]'}`} onClick={() => onNavigate('home')}><Home className="h-5 w-5 sm:h-6 sm:w-6" /><span className="text-[10px]">Home</span></div>
                <div className={`flex flex-col items-center cursor-pointer ${currentView === 'tests' ? 'text-[#3B82F6]' : 'text-[#64748B]'}`} onClick={() => onNavigate('tests')}><FileText className="h-5 w-5 sm:h-6 sm:w-6" /><span className="text-[10px]">Tests</span></div>
                <div className={`flex flex-col items-center cursor-pointer ${currentView === 'analytics' ? 'text-[#3B82F6]' : 'text-[#64748B]'}`} onClick={() => onNavigate('analytics')}><BarChart2 className="h-5 w-5 sm:h-6 sm:w-6" /><span className="text-[10px]">Analytics</span></div>
                <div className={`flex flex-col items-center cursor-pointer ${currentView === 'notes' ? 'text-[#3B82F6]' : 'text-[#64748B]'}`} onClick={() => onNavigate('notes')}><Book className="h-5 w-5 sm:h-6 sm:w-6" /><span className="text-[10px]">Notes</span></div>
                <div className={`flex flex-col items-center cursor-pointer ${currentView === 'profile' ? 'text-[#3B82F6]' : 'text-[#64748B]'}`} onClick={() => onNavigate('profile')}><UserIcon className="h-5 w-5 sm:h-6 sm:w-6" /><span className="text-[10px]">Profile</span></div>
            </div>
        </div>
    )
}
