import { Type } from 'class-transformer';
import { IsNumber, IsPositive } from 'class-validator';

export class FundWalletDto {
  @Type(() => Number)
  @IsNumber({}, { message: 'Amount must be a number.' })
  @IsPositive({ message: 'Amount must be positive.' })
  amount: number;
}
