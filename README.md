# 🏦 NestJS Wallet Service Take-Home Test

This project implements a simple wallet service API using NestJS and TypeScript. It adheres strictly to the requirements, focusing on a clean structure, correctness, and avoiding overengineering by utilizing in-memory storage for data.

## 🚀 Setup Instructions

### Prerequisites

* Node.js (v18+)
* Nest CLI

### Installation

1.  **Clone the repository:**
    [Repo](https://github.com/Bappa-Kamba/backend-role-quick-test.git)
    ```bash
    git clone https://github.com/Bappa-Kamba/backend-role-quick-test.git
    ```
2.  **Install dependencies:**
    ```bash
    pnpm install (or any package manager of your choosing; npm, yarn)
    ```
3.  **Run the application (Development Mode):**
    ```bash
    pnpm run start:dev
    ```
    The API will be available at `http://localhost:3000`.

### 🧪 Running Unit Tests

The service includes unit tests for the core business logic (`fundWallet`, `transferFunds`, and idempotency) to ensure balance integrity and error handling.

To run the tests:

```bash
# Run all tests once
npm run test 

# Run tests in watch mode (helpful during development)
npm run test:watch
```

## ⚙️ API Endpoints (Postman Collection)

The base URL for all endpoints is `http://localhost:3000`.

| Requirement | Method | Endpoint | Description | Request Body (JSON) | Params |
| :--- | :--- | :--- | :--- | :--- |
| **1. Create Wallet** | `POST` | `/wallets` | Creates a new wallet. | `{ "currency": "USD" }` (Optional) | N/A |
| **2. Fetch Details** | `GET` | `/wallets/:id` | Retrieves wallet details and transaction history. | N/A | N/A |
| **3. Fund Wallet** | `PATCH` | `/wallets/:id/fund` | Adds a positive amount to the wallet balance. | `{ "amount": 10000 }` | Idempotency-Key (Optional, in headers) |
| **4. Transfer Funds** | `POST` | `/wallets/:id/transfer` | Transfers funds from `:id` to `receiverWalletId`. | `{ "receiverWalletId": "uuid-target", "amount": 5000 }` | Idempotency-Key (Optional, in headers)|

> **Note on Amounts:** All monetary values (`balance` and `amount`) are stored and transferred in the **smallest currency unit (cents)** to avoid floating-point precision issues.
It is converted to the main currency for display purposes

## 📝 Assumptions Made

1.  **Storage:** As requested, an **in-memory `Map`** is used for all wallet and transaction data. Data will be lost upon server restart.
2.  **Currency:** The core logic assumes transactions occur in the **same currency** (USD, NGN, or GBP) and does not include conversion logic. Transfers between wallets of different currencies are blocked.
3.  **Authentication/Authorization:** No security, authentication, or authorization layers were implemented, as they were outside the scope of the core task.
4.  **Atomicity:** Transaction atomicity for transfers is guaranteed within the single-threaded Node.js process by modifying both wallet objects directly before recording the history.
5.  **Validation & Transformation:** Input validation (e.g., positive amount, valid UUIDs) is handled using NestJS DTOs (class-validator). Crucially, the global ValidationPipe is enabled with transform: true to ensure incoming JSON strings for numeric fields (like amount) are correctly converted to number primitives, guaranteeing strict type and value checks.

## 💡 Idempotency

The Fund Wallet and Transfer Funds endpoints support optional idempotency.
- Header: To use this feature, the client must include a unique header: Idempotency-Key: <unique-uuid>
- Behavior: If a request with a specific Idempotency-Key is received again (e.g., due to a network timeout and client retry), the business logic is skipped, and the original successful response is returned, preventing duplicate fundings or transfers.

## 📈 Notes on Scaling

To transition this system to a production environment, the following would be necessary:

1.  **Database:** Replace the in-memory map with a **Relational Database (e.g., PostgreSQL)** to ensure data persistence and utilize **ACID properties** for financial integrity.
2.  **Concurrency Control:** Implement **database-level locking** (`SELECT FOR UPDATE`) during the transfer operation to prevent race conditions and ensure that concurrent debits do not overdraw a wallet's balance.
3.  **Idempotency:** Implement an idempotency mechanism using a key sent by the client (via request header) and stored in a fast cache (e.g., Redis) to guarantee that a network-retried request only executes once.
