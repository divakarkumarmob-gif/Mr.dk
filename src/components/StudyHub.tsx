import {useState, useEffect} from 'react';
import {collection, onSnapshot} from 'firebase/firestore';                
import {db} from '../lib/firebase';
import {ChevronDown, Leaf, Atom, Beaker, Play} from 'lucide-react';
import HubSwitcher from './HubSwitcher';
import VideoPlayer from './VideoPlayer';
import BattleRoom from './BattleRoom';

const CHAPTER_DATA: any = {
    Physics: { 
        'Class 11': ['Units & Measurements', 'Motion in a Straight Line', 'Motion in a Plane', 'Laws of Motion', 'Work, Energy & Power', 'System of Particles & Rotational Motion', 'Gravitation', 'Mechanical Properties of Solids', 'Mechanical Properties of Fluids', 'Thermal Properties of Matter', 'Thermodynamics', 'Kinetic Theory', 'Oscillations', 'Waves'],
        'Class 12': ['Nomenclature', 'Electric Charges & Fields', 'Electrostatic Potential & Capacitance', 'Current Electricity', 'Moving Charges & Magnetism', 'Magnetism & Matter', 'Electromagnetic Induction', 'Alternating Current', 'Electromagnetic Waves', 'Ray Optics and Optical Instruments', 'Wave Optics', 'Dual Nature of Radiation and Matter', 'Atoms', 'Nuclei', 'Semiconductor Electronics']
    },
    Chemistry: {
        'Class 11': ['Some Basic Concepts of Chemistry', 'Structure of Atom', 'Classification of Elements and Periodicity in Properties', 'Chemical Bonding and Molecular Structure', 'Thermodynamics', 'Equilibrium', 'Redox Reactions', 'Organic Chemistry: Some Basic Principles and Techniques', 'Hydrocarbons'],
        'Class 12': ['Nomenclature', 'Chemical Kinetics', 'Solutions', 'Electrochemistry', 'General Principles and Processes of Isolation of Elements', 'p-Block Elements', 'd- and f-Block Elements', 'Coordination Compounds', 'Haloalkanes and Haloarenes', 'Alcohols, Phenols and Ethers', 'Aldehydes, Ketones and Carboxylic Acids', 'Amines', 'Biomolecules']
    },
    Biology: {
        'Class 11': ['The Living World', 'Biological Classification', 'Plant Kingdom', 'Animal Kingdom', 'Morphology of Flowering Plants', 'Anatomy of Flowering Plants', 'Structural Organisation in Animals', 'Cell: The Unit of Life', 'Biomolecules', 'Cell Cycle and Cell Division', 'Plant Physiology', 'Human Physiology'],
        'Class 12': ['Nomenclature', 'Reproduction in Organisms', 'Sexual Reproduction in Flowering Plants', 'Human Reproduction', 'Reproductive Health', 'Principles of Inheritance and Variation', 'Molecular Basis of Inheritance', 'Evolution', 'Human Health and Disease', 'Strategies for Enhancement in Food Production', 'Microbes in Human Welfare', 'Biotechnology: Principles and Processes', 'Biotechnology and its Applications', 'Organisms and Populations', 'Ecosystem', 'Biodiversity and Conservation', 'Environmental Issues']
    }
};

