/**
 * bundle-edge-fn.ts — validate-run Edge Function용 코어 번들 빌더.
 *
 * src/core/reducers/index.ts (rootReducer + replayRun)를 Deno-호환 ESM으로 번들링.
 * 번들 결과: supabase/functions/validate-run/reducer.js
 *
 * 실행 방법:
 *   npx tsx tools/bundle-edge-fn.ts
 *
 * Phase 5-D: 이 번들이 생성된 후 validate-run/index.ts에서 import해 실제 리플레이 실행.
 *
 * 주의:
 *   - Deno는 .ts 파일을 직접 import할 수 없으므로 .js로 사전 번들링.
 *   - data/*.json import는 인라인 처리 (Deno는 JSON import 지원하지만
 *     Deno Deploy 환경에서는 번들 포함이 더 안정적).
 *   - 번들 크기 목표: < 60KB gzip
 */

import * as esbuild from 'esbuild';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const outfile = resolve(root, 'supabase/functions/validate-run/reducer.js');

async function main() {
  const result = await esbuild.build({
    entryPoints: [resolve(root, 'src/core/reducers/index.ts')],
    outfile,
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    target: 'es2022',
    // Deno는 import.meta.env 를 이해 못 하므로 상수로 대체
    define: {
      'import.meta.env': '{"DEV":false,"PROD":true}',
      'import.meta.env.DEV': 'false',
      'import.meta.env.PROD': 'true',
    },
    // JSON 파일 인라인 처리
    loader: { '.json': 'json' },
    // 트리 쉐이킹
    treeShaking: true,
    minify: false,
    metafile: true,
  });

  if (result.errors.length > 0) {
    console.error('[bundle-edge-fn] Build errors:', result.errors);
    process.exit(1);
  }

  // 번들 크기 리포트
  const outputs = result.metafile?.outputs ?? {};
  for (const [path, info] of Object.entries(outputs)) {
    const kb = (info.bytes / 1024).toFixed(1);
    console.log(`[bundle-edge-fn] ✅ ${path} → ${kb}KB`);
    if (info.bytes > 200_000) {
      console.warn('[bundle-edge-fn] ⚠️  번들 > 200KB — Deno Deploy 제한에 주의');
    }
  }

  await esbuild.stop();
  console.log('[bundle-edge-fn] Done — supabase/functions/validate-run/reducer.js');
  console.log('[bundle-edge-fn] Next: validate-run/index.ts에서 reducer.js import 후 배포');
}

void main().catch((e) => {
  console.error('[bundle-edge-fn] Fatal:', e);
  process.exit(1);
});
