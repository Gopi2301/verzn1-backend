import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class SignInDto {
    @ApiProperty({
        example: 'john.doe@example.com',
        required: true,
        description: 'Email of the user'
    })
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @ApiProperty({
        example: 'password123',
        required: true,
        description: 'Password of the user'
    })
    @IsString()
    @IsNotEmpty()
    password: string;
}