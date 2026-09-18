import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ClubRole } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import { CreateClubDto } from './dto/create-club.dto.js';
import { JoinClubDto } from './dto/join-club.dto.js';
import { UpdateClubDto } from './dto/update-club.dto.js';

@Injectable()
export class ClubsService {
  constructor(private prisma: PrismaService) {}

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
        _count: { select: { memberships: true } },
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

    return this.prisma.clubMembership.upsert({
      where: {
        clubId_userId: { clubId, userId },
      },
      create: {
        clubId,
        userId,
        role: dto.role || ClubRole.MEMBER,
      },
      update: {
        role: dto.role || ClubRole.MEMBER,
      },
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
}
