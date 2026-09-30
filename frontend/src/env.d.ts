/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_META_PIXEL_ID?: string
  readonly VITE_GA_MEASUREMENT_ID?: string
  readonly VITE_SENTRY_DSN?: string
  /** Optional override for Sentry `environment` (defaults to Vite MODE). */
  readonly VITE_SENTRY_ENVIRONMENT?: string
  readonly VITE_GOOGLE_OAUTH_CLIENT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
} 