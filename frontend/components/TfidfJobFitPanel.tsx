'use client';

import type { TfidfJobFitClient } from '@/lib/parseRoastTfidf';

const PANEL_TITLE =
  'Cosine similarity of TF-IDF vectors over resume vs job text. High values mean more overlapping words, not necessarily a better resume.';

type Props = { tfidfJobFit: TfidfJobFitClient };

export function TfidfJobFitPanel({ tfidfJobFit }: Props) {
  return (
    <div className="tfidf-job-fit" title={PANEL_TITLE}>
      <p className="score-breakdown-title">Lexical job fit (TF-IDF)</p>
      <div className="tfidf-job-fit-row">
        <span className="tfidf-job-fit-score">{tfidfJobFit.score}</span>
        <span className="tfidf-job-fit-max">/100</span>
        <span className="tfidf-job-fit-hint">word overlap vs your job description</span>
      </div>
    </div>
  );
}
