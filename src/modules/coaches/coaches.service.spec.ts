import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { describe, expect, beforeEach, it, vi } from 'vitest';
import { PrismaService } from '../../database/prisma.service.js';
import { CoachesService } from './coaches.service.js';

describe('CoachesService', () => {
  let service: CoachesService;
  let prisma: {
    coach: {
      findUnique: ReturnType<typeof vi.fn>;
      upsert: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(async () => {
    prisma = {
      coach: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoachesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<CoachesService>(CoachesService);
  });

  it('should find coach profile by userId', async () => {
    const mockCoach = { id: 'cch-1', userId: 'usr-1', specialties: ['Marathon', '5K'] };
    prisma.coach.findUnique.mockResolvedValue(mockCoach);

    const result = await service.findByUserId('usr-1');
    expect(result).toEqual(mockCoach);
  });

  it('should throw NotFoundException if coach profile does not exist', async () => {
    prisma.coach.findUnique.mockResolvedValue(null);
    await expect(service.findByUserId('unknown')).rejects.toThrow(NotFoundException);
  });
});
