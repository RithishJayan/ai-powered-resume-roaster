import { config } from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { serve } from '@hono/node-server';
import { app } from './app.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendRoot = join(__dirname, '..');
config({ path: join(backendRoot, '.env.local') });
config({ path: join(backendRoot, '.env') });
config({ path: join(backendRoot, '..', '.env.local') });
config({ path: join(backendRoot, '..', '.env') });

const port = Number(process.env.PORT || 4000);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`SER594-M2 backend listening on http://127.0.0.1:${info.port}`);
});
