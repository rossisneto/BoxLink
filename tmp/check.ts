import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

async function check() {
  const email = 'atleta@boxlink.com';
  console.log('--- DIAGNOSTIC START ---');
  
  const { data: { users } } = await supabase.auth.admin.listUsers();
  const u = users.find(x => x.email === email);
  if (u) {
    console.log('AUTH_USER_ID:', u.id);
    console.log('AUTH_CONFIRMED_AT:', u.email_confirmed_at);
  } else {
    console.log('AUTH_USER: NOT FOUND');
  }

  const { data: p } = await supabase.from('profiles').select('*').eq('email', email).single();
  if (p) {
    console.log('PROFILE_ID:', p.id);
    console.log('PROFILE_STATUS:', p.status);
    console.log('PROFILE_ROLE:', p.role);
  } else {
    console.log('PROFILE: NOT FOUND');
  }
  console.log('--- DIAGNOSTIC END ---');
}

check();
