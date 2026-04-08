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

async function checkUser(email: string) {
  console.log(`Checking status for ${email}...`);
  
  // Check Auth
  const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();
  const authUser = users?.find(u => u.email === email);
  
  if (authUser) {
    console.log('Auth User found:', {
      id: authUser.id,
      email: authUser.email,
      confirmed_at: authUser.email_confirmed_at,
      last_sign_in: authUser.last_sign_in_at
    });
  } else {
    console.log('Auth User NOT found');
  }

  // Check Profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', email)
    .single();

  if (profile) {
    console.log('Profile found:', profile);
  } else {
    console.log('Profile NOT found', profileError?.message);
  }
}

checkUser('atleta@boxlink.com');
