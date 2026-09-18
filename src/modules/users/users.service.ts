import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { CreateUserDto } from './dto/create-user.dto.js';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateUserDto) {
    const fullName = [data.firstName, data.lastName].filter(Boolean).join(' ') || null;
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: data.email }, { id: data.userId }],
      },
    });

    if (existing) {
      return this.prisma.user.update({
        where: { id: existing.id },
        data: {
          fullName: fullName || existing.fullName,
        },
      });
    }

    return this.prisma.user.create({
      data: {
        id: data.userId,
        email: data.email,
        fullName,
      },
    });
  }

  async findOrCreate(id: string, email: string, fullName?: string) {
    let user = await this.prisma.user.findUnique({
      where: { id },
      include: { athlete: true, coach: true, memberships: true },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          id,
          email,
          fullName: fullName || null,
        },
        include: { athlete: true, coach: true, memberships: true },
      });
    }

    return user;
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { athlete: true, coach: true, memberships: true },
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findById(id);
    return this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.fullName !== undefined && { fullName: dto.fullName }),
        ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl }),
      },
    });
  }
}
