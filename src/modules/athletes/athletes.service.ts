import { Injectable, NotFoundException } from '@nestjs/common';
import { FitnessLevel } from '@prisma/client';
import { formatSecondsToPace, parsePaceToSeconds } from '../../common/utils/pace.util.js';
import { PrismaService } from '../../database/prisma.service.js';
import { CreateAthleteDto } from './dto/create-athlete.dto.js';

@Injectable()
export class AthletesService {
  constructor(private prisma: PrismaService) {}

  private formatAthleteResponse<T extends { currentPaceSecKm?: number | null; targetPaceSecKm?: number | null }>(
    athlete: T,
  ) {
    return {
      ...athlete,
      formattedCurrentPace: formatSecondsToPace(athlete.currentPaceSecKm),
      formattedTargetPace: formatSecondsToPace(athlete.targetPaceSecKm),
    };
  }

  async createOrUpdate(userId: string, dto: CreateAthleteDto) {
    const currentPaceSec = parsePaceToSeconds(dto.currentPace);
    const targetPaceSec = parsePaceToSeconds(dto.targetPace) ?? dto.targetPaceSecKm;

    const record = await this.prisma.athlete.upsert({
      where: { userId },
      create: {
        userId,
        fitnessLevel: dto.fitnessLevel || FitnessLevel.BEGINNER,
        currentPaceSecKm: currentPaceSec,
        targetPaceSecKm: targetPaceSec,
        vo2Max: dto.vo2Max,
        maxHr: dto.maxHr,
        thresholdHr: dto.thresholdHr,
      },
      update: {
        ...(dto.fitnessLevel !== undefined && { fitnessLevel: dto.fitnessLevel }),
        ...(currentPaceSec !== null && { currentPaceSecKm: currentPaceSec }),
        ...(targetPaceSec !== null && { targetPaceSecKm: targetPaceSec }),
        ...(dto.vo2Max !== undefined && { vo2Max: dto.vo2Max }),
        ...(dto.maxHr !== undefined && { maxHr: dto.maxHr }),
        ...(dto.thresholdHr !== undefined && { thresholdHr: dto.thresholdHr }),
      },
      include: { user: true },
    });

    return this.formatAthleteResponse(record);
  }

  async findByUserId(userId: string) {
    const athlete = await this.prisma.athlete.findUnique({
      where: { userId },
      include: { user: true },
    });
    if (!athlete) {
      throw new NotFoundException(`Athlete profile for user ${userId} not found`);
    }
    return this.formatAthleteResponse(athlete);
  }

  async findById(id: string) {
    const athlete = await this.prisma.athlete.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!athlete) {
      throw new NotFoundException(`Athlete with ID ${id} not found`);
    }
    return this.formatAthleteResponse(athlete);
  }
}
