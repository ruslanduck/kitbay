import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// On GitHub Actions this is `owner/repo`; anywhere else it is undefined.
const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1]

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // WHERE the app is served from, which decides every asset URL in index.html.
  //
  // GitHub Pages puts it under the REPO NAME; Vercel serves a project at the
  // ROOT of its own domain, so a build made for Pages would ask for
  // /<repo>/assets/… there and render a blank page.
  // `VERCEL` is set by Vercel's own build environment, so one repo produces the
  // right build for both hosts and neither needs a branch or a flag.
  //
  // The Pages path IS the repo name, and GitHub Actions hands that over in
  // `GITHUB_REPOSITORY` — so renaming the repo cannot leave a stale literal
  // here pointing every asset at a path that no longer exists. The fallback is
  // only ever used by `npm run dev`.
  base: process.env.VERCEL ? '/' : `/${repoName ?? 'kitbay'}/`,
  // Honor a PORT assigned by the environment (lets the preview harness run the
  // dev server on its own port when 5173 is taken, e.g. in a git worktree).
  server: process.env.PORT ? { port: Number(process.env.PORT), strictPort: true } : undefined,
})
