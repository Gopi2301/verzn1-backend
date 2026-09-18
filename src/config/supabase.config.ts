import { registerAs } from '@nestjs/config';

export default registerAs('supabase', () => ({
  url: process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
  anonKey: process.env.SUPABASE_ANON_KEY || 'placeholder-anon-key',
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-role-key',
}));
