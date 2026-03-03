import { jsPDF } from 'jspdf';
import type { SettingsData } from '../context/SettingsContext';
import type { QuoteData } from '../context/QuoteContext';

export interface ClientData {
    clientName: string;
    email: string;
    whatsapp: string;
    serviceTitle: string;
}

/* ── helpers ─────────────────────────────────────────────────── */

function hexToRGB(hex: string): [number, number, number] {
    const h = hex.replace('#', '');
    return [
        parseInt(h.substring(0, 2), 16),
        parseInt(h.substring(2, 4), 16),
        parseInt(h.substring(4, 6), 16),
    ];
}

async function loadImageAsBase64(url: string): Promise<string | null> {
    if (url.startsWith('data:')) return url;
    try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = url;
        await new Promise<void>((ok, fail) => { img.onload = () => ok(); img.onerror = () => fail(); });
        const c = document.createElement('canvas');
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const ctx = c.getContext('2d');
        if (!ctx) return null;
        ctx.drawImage(img, 0, 0);
        return c.toDataURL('image/png');
    } catch { return null; }
}

function wrapText(pdf: jsPDF, text: string, maxWidth: number): string[] {
    const out: string[] = [];
    for (const para of text.split('\n')) {
        if (!para.trim()) { out.push(''); continue; }
        out.push(...(pdf.splitTextToSize(para, maxWidth) as string[]));
    }
    return out;
}

function getUnitLabel(mode: string) {
    if (mode === 'sqm') return 'm\u00B2';
    if (mode === 'hour') return 'hr';
    return '';
}

/*
 * ═══════════════════════════════════════════════════════
 *  generateQuotePDF
 *
 *  Uses POINTS as the unit so that 1 pt ≈ 1 CSS px.
 *  The preview is 595 px wide → PDF is 595 pt wide (=A4).
 *  Font sizes in pt match the CSS font-sizes in px.
 *  Paddings/margins match the CSS values exactly.
 * ═══════════════════════════════════════════════════════
 */

