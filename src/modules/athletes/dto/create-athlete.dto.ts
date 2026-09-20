import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FitnessLevel, Gender } from '@prisma/client';
import { IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateAthleteDto {
  @ApiPropertyOptional({
    enum: FitnessLevel,
    default: FitnessLevel.BEGINNER,
    example: FitnessLevel.BEGINNER,
    description: 'Experience level: BEGINNER, INTERMEDIATE, ADVANCED, ELITE',
  })
  @IsEnum(FitnessLevel)
  @IsOptional()
  fitnessLevel?: FitnessLevel;

  @ApiProperty({
    description: 'Date of Birth'
  })
  @IsString()
  @IsNotEmpty()
  dob: string;

  @ApiPropertyOptional({
    description: 'Height in cm'
  })
  @IsNumber()
  @IsOptional()
  heightCm?: number;

  @ApiPropertyOptional({
    description: 'Weight in kg'
  })
  @IsNumber()
  @IsOptional()
  weightKg?: number;
  @ApiPropertyOptional({
    enum: Gender,
    example: Gender.MALE,
    description: 'Gender - MALE, FEMALE, OTHER',
  })
  @IsEnum(Gender)
  @IsOptional()
  gender?: Gender;

  @ApiPropertyOptional({
    example: '6:30',
    description: 'Current comfortable running pace (e.g. "6:30" or 390 seconds/km)',
  })
  @IsOptional()
  currentPace?: string | number;

  @ApiPropertyOptional({
    example: '5:30',
    description: 'Target goal pace (e.g. "5:30" or 330 seconds/km)',
  })
  @IsOptional()
  targetPace?: string | number;

  @ApiPropertyOptional({
    example: 300,
    description: 'Target pace in raw seconds per km (legacy / fallback)',
  })
  @IsInt()
  @Min(120)
  @Max(1200)
  @IsOptional()
  targetPaceSecKm?: number;

  @ApiPropertyOptional({ example: 54.5, description: 'Optional VO2 Max estimate (for advanced runners)' })
  @IsNumber()
  @Min(10)
  @Max(100)
  @IsOptional()
  vo2Max?: number;

  @ApiPropertyOptional({ example: 190, description: 'Optional Maximum Heart Rate (bpm)' })
  @IsInt()
  @Min(100)
  @Max(240)
  @IsOptional()
  maxHr?: number;

  @ApiPropertyOptional({ example: 168, description: 'Optional Lactate Threshold Heart Rate (bpm)' })
  @IsInt()
  @Min(80)
  @Max(220)
  @IsOptional()
  thresholdHr?: number;
}
