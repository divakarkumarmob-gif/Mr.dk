import React, { useState, useEffect } from 'react';
import PYQTestRunner from './PYQTestRunner';

export default function PracticeTest({ chapters, onBack }: { chapters: {name: string, subject: string, numQuestions: number, difficulty: 'Medium' | 'Hard'}[], onBack: () => void }) {
    const [questions, setQuestions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchQuestionsForChapter = async (chapter: {name: string, subject: string, numQuestions: number, difficulty: 'Medium' | 'Hard'}) => {
            const encodedSubject = encodeURIComponent(chapter.subject.toLocaleLowerCase());
            const encodedChapterDir = encodeURIComponent(chapter.name.toLocaleLowerCase());
            
            let allChunks: any[] = [];
            let chunkNumber = 1;
            
            while (true) {
                let url = "";
                const formattedName = chapter.name.toLocaleLowerCase().replace(/ /g, '_');
                url = `https://raw.githubusercontent.com/divakarkumarmob-gif/class-11/main/${encodedSubject}/${encodedChapterDir}/${formattedName}_chunk${chunkNumber}.json`;
                console.log("Fetching URL:", url);

                try {
                    const response = await fetch(url);
                    if (!response.ok) break;
                    const data = await response.json();
                    
                    if (data.questions && Array.isArray(data.questions)) {
                        allChunks.push(data.questions);
                    } else {
                        break;
                    }
                    chunkNumber++;
                } catch (e) {
                    break;
                }
            }
            
            let allQuestions: any[] = [];
            if (chapter.difficulty === 'Hard') {
                // Only chunks 3 and onwards (filter index >= 2)
                allQuestions = allChunks.filter((_, index) => index >= 2).flat();
            } else {
                allQuestions = allChunks.flat();
            }
                
            return allQuestions.sort(() => Math.random() - 0.5).slice(0, chapter.numQuestions).map((q: any, i: number) => ({
                id: `${chapter.name}_${i}`,
                question: q.question,
                options: q.options,
                correct_option: q.correct_option,
                explanation: q.explanation
            }));
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
