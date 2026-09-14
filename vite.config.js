import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // WHERE the app is served from, which decides every asset URL in index.html.
  //
  // GitHub Pages puts it under the repo name (duck-agency.com/studio-demo/);
  // Vercel serves a project at the ROOT of its own domain, so a build made for
  // Pages would ask for /studio-demo/assets/… there and render a blank page.
  // `VERCEL` is set by Vercel's own build environment, so one repo produces the
  // right build for both hosts and neither needs a branch or a flag.
  base: process.env.VERCEL ? '/' : '/studio-demo/',
  // Honor a PORT assigned by the environment (lets the preview harness run the
  // dev server on its own port when 5173 is taken, e.g. in a git worktree).
  server: process.env.PORT ? { port: Number(process.env.PORT), strictPort: true } : undefined,
})
