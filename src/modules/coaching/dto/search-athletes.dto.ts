import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { FitnessLevel } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class SearchAthletesDto {
    @ApiPropertyOptional({ description: 'Filter by athlete name (case-insensitive partial match)' })
    @IsOptional()
    @IsString()
    name?: string;

    @ApiPropertyOptional({ enum: FitnessLevel, description: 'Filter by fitness level' })
    @IsOptional()
    @IsEnum(FitnessLevel)
    fitnessLevel?: FitnessLevel;

    @ApiPropertyOptional({ description: 'Number of results to return (default: 20, max: 100)' })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    limit?: number;

    @ApiPropertyOptional({ description: 'Number of results to skip for pagination (default: 0)' })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    offset?: number;
}
