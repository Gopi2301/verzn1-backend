import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { describe, expect, beforeEach, it, vi } from 'vitest';
import { StravaController } from './strava.controller.js';
import { StravaService } from './strava.service.js';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard.js';

describe('StravaController', () => {
  let controller: StravaController;
  let stravaService: {
    getAuthorizationUrl: ReturnType<typeof vi.fn>;
    exchangeAuthorizationCode: ReturnType<typeof vi.fn>;
    getStatus: ReturnType<typeof vi.fn>;
    syncAthleteActivities: ReturnType<typeof vi.fn>;
    getUserActivities: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    validateWebhookChallenge: ReturnType<typeof vi.fn>;
    handleWebhookEvent: ReturnType<typeof vi.fn>;
  };

  const mockUser = {
    id: 'usr-athlete-1',
    email: 'athlete@example.com',
    roles: ['ATHLETE', 'USER'],
  };

  beforeEach(async () => {
    stravaService = {
      getAuthorizationUrl: vi.fn().mockReturnValue('https://www.strava.com/oauth/authorize?mock=1'),
      exchangeAuthorizationCode: vi.fn().mockResolvedValue({ success: true }),
      getStatus: vi.fn().mockResolvedValue({ connected: true }),
      syncAthleteActivities: vi.fn().mockResolvedValue({ success: true, syncedCount: 5 }),
      getUserActivities: vi.fn().mockResolvedValue({ total: 1, data: [] }),
      disconnect: vi.fn().mockResolvedValue({ success: true }),
      validateWebhookChallenge: vi.fn().mockReturnValue({ 'hub.challenge': 'chal-1' }),
      handleWebhookEvent: vi.fn().mockResolvedValue({ received: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StravaController],
      providers: [
        { provide: StravaService, useValue: stravaService },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<StravaController>(StravaController);
  });

  describe('Authorization URL & Connect', () => {
    it('should generate auth url for authenticated user', async () => {
      const result = await controller.getAuthUrl(mockUser, 'usr-athlete-1');
      expect(result.url).toBeDefined();
      expect(stravaService.getAuthorizationUrl).toHaveBeenCalledWith('usr-athlete-1', undefined);
    });

    it('should throw ForbiddenException if auth-url is requested for different user', async () => {
      await expect(
        controller.getAuthUrl(mockUser, 'usr-other-user'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if connect is initiated for different user', async () => {
      const mockRes = { redirect: vi.fn() } as any;
      await expect(
        controller.connect(mockUser, mockRes, 'usr-other-user'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Ownership verification on protected operations', () => {
    it('should allow user to view their own status', async () => {
      const result = await controller.getStatus('usr-athlete-1', mockUser);
      expect(result.connected).toBe(true);
      expect(stravaService.getStatus).toHaveBeenCalledWith('usr-athlete-1');
    });

    it('should throw ForbiddenException when viewing another user status', async () => {
      await expect(
        controller.getStatus('usr-other-user', mockUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow user to trigger their own sync', async () => {
      const result = await controller.syncActivities('usr-athlete-1', mockUser);
      expect(result.success).toBe(true);
      expect(stravaService.syncAthleteActivities).toHaveBeenCalledWith('usr-athlete-1', {
        page: 1,
        perPage: 30,
      });
    });

    it('should throw ForbiddenException when syncing another user activities', async () => {
      await expect(
        controller.syncActivities('usr-other-user', mockUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow user to view their own activities', async () => {
      const result = await controller.getActivities('usr-athlete-1', mockUser);
      expect(result.total).toBe(1);
      expect(stravaService.getUserActivities).toHaveBeenCalledWith('usr-athlete-1', 20, 0);
    });

    it('should throw ForbiddenException when viewing another user activities', async () => {
      await expect(
        controller.getActivities('usr-other-user', mockUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow user to disconnect their own Strava account', async () => {
      const result = await controller.disconnect('usr-athlete-1', mockUser);
      expect(result.success).toBe(true);
      expect(stravaService.disconnect).toHaveBeenCalledWith('usr-athlete-1');
    });

    it('should throw ForbiddenException when disconnecting another user account', async () => {
      await expect(
        controller.disconnect('usr-other-user', mockUser),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('OAuth Callback', () => {
    it('should delegate code and state to service exchangeAuthorizationCode', async () => {
      const result = await controller.callback('auth-code-123', 'secure-state-token', 'read,activity:read_all');
      expect(result.success).toBe(true);
      expect(stravaService.exchangeAuthorizationCode).toHaveBeenCalledWith(
        'auth-code-123',
        'secure-state-token',
        'read,activity:read_all',
      );
    });
  });
});
