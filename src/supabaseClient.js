import { createClient } from '@supabase/supabase-js';

// Your Supabase Project URL and public anon key.
// These are safe to expose in a browser environment as long as you have Row Level Security enabled.
const supabaseUrl = 'https://juhemwzntxyxxtvpygbu.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1aGVtd3pudHh5eHh0dnB5Z2J1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5MjAzNDcsImV4cCI6MjA2OTQ5NjM0N30.JFecawekz8mzQdlDa-N_70B2Mo8jqcJspuhJ_nLKMiA';

// Create and export the Supabase client for use across the application.
// This single instance ensures consistency and proper connection management.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);