import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  HttpCode,
} from '@nestjs/common';
import { WalletService } from './wallet.service';
import { CreateWalletDto } from './dto/create-wallet.dto';
import { FundWalletDto } from './dto/fund-wallet.dto';
import { TransferFundsDto } from './dto/transfer-funds.dto';
import { GetIdempKey } from '../common/decorators/idemp-key.decorator';

@Controller('wallets')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Post()
  create(@Body() createWalletDto: CreateWalletDto) {
    return this.walletService.createWallet(createWalletDto);
  }

  @Get(':id')
  getDetails(@Param('id') id: string) {
    return this.walletService.getWalletDetails(id);
  }

  @Patch(':id/fund')
  fund(
    @Param('id') id: string,
    @Body() fundWalletDto: FundWalletDto,
    @GetIdempKey() idempotencyKey?: string,
  ) {
    return this.walletService.fundWallet(id, fundWalletDto, idempotencyKey);
  }

  @Post(':id/transfer')
  @HttpCode(200)
  transfer(
    @Param('id') senderId: string,
    @Body() transferFundsDto: TransferFundsDto,
    @GetIdempKey() idempotencyKey?: string,
  ) {
    return this.walletService.transferFunds(
      senderId,
      transferFundsDto,
      idempotencyKey,
    );
  }
}
