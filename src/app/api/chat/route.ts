import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import OpenAI from 'openai';

function buildSystemPrompt(settings?: {
    currency?: string;
    taxCountry?: string;
    sliderDetail?: number;
    sliderMarket?: number;
    sliderTone?: number;
}) {
    // Map slider values (0-100) to descriptive levels
    const detailLevel = (settings?.sliderDetail ?? 50) > 66 ? 'detailed' : (settings?.sliderDetail ?? 50) < 33 ? 'minimal' : 'moderate';
    const marketLevel = (settings?.sliderMarket ?? 50) > 66 ? 'premium/high-end' : (settings?.sliderMarket ?? 50) < 33 ? 'budget/economical' : 'mid-range';
    const toneLevel = (settings?.sliderTone ?? 50) > 66 ? 'formal and professional' : (settings?.sliderTone ?? 50) < 33 ? 'casual and friendly' : 'balanced professional';

    return `You are an expert quoting assistant for service businesses (construction, painting, cleaning, plumbing, electrical work, landscaping, renovation, etc.).

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

USER PREFERENCES:
- Detail level: ${detailLevel} — ${detailLevel === 'detailed' ? 'Write thorough, rich content. Use many service blocks to structure the quote like a professional document. Include materials, methods, scope details, disclaimers, and notes. Think of the quote as a multi-section document, not a simple list.' : detailLevel === 'minimal' ? 'Keep it short. Few blocks, just titles and prices. No extra notes or descriptions.' : 'Moderate detail. Use descriptions where helpful, skip where obvious.'}
- Market positioning: ${marketLevel} — ${marketLevel === 'premium/high-end' ? 'Suggest prices at the higher end of market rates. Use professional, quality-focused language. Emphasize materials and craftsmanship.' : marketLevel === 'budget/economical' ? 'Suggest prices at the lower end of market rates. Emphasize value and affordability.' : 'Suggest mid-range market prices. Balance quality and value.'}
- Tone: ${toneLevel}

HOW SERVICE BLOCKS WORK — THIS IS CRITICAL:
Think of the quote form like a Word document. Each "service block" has a TITLE field and a DESCRIPTION field, plus optional pricing. You can use them flexibly:

- TITLE = a heading (like H2 in Word). Can be a service name, a section header, or left empty.
- DESCRIPTION = a paragraph of free text. Can be a scope description, a note, a disclaimer, terms, or anything.
- PRICE = optional. Only add when the block represents a priced service.

You MUST use MULTIPLE blocks to create a well-structured, professional quote. Do NOT cram everything into one block.

EXAMPLES OF GOOD BLOCK USAGE:

Example 1 — Roof installation quote (detailed):
Block 1: title="Instalação de Telhado" | description="Fornecimento e instalação de telhado completo com telhas cerâmicas na área especificada." | NO PRICE (this is a section header with intro paragraph)
Block 2: title="Materiais" | description="Telhas cerâmicas tipo Lusa, ripas em madeira tratada, membrana impermeabilizante, parafusos inox e cumeeiras." | pricingMode="fixed" fixedPrice="2200"
Block 3: title="Mão de Obra" | description="Montagem de estrutura, colocação de telhas, vedação de juntas e acabamentos." | pricingMode="fixed" fixedPrice="1800"
Block 4: title="" | description="Todos os preços incluem transporte de materiais e limpeza do local após conclusão. Garantia de 5 anos sobre a instalação." | NO PRICE (text-only disclaimer block)

Example 2 — Painting quote (moderate detail):
Block 1: title="Pintura Interior" | description="Preparação de superfícies e aplicação de 2 demãos de tinta lavável." | pricingMode="sqm" quantity="120" unitPrice="8"
Block 2: title="Pintura de Tetos" | description="" | pricingMode="sqm" quantity="45" unitPrice="10"
Block 3: title="Preparação e Proteção" | description="Lixagem, betumagem de fissuras, proteção de pavimentos e mobiliário." | pricingMode="fixed" fixedPrice="250"
Block 4: title="" | description="Materiais incluídos. Cores à escolha do cliente." | NO PRICE

Example 3 — Simple plumbing quote (minimal detail):
Block 1: title="Substituição de Torneira" | pricingMode="fixed" fixedPrice="80"
Block 2: title="Reparação de Fuga" | pricingMode="hour" quantity="2" unitPrice="35"

KEY RULES:
- NEVER put everything in just one block. Even simple quotes should have at least 2-3 blocks.
- For "no price" blocks: set pricingMode="fixed" but leave fixedPrice empty.
- Use description-only blocks (empty title) for notes, disclaimers, warranty info, or conditions.
- Use title-only blocks (empty description) for simple line items.
- The DETAIL slider controls how many blocks and how much text you write.
- Break down costs! Instead of one "€4000" lump sum, split into materials + labor + other costs.

BEFORE CALLING fill_quote:
Always show the user a quick summary of what you understood: the services, quantities, pricing, and total. Ask them to confirm before filling. This prevents mistakes.

IMPORTANT:
- Always respond in the same language the user writes in
- Be concise in chat messages but rich in quote content
- If the user gives vague info, ask ONE focused follow-up question at a time
- When suggesting prices, briefly explain your reasoning

USER CONTEXT:
- Currency: ${settings?.currency || '€'}
- Tax country: ${settings?.taxCountry || 'uk'}
Use this context to give location-appropriate pricing suggestions.`;
}

