
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, FileText, Search, ExternalLink, BookOpen, Clock, Tag, Loader2, FileUp, Info, Share2, Check } from 'lucide-react';
import Pressable from './Pressable';
import AdvancedPDFViewer from './AdvancedPDFViewer';
import { getApiUrl, getPdfViewerUrl } from '@/utils/api';
import { getRamCachedPdf, getCachedPdf, fetchAndCacheByStableKey } from '../lib/pdfCache';

interface NTAPaper {
    id: string;
    year: string;
    title: string;
    url: string;
    mirrorUrl?: string;
    category: 'Main' | 'Mock' | 'Special';
}

const NTA_PAPERS: NTAPaper[] = [
    { 
        id: 'neet2024', 
        year: '2024', 
        title: 'NEET (UG) - 2024 Official Question Paper', 
        url: 'https://raw.githubusercontent.com/divakarkumarmob-gif/Data-upload-/main/2024/NEET_2024.pdf', 
        mirrorUrl: 'https://www.nta.ac.in/Download/QuestionPaper/NEET_2024.pdf',
        category: 'Main' 
    }, 
    { 
        id: 'neet2023', 
        year: '2023', 
        title: 'NEET (UG) - 2023 Official Question Paper', 
        url: 'https://raw.githubusercontent.com/divakarkumarmob-gif/Data-upload-/main/2023/NEET_2023.pdf', 
        mirrorUrl: 'https://accad.nta.nic.in/QuestionPaper/NEET_2023.pdf',
        category: 'Main' 
    },
    { 
        id: 'neet2022', 
        year: '2022', 
        title: 'NEET (UG) - 2022 Official Question Paper (English)', 
        url: 'https://raw.githubusercontent.com/divakarkumarmob-gif/Data-upload-/main/2022/NEET_2022.pdf', 
        mirrorUrl: 'https://www.nta.ac.in/Download/QuestionPaper/NEET_2022_Eng.pdf',
        category: 'Main' 
    },
    { 
        id: 'neet2021', 
        year: '2021', 
        title: 'NEET (UG) - 2021 Official Question Paper', 
        url: 'https://raw.githubusercontent.com/divakarkumarmob-gif/Data-upload-/main/2021/NEET_2021.pdf', 
        mirrorUrl: 'https://www.nta.ac.in/Download/QuestionPaper/NEET_2021.pdf', 
        category: 'Main' 
    },
    { 
        id: 'neet2020', 
        year: '2020', 
        title: 'NEET (UG) - 2020 Official Question Paper', 
        url: 'https://raw.githubusercontent.com/divakarkumarmob-gif/Data-upload-/main/2020/NEET_2020.pdf', 
        mirrorUrl: 'https://www.nta.ac.in/Download/QuestionPaper/NEET_2020.pdf', 
        category: 'Main' 
    },
    { 
        id: 'neet2019', 
        year: '2019', 
        title: 'NEET (UG) - 2019 Official Question Paper', 
        url: 'https://raw.githubusercontent.com/divakarkumarmob-gif/Data-upload-/main/2019/NEET_2019.pdf', 
        mirrorUrl: 'https://www.nta.ac.in/Download/QuestionPaper/NEET_2019.pdf', 
        category: 'Main' 
    },
    { 
        id: 'neet2018', 
        year: '2018', 
        title: 'NEET (UG) - 2018 Official Question Paper', 
        url: 'https://raw.githubusercontent.com/divakarkumarmob-gif/Data-upload-/main/2018/NEET_2018.pdf', 
        mirrorUrl: 'https://www.nta.ac.in/Download/QuestionPaper/NEET_2018.pdf', 
        category: 'Main' 
    },
    { 
        id: 'mock_bio', 
        year: '2025', 
        title: 'NTA Abhyas: Biology Official Sample Paper', 
        url: 'https://raw.githubusercontent.com/divakarkumarmob-gif/Data-upload-/main/Mocks/Biology_Mock.pdf', 
        mirrorUrl: 'https://www.nta.ac.in/Download/Sample/Biology_Mock.pdf', 
        category: 'Mock' 
    },
];

