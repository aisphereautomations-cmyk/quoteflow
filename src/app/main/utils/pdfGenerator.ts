import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

/**
 * Generates a PDF from a DOM element
 * @param element - The HTML element to convert to PDF
 * @param filename - The name of the PDF file (default: 'quote.pdf')
 * @returns Promise<Blob> - The generated PDF as a Blob
 */
export async function generatePDF(
    element: HTMLElement,
    filename: string = 'quote.pdf'
): Promise<Blob> {
    // Capture the element as canvas
    const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
    });

    // Convert canvas to image
    const imgData = canvas.toDataURL('image/png');

    // Calculate PDF dimensions (A4 width, dynamic height)
    const pdfWidth = 210; // A4 width in mm
    const pdfHeight = Math.max(297, (canvas.height * pdfWidth) / canvas.width); // min A4 height

    // Create PDF
    const pdf = new jsPDF('p', 'mm', [pdfWidth, pdfHeight]);
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);

    // Return as Blob
    return pdf.output('blob');
}

/**
 * Downloads a PDF file
 * @param blob - The PDF blob to download
 * @param filename - The name of the file
 */
export function downloadPDF(blob: Blob, filename: string = 'quote.pdf'): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Generates and downloads a PDF in one call
 * @param element - The HTML element to convert to PDF
 * @param filename - The name of the PDF file
 */
export async function generateAndDownloadPDF(
    element: HTMLElement,
    filename: string = 'quote.pdf'
): Promise<void> {
    const blob = await generatePDF(element, filename);
    downloadPDF(blob, filename);
}
