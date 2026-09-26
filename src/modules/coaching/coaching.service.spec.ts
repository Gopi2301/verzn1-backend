import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { describe, expect, beforeEach, it, vi } from 'vitest';
import { PrismaService } from '../../database/prisma.service.js';
import { CoachingService } from './coaching.service.js';

describe('CoachingService', () => {
  let service: CoachingService;
  let prisma: {
    coach: { findUnique: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
    athlete: { findUnique: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
    coachingRelationship: { findUnique: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
    chatChannel: { findFirst: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  };

  beforeEach(async () => {
    prisma = {
      coach: { findUnique: vi.fn(), findMany: vi.fn() },
      athlete: { findUnique: vi.fn(), findMany: vi.fn() },
      coachingRelationship: { findUnique: vi.fn(), findMany: vi.fn() },
      chatChannel: { findFirst: vi.fn(), create: vi.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoachingService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<CoachingService>(CoachingService);
  });

  describe('Chat Channel Participant Authorization (IDOR protection)', () => {
    const coachId = 'cch-1';
    const athleteId = 'ath-1';
    const coachUserId = 'usr-coach';
    const athleteUserId = 'usr-athlete';
    const thirdPartyUserId = 'usr-stranger';

    it('should allow the coach to access the chat channel', async () => {
      prisma.coach.findUnique.mockResolvedValue({ id: coachId, userId: coachUserId });
      prisma.athlete.findUnique.mockResolvedValue({ id: athleteId, userId: athleteUserId });
      prisma.coachingRelationship.findUnique.mockResolvedValue({
        coachId,
        athleteId,
        status: 'ACTIVE',
      });
      prisma.chatChannel.findFirst.mockResolvedValue({ id: 'chn-1', coachId, athleteId });

      const result = await service.coachChat(coachId, athleteId, coachUserId);
      expect(result.id).toBe('chn-1');
    });

    it('should allow the athlete to access the chat channel', async () => {
      prisma.coach.findUnique.mockResolvedValue({ id: coachId, userId: coachUserId });
      prisma.athlete.findUnique.mockResolvedValue({ id: athleteId, userId: athleteUserId });
      prisma.coachingRelationship.findUnique.mockResolvedValue({
        coachId,
        athleteId,
        status: 'ACTIVE',
      });
      prisma.chatChannel.findFirst.mockResolvedValue({ id: 'chn-1', coachId, athleteId });

      const result = await service.coachChat(coachId, athleteId, athleteUserId);
      expect(result.id).toBe('chn-1');
    });

    it('should throw ForbiddenException if caller is not a participant in the relationship', async () => {
      prisma.coach.findUnique.mockResolvedValue({ id: coachId, userId: coachUserId });
      prisma.athlete.findUnique.mockResolvedValue({ id: athleteId, userId: athleteUserId });

      await expect(
        service.coachChat(coachId, athleteId, thirdPartyUserId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if coach or athlete profile is missing', async () => {
      prisma.coach.findUnique.mockResolvedValue(null);
      prisma.athlete.findUnique.mockResolvedValue({ id: athleteId, userId: athleteUserId });

      await expect(
        service.coachChat(coachId, athleteId, coachUserId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Discovery Search PII Protection', () => {
    it('searchCoaches should not request user email', async () => {
      prisma.coachingRelationship.findMany.mockResolvedValue([]);
      prisma.coach.findMany.mockResolvedValue([]);

      await service.searchCoaches('ath-1', {});

      expect(prisma.coach.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: {
            user: { select: { id: true, fullName: true, avatarUrl: true } },
          },
        }),
      );
    });

    it('searchAthletes should not request user email', async () => {
      prisma.coachingRelationship.findMany.mockResolvedValue([]);
      prisma.athlete.findMany.mockResolvedValue([]);

      await service.searchAthletes('cch-1', {});

      expect(prisma.athlete.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: {
            user: { select: { id: true, fullName: true, avatarUrl: true } },
          },
        }),
      );
    });
  });
});
