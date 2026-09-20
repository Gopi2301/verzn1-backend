import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PrismaService } from '../../database/prisma.service.js';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  private supabase: SupabaseClient;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
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
        const mockUserId = request.headers['x-mock-user-id'] || '00000000-0000-0000-0000-000000000001';
        request.user = {
          id: mockUserId,
          email: 'test@example.com',
          roles: await this.resolveRoles(mockUserId),
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

    // Derive roles dynamically from database profile existence
    const roles = await this.resolveRoles(data.user.id);

    request.user = {
      id: data.user.id,
      email: data.user.email,
      fullName: data.user.user_metadata?.full_name,
      roles,
    };

    return true;
  }

  /**
   * Derive user roles from which profiles exist in the database.
   * - Has an Athlete record → ATHLETE
   * - Has a Coach record   → COACH
   * - Always includes USER as a base role
   */
  private async resolveRoles(userId: string): Promise<string[]> {
    const roles: string[] = ['USER'];

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        athlete: { select: { id: true } },
        coach: { select: { id: true } },
      },
    });

    if (user?.athlete) roles.push('ATHLETE');
    if (user?.coach) roles.push('COACH');

    return roles;
  }
}

