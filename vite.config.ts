import { defineConfig } from 'vite';
// The brand plugin owns `publicDir`, the `@brand` alias and the index.html
// placeholder substitution. See tools/vite/brand.mjs.
// @ts-expect-error — plain ESM with no type declarations, by design: tools/ has
// no build step and no package.json, so there is nothing to generate .d.ts from.
import brand from './tools/vite/brand.mjs';

export default defineConfig({
  // Relative, so a build can be dropped into any path on any CDN without being
  // rebuilt. An ad unit rarely gets to choose its own origin.
  base: './',
  plugins: [brand()],
  build: {
    target: 'es2020',
    assetsInlineLimit: 4096,
    rollupOptions: {
      output: {
        // Single chunk. The whole game is far under the size where splitting
        // helps, and one request is the fastest path to interactive on a
        // mid-tier phone — which is the only device that matters here.
        manualChunks: undefined,
      },
    },
  },
  // 5174 so this can run alongside the games/ tree without a port fight.
  server: { port: 5174 },
});
