import { Test, TestingModule } from '@nestjs/testing';
import { WalletService } from './wallet.service';
import { FundWalletDto } from './dto/fund-wallet.dto';
import { CreateWalletDto } from './dto/create-wallet.dto';
import { NotFoundException } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { TransferFundsDto } from './dto/transfer-funds.dto';

describe('WalletService - Fund Operations', () => {
  let service: WalletService;
  let walletId: string;
  let createDto: CreateWalletDto;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WalletService],
    }).compile();

    service = module.get<WalletService>(WalletService);

    // Setup a clean wallet for each test
    createDto = { currency: 'USD' } as CreateWalletDto;
    const newWallet = service.createWallet(createDto);
    walletId = newWallet.id;
  });

  // Helper function to get the current transaction history for a wallet
  const getHistory = (id: string) => {
    // Accessing the private property for testing purposes
    return (service as any).transactionHistory.get(id);
  };

  // --- Test Case 1: Successful Funding ---
  it('should successfully fund a wallet and record a transaction', () => {
    const fundDto: FundWalletDto = { amount: 50 };
    const initialBalance = service.getWalletDetails(walletId).balance;

    const updatedWallet = service.fundWallet(walletId, fundDto);

    // 1. Check Balance Update
    expect(updatedWallet.balance).toBe(initialBalance + fundDto.amount);

    // 2. Check Transaction History
    const history = getHistory(walletId);
    expect(history.length).toBe(1);
    expect(history[0].action).toBe('FUND');
    expect(history[0].amount).toBe(fundDto.amount);
  });

  // --- Test Case 2: Failure (Wallet Not Found) ---
  it('should throw NotFoundException if wallet does not exist', () => {
    const fundDto: FundWalletDto = { amount: 100 };
    const fakeId = uuid();

    // Expect the service method to throw the correct exception
    expect(() => service.fundWallet(fakeId, fundDto)).toThrow(
      NotFoundException,
    );
  });

  // --- Test Case 3: Idempotency Check ---
  it('should execute only once when the same idempotency key is used', () => {
    const fundDto: FundWalletDto = { amount: 100 };
    const idempotencyKey = uuid();
    const initialBalance = service.getWalletDetails(walletId).balance;
    const initialHistoryLength = getHistory(walletId).length;

    // 1. First Execution (Should succeed and update state)
    const firstResult = service.fundWallet(walletId, fundDto, idempotencyKey);

    // Verify state change
    expect(firstResult.balance).toBe(initialBalance + 100);
    expect(getHistory(walletId).length).toBe(initialHistoryLength + 1);

    // 2. Second Execution with the SAME Key (Should use cached result)
    const secondResult = service.fundWallet(walletId, fundDto, idempotencyKey);

    // Verify result is the same as the first one
    expect(secondResult).toEqual(firstResult);

    // Verify state HAS NOT changed again (critical check)
    // Balance should still be the initial balance + 1000, not + 2000
    expect(service.getWalletDetails(walletId).balance).toBe(
      initialBalance + 100,
    );
    // History should still only have 1 new entry
    expect(getHistory(walletId).length).toBe(initialHistoryLength + 1);
  });
});

