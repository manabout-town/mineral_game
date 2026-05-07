/**
 * boot-config — 게임 부팅 시 클라이언트가 호출하는 공개 엔드포인트.
 *
 * GET /functions/v1/boot-config
 *   → { flags, maintenance, minSupportedVersion }
 *
 * 동작:
 *   1. maintenance 테이블 (id=1 싱글톤 행) 조회
 *   2. feature_flags 테이블 전체 조회
 *   3. JSON 조합 반환
 *   4. DB 오류 시 safe default (maintenance.enabled=false) 반환
 *      — 게임은 항상 뜰 수 있어야 한다.
 *
 * RLS: anon key로 public read 허용.
 * 캐시: Cache-Control max-age=60 (CDN/브라우저 1분 캐시)
 */

// @ts-expect-error — Deno 런타임
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
// @ts-expect-error — Deno 런타임
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const env = (globalThis as Record<string, unknown>).Deno?.env?.get?.bind(
  (globalThis as Record<string, unknown>).Deno?.env,
) as ((k: string) => string | undefined) | undefined;

const SUPABASE_URL             = env?.('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = env?.('SUPABASE_SERVICE_ROLE_KEY');

interface FeatureFlagRow {
  key: string;
  enabled: boolean;
}

interface MaintenanceRow {
  enabled: boolean;
  message_ko: string | null;
  message_en: string | null;
  min_supported_version: string | null;
}

const SAFE_DEFAULT = {
  maintenance: { enabled: false },
  flags: { ads_enabled: false, iap_enabled: false, new_card_system: false },
  minSupportedVersion: null,
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type',
};

// @ts-expect-error — Deno serve
serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== 'GET') {
    return new Response('method not allowed', { status: 405, headers: CORS_HEADERS });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify(SAFE_DEFAULT), {
      status: 200,
      headers: { 'content-type': 'application/json', ...CORS_HEADERS },
    });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const [{ data: maintRows, error: maintErr }, { data: flagRows, error: flagErr }] =
      await Promise.all([
        supabase
          .from('maintenance')
          .select('enabled,message_ko,message_en,min_supported_version')
          .eq('id', 1)
          .limit(1),
        supabase.from('feature_flags').select('key,enabled'),
      ]);

    if (maintErr || flagErr) {
      console.error('[boot-config] db error', maintErr ?? flagErr);
      return new Response(JSON.stringify(SAFE_DEFAULT), {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'cache-control': 'no-store',
          ...CORS_HEADERS,
        },
      });
    }

    const maint = (maintRows as MaintenanceRow[])?.[0];
    const maintenance = maint
      ? {
          enabled: !!maint.enabled,
          messageKo: maint.message_ko ?? undefined,
          messageEn: maint.message_en ?? undefined,
        }
      : { enabled: false };

    const flags: Record<string, boolean> = {
      ads_enabled: false,
      iap_enabled: false,
      new_card_system: false,
    };
    for (const row of (flagRows as FeatureFlagRow[]) ?? []) {
      flags[row.key] = !!row.enabled;
    }

    const result = {
      maintenance,
      flags,
      minSupportedVersion: maint?.min_supported_version ?? null,
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'cache-control': 'public, max-age=60',
        ...CORS_HEADERS,
      },
    });
  } catch (e) {
    console.error('[boot-config] unexpected error', e);
    return new Response(JSON.stringify(SAFE_DEFAULT), {
      status: 200,
      headers: { 'content-type': 'application/json', ...CORS_HEADERS },
    });
  }
});
