import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { CreateCoachDto } from './dto/create-coach.dto.js';

@Injectable()
export class CoachesService {
  constructor(private prisma: PrismaService) {}

  async createOrUpdate(userId: string, dto: CreateCoachDto) {
    return this.prisma.coach.upsert({
      where: { userId },
      create: {
        userId,
        bio: dto.bio,
        specialties: dto.specialties || [],
        certificationLevel: dto.certificationLevel,
      },
      update: {
        ...(dto.bio !== undefined && { bio: dto.bio }),
        ...(dto.specialties !== undefined && { specialties: dto.specialties }),
        ...(dto.certificationLevel !== undefined && { certificationLevel: dto.certificationLevel }),
      },
      include: { user: true },
    });
  }

  async findByUserId(userId: string) {
    const coach = await this.prisma.coach.findUnique({
      where: { userId },
      include: { user: true },
    });
    if (!coach) {
      throw new NotFoundException(`Coach profile for user ${userId} not found`);
    }
    return coach;
  }

  async findById(id: string) {
    const coach = await this.prisma.coach.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!coach) {
      throw new NotFoundException(`Coach with ID ${id} not found`);
    }
    return coach;
  }
}
