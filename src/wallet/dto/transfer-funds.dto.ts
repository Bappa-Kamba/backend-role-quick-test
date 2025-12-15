import { Type } from 'class-transformer';
import { IsPositive, IsUUID, IsNotEmpty, IsNumber } from 'class-validator';

export class TransferFundsDto {
  @IsUUID('4', { message: 'Receiver wallet ID must be a valid UUID.' })
  @IsNotEmpty()
  receiverWalletId: string;

  @Type(() => Number)
  @IsNumber({}, { message: 'Amount must be a number.' })
  @IsPositive({ message: 'Amount must be positive.' })
  amount: number;
}
