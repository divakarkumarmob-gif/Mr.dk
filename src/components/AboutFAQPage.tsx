import React from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';

export default function AboutFAQPage({ onBack }: { onBack: () => void }) {
    return (
        <div className="min-h-dvh bg-background text-foreground pt-[max(env(safe-area-inset-top,0px),5px)] px-3">
            <button className="flex items-center gap-2 text-sm text-gray-400 mb-6" onClick={onBack}>
                <X className="h-5 w-5" /> Back
            </button>
            <h1 className="text-2xl font-bold mb-6">About & FAQ</h1>
            
            <div className="bg-card rounded-2xl p-4 sm:p-6 border border-border mb-6">
                <h2 className="font-bold text-lg mb-3">About NeetMaster</h2>
                <p className="text-sm text-gray-300 leading-relaxed">
                    NeetMaster is your ultimate companion for NEET exam preparation. Unlike standard apps, NeetMaster provides truly personalized AI study plans that adapt to your progress. With NeetMaster, you gain access to NCERT-aligned mock tests and instant doubt-solving to ensure no concept remains unclear. Join NeetMaster today and take a step closer to your dream college.
                </p>
            </div>

            <div className="bg-card rounded-2xl p-4 sm:p-6 border border-border mb-6">
                <h2 className="font-bold text-lg mb-4">Frequently Asked Questions</h2>
                <div className="space-y-4">
                    <div>
                        <h3 className="font-bold text-sm">What is NeetMaster?</h3>
                        <p className="text-sm text-gray-300">NeetMaster is an AI-powered NEET exam preparation app designed to help aspirants crack NEET with personalized study plans, NCERT-aligned mock tests, and instant doubt-solving capabilities.</p>
                    </div>
                    <div>
                        <h3 className="font-bold text-sm">Is NeetMaster free?</h3>
                        <p className="text-sm text-gray-300">Yes, NeetMaster offers a free trial to help you get started with your NEET preparation.</p>
                    </div>
                    <div>
                        <h3 className="font-bold text-sm">How does NeetMaster's AI study plan work?</h3>
                        <p className="text-sm text-gray-300">NeetMaster's AI study plan analyzes your current performance and creates a personalized roadmap, focusing on your weak areas and ensuring comprehensive coverage of the NEET syllabus.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
