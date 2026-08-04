/**
 * NeetMaster AI Few-Shot Exemplars & Fine-Tuning Module
 * Provides curated, gold-standard worked examples for Physics, Chemistry, and Biology
 * to ensure 100% accurate, step-by-step NCERT responses.
 */

export interface ExemplarPair {
    studentQuestion: string;
    idealMentorResponse: string;
}

export const FEW_SHOT_EXEMPLARS: ExemplarPair[] = [
    {
        studentQuestion: "Physics: Concave mirror of focal length 20 cm forms a real image at 30 cm. What is the object distance u?",
        idealMentorResponse: "Sahi jawab hai u = -60 cm. \nStep-by-step solution:\n1. Cartesian sign convention: Concave mirror focal length f = -20 cm, real image v = -30 cm.\n2. Mirror formula: 1/f = 1/v + 1/u => 1/u = 1/f - 1/v.\n3. Substitute values: 1/u = 1/(-20) - 1/(-30) = -1/20 + 1/30 = (-3 + 2)/60 = -1/60.\n4. Therefore, u = -60 cm (object is placed 60 cm in front of mirror)."
    },
    {
        studentQuestion: "Chemistry: What is the major product of propene + HBr in presence of peroxide?",
        idealMentorResponse: "Sahi jawab hai 1-Bromopropane (CH₃-CH₂-CH₂Br).\nReasoning:\nPeroxide ki presence mein Anti-Markownikoff rule (Kharasch effect) apply hota hai. HBr ka Free Radical Addition hota hai jahan Bromine (Br•) us carbon par judta hai jisme zyada Hydrogen hote hain (Terminal Carbon-1). Note: Yeh effect sirf HBr ke saath hota hai, HCl ya HI ke saath nahi."
    },
    {
        studentQuestion: "Biology: Primary CO2 acceptor in C4 plants and C3 plants kaunsa hota hai?",
        idealMentorResponse: "Sahi jawab hai:\n- C4 plants mein Primary CO₂ acceptor: Phosphoenolpyruvate (PEP), jo 3-carbon molecule hai (Mesophyll cells mein).\n- C3 plants mein Primary CO₂ acceptor: Ribulose-1,5-bisphosphate (RuBP), jo 5-carbon sugar hai (Mesophyll cells mein).\nNCERT point: C4 plants mein PEP carboxylase enzyme mesophyll mein hota hai, jabki RuBisCO bundle sheath cells mein present hota hai."
    }
];

/**
 * Returns formatted Few-Shot Exemplars text for System Prompt injection
 */
export function getFineTunedExemplarsText(): string {
    return FEW_SHOT_EXEMPLARS.map((e, index) => 
        `[Gold-Standard Exemplar ${index + 1}]\nStudent Doubt: ${e.studentQuestion}\nIdeal Mentor Answer:\n${e.idealMentorResponse}`
    ).join('\n\n');
}
