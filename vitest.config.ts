import { defineConfig, mergeConfig } from 'vitest/config';
import app from './vite.config.ts';

export default mergeConfig(app, defineConfig({ test: { include: ['src/**/*.test.ts'] } }));
