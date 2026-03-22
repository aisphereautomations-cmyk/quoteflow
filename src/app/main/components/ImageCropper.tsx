'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import styles from './ImageCropper.module.css';

interface CropRect {
    x: number;
    y: number;
    w: number;
    h: number;
}

interface ImageCropperProps {
    imageSrc: string;
    onCrop: (croppedDataUrl: string) => void;
    onSkip: (compressedDataUrl: string) => void;
    onCancel: () => void;
    labels: {
        cancel: string;
        skipCrop: string;
        cropAndAdd: string;
    };
}

export default function ImageCropper({ imageSrc, onCrop, onSkip, onCancel, labels }: ImageCropperProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const imgRef = useRef<HTMLImageElement | null>(null);

    // The displayed image dimensions (scaled to fit the container)
    const [imgDisplay, setImgDisplay] = useState({ w: 0, h: 0, offsetX: 0, offsetY: 0 });
    // Crop rect in display coordinates (relative to the image top-left on canvas)
    const [cropRect, setCropRect] = useState<CropRect>({ x: 0, y: 0, w: 0, h: 0 });
    // Which handle is being dragged
    const [dragging, setDragging] = useState<string | null>(null);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [cropStart, setCropStart] = useState<CropRect>({ x: 0, y: 0, w: 0, h: 0 });
    const [loaded, setLoaded] = useState(false);

    // Load the image and fit it to screen
    useEffect(() => {
        const img = new Image();
        img.onload = () => {
            imgRef.current = img;
            fitImage(img);
            setLoaded(true);
        };
        img.src = imageSrc;
    }, [imageSrc]);

    // Recalculate on window resize
    useEffect(() => {
        const handleResize = () => {
            if (imgRef.current) fitImage(imgRef.current);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const fitImage = (img: HTMLImageElement) => {
        const container = containerRef.current;
        if (!container) return;

        const maxW = container.clientWidth;
        const maxH = container.clientHeight;

        const scale = Math.min(maxW / img.width, maxH / img.height, 1);
        const dw = img.width * scale;
        const dh = img.height * scale;
        const ox = (maxW - dw) / 2;
        const oy = (maxH - dh) / 2;

        setImgDisplay({ w: dw, h: dh, offsetX: ox, offsetY: oy });
        setCropRect({ x: 0, y: 0, w: dw, h: dh });
    };

    // Draw the image + dim overlay + crop rect + handles
    useEffect(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container || !imgRef.current || !loaded) return;

        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const { w, h, offsetX, offsetY } = imgDisplay;
        const img = imgRef.current;

        // Clear
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw the image
        ctx.drawImage(img, offsetX, offsetY, w, h);

        // Draw dim overlay (everything outside crop)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        // Top
        ctx.fillRect(offsetX, offsetY, w, cropRect.y);
        // Bottom
        ctx.fillRect(offsetX, offsetY + cropRect.y + cropRect.h, w, h - cropRect.y - cropRect.h);
        // Left
        ctx.fillRect(offsetX, offsetY + cropRect.y, cropRect.x, cropRect.h);
        // Right
        ctx.fillRect(offsetX + cropRect.x + cropRect.w, offsetY + cropRect.y, w - cropRect.x - cropRect.w, cropRect.h);

        // Crop border
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.strokeRect(offsetX + cropRect.x, offsetY + cropRect.y, cropRect.w, cropRect.h);

        // Grid lines (thirds)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        const cx = offsetX + cropRect.x;
        const cy = offsetY + cropRect.y;
        // Vertical thirds
        ctx.beginPath();
        ctx.moveTo(cx + cropRect.w / 3, cy); ctx.lineTo(cx + cropRect.w / 3, cy + cropRect.h);
        ctx.moveTo(cx + (2 * cropRect.w) / 3, cy); ctx.lineTo(cx + (2 * cropRect.w) / 3, cy + cropRect.h);
        // Horizontal thirds
        ctx.moveTo(cx, cy + cropRect.h / 3); ctx.lineTo(cx + cropRect.w, cy + cropRect.h / 3);
        ctx.moveTo(cx, cy + (2 * cropRect.h) / 3); ctx.lineTo(cx + cropRect.w, cy + (2 * cropRect.h) / 3);
        ctx.stroke();

        // Draw handles (8 handles: 4 corners + 4 edges)
        const handleSize = 12;
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 2;

        const handles = getHandlePositions(cropRect, offsetX, offsetY);
        for (const pos of Object.values(handles)) {
            ctx.fillRect(pos.x - handleSize / 2, pos.y - handleSize / 2, handleSize, handleSize);
            ctx.strokeRect(pos.x - handleSize / 2, pos.y - handleSize / 2, handleSize, handleSize);
        }

    }, [imgDisplay, cropRect, loaded]);

    function getHandlePositions(rect: CropRect, ox: number, oy: number) {
        const cx = ox + rect.x;
        const cy = oy + rect.y;
        return {
            tl: { x: cx, y: cy },
            tr: { x: cx + rect.w, y: cy },
            bl: { x: cx, y: cy + rect.h },
            br: { x: cx + rect.w, y: cy + rect.h },
            t:  { x: cx + rect.w / 2, y: cy },
            b:  { x: cx + rect.w / 2, y: cy + rect.h },
            l:  { x: cx, y: cy + rect.h / 2 },
            r:  { x: cx + rect.w, y: cy + rect.h / 2 },
        };
    }

    function getHandle(px: number, py: number): string | null {
        const handles = getHandlePositions(cropRect, imgDisplay.offsetX, imgDisplay.offsetY);
        const threshold = 16;
        for (const [key, pos] of Object.entries(handles)) {
            if (Math.abs(px - pos.x) < threshold && Math.abs(py - pos.y) < threshold) {
                return key;
            }
        }
        // Check if inside crop rect for move
        const cx = imgDisplay.offsetX + cropRect.x;
        const cy = imgDisplay.offsetY + cropRect.y;
        if (px >= cx && px <= cx + cropRect.w && py >= cy && py <= cy + cropRect.h) {
            return 'move';
        }
        return null;
    }

    function getCursorForHandle(handle: string | null): string {
        switch (handle) {
            case 'tl': case 'br': return 'nwse-resize';
            case 'tr': case 'bl': return 'nesw-resize';
            case 't': case 'b': return 'ns-resize';
            case 'l': case 'r': return 'ew-resize';
            case 'move': return 'move';
            default: return 'default';
        }
    }

    const getPointerPos = (e: React.PointerEvent | PointerEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const onPointerDown = useCallback((e: React.PointerEvent) => {
        const pos = getPointerPos(e);
        const handle = getHandle(pos.x, pos.y);
        if (handle) {
            setDragging(handle);
            setDragStart(pos);
            setCropStart({ ...cropRect });
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            e.preventDefault();
        }
    }, [cropRect, imgDisplay]);

    const onPointerMove = useCallback((e: React.PointerEvent) => {
        if (!dragging) {
            // Update cursor
            const pos = getPointerPos(e);
            const handle = getHandle(pos.x, pos.y);
            const canvas = canvasRef.current;
            if (canvas) canvas.style.cursor = getCursorForHandle(handle);
            return;
        }

        const pos = getPointerPos(e);
        const dx = pos.x - dragStart.x;
        const dy = pos.y - dragStart.y;
        const minSize = 30;

        let newRect = { ...cropStart };

        switch (dragging) {
            case 'move':
                newRect.x = Math.max(0, Math.min(imgDisplay.w - cropStart.w, cropStart.x + dx));
                newRect.y = Math.max(0, Math.min(imgDisplay.h - cropStart.h, cropStart.y + dy));
                break;
            case 'tl':
                newRect.x = Math.max(0, Math.min(cropStart.x + cropStart.w - minSize, cropStart.x + dx));
                newRect.y = Math.max(0, Math.min(cropStart.y + cropStart.h - minSize, cropStart.y + dy));
                newRect.w = cropStart.w - (newRect.x - cropStart.x);
                newRect.h = cropStart.h - (newRect.y - cropStart.y);
                break;
            case 'tr':
                newRect.w = Math.max(minSize, Math.min(imgDisplay.w - cropStart.x, cropStart.w + dx));
                newRect.y = Math.max(0, Math.min(cropStart.y + cropStart.h - minSize, cropStart.y + dy));
                newRect.h = cropStart.h - (newRect.y - cropStart.y);
                break;
            case 'bl':
                newRect.x = Math.max(0, Math.min(cropStart.x + cropStart.w - minSize, cropStart.x + dx));
                newRect.w = cropStart.w - (newRect.x - cropStart.x);
                newRect.h = Math.max(minSize, Math.min(imgDisplay.h - cropStart.y, cropStart.h + dy));
                break;
            case 'br':
                newRect.w = Math.max(minSize, Math.min(imgDisplay.w - cropStart.x, cropStart.w + dx));
                newRect.h = Math.max(minSize, Math.min(imgDisplay.h - cropStart.y, cropStart.h + dy));
                break;
            case 't':
                newRect.y = Math.max(0, Math.min(cropStart.y + cropStart.h - minSize, cropStart.y + dy));
                newRect.h = cropStart.h - (newRect.y - cropStart.y);
                break;
            case 'b':
                newRect.h = Math.max(minSize, Math.min(imgDisplay.h - cropStart.y, cropStart.h + dy));
                break;
            case 'l':
                newRect.x = Math.max(0, Math.min(cropStart.x + cropStart.w - minSize, cropStart.x + dx));
                newRect.w = cropStart.w - (newRect.x - cropStart.x);
                break;
            case 'r':
                newRect.w = Math.max(minSize, Math.min(imgDisplay.w - cropStart.x, cropStart.w + dx));
                break;
        }

        setCropRect(newRect);
    }, [dragging, dragStart, cropStart, imgDisplay]);

    const onPointerUp = useCallback(() => {
        setDragging(null);
    }, []);

    const handleCrop = () => {
        const img = imgRef.current;
        if (!img) return;

        // Convert display coords to actual image coords
        const scaleX = img.width / imgDisplay.w;
        const scaleY = img.height / imgDisplay.h;

        const srcX = cropRect.x * scaleX;
        const srcY = cropRect.y * scaleY;
        const srcW = cropRect.w * scaleX;
        const srcH = cropRect.h * scaleY;

        const canvas = document.createElement('canvas');
        const maxW = 1200;
        const outScale = Math.min(1, maxW / srcW);
        canvas.width = srcW * outScale;
        canvas.height = srcH * outScale;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, canvas.width, canvas.height);
        onCrop(canvas.toDataURL('image/jpeg', 0.92));
    };

    const handleSkip = () => {
        const img = imgRef.current;
        if (!img) return;
        const canvas = document.createElement('canvas');
        const maxW = 1200;
        const scale = Math.min(1, maxW / img.width);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        onSkip(canvas.toDataURL('image/jpeg', 0.92));
    };

    return (
        <div className={styles.overlay}>
            <div className={styles.cropArea} ref={containerRef}>
                <canvas
                    ref={canvasRef}
                    className={styles.canvas}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerLeave={onPointerUp}
                />
            </div>
            <div className={styles.controls}>
                <button className={styles.cancelBtn} onClick={onCancel}>
                    {labels.cancel}
                </button>
                <button className={styles.skipBtn} onClick={handleSkip}>
                    {labels.skipCrop}
                </button>
                <button className={styles.cropBtn} onClick={handleCrop}>
                    {labels.cropAndAdd}
                </button>
            </div>
        </div>
    );
}
