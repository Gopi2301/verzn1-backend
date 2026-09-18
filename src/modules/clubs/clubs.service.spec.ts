import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ClubRole } from '@prisma/client';
import { describe, expect, beforeEach, it, vi } from 'vitest';
import { PrismaService } from '../../database/prisma.service.js';
import { ClubsService } from './clubs.service.js';

describe('ClubsService', () => {
  let service: ClubsService;
  let prisma: {
    club: {
      findUnique: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
    clubMembership: {
      upsert: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(async () => {
    prisma = {
      club: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      clubMembership: {
        upsert: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        delete: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClubsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ClubsService>(ClubsService);
  });

  it('should create a club with OWNER membership', async () => {
    prisma.club.findUnique.mockResolvedValue(null);
    prisma.club.create.mockResolvedValue({
      id: 'clb-1',
      name: 'City Striders',
      slug: 'city-striders',
    });

    const result = await service.create('usr-owner', {
      name: 'City Striders',
      slug: 'city-striders',
    });

    expect(result).toEqual({
      id: 'clb-1',
      name: 'City Striders',
      slug: 'city-striders',
    });
    expect(prisma.club.create).toHaveBeenCalled();
  });

  it('should throw ConflictException if slug already exists', async () => {
    prisma.club.findUnique.mockResolvedValue({ id: 'clb-1', slug: 'existing-slug' });
    await expect(
      service.create('usr-owner', { name: 'Existing', slug: 'existing-slug' }),
    ).rejects.toThrow(ConflictException);
  });

  it('should throw NotFoundException on non-existent club ID', async () => {
    prisma.club.findUnique.mockResolvedValue(null);
    await expect(service.findById('unknown-id')).rejects.toThrow(NotFoundException);
  });
});
