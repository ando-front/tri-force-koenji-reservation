import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    testTimeout: 20000,
    // 実 Postgres に対する統合テストなので直列実行する（同じ facilityId/slot を使うため）
    fileParallelism: false,
  },
});
