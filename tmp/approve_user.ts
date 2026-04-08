import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

async function approveUser(email: string) {
  console.log(`Approving ${email}...`);
  
  const { data, error } = await supabase
    .from('profiles')
    .update({ 
      status: 'approved',
      name: 'Atleta Teste'
    })
    .eq('email', email)
    .select();

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('User approved successfully:', data);
  }
}

approveUser('atleta@boxlink.com');
