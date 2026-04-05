'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from '../context/LanguageContext';
import styles from './TutorialOverlay.module.css';

/* ── Tutorial Step Definition ───────────────────────── */

interface TutorialStep {
    target: string;        // data-tutorial attribute value
    titleKey: string;      // locale key for title
    descKey: string;       // locale key for description
    emoji: string;
    requiresSidebar?: boolean; // if true, open sidebar before this step
}

const STEPS: TutorialStep[] = [
    // ── Main page steps ──
    { target: 'ai-chat',             titleKey: 'tutorial.stepAiChat',          descKey: 'tutorial.stepAiChatDesc',          emoji: '💬' },
    { target: 'fill-quote',          titleKey: 'tutorial.stepFillQuote',       descKey: 'tutorial.stepFillQuoteDesc',       emoji: '✨' },
    { target: 'notepad',             titleKey: 'tutorial.stepNotepad',         descKey: 'tutorial.stepNotepadDesc',         emoji: '📝' },
    { target: 'quote-form',          titleKey: 'tutorial.stepQuoteForm',       descKey: 'tutorial.stepQuoteFormDesc',       emoji: '📋' },
    { target: 'add-service',         titleKey: 'tutorial.stepAddService',      descKey: 'tutorial.stepAddServiceDesc',      emoji: '➕' },
    { target: 'add-photo-block',     titleKey: 'tutorial.stepPhotoBlock',      descKey: 'tutorial.stepPhotoBlockDesc',      emoji: '📷' },
    { target: 'pdf-preview',         titleKey: 'tutorial.stepPdfPreview',      descKey: 'tutorial.stepPdfPreviewDesc',      emoji: '📄' },
    { target: 'download-pdf',        titleKey: 'tutorial.stepDownload',        descKey: 'tutorial.stepDownloadDesc',        emoji: '⬇️' },
    { target: 'action-buttons',      titleKey: 'tutorial.stepActions',         descKey: 'tutorial.stepActionsDesc',         emoji: '📤' },
    { target: 'settings',            titleKey: 'tutorial.stepSettings',        descKey: 'tutorial.stepSettingsDesc',        emoji: '⚙️' },
    // ── Sidebar steps (auto-opens sidebar) ──
    { target: 'menu-button',         titleKey: 'tutorial.stepMenu',            descKey: 'tutorial.stepMenuDesc',            emoji: '☰' },
    { target: 'sidebar-conversations', titleKey: 'tutorial.stepConversations', descKey: 'tutorial.stepConversationsDesc',   emoji: '💬', requiresSidebar: true },
    { target: 'sidebar-quotes',      titleKey: 'tutorial.stepSavedQuotes',     descKey: 'tutorial.stepSavedQuotesDesc',     emoji: '📋', requiresSidebar: true },
    { target: 'sidebar-ai-prefs',    titleKey: 'tutorial.stepAiPrefs',         descKey: 'tutorial.stepAiPrefsDesc',         emoji: '🎛️', requiresSidebar: true },
    { target: 'sidebar-settings',    titleKey: 'tutorial.stepSidebarSettings', descKey: 'tutorial.stepSidebarSettingsDesc', emoji: '⚙️', requiresSidebar: true },
    { target: 'sidebar-media-usage', titleKey: 'tutorial.stepMediaUsage',      descKey: 'tutorial.stepMediaUsageDesc',      emoji: '📊', requiresSidebar: true },
];

const TUTORIAL_KEY = 'quoteflow_tutorial_completed';

/* ── Component ──────────────────────────────────────── */

interface TutorialOverlayProps {
    forceShow?: boolean;
    onForceShowConsumed?: () => void;
    onOpenSidebar?: () => void;
    onCloseSidebar?: () => void;
}

