import process from 'node:process';
import { stat } from 'node:fs/promises';
import { createWebServer } from './web.js';

await stat('dist/index.html');
const port = Number(process.env.PORT || 8080);
const server = createWebServer();
server.listen(port, '0.0.0.0', () => console.log(`[web] listening on ${port}`));
function shutdown() {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
}
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
