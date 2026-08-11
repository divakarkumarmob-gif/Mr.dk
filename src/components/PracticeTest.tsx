import React, { useState, useEffect } from 'react';
import PYQTestRunner from './PYQTestRunner';
import { AWSQuestionService } from '../services/awsQuestionService';

export default function PracticeTest({ chapters, onBack }: { chapters: {name: string, subject: string, numQuestions: number, difficulty: 'Medium' | 'Hard'}[], onBack: () => void }) {
    const [questions, setQuestions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchQuestionsForChapter = async (chapter: {name: string, subject: string, numQuestions: number, difficulty: 'Medium' | 'Hard'}) => {
            const chapterName = chapter.name;
            let allChunks: any[] = [];

            try {
                const catalog = await AWSQuestionService.fetchMasterCatalog();
                const cleanSlug = chapterName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

                let targetChapter = catalog?.chapters.find(c => c.slug === cleanSlug || c.chapter_name.toLowerCase() === chapterName.toLowerCase());

                if (!targetChapter && catalog) {
                    targetChapter = catalog.chapters.find(c => c.chapter_name.toLowerCase().includes(cleanSlug.replace(/_/g, ' ')));
                }

                if (targetChapter && targetChapter.files && targetChapter.files.length > 0) {
                    for (const relFile of targetChapter.files) {
                        const chunkData = await AWSQuestionService.fetchChapterQuestions(relFile);
                        if (chunkData && Array.isArray(chunkData) && chunkData.length > 0) {
                            allChunks.push(chunkData);
                        }
                    }
                }
            } catch (e) {
                console.warn("Error fetching questions from AWS S3:", e);
            }

            let allQuestions: any[] = [];
            if (chapter.difficulty === 'Hard' && allChunks.length >= 3) {
                allQuestions = allChunks.filter((_, index) => index >= 2).flat();
            } else {
                allQuestions = allChunks.flat();
            }

            return allQuestions.sort(() => Math.random() - 0.5).slice(0, chapter.numQuestions).map((q: any, i: number) => {
                let transformedOptions = q.options;
                if (Array.isArray(q.options)) {
                    transformedOptions = {
                        A: q.options[0] || 'N/A',
                        B: q.options[1] || 'N/A',
                        C: q.options[2] || 'N/A',
                        D: q.options[3] || 'N/A'
                    };
                }

                let transformedCorrect = q.correct_option;
                if (typeof q.correct_option === 'number') {
                    transformedCorrect = ['A', 'B', 'C', 'D'][q.correct_option] || 'A';
                }

                return {
                    id: `${chapter.name}_${i}_${Math.random().toString(36).substr(2, 9)}`,
                    question: q.question,
                    options: transformedOptions,
                    correct_option: transformedCorrect,
                    explanation: q.explanation || "No explanation provided.",
                    chapter: chapter.name,
                    subject: chapter.subject,
                };
            });
        };

        const fetchAll = async () => {
            setLoading(true);
            const allQuestions = await Promise.all(chapters.map(fetchQuestionsForChapter));
            const flattened = allQuestions.flat();
            setQuestions(flattened.length > 0 ? flattened : [{
                id: "TEST_1",
                question: "No questions found.",
                options: { A: "N/A", B: "N/A", C: "N/A", D: "N/A" },
                correct_option: "A",
                explanation: "Please select different chapters or check your internet connection."
            }]);
            setLoading(false);
        };
        fetchAll();
    }, [chapters]);

    if (loading) return <div className="text-white p-6">Connecting to test...</div>;

    const testTitle = chapters.length > 1 ? "Custom Mixed" : chapters.map(c => c.name).join(', ');

    return <PYQTestRunner questions={questions} title={testTitle} onBack={onBack} />;
}
