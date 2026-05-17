import { z } from 'zod'

export const playerFormSchema = z.object({
  firstName: z.string().trim().min(1, 'First Name is required'),
  lastName: z.string().trim().min(1, 'Last Name is required'),
  country: z.string().optional(),
  gender: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  playtomicLevel: z.union([z.string(), z.number()]).optional(),
})

const adminOnlyOptionalLabels = {
  country: 'Country',
  gender: 'Gender',
  email: 'Email',
  phone: 'Phone / WhatsApp',
  playtomicLevel: 'Playtomic Level',
} as const

export function getMissingPlayerFormFields(form: unknown, isAdmin: boolean): string[] {
  const parsed = playerFormSchema.safeParse(form)
  const missing = new Set<string>()

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] || '')
      if (key === 'firstName') missing.add('First Name')
      if (key === 'lastName') missing.add('Last Name')
    }
  }

  if (!isAdmin) {
    const data = (form || {}) as Record<string, unknown>
    for (const [key, label] of Object.entries(adminOnlyOptionalLabels)) {
      const value = data[key]
      const text = typeof value === 'string' ? value.trim() : String(value || '').trim()
      if (!text) missing.add(label)
    }
  }

  return [...missing]
}
