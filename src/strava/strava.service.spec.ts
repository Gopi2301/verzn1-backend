import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { describe, expect, beforeEach, it, vi } from 'vitest';
import { PrismaService } from '../database/prisma.service.js';
import { StravaService } from './strava.service.js';

describe('StravaService', () => {
  let service: StravaService;
  let prisma: {
    user: { findUnique: ReturnType<typeof vi.fn> };
    stravaIntegration: {
      findUnique: ReturnType<typeof vi.fn>;
      upsert: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    activity: {
      count: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      upsert: ReturnType<typeof vi.fn>;
      deleteMany: ReturnType<typeof vi.fn>;
    };
  };
  let configService: { get: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    prisma = {
      user: { findUnique: vi.fn() },
      stravaIntegration: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
        update: vi.fn(),
      },
      activity: {
        count: vi.fn(),
        findMany: vi.fn(),
        upsert: vi.fn(),
        deleteMany: vi.fn(),
      },
    };

    configService = {
      get: vi.fn((key: string) => {
        if (key === 'STRAVA_CLIENT_ID') return 'mock-client-id';
        if (key === 'STRAVA_CLIENT_SECRET') return 'mock-client-secret-1234567890';
        if (key === 'APP_BASE_URL') return 'http://localhost:3000';
        if (key === 'STRAVA_WEBHOOK_VERIFY_TOKEN') return 'mock-webhook-token';
        return null;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StravaService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<StravaService>(StravaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('OAuth State Generation and Verification', () => {
    it('should generate an unpredictable state tied to the userId', () => {
      const userId = 'usr-123-uuid';
      const state1 = service.generateOAuthState(userId);
      const state2 = service.generateOAuthState(userId);

      expect(state1).toBeDefined();
      expect(state2).toBeDefined();
      // Unpredictable nonce ensures states differ
      expect(state1).not.toEqual(state2);
      expect(state1).not.toEqual(userId);
    });

    it('should verify and extract userId from a valid state token', () => {
      const userId = 'usr-456-uuid';
      const state = service.generateOAuthState(userId);
      const extractedUserId = service.verifyOAuthState(state);

      expect(extractedUserId).toBe(userId);
    });

    it('should throw BadRequestException if state is tampered with', () => {
      const userId = 'usr-456-uuid';
      const state = service.generateOAuthState(userId);
      // Tamper state
      const tamperedState = state.slice(0, -4) + 'abcd';

      expect(() => service.verifyOAuthState(tamperedState)).toThrow(BadRequestException);
    });

    it('should throw BadRequestException for malformed state', () => {
      expect(() => service.verifyOAuthState('invalid-state')).toThrow(BadRequestException);
      expect(() => service.verifyOAuthState('')).toThrow(BadRequestException);
    });
  });

  describe('Authorization URL', () => {
    it('should generate an authorization URL with signed state', () => {
      const userId = 'usr-123-uuid';
      const url = service.getAuthorizationUrl(userId);

      expect(url).toContain('https://www.strava.com/oauth/authorize');
      expect(url).toContain('client_id=mock-client-id');
      expect(url).toContain('state=');
      expect(url).not.toContain(`state=${userId}&`); // Must not be plain userId
    });
  });

  describe('Status & Disconnect', () => {
    it('should return disconnected status when no integration exists', async () => {
      prisma.stravaIntegration.findUnique.mockResolvedValue(null);

      const status = await service.getStatus('usr-123');
      expect(status.connected).toBe(false);
      expect(status.status).toBe('DISCONNECTED');
    });

    it('should disconnect Strava account and update status', async () => {
      prisma.stravaIntegration.findUnique.mockResolvedValue({
        userId: 'usr-123',
        accessToken: 'access-token-123',
        status: 'SYNCED',
      });
      prisma.stravaIntegration.update.mockResolvedValue({
        userId: 'usr-123',
        status: 'DISCONNECTED',
      });

      const result = await service.disconnect('usr-123');
      expect(result.success).toBe(true);
      expect(prisma.stravaIntegration.update).toHaveBeenCalledWith({
        where: { userId: 'usr-123' },
        data: expect.objectContaining({ status: 'DISCONNECTED' }),
      });
    });

    it('should throw NotFoundException on disconnect if integration does not exist', async () => {
      prisma.stravaIntegration.findUnique.mockResolvedValue(null);
      await expect(service.disconnect('usr-unknown')).rejects.toThrow(NotFoundException);
    });
  });

  describe('Token Encryption & Decryption at Rest', () => {
    it('should encrypt tokens with AES-256-GCM and decrypt back to plaintext', () => {
      const plainToken = 'strava_access_token_secret_12345';
      const encrypted = service.encryptToken(plainToken);

      expect(encrypted).toBeDefined();
      expect(encrypted).not.toEqual(plainToken);
      expect(encrypted.startsWith('enc:')).toBe(true);

      const decrypted = service.decryptToken(encrypted);
      expect(decrypted).toBe(plainToken);
    });

    it('should handle unencrypted legacy tokens gracefully', () => {
      const legacyToken = 'legacy_plaintext_token';
      expect(service.decryptToken(legacyToken)).toBe(legacyToken);
    });
  });

  describe('Webhook Event Handling', () => {
    it('should delete activity scoped to owner integration userId', async () => {
      prisma.stravaIntegration.findUnique.mockResolvedValue({
        userId: 'usr-athlete-1',
        stravaAthleteId: BigInt(999),
        updatedAt: new Date(),
      });
      prisma.activity.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.handleWebhookEvent({
        object_type: 'activity',
        aspect_type: 'delete',
        owner_id: 999,
        object_id: 1234567,
        event_time: Math.floor(Date.now() / 1000),
        subscription_id: 1,
      });

      expect(result.received).toBe(true);
      expect(prisma.activity.deleteMany).toHaveBeenCalledWith({
        where: {
          stravaActivityId: BigInt(1234567),
          userId: 'usr-athlete-1',
        },
      });
    });

    it('should ignore stale deauthorization events', async () => {
      const now = Date.now();
      prisma.stravaIntegration.findUnique.mockResolvedValue({
        userId: 'usr-athlete-1',
        stravaAthleteId: BigInt(999),
        updatedAt: new Date(now), // reconnected recently
      });

      // Event is from 10 minutes ago
      const staleEventTime = Math.floor((now - 600000) / 1000);

      const result = await service.handleWebhookEvent({
        object_type: 'athlete',
        aspect_type: 'update',
        owner_id: 999,
        object_id: 999,
        event_time: staleEventTime,
        subscription_id: 1,
        updates: { authorized: 'false' },
      });

      expect(result.received).toBe(true);
      expect(result.ignored).toBe(true);
    });
  });
});
