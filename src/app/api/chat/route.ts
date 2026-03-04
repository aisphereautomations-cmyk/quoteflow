import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import OpenAI from 'openai';

const SYSTEM_PROMPT = `You are an expert quoting assistant for service businesses (construction, painting, cleaning, plumbing, electrical work, landscaping, renovation, etc.).

YOUR ROLE:
- Help users build professional quotes by discussing their job requirements
- Ask smart clarifying questions (area sizes, materials, location, complexity)
- Reason about realistic pricing for the user's region and currency
- Choose the right pricing mode for each service: "sqm" (per square meter), "hour" (per hour), or "fixed" (fixed price)
- Be conversational and natural, like a knowledgeable colleague

PRICING GUIDELINES:
- Always consider the user's country/region when suggesting prices
- Use your knowledge of typical market rates for common services
- When unsure, give a reasonable range and explain your reasoning
- Factor in complexity, materials, labor, and regional cost of living
- If the user mentions a specific city or country, adjust pricing accordingly

WHEN YOU HAVE ENOUGH INFORMATION to build a quote, call the fill_quote function with structured data. You can do this at any point when you feel you have sufficient detail. Always tell the user what you're suggesting and why.

IMPORTANT:
- Always respond in the same language the user writes in
- Be concise but helpful — this is a mobile app
- If the user gives vague info, ask ONE focused follow-up question at a time
- When suggesting prices, briefly explain your reasoning`;

const FILL_QUOTE_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
    type: 'function',
    function: {
        name: 'fill_quote',
        description: 'Fill the quote form with services, pricing, and details based on the conversation. Call this when you have enough information to build a quote.',
        parameters: {
            type: 'object',
            properties: {
                services: {
                    type: 'array',
                    description: 'List of services to include in the quote',
                    items: {
                        type: 'object',
                        properties: {
                            title: {
                                type: 'string',
                                description: 'Service name (e.g. "Wall Painting", "Floor Tiling")',
                            },
                            description: {
                                type: 'string',
                                description: 'Brief description of the service scope',
                            },
                            pricingMode: {
                                type: 'string',
                                enum: ['sqm', 'hour', 'fixed'],
                                description: 'Pricing model: sqm (per m²), hour (per hour), or fixed (lump sum)',
                            },
                            quantity: {
                                type: 'string',
                                description: 'Number of units (m² or hours). Leave empty for fixed pricing.',
                            },
                            unitPrice: {
                                type: 'string',
                                description: 'Price per unit (per m² or per hour). Leave empty for fixed pricing.',
                            },
                            fixedPrice: {
                                type: 'string',
                                description: 'Fixed total price for this service. Only used when pricingMode is "fixed".',
                            },
                        },
                        required: ['title', 'pricingMode'],
                    },
                },
                baseValue: {
                    type: 'string',
                    description: 'Total base value before tax (sum of all services)',
                },
                estimatedTime: {
                    type: 'string',
                    description: 'Estimated time to complete the work (e.g. "5-7 working days")',
                },
                expirationDate: {
                    type: 'string',
                    description: 'Quote validity period (e.g. "Valid for 30 days")',
                },
                paymentConditions: {
                    type: 'string',
                    description: 'Payment terms (e.g. "50% upfront, 50% on completion")',
                },
            },
            required: ['services', 'baseValue'],
        },
    },
};

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
                message: 'The AI assistant is not yet configured. Please add your OpenAI API key to get started.',
            }, { status: 503 });
        }

        const { messages, settings } = await request.json() as {
            messages: { role: 'user' | 'assistant'; content: string }[];
            settings?: { currency?: string; taxCountry?: string };
        };

        if (!messages || messages.length === 0) {
            return NextResponse.json({ error: 'No messages provided' }, { status: 400 });
        }

        // Build context-aware system prompt
        const contextInfo = settings
            ? `\n\nUSER CONTEXT:\n- Currency: ${settings.currency || '€'}\n- Tax country: ${settings.taxCountry || 'uk'}\nUse this context to give location-appropriate pricing suggestions.`
            : '';

        const openai = new OpenAI({ apiKey });

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: SYSTEM_PROMPT + contextInfo },
                ...messages,
            ],
            tools: [FILL_QUOTE_TOOL],
            tool_choice: 'auto',
            max_tokens: 1024,
            temperature: 0.7,
        });

        const choice = completion.choices[0];
        const assistantMessage = choice.message;

        // Check if the AI called the fill_quote function
        let quoteData = null;
        if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const fillCall = assistantMessage.tool_calls.find(
                (tc: any) => tc.function?.name === 'fill_quote'
            );
            if (fillCall) {
                try {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    quoteData = JSON.parse((fillCall as any).function.arguments);
                } catch {
                    console.error('Failed to parse fill_quote arguments');
                }
            }
        }

        return NextResponse.json({
            message: assistantMessage.content || '',
            quoteData,
        });
    } catch (err) {
        console.error('Chat API error:', err);
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: 'Chat failed', message }, { status: 500 });
    }
}
