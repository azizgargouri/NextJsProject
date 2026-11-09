import { NextRequest, NextResponse } from 'next/server';
import { errorResponse, requireAuth } from '@/server/shared/auth/guards';

const CHALLENGE_WORDS = ['Tunis', 'Sfax', 'Bizerte', 'Sousse', 'Nabeul', 'Kairouan'] as const;

const RANDOM_WORDS = [
  'mover',
  'job',
  'checkin',
  'today',
  'onsite',
  'ready',
  'morning',
  'team',
  'hub',
  'north',
  'south',
  'shift',
  'voice',
  'recorded',
  'verified',
  'location',
  'confirmed',
  'started',
  'window',
  'crew',
  'route',
  'station',
  'local',
  'briefing',
  'standby',
  'handover',
  'site',
  'update',
  'status',
  'log',
] as const;

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

/**
 * GET /api/voice/challenge — server-generated spoken challenge.
 *
 * The client never invents the phrase: it displays this sentence and the
 * employee must say it. The Kaggle verifier checks the transcript contains
 * `challenge`; a wrong word yields `wrong_challenge` → stored → RH alerts.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await requireAuth(request);

    const challenge = pick(CHALLENGE_WORDS);
    const others: string[] = [];
    while (others.length < 2) {
      const word = pick(RANDOM_WORDS);
      if (word.toLowerCase() !== challenge.toLowerCase() && !others.includes(word)) {
        others.push(word);
      }
    }

    const words = [challenge.toLowerCase(), ...others];
    // Shuffle so the challenge position is unpredictable.
    for (let i = words.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [words[i], words[j]] = [words[j]!, words[i]!];
    }
    const sentence = words.join(' ');

    return NextResponse.json({ challenge, sentence });
  } catch (error) {
    return errorResponse(error);
  }
}
