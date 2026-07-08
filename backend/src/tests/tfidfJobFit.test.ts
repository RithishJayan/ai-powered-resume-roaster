import { describe, expect, it } from 'vitest';
import { computeResumeJobTfidfCosine } from '@/lib/roast/tfidfJobFit';

const LONG_JOB =
  'Seeking senior typescript engineer with react nodejs experience building scalable apis and postgres';

describe('computeResumeJobTfidfCosine', () => {
  it('returns null when job description is too short', () => {
    expect(computeResumeJobTfidfCosine('some resume text here with enough length for tokens', 'x'.repeat(49))).toBeNull();
  });

  it('returns null when job meets length but has no alphanumeric tokens', () => {
    expect(computeResumeJobTfidfCosine('python django rest apis shipping weekly', '@#$% '.repeat(30))).toBeNull();
  });

  it('returns cosine 1 and score 100 for identical substantive texts', () => {
    const text = `${LONG_JOB} kubernetes docker cicd observability`;
    const r = computeResumeJobTfidfCosine(text, text);
    expect(r).not.toBeNull();
    expect(r!.cosine).toBeCloseTo(1, 5);
    expect(r!.score).toBe(100);
  });

  it('returns low similarity for disjoint vocabularies', () => {
    const resume = 'python django celery redis postgresql graphql federation';
    const job =
      'zebra xylophone quasar vortex nebula quantum plasma fifty characters minimum for job text field';
    const r = computeResumeJobTfidfCosine(resume, job);
    expect(r).not.toBeNull();
    expect(r!.cosine).toBeLessThan(0.15);
    expect(r!.score).toBeLessThan(15);
  });

  it('returns higher similarity when resume overlaps job keywords', () => {
    const resume = 'Built typescript react dashboards and nodejs backends with postgres and kubernetes';
    const r = computeResumeJobTfidfCosine(resume, LONG_JOB);
    expect(r).not.toBeNull();
    expect(r!.cosine).toBeGreaterThan(0.2);
    expect(r!.score).toBeGreaterThanOrEqual(0);
    expect(r!.score).toBeLessThanOrEqual(100);
  });

  it('clamps score to 0-100', () => {
    const r = computeResumeJobTfidfCosine('typescript react kubernetes shipping', LONG_JOB);
    expect(r).not.toBeNull();
    expect(r!.score).toBeGreaterThanOrEqual(0);
    expect(r!.score).toBeLessThanOrEqual(100);
  });

  it('computes when job is exactly MIN length (50) with tokens', () => {
    const text50 = 'x'.repeat(50);
    expect(text50.length).toBe(50);
    const r = computeResumeJobTfidfCosine(text50, text50);
    expect(r).not.toBeNull();
    expect(r!.cosine).toBeCloseTo(1, 5);
    expect(r!.score).toBe(100);
  });

  it('returns null when resume tokenizes to empty (stopwords only)', () => {
    const resume = 'the a an on in to of is it we you for and or but was were be by '.repeat(4);
    const r = computeResumeJobTfidfCosine(resume, LONG_JOB);
    expect(r).toBeNull();
  });

  it('handles very long inputs without throwing', () => {
    const chunk = 'typescript react nodejs postgres ';
    const resume = chunk.repeat(2000);
    const job = chunk.repeat(200);
    const r = computeResumeJobTfidfCosine(resume, job);
    expect(r).not.toBeNull();
    expect(Number.isFinite(r!.cosine)).toBe(true);
    expect(r!.score).toBeGreaterThanOrEqual(0);
    expect(r!.score).toBeLessThanOrEqual(100);
  });
});
