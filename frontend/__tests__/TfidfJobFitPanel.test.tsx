import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TfidfJobFitPanel } from '@/components/TfidfJobFitPanel';

describe('TfidfJobFitPanel', () => {
  it('renders title, score, and hint', () => {
    render(<TfidfJobFitPanel tfidfJobFit={{ score: 63, cosine: 0.63 }} />);

    expect(screen.getByText(/Lexical job fit \(TF-IDF\)/i)).toBeInTheDocument();
    expect(screen.getByText('63')).toBeInTheDocument();
    expect(screen.getByText('/100')).toBeInTheDocument();
    expect(screen.getByText(/word overlap vs your job description/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Cosine similarity of TF-IDF vectors/i)).toBeInTheDocument();
  });
});
