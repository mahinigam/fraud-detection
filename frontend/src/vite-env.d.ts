/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_SUPABASE_SERVICE_KEY?: string
  readonly VITE_FRAUD_API_ENDPOINT: string
  readonly VITE_ENVIRONMENT: 'development' | 'staging' | 'production' | 'test'
  readonly VITE_APP_VERSION: string
  readonly VITE_BUILD_NUMBER: string
  readonly VITE_ENABLE_ANALYTICS: string
  readonly VITE_ENABLE_ERROR_REPORTING: string
  readonly VITE_ERROR_REPORTING_ENDPOINT?: string
  readonly VITE_ANALYTICS_ENDPOINT?: string
  readonly NODE_ENV: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}