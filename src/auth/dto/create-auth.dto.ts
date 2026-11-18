import { IsEmail, IsIn, IsNotEmpty, IsString, MaxLength, MinLength } from "class-validator";
import { UserRole } from "../../common/Enums/index.js";
import { Transform } from "class-transformer";

export class CreateAuthDto {
    @IsEmail()
    @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
    @IsNotEmpty()
    email:string;

    @IsNotEmpty()
    @IsString()
    @MaxLength(100)
    name:string;

    @IsNotEmpty()
    @IsString()
    @MinLength(6)
    @MaxLength(72)
    password: string;

    @IsIn([UserRole.CLIENT, UserRole.FREELANCER])
    role: UserRole.CLIENT | UserRole.FREELANCER;

}
