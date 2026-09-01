import { defineConfig } from 'vitest/config'
import path from 'path'
import { fileURLToPath } from 'url'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 20000,
    hookTimeout: 30000,
    fileParallelism: false, // shared Postgres test DB - avoid cross-test races
  },
  resolve: {
    alias: {
      '@': path.resolve(dirname, './src'),
    },
  },
})
