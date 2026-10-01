import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ClubGroupStatus, ClubRole } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import { CreateClubDto } from './dto/create-club.dto.js';
import { CreateClubGroupDto } from './dto/create-group.dto.js';
import { JoinClubDto } from './dto/join-club.dto.js';
import { UpdateClubDto } from './dto/update-club.dto.js';
import { UpdateClubGroupDto } from './dto/update-group.dto.js';

@Injectable()
export class ClubsService {
  constructor(private prisma: PrismaService) { }

  // ---------------------------------------------------------------------------
  // CLUB CRUD & MEMBERSHIP
  // ---------------------------------------------------------------------------

  async create(ownerUserId: string, dto: CreateClubDto) {
    const existingSlug = await this.prisma.club.findUnique({
      where: { slug: dto.slug },
    });
    if (existingSlug) {
      throw new ConflictException(`Club with slug '${dto.slug}' already exists`);
    }

    return this.prisma.club.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        bannerUrl: dto.bannerUrl,
        memberships: {
          create: {
            userId: ownerUserId,
            role: ClubRole.OWNER,
          },
        },
      },
      include: { memberships: { include: { user: true } } },
    });
  }

  async findAll() {
    return this.prisma.club.findMany({
      include: {
        _count: { select: { memberships: true, groups: true } },
      },
    });
  }

  async findBySlug(slug: string) {
    const club = await this.prisma.club.findUnique({
      where: { slug },
      include: {
        memberships: {
          include: { user: true },
        },
        groups: true,
        _count: { select: { memberships: true, groups: true } },
      },
    });
    if (!club) {
      throw new NotFoundException(`Club with slug '${slug}' not found`);
    }
    return club;
  }

  async findById(id: string) {
    const club = await this.prisma.club.findUnique({
      where: { id },
      include: {
        memberships: {
          include: { user: true },
        },
        groups: true,
        _count: { select: { memberships: true, groups: true } },
      },
    });
    if (!club) {
      throw new NotFoundException(`Club with ID '${id}' not found`);
    }
    return club;
  }

  async update(id: string, dto: UpdateClubDto) {
    await this.findById(id);
    return this.prisma.club.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.bannerUrl !== undefined && { bannerUrl: dto.bannerUrl }),
      },
    });
  }

  async delete(id: string) {
    await this.findById(id);
    return this.prisma.club.delete({
      where: { id },
    });
  }

  async joinClub(clubId: string, userId: string, dto: JoinClubDto) {
    await this.findById(clubId);

    if (dto?.role && dto.role !== ClubRole.MEMBER) {
      throw new ForbiddenException(
        'Members cannot self-assign privileged roles (OWNER, ADMIN, COACH, CAPTAIN) when joining a club',
      );
    }

    return this.prisma.clubMembership.upsert({
      where: {
        clubId_userId: { clubId, userId },
      },
      create: {
        clubId,
        userId,
        role: ClubRole.MEMBER,
      },
      update: {},
      include: { club: true, user: true },
    });
  }

  async leaveClub(clubId: string, userId: string) {
    await this.findById(clubId);
    const membership = await this.prisma.clubMembership.findUnique({
      where: { clubId_userId: { clubId, userId } },
    });
    if (!membership) {
      throw new NotFoundException('You are not a member of this club');
    }
    return this.prisma.clubMembership.delete({
      where: { clubId_userId: { clubId, userId } },
    });
  }

  async getMembers(clubId: string) {
    await this.findById(clubId);
    return this.prisma.clubMembership.findMany({
      where: { clubId },
      include: { user: true },
    });
  }

  async myClubs(userId: string) {
    return this.prisma.clubMembership.findMany({
      where: { userId },
      include: {
        club: {
          include: {
            _count: { select: { memberships: true, groups: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ---------------------------------------------------------------------------
  // SUBGROUPS & MULTI-SUBGROUP MEMBERSHIP
  // ---------------------------------------------------------------------------

  async createGroup(clubId: string, userId: string, dto: CreateClubGroupDto) {
    await this.findById(clubId);

    const generatedSlug =
      dto.slug ||
      dto.name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

    const existingSlug = await this.prisma.clubGroup.findUnique({
      where: { slug: generatedSlug },
    });
    if (existingSlug) {
      throw new ConflictException(`Group with slug '${generatedSlug}' already exists`);
    }

    return this.prisma.clubGroup.create({
      data: {
        clubId,
        name: dto.name,
        slug: generatedSlug,
        description: dto.description,
        bannerUrl: dto.bannerUrl,
        types: dto.types || undefined,
        status: ClubGroupStatus.ACTIVE,
        memberships: {
          create: {
            userId,
            joinedAt: new Date(),
          },
        },
      },
      include: {
        memberships: {
          include: { user: true },
        },
      },
    });
  }

  async getClubGroups(clubId: string, includeArchived = false) {
    await this.findById(clubId);
    return this.prisma.clubGroup.findMany({
      where: {
        clubId,
        ...(!includeArchived && { status: ClubGroupStatus.ACTIVE }),
      },
      include: {
        _count: {
          select: {
            memberships: {
              where: { leftAt: null },
            },
          },
        },
      },
    });
  }

  async getGroupById(groupId: string) {
    const group = await this.prisma.clubGroup.findUnique({
      where: { id: groupId },
      include: {
        club: true,
        memberships: {
          where: { leftAt: null },
          include: { user: true },
        },
      },
    });
    if (!group) {
      throw new NotFoundException(`Group with ID '${groupId}' not found`);
    }
    return group;
  }

  async updateGroup(groupId: string, dto: UpdateClubGroupDto) {
    await this.getGroupById(groupId);
    return this.prisma.clubGroup.update({
      where: { id: groupId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.bannerUrl !== undefined && { bannerUrl: dto.bannerUrl }),
        ...(dto.types !== undefined && { types: dto.types }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
    });
  }

  async archiveGroup(groupId: string) {
    await this.getGroupById(groupId);
    return this.prisma.clubGroup.update({
      where: { id: groupId },
      data: { status: ClubGroupStatus.ARCHIVED },
    });
  }

  async deleteGroup(groupId: string) {
    await this.getGroupById(groupId);
    return this.prisma.clubGroup.delete({
      where: { id: groupId },
    });
  }

  async joinGroup(groupId: string, userId: string) {
    const group = await this.getGroupById(groupId);

    // Verify user is a member of the parent club
    const clubMembership = await this.prisma.clubMembership.findUnique({
      where: { clubId_userId: { clubId: group.clubId, userId } },
    });
    if (!clubMembership) {
      throw new ForbiddenException('Must be a member of the club to join this subgroup');
    }

    // Upsert group membership: if re-joining, reset leftAt to null and update joinedAt
    return this.prisma.clubGroupMembership.upsert({
      where: {
        groupId_userId: { groupId, userId },
      },
      create: {
        groupId,
        userId,
        joinedAt: new Date(),
        leftAt: null,
      },
      update: {
        joinedAt: new Date(),
        leftAt: null,
      },
      include: { group: true, user: true },
    });
  }

  async leaveGroup(groupId: string, userId: string) {
    const membership = await this.prisma.clubGroupMembership.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (!membership || membership.leftAt !== null) {
      throw new NotFoundException('You are not an active member of this group');
    }

    // Mark leftAt timestamp to preserve point-in-time leaderboard accuracy
    return this.prisma.clubGroupMembership.update({
      where: { groupId_userId: { groupId, userId } },
      data: { leftAt: new Date() },
    });
  }

  async getGroupMembers(groupId: string) {
    await this.getGroupById(groupId);
    return this.prisma.clubGroupMembership.findMany({
      where: { groupId, leftAt: null },
      include: { user: true },
    });
  }

  async getMyGroups(userId: string) {
    return this.prisma.clubGroupMembership.findMany({
      where: { userId, leftAt: null },
      include: { group: { include: { club: true } } },
    });
  }
}
