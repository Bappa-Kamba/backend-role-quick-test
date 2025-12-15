import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import {
  Wallet,
  Currency,
  WalletDetailsResponse,
  IdempotentResponse,
} from './interfaces/wallet.interface';
import {
  Transaction,
  TransactionAction,
} from './interfaces/transaction.interface';
import { CreateWalletDto } from './dto/create-wallet.dto';
import { FundWalletDto } from './dto/fund-wallet.dto';
import { TransferFundsDto } from './dto/transfer-funds.dto';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  // In-memory storage: Wallet ID -> Wallet Object
  private wallets: Map<string, Wallet> = new Map();
  // In-memory storage: Wallet ID -> Array of Transactions
  private transactionHistory: Map<string, Transaction[]> = new Map();
  // In-memory storage for idempotent requests: Idempotency Key -> Response
  private idempotentStore: Map<string, IdempotentResponse> = new Map();

  /**
   * Creates a new wallet with an initial balance of 0 (in cents).
   * @param createWalletDto The DTO containing optional currency preference.
   * @returns The newly created Wallet object.
   */
  public createWallet(createWalletDto: CreateWalletDto): Wallet {
    const newWallet: Wallet = {
      id: uuid(),
      balance: 0, // Initial balance in cents
      currency: createWalletDto.currency || Currency.USD,
    };

    this.wallets.set(newWallet.id, newWallet);
    this.transactionHistory.set(newWallet.id, []);

    this.logger.log(`Created new wallet with ID: ${newWallet.id}`);

    return newWallet;
  }

  /**
   * Funds a specified wallet by adding a positive amount to its balance.
   * @param walletId The ID of the wallet to fund.
   * @param fundWalletDto The DTO containing the positive amount.
   * @returns The updated Wallet object.
   */
  public fundWallet(
    walletId: string,
    fundWalletDto: FundWalletDto,
    idempotencyKey?: string,
  ): {
    message: string;
    id: string;
    currency: Currency;
    balance: number;
  } {
    const cachedResult = this.checkIdempotency(idempotencyKey);
    if (cachedResult) {
      return cachedResult;
    }

    const { amount } = fundWalletDto;

    const wallet = this.wallets.get(walletId);

    if (!wallet) {
      throw new NotFoundException(`Wallet with ID "${walletId}" not found.`);
    }

    const amountInCents = amount * 100;
    // Atomic Balance Update
    wallet.balance += amountInCents;

    // Record Transaction History
    const transaction: Transaction = {
      id: uuid(),
      walletId: walletId,
      action: TransactionAction.FUND,
      amount: amount,
      timestamp: new Date(),
    };
    this.transactionHistory.get(walletId).push(transaction);

    this.logger.log(
      `Funded wallet ID: ${walletId} with amount: ${amount} cents`,
    );

    const result = {
      message: 'Transaction successful',
      ...wallet,
      balance: wallet.balance / 100,
    };

    this.storeIdempotencyResult(idempotencyKey, result);
    return result;
  }

  /**
   * Transfers funds between two wallets, ensuring atomicity and validation.
   * @param senderWalletId The ID of the wallet sending the funds.
   * @param transferFundsDto The DTO containing the receiver ID and amount.
   * @returns An object containing the updated sender and receiver Wallets.
   */
  public transferFunds(
    senderWalletId: string,
    transferFundsDto: TransferFundsDto,
    idempotencyKey?: string,
  ): { message: string; sender: Wallet; receiver: Wallet } {
    const cachedResult = this.checkIdempotency(idempotencyKey);
    if (cachedResult) {
      return cachedResult;
    }

    const { receiverWalletId, amount } = transferFundsDto;

    // Validation checks
    if (senderWalletId === receiverWalletId) {
      throw new ConflictException('Cannot transfer funds to the same wallet.');
    }

    const senderWallet = this.wallets.get(senderWalletId);
    const receiverWallet = this.wallets.get(receiverWalletId);

    if (!senderWallet) {
      throw new NotFoundException('Sender wallet not found.');
    }

    if (!receiverWallet) {
      throw new NotFoundException('Receiver wallet not found.');
    }

    if (senderWallet.currency !== receiverWallet.currency) {
      throw new BadRequestException(
        'Transfer between different currencies is not supported.',
      );
    }

    const senderBalance = senderWallet.balance / 100;
    if (senderBalance < amount) {
      throw new BadRequestException('Insufficient balance in sender wallet.');
    }

    const amountInCents = amount * 100;

    // Atomic State Update
    senderWallet.balance -= amountInCents;
    receiverWallet.balance += amountInCents;

    // Record Transactions
    const transferGroupId = uuid();

    const senderTx: Transaction = {
      id: uuid(),
      walletId: senderWalletId,
      action: TransactionAction.TRANSFER_OUT,
      amount: amount,
      timestamp: new Date(),
      counterpartyWalletId: receiverWalletId,
      transferGroupId,
    };
    this.transactionHistory.get(senderWalletId).push(senderTx);

    const receiverTx: Transaction = {
      id: uuid(),
      walletId: receiverWalletId,
      action: TransactionAction.TRANSFER_IN,
      amount: amount,
      timestamp: new Date(),
      counterpartyWalletId: senderWalletId,
      transferGroupId,
    };
    this.transactionHistory.get(receiverWalletId).push(receiverTx);

    this.logger.log(
      `Transferred ${amount} from wallet ID: ${senderWalletId} to wallet ID: ${receiverWalletId}`,
    );

    // Return updated wallets with balance in main currency unit
    const result = {
      message: 'Transaction successful',
      sender: {
        ...senderWallet,
        balance: senderWallet.balance / 100,
      },
      receiver: {
        ...receiverWallet,
        balance: receiverWallet.balance / 100,
      },
    };

    this.storeIdempotencyResult(idempotencyKey, result);
    return result;
  }

  /**
   * Retrieves a wallet and its full transaction history.
   * @param walletId The ID of the wallet to fetch.
   * @returns The WalletDetailsResponse object.
   */
  public getWalletDetails(walletId: string): WalletDetailsResponse {
    const wallet = this.wallets.get(walletId);

    if (!wallet) {
      throw new NotFoundException(`Wallet with ID "${walletId}" not found.`);
    }

    const history = this.transactionHistory.get(walletId) || [];

    this.logger.log(
      `Fetched details for wallet: ${JSON.stringify(wallet, null, 2)}`,
    );

    return {
      ...wallet,
      balance: wallet.balance / 100, // Convert back to main currency unit
      transactionHistory: history,
    };
  }

  /**
   * Checks if an idempotent key exists and returns the cached result if found.
   * If found, the service method returns this value immediately.
   * @param idempotencyKey The key provided by the client.
   * @returns The cached response body, or undefined if the key is new.
   */
  private checkIdempotency(
    idempotencyKey: string | undefined,
  ): any | undefined {
    if (idempotencyKey && this.idempotentStore.has(idempotencyKey)) {
      console.log(
        `[Idempotency] Returning cached response for key: ${idempotencyKey}`,
      );
      return this.idempotentStore.get(idempotencyKey).body;
    }
    return undefined;
  }

  /**
   * Stores the successful result of an idempotent operation.
   * @param idempotencyKey The key provided by the client.
   * @param result The successful response body to cache.
   */
  private storeIdempotencyResult(
    idempotencyKey: string | undefined,
    result: any,
  ): void {
    if (idempotencyKey) {
      this.idempotentStore.set(idempotencyKey, { body: result });
    }
  }
}
