import { Type } from "class-transformer";
import { IsNumber, IsOptional, IsPositive, IsString, Max, MaxLength } from "class-validator";

export class UpdateFreelancerProfileDto {
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    bio?: string;

    @IsOptional()
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 })
    @IsPositive()
    @Max(100000)
    hourlyRate?: number;
}