export default function TutorialOverlay({
    forceShow,
    onForceShowConsumed,
    onOpenSidebar,
    onCloseSidebar,
}: TutorialOverlayProps) {
    const { t } = useTranslation();

    const [phase, setPhase] = useState<'idle' | 'welcome' | 'touring' | 'done'>('idle');
    const [step, setStep] = useState(0);
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);

    // Check if tutorial should auto-start
    useEffect(() => {
        const completed = localStorage.getItem(TUTORIAL_KEY);
        if (!completed) {
            const timer = setTimeout(() => setPhase('welcome'), 1200);
            return () => clearTimeout(timer);
        }
    }, []);

    // Handle forceShow (replay from sidebar)
    useEffect(() => {
        if (forceShow) {
            localStorage.removeItem(TUTORIAL_KEY);
            setStep(0);
            setPhase('welcome');
            onForceShowConsumed?.();
        }
    }, [forceShow, onForceShowConsumed]);

    // Open/close sidebar based on current step
    useEffect(() => {
        if (phase !== 'touring') return;
        const stepDef = STEPS[step];
        if (!stepDef) return;

        if (stepDef.requiresSidebar) {
            onOpenSidebar?.();
        } else {
            onCloseSidebar?.();
        }
    }, [phase, step, onOpenSidebar, onCloseSidebar]);

    // Find and scroll to the target element for the current step
    const findTarget = useCallback(() => {
        if (phase !== 'touring') return;
        const stepDef = STEPS[step];
        if (!stepDef) return;

        // Give sidebar time to open/close before looking for element
        const delay = stepDef.requiresSidebar ? 450 : 100;

        setTimeout(() => {
            const el = document.querySelector(`[data-tutorial="${stepDef.target}"]`);
            if (!el) {
                setTargetRect(null);
                return;
            }

            // For sidebar elements, scroll within the sidebar container
            if (stepDef.requiresSidebar) {
                el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } else {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }

            setTimeout(() => {
                const rect = el.getBoundingClientRect();
                setTargetRect(rect);
            }, 350);
        }, delay);
    }, [phase, step]);

    useEffect(() => {
        findTarget();
    }, [findTarget]);

    // Recalculate on resize/scroll
    useEffect(() => {
        if (phase !== 'touring') return;

        const handleUpdate = () => {
            const stepDef = STEPS[step];
            if (!stepDef) return;
            const el = document.querySelector(`[data-tutorial="${stepDef.target}"]`);
            if (el) {
                setTargetRect(el.getBoundingClientRect());
            }
        };

        window.addEventListener('resize', handleUpdate);
        window.addEventListener('scroll', handleUpdate, true);

        return () => {
            window.removeEventListener('resize', handleUpdate);
            window.removeEventListener('scroll', handleUpdate, true);
        };
    }, [phase, step]);

    // ── Handlers ──

    const handleStart = () => {
        setStep(0);
        setPhase('touring');
    };

    const handleSkip = () => {
        localStorage.setItem(TUTORIAL_KEY, 'true');
        onCloseSidebar?.();
        setPhase('done');
    };

    const handleNext = () => {
        if (step < STEPS.length - 1) {
            setStep(step + 1);
        } else {
            localStorage.setItem(TUTORIAL_KEY, 'true');
            onCloseSidebar?.();
            setPhase('done');
        }
    };

    const handleBack = () => {
        if (step > 0) {
            setStep(step - 1);
        }
    };

    // ── Tooltip Positioning ──

    const getTooltipStyle = (): { style: React.CSSProperties; positionClass: string } => {
        if (!targetRect) {
            return {
                style: { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' },
                positionClass: '',
            };
        }

        const pad = 16;
        const tooltipW = 320;
        const tooltipH = 220;
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        const currentStep = STEPS[step];
        const isSidebar = currentStep?.requiresSidebar;

        let top: number;
        let left: number;
        let posClass: string;

        if (isSidebar) {
            // For sidebar items, position tooltip to the left of the target
            top = targetRect.top + targetRect.height / 2 - tooltipH / 2;
            left = targetRect.left - tooltipW - pad;
            posClass = styles.tooltipLeft;

            // If not enough space left, show to the right or below
            if (left < pad) {
                left = targetRect.right + pad;
                posClass = styles.tooltipRight;
            }
            if (left + tooltipW > vw - pad) {
                // Fall back to below
                top = targetRect.bottom + pad;
                left = targetRect.left + targetRect.width / 2 - tooltipW / 2;
                posClass = styles.tooltipBelow;
            }
        } else {
            // Default: show below
            top = targetRect.bottom + pad;
            left = targetRect.left + targetRect.width / 2 - tooltipW / 2;
            posClass = styles.tooltipBelow;

            if (top + tooltipH > vh) {
                top = targetRect.top - tooltipH - pad;
                posClass = styles.tooltipAbove;
            }

            if (top < pad) {
                top = vh / 2 - tooltipH / 2;
                posClass = '';
            }
        }

        // Clamp bounds
        if (top < pad) top = pad;
        if (top + tooltipH > vh - pad) top = vh - pad - tooltipH;
        if (left < pad) left = pad;
        if (left + tooltipW > vw - pad) left = vw - pad - tooltipW;

        return {
            style: { top: `${top}px`, left: `${left}px` },
            positionClass: posClass,
        };
    };

    // ── Render ──

    if (phase === 'done' || phase === 'idle') return null;

    // Welcome Screen
    if (phase === 'welcome') {
        return (
            <div className={styles.welcomeOverlay}>
                <div className={styles.welcomeCard}>
                    <span className={styles.welcomeEmoji}>🚀</span>
                    <h2 className={styles.welcomeTitle}>{t('tutorial.welcomeTitle')}</h2>
                    <p className={styles.welcomeDesc}>{t('tutorial.welcomeDesc')}</p>
                    <div className={styles.welcomeActions}>
                        <button className={styles.startBtn} onClick={handleStart}>
                            {t('tutorial.startTour')}
                        </button>
                        <button className={styles.skipTutorialBtn} onClick={handleSkip}>
                            {t('tutorial.skipTutorial')}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Touring
    const currentStep = STEPS[step];
    const { style: tooltipStyle, positionClass } = getTooltipStyle();
    const isLastStep = step === STEPS.length - 1;

    // Spotlight cutout dimensions
    const holePad = 8;
    const holeStyle: React.CSSProperties = targetRect
        ? {
            top: targetRect.top - holePad,
            left: targetRect.left - holePad,
            width: targetRect.width + holePad * 2,
            height: targetRect.height + holePad * 2,
        }
        : { display: 'none' };

    return (
        <>
            {/* Dark overlay with SVG mask for spotlight cutout */}
            <svg className={styles.spotlightSvg}>
                <defs>
                    <mask id="tutorial-mask">
                        <rect x="0" y="0" width="100%" height="100%" fill="white" />
                        {targetRect && (
                            <rect
                                className={styles.spotlightMask}
                                x={targetRect.left - holePad}
                                y={targetRect.top - holePad}
                                width={targetRect.width + holePad * 2}
                                height={targetRect.height + holePad * 2}
                                rx="10"
                                fill="black"
                            />
                        )}
                    </mask>
                </defs>
                <rect
                    x="0" y="0"
                    width="100%" height="100%"
                    fill="rgba(0,0,0,0.65)"
                    mask="url(#tutorial-mask)"
                />
            </svg>

            {/* Spotlight ring around target */}
            <div className={styles.spotlightHole} style={holeStyle} />

            {/* Invisible backdrop for click-to-dismiss */}
            <div className={styles.backdrop} onClick={handleSkip} style={{ background: 'transparent' }} />

            {/* Tooltip */}
            <div
                ref={tooltipRef}
                className={`${styles.tooltip} ${positionClass}`}
                style={tooltipStyle}
            >
                <h3 className={styles.tooltipTitle}>
                    <span className={styles.tooltipEmoji}>{currentStep.emoji}</span>
                    {t(currentStep.titleKey)}
                </h3>
                <p className={styles.tooltipDesc}>{t(currentStep.descKey)}</p>

                {/* Step dots */}
                <div className={styles.stepDots}>
                    {STEPS.map((_, i) => (
                        <div
                            key={i}
                            className={`${styles.dot} ${i === step ? styles.dotActive : ''} ${i < step ? styles.dotCompleted : ''}`}
                        />
                    ))}
                </div>

                {/* Navigation */}
                <div className={styles.navRow}>
                    <button className={`${styles.navBtn} ${styles.skipBtn}`} onClick={handleSkip}>
                        {t('tutorial.skip')}
                    </button>
                    {step > 0 && (
                        <button className={`${styles.navBtn} ${styles.backBtn}`} onClick={handleBack}>
                            {t('tutorial.back')}
                        </button>
                    )}
                    <button
                        className={`${styles.navBtn} ${isLastStep ? styles.doneBtn : styles.nextBtn}`}
                        onClick={handleNext}
                    >
                        {isLastStep ? t('tutorial.done') : t('tutorial.next')}
                    </button>
                </div>

                <p className={styles.stepCounter}>
                    {step + 1} / {STEPS.length}
                </p>
            </div>
        </>
    );
}
