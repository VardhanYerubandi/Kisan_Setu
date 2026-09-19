// Bundles the React apps with esbuild into the Java backend's classpath folder (backend/src/main/resources/public).
// Usage: npm run build   |   npm run watch
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, '..', 'backend', 'src', 'main', 'resources', 'public');
const watch = process.argv.includes('--watch');

function copyStatic() {
  fs.mkdirSync(out, { recursive: true });
  fs.cpSync(path.join(here, 'public'), out, { recursive: true });
  for (const f of ['index.html', 'admin.html']) fs.copyFileSync(path.join(here, f), path.join(out, f));
}

const options = {
  entryPoints: { app: path.join(here, 'src/main.jsx'), admin: path.join(here, 'src/admin/main.jsx') },
  outdir: path.join(out, 'assets'),
  bundle: true, minify: !watch, sourcemap: watch, format: 'esm', target: 'es2020', jsx: 'automatic', logLevel: 'info',
  define: { 'process.env.NODE_ENV': watch ? '"development"' : '"production"' },
  loader: { '.svg': 'dataurl' },
};

copyStatic();
if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log('watching src/ ... (static files are copied once at start)');
} else {
  await esbuild.build(options);
  console.log('built ->', out);
}
