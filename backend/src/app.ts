import { Hono } from 'hono';
import { feedbackPost } from './routes/feedback.js';
import { internalVerifyPost } from './routes/internal.js';
import { registerPost } from './routes/register.js';
import { roastPost } from './routes/roast.js';

export const app = new Hono();

app.post('/api/internal/verify-credentials', internalVerifyPost);
app.post('/api/register', registerPost);
app.post('/api/roast/feedback', feedbackPost);
app.post('/api/roast', roastPost);
