const port = Number(process.env.NUXT_PORT || process.env.VITE_PORT || 5173)

export default defineNuxtConfig({
  compatibilityDate: '2026-03-25',
  ssr: false,
  devtools: {
    enabled: false,
  },
  css: ['~/assets/css/main.css'],
  devServer: {
    port,
    strictPort: true,
  },
  runtimeConfig: {
    public: {
      appName: process.env.NUXT_PUBLIC_APP_NAME || process.env.VITE_APP_NAME || 'Nuxt Cognito OIDC Demo',
      cognitoIssuer: process.env.NUXT_PUBLIC_COGNITO_ISSUER || process.env.VITE_COGNITO_ISSUER || '',
      cognitoClientId: process.env.NUXT_PUBLIC_COGNITO_CLIENT_ID || process.env.VITE_COGNITO_CLIENT_ID || '',
      cognitoDomain: normalizeDomain(process.env.NUXT_PUBLIC_COGNITO_DOMAIN || process.env.VITE_COGNITO_DOMAIN || ''),
      cognitoScopes: process.env.NUXT_PUBLIC_COGNITO_SCOPES || process.env.VITE_COGNITO_SCOPES || 'openid email profile',
    },
  },
})

function normalizeDomain(value: string) {
  return value.replace(/^https?:\/\//, '').replace(/\/$/, '')
}
