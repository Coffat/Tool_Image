const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const outDir = path.resolve(__dirname, '../dist-electron');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const entry = path.resolve(__dirname, '../src/main/preload.ts');
const outfileCjs = path.join(outDir, 'preload.cjs');
const outfileJs = path.join(outDir, 'preload.js');

esbuild.buildSync({
  entryPoints: [entry],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: outfileCjs,
  external: ['electron'],
});

fs.copyFileSync(outfileCjs, outfileJs);
console.log('[Script] Preload built cleanly as CommonJS at:', outfileCjs);
