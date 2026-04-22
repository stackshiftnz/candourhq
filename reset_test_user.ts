
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function resetPassword() {
  const { data: { users } } = await supabase.auth.admin.listUsers();
  const testUser = users.find(u => u.email === 'test@candour.hq');
  
  if (!testUser) {
    console.error('User test@candour.hq not found');
    return;
  }

  const { error } = await supabase.auth.admin.updateUserById(
    testUser.id,
    { password: 'Password123!' }
  );

  if (error) {
    console.error('Error resetting password:', error);
  } else {
    console.log('Password for test@candour.hq reset to Password123!');
  }
}

resetPassword();
