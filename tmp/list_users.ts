import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

if (fs.existsSync('.env.local')) {
  dotenv.config({ path: '.env.local' });
} else {
  dotenv.config();
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl!, supabaseServiceKey!, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function listAllUsers() {
  console.log('--- Auth Users ---');
  const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();
  if (authError) console.error(authError);
  users?.forEach(u => {
    console.log(`- ${u.email} (Confirmed: ${u.email_confirmed_at ? 'Yes' : 'No'})`);
  });

  console.log('\n--- Profiles ---');
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('email, role, status');
  if (profileError) console.error(profileError);
  profiles?.forEach(p => {
    console.log(`- ${p.email} [${p.role}] Status: ${p.status}`);
  });
}

listAllUsers();
