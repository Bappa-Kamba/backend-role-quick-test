import { IsEnum, IsOptional } from 'class-validator';
import { Currency } from '../interfaces/wallet.interface';

export class CreateWalletDto {
  @IsOptional()
  @IsEnum(Currency, { message: 'Unsupported currency.' })
  currency: Currency = Currency.USD; // Default to USD as per requirement
}
