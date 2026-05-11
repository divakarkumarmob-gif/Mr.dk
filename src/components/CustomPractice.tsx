import { useState } from 'react';
import { ArrowLeft, Search } from 'lucide-react';

const CHAPTER_DATA = {
    Physics: {
        'Class 11': [
            'Physical World', 'Units and Measurements', 'Motion in a Straight Line', 'Motion in a Plane',
            'Laws of Motion', 'Work, Energy and Power', 'Systems of Particles and Rotational Motion', 'Gravitation',
            'Mechanical Properties of Solids', 'Mechanical Properties of Fluids', 'Thermal Properties of Matter',
            'Thermodynamics', 'Kinetic Theory', 'Oscillations', 'Waves'
        ],
        'Class 12': [
            'Electric Charges and Fields', 'Electrostatic Potential and Capacitance', 'Current Electricity',
            'Moving Charges and Magnetism', 'Magnetism and Matter', 'Electromagnetic Induction', 'Alternating Current',
            'Electromagnetic Waves', 'Ray Optics and Optical Instruments', 'Wave Optics',
            'Dual Nature of Radiation and Matter', 'Atoms', 'Nuclei', 'Semiconductor Electronics'
        ]
    },
    Chemistry: {
        'Class 11': [
            'Some Basic Concepts of Chemistry', 'Structure of Atom', 'Classification of Elements and Periodicity in Properties',
            'Chemical Bonding and Molecular Structure', 'Thermodynamics', 'Equilibrium', 'Redox Reactions',
            'Organic Chemistry: Some Basic Principles and Techniques', 'Hydrocarbons'
        ],
        'Class 12': [
            'Solutions', 'Electrochemistry', 'Chemical Kinetics', 'd-and f-Block Elements', 'Coordination Compounds',
            'Haloalkanes and Haloarenes', 'Alcohols, Phenols and Ethers', 'Aldehydes, Ketones and Carboxylic Acids',
            'Amines', 'Biomolecules'
        ]
    },
    Biology: {
        'Class 11': [
            'The Living World', 'Biological Classification', 'Plant Kingdom', 'Animal Kingdom',
            'Morphology of Flowering Plants', 'Anatomy of Flowering Plants', 'Structural Organisation in Animals',
            'Cell: The Unit of Life', 'Biomolecules', 'Cell Cycle and Cell Division',
            'Photosynthesis in Higher Plants', 'Respiration in Plants', 'Plant Growth and Development',
            'Breathing and Exchange of Gases', 'Body Fluids and Circulation', 'Excretory Products and their Elimination',
            'Locomotion and Movement', 'Neural Control and Coordination', 'Chemical Coordination and Integration'
        ],
        'Class 12': [
            'Sexual Reproduction in Flowering Plants', 'Human Reproduction', 'Reproductive Health',
            'Principles of Inheritance and Variation', 'Molecular Basis of Inheritance', 'Evolution',
            'Human Health and Disease', 'Microbes in Human Welfare',
            'Biotechnology: Principles and Processes', 'Biotechnology and its Applications',
            'Organisms and Populations', 'Ecosystem', 'Biodiversity and Conservation'
        ]
    }
};

