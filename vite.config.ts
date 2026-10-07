import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, Plugin } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Automated JSON Schema to TypeScript Codegen Plugin
 * TypeScript counterpart of Python's datamodel-code-generator for BOPP schemas.
 * Automatically runs during compile and whenever schemas change.
 */
function boppSchemaCodegenPlugin(): Plugin {
  return {
    name: 'bopp-schema-codegen',
    buildStart() {
      try {
        console.log('[Vite Build] Running automated BOPP JSON Schema to TypeScript codegen...');
        execSync('npx tsx scripts/generate_types.ts', { stdio: 'inherit' });
      } catch (err) {
        console.error('[Vite Build] Error generating BOPP schema types:', err);
      }
    },
    handleHotUpdate({ file }) {
      if (file.includes('/schemas/v1/')) {
        try {
          console.log(`[Vite Watch] Schema updated: ${file}. Regenerating types...`);
          execSync('npx tsx scripts/generate_types.ts', { stdio: 'inherit' });
        } catch (err) {
          console.error('[Vite Watch] Error regenerating BOPP schema types:', err);
        }
      }
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [boppSchemaCodegenPlugin(), react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

