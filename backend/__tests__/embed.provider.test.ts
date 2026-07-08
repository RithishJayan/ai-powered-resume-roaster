import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveEmbeddingProvider } from '@/lib/rag/embed';

describe('resolveEmbeddingProvider', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns nomic when EMBEDDING_PROVIDER=nomic and NOMIC_API_KEY set', () => {
    vi.stubEnv('EMBEDDING_PROVIDER', 'nomic');
    vi.stubEnv('NOMIC_API_KEY', 'nk');
    expect(resolveEmbeddingProvider()).toBe('nomic');
  });

  it('returns null when EMBEDDING_PROVIDER=nomic but key missing', () => {
    vi.stubEnv('EMBEDDING_PROVIDER', 'nomic');
    vi.stubEnv('NOMIC_API_KEY', '');
    expect(resolveEmbeddingProvider()).toBeNull();
  });

  it('auto-selects nomic when NOMIC_API_KEY set and provider unset', () => {
    vi.stubEnv('NOMIC_API_KEY', 'nk');
    expect(resolveEmbeddingProvider()).toBe('nomic');
  });

  it('returns openai when EMBEDDING_PROVIDER=openai and OPENAI_API_KEY set', () => {
    vi.stubEnv('EMBEDDING_PROVIDER', 'openai');
    vi.stubEnv('OPENAI_API_KEY', 'sk');
    expect(resolveEmbeddingProvider()).toBe('openai');
  });

  it('accepts EMBEDDING_API_KEY for explicit openai', () => {
    vi.stubEnv('EMBEDDING_PROVIDER', 'openai');
    vi.stubEnv('EMBEDDING_API_KEY', 'sk-alt');
    expect(resolveEmbeddingProvider()).toBe('openai');
  });

  it('returns null when no provider keys are present', () => {
    expect(resolveEmbeddingProvider()).toBeNull();
  });

  it('maps groq legacy to nomic when NOMIC_API_KEY present', () => {
    vi.stubEnv('EMBEDDING_PROVIDER', 'groq');
    vi.stubEnv('NOMIC_API_KEY', 'nk');
    expect(resolveEmbeddingProvider()).toBe('nomic');
  });

  it('maps groq legacy to openai when only OpenAI keys present', () => {
    vi.stubEnv('EMBEDDING_PROVIDER', 'groq');
    vi.stubEnv('OPENAI_API_KEY', 'sk');
    expect(resolveEmbeddingProvider()).toBe('openai');
  });
});
