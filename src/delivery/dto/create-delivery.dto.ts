import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class CreateDeliveryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  projectId: number;
}
