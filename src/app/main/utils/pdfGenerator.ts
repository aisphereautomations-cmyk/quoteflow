import { jsPDF } from 'jspdf';
import type { SettingsData } from '../context/SettingsContext';
import type { QuoteData } from '../context/QuoteContext';

export interface ClientData {
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
    const paragraphs = text.split('\n');
    for (const para of paragraphs) {
        if (!para.trim()) { lines.push(''); continue; }
        const wrapped = pdf.splitTextToSize(para, maxWidth) as string[];
        lines.push(...wrapped);
    }
    return lines;
}

/* ── pricing helpers ────────────────────────────────────────── */

function getUnitLabel(mode: string) {
    if (mode === 'sqm') return 'm\u00B2';
    if (mode === 'hour') return 'hr';
    return '';
}

/* ── main generator ─────────────────────────────────────────── */

export async function generateQuotePDF(
    settings: SettingsData,
    quote: QuoteData,
    client?: ClientData,
): Promise<Blob> {
    const PAGE_W = 210;
    const MARGIN = 18;
    const CONTENT_W = PAGE_W - MARGIN * 2;

    // ─── Load logo first ───
    let logoBase64: string | null = null;
    let logoW = 0;
    let logoH = 0;
    const LOGO_MAX_W = 40;
    const LOGO_MAX_H = 22;

    if (settings.logoUrl) {
        logoBase64 = await loadImageAsBase64(settings.logoUrl);
        if (logoBase64) {
            try {
                const img = new Image();
                img.src = logoBase64;
                await new Promise<void>((r) => { img.onload = () => r(); });
                logoW = LOGO_MAX_W;
                logoH = (img.naturalHeight / img.naturalWidth) * logoW;
                if (logoH > LOGO_MAX_H) {
                    logoH = LOGO_MAX_H;
                    logoW = (img.naturalWidth / img.naturalHeight) * logoH;
                }
            } catch { logoBase64 = null; }
        }
    }

    // ─── First pass: calculate the exact height needed ───
    const tmp = new jsPDF('p', 'mm', 'a4');
    let h = MARGIN;

    // Header block
    const headerTextH = (() => {
        let th = 0;
        if (settings.companyName) th += 8;
        if (settings.phone) th += 5;
        if (settings.email) th += 5;
        if (settings.website) th += 5;
        return th;
    })();
    const headerH = Math.max(headerTextH, logoH + 4);
    h += headerH + 6;

    // Description bar
    h += 12;

    // Services
    const filledServices = quote.services.filter(
        (s) => s.title || s.description || s.fixedPrice || (s.quantity && s.unitPrice),
    );
    if (filledServices.length > 0) {
        h += 4;
        for (const service of filledServices) {
            h += 6; // title line
            if (service.description) {
                tmp.setFontSize(9);
                const lines = wrapText(tmp, service.description, CONTENT_W);
                h += lines.length * 4;
            }
            h += 4; // gap
        }
    }

    // Divider bar
    h += 6;

    // Bottom section (totals + footer)
    h += 6; // base excl vat
    h += 5; // vat line
    h += 7; // total line
    if (quote.estimatedTime) h += 5;
    if (quote.expirationDate) h += 5;
    if (quote.paymentConditions) {
        tmp.setFontSize(9);
        const lines = wrapText(tmp, quote.paymentConditions, CONTENT_W / 2);
        h += lines.length * 4;
    }
    h += MARGIN;

    const PAGE_H = Math.max(h, 80);

    // ─── Create PDF ───
    const pdf = new jsPDF('p', 'mm', [PAGE_W, PAGE_H]);
    let y = MARGIN;

    // ══════ HEADER ══════
    const headerStartY = y;

    // Logo (top-right with margin)
    if (logoBase64 && logoW > 0) {
        const logoX = PAGE_W - MARGIN - logoW;
        pdf.addImage(logoBase64, 'PNG', logoX, headerStartY, logoW, logoH);
    }

    // Company info (top-left)
    const textMaxW = logoBase64 ? CONTENT_W - logoW - 8 : CONTENT_W;
    if (settings.companyName) {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(15);
        pdf.setTextColor(0, 0, 0);
        pdf.text(settings.companyName, MARGIN, y + 6);
        y += 10;
    }
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(80, 80, 80);
    if (settings.phone) {
        pdf.text(settings.phone, MARGIN, y + 3);
        y += 5;
    }
    if (settings.email) {
        pdf.text(settings.email, MARGIN, y + 3);
        y += 5;
    }
    if (settings.website) {
        pdf.text(settings.website, MARGIN, y + 3);
        y += 5;
    }

    y = headerStartY + headerH + 6;

    // ══════ DESCRIPTION BAR ══════
    const [br, bg, bb] = hexToRGB(settings.brandColor);
    pdf.setFillColor(br, bg, bb);
    pdf.rect(MARGIN, y, CONTENT_W, 10, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(255, 255, 255);
    pdf.text(settings.quoteDescription || 'Quote Description', MARGIN + 4, y + 7);
    y += 12;

    // ══════ SERVICES ══════
    if (filledServices.length > 0) {
        y += 4;
        pdf.setTextColor(0, 0, 0);

        for (const service of filledServices) {
            let priceDisplay = '';
            if (service.pricingMode === 'fixed') {
                if (service.fixedPrice) {
                    priceDisplay = parseFloat(service.fixedPrice).toFixed(2) + ' ' + settings.currency;
                }
            } else if (service.quantity && service.unitPrice) {
                const unit = getUnitLabel(service.pricingMode);
                const total = (parseFloat(service.quantity) * parseFloat(service.unitPrice)).toFixed(2);
                priceDisplay = total + ' ' + settings.currency + ' (' + service.quantity + ' ' + unit + ')';
            }

            // Title + price
            if (service.title) {
                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(10);
                pdf.setTextColor(0, 0, 0);
                pdf.text(service.title, MARGIN, y + 4);
            }
            if (priceDisplay) {
                pdf.setFont('helvetica', 'normal');
                pdf.setFontSize(10);
                pdf.setTextColor(0, 0, 0);
                pdf.text(priceDisplay, PAGE_W - MARGIN, y + 4, { align: 'right' });
            }
            y += 6;

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
            y += 4;
        }
    }

    // ══════ DIVIDER BAR ══════
    y += 2;
    pdf.setFillColor(br, bg, bb);
    pdf.rect(MARGIN, y, CONTENT_W, 2, 'F');
    y += 6;

    // ══════ BOTTOM SECTION ══════
    const settingsVat = settings.vatEnabled ? settings.vatPercentage : 0;
    const vatPercent = quote.vatOverride !== '' ? (parseFloat(quote.vatOverride) || 0) : settingsVat;
    const baseVal = parseFloat(quote.baseValue) || 0;
    const vatAmount = (baseVal * vatPercent) / 100;
    const totalValue = baseVal + vatAmount;

    const bottomStartY = y;

    // RIGHT SIDE: totals (right-aligned)
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(100, 100, 100);

    const rightEdge = PAGE_W - MARGIN;

    pdf.text(
        'Price excluding VAT: ' + settings.currency + ' ' + (baseVal > 0 ? baseVal.toFixed(2) : '0.00'),
        rightEdge, y + 3,
        { align: 'right' },
    );
    y += 5;

    pdf.text(
        'VAT ' + vatPercent + '%: ' + settings.currency + ' ' + (baseVal > 0 ? vatAmount.toFixed(2) : '0.00'),
        rightEdge, y + 3,
        { align: 'right' },
    );
    y += 6;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(0, 0, 0);
    pdf.text(
        'Total incl. VAT: ' + settings.currency + ' ' + (totalValue > 0 ? totalValue.toFixed(2) : '0.00'),
        rightEdge, y + 3,
        { align: 'right' },
    );

    // LEFT SIDE: footer info
    let footerY = bottomStartY;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(100, 100, 100);

    if (quote.estimatedTime) {
        pdf.text(quote.estimatedTime, MARGIN, footerY + 3);
        footerY += 5;
    }
    if (quote.expirationDate) {
        pdf.text(quote.expirationDate, MARGIN, footerY + 3);
        footerY += 5;
    }
    if (quote.paymentConditions) {
        const condLines = wrapText(pdf, quote.paymentConditions, CONTENT_W / 2);
        for (const line of condLines) {
            pdf.text(line, MARGIN, footerY + 3);
            footerY += 4;
        }
    }

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
