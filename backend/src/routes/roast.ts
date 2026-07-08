import type { Context } from 'hono';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { getToken } from 'next-auth/jwt';
import {
  buildRagQueryText,
  buildRetrievedContextBlock,
  buildSystemPrompt,
  buildUserPrompt,
  ROAST_LEVEL_PARAMS,
  type RoastLevel,
  ROAST_LEVELS,
} from '@/lib/roast/prompts';
import { embedText } from '@/lib/rag/embed';
import { fetchFewShotChunksByKind, searchSimilarRagChunks } from '@/lib/rag/retrieve';
import { insertRoastLog } from '@/lib/roast/logging';
import { moderateRoastOutput, shouldBlockForCategories } from '@/lib/roast/moderation';
import { parseRoastModelOutput } from '@/lib/roast/parseOutput';
import { computeResumeJobTfidfCosine, toLexicalScoresPayload } from '@/lib/roast/tfidfJobFit';

const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const MAX_SIZE_MB = 5;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const data = await pdfParse(buffer);
  return data.text?.trim() || '';
}

async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value?.trim() || '';
}

const GROQ_BASE = 'https://api.groq.com/openai/v1';
const GROQ_MODELS = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'openai/gpt-oss-120b', 'openai/gpt-oss-20b'];
const OPENAI_MODELS = ['gpt-4o', 'gpt-4o-mini'];
const DEFAULT_CLAUDE_MODEL = 'claude-sonnet-4-5-20250929';

const SAFETY_RETRY_ADDENDUM = `\n\nIMPORTANT: Your previous draft may have contained unsafe phrasing. Rewrite the roast: keep wit on the resume text only; no identity-based digs; no slurs; no harassment of the person.`;

type Provider = 'groq' | 'openai' | 'anthropic' | 'custom';

async function getUserIdFromRequest(c: Context): Promise<string | null> {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) return null;
  const token = await getToken({ req: c.req.raw as never, secret });
  if (!token) return null;
  return (token.id as string | undefined) ?? (token.sub as string | undefined) ?? null;
}

async function generateRawRoast(params: {
  provider: Provider;
  selectedModel: string;
  apiKey: string;
  systemPrompt: string;
  userPrompt: string;
  level: RoastLevel;
}): Promise<string> {
  const { temperature, maxTokens } = ROAST_LEVEL_PARAMS[params.level];

  if (params.provider === 'anthropic') {
    const client = new Anthropic({ apiKey: params.apiKey });
    try {
      const completion = await client.messages.create({
        model: params.selectedModel,
        system: params.systemPrompt,
        messages: [{ role: 'user', content: params.userPrompt }],
        max_tokens: maxTokens,
        temperature,
      });
      return completion.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('\n')
        .trim();
    } catch (anthropicErr: unknown) {
      const errObj = anthropicErr as { status?: number; error?: { error?: { type?: string } } };
      const isModelNotFound = errObj?.status === 404 && errObj?.error?.error?.type === 'not_found_error';
      const fallbackModel = process.env.CLAUDE_MODEL || DEFAULT_CLAUDE_MODEL;
      if (isModelNotFound && fallbackModel && fallbackModel !== params.selectedModel) {
        const fallbackCompletion = await client.messages.create({
          model: fallbackModel,
          system: params.systemPrompt,
          messages: [{ role: 'user', content: params.userPrompt }],
          max_tokens: maxTokens,
          temperature,
        });
        return fallbackCompletion.content
          .filter((block) => block.type === 'text')
          .map((block) => block.text)
          .join('\n')
          .trim();
      }
      throw anthropicErr;
    }
  }

  const baseURL =
    params.provider === 'groq' ? GROQ_BASE : params.provider === 'custom' ? process.env.CUSTOM_LLM_BASE_URL! : undefined;
  const client = new OpenAI({
    apiKey: params.apiKey,
    ...(baseURL ? { baseURL } : {}),
  });
  const completion = await client.chat.completions.create({
    model: params.selectedModel,
    messages: [
      { role: 'system', content: params.systemPrompt },
      { role: 'user', content: params.userPrompt },
    ],
    max_tokens: maxTokens,
    temperature,
  });
  return completion.choices[0]?.message?.content?.trim() || '';
}

