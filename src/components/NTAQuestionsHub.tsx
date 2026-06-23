
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, FileText, Search, ExternalLink, BookOpen, Clock, Tag, Loader2, FileUp, Info, Share2, Check } from 'lucide-react';
import Pressable from './Pressable';
import AdvancedPDFViewer from './AdvancedPDFViewer';

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
        title: 'NEET (UG) - 2024 Question Paper', 
        url: 'https://raw.githubusercontent.com/divakarkumarmob-gif/Data-upload-/main/2024/NEET_2024.pdf', 
        mirrorUrl: 'https://www.nta.ac.in/Download/QuestionPaper/NEET_2024.pdf',
        category: 'Main' 
    }, 
    { 
        id: 'neet2023', 
        year: '2023', 
        title: 'NEET (UG) - 2023 Question Paper', 
        url: 'https://raw.githubusercontent.com/divakarkumarmob-gif/Data-upload-/main/2023/NEET_2023.pdf', 
        mirrorUrl: 'https://accad.nta.nic.in/QuestionPaper/NEET_2023.pdf',
        category: 'Main' 
    },
    { 
        id: 'neet2022', 
        year: '2022', 
        title: 'NEET (UG) - 2022 Question Paper (English)', 
        url: 'https://raw.githubusercontent.com/divakarkumarmob-gif/Data-upload-/main/2022/NEET_2022.pdf', 
        mirrorUrl: 'https://www.nta.ac.in/Download/QuestionPaper/NEET_2022_Eng.pdf',
        category: 'Main' 
    },
    { id: 'neet2021', year: '2021', title: 'NEET (UG) - 2021 Question Paper', url: 'https://raw.githubusercontent.com/divakarkumarmob-gif/Data-upload-/main/2021/NEET_2021.pdf', mirrorUrl: 'https://www.nta.ac.in/Download/QuestionPaper/NEET_2021.pdf', category: 'Main' },
    { id: 'neet2020', year: '2020', title: 'NEET (UG) - 2020 Question Paper', url: 'https://raw.githubusercontent.com/divakarkumarmob-gif/Data-upload-/main/2020/NEET_2020.pdf', mirrorUrl: 'https://www.nta.ac.in/Download/QuestionPaper/NEET_2020.pdf', category: 'Main' },
    { id: 'mock_bio', year: '2025', title: 'NTA Abhyas: Biology Mock', url: 'https://raw.githubusercontent.com/divakarkumarmob-gif/Data-upload-/main/Mocks/Biology_Mock.pdf', mirrorUrl: 'https://www.nta.ac.in/Download/Sample/Biology_Mock.pdf', category: 'Mock' },
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

    const handleOpenPaper = (paper: NTAPaper) => {
        const targetUrl = (useMirror && paper.mirrorUrl) ? paper.mirrorUrl : paper.url;
        const proxyUrl = `/api/proxy-pdf?url=${encodeURIComponent(targetUrl)}`;
        setViewerUrl({ url: proxyUrl, title: paper.title, originalUrl: targetUrl });
    };

    const handleShare = (paper: NTAPaper) => {
        const url = `${window.location.origin}/?view=ntaQuestionsHub&paper=${paper.id}`;
        navigator.clipboard.writeText(url);
        setCopiedId(paper.id);
        setTimeout(() => setCopiedId(null), 2000);
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
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-[#0a0f24] text-white p-4 pb-20 font-sans">
            <div className="max-w-2xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-4 mb-6">
                    <Pressable onClick={onBack} className="p-2 bg-white/5 rounded-full">
                        <ArrowLeft className="w-5 h-5" />
                    </Pressable>
                    <div>
                        <h1 className="text-xl font-bold">Question Bank 📝</h1>
                        <p className="text-xs text-gray-400">NTA NEET PYQs & Official Mocks</p>
                    </div>
                </div>

                {/* Filters */}
                <div className="space-y-4 mb-6">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input 
                            type="text" 
                            placeholder="Search by year or title..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-blue-500 transition-all text-white"
                        />
                    </div>

                    <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                        {(['All', 'Main', 'Mock'] as const).map(cat => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
                                    selectedCategory === cat ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white/5 border-white/10 text-gray-400'
                                }`}
                            >
                                {cat === 'Main' ? 'PYQs' : cat === 'Mock' ? 'Practice' : 'All Resources'}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center justify-between p-3 bg-blue-500/5 border border-blue-500/10 rounded-xl">
                        <div className="flex items-center gap-2">
                             <div className={`w-2 h-2 rounded-full ${useMirror ? 'bg-blue-500' : 'bg-green-500 animate-pulse'}`} />
                             <span className="text-[10px] font-bold text-gray-300">
                                {useMirror ? 'USING OFFICIAL NTA SERVER' : 'USING GITHUB CLOUD (Fast Load)'}
                             </span>
                        </div>
                        <button 
                            onClick={() => setUseMirror(!useMirror)}
                            className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${
                                useMirror ? 'bg-blue-600 text-white' : 'bg-white/10 text-gray-400'
                            }`}
                        >
                            {useMirror ? 'Switch to GitHub' : 'Use Official'}
                        </button>
                    </div>
                </div>

                {/* Question List */}
                <div className="space-y-3">
                    {filteredPapers.length > 0 ? filteredPapers.map(paper => (
                        <div 
                            key={paper.id}
                            className="bg-[#161e38] border border-white/5 p-4 rounded-2xl flex flex-col gap-4 group hover:border-blue-500/30 transition-all"
                        >
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center font-bold text-[10px] sm:text-xs ${
                                    paper.category === 'Main' ? 'bg-orange-600/20 text-orange-400' : 'bg-blue-600/20 text-blue-400'
                                }`}>
                                    <FileUp className="w-5 h-5 mb-0.5" />
                                    {paper.year}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-bold text-sm truncate group-hover:text-blue-400 transition-colors">{paper.title}</h3>
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
                            
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => handleOpenPaper(paper)}
                                    className="flex-1 bg-blue-600 hover:bg-blue-700 py-3 rounded-xl text-xs font-bold transition-all shadow-lg shadow-blue-500/20"
                                >
                                    View Question Paper (PDF)
                                </button>
                                <button 
                                    onClick={() => handleShare(paper)}
                                    className="px-4 bg-white/5 hover:bg-gray-700 rounded-xl flex items-center justify-center text-gray-400 hover:text-white transition-all"
                                    title="Copy Deep Link"
                                >
                                    {copiedId === paper.id ? <Check className="w-4 h-4 text-green-500" /> : <Share2 className="w-4 h-4" />}
                                </button>
                                <a 
                                    href={paper.url}
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="px-4 bg-white/5 hover:bg-white/10 rounded-xl flex items-center justify-center text-gray-400 hover:text-white transition-all"
                                    title="Open direct file source"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                </a>
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

            {/* Viewer Modal */}
            {viewerUrl && (
                <AdvancedPDFViewer 
                    pdfUrl={viewerUrl.url}
                    title={viewerUrl.title}
                    onClose={() => setViewerUrl(null)}
                    originalUrl={viewerUrl.originalUrl}
                />
            )}
        </motion.div>
    );
}
