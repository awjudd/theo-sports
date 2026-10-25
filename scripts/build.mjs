// Copies the static site (index.html, css/, js/) into dist/ so it can be deployed as Cloudflare static assets.
import { cpSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'dist');

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const item of ['index.html', 'css', 'js']) {
  if (!existsSync(join(root, item))) throw new Error('Missing ' + item);
  cpSync(join(root, item), join(out, item), { recursive: true });
}
console.log('Built static site into dist/');
