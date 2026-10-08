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
    // Every test file imports @/lib/prisma and shares one MySQL test database,
    // so running files concurrently races on the same fixture rows. The schema
    // is MySQL (prisma/schema.prisma: provider = "mysql"); this said Postgres,
    // which it never was for the test path.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(dirname, './src'),
    },
  },
})
