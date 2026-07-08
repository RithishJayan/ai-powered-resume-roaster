import { describe, expect, it } from 'vitest';
import { toLexicalScoresPayload } from '@/lib/roast/tfidfJobFit';

describe('toLexicalScoresPayload', () => {
  it('returns null for null input', () => {
    expect(toLexicalScoresPayload(null)).toBeNull();
  });

  it('maps TF-IDF result to lexical_scores JSON shape', () => {
    expect(toLexicalScoresPayload({ cosine: 0.42, score: 42 })).toEqual({
      tfidfJobFit: { cosine: 0.42, score: 42 },
    });
  });
});
