import { createClient } from '@supabase/supabase-js'

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://nlvsinakmocsrfjgloyo.supabase.co'
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sdnNpbmFrbW9jc3Jmamdsb3lvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3NzUxOTcsImV4cCI6MjEwMzM1MTE5N30.5yy8y4tRWwzGqC82bFnrr060uv8s4GjwZqAQm9VqkKA'

export const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null
