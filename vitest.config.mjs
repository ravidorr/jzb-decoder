import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/check-release*.test.mjs']
  }
});