export async function roastPost(c: Context) {
  const started = Date.now();
  try {
    const userId = await getUserIdFromRequest(c);

    const formData = await c.req.formData();
    const file = formData.get('file') as File | null;
    const customDirections = (formData.get('directions') as string | null)?.trim() || '';
    const jobDescription = (formData.get('jobDescription') as string | null)?.trim() || '';
    const providerRaw = (formData.get('provider') as string) || 'groq';
    const model = (formData.get('model') as string) || '';
    const roastLevel = (formData.get('roastLevel') as string) || 'medium';
    const level: RoastLevel = ROAST_LEVELS.includes(roastLevel as RoastLevel) ? (roastLevel as RoastLevel) : 'medium';

    const selectedProvider: Provider =
      providerRaw === 'openai' || providerRaw === 'anthropic' || providerRaw === 'custom'
        ? (providerRaw as Provider)
        : 'groq';

    let apiKey = '';
    let keyName = '';

    if (selectedProvider === 'groq') {
      apiKey = process.env.GROQ_API_KEY ?? '';
      keyName = 'GROQ_API_KEY';
    } else if (selectedProvider === 'openai') {
      apiKey = process.env.OPENAI_API_KEY ?? '';
      keyName = 'OPENAI_API_KEY';
    } else if (selectedProvider === 'anthropic') {
      apiKey = process.env.ANTHROPIC_API_KEY ?? '';
      keyName = 'ANTHROPIC_API_KEY';
    } else {
      apiKey = process.env.CUSTOM_LLM_API_KEY ?? '';
      keyName = 'CUSTOM_LLM_API_KEY';
    }

    if (selectedProvider === 'custom') {
      if (!process.env.CUSTOM_LLM_BASE_URL) {
        return c.json(
          { error: 'CUSTOM_LLM_BASE_URL is not set. Add it to backend/.env or repo-root `.env` (Docker).' },
          500
        );
      }
      if (!apiKey) {
        apiKey = 'EMPTY';
      }
    } else if (!apiKey && selectedProvider === 'groq' && process.env.OPENAI_API_KEY) {
      return c.json(
        {
          error:
            'Groq is selected but GROQ_API_KEY is not set. Add it to backend/.env or repo-root `.env` for Docker (https://console.groq.com/keys) — or switch to OpenAI.',
        },
        500
      );
    } else if (!apiKey) {
      return c.json(
        {
          error: `${keyName} is not set. Add it to backend/.env or repo-root \`.env\` (Docker). For free testing use Groq (https://console.groq.com/keys).`,
        },
        500
      );
    }

    if (selectedProvider === 'custom') {
      const customModel = (model || process.env.CUSTOM_LLM_MODEL || '').trim();
      if (!customModel) {
        return c.json(
          { error: 'Enter a model id for the custom provider, or set CUSTOM_LLM_MODEL in .env.' },
          400
        );
      }
    }

    const selectedModel =
      selectedProvider === 'custom'
        ? (model || process.env.CUSTOM_LLM_MODEL || '').trim()
        : selectedProvider === 'groq'
          ? GROQ_MODELS.includes(model)
            ? model
            : GROQ_MODELS[0]
          : selectedProvider === 'openai'
            ? OPENAI_MODELS.includes(model)
              ? model
              : OPENAI_MODELS[0]
            : model || process.env.CLAUDE_MODEL || DEFAULT_CLAUDE_MODEL;

    if (!file) {
      return c.json({ error: 'No file provided. Upload a PDF or DOCX file.' }, 400);
    }

    if (file.size > MAX_SIZE_BYTES) {
      return c.json({ error: `File too large. Maximum size is ${MAX_SIZE_MB}MB.` }, 400);
    }

    const type = file.type;
    if (!ALLOWED_TYPES.includes(type)) {
      return c.json({ error: 'Invalid file type. Only PDF and DOCX are accepted.' }, 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let resumeText: string;

    if (type === 'application/pdf') {
      resumeText = await extractTextFromPdf(buffer);
    } else {
      resumeText = await extractTextFromDocx(buffer);
    }

    if (!resumeText || resumeText.length < 50) {
      return c.json(
        { error: 'Could not extract enough text from the file. Ensure the resume has readable content.' },
        400
      );
    }

    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const emailMatches = resumeText.match(emailRegex);
    const extractedEmail = emailMatches && emailMatches.length > 0 ? emailMatches[0].trim() : null;

    const directionsBlock = customDirections
      ? `\n\nIMPORTANT — User's custom directions (you must follow these when judging and roasting):\n${customDirections}`
      : '';

    const jobBlock = jobDescription
      ? `\n\nTARGET JOB/ROLE — The user is applying or preparing for this role. Evaluate the resume for this target. Say what aligns, what's missing, what to emphasize or fix for this application. Job/role:\n${jobDescription.slice(0, 4000)}`
      : '';

    const ragDisabled = process.env.RAG_DISABLE === 'true' || process.env.RAG_DISABLED === 'true';
    const retrievedChunks: { id: string; kind: string; title: string; body: string; distance: number }[] = [];
    if (!ragDisabled) {
      const queryText = buildRagQueryText({
        roastLevel: level,
        jobDescription,
        resumePrefix: resumeText,
      });
      const embedding = await embedText(queryText, { nomicTaskType: 'search_query' });
      if (embedding) {
        const similar = await searchSimilarRagChunks(embedding, { limit: 6, maxDistance: 0.55 });
        retrievedChunks.push(...similar);
      }
      const fewShots = await fetchFewShotChunksByKind(3);
      for (const f of fewShots) {
        if (!retrievedChunks.some((c) => c.id === f.id)) {
          retrievedChunks.unshift(f);
        }
      }
    }

    const retrievedContext = buildRetrievedContextBlock(
      retrievedChunks.map((c) => ({ title: c.title, body: c.body, kind: c.kind }))
    );

    const systemPrompt = buildSystemPrompt({
      level,
      jobBlock,
      directionsBlock,
      retrievedContext,
    });

    const userPrompt = buildUserPrompt(resumeText, {
      hasJob: Boolean(jobDescription.trim()),
      hasDirections: Boolean(customDirections),
    });

    let raw = await generateRawRoast({
      provider: selectedProvider,
      selectedModel,
      apiKey,
      systemPrompt,
      userPrompt,
      level,
    });

    const fallbackLevelLabel = level.charAt(0).toUpperCase() + level.slice(1);
    let parsed = parseRoastModelOutput(raw, fallbackLevelLabel);

    let moderation = await moderateRoastOutput(parsed.displayRoast);
    if (shouldBlockForCategories(moderation)) {
      const retryRaw = await generateRawRoast({
        provider: selectedProvider,
        selectedModel,
        apiKey,
        systemPrompt: systemPrompt + SAFETY_RETRY_ADDENDUM,
        userPrompt,
        level,
      });
      parsed = parseRoastModelOutput(retryRaw, fallbackLevelLabel);
      moderation = await moderateRoastOutput(parsed.displayRoast);
    }

    if (shouldBlockForCategories(moderation)) {
      parsed = {
        displayRoast:
          'We toned this roast down for safety. Try again with a different provider or roast level, or shorten sensitive personal details in the file. Your resume was still read—focus on clear metrics and concrete outcomes in each bullet.',
        displayLevel: fallbackLevelLabel,
        score: parsed.score,
        breakdown: parsed.breakdown,
        aiAssessment: parsed.aiAssessment,
      };
    }

    if (!parsed.displayRoast) {
      return c.json({ error: 'AI did not return a roast. Try again.' }, 500);
    }

    const latencyMs = Date.now() - started;
    const ragChunkIds = retrievedChunks.map((c) => c.id);
    const lexicalScores = toLexicalScoresPayload(computeResumeJobTfidfCosine(resumeText, jobDescription));

    const roastLogId = await insertRoastLog({
      userId,
      provider: selectedProvider,
      model: selectedModel,
      roastLevel: level,
      jobDescription,
      resumeText,
      roastText: parsed.displayRoast,
      score: parsed.score,
      breakdown: parsed.breakdown.length ? parsed.breakdown : null,
      aiAssessment: parsed.aiAssessment,
      latencyMs,
      ragChunkIds,
      moderation,
      lexicalScores,
    });

    return c.json({
      roast: parsed.displayRoast,
      roastLevel: parsed.displayLevel,
      ...(extractedEmail && { extractedEmail }),
      ...(parsed.score !== null && { score: parsed.score }),
      ...(parsed.breakdown.length > 0 && { breakdown: parsed.breakdown }),
      ...(parsed.aiAssessment && { aiAssessment: parsed.aiAssessment }),
      ...(lexicalScores?.tfidfJobFit && { tfidfJobFit: lexicalScores.tfidfJobFit }),
      ...(roastLogId && { roastLogId }),
    });
  } catch (err: unknown) {
    console.error('Roast API error:', err);
    const is429 = err && typeof err === 'object' && 'status' in err && (err as { status: number }).status === 429;
    const isQuota = err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'insufficient_quota';
    const isModelGone = err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'model_decommissioned';
    if (is429 || isQuota) {
      return c.json(
        {
          error: 'AI provider quota exceeded or rate limited. Try another provider/model from the dropdown.',
        },
        502
      );
    }
    if (isModelGone) {
      return c.json(
        { error: 'Selected model is no longer available. Pick another model from the dropdown.' },
        502
      );
    }
    const message = err instanceof Error ? err.message : 'Something went wrong';
    return c.json({ error: message }, 500);
  }
}
