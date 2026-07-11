/**
 * AI Insights (Claude)
 *
 * Generates spending insights from the user's recent transactions, budgets,
 * and recurring charges using the Anthropic API. Feature-flagged: when
 * ENABLE_AI_INSIGHTS is off (or no ANTHROPIC_API_KEY is set), callers receive
 * curated mock insights so the dashboard widget is always populated — the
 * demo works with zero external keys.
 */

import Anthropic from '@anthropic-ai/sdk';
import { InsightType, Impact, Prisma } from '@prisma/client';

import { prisma } from '@/lib/db/prisma';
import { getRecurringCharges, monthlyCost } from './recurring-detection-service';

export interface InsightPayload {
  type: InsightType;
  title: string;
  description: string;
  impact: Impact;
  category: string;
  actionable: boolean;
}

const INSIGHT_TYPES = ['OPPORTUNITY', 'WARNING', 'TREND', 'TIP'] as const;
const IMPACTS = ['LOW', 'MEDIUM', 'HIGH'] as const;

// Shown when AI insights are disabled — keeps the widget populated in demo mode
export const MOCK_INSIGHTS: InsightPayload[] = [
  {
    type: 'TIP',
    title: 'Enable AI insights',
    description:
      'Set ENABLE_AI_INSIGHTS=true and add an ANTHROPIC_API_KEY to generate personalized spending insights with Claude. These are sample insights.',
    impact: 'LOW',
    category: 'General',
    actionable: true,
  },
  {
    type: 'TREND',
    title: 'Dining spend is trending up',
    description:
      'Restaurant and coffee purchases have grown three months in a row. Setting a monthly dining budget could save around $120/month.',
    impact: 'MEDIUM',
    category: 'Food & Dining',
    actionable: true,
  },
  {
    type: 'OPPORTUNITY',
    title: 'Review overlapping subscriptions',
    description:
      'You pay for multiple streaming services with similar content. Cancelling one could save up to $180/year.',
    impact: 'MEDIUM',
    category: 'Personal & Family',
    actionable: true,
  },
];

export function isAiInsightsEnabled(): boolean {
  return (
    process.env.ENABLE_AI_INSIGHTS === 'true' &&
    Boolean(process.env.ANTHROPIC_API_KEY)
  );
}

// Lazy client init — avoids constructing (and validating) the client during
// build-time page collection when the key may be absent.
let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic();
  }
  return _client;
}

const INSIGHTS_SCHEMA = {
  type: 'object',
  properties: {
    insights: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: [...INSIGHT_TYPES] },
          title: { type: 'string' },
          description: { type: 'string' },
          impact: { type: 'string', enum: [...IMPACTS] },
          category: { type: 'string' },
          actionable: { type: 'boolean' },
        },
        required: ['type', 'title', 'description', 'impact', 'category', 'actionable'],
        additionalProperties: false,
      },
    },
  },
  required: ['insights'],
  additionalProperties: false,
} as const;

/** Build the financial summary Claude analyzes. */
async function buildSpendingSummary(userId: string): Promise<string> {
  const since = new Date();
  since.setMonth(since.getMonth() - 3);

  const [byCategory, budgets, recurring] = await Promise.all([
    prisma.transaction.groupBy({
      by: ['category'],
      where: { userId, type: 'EXPENSE', date: { gte: since } },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.budget.findMany({
      where: { userId, isActive: true },
      select: { name: true, category: true, amount: true, spent: true, period: true },
    }),
    getRecurringCharges(userId),
  ]);

  const categoryLines = byCategory
    .map(
      (c) =>
        `- ${c.category}: $${Math.abs(Number(c._sum.amount ?? 0)).toFixed(2)} across ${c._count} transactions`
    )
    .join('\n');

  const budgetLines = budgets
    .map(
      (b) =>
        `- ${b.name} (${b.category}, ${b.period}): $${Number(b.spent).toFixed(2)} spent of $${Number(b.amount).toFixed(2)}`
    )
    .join('\n');

  const recurringLines = recurring
    .slice(0, 12)
    .map(
      (r) =>
        `- ${r.merchant}: ~$${r.averageAmount.toFixed(2)} ${r.cadence} (≈$${monthlyCost(r).toFixed(2)}/month)`
    )
    .join('\n');

  return [
    'Spending by category (last 3 months, amounts are money out):',
    categoryLines || '(no expense transactions)',
    '',
    'Active budgets:',
    budgetLines || '(no budgets set)',
    '',
    'Detected recurring charges:',
    recurringLines || '(none detected)',
  ].join('\n');
}

/**
 * Generate insights with Claude and persist them as AIInsight rows.
 * Returns the generated payloads. Throws on API failure — callers decide
 * whether to surface the error or fall back to existing insights.
 */
export async function generateInsights(userId: string): Promise<InsightPayload[]> {
  const summary = await buildSpendingSummary(userId);
  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';

  const response = await getClient().messages.create({
    model,
    max_tokens: 2048,
    system:
      'You are a personal-finance analyst for a credit card management app. ' +
      'Given a spending summary, produce 3-5 concise, specific, genuinely useful insights. ' +
      'Reference actual numbers from the data. Expenses are negative amounts; budgets show spent vs limit. ' +
      'Avoid generic advice — every insight must be grounded in the provided data.',
    messages: [{ role: 'user', content: summary }],
    output_config: {
      format: { type: 'json_schema', schema: INSIGHTS_SCHEMA },
    },
  });

  // Defensive parse: structured outputs guarantee schema-valid JSON, but the
  // response can still be a refusal or hit max_tokens.
  if (response.stop_reason === 'refusal') {
    throw new Error('AI insights request was declined.');
  }

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('AI insights response contained no text.');
  }

  let parsed: { insights?: InsightPayload[] };
  try {
    parsed = JSON.parse(textBlock.text);
  } catch {
    throw new Error('AI insights response was not valid JSON.');
  }

  const insights = (parsed.insights ?? []).filter(
    (i): i is InsightPayload =>
      INSIGHT_TYPES.includes(i.type as (typeof INSIGHT_TYPES)[number]) &&
      IMPACTS.includes(i.impact as (typeof IMPACTS)[number]) &&
      typeof i.title === 'string' &&
      typeof i.description === 'string'
  );

  if (insights.length > 0) {
    // Replace unread insights with the fresh batch
    await prisma.$transaction([
      prisma.aIInsight.deleteMany({ where: { userId, isRead: false } }),
      prisma.aIInsight.createMany({
        data: insights.map((i) => ({
          userId,
          type: i.type,
          title: i.title,
          description: i.description,
          impact: i.impact,
          category: i.category,
          actionable: i.actionable,
          source: 'spending',
        })) satisfies Prisma.AIInsightCreateManyInput[],
      }),
    ]);
  }

  return insights;
}

/**
 * Fetch insights for display. Returns stored insights when present;
 * otherwise mock insights (so the widget is never empty).
 */
export async function getInsights(userId: string): Promise<InsightPayload[]> {
  const stored = await prisma.aIInsight.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  if (stored.length > 0) {
    return stored.map((i) => ({
      type: i.type,
      title: i.title,
      description: i.description,
      impact: i.impact,
      category: i.category,
      actionable: i.actionable,
    }));
  }

  return MOCK_INSIGHTS;
}
