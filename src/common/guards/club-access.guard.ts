import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClubRole } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';

@Injectable()
export class ClubAccessGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<(ClubRole | string)[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]) || [ClubRole.OWNER, ClubRole.ADMIN];

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.id) {
      throw new UnauthorizedException('User authentication required');
    }

    const clubId = request.params.id || request.params.clubId;
    const slug = request.params.slug;
    const groupId = request.params.groupId;

    if (!clubId && !slug && !groupId) {
      return true;
    }

    let targetClubId = clubId;
    if (!targetClubId && slug) {
      const club = await this.prisma.club.findUnique({
        where: { slug },
        select: { id: true },
      });
      if (!club) {
        throw new ForbiddenException(`Club with slug '${slug}' not found`);
      }
      targetClubId = club.id;
    } else if (!targetClubId && groupId) {
      const group = await this.prisma.clubGroup.findUnique({
        where: { id: groupId },
        select: { clubId: true },
      });
      if (!group) {
        throw new ForbiddenException(`Subgroup with ID '${groupId}' not found`);
      }
      targetClubId = group.clubId;
    }

    const membership = await this.prisma.clubMembership.findUnique({
      where: {
        clubId_userId: {
          clubId: targetClubId,
          userId: user.id,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this club');
    }

    const allowedRoleStrings = requiredRoles.map((r) => String(r).toUpperCase());
    const userClubRole = String(membership.role).toUpperCase();

    if (!allowedRoleStrings.includes(userClubRole)) {
      throw new ForbiddenException(`Requires club role: ${allowedRoleStrings.join(', ')}`);
    }

    return true;
  }
}