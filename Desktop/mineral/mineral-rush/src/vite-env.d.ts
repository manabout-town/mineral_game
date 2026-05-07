/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_GAME_VERSION: string;
  readonly VITE_SCHEMA_VERSION: string;
  readonly VITE_DEV_HMAC_SECRET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
