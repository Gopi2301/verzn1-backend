import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, MinLength } from 'class-validator';

export class UpdateClubDto {
  @ApiPropertyOptional({ example: 'Bengaluru Runners Club', description: 'Updated name of the running club' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  name?: string;

  @ApiPropertyOptional({ example: 'The premier distance running group in the city.', description: 'Updated description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'https://images.unsplash.com/photo-banner.jpg', description: 'Updated banner image URL' })
  @IsOptional()
  @IsUrl()
  bannerUrl?: string;
}
