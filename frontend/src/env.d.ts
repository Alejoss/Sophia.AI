/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_META_PIXEL_ID?: string
  readonly VITE_GA_MEASUREMENT_ID?: string
  readonly VITE_SENTRY_DSN?: string
  readonly VITE_GOOGLE_OAUTH_CLIENT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
} 