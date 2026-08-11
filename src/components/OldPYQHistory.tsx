
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, Download, FileText, ExternalLink, Calendar, Search } from 'lucide-react';
import AdvancedPDFViewer from './AdvancedPDFViewer';
import { getApiUrl, getPdfViewerUrl } from '@/utils/api';
import { getRamCachedPdf, getCachedPdf, fetchAndCacheByStableKey } from '../lib/pdfCache';
import { AWS_CONFIG } from '../services/awsConfig';

interface PaperLink {
    year: string;
    title: string;
    url: string;
    description?: string;
}

const AWS_CLASSIC_BASE = `${AWS_CONFIG.PDFS_BASE_URL}/classic`;

const PAPERS_DATA: PaperLink[] = [
    { year: '2018', title: 'NEET 2018 Question Paper', url: `${AWS_CLASSIC_BASE}/neet_2018.pdf` },
    { year: '2017', title: 'NEET 2017 Question Paper', url: `${AWS_CLASSIC_BASE}/neet_2017.pdf` },
    { year: '2016', title: 'NEET 2016 Question Paper (Phase 1)', url: `${AWS_CLASSIC_BASE}/neet_2016.pdf` },
    { year: '2016', title: 'NEET 2016 Question Paper (Phase 2)', url: `${AWS_CLASSIC_BASE}/neet_2016_2.pdf` },
    { year: '2015', title: 'NEET 2015 Question Paper', url: `${AWS_CLASSIC_BASE}/neet_2015.pdf` },
    { year: '2015', title: 'RE-NEET 2015 Question Paper', url: `${AWS_CLASSIC_BASE}/re_neet_2015.pdf` },
    { year: '2014', title: 'NEET 2014 Question Paper', url: `${AWS_CLASSIC_BASE}/neet_2014.pdf` },
    { year: '2013', title: 'AIPMT 2013 Question Paper', url: `${AWS_CLASSIC_BASE}/aipmt_2013.pdf` },
    { year: '2012', title: 'AIPMT 2012 Main Paper', url: `${AWS_CLASSIC_BASE}/aipmt_2012_main.pdf` },
    { year: '2012', title: 'AIPMT 2012 Preliminary Paper', url: `${AWS_CLASSIC_BASE}/aipmt_2012_preliminary.pdf` },
    { year: '2011', title: 'AIPMT 2011 Main Paper', url: `${AWS_CLASSIC_BASE}/aipmt_2011_main.pdf` },
    { year: '2011', title: 'AIPMT 2011 Preliminary Paper', url: `${AWS_CLASSIC_BASE}/aipmt_2011_preliminary.pdf` },
    { year: '2010', title: 'AIPMT 2010 Main Paper', url: `${AWS_CLASSIC_BASE}/aipmt_2010_main.pdf` },
    { year: '2010', title: 'AIPMT 2010 Preliminary Paper', url: `${AWS_CLASSIC_BASE}/aipmt_2010_preliminary.pdf` },
    { year: '2009', title: 'AIPMT 2009 Main Paper', url: `${AWS_CLASSIC_BASE}/aipmt_2009_main.pdf` },
    { year: '2009', title: 'AIPMT 2009 Preliminary Paper', url: `${AWS_CLASSIC_BASE}/aipmt_2009_preliminary.pdf` },
    { year: '2008', title: 'AIPMT 2008 Main Paper', url: `${AWS_CLASSIC_BASE}/aipmt_2008_main.pdf` },
    { year: '2008', title: 'AIPMT 2008 Preliminary Paper', url: `${AWS_CLASSIC_BASE}/aipmt_2008_preliminary.pdf` },
    { year: '2007', title: 'AIPMT 2007 Main Paper', url: `${AWS_CLASSIC_BASE}/aipmt_2007_main.pdf` },
    { year: '2007', title: 'AIPMT 2007 Preliminary Paper', url: `${AWS_CLASSIC_BASE}/aipmt_2007_preliminary.pdf` },
    { year: '2006', title: 'AIPMT 2006 Question Paper', url: `${AWS_CLASSIC_BASE}/aipmt_2006.pdf` },
    { year: '2006', title: 'AIPMT 2006 Preliminary Paper', url: `${AWS_CLASSIC_BASE}/aipmt_2006_preliminary.pdf` },
    { year: '2005', title: 'AIPMT 2005 Question Paper', url: `${AWS_CLASSIC_BASE}/aipmt_2005.pdf` },
    { year: '2005', title: 'AIPMT 2005 Preliminary Paper', url: `${AWS_CLASSIC_BASE}/aipmt_2005_preliminary.pdf` },
    { year: '2013', title: 'AIIMS 2013 Question Paper', url: `${AWS_CLASSIC_BASE}/aiims_2013.pdf` },
    { year: '2011', title: 'AIIMS 2011 Question Paper', url: `${AWS_CLASSIC_BASE}/aiims_2011.pdf` },
    { year: '2010', title: 'AIIMS 2010 Question Paper', url: `${AWS_CLASSIC_BASE}/aiims_2010.pdf` },
    { year: '2009', title: 'AIIMS 2009 Question Paper', url: `${AWS_CLASSIC_BASE}/aiims_2009.pdf` },
    { year: '2008', title: 'AIIMS 2008 Question Paper', url: `${AWS_CLASSIC_BASE}/aiims_2008.pdf` },
    { year: '2007', title: 'AIIMS 2007 Question Paper', url: `${AWS_CLASSIC_BASE}/aiims_2007.pdf` }
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

    const openResource = async (paper: PaperLink) => {
        // Use proxy for direct PDFs if possible, or direct URL for sites
        const isDirectPdf = paper.url.toLowerCase().endsWith('.pdf');
        let finalUrl = paper.url;
        if (isDirectPdf) {
            // paper.url is stable (hardcoded), so check RAM/disk cache by it
            // directly before paying for a fresh proxy-token round trip.
            const ramUrl = getRamCachedPdf(paper.url);
            if (ramUrl) {
                setActiveResource({ url: ramUrl, title: paper.title, originalUrl: paper.url });
                return;
            }
            try {
                const diskUrl = await getCachedPdf(paper.url);
                if (diskUrl) {
                    setActiveResource({ url: diskUrl, title: paper.title, originalUrl: paper.url });
                    return;
                }
            } catch {
                // fall through to network fetch below
            }

            try {
                finalUrl = await getPdfViewerUrl(paper.url);
                fetchAndCacheByStableKey(finalUrl, paper.url).catch(() => {});
            } catch (e) {
                console.error("Failed to get PDF token:", e);
                finalUrl = getApiUrl(`/api/proxy-pdf?url=${encodeURIComponent(paper.url)}`);
            }
        }
        setActiveResource({ url: finalUrl, title: paper.title, originalUrl: paper.url });
    };


    return (
        <div className="min-h-dvh bg-[#0a0f24] text-white pb-24 font-sans">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-4">
                <div className="flex items-center gap-3 mb-6 bg-slate-900/80 border border-purple-500/30 p-3.5 px-4 rounded-2xl backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
                    <button 
                        onClick={onBack}
                        className="p-2 bg-purple-500/15 hover:bg-purple-500/30 border border-purple-500/30 text-purple-300 hover:text-white rounded-xl transition cursor-pointer"
                    >
                        <ChevronLeft className="h-5 w-5" />
                    </button>
                    <div>
                        <h1 className="text-lg font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-purple-200 to-pink-300">
                            NEET Legacy PYQs 📜
                        </h1>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-purple-300/80 font-medium">Previous Year Papers (2005 - 2025)</span>
                        </div>
                    </div>
                </div>

            <div className="relative mb-6">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-purple-300" />
                <input 
                    type="text" 
                    placeholder="Search year or paper..." 
                    className="w-full bg-slate-900/80 border border-purple-500/30 rounded-2xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-purple-400 backdrop-blur-xl transition-all text-white placeholder-slate-400 shadow-md"
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
