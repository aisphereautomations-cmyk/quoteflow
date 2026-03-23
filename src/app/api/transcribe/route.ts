import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import OpenAI from 'openai';
import { getPlan, type PlanId } from '@/lib/plans';

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

        // ── Check voice minute quota ──
        const { data: sub } = await supabase
            .from('subscriptions')
            .select('plan')
            .eq('user_id', user.id)
            .single();

        const planId = (sub?.plan || 'starter') as PlanId;
        const plan = getPlan(planId);
        const maxMinutes = plan.features.mediaLimits.voiceMinutesPerMonth;

        // Get or initialize usage tracking
        const { data: settings } = await supabase
            .from('user_settings')
            .select('voice_minutes_used, voice_minutes_reset')
            .eq('user_id', user.id)
            .single();

        let minutesUsed = settings?.voice_minutes_used || 0;
        const lastReset = settings?.voice_minutes_reset
            ? new Date(settings.voice_minutes_reset)
            : null;

        // Monthly reset: if last reset was in a different month, reset counter
        const now = new Date();
        if (!lastReset || lastReset.getMonth() !== now.getMonth() || lastReset.getFullYear() !== now.getFullYear()) {
            minutesUsed = 0;
            await supabase
                .from('user_settings')
                .update({ voice_minutes_used: 0, voice_minutes_reset: now.toISOString() })
                .eq('user_id', user.id);
        }

        if (minutesUsed >= maxMinutes) {
            return NextResponse.json({
                error: 'Voice quota exceeded',
                message: `You have used all ${maxMinutes} minutes of voice transcription this month. Upgrade your plan for more.`,
            }, { status: 429 });
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

        // ── Track usage: estimate duration from file size (webm ~6KB/s at opus) ──
        const estimatedSeconds = Math.max(1, Math.ceil(audioFile.size / 6000));
        const estimatedMinutes = Math.ceil(estimatedSeconds / 60);
        await supabase
            .from('user_settings')
            .update({ voice_minutes_used: minutesUsed + estimatedMinutes })
            .eq('user_id', user.id);

        return NextResponse.json({ text: transcription.text });
    } catch (err) {
        console.error('Transcription error:', err);
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: 'Transcription failed', message }, { status: 500 });
    }
}
