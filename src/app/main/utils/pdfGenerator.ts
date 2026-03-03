import { jsPDF } from 'jspdf';
import type { SettingsData } from '../context/SettingsContext';
import type { QuoteData } from '../context/QuoteContext';

interface ClientData {
    clientName: string;
    email: string;
    whatsapp: string;
    serviceTitle: string;
}

/* ── colour helpers ─────────────────────────────────────────── */

function hexToRGB(hex: string): [number, number, number] {
    const h = hex.replace('#', '');
    return [
        parseInt(h.substring(0, 2), 16),
        parseInt(h.substring(2, 4), 16),
        parseInt(h.substring(4, 6), 16),
    ];
}

/* ── image loader ───────────────────────────────────────────── */

async function loadImageAsBase64(url: string): Promise<string | null> {
    // Already a data-URL
    if (url.startsWith('data:')) return url;

    try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = url;

        await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject();
        });

        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        ctx.drawImage(img, 0, 0);
        return canvas.toDataURL('image/png');
    } catch {
        console.warn('Could not load logo for PDF');
        return null;
    }
}

/* ── text wrapping helper ───────────────────────────────────── */

function wrapText(pdf: jsPDF, text: string, maxWidth: number): string[] {
    const lines: string[] = [];
    // Split by newlines first
    const paragraphs = text.split('\n');
    for (const para of paragraphs) {
        const wrapped = pdf.splitTextToSize(para, maxWidth) as string[];
        lines.push(...wrapped);
    }
    return lines;
}

/* ── pricing helpers ────────────────────────────────────────── */

function getUnitLabel(mode: string) {
    if (mode === 'sqm') return 'm²';
    if (mode === 'hour') return 'hr';
    return '';
}

/* ── main generator ─────────────────────────────────────────── */

