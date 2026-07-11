import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/guards';
import {
  generateInsights,
  getInsights,
  isAiInsightsEnabled,
} from '@/lib/services/ai-insights-service';

/** GET — stored insights (or mock payload when none exist). */
export async function GET() {
  const guard = await requireUser();
  if (!guard.success) return guard.response;

  try {
    const insights = await getInsights(guard.session.user.id);
    return NextResponse.json({ insights, aiEnabled: isAiInsightsEnabled() });
  } catch (error) {
    console.error('Failed to fetch insights:', error);
    return NextResponse.json({ error: 'Failed to fetch insights.' }, { status: 500 });
  }
}

/** POST — generate fresh insights with Claude (requires the feature flag + key). */
export async function POST() {
  const guard = await requireUser();
  if (!guard.success) return guard.response;

  if (!isAiInsightsEnabled()) {
    return NextResponse.json(
      {
        error:
          'AI insights are not enabled. Set ENABLE_AI_INSIGHTS=true and ANTHROPIC_API_KEY in your .env — see SETUP.md.',
        code: 'AI_NOT_CONFIGURED',
      },
      { status: 503 }
    );
  }

  try {
    const insights = await generateInsights(guard.session.user.id);
    return NextResponse.json({ insights });
  } catch (error) {
    console.error('Failed to generate insights:', error);
    return NextResponse.json({ error: 'Failed to generate insights.' }, { status: 500 });
  }
}
