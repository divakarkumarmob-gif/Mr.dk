
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, Download, FileText, ExternalLink, Calendar, Search } from 'lucide-react';
import AdvancedPDFViewer from './AdvancedPDFViewer';
import { getApiUrl } from '@/utils/api';

interface PaperLink {
    year: string;
    title: string;
    url: string;
    description?: string;
}

const GITHUB_BASE = 'https://raw.githubusercontent.com/divakarkumarmob-gif/NEET-PYQ-/main';

const PAPERS_DATA: PaperLink[] = [
    { year: '2018', title: 'NEET 2018 Question Paper', url: `${GITHUB_BASE}/NEET%202018.pdf` },
    { year: '2017', title: 'NEET 2017 Question Paper', url: `${GITHUB_BASE}/NEET%202017.pdf` },
    { year: '2016', title: 'NEET 2016 Question Paper (Phase 1)', url: `${GITHUB_BASE}/NEET%202016.pdf` },
    { year: '2016', title: 'NEET 2016 Question Paper (Phase 2)', url: `${GITHUB_BASE}/NEET%202016(2).pdf` },
    { year: '2015', title: 'NEET 2015 Question Paper', url: `${GITHUB_BASE}/NEET%202015.pdf` },
    { year: '2015', title: 'RE-NEET 2015 Question Paper', url: `${GITHUB_BASE}/RE-NEET%202015.pdf` },
    { year: '2014', title: 'NEET 2014 Question Paper', url: `${GITHUB_BASE}/NEET%202014.pdf` },
    { year: '2013', title: 'AIPMT 2013 Question Paper', url: `${GITHUB_BASE}/AIPMT%202013.pdf` },
    { year: '2012', title: 'AIPMT 2012 Main Paper', url: `${GITHUB_BASE}/AIPMT%202012%20Main.pdf` },
    { year: '2012', title: 'AIPMT 2012 Preliminary Paper', url: `${GITHUB_BASE}/AIPMT%202012_Preliminary.pdf` },
    { year: '2011', title: 'AIPMT 2011 Main Paper', url: `${GITHUB_BASE}/AIPMT%202011%20Main.pdf` },
    { year: '2011', title: 'AIPMT 2011 Preliminary Paper', url: `${GITHUB_BASE}/AIPMT%202011_Preliminary.pdf` },
    { year: '2010', title: 'AIPMT 2010 Main Paper', url: `${GITHUB_BASE}/AIPMT%202010%20Main.pdf` },
    { year: '2010', title: 'AIPMT 2010 Preliminary Paper', url: `${GITHUB_BASE}/AIPMT%202010_Preliminary.pdf` },
    { year: '2009', title: 'AIPMT 2009 Main Paper', url: `${GITHUB_BASE}/AIPMT%202009_Main.pdf` },
    { year: '2009', title: 'AIPMT 2009 Preliminary Paper', url: `${GITHUB_BASE}/AIPMT%202009_Preliminary.pdf` },
    { year: '2009', title: 'AIIMS 2009 Question Paper', url: `${GITHUB_BASE}/AIIMS%202009.pdf` },
    { year: '2008', title: 'AIPMT 2008 Main Paper', url: `${GITHUB_BASE}/AIPMT%202008%20Main.pdf` },
    { year: '2008', title: 'AIPMT 2008 Preliminary Paper', url: `${GITHUB_BASE}/AIPMT%202008%20Preliminary.pdf` },
    { year: '2008', title: 'AIIMS 2008 Question Paper', url: `${GITHUB_BASE}/AIIMS%202008.pdf` },
    { year: '2007', title: 'AIPMT 2007 Main Paper', url: `${GITHUB_BASE}/AIPMT%202007%20Main.pdf` },
    { year: '2007', title: 'AIPMT 2007 Preliminary Paper', url: `${GITHUB_BASE}/AIPMT%202007%20Preliminary.pdf` },
    { year: '2007', title: 'AIIMS 2007 Question Paper', url: `${GITHUB_BASE}/AIIMS%202007.pdf` },
    { year: '2006', title: 'AIPMT 2006 Question Paper', url: `${GITHUB_BASE}/AIPMT%202006.pdf` },
    { year: '2006', title: 'AIPMT 2006 Preliminary Paper', url: `${GITHUB_BASE}/AIPMT%202006_Preliminary.pdf` },
    { year: '2005', title: 'AIPMT 2005 Question Paper', url: `${GITHUB_BASE}/2005.pdf` },
];

interface Props {
    onBack: () => void;
}

export default function OldPYQHistory({ onBack }: Props) {
    const [searchQuery, setSearchQuery] = useState('');
    const [activeResource, setActiveResource] = useState<{ url: string; title: string; originalUrl?: string } | null>(null);

    const filteredPapers = PAPERS_DATA.filter(p => 
        p.year.includes(searchQuery) || 
        p.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const openResource = (paper: PaperLink) => {
        // Use proxy for direct PDFs if possible, or direct URL for sites
        const isDirectPdf = paper.url.toLowerCase().endsWith('.pdf');
        const finalUrl = isDirectPdf ? getApiUrl(`/api/proxy-pdf?url=${encodeURIComponent(paper.url)}`) : paper.url;
        setActiveResource({ url: finalUrl, title: paper.title, originalUrl: paper.url });
    };

    return (
        <div className="min-h-screen bg-[#05070A] text-white p-4 pb-24">
            <div className="flex items-center gap-3 mb-6">
                <button 
                    onClick={onBack}
                    className="p-2 hover:bg-white/10 rounded-full transition"
                >
                    <ChevronLeft className="h-6 w-6" />
                </button>
                <div>
                    <h1 className="text-xl font-bold">NEET Legacy PYQs</h1>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">Previous Year Papers (2005 - 2025)</span>
                    </div>
                </div>
            </div>

            <div className="relative mb-6">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
                <input 
                    type="text" 
                    placeholder="Search year or paper..." 
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            <div className="grid grid-cols-1 gap-3">
                {filteredPapers.map((paper, idx) => (
                    <motion.div 
                    key={`${paper.year}-${paper.title}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="bg-white/5 p-4 rounded-2xl border border-white/10 hover:bg-white/[0.08] transition group"
                    >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                        <div className="bg-blue-600/20 p-2.5 rounded-xl">
                            <Calendar className="h-6 w-6 text-blue-400" />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-100">{paper.title}</h3>
                            <p className="text-xs text-gray-500">Official Question Paper & Solutions</p>
                        </div>
                        </div>
                        <button 
                        onClick={() => openResource(paper)}
                        className="bg-white/10 hover:bg-white/20 p-2.5 rounded-xl transition flex items-center gap-2 group-hover:bg-blue-600 group-hover:text-white"
                        >
                        <FileText className="h-5 w-5" />
                        <span className="text-xs font-bold sm:inline hidden">View Paper</span>
                        </button>
                    </div>
                    </motion.div>
                ))}
            </div>

            {activeResource && (
                <AdvancedPDFViewer 
                    pdfUrl={activeResource.url} 
                    title={activeResource.title} 
                    onClose={() => setActiveResource(null)}
                    originalUrl={activeResource.url}
                    initialScale={0.6}
                />
            )}
        </div>
    );
}
