import { useState, useMemo, useEffect } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Search, Shuffle, CheckCircle, XCircle } from 'lucide-react';
import { CHAPTER_DATA } from '../constants';
import { db, auth, OperationType, handleFirestoreError } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';                

// Function to fetch flashcards for a specific chapter
const fetchFlashcards = async (chapterName: string) => {
    try {
        let subject = "physics"; // Default
        for (const [sub, classes] of Object.entries(CHAPTER_DATA)) {
            for (const classChapters of Object.values(classes)) {
                if ((classChapters as string[]).includes(chapterName)) {
                    subject = sub.toLowerCase();
                    break;
                }
            }
        }
        
        console.log(`Debug: chapterName=${chapterName}, subject=${subject}`);
        
        let formattedName = chapterName.toLowerCase().replace(/ /g, '_').replace(/:/g, '').replace(/_+/g, '_');
        if (formattedName === "cell_the_unit_of_life") {
            formattedName = "cell_unit_of_life";
        }

        const encodedSubject = encodeURIComponent(subject.toLowerCase());
        const encodedChapterDir = encodeURIComponent(chapterName.toLowerCase());
        
        let allQuestions: any[] = [];
        let chunkNumber = 1;
        
        while (true) {
            const url = `https://raw.githubusercontent.com/divakarkumarmob-gif/class-11/main/${encodedSubject}/${encodedChapterDir}/${formattedName}_chunk${chunkNumber}.json`;
            console.log(`Fetching flashcards chunk ${chunkNumber} from: ${url}`);
            
            try {
                const response = await fetch(url);
                if (!response.ok) {
                    console.log(`Failed to fetch ${url}, status: ${response.status}`);
                    break;
                }
                const data = await response.json();
                
                if (data.questions && Array.isArray(data.questions)) {
                    allQuestions.push(...data.questions);
                } else {
                    break;
                }
                chunkNumber++;
            } catch (e) {
                console.error(`Error fetching ${url}:`, e);
                break;
            }
        }
        
        if (allQuestions.length === 0) {
            throw new Error(`No flashcards found for ${chapterName} at ${encodedSubject}/${encodedChapterDir}`);
        }
        
        return allQuestions.map((q: any, index: number) => ({
            id: index,
            front: q.question,
            back: q.explanation || "No explanation provided"
        }));
    } catch (error) {
        console.error("Error fetching flashcards:", error);
        return [];
    }
};