export default function NTAQuestionsHub({ onBack, autoOpenPaperId }: { onBack: () => void, autoOpenPaperId?: string }) {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<'All' | 'Main' | 'Mock'>('All');
    const [useMirror, setUseMirror] = useState(false);
    const [viewerUrl, setViewerUrl] = useState<{url: string, title: string, originalUrl: string} | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const filteredPapers = NTA_PAPERS.filter(paper => {
        const matchesSearch = paper.title.toLowerCase().includes(searchQuery.toLowerCase()) || paper.year.includes(searchQuery);
        const matchesCat = selectedCategory === 'All' || paper.category === selectedCategory;
        return matchesSearch && matchesCat;
    });

    const handleOpenPaper = async (paper: NTAPaper) => {
        const targetUrl = (useMirror && paper.mirrorUrl) ? paper.mirrorUrl : paper.url;

        // targetUrl is stable (hardcoded per paper, no rotating token) so we
        // can cache/lookup by it directly — skips the proxy-token round
        // trip on repeat opens of the same paper.
        const ramUrl = getRamCachedPdf(targetUrl);
        if (ramUrl) {
            setViewerUrl({ url: ramUrl, title: paper.title, originalUrl: targetUrl });
            window.history.pushState({ ...window.history.state, isPdfOpen: true }, '', window.location.href);
            return;
        }
        try {
            const diskUrl = await getCachedPdf(targetUrl);
            if (diskUrl) {
                setViewerUrl({ url: diskUrl, title: paper.title, originalUrl: targetUrl });
                window.history.pushState({ ...window.history.state, isPdfOpen: true }, '', window.location.href);
                return;
            }
        } catch {
            // fall through to network fetch below
        }

        try {
            const proxyUrl = await getPdfViewerUrl(targetUrl);
            setViewerUrl({ url: proxyUrl, title: paper.title, originalUrl: targetUrl });
            window.history.pushState({ ...window.history.state, isPdfOpen: true }, '', window.location.href);
            fetchAndCacheByStableKey(proxyUrl, targetUrl).catch(() => {});
        } catch (e) {
            console.error("Failed to get PDF token:", e);
        }
    };


    const handleShare = (paper: NTAPaper) => {
        const url = `${window.location.origin}${window.location.pathname}?view=ntaQuestionsHub&paperId=${paper.id}`;
        navigator.clipboard.writeText(url);
        setCopiedId(paper.id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const handlePop = () => {
        if (viewerUrl && !window.history.state?.isPdfOpen) {
            setViewerUrl(null);
        }
    };

    React.useEffect(() => {
        window.addEventListener('popstate', handlePop);
        return () => window.removeEventListener('popstate', handlePop);
    }, [viewerUrl]);

    const handleViewerClose = () => {
        setViewerUrl(null);
    };

    const handleBack = () => {
        onBack();
    };

    React.useEffect(() => {
        if (autoOpenPaperId) {
            const paper = NTA_PAPERS.find(p => p.id === autoOpenPaperId);
            if (paper) {
                handleOpenPaper(paper);
            }
        }
    }, [autoOpenPaperId]);

    return (
        <>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex-1 min-h-0 w-full bg-[#0a0f24] text-white font-sans overflow-y-auto">
            <div className="pt-[env(safe-area-inset-top,0px)] pb-20 max-w-5xl mx-auto px-4 sm:px-6 w-full min-w-0 overflow-x-hidden">
                {/* Header */}
                <div className="flex items-center gap-4 mb-6">
                    <Pressable onClick={handleBack} className="p-2 bg-purple-500/10 border border-purple-500/20 rounded-full text-purple-300">
                        <ArrowLeft className="w-5 h-5" />
                    </Pressable>
                    <div>
                        <h1 className="text-xl font-extrabold text-white">Question Bank 📝</h1>
                        <p className="text-xs text-purple-300">NTA NEET PYQs & Official Mocks</p>
                    </div>
                </div>

                {/* Filters */}
                <div className="space-y-4 mb-6 w-full min-w-0">
                    <div className="relative w-full">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-300" />
                        <input 
                            type="text" 
                            placeholder="Search by year or title..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-slate-900/80 border border-purple-500/30 rounded-2xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-purple-400 backdrop-blur-xl transition-all text-white placeholder-slate-400 shadow-md"
                        />
                    </div>

                    <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar w-full">
                        {(['All', 'Main', 'Mock'] as const).map(cat => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={`px-4 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all border cursor-pointer ${
                                    selectedCategory === cat 
                                        ? 'gradient-btn-primary text-white border-purple-400/50 shadow-[0_0_15px_rgba(139,92,246,0.3)]' 
                                        : 'bg-slate-900/60 border-purple-500/20 text-slate-400 hover:text-slate-200'
                                }`}
                            >
                                {cat === 'Main' ? 'PYQs' : cat === 'Mock' ? 'Practice' : 'All Resources'}
                            </button>
                        ))}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-900/80 border border-purple-500/25 rounded-2xl backdrop-blur-xl">
                        <div className="flex items-center gap-2 min-w-0">
                             <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${useMirror ? 'bg-purple-400' : 'bg-emerald-400 animate-pulse'}`} />
                             <span className="text-[10px] font-bold text-slate-300 truncate">
                                {useMirror ? 'USING OFFICIAL NTA SERVER' : 'USING GITHUB CLOUD (Fast Load)'}
                             </span>
                        </div>
                        <button 
                            onClick={() => setUseMirror(!useMirror)}
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-extrabold transition-all shrink-0 cursor-pointer ${
                                useMirror ? 'gradient-btn-primary text-white' : 'bg-white/10 text-slate-300 hover:bg-white/20'
                            }`}
                        >
                            {useMirror ? 'Switch to GitHub' : 'Use Official'}
                        </button>
                    </div>
                </div>

                {/* Question List */}
                <div className="space-y-3 w-full min-w-0">
                    {filteredPapers.length > 0 ? filteredPapers.map(paper => (
                        <div 
                            key={paper.id}
                            className="glass-card glass-card-hover border border-purple-500/20 p-3.5 sm:p-4 rounded-2xl flex flex-col gap-3 group transition-all w-full min-w-0 overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.4)]"
                        >
                            <div className="flex items-center gap-3.5 min-w-0">
                                <div className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center font-extrabold text-[10px] shrink-0 ${
                                    paper.category === 'Main' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                }`}>
                                    <FileUp className="w-4 h-4 mb-0.5" />
                                    {paper.year}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-extrabold text-xs sm:text-sm text-white truncate group-hover:text-purple-300 transition-colors">{paper.title}</h3>
                                    <div className="flex items-center gap-3 mt-1">
                                        <span className="flex items-center gap-1 text-[10px] text-gray-500">
                                            <Tag className="w-3 h-3" /> {paper.category}
                                        </span>
                                        <span className="flex items-center gap-1 text-[10px] text-gray-500">
                                            <Clock className="w-3 h-3" /> 200 Mins
                                        </span>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex gap-1.5 sm:gap-2 flex-wrap sm:flex-nowrap">
                                <button 
                                    onClick={() => handleOpenPaper(paper)}
                                    className="flex-1 bg-blue-600 hover:bg-blue-700 py-2.5 sm:py-3 rounded-xl text-[10px] sm:text-xs font-bold transition-all shadow-lg shadow-blue-500/20"
                                >
                                    View Question Paper
                                </button>
                                <div className="flex gap-1.5 sm:gap-2">
                                    <button 
                                        onClick={() => handleShare(paper)}
                                        className="w-10 sm:w-auto px-0 sm:px-4 bg-white/5 hover:bg-gray-700 rounded-xl flex items-center justify-center text-gray-400 hover:text-white transition-all"
                                        title="Copy Deep Link"
                                    >
                                        {copiedId === paper.id ? <Check className="w-4 h-4 text-green-500" /> : <Share2 className="w-4 h-4" />}
                                    </button>
                                    <a 
                                        href={paper.url}
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="w-10 sm:w-auto px-0 sm:px-4 bg-white/5 hover:bg-white/10 rounded-xl flex items-center justify-center text-gray-400 hover:text-white transition-all"
                                        title="Open direct file source"
                                    >
                                        <ExternalLink className="w-4 h-4" />
                                    </a>
                                </div>
                            </div>
                        </div>
                    )) : (
                        <div className="text-center py-12 text-gray-500">
                            <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-20" />
                            <p className="text-sm">No questions found for this search.</p>
                        </div>
                    )}
                </div>

                <div className="mt-8 p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex gap-3">
                   <div className="bg-blue-500/20 p-2 rounded-lg shrink-0">
                        <Info className="w-4 h-4 text-blue-400" />
                   </div>
                    <p className="text-xs text-blue-400 leading-relaxed font-medium">
                        These papers are now hosted on GitHub for better reliability. If a PDF fails to load due to GitHub rate limits, you can switch to the <b>Official NTA Server</b> using the toggle above.
                    </p>
                </div>
            </div>
        </motion.div>

        {/* Viewer Modal */}
        {viewerUrl && (
            <AdvancedPDFViewer 
                pdfUrl={viewerUrl.url}
                title={viewerUrl.title}
                onClose={handleViewerClose}
                originalUrl={viewerUrl.originalUrl}
            />
        )}
        </>
    );
}
