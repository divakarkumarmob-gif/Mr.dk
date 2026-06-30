import React, { useState } from 'react';
import { ArrowLeft, Share2 } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import TestReview from './TestReview';
import TestAnalysis from './TestAnalysis';
import TestTutor from './TestTutor';

export default function TestResultDetail({ result, onBack }: { result: any, onBack: () => void }) {
    const [showReview, setShowReview] = useState(false);
    const [filterType, setFilterType] = useState<'all' | 'correct' | 'incorrect' | 'unattempted'>('all');
    const [showAnalysis, setShowAnalysis] = useState(false);
    const [showTutor, setShowTutor] = useState(false);

    const handlePop = () => {
        const state = window.history.state;
        if (showReview && !state?.isReviewOpen) {
            setShowReview(false);
        } else if (showAnalysis && !state?.isAnalysisOpen) {
            setShowAnalysis(false);
        } else if (showTutor && !state?.isTutorOpen) {
            setShowTutor(false);
        }
    };

    React.useEffect(() => {
        window.addEventListener('popstate', handlePop);
        return () => window.removeEventListener('popstate', handlePop);
    }, [showReview, showAnalysis, showTutor]);

    const handleOpenReview = (type: 'correct' | 'incorrect' | 'unattempted' | 'all') => {
        setFilterType(type);
        setShowReview(true);
        window.history.pushState({ ...window.history.state, isReviewOpen: true }, '', window.location.href);
    };

    const handleOpenAnalysis = () => {
        setShowAnalysis(true);
        window.history.pushState({ ...window.history.state, isAnalysisOpen: true }, '', window.location.href);
    };

    const handleOpenTutor = () => {
        setShowTutor(true);
        window.history.pushState({ ...window.history.state, isTutorOpen: true }, '', window.location.href);
    };

    if (showReview) {
        return <TestReview questions={result.questions || []} answers={result.answers || {}} filterType={filterType} onClose={() => window.history.back()} />;
    }

    if (showAnalysis) {
        return <TestAnalysis result={result} onClose={() => window.history.back()} />;
    }

    if (showTutor) {
        return <TestTutor result={result} onClose={() => window.history.back()} />;
    }

    const scoreData = [
        { name: 'Correct', value: result.correct || 0 },
        { name: 'Remaining', value: (result.totalQuestions || 0) - (result.correct || 0) }
    ];
    const COLORS = ['#3b82f6', '#1e293b'];

    const handleStatClick = (type: 'correct' | 'incorrect' | 'unattempted' | 'all') => {
        handleOpenReview(type);
    };

    return (
        <div className="min-h-screen bg-[#0a0f24] text-white p-6 pb-8">
            <header className="flex justify-between items-center mb-6">
                <button onClick={onBack} className="p-2 bg-[#161e38] rounded-full"><ArrowLeft /></button>
                <h1 className="text-xl font-bold">Analysis</h1>
                <Share2 />
            </header>

            {/* Difficulty Badge */}
            <div className="flex justify-between items-center mb-6">
                <h2 className="font-semibold text-gray-400">Difficulty</h2>
                <span className="bg-[#1e293b] px-4 py-1.5 rounded-lg text-sm text-blue-400 font-bold">{result?.difficulty || 'N/A'}</span>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-4 gap-2 mb-6">
                <StatCard label="Correct" value={result?.correct || 0} color="text-green-500" onClick={() => handleStatClick('correct')} />
                <StatCard label="Incorrect" value={result?.incorrect || 0} color="text-red-500" onClick={() => handleStatClick('incorrect')} />
                <StatCard label="Unattempted" value={result?.unattempted || 0} color="text-blue-500" onClick={() => handleStatClick('unattempted')} />
                <StatCard label="Total" value={result?.totalQuestions || 0} color="text-yellow-500" onClick={() => handleStatClick('all')} />
            </div>

            {/* Main Score Chart */}
            <div className="bg-[#161e38] p-6 rounded-3xl mb-6 flex justify-around items-center">
                <div className="w-32 h-32 relative">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie data={scoreData} innerRadius={40} outerRadius={50} dataKey="value" startAngle={90} endAngle={-270}>
                                {scoreData.map((entry, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                            </Pie>
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col justify-center items-center">
                        <span className="text-2xl font-bold">{result?.percentage || 0}%</span>
                        <span className="text-xs text-gray-400">Score</span>
                    </div>
                </div>
                <div className='flex flex-col items-center'>
                    <div className="font-bold text-4xl">{result?.obtainedMarks || 0}</div>
                    <div className='w-full h-0.5 bg-gray-600 my-1'></div>
                    <div className="font-bold text-4xl text-gray-400">{result?.totalPossibleMarks || ((result?.totalQuestions || 0) * 4)}</div>
                </div>
            </div>

            {/* Performance */}
            <h2 className="font-bold mb-4">Performance</h2>
            <div className="bg-[#161e38] p-6 rounded-3xl space-y-4 mb-6">
                <PerformanceBar label="Accuracy" value={result?.accuracy || 0} />
                <PerformanceBar label="Speed" value={result?.speed || 0} />
                <PerformanceBar label="Attempted" value={result?.attemptedRate || 0} />
            </div>

            {/* Topic Analysis */}
            {result?.topicAnalysis && result.topicAnalysis.length > 0 && (
                <>
                    <div className='flex justify-between items-center mb-4'>
                        <h2 className="font-bold">Topic Analysis</h2>
                        <span className='text-blue-400 text-sm font-semibold'>View All</span>
                    </div>
                    <div className="bg-[#161e38] p-6 rounded-3xl space-y-4">
                        {result.topicAnalysis.map((topic: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center">
                                <span className='text-sm'>{topic.topicName}</span>
                                <span className='font-bold bg-[#0a0f24] px-3 py-1 rounded-lg text-sm'>{topic.correct} / {topic.total}</span>
                            </div>
                        ))}
                    </div>
                </>
            )}

            <div className="flex gap-4 mt-8">
                <button onClick={handleOpenAnalysis} className="flex-1 bg-blue-600 py-4 rounded-2xl font-bold text-lg">Detailed Analysis</button>
                <button onClick={handleOpenTutor} className="flex-1 bg-purple-600 py-4 rounded-2xl font-bold text-lg">Ask Tutor</button>
            </div>
        </div>
    );
}

function StatCard({ label, value, color, onClick }: { label: string, value: number, color: string, onClick?: () => void }) {
    return <div onClick={onClick} className="bg-[#161e38] p-3 rounded-2xl text-center cursor-pointer">
        <div className={`font-bold text-lg ${color}`}>{value}</div>
        <div className={`text-[10px] text-gray-400 uppercase`}>{label}</div>
    </div>
}

function PerformanceBar({ label, value }: { label: string, value: number }) {
    return <div>
        <div className="flex justify-between text-sm mb-2">
            <span className='text-gray-400'>{label}</span>
            <span className='font-bold'>{value}%</span>
        </div>
        <div className="w-full h-2 bg-[#0a0f24] rounded-full">
            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${value}%` }}></div>
        </div>
    </div>
}
