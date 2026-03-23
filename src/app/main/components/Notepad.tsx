'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { useTranslation } from '../context/LanguageContext';
import { useSubscription } from '@/app/context/SubscriptionContext';
import { getPlan } from '@/lib/plans';
import { createClient } from '@/lib/supabase-browser';
import styles from './Notepad.module.css';

interface Note {
    id: string;
    content: string;
    created_at: string;
    updated_at: string;
}

export default function Notepad() {
    const { user } = useAuth();
    const { sendMessage } = useChat();
    const { t, locale } = useTranslation();
    const { subscription } = useSubscription();
    const plan = getPlan(subscription?.plan || 'starter');
    const supabase = createClient();

    const MAX_RECORDING_SECONDS = 180; // 3 minutes for all plans

    const [isOpen, setIsOpen] = useState(false);
    const [notes, setNotes] = useState<Note[]>([]);
    const [activeNote, setActiveNote] = useState<Note | null>(null);
    const [editContent, setEditContent] = useState('');
    const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null);

    // Voice recording
    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Load notes
    const loadNotes = useCallback(async () => {
        if (!user) return;
        try {
            const { data } = await supabase
                .from('notes')
                .select('*')
                .eq('user_id', user.id)
                .order('updated_at', { ascending: false });
            if (data) setNotes(data);
        } catch (err) {
            console.error('Failed to load notes:', err);
        }
    }, [user, supabase]);

    useEffect(() => {
        if (isOpen && user) loadNotes();
    }, [isOpen, user, loadNotes]);

    // Create new note
    const createNote = async () => {
        if (!user) return;
        // Check note limit
        if (notes.length >= plan.features.mediaLimits.maxNotes) {
            alert(t('notepad.noteLimitReached') || `Note limit reached (${plan.features.mediaLimits.maxNotes}). Upgrade your plan for more.`);
            return;
        }
        try {
            const { data } = await supabase
                .from('notes')
                .insert({ user_id: user.id, content: '' })
                .select()
                .single();
            if (data) {
                setNotes(prev => [data, ...prev]);
                setActiveNote(data);
                setEditContent('');
            }
        } catch (err) {
            console.error('Failed to create note:', err);
        }
    };

    // Auto-save on content change (debounced)
    const handleContentChange = (value: string) => {
        setEditContent(value);
        if (saveTimeout) clearTimeout(saveTimeout);
        const timeout = setTimeout(() => saveNote(value), 800);
        setSaveTimeout(timeout);
    };

    const saveNote = async (content: string) => {
        if (!activeNote || !user) return;
        try {
            await supabase
                .from('notes')
                .update({ content, updated_at: new Date().toISOString() })
                .eq('id', activeNote.id);
            setNotes(prev =>
                prev.map(n => n.id === activeNote.id
                    ? { ...n, content, updated_at: new Date().toISOString() }
                    : n
                )
            );
        } catch (err) {
            console.error('Failed to save note:', err);
        }
    };

    // Delete note
    const deleteNote = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!user) return;
        try {
            await supabase.from('notes').delete().eq('id', id);
            setNotes(prev => prev.filter(n => n.id !== id));
            if (activeNote?.id === id) {
                setActiveNote(null);
                setEditContent('');
            }
        } catch (err) {
            console.error('Failed to delete note:', err);
        }
    };

    // Open a note for editing
    const openNote = (note: Note) => {
        setActiveNote(note);
        setEditContent(note.content);
    };

    // Go back to list
    const goBack = () => {
        if (saveTimeout) {
            clearTimeout(saveTimeout);
            if (activeNote) saveNote(editContent);
        }
        setActiveNote(null);
        setEditContent('');
        loadNotes();
    };

    // Close notepad
    const close = () => {
        if (saveTimeout) {
            clearTimeout(saveTimeout);
            if (activeNote) saveNote(editContent);
        }
        setActiveNote(null);
        setEditContent('');
        setIsOpen(false);
    };

    // Send to chat
    const handleSendToChat = async () => {
        if (!editContent.trim()) return;
        const content = editContent.trim();
        // Prefix with hidden instruction so the AI generates a proper quote via fill_quote tool
        const prefixedContent = `[NOTEPAD → Create a quote from these notes using fill_quote]\n\n${content}`;
        close();
        await sendMessage(prefixedContent);
    };

    // ── Voice Recording ──
    const toggleRecording = async () => {
        if (isTranscribing) return;

        if (isRecording) {
            // Stop recording
            if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);
            mediaRecorderRef.current?.stop();
            setIsRecording(false);
            return;
        }

        // Start recording
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream, {
                mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                    ? 'audio/webm;codecs=opus'
                    : 'audio/webm',
            });
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            mediaRecorder.onstop = async () => {
                stream.getTracks().forEach(track => track.stop());
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                if (blob.size > 0) {
                    await transcribeAudio(blob);
                }
            };

            mediaRecorder.start(250);
            setIsRecording(true);

            // Auto-stop after MAX_RECORDING_SECONDS
            recordingTimerRef.current = setTimeout(() => {
                if (mediaRecorderRef.current?.state === 'recording') {
                    mediaRecorderRef.current.stop();
                    setIsRecording(false);
                }
            }, MAX_RECORDING_SECONDS * 1000);
        } catch {
            console.error('Microphone access denied');
        }
    };

    const transcribeAudio = async (blob: Blob) => {
        setIsTranscribing(true);
        try {
            const formData = new FormData();
            formData.append('file', blob, 'recording.webm');
            // Pass language code for Whisper (e.g. 'pt', 'en', 'es')
            const langCode = locale?.split('-')[0] || 'pt';
            formData.append('language', langCode);

            const res = await fetch('/api/transcribe', {
                method: 'POST',
                body: formData,
            });

            if (res.ok) {
                const data = await res.json();
                if (data.text) {
                    const newContent = editContent
                        ? editContent + '\n' + data.text
                        : data.text;
                    setEditContent(newContent);
                    handleContentChange(newContent);
                }
            }
        } catch (err) {
            console.error('Transcription failed:', err);
        } finally {
            setIsTranscribing(false);
        }
    };

    // Format date
    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString(undefined, {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
        });
    };

    const getNoteTitle = (content: string) => {
        const firstLine = content.split('\n')[0]?.trim();
        return firstLine || t('notepad.untitled');
    };

    const getNotePreview = (content: string) => {
        const lines = content.split('\n').filter(l => l.trim());
        return lines.length > 1 ? lines[1] : '';
    };

    return (
        <>
            {/* ── Trigger Button ── */}
            <button className={styles.notepadTriggerBtn} onClick={() => setIsOpen(true)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                    <polyline points="10 9 9 9 8 9"/>
                </svg>
                {t('notepad.title')}
            </button>

            {/* ── Overlay ── */}
            {isOpen && (
                <div className={styles.notepadOverlay}>
                    <div className={styles.notepadHeader}>
                        <div className={styles.notepadTitle}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                <polyline points="14 2 14 8 20 8"/>
                                <line x1="16" y1="13" x2="8" y2="13"/>
                                <line x1="16" y1="17" x2="8" y2="17"/>
                            </svg>
                            {t('notepad.title')}
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            {!activeNote && (
                                <button className={styles.newNoteBtn} onClick={createNote}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="12" y1="5" x2="12" y2="19"/>
                                        <line x1="5" y1="12" x2="19" y2="12"/>
                                    </svg>
                                    {t('notepad.newNote')}
                                </button>
                            )}
                            <button className={styles.notepadCloseBtn} onClick={close}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18"/>
                                    <line x1="6" y1="6" x2="18" y2="18"/>
                                </svg>
                            </button>
                        </div>
                    </div>

                    {!activeNote ? (
                        /* ── Notes List ── */
                        <div className={styles.notesList}>
                            {notes.length === 0 ? (
                                <div className={styles.emptyState}>
                                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={styles.emptyIcon}>
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                        <polyline points="14 2 14 8 20 8"/>
                                    </svg>
                                    <p className={styles.emptyText}>{t('notepad.noNotes')}</p>
                                </div>
                            ) : (
                                notes.map(note => (
                                    <div key={note.id} className={styles.noteCard} onClick={() => openNote(note)}>
                                        <div className={styles.noteCardTitle}>
                                            {getNoteTitle(note.content)}
                                        </div>
                                        <div className={styles.noteCardPreview}>
                                            {getNotePreview(note.content)}
                                        </div>
                                        <div className={styles.noteCardMeta}>
                                            <span className={styles.noteCardDate}>
                                                {formatDate(note.updated_at)}
                                            </span>
                                            <button
                                                className={styles.noteDeleteBtn}
                                                onClick={(e) => deleteNote(note.id, e)}
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="3 6 5 6 21 6"/>
                                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    ) : (
                        /* ── Note Editor ── */
                        <div className={styles.noteEditor}>
                            <div className={styles.editorHeader}>
                                <button className={styles.backBtn} onClick={goBack}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M19 12H5"/>
                                        <polyline points="12 19 5 12 12 5"/>
                                    </svg>
                                    {t('notepad.back')}
                                </button>
                                <button
                                    className={`${styles.editorMicBtn} ${isRecording ? styles.micRecording : ''} ${isTranscribing ? styles.micTranscribing : ''}`}
                                    onClick={toggleRecording}
                                    disabled={isTranscribing}
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                                        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                                        <line x1="12" y1="19" x2="12" y2="23"/>
                                        <line x1="8" y1="23" x2="16" y2="23"/>
                                    </svg>
                                </button>
                            </div>
                            <textarea
                                className={styles.noteTextarea}
                                value={editContent}
                                onChange={e => handleContentChange(e.target.value)}
                                placeholder={t('notepad.placeholder')}
                                autoFocus
                            />
                            <div className={styles.editorFooter}>
                                <button
                                    className={styles.sendToChatBtn}
                                    onClick={handleSendToChat}
                                    disabled={!editContent.trim()}
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="22" y1="2" x2="11" y2="13"/>
                                        <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                                    </svg>
                                    {t('notepad.sendToChat')}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </>
    );
}
