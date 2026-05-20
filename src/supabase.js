// ============================================================
//  SUPABASE CONFIGURATION
//  Replace the two values below with your Supabase project values.
//  See SETUP.md for step-by-step instructions.
// ============================================================

import { createClient } from '@supabase/supabase-js'
import { env } from './lib/env'

const supabaseUrl = env.VITE_SUPABASE_URL
const supabaseKey = env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)
export default supabase
