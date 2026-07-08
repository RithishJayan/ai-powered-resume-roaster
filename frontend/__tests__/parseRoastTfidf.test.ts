import { describe, expect, it } from 'vitest';
import { parseTfidfJobFitFromRoastResponse } from '@/lib/parseRoastTfidf';

describe('parseTfidfJobFitFromRoastResponse', () => {
  it('returns null for non-object', () => {
    expect(parseTfidfJobFitFromRoastResponse(null)).toBeNull();
    expect(parseTfidfJobFitFromRoastResponse(undefined)).toBeNull();
    expect(parseTfidfJobFitFromRoastResponse('x')).toBeNull();
  });

  it('returns null when tfidfJobFit is missing', () => {
    expect(parseTfidfJobFitFromRoastResponse({ roast: 'hi' })).toBeNull();
  });

  it('returns null when tfidfJobFit is partial or wrong types', () => {
    expect(parseTfidfJobFitFromRoastResponse({ tfidfJobFit: { score: 50 } })).toBeNull();
    expect(parseTfidfJobFitFromRoastResponse({ tfidfJobFit: { cosine: 0.5 } })).toBeNull();
    expect(parseTfidfJobFitFromRoastResponse({ tfidfJobFit: { score: '50', cosine: 0.5 } })).toBeNull();
    expect(parseTfidfJobFitFromRoastResponse({ tfidfJobFit: { score: 50, cosine: '0.5' } })).toBeNull();
  });

  it('returns parsed object when valid', () => {
    expect(
      parseTfidfJobFitFromRoastResponse({
        roast: 'x',
        tfidfJobFit: { score: 72, cosine: 0.72 },
      })
    ).toEqual({ score: 72, cosine: 0.72 });
  });
});
