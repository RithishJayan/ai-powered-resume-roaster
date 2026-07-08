import { describe, expect, it } from 'vitest';
import { parseRoastModelOutput } from '@/lib/roast/parseOutput';

describe('parseRoastModelOutput', () => {
  it('strips leading [Level: …] and uses fallback when missing', () => {
    const raw = `[Level: Spicy]\n\nFirst line of roast.`;
    const p = parseRoastModelOutput(raw, 'medium');
    expect(p.displayLevel).toBe('Spicy');
    expect(p.displayRoast).toBe('First line of roast.');
  });

  it('uses fallback level label when no level tag', () => {
    const p = parseRoastModelOutput('No level here.', 'savage');
    expect(p.displayLevel).toBe('savage');
    expect(p.displayRoast).toBe('No level here.');
  });

  it('parses [RESUME_SCORES] JSON and removes block from display roast', () => {
    const raw = `Intro\n[RESUME_SCORES]\n{"overall": 81, "breakdown": [{"name": "Clarity", "score": 90}]}\n[/RESUME_SCORES]\nTail`;
    const p = parseRoastModelOutput(raw, 'medium');
    expect(p.score).toBe(81);
    expect(p.breakdown).toEqual([{ name: 'Clarity', score: 90 }]);
    expect(p.displayRoast).toBe('Intro\n\nTail');
  });

  it('parses [AI_ASSESSMENT] JSON and clamps score', () => {
    const raw = `Body\n[AI_ASSESSMENT]\n{"score": 999, "label": "Too long label that should be truncated for display purposes", "signs": ["a", "b", "c", "d", "e", "f", "g"]}\n[/AI_ASSESSMENT]`;
    const p = parseRoastModelOutput(raw, 'medium');
    expect(p.aiAssessment?.score).toBe(100);
    expect(p.aiAssessment?.label.length).toBeLessThanOrEqual(80);
    expect(p.aiAssessment?.signs.length).toBeLessThanOrEqual(6);
    expect(p.displayRoast).toBe('Body');
  });

  it('ignores malformed JSON in score and AI blocks', () => {
    const raw = `[RESUME_SCORES]\nnot json\n[/RESUME_SCORES]\n[AI_ASSESSMENT]\n{broken\n[/AI_ASSESSMENT]\nStill here`;
    const p = parseRoastModelOutput(raw, 'mild');
    expect(p.score).toBeNull();
    expect(p.breakdown).toEqual([]);
    expect(p.aiAssessment).toBeNull();
    expect(p.displayRoast).toBe('Still here');
  });
});