export default function Flashcards({ onClose }: { onClose: () => void }) {
    const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [index, setIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [knownCards, setKnownCards] = useState<Set<number>>(new Set());
    const [shuffledCards, setShuffledCards] = useState<any[]>([]);

    const allChapters = useMemo(() => {
        const chapters: string[] = [];
        Object.entries(CHAPTER_DATA).forEach(([subject, classes]) => {
            Object.entries(classes).forEach(([className, chapterList]) => {
                chapters.push(...chapterList as string[]);
            });
        });
        return Array.from(new Set(chapters));
    }, []);

    const filteredChapters = useMemo(() => {
        return allChapters.filter(chapter => chapter.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [allChapters, searchQuery]);

    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (selectedChapter && auth.currentUser) {
            setLoading(true);
            const loadData = async () => {
                const allCards = await fetchFlashcards(selectedChapter);
                
                // Fetch mastery from Firestore
                let mastered: number[] = [];
                try {
                  const masteryRef = doc(db, 'users', auth.currentUser!.uid, 'flashcards', selectedChapter.toLowerCase().replace(/ /g, '_'));
                  const docSnap = await getDoc(masteryRef);
                  if (docSnap.exists()) {
                    mastered = docSnap.data().masteredQuestionIds || [];
                  }
                } catch (error) {
                  handleFirestoreError(error, OperationType.GET, 'users/userId/flashcards/chapterId');
                }
                
                let available = allCards.filter(c => !mastered.includes(c.id));
                
                // If all seen, reset
                if (available.length === 0) {
                    available = allCards;
                }
                
                const sessionCards = available.slice(0, 15);
                setShuffledCards(sessionCards);
                setIndex(0);
                setKnownCards(new Set());
                setLoading(false);
            };
            loadData();
        }
    }, [selectedChapter]);

    const submitSession = async () => {
        if (selectedChapter && auth.currentUser) {
            const masteryRef = doc(db, 'users', auth.currentUser.uid, 'flashcards', selectedChapter.toLowerCase().replace(/ /g, '_'));
            const currentIds = shuffledCards.map(c => c.id);
            
            // Fetch existing mastered IDs to merge
            let existingMastered: number[] = [];
            try {
                const docSnap = await getDoc(masteryRef);
                if (docSnap.exists()) existingMastered = docSnap.data().masteredQuestionIds || [];
            } catch (error) {
                console.error("Error fetching existing mastery", error);
            }

            const newMasteredIds = Array.from(new Set([...existingMastered, ...currentIds]));

            try {
              await setDoc(masteryRef, { 
                masteredQuestionIds: newMasteredIds,
                userId: auth.currentUser.uid,
                chapterName: selectedChapter
              }, { merge: true });
            } catch (error) {
              handleFirestoreError(error, OperationType.WRITE, 'users/userId/flashcards/chapterId');
            }
            setSelectedChapter(null);
        }
    };

    const toggleKnown = (cardId: number) => {
        setKnownCards(prev => {
            const next = new Set(prev);
            if (next.has(cardId)) next.delete(cardId);
            else next.add(cardId);
            return next;
        });
    };

    const shuffle = () => {
        setShuffledCards(prev => [...prev].sort(() => Math.random() - 0.5));
        setIndex(0);
        setIsFlipped(false);
    };

    if (selectedChapter) {
        if (loading) {
            return (
                <div className="fixed inset-0 bg-[#0a0f24] z-[100] p-6 flex flex-col items-center justify-center text-white">
                    <p>Loading flashcards...</p>
                </div>
            );
        }
        if (shuffledCards.length === 0) {
            return (
                <div className="fixed inset-0 bg-[#0a0f24] z-[100] p-6 flex flex-col items-center justify-center text-white">
                    <button onClick={() => setSelectedChapter(null)} className="absolute top-4 left-4 text-white"><ArrowLeft /></button>
                    <p>No flashcards found for this chapter.</p>
                </div>
            );
        }
        const card = shuffledCards[index];
        return (
            <div className="fixed inset-0 bg-[#0a0f24] z-[100] p-6 flex flex-col items-center justify-center">
                <button onClick={() => setSelectedChapter(null)} className="absolute top-4 left-4 text-white"><ArrowLeft /></button>
                <div className="absolute top-4 right-4 text-white font-bold">{index + 1} / {shuffledCards.length}</div>
                
                <h2 className="text-xl font-bold text-white mb-4">{selectedChapter}</h2>
                <div className="w-full bg-white/20 h-2 rounded-full mb-8 overflow-hidden">
                    <div className="bg-orange-500 h-full" style={{ width: `${((index + 1) / shuffledCards.length) * 100}%` }}></div>
                </div>
                
                <motion.div 
                    className="w-full max-w-sm h-64 bg-white/10 rounded-2xl p-6 cursor-pointer flex items-center justify-center text-center text-white mb-8"
                    onClick={() => setIsFlipped(!isFlipped)}
                    animate={{ rotateY: isFlipped ? 180 : 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <div style={{ transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
                        {isFlipped ? <p>{card.back}</p> : <p className="font-bold">{card.front}</p>}
                    </div>
                </motion.div>
                
                <div className="flex gap-4 mb-4">
                    <button onClick={() => toggleKnown(card.id)} className={`p-3 rounded-full ${knownCards.has(card.id) ? 'bg-green-600' : 'bg-white/10'}`}><CheckCircle className="text-white" /></button>
                    <button onClick={() => toggleKnown(card.id)} className={`p-3 rounded-full ${!knownCards.has(card.id) ? 'bg-red-600' : 'bg-white/10'}`}><XCircle className="text-white" /></button>
                </div>

                <div className="flex gap-4">
                    <button onClick={shuffle} className="bg-white/10 text-white p-2 rounded-lg"><Shuffle /></button>
                    <button 
                      onClick={() => { setIndex((index - 1 + shuffledCards.length) % shuffledCards.length); setIsFlipped(false); }}
                      className="bg-white/10 text-white px-6 py-2 rounded-lg font-bold"
                    >Prev</button>
                    <button 
                      onClick={() => {
                          if (index === shuffledCards.length - 1) {
                              submitSession();
                          } else {
                              setIndex((index + 1) % shuffledCards.length);
                              setIsFlipped(false);
                          }
                      }}
                      className="bg-orange-600 text-white px-6 py-2 rounded-lg font-bold"
                    >{index === shuffledCards.length - 1 ? 'Submit' : 'Next'}</button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-[#0a0f24] z-[100] p-6 flex flex-col">
            <div className="flex items-center gap-4 mb-6">
                <button onClick={onClose} className="text-white"><ArrowLeft /></button>
                <h2 className="text-xl font-bold text-white">Select Chapter</h2>
            </div>
            
            <div className="relative mb-6">
                <Search className="absolute left-3 top-3 h-5 w-5 text-gray-500" />
                <input 
                    type="text" 
                    placeholder="Search chapters..." 
                    className="w-full bg-white/10 text-white rounded-lg pl-10 pr-4 py-2"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2">
                {filteredChapters.map(chapter => (
                    <button 
                        key={chapter} 
                        onClick={() => setSelectedChapter(chapter)} 
                        className="w-full bg-white/5 text-white text-left p-4 rounded-lg hover:bg-white/10"
                    >
                        {chapter}
                    </button>
                ))}
            </div>
        </div>
    );
}
