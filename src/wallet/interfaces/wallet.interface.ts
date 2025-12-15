import { Transaction } from './transaction.interface';

export enum Currency {
  USD = 'USD',
  NGN = 'NGN',
  GBP = 'GBP',
}

export interface Wallet {
  id: string;
  currency: Currency;
  balance: number;
}

// Data structure for the response DTO when fetching details
export interface WalletDetailsResponse extends Wallet {
  transactionHistory: Transaction[];
}

// Data structure for the stored idempotent response
export interface IdempotentResponse {
  body: any;
}
