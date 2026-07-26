
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface Question {
    id: string;
    section?: string;
    question: string;
    options: {
        A: string;
        B: string;
        C: string;
        D: string;
    };
    correct_option: string;
    explanation?: string;
}

export interface ExamData {
    exam: string;
    year: number | string;
    subject: string;
    questions: Question[];
}

export const generateNEETPdf = (data: ExamData, shouldSave = true): string => {
    console.log('Generating PDF for:', data.exam, data.year, data.subject);
    const doc = new jsPDF();
    const margin = 15;
    const pageWidth = doc.internal.pageSize.width;
    let y = 20;

    // Header
    doc.setFontSize(22);
    doc.setTextColor(40, 40, 40);
    doc.text(`${data.exam} - ${data.year}`, pageWidth / 2, y, { align: 'center' });
    y += 10;
    doc.setFontSize(16);
    doc.text(data.subject, pageWidth / 2, y, { align: 'center' });
    y += 15;

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Total Questions: ${data.questions.length}`, margin, y);
    y += 10;

    // Line separator
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;

    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);

    data.questions.forEach((q, index) => {
        // Check if we need a new page
        if (y > 250) {
            doc.addPage();
            y = 20;
        }

        const qNumber = `Q${index + 1}. `;
        const qText = q.question.replace(/\n/g, ' ').trim();
        
        // Detect "Match" questions
        const isMatchQuestion = qText.toLowerCase().includes('match') && qText.includes('with');
        
        if (isMatchQuestion) {
            // Print "Match the following" header
            doc.setFont('helvetica', 'bold');
            doc.text(qNumber + "Match the Following:", margin, y);
            y += 8;

            // Attempt to parse columns
            try {
                const parts = qText.split(/with/i);
                const col1Raw = parts[0].replace(/^match[\s:]+/i, '').trim();
                const col2Raw = parts[1].split(/options/i)[0].trim();

                const col1Items = col1Raw.split(/\(([a-d])\)/i).filter(s => s && !/^[a-d]$/i.test(s)).map(s => s.trim());
                const col2Items = col2Raw.split(/\(([i]+|iv|v)\)/i).filter(s => s && !/^(i+|iv|v)$/i.test(s)).map(s => s.trim());

                const tableData = [];
                const maxRows = Math.max(col1Items.length, col2Items.length);
                const col1Labels = ['(A)', '(B)', '(C)', '(D)', '(E)'];
                const col2Labels = ['(i)', '(ii)', '(iii)', '(iv)', '(v)'];

                for (let i = 0; i < maxRows; i++) {
                    tableData.push([
                        col1Items[i] ? `${col1Labels[i]} ${col1Items[i]}` : '',
                        col2Items[i] ? `${col2Labels[i]} ${col2Items[i]}` : ''
                    ]);
                }

                autoTable(doc, {
                    startY: y,
                    head: [['Column I', 'Column II']],
                    body: tableData,
                    theme: 'grid',
                    margin: { left: margin + 5 },
                    styles: { fontSize: 9, cellPadding: 2 },
                    headStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold' },
                    columnStyles: { 0: { cellWidth: 80 }, 1: { cellWidth: 80 } }
                });

                y = (doc as any).lastAutoTable.finalY + 10;
            } catch (e) {
                // Fallback to text if parsing fails
                const splitQuestion = doc.splitTextToSize(qNumber + qText, pageWidth - (margin * 2));
                doc.setFont('helvetica', 'bold');
                doc.text(splitQuestion, margin, y);
                y += (splitQuestion.length * 6);
            }
        } else {
            // Standard Question Rendering
            const splitQuestion = doc.splitTextToSize(qNumber + qText, pageWidth - (margin * 2));
            doc.setFont('helvetica', 'bold');
            doc.text(splitQuestion, margin, y);
            y += (splitQuestion.length * 6);
        }

        // Print Options
        doc.setFont('helvetica', 'normal');
        const options = [
            `(A) ${q.options.A}`,
            `(B) ${q.options.B}`,
            `(C) ${q.options.C}`,
            `(D) ${q.options.D}`
        ];

        options.forEach(opt => {
            if (y > 280) {
                doc.addPage();
                y = 20;
            }
            const splitOpt = doc.splitTextToSize(opt, pageWidth - (margin * 2) - 5);
            doc.text(splitOpt, margin + 5, y);
            y += (splitOpt.length * 6);
        });

        y += 4; // Space between questions
    });

    // Answer Key Page
    doc.addPage();
    y = 20;
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('ANSWER KEY', pageWidth / 2, y, { align: 'center' });
    y += 15;

    const optionMap: Record<string, string> = { 'A': '1', 'B': '2', 'C': '3', 'D': '4' };

    const answerData = [];
    for (let i = 0; i < data.questions.length; i += 5) {
        const row = [];
        for (let j = 0; j < 5; j++) {
            const idx = i + j;
            if (idx < data.questions.length) {
                const opt = data.questions[idx].correct_option;
                row.push(`${idx + 1} - ${optionMap[opt] || opt}`);
            } else {
                row.push('');
            }
        }
        answerData.push(row);
    }

    autoTable(doc, {
        startY: y,
        body: answerData,
        theme: 'grid',
        styles: { fontSize: 10, cellPadding: 3, halign: 'center' },
    });

    // Add Page Numbers
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`Page ${i} of ${totalPages} | Generated by NEET App`, pageWidth / 2, 290, { align: 'center' });
    }

    if (shouldSave) {
        try {
            doc.save(`NEET_${data.year}_${data.subject}.pdf`);
        } catch (e) {
            console.error('Error saving PDF:', e);
        }
    }

    const blob = doc.output('blob');
    return URL.createObjectURL(blob);
};
