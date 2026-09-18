import { ApiPropertyOptional } from '@nestjs/swagger';
import { ClubRole } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class JoinClubDto {
  @ApiPropertyOptional({ enum: ClubRole, default: ClubRole.MEMBER, description: 'Requested membership role' })
  @IsEnum(ClubRole)
  @IsOptional()
  role?: ClubRole = ClubRole.MEMBER;
}
