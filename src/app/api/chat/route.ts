import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@/lib/supabase-server';

/* ── System Prompt Builder ── */
function buildSystemPrompt(settings?: {
    currency?: string;
    taxCountry?: string;
    sliderDetail?: number;
    sliderMarket?: number;
    sliderTone?: number;
}) {
    const detailLevel = (settings?.sliderDetail ?? 50) > 66 ? 'detailed' : (settings?.sliderDetail ?? 50) < 33 ? 'minimal' : 'moderate';
    const marketLevel = (settings?.sliderMarket ?? 50) > 66 ? 'premium/high-end' : (settings?.sliderMarket ?? 50) < 33 ? 'budget/economical' : 'mid-range';
    const toneLevel = (settings?.sliderTone ?? 50) > 66 ? 'formal and professional' : (settings?.sliderTone ?? 50) < 33 ? 'casual and friendly' : 'balanced professional';

    return `You are an expert quoting assistant for service businesses (construction, painting, cleaning, plumbing, electrical work, landscaping, renovation, etc.).

YOUR ROLE:
- Help users build professional quotes FAST — you are a pro who knows the trade
- When the user describes a job, IMMEDIATELY generate a quote using reasonable assumptions
- NEVER ask multiple questions before providing a quote
- Be conversational and natural, like a knowledgeable colleague who ACTS first

🚫 CRITICAL BEHAVIOR RULE — DO NOT ASK UNNECESSARY QUESTIONS:
When the user gives you enough info to understand the job (service type + approximate scope), you MUST:
1. Assume standard/common materials and methods for their region
2. Call fill_quote IMMEDIATELY with a complete quote
3. In your chat message, briefly explain what you assumed
4. AFTER the quote, offer to customize: "Se quiser algo mais específico (tipo de telha, acabamento, etc.) é só dizer que ajusto o orçamento."

❌ NEVER DO THIS:
User: "Preciso de um orçamento para um telhado de 100m² de 2 águas em Aveiro com estrutura de madeira"
Bot: "Para elaborar um orçamento preciso, preciso saber:
1. Tem preferência por algum tipo de telha?
2. Há alguma consideração especial para isolamento?
3. Precisa de calhas?"

✅ DO THIS INSTEAD:
User: "Preciso de um orçamento para um telhado de 100m² de 2 águas em Aveiro com estrutura de madeira"
Bot: [IMMEDIATELY calls fill_quote with a complete quote using standard materials]
"Montei um orçamento completo para o telhado de 2 águas em Aveiro. Considerei telha cerâmica tipo Lusa (~12/m²), vigas de pinho tratado, membrana impermeabilizante e caleiras em PVC incluídas.

Materiais: telha Lusa a ~€1.20/un × 1.200 telhas = ~€1.440, madeira estrutural ~€1.800, membrana+acessórios ~€600.
Mão de obra: ~€2.500 para montagem completa.

Se preferir outro tipo de telha (Marselha, canudo), madeira diferente, ou quiser adicionar isolamento térmico, é só dizer que ajusto!"

The KEY insight: The user is a tradesman who KNOWS what they want. They gave you the job description — now QUOTE IT. You can always refine later. A bad quote that's immediate is better than no quote after 5 questions.

WHEN TO ASK (rare cases):
- Only ask if the information is truly IMPOSSIBLE to assume (e.g., the user just says "quero um orçamento" with zero context)
- If you must ask, ask ONE question maximum, and still try to provide a partial quote

PRICING GUIDELINES:
- Always consider the user's country/region when suggesting prices
- Use your knowledge of typical market rates for common services
- When unsure, give a reasonable range and explain your reasoning
- Factor in complexity, materials, labor, and regional cost of living
- If the user mentions a specific city or country, adjust pricing accordingly

DOMAIN EXPERTISE — USE THIS:
When the user describes a job, demonstrate expert knowledge:
- Name SPECIFIC materials (e.g., "telha Marselha", "tinta Robbialac Satin", "tubo PPR PN20")
- Reference typical quantities (e.g., "A laje de betão precisa de ~12 telhas/m²")
- Explain cost reasoning in your CHAT message (e.g., "120 tiles × €1.20 = €144 for materials")
- Suggest brand alternatives when relevant
- Mention standard practices, building codes, and typical warranties

⚠️ CRITICAL — CHAT vs QUOTE SEPARATION:
Your CHAT messages can and should contain detailed cost breakdowns, calculations, material reasoning, and explanations.
BUT the service block DESCRIPTIONS in fill_quote must be CLEAN and PROFESSIONAL — NO calculations, NO "120 × €1.20 = €144", NO reasoning. Only professional descriptions suitable for a client-facing PDF document.
Think of it this way: chat = talking to the tradesman, quote = what the client sees.

USER PREFERENCES:
- Detail level: ${detailLevel}
- Market positioning: ${marketLevel} — ${marketLevel === 'premium/high-end' ? 'Suggest prices at the higher end of market rates. Use professional, quality-focused language. Emphasize materials and craftsmanship.' : marketLevel === 'budget/economical' ? 'Suggest prices at the lower end of market rates. Emphasize value and affordability.' : 'Suggest mid-range market prices. Balance quality and value.'}
- Tone: ${toneLevel}

${detailLevel === 'detailed' ? `DETAIL LEVEL: MAXIMUM — THIS IS CRITICAL, READ CAREFULLY:
The user has the detail slider set to MAXIMUM. You MUST create extensive, rich, professional content:

CHAT MESSAGE requirements (detailed mode):
- Write a LONG, comprehensive response (minimum 300-500 words)
- Break down EVERY cost component with calculations
- Name specific materials with brands, specs, and quantities
- Explain pricing reasoning for each major category
- Compare alternatives when relevant ("Telha Lusa a €1.20 vs Marselha a €1.50")
- Mention industry standards, building codes, warranty terms
- This should read like a knowledgeable expert explaining the full scope

QUOTE (fill_quote) requirements (detailed mode):
- Use 8-15 service blocks MINIMUM
- Structure like a professional multi-section document
- Include section headers (title-only blocks), material blocks, labor blocks, sub-categories
- Each description should be 2-4 sentences, specific and professional
- Add disclaimer/conditions blocks at the end
- Include: warranty info, payment terms, estimated timeline, what is included/excluded
- Think of it as a DOCUMENT, not a list

Example structure for a detailed roof quote:
Block 1: Section header "Cobertura - Telhado de 2 Águas" (no price)
Block 2: "Estrutura de Madeira" with full scope description | price
Block 3: "Vigas e Barrotes" with specs (pinho tratado, secção 8x16cm) | price
Block 4: "Ripado e Contra-ripado" | price
Block 5: "Telhas Cerâmicas" with type, quantity per m² | price per sqm
Block 6: "Cumeeiras e Remates" | price
Block 7: "Impermeabilização" with membrane type | price
Block 8: "Caleiras e Tubos de Queda" with material (PVC/Zinco) | price
Block 9: "Mão de Obra - Carpintaria" | price
Block 10: "Mão de Obra - Telhamento" | price
Block 11: "Andaimes e Equipamento" | price
Block 12: "Transporte de Materiais" | price
Block 13: "Limpeza Final de Obra" | price
Block 14: Conditions block (warranty, excluded items, timeline)
` : detailLevel === 'minimal' ? `DETAIL LEVEL: MINIMAL
- Keep it very short — 2-4 blocks maximum
- Just titles and prices, skip descriptions
- Chat message: brief, 2-3 sentences
` : `DETAIL LEVEL: MODERATE
- Use 4-7 service blocks
- Descriptions where helpful, skip where obvious
- Chat message: informative but concise (100-200 words)
`}

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

🔄 ROLLING QUOTE — CALL fill_quote PROACTIVELY:
- Call fill_quote on EVERY response where you have enough information to build even a partial quote.
- Do NOT wait for the user to confirm or ask permission.
- Each time you call fill_quote, include ALL services (the complete quote so far), not just new ones.
- As the conversation continues and you learn more, call fill_quote again with updated information.
- The user will click "Apply" when they are ready — you just keep the data fresh.
- On the FIRST message: if the user gives enough context (service type, area, location), call fill_quote immediately along with your response.

APPEND MODE:
- When building a quote from scratch or replacing all services, use mode="replace".
- When the user explicitly asks to ADD more services to an existing quote (e.g., "add 3 more items", "also include X"), use mode="append".
- Default to "replace" unless the context clearly indicates adding to existing work.

IMPORTANT:
- Always respond in the same language the user writes in
- Use plain text in your responses (no markdown bold ** or headers #). Write naturally.
- Be concise in chat messages but rich in quote content
- NEVER ask more than ONE question per response, and only if truly essential
- When suggesting prices, briefly explain your reasoning in the chat message


USER CONTEXT:
- Currency: ${settings?.currency || '€'}
- Tax country: ${settings?.taxCountry || 'uk'}
Use this context to give location-appropriate pricing suggestions.`;
}

