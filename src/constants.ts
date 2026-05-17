export const CHAPTER_PLAYLISTS: { [key: string]: string } = {
    "current electricity": "PLqF42iGupSTAtLMIJA4klWpfLkD5wVcaS",
    "physics": "PLru9htpOg_gdu2KTm-9x3I0POx4gcR8GF",
    "biology": "PLru9htpOg_gdafDcr6je8zPI62LosWk_Y",
    "chemistry": "PLru9htpOg_gfntexp5UewLaoKphx6H8ix",
};

export const CHAPTER_DATA = {
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

export const PHYSICS_VIDEOS: { [key: string]: { [partName: string]: string } } = {
    "basic math": { "full lecture": "8m_pvsnhWQA" },
    "vector": { "full lecture": "0THhVA8zV3g" },
    "Moving Charges & Magnetism": { "part 1": "MgYmoP1pmw4", "part 2": "dkFNfhlbx3A" },
    "Magnetism & Matter": { "full lecture": "1FNm3M_QcO4" },
    "current electricity": { "part 1": "e5M-8X-cYNU", "part 2": "i3X70Y1g78U" },
    "electromagnetic induction": { "full lecture": "c_8I-fFJjtc" },
    "alternating current": { "full lecture": "J4Ma09TrG7s" },
    "electromagnetic wave": { "full lecture": "kK8jOqLKaI4" },
    "ray optics": { "part 1": "9RQFbpuqbFI", "part 2": "yK9pRn36NlE" },
    "wave optics": { "full lecture": "R_fV2VK3sIk" },
    "waves": { "full lecture": "R_fV2VK3sIk" },
    "dual nature of radiation and matter": { "full lecture": "3GqnvdMPzOg" },
    "atoms": { "full lecture": "3GqnvdMPzOg" },
    "nuclei": { "full lecture": "j_9WmuiSurE" },
    "semiconductor": { "full lecture": "01CQR6uDEEU" },
    "gravitation": { "full lecture": "GyDRiN4Ifvg" },
    "Thermal Properties of Matter": { "part 1": "B7IW3qqCvS0" },
    "Fluid Mechanics": { "part 1": "B7IW3qqCvS0" },
    "Thermodynamics": { "part 1": "B7IW3qqCvS0" },
    "Kinetic Theory of Gases (KTG)": { "part 1": "B7IW3qqCvS0" },
    "Thermal Properties of Solids": { "part 1": "n3Tz9kWt7R8" },
    "oscillation": { "full lecture": "3__7e1Vkizk" },
    "wave motion": { "full lecture": "2TiShTXk2g0" },
    "Electric Charge & Fields": { "full lecture": "h8ZlP-vNckE" },
    "Units & Measurements": { "full lecture": "CFqbfN6Cy8o" },
    "Electrostatic Potential & Capacitance": { "part 1": "ZebQGdzzYqE", "part 2": "MDewEYF7n48" },
    "kinematics": { "part 1": "z8j1N-1-fag", "part 2": "hty_LUeFano", "part 3": "2ZNZzjuHmFI" },
    "motion in a straight line": { "part 1": "z8j1N-1-fag", "part 2": "hty_LUeFano" },
    "motion in a plane": { "full lecture": "2ZNZzjuHmFI" },
};

export const PHYSICS_CHAPTERS = [
    "Basic Math", "Vector", "Units & Measurements", "Motion in a Straight Line", "Motion in a Plane", 
    "Laws of Motion", "Work, Energy & Power", "System of Particles & Rotational Motion", "Gravitation", "Magnetism and Matter",
    "Dual Nature of Radiation and Matter", "Atoms", "Nuclei", "Waves",
    "Thermal Properties of Matter", "Fluid Mechanics", "Thermodynamics", "Kinetic Theory of Gases (KTG)", "Thermal Properties of Solids",
    "Electric Charge & Fields", "Electrostatic Potential & Capacitance"
];

export const CHEMISTRY_VIDEOS: { [key: string]: { [partName: string]: string } } = {
    "Some Basic Concepts of Chemistry": { "full lecture": "mag19VHFXlI" },
    "Structure of Atom": { "full lecture": "Y68O1VADXm4" },
    "Classification of Elements": { "full lecture": "6LLgsS8VlFA" },
    "Chemical Bonding": { "full lecture": "Y82AZF4CI2A" },
    "Thermodynamics": { "full lecture": "FblFzVp6caE" },
    "Equilibrium": { "part 1": "Ds7cg5lNdbU", "part 2": "F829oLj88ZY" },
    "Redox Reactions": { "full lecture": "UzUz8yrEQ54" },
    "Hydrocarbons": { "full lecture": "jr1umkqzEDc" },
    "Organic Chemistry": { "full lecture": "gDgTzV-QKvI" },
    "Solutions": { "full lecture": "xnTeE755mFU" },
    "Electrochemistry": { "full lecture": "Ldp56wuj1WE" },
    "Chemical Kinetics": { "full lecture": "Q9LDwqrE76A" },
    "d-and f-Block Elements": { "full lecture": "fpoFOeDyYM0" },
    "Coordination Compounds": { "full lecture": "DChJqp-i3yQ" },
    "Haloalkanes and Haloarenes": { "full lecture": "Jd6COqxhDpE" },
    "Alcohols, Phenols and Ethers": { "full lecture": "bzU5OIPAjmc" },
    "Aldehydes, Ketones and Carboxylic Acids": { "full lecture": "gyKW-NLSZLI" },
    "Amines": { "full lecture": "xFx2ckAQCQA" },
    "Salt Analysis": { "full lecture": "wI_X8xRnh9E" },
    "P block": { "full lecture": "EvGXYOZXR-0" },
};

export const CHEMISTRY_CHAPTERS_11 = [
    "Some Basic Concepts of Chemistry", "Structure of Atom", "Classification of Elements",
    "Chemical Bonding", "Thermodynamics", "Equilibrium", "Redox Reactions", "Hydrocarbons", "Organic Chemistry"
];

export const CHEMISTRY_CHAPTERS_12 = [
    "Salt Analysis", "P block", "d-and f-Block Elements"
];

export const CHEMISTRY_CHAPTERS = [...CHEMISTRY_CHAPTERS_11, ...CHEMISTRY_CHAPTERS_12];
export const BIOLOGY_CHAPTERS = [
    "The Living World", "Biological Classification", "Plant Kingdom", "Animal Kingdom", 
    "Morphology of Flowering Plants", "Anatomy of Flowering Plants", "Structural Organisation in Animals", "Cell: The Unit of Life"
];