describe('WalletService - Transfer Operations', () => {
  let service: WalletService;
  let walletAId: string;
  let walletBId: string;
  let initialFundAmount = 1000;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WalletService],
    }).compile();

    service = module.get<WalletService>(WalletService);

    // Setup two wallets (A and B) and fund A for testing
    const walletA = service.createWallet({
      currency: 'USD',
    } as CreateWalletDto);
    walletAId = walletA.id;
    const walletB = service.createWallet({
      currency: 'USD',
    } as CreateWalletDto);
    walletBId = walletB.id;

    // Fund Wallet A
    service.fundWallet(walletAId, { amount: initialFundAmount });
  });

  // Helper function to get the current wallet balance
  const getBalance = (id: string) => service.getWalletDetails(id).balance;
  // Helper function to get the current transaction history for a wallet
  const getHistory = (id: string) =>
    (service as any).transactionHistory.get(id);

  // --- Test Case 1: Successful Transfer ---
  it('should successfully transfer funds and update both balances/histories', () => {
    const transferAmount = 500;
    const transferDto: TransferFundsDto = {
      receiverWalletId: walletBId,
      amount: transferAmount,
    };

    const result = service.transferFunds(walletAId, transferDto);

    // 1. Check Balances
    expect(result.sender.balance).toBe(initialFundAmount - transferAmount);
    expect(result.receiver.balance).toBe(transferAmount);

    // Verify state integrity via separate lookups
    expect(getBalance(walletAId)).toBe(initialFundAmount - transferAmount);
    expect(getBalance(walletBId)).toBe(transferAmount);

    // 2. Check Transaction History (A should have FUND and TRANSFER_OUT)
    const historyA = getHistory(walletAId);
    const historyB = getHistory(walletBId);

    expect(historyA.length).toBe(2);
    expect(historyA[1].action).toBe('TRANSFER_OUT');

    expect(historyB.length).toBe(1); // Wallet B was not funded, only transferred in
    expect(historyB[0].action).toBe('TRANSFER_IN');
    expect(historyA[1].transferGroupId).toBe(historyB[0].transferGroupId); // Check atomicity link
  });

  // --- Test Case 2: Failure (Insufficient Balance) ---
  it('should throw BadRequestException for insufficient funds', () => {
    const transferAmount = initialFundAmount + 1; // More than initial 1000
    const transferDto: TransferFundsDto = {
      receiverWalletId: walletBId,
      amount: transferAmount,
    };

    // Expect transfer to fail
    expect(() => service.transferFunds(walletAId, transferDto)).toThrow(
      BadRequestException,
    );

    // Check for atomicity (balances must NOT have changed)
    expect(getBalance(walletAId)).toBe(initialFundAmount);
    expect(getBalance(walletBId)).toBe(0);
  });

  // --- Test Case 3: Failure (Self-Transfer) ---
  it('should throw ConflictException for self-transfer', () => {
    const transferDto: TransferFundsDto = {
      receiverWalletId: walletAId,
      amount: 100,
    };

    expect(() => service.transferFunds(walletAId, transferDto)).toThrow(
      ConflictException,
    );
  });

  // --- Test Case 4: Idempotency Check ---
  it('should execute a transfer only once with the same idempotency key', () => {
    const transferAmount = 100;
    const idempotencyKey = uuid();
    const initialBalanceA = getBalance(walletAId); // 1000
    const initialBalanceB = getBalance(walletBId); // 0

    // 1. First Execution
    const firstResult = service.transferFunds(
      walletAId,
      { receiverWalletId: walletBId, amount: transferAmount },
      idempotencyKey,
    );

    // Verify state change
    expect(firstResult.sender.balance).toBe(initialBalanceA - transferAmount); // 900
    expect(firstResult.receiver.balance).toBe(initialBalanceB + transferAmount); // 100

    // 2. Second Execution with the SAME Key (Should return cached result)
    const secondResult = service.transferFunds(
      walletAId,
      { receiverWalletId: walletBId, amount: transferAmount },
      idempotencyKey,
    );

    // Verify result is cached
    expect(secondResult).toEqual(firstResult);

    // Verify state HAS NOT changed again (critical check)
    expect(getBalance(walletAId)).toBe(initialBalanceA - transferAmount); // Still 900, not 800
    expect(getBalance(walletBId)).toBe(initialBalanceB + transferAmount); // Still 100, not 200

    // Check transaction history length (only one set of debit/credit)
    expect(getHistory(walletAId).length).toBe(2); // Initial FUND + 1 TRANSFER_OUT
    expect(getHistory(walletBId).length).toBe(1); // 1 TRANSFER_IN
  });
});
