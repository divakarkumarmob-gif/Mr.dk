/**
 * NCERT Knowledge Base & Formula Lookup Engine for NeetMaster AI
 * Provides exact Class 11-12 NCERT formulas, concepts, and common student mistake traps.
 */

export interface NCERTConcept {
    subject: 'Physics' | 'Chemistry' | 'Biology';
    topic: string;
    keywords: string[];
    ncertFormulaOrRule: string;
    commonTraps: string;
}

export const NCERT_KNOWLEDGE_BASE: NCERTConcept[] = [
    // --- PHYSICS CLASS 11 & 12 ---
    {
        subject: 'Physics',
        topic: 'Optics & Sign Convention',
        keywords: ['lens', 'mirror', 'focal length', 'refraction', 'reflection', 'magnification', 'prism', 'optics'],
        ncertFormulaOrRule: 'Mirror Formula: 1/f = 1/v + 1/u | Lens Formula: 1/f = 1/v - 1/u | Magnification Mirror m = -v/u | Lens m = v/u.',
        commonTraps: 'Real images have negative v in mirrors, positive v in lenses. u is ALWAYS negative in Cartesian sign convention.'
    },
    {
        subject: 'Physics',
        topic: 'Kinematics & Projectile Motion',
        keywords: ['projectile', 'height', 'range', 'flight', 'acceleration', 'velocity', 'gravity'],
        ncertFormulaOrRule: 'Time of Flight T = (2u sin θ)/g | Max Height H = (u² sin² θ)/(2g) | Horizontal Range R = (u² sin 2θ)/g.',
        commonTraps: 'Range R is maximum at 45°. Angle θ must be measured from horizontal unless specified.'
    },
    {
        subject: 'Physics',
        topic: 'Electrostatics & Capacitance',
        keywords: ['coulomb', 'electric field', 'potential', 'capacitor', 'dielectric', 'charge'],
        ncertFormulaOrRule: 'Coulomb Force F = (1/4πε₀)(q₁q₂/r²) | Parallel Plate Capacitance C = (k ε₀ A)/d | Energy stored U = 1/2 CV².',
        commonTraps: 'When dielectric is inserted with battery CONNECTED: V constant, C increases, Q increases. If battery DISCONNECTED: Q constant, V decreases.'
    },
    {
        subject: 'Physics',
        topic: 'Current Electricity & Magnetism',
        keywords: ['ohms law', 'resistance', 'kirchhoff', 'magnetic field', 'solenoid', 'lorentz'],
        ncertFormulaOrRule: 'R = ρL/A | V = IR | Magnetic field of long straight wire B = (μ₀ I)/(2π r) | Solenoid B = μ₀ n I.',
        commonTraps: 'Internal resistance r reduces terminal voltage V = E - Ir during discharge, but V = E + Ir during charging.'
    },
    {
        subject: 'Physics',
        topic: 'Modern Physics & Dual Nature',
        keywords: ['photoelectric', 'work function', 'de broglie', 'bohr', 'half life', 'binding energy'],
        ncertFormulaOrRule: 'Einstein Photoelectric: hν = Φ + KE_max | de Broglie λ = h/p = h/√(2m qV) | Bohr Radius r_n ∝ n²/Z | Energy E_n = -13.6 Z²/n² eV.',
        commonTraps: 'Stopping potential depends ONLY on frequency of light, not intensity. Intensity determines photocurrent.'
    },

    // --- CHEMISTRY CLASS 11 & 12 ---
    {
        subject: 'Chemistry',
        topic: 'Organic Reaction Mechanisms',
        keywords: ['sn1', 'sn2', 'electrophilic', 'nucleophilic', 'carbocation', 'grignard', 'markownikoff'],
        ncertFormulaOrRule: 'SN1: 2-step, carbocation intermediate, racemization, tertiary > secondary > primary. SN2: 1-step, transition state, inversion of configuration (Walden), primary > secondary > tertiary.',
        commonTraps: 'Markownikoff rule applies to unsymmetrical alkenes. Peroxide effect (Kharasch) applies ONLY to HBr, NOT to HCl or HI.'
    },
    {
        subject: 'Chemistry',
        topic: 'Chemical Equilibrium & Ionic Equilibrium',
        keywords: ['equilibrium', 'kp', 'kc', 'ph', 'buffer', 'solubility', 'ksp'],
        ncertFormulaOrRule: 'Kp = Kc (RT)^Δng | pH = -log[H⁺] | Henderson-Hasselbalch Acidic Buffer: pH = pKa + log([Salt]/[Acid]).',
        commonTraps: 'Pure solids and pure liquids are omitted from Kp and Kc expressions (their active mass = 1).'
    },
    {
        subject: 'Chemistry',
        topic: 'Electrochemistry & Solutions',
        keywords: ['nernst', 'galvanic', 'faraday', 'molar conductivity', 'raoult', 'colligative'],
        ncertFormulaOrRule: 'Nernst Equation: E_cell = E°_cell - (0.0591/n) log Q at 298K | ΔG° = -n F E°_cell | Raoult Law P = P° χ.',
        commonTraps: 'van t Hoff factor i > 1 for dissociation (NaCl i=2, BaCl₂ i=3), i < 1 for association (Acetic acid in benzene i=0.5).'
    },
    {
        subject: 'Chemistry',
        topic: 'Periodic Table & Chemical Bonding',
        keywords: ['hybridization', 'vsepr', 'ionization', 'electronegativity', 'dipole', 'lattice'],
        ncertFormulaOrRule: 'Steric Number = 1/2 [V + M - C + A]. Hybridization: 2=sp, 3=sp², 4=sp³, 5=sp³d, 6=sp³d².',
        commonTraps: 'Ionization energy exception: N > O (due to half-filled 2p³ stability), Be > B (due to fully filled 2s²).'
    },

    // --- BIOLOGY CLASS 11 & 12 ---
    {
        subject: 'Biology',
        topic: 'Genetics & Inheritance',
        keywords: ['mendel', 'dihybrid', 'monohybrid', 'linkage', 'pedigree', 'dna', 'transcription', 'replication'],
        ncertFormulaOrRule: 'Monohybrid F2 Phenotypic 3:1, Genotypic 1:2:1 | Dihybrid F2 Phenotypic 9:3:3:1 | Central Dogma: DNA -> RNA -> Protein.',
        commonTraps: 'Strict NCERT terminology: In incomplete dominance (Antirrhinum/Snapdragon), phenotypic and genotypic ratio are identical (1:2:1).'
    },
    {
        subject: 'Biology',
        topic: 'Plant Physiology & Photosynthesis',
        keywords: ['photosynthesis', 'calvin', 'c3', 'c4', 'respiration', 'glycolysis', 'krebs', 'rubisco'],
        ncertFormulaOrRule: 'C4 Plants: Kranz anatomy, PEP carboxylase in mesophyll, RuBisCO in bundle sheath. Primary CO₂ acceptor in C4 is PEP (3-carbon), in C3 is RuBP (5-carbon).',
        commonTraps: 'RuBisCO has higher affinity for CO₂ than O₂, but photorespiration occurs when CO₂:O₂ ratio is low and temperature is high.'
    },
    {
        subject: 'Biology',
        topic: 'Human Physiology & Neural/Endocrine Control',
        keywords: ['nephron', 'heart', 'ecg', 'neuron', 'synapse', 'hormone', 'pituitary', 'thyroid'],
        ncertFormulaOrRule: 'ECG Waves: P-wave (Atrial depolarization), QRS complex (Ventricular depolarization), T-wave (Ventricular repolarization).',
        commonTraps: 'Aldosterone acts on DCT and Collecting Duct for Na⁺ and water reabsorption. ADH/Vasopressin facilitates water reabsorption from DCT/CD.'
    }
];

/**
 * Searches NCERT Knowledge Base for concepts matching the user's query
 */
export function getRelevantNCERTContext(query: string): string {
    if (!query || typeof query !== 'string') return '';
    const lowerQuery = query.toLowerCase();

    const matchedConcepts = NCERT_KNOWLEDGE_BASE.filter(concept =>
        concept.keywords.some(kw => lowerQuery.includes(kw.toLowerCase()))
    );

    if (matchedConcepts.length === 0) return '';

    return matchedConcepts.map(c =>
        `[NCERT Reference - ${c.subject} (${c.topic})]\nFormula/Rule: ${c.ncertFormulaOrRule}\nCommon Trap: ${c.commonTraps}`
    ).join('\n\n');
}