/* ── Fill Quote Tool Definition ── */
const FILL_QUOTE_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
    type: 'function',
    function: {
        name: 'fill_quote',
        description: 'Fill the quote form with services, pricing, and details. Call this as soon as you have enough information to build a reasonable quote. Keep calling it with updated data as the conversation progresses.',
        parameters: {
            type: 'object',
            properties: {
                mode: {
                    type: 'string',
                    enum: ['replace', 'append'],
                    description: 'Use "replace" for a new/full quote (default). Use "append" when the user asks to ADD more services to an existing quote.',
                },
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
                                description: 'Professional description for the client PDF. Keep it clean — no calculation details, no reasoning. Just professional scope text.',
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
                    description: 'Estimated time to complete the work. ALWAYS include the label prefix in the user\'s language, e.g. "Tempo estimado: 5-7 dias úteis" or "Estimated time: 5-7 working days".',
                },
                expirationDate: {
                    type: 'string',
                    description: 'Quote validity period. ALWAYS include the label prefix in the user\'s language, e.g. "Validade: 30 dias após emissão" or "Valid for: 30 days from issue".',
                },
                paymentConditions: {
                    type: 'string',
                    description: 'Payment terms. ALWAYS include the label prefix in the user\'s language, e.g. "Condições de pagamento: 50% adiantado, 50% na conclusão" or "Payment terms: 50% upfront, 50% on completion".',
                },
            },
            required: ['services', 'baseValue'],
        },
    },
};

