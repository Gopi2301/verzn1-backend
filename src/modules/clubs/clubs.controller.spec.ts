import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { describe, expect, beforeEach, it, vi } from 'vitest';
import { ROLES_KEY } from '../../common/decorators/roles.decorator.js';
import { ClubAccessGuard } from '../../common/guards/club-access.guard.js';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard.js';
import { ClubsController } from './clubs.controller.js';
import { ClubsService } from './clubs.service.js';

describe('ClubsController', () => {
  let controller: ClubsController;
  let clubsService: {
    createGroup: ReturnType<typeof vi.fn>;
    myClubs: ReturnType<typeof vi.fn>;
    findAll: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
  };

  const mockUser = {
    id: 'usr-owner-1',
    email: 'owner@example.com',
    roles: ['USER'],
  };

  beforeEach(async () => {
    clubsService = {
      createGroup: vi.fn().mockResolvedValue({ id: 'grp-1', name: 'Marathon Group' }),
      myClubs: vi.fn().mockResolvedValue([]),
      findAll: vi.fn().mockResolvedValue([]),
      findById: vi.fn().mockResolvedValue({ id: 'clb-1', name: 'City Striders' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClubsController],
      providers: [
        { provide: ClubsService, useValue: clubsService },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ClubAccessGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ClubsController>(ClubsController);
  });

  describe('createGroup role authorization', () => {
    it('should have @Roles restricted strictly to OWNER only', () => {
      const reflector = new Reflector();
      const roles = reflector.get<string[]>(ROLES_KEY, ClubsController.prototype.createGroup);
      expect(roles).toEqual(['OWNER']);
    });

    it('should delegate createGroup to clubsService with correct parameters', async () => {
      const dto = { name: 'Marathon Group' };
      const result = await controller.createGroup('clb-1', mockUser, dto as any);

      expect(result).toEqual({ id: 'grp-1', name: 'Marathon Group' });
      expect(clubsService.createGroup).toHaveBeenCalledWith('clb-1', 'usr-owner-1', dto);
    });
  });
});
