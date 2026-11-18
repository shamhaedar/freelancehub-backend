import { Transform, Type } from "class-transformer";
import { IsInt, IsNumber, IsPositive, IsString, Max, MaxLength, Min, MinLength } from "class-validator";

export class CreateProposalDto {
    @Type(() => Number)
    @IsInt()
    @Min(1)
    projectId:number;

    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 })
    @IsPositive()
    @Max(1_000_000)
    price:number;

    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(365)
    durationDays:number;

    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    @IsString()
    @MinLength(3)
    @MaxLength(1000)
    message:string;
}
