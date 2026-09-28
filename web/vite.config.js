import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { rename } from 'node:fs/promises';
import { resolve } from 'node:path';

// 輸出單一 HTML 檔（JS/CSS 全部內嵌），雙擊即可離線開啟，方便用 LINE／Email 傳給別人。
export default defineConfig({
  base: './',
  plugins: [
    viteSingleFile(),
    {
      name: 'rename-output',
      apply: 'build',
      async closeBundle() {
        const out = resolve(import.meta.dirname, '../dist');
        await rename(resolve(out, 'index.html'), resolve(out, 'alishan-demo.html'));
      },
    },
  ],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    target: 'es2020',
    chunkSizeWarningLimit: 3000,
  },
});
