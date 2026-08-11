import { z } from 'zod'

const envSchema = z.object({
  VITE_SUPABASE_URL: z.url('VITE_SUPABASE_URL must be a valid URL'),
  VITE_SUPABASE_ANON_KEY: z
    .string()
    .min(1, 'VITE_SUPABASE_ANON_KEY is required')
    .transform((value) => value.trim())
    .refine((value) => value.length > 0, 'VITE_SUPABASE_ANON_KEY is required'),
})

let cached: z.infer<typeof envSchema> | undefined

// Validates lazily so importing this module can never throw — only the first
// call that actually needs env vars pays for a missing/invalid config.
export function getEnv() {
  if (cached) return cached

  const rawEnv = (import.meta as ImportMeta & { env: Record<string, string | undefined> }).env
  const parsed = envSchema.safeParse(rawEnv)

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ')
    throw new Error(`Invalid environment configuration: ${details}`)
  }

  cached = parsed.data
  return cached
}
