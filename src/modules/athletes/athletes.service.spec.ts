import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { FitnessLevel } from '@prisma/client';
import { describe, expect, beforeEach, it, vi } from 'vitest';
import { PrismaService } from '../../database/prisma.service.js';
import { AthletesService } from './athletes.service.js';

describe('AthletesService', () => {
  let service: AthletesService;
  let prisma: {
    athlete: {
      findUnique: ReturnType<typeof vi.fn>;
      upsert: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(async () => {
    prisma = {
      athlete: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AthletesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AthletesService>(AthletesService);
  });

  it('should parse friendly pace strings and format response', async () => {
    const mockDbRecord = {
      id: 'ath-1',
      userId: 'usr-1',
      fitnessLevel: FitnessLevel.BEGINNER,
      currentPaceSecKm: 390, // 6:30/km
      targetPaceSecKm: 330,  // 5:30/km
      vo2Max: null,
      maxHr: null,
      thresholdHr: null,
    };
    prisma.athlete.upsert.mockResolvedValue(mockDbRecord);

    const result = await service.createOrUpdate('usr-1', {
      dob: '1995-01-01',
      fitnessLevel: FitnessLevel.BEGINNER,
      currentPace: '6:30',
      targetPace: '5:30',
    });

    expect(result).toMatchObject({
      id: 'ath-1',
      userId: 'usr-1',
      fitnessLevel: FitnessLevel.BEGINNER,
      currentPaceSecKm: 390,
      targetPaceSecKm: 330,
      formattedCurrentPace: '6:30 min/km',
      formattedTargetPace: '5:30 min/km',
    });
  });

  it('should find athlete by userId with formatted pace string fields', async () => {
    const mockAthlete = {
      id: 'ath-1',
      userId: 'usr-1',
      fitnessLevel: FitnessLevel.INTERMEDIATE,
      currentPaceSecKm: 300,
      targetPaceSecKm: 270,
    };
    prisma.athlete.findUnique.mockResolvedValue(mockAthlete);

    const result = await service.findByUserId('usr-1');
    expect(result).toMatchObject({
      formattedCurrentPace: '5:00 min/km',
      formattedTargetPace: '4:30 min/km',
    });
  });

  it('should throw NotFoundException if athlete profile does not exist', async () => {
    prisma.athlete.findUnique.mockResolvedValue(null);
    await expect(service.findByUserId('unknown')).rejects.toThrow(NotFoundException);
  });
});