export async function generateQuotePDF(
    settings: SettingsData,
    quote: QuoteData,
    client?: ClientData,
): Promise<Blob> {
    const PAGE_W = 210; // A4 width mm
    const MARGIN = 15;
    const CONTENT_W = PAGE_W - MARGIN * 2;
    const LINE_HEIGHT = 5; // mm per line of body text

    /* ──────────── First pass: calculate total height ──────────── */
    // We need to know the height before we create the PDF,
    // so we do a dry run with a temp PDF just for text measurement.
    const tmp = new jsPDF('p', 'mm', 'a4');
    let estimatedY = MARGIN;

    // Header area
    estimatedY += 8; // company name
    let headerLines = 0;
    if (settings.phone) headerLines++;
    if (settings.email) headerLines++;
    if (settings.website) headerLines++;
    estimatedY += headerLines * 5;
    estimatedY += 5; // spacing after header
    estimatedY = Math.max(estimatedY, MARGIN + 35); // minimum header height (logo may be taller)

    // Client info (if present)
    if (client && (client.clientName || client.email || client.serviceTitle)) {
        estimatedY += 10; // "Client:" label + spacing
        if (client.clientName) estimatedY += 5;
        if (client.email) estimatedY += 5;
        if (client.whatsapp) estimatedY += 5;
        if (client.serviceTitle) estimatedY += 5;
        estimatedY += 3;
    }

    // Description bar
    estimatedY += 14;

    // Services
    const filledServices = quote.services.filter(
        (s) => s.title || s.description || s.fixedPrice || (s.quantity && s.unitPrice),
    );

    for (const service of filledServices) {
        estimatedY += 7; // title line
        if (service.description) {
            tmp.setFontSize(9);
            const descLines = wrapText(tmp, service.description, CONTENT_W);
            estimatedY += descLines.length * 4;
        }
        estimatedY += 5; // spacing after service
    }

    // Totals bar
    estimatedY += 8;

    // Bottom section (footer + values)
    estimatedY += 30;

    // Add some bottom padding
    estimatedY += MARGIN;

    const PAGE_H = Math.max(estimatedY, 100); // minimum height

    /* ──────────── Create the actual PDF ──────────── */
    const pdf = new jsPDF('p', 'mm', [PAGE_W, PAGE_H]);

    let y = MARGIN;

    /* ──────── Logo (top-right) ──────── */
    let logoBase64: string | null = null;
    if (settings.logoUrl) {
        logoBase64 = await loadImageAsBase64(settings.logoUrl);
    }

    const logoMaxW = 45;
    const logoMaxH = 25;

    if (logoBase64) {
        try {
            // Get natural dimensions to maintain aspect ratio
            const img = new Image();
            img.src = logoBase64;
            await new Promise<void>((r) => { img.onload = () => r(); });

            let lw = logoMaxW;
            let lh = (img.naturalHeight / img.naturalWidth) * lw;
            if (lh > logoMaxH) {
                lh = logoMaxH;
                lw = (img.naturalWidth / img.naturalHeight) * lh;
            }

            const logoX = PAGE_W - MARGIN - lw;
            pdf.addImage(logoBase64, 'PNG', logoX, y, lw, lh);
        } catch {
            // Skip logo if anything goes wrong
        }
    }

    /* ──────── Company info (top-left) ──────── */
    const companyInfoMaxW = CONTENT_W - logoMaxW - 5;

    if (settings.companyName) {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(16);
        pdf.setTextColor(0, 0, 0);
        pdf.text(settings.companyName, MARGIN, y + 6);
        y += 10;
    }

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(80, 80, 80);

    if (settings.phone) {
        pdf.text(settings.phone, MARGIN, y + 4);
        y += 5;
    }
    if (settings.email) {
        pdf.text(settings.email, MARGIN, y + 4);
        y += 5;
    }
    if (settings.website) {
        pdf.text(settings.website, MARGIN, y + 4);
        y += 5;
    }

    // Ensure minimum header height
    y = Math.max(y, MARGIN + 35);
    y += 3;

    /* ──────── Client info section ──────── */
    if (client && (client.clientName || client.email || client.serviceTitle)) {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10);
        pdf.setTextColor(0, 0, 0);
        pdf.text('Client:', MARGIN, y + 4);
        y += 7;

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.setTextColor(60, 60, 60);

        if (client.clientName) {
            pdf.text(client.clientName, MARGIN, y + 4);
            y += 5;
        }
        if (client.email) {
            pdf.text(client.email, MARGIN, y + 4);
            y += 5;
        }
        if (client.whatsapp) {
            pdf.text(client.whatsapp, MARGIN, y + 4);
            y += 5;
        }
        if (client.serviceTitle) {
            pdf.text(client.serviceTitle, MARGIN, y + 4);
            y += 5;
        }

        y += 3;
    }

    /* ──────── Quote Description Bar ──────── */
    const barH = 10;
    const [br, bg, bb] = hexToRGB(settings.brandColor);
    pdf.setFillColor(br, bg, bb);
    pdf.rect(MARGIN, y, CONTENT_W, barH, 'F');

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(255, 255, 255);
    pdf.text(settings.quoteDescription || 'Quote Description', MARGIN + 5, y + 7);
    y += barH + 8;

    /* ──────── Services ──────── */
    pdf.setTextColor(0, 0, 0);

    for (const service of filledServices) {
        let priceDisplay = '';

        if (service.pricingMode === 'fixed') {
            if (service.fixedPrice) {
                priceDisplay = `${parseFloat(service.fixedPrice).toFixed(2)} ${settings.currency}`;
            }
        } else if (service.quantity && service.unitPrice) {
            const unit = getUnitLabel(service.pricingMode);
            const total = (parseFloat(service.quantity) * parseFloat(service.unitPrice)).toFixed(2);
            priceDisplay = `${total} ${settings.currency} (${service.quantity} ${unit})`;
        }

        // Title + price on same line
        if (service.title) {
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(11);
            pdf.setTextColor(0, 0, 0);
            pdf.text(service.title, MARGIN, y + 4);
        }
        if (priceDisplay) {
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(11);
            pdf.setTextColor(0, 0, 0);
            const priceW = pdf.getTextWidth(priceDisplay);
            pdf.text(priceDisplay, PAGE_W - MARGIN - priceW, y + 4);
        }
        y += 7;

        // Description
        if (service.description) {
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(9);
            pdf.setTextColor(100, 100, 100);
            const descLines = wrapText(pdf, service.description, CONTENT_W);
            for (const line of descLines) {
                pdf.text(line, MARGIN, y + 3);
                y += 4;
            }
        }

        y += 5; // gap between services
    }

    /* ──────── Totals Divider Bar ──────── */
    y += 2;
    pdf.setFillColor(br, bg, bb);
    pdf.rect(MARGIN, y, CONTENT_W, 2.5, 'F');
    y += 8;

    /* ──────── Bottom Section ──────── */
    const settingsVat = settings.vatEnabled ? settings.vatPercentage : 0;
    const vatPercent = quote.vatOverride !== '' ? (parseFloat(quote.vatOverride) || 0) : settingsVat;
    const baseVal = parseFloat(quote.baseValue) || 0;
    const vatAmount = (baseVal * vatPercent) / 100;
    const totalValue = baseVal + vatAmount;

    const bottomStartY = y;

    // Left side: footer info
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(100, 100, 100);
    let footerY = bottomStartY;

    if (quote.estimatedTime) {
        pdf.text(quote.estimatedTime, MARGIN, footerY + 3);
        footerY += 5;
    }
    if (quote.expirationDate) {
        pdf.text(quote.expirationDate, MARGIN, footerY + 3);
        footerY += 5;
    }
    if (quote.paymentConditions) {
        const condLines = wrapText(pdf, quote.paymentConditions, CONTENT_W / 2 - 5);
        for (const line of condLines) {
            pdf.text(line, MARGIN, footerY + 3);
            footerY += 4;
        }
    }

    // Right side: totals
    const rightX = PAGE_W - MARGIN;
    let totalsY = bottomStartY;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(100, 100, 100);

    const exclVatText = `Price excluding VAT: ${settings.currency} ${baseVal > 0 ? baseVal.toFixed(2) : '0.00'}`;
    const exclVatW = pdf.getTextWidth(exclVatText);
    pdf.text(exclVatText, rightX - exclVatW, totalsY + 3);
    totalsY += 5;

    const vatText = `VAT ${vatPercent}%: ${settings.currency} ${baseVal > 0 ? vatAmount.toFixed(2) : '0.00'}`;
    const vatW = pdf.getTextWidth(vatText);
    pdf.text(vatText, rightX - vatW, totalsY + 3);
    totalsY += 6;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(0, 0, 0);
    const totalText = `Total incl. VAT: ${settings.currency} ${totalValue > 0 ? totalValue.toFixed(2) : '0.00'}`;
    const totalW = pdf.getTextWidth(totalText);
    pdf.text(totalText, rightX - totalW, totalsY + 3);

    /* ──────── Return as Blob ──────── */
    return pdf.output('blob');
}

/* ── download helper ────────────────────────────────────────── */

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
