/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
// ─── Phase 4-G: 빌드 시 HMAC secret 강제 검증 ───────────────────
// production 빌드에서 기본값(dev-secret)이 그대로 노출되는 것을 방지.
// VITE_DEV_HMAC_SECRET이 'dev-secret' 또는 빈 값이면 빌드 실패.
var DEV_SECRET_DEFAULT = 'dev-secret';
function hmacSecretGuard() {
    return {
        name: 'hmac-secret-guard',
        buildStart: function () {
            var _a, _b;
            var mode = (_a = process.env.NODE_ENV) !== null && _a !== void 0 ? _a : '';
            var secret = (_b = process.env.VITE_DEV_HMAC_SECRET) !== null && _b !== void 0 ? _b : '';
            if (mode === 'production') {
                if (!secret || secret === DEV_SECRET_DEFAULT) {
                    throw new Error('[hmac-secret-guard] VITE_DEV_HMAC_SECRET is missing or still set to the ' +
                        'default dev value. Set a strong secret in your CI/CD environment before ' +
                        'building for production.');
                }
                if (secret.length < 32) {
                    throw new Error('[hmac-secret-guard] VITE_DEV_HMAC_SECRET must be at least 32 characters long.');
                }
            }
        },
    };
}
// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react(), hmacSecretGuard()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src'),
            '@core': path.resolve(__dirname, 'src/core'),
            '@systems': path.resolve(__dirname, 'src/systems'),
            '@platform': path.resolve(__dirname, 'src/platform'),
            '@view': path.resolve(__dirname, 'src/view'),
            '@shared': path.resolve(__dirname, 'src/shared'),
        },
    },
    server: {
        port: 5173,
        open: true,
    },
    test: {
        environment: 'jsdom',
        globals: true,
        include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx', 'src/**/*.test.ts'],
    },
});
