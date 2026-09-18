import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, Matches } from 'class-validator';

export class CreateClubDto {
  @ApiProperty({ example: 'Metro Striders Running Club', description: 'Name of the running club' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'metro-striders', description: 'Unique URL slug for the club' })
  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'Slug must contain only lowercase alphanumeric characters and hyphens' })
  slug: string;

  @ApiPropertyOptional({ example: 'A community running club open to all distance runners.', description: 'Club description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 'https://example.com/banner.jpg', description: 'Banner image URL' })
  @IsUrl()
  @IsOptional()
  bannerUrl?: string;
}
