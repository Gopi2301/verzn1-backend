import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClubRole } from '@prisma/client';
import { describe, expect, beforeEach, it, vi } from 'vitest';
import { PrismaService } from '../../database/prisma.service.js';
import { ClubAccessGuard } from './club-access.guard.js';

describe('ClubAccessGuard', () => {
  let guard: ClubAccessGuard;
  let reflector: { getAllAndOverride: ReturnType<typeof vi.fn> };
  let prisma: {
    club: { findUnique: ReturnType<typeof vi.fn> };
    clubGroup: { findUnique: ReturnType<typeof vi.fn> };
    clubMembership: { findUnique: ReturnType<typeof vi.fn> };
  };

  beforeEach(() => {
    reflector = { getAllAndOverride: vi.fn() };
    prisma = {
      club: { findUnique: vi.fn() },
      clubGroup: { findUnique: vi.fn() },
      clubMembership: { findUnique: vi.fn() },
    };
    guard = new ClubAccessGuard(prisma as unknown as PrismaService, reflector as unknown as Reflector);
  });

  const createMockContext = (params: Record<string, string>, user?: { id: string }): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ params, user }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  };

  it('should throw UnauthorizedException if user is missing', async () => {
    const context = createMockContext({ id: 'clb-1' }, undefined);
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('should allow access if no club identifiers are in params', async () => {
    const context = createMockContext({}, { id: 'usr-1' });
    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should resolve clubId via groupId for subgroup routes and verify role', async () => {
    reflector.getAllAndOverride.mockReturnValue(['OWNER', 'ADMIN']);
    prisma.clubGroup.findUnique.mockResolvedValue({ clubId: 'clb-1' });
    prisma.clubMembership.findUnique.mockResolvedValue({ role: ClubRole.OWNER });

    const context = createMockContext({ groupId: 'grp-1' }, { id: 'usr-owner' });
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(prisma.clubGroup.findUnique).toHaveBeenCalledWith({
      where: { id: 'grp-1' },
      select: { clubId: true },
    });
    expect(prisma.clubMembership.findUnique).toHaveBeenCalledWith({
      where: { clubId_userId: { clubId: 'clb-1', userId: 'usr-owner' } },
    });
  });

  it('should reject if user does not have sufficient role in parent club', async () => {
    reflector.getAllAndOverride.mockReturnValue(['OWNER', 'ADMIN']);
    prisma.clubGroup.findUnique.mockResolvedValue({ clubId: 'clb-1' });
    prisma.clubMembership.findUnique.mockResolvedValue({ role: ClubRole.MEMBER });

    const context = createMockContext({ groupId: 'grp-1' }, { id: 'usr-member' });
    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException if subgroup does not exist', async () => {
    reflector.getAllAndOverride.mockReturnValue(['OWNER', 'ADMIN']);
    prisma.clubGroup.findUnique.mockResolvedValue(null);

    const context = createMockContext({ groupId: 'invalid-grp' }, { id: 'usr-1' });
    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });
});
