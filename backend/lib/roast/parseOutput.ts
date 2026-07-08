export type ParsedRoast = {
  displayRoast: string;
  displayLevel: string;
  score: number | null;
  breakdown: { name: string; score: number }[];
  aiAssessment: { score: number; label: string; signs: string[] } | null;
};

export function parseRoastModelOutput(raw: string, fallbackLevelLabel: string): ParsedRoast {
  let roast = raw.trim();
  const levelMatch = roast.match(/^\[Level:\s*(\w+)\]\s*\n?/i);
  const displayLevel = levelMatch ? levelMatch[1] : fallbackLevelLabel;
  if (levelMatch) roast = roast.replace(levelMatch[0], '').trim();

  let score: number | null = null;
  let breakdown: { name: string; score: number }[] = [];
  const scoresBlock = roast.match(/\[RESUME_SCORES\]\s*([\s\S]*?)\s*\[\/RESUME_SCORES\]/i);
  const scoresRaw = scoresBlock ? scoresBlock[1].trim() : '';
  if (scoresBlock) roast = roast.replace(scoresBlock[0], '').trim();

  const aiBlock = roast.match(/\[AI_ASSESSMENT\]\s*([\s\S]*?)\s*\[\/AI_ASSESSMENT\]/i);
  let aiAssessment: ParsedRoast['aiAssessment'] = null;
  if (aiBlock) {
    roast = roast.replace(aiBlock[0], '').trim();
    try {
      const parsed = JSON.parse(aiBlock[1].trim()) as { score?: number; label?: string; signs?: string[] };
      if (typeof parsed.score === 'number' && typeof parsed.label === 'string') {
        aiAssessment = {
          score: Math.min(100, Math.max(0, Math.round(parsed.score))),
          label: parsed.label.slice(0, 80),
          signs: Array.isArray(parsed.signs)
            ? parsed.signs.filter((s): s is string => typeof s === 'string').slice(0, 6)
            : [],
        };
      }
    } catch {
      // ignore
    }
  }

  if (scoresRaw) {
    try {
      const parsed = JSON.parse(scoresRaw) as { overall?: number; breakdown?: { name: string; score: number }[] };
      if (typeof parsed.overall === 'number') {
        score = Math.min(100, Math.max(0, Math.round(parsed.overall)));
      }
      if (Array.isArray(parsed.breakdown)) {
        breakdown = parsed.breakdown
          .filter((b): b is { name: string; score: number } => b && typeof b.name === 'string' && typeof b.score === 'number')
          .map((b) => ({ name: b.name, score: Math.min(100, Math.max(0, Math.round(b.score))) }))
          .slice(0, 8);
      }
    } catch {
      // ignore
    }
  }

  return {
    displayRoast: roast,
    displayLevel,
    score,
    breakdown,
    aiAssessment,
  };
}
