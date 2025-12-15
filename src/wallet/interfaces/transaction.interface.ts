export enum TransactionAction {
  FUND = 'FUND', // Initial credit from outside the system
  TRANSFER_OUT = 'TRANSFER_OUT', // Debit to another wallet
  TRANSFER_IN = 'TRANSFER_IN', // Credit from another wallet
}

export interface Transaction {
  id: string; // Unique ID for the transaction record
  walletId: string; // The specific wallet this record belongs to
  action: TransactionAction; // Type of transaction
  amount: number; // The amount (in cents) involved
  timestamp: Date; // When the transaction occurred

  // Optional fields for transfers
  counterpartyWalletId?: string; // ID of the other wallet in a transfer
  transferGroupId?: string; // Links the debit and credit records of a single transfer
}