export default function StudyHub({ subjects, onNavigate }: { subjects: any[], onNavigate: (view: 'home' | 'study') => void }) {
    // Mock data for user progress
    const stats = { tests: 0, questions: 0, accuracy: '0%', time: '0m' };
    const subjectProgress = [
      { name: 'Biology', icon: Leaf, progress: 72, color: 'bg-green-500' },
      { name: 'Physics', icon: Atom, progress: 58, color: 'bg-blue-500' },
      { name: 'Chemistry', icon: Beaker, progress: 61, color: 'bg-orange-500' }
    ];

    const [activeUsers, setActiveUsers] = useState<Record<string, number>>({});

    useEffect(() => {
        const q = collection(db, 'chapterActivity');
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data: Record<string, number> = {};
            snapshot.docs.forEach(doc => {
                data[doc.id] = doc.data().totalActive;
            });
            setActiveUsers(data);
        });
        return () => unsubscribe();
    }, []);                

    const accordionItems = ["LECTURE LIBRARY", "CUSTOM PRACTICE", "NEURAL & AI TOOLS", "BATTLE & PRACTICE", "MEMORY VAULT"];
    const [expandedItem, setExpandedItem] = useState<string | null>(null);
    const [activeSubject, setActiveSubject] = useState<string>('Physics');
    const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
    const [activeBattleChapter, setActiveBattleChapter] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    return (
        <div className="min-h-screen bg-[#0a0f24] text-white p-6 font-sans flex flex-col">
          <HubSwitcher active="study" onNavigate={onNavigate} />
          {activeBattleChapter && (
              <BattleRoom chapter={activeBattleChapter} onFinish={(winner) => {
                  alert(`Winner: ${winner}`);
                  setActiveBattleChapter(null);
              }} />
          )}
          
          <div className="text-gray-400 text-sm mt-4 text-center">
            {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
          {selectedChapter && (
            <VideoPlayer topic={selectedChapter} onClose={() => setSelectedChapter(null)} />
          )}
          
          <div className="space-y-3 mt-8 pb-20">
            {accordionItems.map(item => (
                <div key={item} className="bg-[#161e38] rounded-2xl border border-white/5">
                    <button 
                        className="w-full p-6 flex justify-between items-center font-bold text-sm tracking-wider"
                        onClick={() => setExpandedItem(expandedItem === item ? null : item)}
                    >
                        {item}
                        <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform ${expandedItem === item ? 'rotate-180' : ''}`} />
                    </button>
                    {expandedItem === item && (
                        <div className="p-6 pt-0 text-white text-sm">
                            {item === "LECTURE LIBRARY" ? (
                                <>
                                    <input
                                        type="text"
                                        placeholder="Search chapters..."
                                        className="w-full p-3 bg-white/5 rounded-lg mb-4 text-xs"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                    <div className="flex gap-2 mb-4 border-b border-white/10 pb-2">
                                        {['Physics', 'Chemistry', 'Biology'].map(sub => (
                                            <button 
                                                key={sub}
                                                className={`px-4 py-2 font-bold text-xs ${activeSubject === sub ? 'text-orange-500 border-b-2 border-orange-500' : 'text-gray-400'}`}
                                                onClick={() => { setActiveSubject(sub); setSearchQuery(''); }}
                                            >
                                                {sub}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="max-h-60 overflow-y-auto space-y-4">
                                        {Object.entries(CHAPTER_DATA[activeSubject]).map(([cls, chapters]: [string, any]) => (
                                            <div key={cls}>
                                                <h4 className="font-bold text-xs text-orange-500 mb-2">{cls}</h4>
                                                {chapters
                                                    .filter((c: string) => c.toLowerCase().includes(searchQuery.toLowerCase()))
                                                    .map((chapter: string) => (
                                                        <div key={chapter} className="p-3 bg-white/5 rounded-lg mb-2 text-xs cursor-pointer hover:bg-orange-500/20 flex items-center justify-between"
                                                             onClick={() => setSelectedChapter(chapter)}>
                                                            {chapter}
                                                            <Play className="h-4 w-4 text-orange-500" />
                                                        </div>
                                                ))}
                                            </div>
                                        ))}
                                    </div>
                                </>
                            ) : item === "BATTLE & PRACTICE" ? (
                                <>
                                    <div className="flex gap-2 mb-4 border-b border-white/10 pb-2">
                                        {['Physics', 'Chemistry', 'Biology'].map(sub => (
                                            <button 
                                                key={sub}
                                                className={`px-4 py-2 font-bold text-xs ${activeSubject === sub ? 'text-orange-500 border-b-2 border-orange-500' : 'text-gray-400'}`}
                                                onClick={() => { setActiveSubject(sub); }}
                                            >
                                                {sub}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="max-h-60 overflow-y-auto space-y-4">
                                        {Object.entries(CHAPTER_DATA[activeSubject])
                                            .flatMap(([cls, chapters]: [string, any]) => 
                                                chapters.map((c: string) => ({ chapter: c, active: activeUsers[c] || 0 }))
                                            )
                                            .sort((a, b) => b.active - a.active)
                                            .map(({ chapter, active }) => (
                                                <div key={chapter} className="p-3 bg-white/5 rounded-lg mb-2 text-xs flex items-center justify-between cursor-pointer hover:bg-orange-500/20"
                                                     onClick={() => setActiveBattleChapter(chapter)}>
                                                    <span>{chapter}</span>
                                                    <span className="text-orange-500 font-bold">{active} Active</span>
                                                </div>
                                            ))
                                        }
                                    </div>
                                </>
                            ) : (
                                `Content for ${item} goes here...`
                            )}
                        </div>
                    )}
                </div>
            ))}
          </div>
          <div className="text-center mt-auto py-4">
             <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-green-500 to-blue-500">
                 Powered by DK
             </span>
           </div>
        </div>
    )
}
