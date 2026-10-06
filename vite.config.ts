import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import path from 'path';
import { buildSync } from 'esbuild';

function preloadBuilder(): Plugin {
  const compile = () => {
    buildSync({
      entryPoints: ['src/main/preload.ts'],
      bundle: true,
      platform: 'node',
      format: 'cjs',
      outfile: 'dist-electron/preload.cjs',
      external: ['electron'],
    });
    buildSync({
      entryPoints: ['src/main/preload.ts'],
      bundle: true,
      platform: 'node',
      format: 'cjs',
      outfile: 'dist-electron/preload.js',
      external: ['electron'],
    });
  };

  return {
    name: 'preload-builder',
    buildStart() {
      compile();
    },
    handleHotUpdate(ctx) {
      if (ctx.file.includes('preload.ts')) {
        compile();
        ctx.server.ws.send({ type: 'full-reload' });
      }
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    preloadBuilder(),
    electron([
      {
        entry: 'src/main/index.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['sharp', 'onnxruntime-node'],
            },
          },
        },
      },
    ]),
    renderer(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