const FILL_QUOTE_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
    type: 'function',
    function: {
        name: 'fill_quote',
        description: 'Fill the quote form with services, pricing, and details based on the conversation. Call this ONLY after the user confirms the summary.',
        parameters: {
            type: 'object',
            properties: {
                services: {
                    type: 'array',
                    description: 'List of services to include in the quote. Each block can have title+price, title+description+price, or description-only (for notes).',
                    items: {
                        type: 'object',
                        properties: {
                            title: {
                                type: 'string',
                                description: 'Service name. Leave empty for text-only note blocks.',
                            },
                            description: {
                                type: 'string',
                                description: 'Service description or a standalone note/disclaimer.',
                            },
                            pricingMode: {
                                type: 'string',
                                enum: ['sqm', 'hour', 'fixed'],
                                description: 'Pricing model. Use "fixed" with no price for text-only blocks.',
                            },
                            quantity: {
                                type: 'string',
                                description: 'Number of units (m² or hours). Leave empty for fixed pricing or text-only.',
                            },
                            unitPrice: {
                                type: 'string',
                                description: 'Price per unit (per m² or per hour). Leave empty for fixed pricing or text-only.',
                            },
                            fixedPrice: {
                                type: 'string',
                                description: 'Fixed total price. Leave empty for text-only note blocks.',
                            },
                        },
                        required: ['pricingMode'],
                    },
                },
                baseValue: {
                    type: 'string',
                    description: 'Total base value before tax (sum of all priced services)',
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
            settings?: {
                currency?: string;
                taxCountry?: string;
                sliderDetail?: number;
                sliderMarket?: number;
                sliderTone?: number;
            };
        };

        if (!messages || messages.length === 0) {
            return NextResponse.json({ error: 'No messages provided' }, { status: 400 });
        }

        const systemPrompt = buildSystemPrompt(settings);
        const openai = new OpenAI({ apiKey });

        // Dynamic model + token limit based on detail slider
        const detailValue = settings?.sliderDetail ?? 50;
        const model = detailValue < 33 ? 'gpt-4o-mini' : 'gpt-4o';
        const maxTokens = detailValue > 66 ? 4096 : detailValue < 33 ? 1024 : 2048;

        const completion = await openai.chat.completions.create({
            model,
            messages: [
                { role: 'system', content: systemPrompt },
                ...messages,
            ],
            tools: [FILL_QUOTE_TOOL],
            tool_choice: 'auto',
            max_tokens: maxTokens,
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
