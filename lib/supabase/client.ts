import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables:')
  console.error('SUPABASE_URL:', supabaseUrl ? 'SET' : 'MISSING')
  console.error('SUPABASE_ANON_KEY:', supabaseAnonKey ? 'SET' : 'MISSING')
  
  // In development, provide helpful error but don't exit
  if (process.env.NODE_ENV === 'development') {
    console.warn('Using fallback Supabase configuration for development')
  }
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      persistSession: false
    },
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, init),
    },
    realtime: {
      params: {
        eventsPerSecond: 2
      }
    }
  }
)