import React, { useState, useEffect } from 'react';
import PYQTestRunner from './PYQTestRunner';

export default function PracticeTest({ chapters, onBack }: { chapters: {name: string, subject: string, numQuestions: number, difficulty: 'Medium' | 'Hard'}[], onBack: () => void }) {
    const [questions, setQuestions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchQuestionsForChapter = async (chapter: {name: string, subject: string, numQuestions: number, difficulty: 'Medium' | 'Hard'}) => {
            const encodedSubject = chapter.subject.toLocaleLowerCase();
            const chapterName = chapter.name;
            
            let allChunks: any[] = [];
            let chunkNumber = 1;
            
            while (chunkNumber <= 10) {
                let successfulFetch = false;
                
                // Try multiple name variations
                const nameVariations = [
                    chapterName,
                    chapterName.replace(/ & /g, ' and '),
                    chapterName.replace(/ and /g, ' & '),
                    chapterName.toLocaleLowerCase()
                ];

                for (const variant of nameVariations) {
                    const patterns = [
                        `https://raw.githubusercontent.com/divakarkumarmob-gif/class-11/main/${encodedSubject}/${encodeURIComponent(variant)}/${encodeURIComponent(variant)}%20(${chunkNumber}).json`,
                        `https://raw.githubusercontent.com/divakarkumarmob-gif/class-11/main/${encodedSubject}/${encodeURIComponent(variant)}/${variant.toLocaleLowerCase().replace(/ /g, '_').replace(/:/g, '').replace(/_+/g, '_')}_chunk${chunkNumber}.json`
                    ];

                    for (const url of patterns) {
                        try {
                            const response = await fetch(url);
                            if (response.ok) {
                                const data = await response.json();
                                if (data) {
                                    const questionsArray = Array.isArray(data) ? data : data.questions;
                                    if (questionsArray && Array.isArray(questionsArray)) {
                                        allChunks.push(questionsArray);
                                        successfulFetch = true;
                                        break;
                                    }
                                }
                            }
                        } catch (e) {
                            // Silently continue to next pattern
                        }
                    }
                    if (successfulFetch) break;
                }

                if (!successfulFetch) break;
                chunkNumber++;
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
                        A: q.options[0] || "",
                        B: q.options[1] || "",
                        C: q.options[2] || "",
                        D: q.options[3] || ""
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
                    explanation: q.explanation || "No explanation provided."
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

    const testTitle = chapters.map(c => c.name).join(', ');                

    return <PYQTestRunner questions={questions} title={testTitle} onBack={onBack} />;
}