export default function CustomPractice({ onBack, onStart }: { onBack: () => void, onStart: (chapters: {name: string, subject: string, numQuestions: number, difficulty: 'Medium' | 'Hard'}[]) => void }) {
    const [activeSubject, setActiveSubject] = useState<'Physics' | 'Chemistry' | 'Biology'>('Physics');
    const [activeClass, setActiveClass] = useState<'Class 11' | 'Class 12'>('Class 11');
    const [searchQuery, setSearchQuery] = useState('');
    const [difficulty, setDifficulty] = useState<'Medium' | 'Hard'>('Medium');
    const [selectedChapters, setSelectedChapters] = useState<{name: string, subject: string, numQuestions: number}[]>([]);
    const [popupState, setPopupState] = useState<{
        open: boolean;
        chapter: {name: string, subject: string} | null;
        count: number;
    }>({ open: false, chapter: null, count: 10 });

    const chapters = CHAPTER_DATA[activeSubject][activeClass].filter((c: string) => c.toLowerCase().includes(searchQuery.toLowerCase()));

    const handleSelectChapter = (chapter: string, subject: string) => {
        if (selectedChapters.some(c => c.name === chapter)) {
            setSelectedChapters(prev => prev.filter(c => c.name !== chapter));
        } else {
            setPopupState({ open: true, chapter: {name: chapter, subject}, count: 10 });
        }
    };

    return (
        <div className="min-h-screen bg-[#0a0f24] text-white p-4 sm:p-6 pb-24">
            <div className="max-w-md mx-auto sm:max-w-2xl lg:max-w-4xl">
                <div className="flex items-center gap-4 mb-6">
                <button onClick={onBack} className="bg-white/10 p-2 rounded-full"><ArrowLeft /></button>
                <h1 className="text-xl font-bold">Custom Practice</h1>
            </div>

            <div className="relative mb-6">
                <Search className="absolute left-3 top-3.5 text-gray-500 h-5 w-5" />
                <input
                    type="text"
                    placeholder="Search chapters..."
                    className="w-full bg-[#161e38] p-3 pl-10 rounded-xl outline-none"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            <div className="flex bg-[#161e38] p-1 rounded-xl mb-6">
                {(['Physics', 'Chemistry', 'Biology'] as const).map(sub => (
                    <button key={sub} className={`flex-1 py-2 text-sm font-bold rounded-lg ${activeSubject === sub ? 'bg-blue-600' : ''}`} onClick={() => { setActiveSubject(sub); setSearchQuery(''); }}>{sub}</button>
                ))}
            </div>

            <div className="flex bg-[#161e38] p-1 rounded-xl mb-6">
                {(['Class 11', 'Class 12'] as const).map(cls => (
                    <button key={cls} className={`flex-1 py-2 text-sm font-bold rounded-lg ${activeClass === cls ? 'bg-blue-600' : ''}`} onClick={() => { setActiveClass(cls); setSearchQuery(''); }}>{cls}</button>
                ))}
            </div>
            
            <div className="mb-6">
                <p className="text-gray-400 mb-2">Difficulty</p>
                <div className="flex bg-[#161e38] p-1 rounded-xl">
                    {(['Medium', 'Hard'] as const).map(diff => (
                        <button key={diff} className={`flex-1 py-2 text-sm font-bold rounded-lg ${difficulty === diff ? 'bg-blue-600' : ''}`} onClick={() => setDifficulty(diff)}>{diff}</button>
                    ))}
                </div>
            </div>

            <div className="space-y-3">
                {chapters.map(chapter => (
                    <div key={chapter} className="bg-[#161e38] p-4 rounded-xl flex items-center justify-between" onClick={() => handleSelectChapter(chapter, activeSubject)}>
                        <span className={selectedChapters.some(c => c.name === chapter) ? 'text-blue-400 font-bold' : ''}>{chapter}</span>
                        <input type="checkbox" className="h-5 w-5" checked={selectedChapters.some(c => c.name === chapter)} readOnly />
                    </div>
                ))}
            </div>

            {popupState.open && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6" onClick={() => setPopupState({...popupState, open: false})}>
                    <div className="bg-[#161e38] p-6 rounded-2xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
                        <h2 className="text-xl font-bold mb-4">Select Questions for {popupState.chapter?.name}</h2>
                        <input type="range" min="5" max="50" step="5" value={popupState.count} onChange={(e) => setPopupState({...popupState, count: parseInt(e.target.value)})} className="w-full mb-4" />
                        <div className="text-center font-bold text-lg mb-6">{popupState.count} Questions</div>
                        <button onClick={() => {
                            const chapter = popupState.chapter;
                            if (chapter) {
                                setSelectedChapters(prev => [...prev, {...chapter, numQuestions: popupState.count}]);
                            }
                            setPopupState({...popupState, open: false});
                        }} className="w-full bg-blue-600 p-3 rounded-xl font-bold">OK</button>
                    </div>
                </div>
            )}
            
            <button className="fixed bottom-6 left-6 right-6 bg-blue-600 p-4 rounded-2xl font-bold text-center" 
                    disabled={selectedChapters.length === 0}
                    onClick={() => onStart(selectedChapters.map(c => ({...c, difficulty})))}>
                {selectedChapters.length > 0 ? `Start Practice (${selectedChapters.reduce((acc, c) => acc + c.numQuestions, 0)} Total Questions)` : 'Select Chapters'}
            </button>
          </div>
        </div>
    );
}