/* ── Plan-based model configuration ── */
// Cost thresholds in USD (approximate) — Starter gets €3 worth of GPT-4o per month
// GPT-4o: ~$2.50/1M input + $10/1M output → avg ~$6/1M blended tokens
// €3 ≈ $3.30 → ~550K tokens at blended rate
const STARTER_4O_TOKEN_LIMIT = 550_000;

interface PlanConfig {
    model: string;
    maxTokens: number;
    monthlyBudgetTokens: number;
    fallbackModel?: string;
}

const PLAN_CONFIGS: Record<string, PlanConfig> = {
    starter: {
        model: 'gpt-4o',
        maxTokens: 2048,
        monthlyBudgetTokens: STARTER_4O_TOKEN_LIMIT,
        fallbackModel: 'gpt-4o-mini',
    },
    pro: {
        model: 'gpt-4o',
        maxTokens: 4096,
        monthlyBudgetTokens: Infinity,
    },
    enterprise: {
        model: 'gpt-4o',
        maxTokens: 8192,
        monthlyBudgetTokens: Infinity,
    },
};

const DEFAULT_CONFIG: PlanConfig = {
    model: 'gpt-4o-mini',
    maxTokens: 2048,
    monthlyBudgetTokens: Infinity,
};

/* ── POST Handler ── */
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

        // ── Look up user's subscription plan ──
        let planConfig = DEFAULT_CONFIG;
        let subscriptionId: string | null = null;
        let currentTokensUsed = 0;

        try {
            const { data: sub } = await supabase
                .from('subscriptions')
                .select('id, plan, ai_tokens_used, ai_tokens_reset_at')
                .eq('user_id', user.id)
                .in('status', ['active', 'trial'])
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (sub) {
                subscriptionId = sub.id;
                const config = PLAN_CONFIGS[sub.plan as string];
                if (config) {
                    planConfig = { ...config };
                }

                // Check if we need to reset the monthly counter
                const now = new Date();
                const resetAt = sub.ai_tokens_reset_at ? new Date(sub.ai_tokens_reset_at) : null;
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

                if (!resetAt || resetAt < startOfMonth) {
                    // Reset counter for new month
                    await supabase
                        .from('subscriptions')
                        .update({ ai_tokens_used: 0, ai_tokens_reset_at: now.toISOString() })
                        .eq('id', sub.id);
                    currentTokensUsed = 0;
                } else {
                    currentTokensUsed = sub.ai_tokens_used || 0;
                }

                // For Starter plan: check if they've exceeded their GPT-4o budget
                if (sub.plan === 'starter' && planConfig.fallbackModel) {
                    if (currentTokensUsed >= planConfig.monthlyBudgetTokens) {
                        planConfig.model = planConfig.fallbackModel;
                    }
                }
            }
        } catch (err) {
            // If subscription lookup fails, continue with default config
            console.error('Subscription lookup error:', err);
        }

        const systemPrompt = buildSystemPrompt(settings);
        const openai = new OpenAI({ apiKey });

        // Adjust maxTokens based on detail slider (override plan defaults if slider demands more)
        const detailValue = settings?.sliderDetail ?? 50;
        let effectiveMaxTokens = planConfig.maxTokens;
        if (detailValue > 66) {
            effectiveMaxTokens = Math.max(effectiveMaxTokens, 8192);
        } else if (detailValue < 33) {
            effectiveMaxTokens = Math.min(effectiveMaxTokens, 1500);
        }

        const completion = await openai.chat.completions.create({
            model: planConfig.model,
            messages: [
                { role: 'system', content: systemPrompt },
                ...messages,
            ],
            tools: [FILL_QUOTE_TOOL],
            tool_choice: 'auto',
            max_tokens: effectiveMaxTokens,
            temperature: 0.7,
        });

        const choice = completion.choices[0];
        const assistantMessage = choice.message;

        // Check if the AI called the fill_quote function
        let quoteData = null;
        let responseText = assistantMessage.content || '';
        let totalTokensUsed = completion.usage?.total_tokens || 0;

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

                // If the model returned no text alongside the tool call, 
                // send the tool result back to get a proper text explanation
                if (!responseText && quoteData) {
                    try {
                        const followUp = await openai.chat.completions.create({
                            model: planConfig.model,
                            messages: [
                                { role: 'system', content: systemPrompt },
                                ...messages,
                                // The assistant's response with the tool call
                                {
                                    role: 'assistant',
                                    content: null,
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    tool_calls: assistantMessage.tool_calls.map((tc: any) => ({
                                        id: tc.id,
                                        type: 'function' as const,
                                        function: { name: tc.function.name, arguments: tc.function.arguments },
                                    })),
                                },
                                // The tool result confirming success
                                {
                                    role: 'tool',
                                    tool_call_id: fillCall.id,
                                    content: JSON.stringify({
                                        success: true,
                                        message: 'Quote data accepted and saved. Now write your FULL chat response to the user. This MUST include: detailed cost breakdown with calculations, material specifications, what you assumed, and offer to customize. Write a LONG, comprehensive response. Use plain text only, no markdown.',
                                    }),
                                },
                            ],
                            max_tokens: effectiveMaxTokens,
                            temperature: 0.7,
                        });

                        responseText = followUp.choices[0]?.message?.content || '';
                        totalTokensUsed += followUp.usage?.total_tokens || 0;
                    } catch (err) {
                        console.error('Follow-up API call failed:', err);
                        // Fallback: construct a basic message from the quote data
                        const serviceCount = quoteData.services?.length || 0;
                        responseText = `Preparei um orçamento com ${serviceCount} itens. O botão "Preencher Orçamento" já está disponível para aplicar os dados.`;
                    }
                }
            }
        }

        // ── Track token usage (both calls combined) ──
        if (subscriptionId && totalTokensUsed > 0) {
            try {
                await supabase
                    .from('subscriptions')
                    .update({
                        ai_tokens_used: currentTokensUsed + totalTokensUsed,
                    })
                    .eq('id', subscriptionId);
            } catch (err) {
                console.error('Failed to update token usage:', err);
            }
        }

        return NextResponse.json({
            message: responseText,
            quoteData,
        });
    } catch (err) {
        console.error('Chat API error:', err);
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: 'Chat failed', message }, { status: 500 });
    }
}
