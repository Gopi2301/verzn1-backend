import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  private supabase: SupabaseClient;

  constructor(private configService: ConfigService) {
    const url = this.configService.get<string>('supabase.url') || 'https://placeholder.supabase.co';
    const anonKey = this.configService.get<string>('supabase.anonKey') || 'placeholder-anon-key';
    this.supabase = createClient(url, anonKey);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // In development / testing environment with mock headers, allow fallback mock user
      if (process.env.NODE_ENV === 'test' || process.env.ALLOW_MOCK_AUTH === 'true') {
        request.user = {
          id: request.headers['x-mock-user-id'] || '00000000-0000-0000-0000-000000000001',
          email: 'test@example.com',
        };
        return true;
      }
      throw new UnauthorizedException('Missing or invalid authorization bearer token');
    }

    const token = authHeader.split(' ')[1];
    const { data, error } = await this.supabase.auth.getUser(token);

    if (error || !data.user) {
      throw new UnauthorizedException('Invalid or expired authentication token');
    }
    const rawRoles =
      data.user.user_metadata?.roles ||
      (data.user.user_metadata?.role ? [data.user.user_metadata.role] : ['ATHLETE']);

    request.user = {
      id: data.user.id,
      email: data.user.email,
      fullName: data.user.user_metadata?.full_name,
      roles: Array.isArray(rawRoles)
        ? rawRoles.map((r: string) => (typeof r === 'string' ? r.toUpperCase() : String(r).toUpperCase()))
        : ['ATHLETE'],
    };

    return true;
  }
}
