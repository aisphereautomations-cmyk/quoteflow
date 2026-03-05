'use client';

import { createContext, useContext, useRef, useCallback, type RefObject, type ReactNode } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const PAGE_WIDTH = 595; // A4 width at 72 dpi = 595 pt

interface PDFContextValue {
    /** The preview DOM element ref — set by PDFPreview */
    previewRef: RefObject<HTMLDivElement | null>;
    /** Generate a PDF blob by capturing the current preview */
    capturePDF: () => Promise<Blob | null>;
}

const PDFContext = createContext<PDFContextValue | null>(null);

export function PDFProvider({ children }: { children: ReactNode }) {
    const previewRef = useRef<HTMLDivElement | null>(null);

    const capturePDF = useCallback(async (): Promise<Blob | null> => {
        if (!previewRef.current) return null;

        const canvas = await html2canvas(previewRef.current, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
            onclone: (_doc: Document, clonedEl: HTMLElement) => {
                // iOS Safari inflates font sizes on elements inside a scaled
                // container (transform: scale). The clone is a separate DOM tree
                // that gets re-laid-out — by removing the transform on the clone,
                // iOS Safari won't trigger font inflation during the clone's layout.
                clonedEl.style.setProperty('transform', 'none', 'important');
                clonedEl.style.setProperty('-webkit-text-size-adjust', '100%', 'important');
                clonedEl.style.setProperty('text-size-adjust', '100%', 'important');
                // Force all children too
                const allEls = clonedEl.querySelectorAll('*');
                allEls.forEach((el) => {
                    const htmlEl = el as HTMLElement;
                    htmlEl.style.setProperty('-webkit-text-size-adjust', 'none', 'important');
                    htmlEl.style.setProperty('text-size-adjust', 'none', 'important');
                });
            },
        });

        const imgData = canvas.toDataURL('image/png');
        const imgW = PAGE_WIDTH;
        const imgH = (canvas.height / canvas.width) * imgW;

        const pdf = new jsPDF('p', 'pt', [imgW, imgH]);
        pdf.addImage(imgData, 'PNG', 0, 0, imgW, imgH);

        return pdf.output('blob');
    }, []);

    return (
        <PDFContext.Provider value={{ previewRef, capturePDF }}>
            {children}
        </PDFContext.Provider>
    );
}

export function usePDF() {
    const ctx = useContext(PDFContext);
    if (!ctx) throw new Error('usePDF must be used inside PDFProvider');
    return ctx;
}
