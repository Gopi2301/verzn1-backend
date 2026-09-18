import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from "class-validator";
import { Roles } from "../../common/enums/user-role.enum.js";

export class SignUpDto {
    @ApiProperty({
        example: "John",
        required: true,
        description: "First name of the user",
    })
    @IsString()
    @IsNotEmpty()
    firstName: string;

    @ApiProperty({
        example: "Doe",
        required: true,
        description: "Last name of the user",
    })
    @IsString()
    @IsOptional()
    lastName: string;

    @ApiProperty({
        example: "john.doe@example.com",
        required: true,
        description: "Email of the user",
    })
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @ApiProperty({
        example: "password123",
        required: true,
        description: "Password of the user",
    })
    @IsString()
    @IsNotEmpty()
    @MinLength(6)
    password: string;

    @ApiProperty({
        example: "1234567890",
        required: true,
        description: "Phone number of the user",
    })
    @IsString()
    @IsNotEmpty()
    phone: string;

    @ApiProperty({
        enum: Roles,
        example: Roles.USER,
        required: false,
        description: "Role of the user",
        default: Roles.USER,
    })
    @IsEnum(Roles)
    @IsOptional()
    role?: Roles;
}