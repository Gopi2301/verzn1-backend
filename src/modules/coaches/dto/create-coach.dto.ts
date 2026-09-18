import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class CreateCoachDto {
  @ApiPropertyOptional({ example: 'Certified distance coach with 10+ years experience in marathon training', description: 'Coach biography' })
  @IsString()
  @IsOptional()
  bio?: string;

  @ApiPropertyOptional({ example: ['Marathon', 'Half Marathon', 'VO2 Max Intervals'], description: 'Specialized coaching topics' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  specialties?: string[];

  @ApiPropertyOptional({ example: 'Level 2 USATF / UESCA Certified', description: 'Certification credentials' })
  @IsString()
  @IsOptional()
  certificationLevel?: string;
}
