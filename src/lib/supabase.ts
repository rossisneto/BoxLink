import { createClient } from '@supabase/supabase-js';

let _supabase: any = null;

export const getSupabase = () => {
  if (!_supabase) {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Supabase credentials missing. App may not function correctly.');
      // Return a proxy that logs errors instead of throwing
      return new Proxy({}, {
        get: () => () => ({ 
          auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) },
          from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: null, error: new Error('Missing credentials') }) }) }) })
        })
      });
    }
    if (supabaseAnonKey.startsWith('sb_')) {
      throw new Error("Invalid Supabase Key: It looks like you are using a Stripe key (starting with 'sb_') instead of a Supabase key. Please use the 'anon' key from Supabase Settings -> API.");
    }
    _supabase = createClient(supabaseUrl, supabaseAnonKey);
  }
  return _supabase;
};

// For backward compatibility while we migrate
export const supabase = new Proxy({} as any, {
  get: (target, prop) => {
    return (getSupabase() as any)[prop];
  }
});
