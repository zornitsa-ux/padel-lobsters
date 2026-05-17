import { z } from 'zod'

const envSchema = z.object({
  VITE_SUPABASE_URL: z.url('VITE_SUPABASE_URL must be a valid URL'),
  VITE_SUPABASE_ANON_KEY: z
    .string()
    .min(1, 'VITE_SUPABASE_ANON_KEY is required')
    .transform((value) => value.trim())
    .refine((value) => value.length > 0, 'VITE_SUPABASE_ANON_KEY is required'),
})

const rawEnv = (import.meta as ImportMeta & { env: Record<string, string | undefined> }).env
const parsed = envSchema.safeParse(rawEnv)

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('; ')
  throw new Error(`Invalid environment configuration: ${details}`)
}

export const env = parsed.data
