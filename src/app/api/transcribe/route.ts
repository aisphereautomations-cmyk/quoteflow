import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import OpenAI from 'openai';

export async function POST(request: NextRequest) {
    try {
        // Auth check
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({
                error: 'AI not configured',
                message: 'The AI assistant is not yet configured. Please add your OpenAI API key.',
            }, { status: 503 });
        }

        const formData = await request.formData();
        const audioFile = formData.get('file');
        const language = formData.get('language') as string | null;

        if (!audioFile || !(audioFile instanceof Blob)) {
            return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
        }

        // Convert the web Blob into a File object that the OpenAI SDK expects
        const file = new File([audioFile], 'audio.webm', {
            type: audioFile.type || 'audio/webm',
        });

        const openai = new OpenAI({ apiKey });

        const transcription = await openai.audio.transcriptions.create({
            model: 'whisper-1',
            file,
            ...(language ? { language } : {}),
        });

        return NextResponse.json({ text: transcription.text });
    } catch (err) {
        console.error('Transcription error:', err);
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: 'Transcription failed', message }, { status: 500 });
    }
}
