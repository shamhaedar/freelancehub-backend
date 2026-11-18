import { Type } from "class-transformer";
import { IsInt, IsNumber, IsPositive, IsString, Max, MaxLength, Min, MinLength } from "class-validator";

export class CreateProjectDto {
    @IsString()
    @MinLength(3)
    @MaxLength(150)
    title:string;

    @IsString()
    @MinLength(10)
    @MaxLength(5000)
    description:string;

    @Type(()=>Number)
    @IsInt()
    @Min(1)
    categoryId:number;

    @Type(()=>Number)
    @IsNumber({ maxDecimalPlaces: 2 })
    @IsPositive()
    @Max(1_000_000)
    budget:number;
}
