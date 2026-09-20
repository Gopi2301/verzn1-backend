import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class SearchCoachesDto {
    @ApiPropertyOptional({ description: 'Filter by coach name (case-insensitive partial match)' })
    @IsOptional()
    @IsString()
    name?: string;

    @ApiPropertyOptional({ description: 'Filter by specialty (e.g. "running", "strength")' })
    @IsOptional()
    @IsString()
    specialty?: string;

    @ApiPropertyOptional({ description: 'Filter by certification level' })
    @IsOptional()
    @IsString()
    certificationLevel?: string;

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
