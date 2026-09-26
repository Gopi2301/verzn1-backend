import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ClubGroupType } from '@prisma/client';
import { IsArray, IsEnum, IsOptional, IsString, IsUrl, Matches } from 'class-validator';

export class CreateClubGroupDto {
  @ApiProperty({ example: 'Couch to 5K', description: 'Name of the sub-training group' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'couch-to-5k', description: 'Unique URL slug for the group (auto-generated if omitted)' })
  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'Slug must contain only lowercase alphanumeric characters and hyphens' })
  @IsOptional()
  slug?: string;

  @ApiPropertyOptional({ example: 'Beginner running program designed for new runners.', description: 'Group description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 'https://example.com/banner.jpg', description: 'Group banner image URL' })
  @IsUrl()
  @IsOptional()
  bannerUrl?: string;

  @ApiPropertyOptional({
    enum: ClubGroupType,
    isArray: true,
    example: [ClubGroupType.DISTANCE, ClubGroupType.ACTIVITY],
    description: 'Group classification types: PACE, DISTANCE, ACTIVITY, GENERAL',
  })
  @IsArray()
  @IsEnum(ClubGroupType, { each: true })
  @IsOptional()
  types?: ClubGroupType[];
}