export async function generateQuotePDF(
    settings: SettingsData,
    quote: QuoteData,
    client?: ClientData,
): Promise<Blob> {

    // ── Page constants matching the CSS ──
    const W = 595;           // page width (= previewFrame 595px)
    const PAD = 40;          // side padding (= CSS padding: 40px)
    const CW = W - PAD * 2; // content width = 515

    // ── Load logo ──
    let logoB64: string | null = null;
    let logoW = 0, logoH = 0;
    if (settings.logoUrl) {
        logoB64 = await loadImageAsBase64(settings.logoUrl);
        if (logoB64) {
            try {
                const img = new Image();
                img.src = logoB64;
                await new Promise<void>((r) => { img.onload = () => r(); });
                // Logo area in CSS: 90×90 px
                logoW = 90; logoH = (img.naturalHeight / img.naturalWidth) * 90;
                if (logoH > 90) { logoH = 90; logoW = (img.naturalWidth / img.naturalHeight) * 90; }
            } catch { logoB64 = null; }
        }
    }

    // ── Calculate total height ──
    const m = new jsPDF('p', 'pt', 'a4');  // temp for text measurement
    let h = 40; // top padding (CSS: padding-top 40px in pdfHeader)

    // Header
    const hdrTextH = (settings.companyName ? 36 : 0) + // 22px font + 14px margin-bottom
        (settings.phone ? 16 : 0) +
        (settings.email ? 16 : 0) +
        (settings.website ? 16 : 0);
    h += Math.max(hdrTextH, logoH) + 28; // 28 = bottom padding of header

    // Description bar
    h += 29; // CSS: height 29px

    // Services area
    const filledServices = quote.services.filter(
        (s) => s.title || s.description || s.fixedPrice || (s.quantity && s.unitPrice),
    );
    if (filledServices.length > 0) {
        h += 30; // top padding of servicesArea
        for (const svc of filledServices) {
            h += 8 + 18; // serviceRow: margin-bottom 8 + title 18px line
            if (svc.description) {
                m.setFontSize(16);
                const lines = wrapText(m, svc.description, CW);
                h += lines.length * 16 * 1.7; // 16px font × 1.7 line-height
            }
            h += 28; // margin-bottom per service
        }
        h += 40; // bottom padding of servicesArea
    } else {
        // Even with no services, equal amount of padding
        h += 60;
    }

    // Totals divider bar
    h += 14; // CSS: height 14px

    // Bottom section
    h += 20; // padding-top
    h += 20 + 20 + 22; // baseValueLine×2 + totalValueLine
    if (quote.estimatedTime) h += 16 * 1.6;
    if (quote.expirationDate) h += 16 * 1.6;
    if (quote.paymentConditions) {
        m.setFontSize(15);
        h += wrapText(m, quote.paymentConditions, CW / 2).length * 15 * 1.6;
    }
    h += 36; // padding-bottom

    const PAGE_H = Math.max(h, 400);

    // ── Create the PDF ──
    const pdf = new jsPDF('p', 'pt', [W, PAGE_H]);
    let y = 40; // start at top padding

    const [br, bg, bb] = hexToRGB(settings.brandColor);

    // ════════ HEADER (CSS: padding 40px 40px 28px) ════════
    const headerTop = y;

    // Logo top-right
    if (logoB64 && logoW > 0) {
        const lx = W - PAD - logoW;
        try { pdf.addImage(logoB64, 'PNG', lx, headerTop, logoW, logoH); } catch { /* skip */ }
    }

    // Company info top-left
    let ty = headerTop;
    if (settings.companyName) {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(22);
        pdf.setTextColor(17, 17, 17);
        pdf.text(settings.companyName, PAD, ty + 22); // baseline offset ≈ font size
        ty += 36; // 22 + 14 margin-bottom
    }
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(15);
    pdf.setTextColor(68, 68, 68);
    if (settings.phone) { pdf.text(settings.phone, PAD, ty + 13); ty += 16; }
    if (settings.email) { pdf.text(settings.email, PAD, ty + 13); ty += 16; }
    if (settings.website) { pdf.text(settings.website, PAD, ty + 13); ty += 16; }

    y = headerTop + Math.max(ty - headerTop, logoH) + 28;

    // ════════ DESCRIPTION BAR (full width, 29px tall) ════════
    pdf.setFillColor(br, bg, bb);
    pdf.rect(0, y, W, 29, 'F');   // full width, no side margins
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.setTextColor(255, 255, 255);
    pdf.text(settings.quoteDescription || 'Quote Description', W / 2, y + 19, { align: 'center' });
    y += 29;

    // ════════ SERVICES (CSS: padding 30px 40px) ════════
    if (filledServices.length > 0) {
        y += 30; // top padding

        for (const svc of filledServices) {
            let priceStr = '';
            if (svc.pricingMode === 'fixed' && svc.fixedPrice) {
                priceStr = parseFloat(svc.fixedPrice).toFixed(2) + ' ' + settings.currency;
            } else if (svc.quantity && svc.unitPrice) {
                const u = getUnitLabel(svc.pricingMode);
                const t = (parseFloat(svc.quantity) * parseFloat(svc.unitPrice)).toFixed(2);
                priceStr = t + ' ' + settings.currency + ' (' + svc.quantity + ' ' + u + ')';
            }

            // Title (left) + price (right) on same line
            if (svc.title) {
                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(18);
                pdf.setTextColor(17, 17, 17);
                pdf.text(svc.title, PAD, y + 14);
            }
            if (priceStr) {
                pdf.setFont('helvetica', 'normal');
                pdf.setFontSize(14);
                pdf.setTextColor(34, 34, 34);
                const pw = pdf.getTextWidth(priceStr);
                pdf.text(priceStr, W - PAD - pw, y + 14);
            }
            y += 26; // serviceRow height + margin

            // Description
            if (svc.description) {
                pdf.setFont('helvetica', 'normal');
                pdf.setFontSize(16);
                pdf.setTextColor(68, 68, 68);
                const lines = wrapText(pdf, svc.description, CW);
                const lh = 16 * 1.7;
                for (const line of lines) {
                    pdf.text(line, PAD, y + 13);
                    y += lh;
                }
            }
            y += 28; // gap between services
        }
    } else {
        y += 60;
    }

    // ════════ TOTALS DIVIDER BAR (full width, 14px tall) ════════
    pdf.setFillColor(br, bg, bb);
    pdf.rect(0, y, W, 14, 'F');   // full width
    y += 14;

    // ════════ BOTTOM SECTION (CSS: padding 20px 40px 36px) ════════
    y += 20;

    const sVat = settings.vatEnabled ? settings.vatPercentage : 0;
    const vPct = quote.vatOverride !== '' ? (parseFloat(quote.vatOverride) || 0) : sVat;
    const base = parseFloat(quote.baseValue) || 0;
    const vatAmt = (base * vPct) / 100;
    const total = base + vatAmt;

    const bY = y; // save start for footer on left side

    // Totals — right-aligned (manually positioned)
    const rx = W - PAD; // right edge

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(16);
    pdf.setTextColor(51, 51, 51);

    const t1 = 'Price excluding VAT: ' + settings.currency + ' ' + (base > 0 ? base.toFixed(2) : '0.00');
    const t1w = pdf.getTextWidth(t1);
    pdf.text(t1, rx - t1w, y + 13);
    y += 20;

    const t2 = 'VAT ' + vPct + '%: ' + settings.currency + ' ' + (base > 0 ? vatAmt.toFixed(2) : '0.00');
    const t2w = pdf.getTextWidth(t2);
    pdf.text(t2, rx - t2w, y + 13);
    y += 20;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(18);
    pdf.setTextColor(17, 17, 17);
    const t3 = 'Total incl. VAT: ' + settings.currency + ' ' + (total > 0 ? total.toFixed(2) : '0.00');
    const t3w = pdf.getTextWidth(t3);
    pdf.text(t3, rx - t3w, y + 14);

    // Footer — left side
    let fy = bY;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(15);
    pdf.setTextColor(68, 68, 68);
    if (quote.estimatedTime) { pdf.text(quote.estimatedTime, PAD, fy + 13); fy += 16 * 1.6; }
    if (quote.expirationDate) { pdf.text(quote.expirationDate, PAD, fy + 13); fy += 16 * 1.6; }
    if (quote.paymentConditions) {
        const cl = wrapText(pdf, quote.paymentConditions, CW / 2);
        for (const ln of cl) { pdf.text(ln, PAD, fy + 13); fy += 15 * 1.6; }
    }

    return pdf.output('blob');
}

/* ── download helper ── */

export function downloadPDF(blob: Blob, filename: string = 'quote.pdf'): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
