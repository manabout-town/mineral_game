/* eslint-env node */
/**
 * UNIVERSAL_GAME_FRAMEWORK 4-Layer 의존 방향 강제:
 *   core    ← (의존 가능) ← systems ← platform ← view
 *   shared  ← 모두 사용 가능
 *
 * 역방향(예: core → view) 금지. eslint-plugin-boundaries로 정적 검증.
 */
module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  plugins: ['@typescript-eslint', 'react-hooks', 'react-refresh', 'boundaries'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  settings: {
    'boundaries/elements': [
      { type: 'shared', pattern: 'src/shared/**' },
      { type: 'core', pattern: 'src/core/**' },
      { type: 'systems', pattern: 'src/systems/**' },
      { type: 'platform', pattern: 'src/platform/**' },
      { type: 'view', pattern: 'src/view/**' },
    ],
  },
  rules: {
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'warn',
    'no-empty': ['error', { allowEmptyCatch: false }], // 5계명 §5 Traceable: 빈 catch 금지
    'boundaries/element-types': [
      'error',
      {
        default: 'disallow',
        rules: [
          // shared는 어디서든 import 가능
          { from: '*', allow: ['shared'] },
          // core는 shared만 의존 가능 (5계명 §1 Pure Logic First)
          { from: 'core', allow: ['shared', 'core'] },
          // systems는 core, shared 의존 가능
          { from: 'systems', allow: ['shared', 'core', 'systems'] },
          // platform은 core, systems, shared 의존 가능
          { from: 'platform', allow: ['shared', 'core', 'systems', 'platform'] },
          // view는 모두 의존 가능 (단, 직접 mutation 금지는 코드 리뷰로)
          { from: 'view', allow: ['shared', 'core', 'systems', 'platform', 'view'] },
        ],
      },
    ],
  },
  overrides: [
    {
      // Phase 1 슬림 셋업 — view 폴더에서 PixiJS/React 사용 허용
      files: ['src/view/**/*.{ts,tsx}'],
      rules: {},
    },
    {
      // core/systems는 PixiJS/React import 정적 차단
      files: ['src/core/**/*.ts', 'src/systems/**/*.ts'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            paths: [
              { name: 'pixi.js', message: 'core/systems는 PixiJS를 import 할 수 없습니다 (5계명 §1 Pure Logic First).' },
              { name: 'react', message: 'core/systems는 React를 import 할 수 없습니다.' },
              { name: 'react-dom', message: 'core/systems는 react-dom을 import 할 수 없습니다.' },
              { name: '@supabase/supabase-js', message: 'core/systems는 Supabase 직접 import 금지. platform 어댑터를 통해 접근하세요.' },
            ],
            patterns: ['pixi.js/*', 'react/*'],
          },
        ],
      },
    },
  ],
  ignorePatterns: ['dist', 'node_modules', '*.cjs', 'vite.config.ts'],
};
