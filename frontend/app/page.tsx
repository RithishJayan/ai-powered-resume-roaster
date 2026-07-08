'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';

type Status = 'idle' | 'uploading' | 'done' | 'error';

const ANALYZING_PHASES = [
  { label: 'Reading your resume', sub: 'Extracting every word…', icon: '📄' },
  { label: 'Analyzing', sub: 'Checking fit and impact…', icon: '🔍' },
  { label: 'Roasting', sub: 'Applying the heat…', icon: '🔥' },
];

function renderRoastWithHighlights(text: string) {
  const regex = /(\*\*[^*]+\*\*|<<[^>]+>>|\{\{[^}]+\}\})/g;
  const parts = text.split(regex);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="roast-highlight">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('<<') && part.endsWith('>>')) {
      return <span key={i} className="impact-highlight" title="Needs impact / metrics">{part.slice(2, -2)}</span>;
    }
    if (part.startsWith('{{') && part.endsWith('}}')) {
      return <span key={i} className="attention-highlight" title="Needs attention / fix">{part.slice(2, -2)}</span>;
    }
    return part;
  });
}

type Provider = 'groq' | 'openai' | 'anthropic' | 'custom';

export default function Home() {
  const { data: session } = useSession();
  const [file, setFile] = useState<File | null>(null);
  const [directions, setDirections] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [provider, setProvider] = useState<Provider>('groq');
  const [model, setModel] = useState<string>('llama-3.3-70b-versatile');
  const [roastLevel, setRoastLevel] = useState<'mild' | 'medium' | 'spicy' | 'savage'>('medium');
  const [status, setStatus] = useState<Status>('idle');
  const [roast, setRoast] = useState<string | null>(null);
  const [roastLevelLabel, setRoastLevelLabel] = useState<string | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [breakdown, setBreakdown] = useState<{ name: string; score: number }[]>([]);
  const [aiAssessment, setAiAssessment] = useState<{ score: number; label: string; signs: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragover, setDragover] = useState(false);
  const [hideAiDetails, setHideAiDetails] = useState(false);
  const [analyzingPhase, setAnalyzingPhase] = useState(0);
  const [roastLogId, setRoastLogId] = useState<string | null>(null);
  const [feedbackThumbs, setFeedbackThumbs] = useState<'up' | 'down' | null>(null);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackStatus, setFeedbackStatus] = useState<'idle' | 'sending' | 'sent' | 'error' | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  useEffect(() => {
    if (status !== 'uploading') return;
    const t1 = setTimeout(() => setAnalyzingPhase(1), 1800);
    const t2 = setTimeout(() => setAnalyzingPhase(2), 3800);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [status]);

  const accept = '.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  const setFileAndReset = useCallback((f: File | null) => {
    setFile(f);
    setRoast(null);
    setScore(null);
    setBreakdown([]);
    setAiAssessment(null);
    setError(null);
    setRoastLogId(null);
    setFeedbackThumbs(null);
    setFeedbackComment('');
    setFeedbackStatus(null);
    setFeedbackError(null);
    setStatus(f ? 'idle' : 'idle');
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragover(false);
      const f = e.dataTransfer.files[0];
      if (!f) return;
      const valid =
        f.type === 'application/pdf' ||
        f.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      if (!valid) {
        setError('Only PDF and DOCX files are accepted.');
        return;
      }
      setError(null);
      setFileAndReset(f);
    },
    [setFileAndReset]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragover(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragover(false);
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (!f) return;
      setError(null);
      setFileAndReset(f);
    },
    [setFileAndReset]
  );

  const handleSubmit = useCallback(async () => {
    if (!file) return;
    setStatus('uploading');
    setError(null);
    setRoast(null);

    const formData = new FormData();
    formData.append('file', file);
    if (directions.trim()) formData.append('directions', directions.trim());
    if (jobDescription.trim()) formData.append('jobDescription', jobDescription.trim());
    formData.append('provider', provider);
    formData.append('model', model);
    formData.append('roastLevel', roastLevel);

    try {
      const res = await fetch('/api/roast', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Request failed');
        setStatus('error');
        return;
      }
      setRoast(data.roast);
      setRoastLevelLabel(data.roastLevel ?? roastLevel);
      setScore(typeof data.score === 'number' ? data.score : null);
      setBreakdown(Array.isArray(data.breakdown) ? data.breakdown : []);
      setAiAssessment(
        data.aiAssessment && typeof data.aiAssessment.score === 'number' && typeof data.aiAssessment.label === 'string'
          ? {
              score: data.aiAssessment.score,
              label: data.aiAssessment.label,
              signs: Array.isArray(data.aiAssessment.signs) ? data.aiAssessment.signs : [],
            }
          : null
      );
      setRoastLogId(typeof data.roastLogId === 'string' ? data.roastLogId : null);
      setFeedbackThumbs(null);
      setFeedbackComment('');
      setFeedbackStatus(null);
      setFeedbackError(null);
      setStatus('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
      setStatus('error');
    }
  }, [file, directions, jobDescription, provider, model, roastLevel]);

  const handleReset = useCallback(() => {
    setFileAndReset(null);
    setStatus('idle');
  }, [setFileAndReset]);

  const handleSendFeedback = useCallback(async () => {
    if (!roastLogId) return;
    if (!feedbackThumbs && !feedbackComment.trim()) {
      setFeedbackError('Pick thumbs up/down or add a short comment.');
      return;
    }
    setFeedbackStatus('sending');
    setFeedbackError(null);
    try {
      const res = await fetch('/api/roast/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roastLogId,
          thumbs: feedbackThumbs,
          comment: feedbackComment.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedbackError(data.error || 'Failed to send feedback');
        setFeedbackStatus('error');
        return;
      }
      setFeedbackStatus('sent');
    } catch (err) {
      setFeedbackError(err instanceof Error ? err.message : 'Network error');
      setFeedbackStatus('error');
    }
  }, [roastLogId, feedbackThumbs, feedbackComment]);

  return (
    <main className="container">
      <div className="user-bar">
        {session?.user && (
          <>
            <span className="user-bar-label">Signed in as</span>
            <span className="user-bar-email">{session.user.email ?? session.user.name ?? '—'}</span>
            <button
              type="button"
              className="btn btn-secondary user-bar-signout"
              onClick={() => signOut({ callbackUrl: '/login' })}
            >
              Sign out
            </button>
          </>
        )}
      </div>
      <button
        type="button"
        className="presentation-toggle"
        onClick={() => setHideAiDetails((v) => !v)}
        title={hideAiDetails ? 'Show AI provider & model' : 'Hide AI details (for demos)'}
        aria-label={hideAiDetails ? 'Show AI details' : 'Hide AI details'}
      >
        {hideAiDetails ? (
          <>
            <span className="presentation-toggle-icon">👁</span>
            <span>Show AI</span>
          </>
        ) : (
          <>
            <span className="presentation-toggle-icon">👁‍🗨</span>
            <span>Hide AI</span>
          </>
        )}
      </button>

      <h1>Resume Roast</h1>
      <p className="subtitle">
        Drop your resume (PDF or DOCX). Add a target job to roast for that role, or your own directions.
      </p>

      <div className="job-section">
        <label htmlFor="jobDescription" className="label">
          Target job or role <span className="label-optional">(optional)</span>
        </label>
        <textarea
          id="jobDescription"
          className="directions-input"
          placeholder="Paste job description or e.g. Senior Product Manager at FAANG, Backend Engineer at startup…"
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
          rows={2}
        />
      </div>

      <div className="directions-section">
        <label htmlFor="directions" className="label">
          Your directions for the roast <span className="label-optional">(optional)</span>
        </label>
        <textarea
          id="directions"
          className="directions-input"
          placeholder="e.g. Focus on impact and leadership. Be extra harsh on buzzwords."
          value={directions}
          onChange={(e) => setDirections(e.target.value)}
          rows={2}
        />
      </div>

      {!hideAiDetails && (
        <>
          <div className="model-section">
            <span className="label">AI provider</span>
            <select
              className="model-select"
              value={provider}
              onChange={(e) => {
                const p = e.target.value as Provider;
                setProvider(p);
                if (p === 'custom') {
                  setModel('');
                } else if (p === 'groq') {
                  setModel('llama-3.3-70b-versatile');
                } else if (p === 'openai') {
                  setModel('gpt-4o');
                } else {
                  setModel('');
                }
              }}
            >
              <option value="groq">Groq (free) — good for testing</option>
              <option value="openai">OpenAI — GPT-4o / mini (paid)</option>
              <option value="anthropic">Anthropic — Claude (paid)</option>
              <option value="custom">Custom — OpenAI-compatible (vLLM / local)</option>
            </select>
          </div>
          <div className="model-section">
            <span className="label">Model</span>
            {provider === 'custom' ? (
              <input
                type="text"
                className="model-select"
                style={{ width: '100%', maxWidth: '28rem' }}
                placeholder="Model id served by your endpoint (e.g. meta-llama/Meta-Llama-3.1-8B-Instruct)"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                aria-label="Custom model id"
              />
            ) : (
              <select
                className="model-select"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              >
                {provider === 'groq' ? (
                  <>
                    <option value="llama-3.3-70b-versatile">Llama 3.3 70B — best free</option>
                    <option value="llama-3.1-8b-instant">Llama 3.1 8B — fastest</option>
                    <option value="openai/gpt-oss-120b">GPT OSS 120B</option>
                    <option value="openai/gpt-oss-20b">GPT OSS 20B</option>
                  </>
                ) : provider === 'openai' ? (
                  <>
                    <option value="gpt-4o">GPT-4o — best quality</option>
                    <option value="gpt-4o-mini">GPT-4o mini — faster &amp; cheaper</option>
                  </>
                ) : (
                  <>
                    <option value="">Use `CLAUDE_MODEL` from .env</option>
                    <option value="claude-sonnet-4-5-20250929">Claude Sonnet 4.5</option>
                    <option value="claude-3-5-haiku-latest">Claude 3.5 Haiku</option>
                  </>
                )}
              </select>
            )}
          </div>
        </>
      )}

      <div className="model-section">
        <span className="label">Roast level</span>
        <select
          className="model-select"
          value={roastLevel}
          onChange={(e) => setRoastLevel(e.target.value as 'mild' | 'medium' | 'spicy' | 'savage')}
        >
          <option value="mild">Mild — supportive, gentle</option>
          <option value="medium">Medium — witty, light roasts</option>
          <option value="spicy">Spicy — sharp and sardonic</option>
          <option value="savage">Savage — no mercy, still constructive</option>
        </select>
      </div>

      <div
        className={`upload-zone ${dragover ? 'dragover' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => document.getElementById('file-input')?.click()}
      >
        <input
          id="file-input"
          type="file"
          accept={accept}
          onChange={handleChange}
        />
        <div className="upload-icon">📄</div>
        <p>
          <strong>Drop a file here</strong> or click to browse
        </p>
        <p className="formats">PDF, DOCX only — max 5MB</p>
      </div>

      {error && <div className="error-msg">{error}</div>}

      {status === 'uploading' && (
        <div className="analyzing-overlay" aria-live="polite">
          <div className="analyzing-card">
            <div className="analyzing-steps">
              {ANALYZING_PHASES.map((phase, i) => (
                <div
                  key={phase.label}
                  className={`analyzing-step ${i <= analyzingPhase ? 'active' : ''} ${i === analyzingPhase ? 'current' : ''}`}
                >
                  <span className="analyzing-step-icon">{phase.icon}</span>
                  <span className="analyzing-step-label">{phase.label}</span>
                </div>
              ))}
            </div>
            <div className="analyzing-phase-content">
              <div className="analyzing-icon">{ANALYZING_PHASES[analyzingPhase].icon}</div>
              <div className="analyzing-shimmer" />
              <p className="analyzing-title">{ANALYZING_PHASES[analyzingPhase].label}</p>
              <p className="analyzing-msg">{ANALYZING_PHASES[analyzingPhase].sub}</p>
            </div>
            <div className="analyzing-dots">
              <span className="analyzing-dot" />
              <span className="analyzing-dot" />
              <span className="analyzing-dot" />
            </div>
          </div>
        </div>
      )}

      {file && (
        <>
          <div className="file-info">
            <span className="name">{file.name}</span>
            <span>{(file.size / 1024).toFixed(1)} KB</span>
          </div>
          <div className="actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={status === 'uploading'}
            >
              {status === 'uploading' ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="spinner" /> Roasting…
                </span>
              ) : (
                'Roast my resume'
              )}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleReset}
              disabled={status === 'uploading'}
            >
              Clear
            </button>
          </div>
        </>
      )}

      {roast && (
        <>
        <div className="score-card">
          <div className="score-overall">
            {score !== null ? (
              <>
                <div className={`score-circle ${score >= 70 ? 'score-high' : score >= 50 ? 'score-mid' : ''}`} data-score={score}>
                  <span className="score-value">{score}</span>
                  <span className="score-max">/100</span>
                </div>
                <p className="score-label">Overall score</p>
              </>
            ) : (
              <>
                <div className="score-circle score-unknown">
                  <span className="score-value">—</span>
                  <span className="score-max">/100</span>
                </div>
                <p className="score-label">Overall score</p>
                <p className="score-unavailable">Score not returned this run</p>
              </>
            )}
          </div>
          <div className="score-breakdown">
            <p className="score-breakdown-title">By parameter</p>
            {breakdown.length > 0 ? (
              breakdown.map((b) => (
                <div key={b.name} className="score-row">
                  <span className="score-row-name">{b.name}</span>
                  <div className="score-row-bar-wrap">
                    <div className="score-row-bar" style={{ width: `${b.score}%` }} />
                  </div>
                  <span className="score-row-value">{b.score}</span>
                </div>
              ))
            ) : (
              <p className="score-unavailable">Breakdown not available</p>
            )}
          </div>

          {aiAssessment && (
            <div className="ai-assessment">
              <p className="score-breakdown-title">AI use likelihood</p>
              <div className={`ai-assessment-badge ai-assessment-${aiAssessment.score >= 66 ? 'high' : aiAssessment.score >= 36 ? 'mid' : 'low'}`}>
                <span className="ai-assessment-score">{aiAssessment.score}%</span>
                <span className="ai-assessment-label">{aiAssessment.label}</span>
              </div>
              {aiAssessment.signs.length > 0 && (
                <div className="ai-assessment-signs">
                  <span className="ai-assessment-signs-title">Signs:</span>
                  <ul>
                    {aiAssessment.signs.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="roast-card">
          <h3>
            🔥 Your roast
            {!hideAiDetails && roastLevelLabel && <span className="roast-level-badge">{roastLevelLabel}</span>}
          </h3>
          <div className="roast-body">{renderRoastWithHighlights(roast)}</div>
          <div className="roast-legend">
            <span className="roast-legend-item">
              <span className="roast-legend-swatch roast-swatch" /> Roast / zinger
            </span>
            <span className="roast-legend-item">
              <span className="roast-legend-swatch impact-swatch" /> Needs impact
            </span>
            <span className="roast-legend-item">
              <span className="roast-legend-swatch attention-swatch" /> Needs attention
            </span>
          </div>

          {roastLogId && (
            <div className="send-email-section" style={{ marginTop: '1rem' }}>
              <p className="label">How was this roast?</p>
              <div className="send-email-row" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
                <button
                  type="button"
                  className={`btn ${feedbackThumbs === 'up' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setFeedbackThumbs((t) => (t === 'up' ? null : 'up'))}
                  disabled={feedbackStatus === 'sending'}
                >
                  Thumbs up
                </button>
                <button
                  type="button"
                  className={`btn ${feedbackThumbs === 'down' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setFeedbackThumbs((t) => (t === 'down' ? null : 'down'))}
                  disabled={feedbackStatus === 'sending'}
                >
                  Thumbs down
                </button>
              </div>
              <label htmlFor="feedback-comment" className="label" style={{ marginTop: '0.75rem' }}>
                Optional note
              </label>
              <textarea
                id="feedback-comment"
                className="directions-input"
                rows={2}
                placeholder="What felt off or especially helpful?"
                value={feedbackComment}
                onChange={(e) => setFeedbackComment(e.target.value)}
                disabled={feedbackStatus === 'sending'}
              />
              <div className="send-email-row" style={{ marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-email"
                  onClick={handleSendFeedback}
                  disabled={feedbackStatus === 'sending' || (!feedbackThumbs && !feedbackComment.trim())}
                >
                  {feedbackStatus === 'sending' ? 'Sending…' : 'Send feedback'}
                </button>
              </div>
              {feedbackStatus === 'sent' && (
                <p className="send-email-success">Thanks — feedback saved.</p>
              )}
              {feedbackError && <p className="send-email-error">{feedbackError}</p>}
            </div>
          )}
        </div>
        </>
      )}

      {status === 'done' && roast && (
        <div className="actions" style={{ marginTop: '1rem' }}>
          <button type="button" className="btn btn-secondary" onClick={handleReset}>
            Roast another resume
          </button>
        </div>
      )}
    </main>
  );
}
