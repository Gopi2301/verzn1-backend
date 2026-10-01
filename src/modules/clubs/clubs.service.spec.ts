import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ClubGroupStatus, ClubGroupType, ClubRole } from '@prisma/client';
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
    clubGroup: {
      findUnique: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
    clubGroupMembership: {
      upsert: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
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
      clubGroup: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      clubGroupMembership: {
        upsert: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
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

  describe('Club Operations', () => {
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
      expect(prisma.club.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            memberships: { create: { userId: 'usr-owner', role: ClubRole.OWNER } },
          }),
        }),
      );
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

    it('should allow a user to join a club as MEMBER', async () => {
      prisma.club.findUnique.mockResolvedValue({ id: 'clb-1', name: 'City Striders' });
      prisma.clubMembership.upsert.mockResolvedValue({
        id: 'cmb-1',
        clubId: 'clb-1',
        userId: 'usr-athlete',
        role: ClubRole.MEMBER,
      });

      const result = await service.joinClub('clb-1', 'usr-athlete', { role: ClubRole.MEMBER });
      expect(result.role).toBe(ClubRole.MEMBER);
      expect(prisma.clubMembership.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ role: ClubRole.MEMBER }),
          update: {},
        }),
      );
    });

    it('should throw ForbiddenException if user tries to self-assign OWNER role on join', async () => {
      prisma.club.findUnique.mockResolvedValue({ id: 'clb-1', name: 'City Striders' });
      await expect(
        service.joinClub('clb-1', 'usr-attacker', { role: ClubRole.OWNER }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if user tries to self-assign ADMIN role on join', async () => {
      prisma.club.findUnique.mockResolvedValue({ id: 'clb-1', name: 'City Striders' });
      await expect(
        service.joinClub('clb-1', 'usr-attacker', { role: ClubRole.ADMIN }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if user tries to self-assign COACH role on join', async () => {
      prisma.club.findUnique.mockResolvedValue({ id: 'clb-1', name: 'City Striders' });
      await expect(
        service.joinClub('clb-1', 'usr-attacker', { role: ClubRole.COACH }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if user tries to self-assign CAPTAIN role on join', async () => {
      prisma.club.findUnique.mockResolvedValue({ id: 'clb-1', name: 'City Striders' });
      await expect(
        service.joinClub('clb-1', 'usr-attacker', { role: ClubRole.CAPTAIN }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Subgroup Operations', () => {
    it('should create a subgroup with auto-generated slug', async () => {
      prisma.club.findUnique.mockResolvedValue({ id: 'clb-1', name: 'City Striders' });
      prisma.clubGroup.findUnique.mockResolvedValue(null);
      prisma.clubGroup.create.mockResolvedValue({
        id: 'grp-1',
        clubId: 'clb-1',
        name: 'Couch to 5K',
        slug: 'couch-to-5k',
        status: ClubGroupStatus.ACTIVE,
      });

      const result = await service.createGroup('clb-1', 'usr-1', {
        name: 'Couch to 5K',
        types: [ClubGroupType.DISTANCE],
      });

      expect(result).toEqual(
        expect.objectContaining({
          id: 'grp-1',
          name: 'Couch to 5K',
          slug: 'couch-to-5k',
        }),
      );
      expect(prisma.clubGroup.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            clubId: 'clb-1',
            name: 'Couch to 5K',
            slug: 'couch-to-5k',
            status: ClubGroupStatus.ACTIVE,
          }),
        }),
      );
    });

    it('should throw ConflictException if subgroup slug already exists', async () => {
      prisma.club.findUnique.mockResolvedValue({ id: 'clb-1', name: 'City Striders' });
      prisma.clubGroup.findUnique.mockResolvedValue({ id: 'grp-existing', slug: 'couch-to-5k' });

      await expect(
        service.createGroup('clb-1', 'usr-1', {
          name: 'Couch to 5K',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should archive a subgroup', async () => {
      prisma.clubGroup.findUnique.mockResolvedValue({
        id: 'grp-1',
        clubId: 'clb-1',
        name: 'Couch to 5K',
        status: ClubGroupStatus.ACTIVE,
      });
      prisma.clubGroup.update.mockResolvedValue({
        id: 'grp-1',
        status: ClubGroupStatus.ARCHIVED,
      });

      const result = await service.archiveGroup('grp-1');
      expect(result.status).toBe(ClubGroupStatus.ARCHIVED);
      expect(prisma.clubGroup.update).toHaveBeenCalledWith({
        where: { id: 'grp-1' },
        data: { status: ClubGroupStatus.ARCHIVED },
      });
    });

    it('should allow a club member to join a subgroup (multi-subgroup support)', async () => {
      prisma.clubGroup.findUnique.mockResolvedValue({
        id: 'grp-1',
        clubId: 'clb-1',
        name: '10K Program',
      });
      prisma.clubMembership.findUnique.mockResolvedValue({
        clubId: 'clb-1',
        userId: 'usr-athlete',
        role: ClubRole.MEMBER,
      });
      prisma.clubGroupMembership.upsert.mockResolvedValue({
        id: 'gmb-1',
        groupId: 'grp-1',
        userId: 'usr-athlete',
        joinedAt: new Date(),
        leftAt: null,
      });

      const result = await service.joinGroup('grp-1', 'usr-athlete');
      expect(result.groupId).toBe('grp-1');
      expect(result.userId).toBe('usr-athlete');
      expect(prisma.clubGroupMembership.upsert).toHaveBeenCalled();
    });

    it('should throw ForbiddenException if user tries to join subgroup without belonging to club', async () => {
      prisma.clubGroup.findUnique.mockResolvedValue({
        id: 'grp-1',
        clubId: 'clb-1',
        name: '10K Program',
      });
      prisma.clubMembership.findUnique.mockResolvedValue(null);

      await expect(service.joinGroup('grp-1', 'usr-outsider')).rejects.toThrow(ForbiddenException);
    });

    it('should set leftAt timestamp when user leaves a subgroup', async () => {
      prisma.clubGroupMembership.findUnique.mockResolvedValue({
        groupId: 'grp-1',
        userId: 'usr-athlete',
        joinedAt: new Date('2026-09-01'),
        leftAt: null,
      });
      prisma.clubGroupMembership.update.mockResolvedValue({
        groupId: 'grp-1',
        userId: 'usr-athlete',
        leftAt: new Date(),
      });

      const result = await service.leaveGroup('grp-1', 'usr-athlete');
      expect(result.leftAt).toBeDefined();
      expect(prisma.clubGroupMembership.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { groupId_userId: { groupId: 'grp-1', userId: 'usr-athlete' } },
          data: expect.objectContaining({ leftAt: expect.any(Date) }),
        }),
      );
    });
  });
});
