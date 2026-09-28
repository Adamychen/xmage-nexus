import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'fixtures/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      // The gate only means something if the set is real. It used to list
      // `src/board/gameToScene.ts` and `src/board/zones.ts`, neither of which exists, and left
      // the 8 000-line `src/board/` and the whole state layer out: 721 instrumented lines out of
      // ~80 000, reported as "87% lines" on the dashboard. The scope is now the directories that
      // hold the protocol and the state machine, which is what a regression in a callback or in
      // a store action would show up in.
      include: [
        'src/net/**/*.ts',
        'src/state/**/*.ts',
        'src/board/**/*.ts',
        'src/board/**/*.tsx',
        'src/cards/cardImages.ts',
        'src/game/feedback/*.ts',
        'src/game/infoWindowState.ts',
      ],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
        'src/__fixtures__/**',
        'src/game/feedback/*.test.ts',
        'src/state/*.test.ts',
        'src/net/*.test.ts',
        'src/board/*.test.ts',
        'src/board/*.test.tsx',
        'src/dev/**',
        'src/i18n/locales/**',
      ],
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 45,
        statements: 60,
      },
    },
  },
})
