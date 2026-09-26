import { ApiPropertyOptional } from '@nestjs/swagger';
import { ClubGroupStatus, ClubGroupType } from '@prisma/client';
import { IsArray, IsEnum, IsOptional, IsString, IsUrl } from 'class-validator';

export class UpdateClubGroupDto {
  @ApiPropertyOptional({ example: 'Couch to 5K - Fall Cohort', description: 'Updated group name' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 'Updated group description', description: 'Updated group description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 'https://example.com/new-banner.jpg', description: 'Updated group banner image URL' })
  @IsUrl()
  @IsOptional()
  bannerUrl?: string;

  @ApiPropertyOptional({
    enum: ClubGroupType,
    isArray: true,
    example: [ClubGroupType.DISTANCE],
    description: 'Updated group classification types',
  })
  @IsArray()
  @IsEnum(ClubGroupType, { each: true })
  @IsOptional()
  types?: ClubGroupType[];

  @ApiPropertyOptional({
    enum: ClubGroupStatus,
    example: ClubGroupStatus.ARCHIVED,
    description: 'Group status: ACTIVE or ARCHIVED',
  })
  @IsEnum(ClubGroupStatus)
  @IsOptional()
  status?: ClubGroupStatus;
}
