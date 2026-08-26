import { routes, type VercelConfig } from '@vercel/config/v1'

const originTrialToken = process.env.WEBMCP_ORIGIN_TRIAL_TOKEN

const securityHeaders = [
  { key: 'Content-Security-Policy', value: "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; script-src 'self'; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'" },
  { key: 'Permissions-Policy', value: 'tools=(self)' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
]

export const config: VercelConfig = {
  framework: 'vite',
  buildCommand: 'npm run build',
  outputDirectory: 'dist',
  headers: [
    routes.header('/(.*)', securityHeaders),
    ...(originTrialToken
      ? [routes.header('/(.*)', [{ key: 'Origin-Trial', value: originTrialToken }])]
      : []),
  ],
}

