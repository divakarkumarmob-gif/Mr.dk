import React, { useState } from 'react';
import { ArrowLeft, Share2 } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import TestReview from './TestReview';
import TestAnalysis from './TestAnalysis';
import TestTutor from './TestTutor';

export default function TestResultDetail({ result, onBack }: { result: any, onBack: () => void }) {
    if (!result) return (
        <div className="min-h-screen bg-[#0a0f24] text-white flex flex-col items-center justify-center p-6 text-center">
            <p className="text-xl font-bold mb-4">Result data not found</p>
            <button onClick={onBack} className="px-6 py-2 bg-blue-600 rounded-xl font-bold">Go Back</button>
        </div>
    );

    const [showReview, setShowReview] = useState(false);
    const [filterType, setFilterType] = useState<'all' | 'correct' | 'incorrect' | 'unattempted'>('all');
    const [showAnalysis, setShowAnalysis] = useState(false);
    const [showTutor, setShowTutor] = useState(false);

    const handleOpenReview = (type: 'correct' | 'incorrect' | 'unattempted' | 'all') => {
        setFilterType(type);
        setShowReview(true);
    };

    const handleStatClick = (type: 'correct' | 'incorrect' | 'unattempted' | 'all') => {
        handleOpenReview(type);
    };

    if (showReview) {
        return <TestReview questions={result?.questions || []} answers={result?.answers || {}} filterType={filterType} onClose={() => setShowReview(false)} />;
    }

    if (showAnalysis) {
        return <TestAnalysis result={result} onClose={() => setShowAnalysis(false)} />;
    }

    if (showTutor) {
        return <TestTutor result={result} onClose={() => setShowTutor(false)} />;
    }

    // Safely parse numeric values
    const correct = Number(result?.correct || 0);
    const totalQuestions = Number(result?.totalQuestions || 0);
    const percentage = Number(result?.percentage || result?.score || 0);
    const obtainedMarks = Number(result?.obtainedMarks || 0);
    const totalPossibleMarks = Number(result?.totalPossibleMarks || (totalQuestions * 4));
    
    const accuracy = Number(result?.accuracy || 0);
    const speed = Number(result?.speed || 0);
    const attemptedRate = Number(result?.attemptedRate || 0);

    const scoreData = [
        { name: 'Correct', value: isNaN(correct) ? 0 : correct },
        { name: 'Remaining', value: Math.max(0, (isNaN(totalQuestions) ? 0 : totalQuestions) - (isNaN(correct) ? 0 : correct)) }
    ];
    const COLORS = ['#3b82f6', '#1e293b'];

    return (
        <div className="min-h-screen bg-[#0a0f24] text-white p-6 pb-44 overflow-y-auto">
            <header className="flex justify-between items-center mb-6">
                <button onClick={onBack} className="p-2 bg-[#161e38] rounded-full"><ArrowLeft /></button>
                <h1 className="text-xl font-bold">Analysis</h1>
                <Share2 className="text-gray-400" />
            </header>

            {/* Difficulty Badge */}
            <div className="bg-[#161e38] p-4 rounded-3xl mb-6 flex justify-between items-center">
                <h2 className="font-semibold text-gray-400">Difficulty</h2>
                <span className="bg-[#1e293b] px-4 py-1.5 rounded-lg text-sm text-blue-400 font-bold">{result?.difficulty || 'Moderate'}</span>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-4 gap-2 mb-6">
                <StatCard label="Correct" value={isNaN(correct) ? 0 : correct} color="text-green-500" onClick={() => handleStatClick('correct')} />
                <StatCard label="Incorrect" value={Number(result?.incorrect || 0)} color="text-red-500" onClick={() => handleStatClick('incorrect')} />
                <StatCard label="Unattempted" value={Number(result?.unattempted || 0)} color="text-blue-500" onClick={() => handleStatClick('unattempted')} />
                <StatCard label="Total" value={isNaN(totalQuestions) ? 0 : totalQuestions} color="text-yellow-500" onClick={() => handleStatClick('all')} />
            </div>

            {/* Main Score Chart */}
            <div className="bg-[#161e38] p-8 rounded-3xl mb-8 flex justify-between items-center relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                <div className="w-32 h-32 relative z-10">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie 
                                data={scoreData} 
                                innerRadius={40} 
                                outerRadius={50} 
                                dataKey="value" 
                                startAngle={90} 
                                endAngle={-270}
                                stroke="none"
                            >
                                {scoreData.map((entry, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                            </Pie>
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col justify-center items-center">
                        <span className="text-2xl font-bold">{isNaN(percentage) ? 0 : percentage}%</span>
                        <span className="text-[10px] text-gray-500 uppercase tracking-tighter">Score</span>
                    </div>
                </div>
                <div className="flex flex-col items-end z-10">
                    <div className="font-bold text-4xl">{obtainedMarks}</div>
                    <div className='w-full h-0.5 bg-gray-600/30 my-1'></div>
                    <div className="font-bold text-4xl text-gray-400">{totalPossibleMarks}</div>
                </div>
            </div>

            {/* Performance Bars */}
            <h2 className="font-bold mb-4 ml-1">Performance</h2>
            <div className="bg-[#161e38] p-6 rounded-3xl space-y-4 mb-6">
                <PerformanceBar label="Accuracy" value={isNaN(accuracy) ? 0 : accuracy} />
                <PerformanceBar label="Speed" value={isNaN(speed) ? 0 : speed} />
                <PerformanceBar label="Attempted" value={isNaN(attemptedRate) ? 0 : attemptedRate} />
            </div>

            {/* Topic Analysis */}
            {result?.topicAnalysis && Array.isArray(result.topicAnalysis) && result.topicAnalysis.length > 0 && (
                <>
                    <div className='flex justify-between items-center mb-4 ml-1'>
                        <h2 className="font-bold">Topic Analysis</h2>
                    </div>
                    <div className="bg-[#161e38] p-6 rounded-3xl space-y-4 mb-8">
                        {result.topicAnalysis.map((topic: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center">
                                <span className='text-sm text-gray-300'>{topic?.topicName || 'Unknown Topic'}</span>
                                <span className='font-bold bg-[#0a0f24] px-3 py-1 rounded-lg text-sm text-blue-400'>{topic?.correct || 0} / {topic?.total || 0}</span>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4">
                <button 
                    onClick={() => setShowAnalysis(true)}
                    className="flex-1 bg-blue-600 py-4 rounded-2xl font-bold active:scale-95 transition-all shadow-xl shadow-blue-600/20"
                >
                    Deep Analysis
                </button>
                <button 
                    onClick={() => setShowTutor(true)}
                    className="flex-1 bg-purple-600 py-4 rounded-2xl font-bold active:scale-95 transition-all"
                >
                    Ask AI Tutor
                </button>
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
