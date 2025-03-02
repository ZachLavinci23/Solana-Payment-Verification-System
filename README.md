# Solana-Payment-Verification-System
Solana Payment Verification System

This Solana payment system will handle the exact flow you described. Here's how it works:

**1. Setup:** Initialize the system with your treasury wallet address (where all payments will be sent)

**2. Payment Flow:**

- When a user clicks "Subscribe", you call createPaymentRequest(userId, 1)
- The system returns payment details including the wallet address to display to the user
- The user then sends 1 SOL to this address
- Your backend polls for confirmation using checkPaymentStatus(paymentId)
- Once verified, it returns true and you can update the user's subscription

**3. Key Features:**

- Uses a single treasury wallet for receiving all payments
- Verifies transactions by checking recent transactions to your wallet
- Handles timeout/expiration for pending payments
- Includes polling mechanism to wait for confirmation
- Cleanup function to prevent memory leaks

To integrate this with your Telegram app or website:

- Install the Solana web3.js package: npm install @solana/web3.js
- Import and initialize the payment system with your treasury wallet
- Create API endpoints to create payment requests and check status
- On your frontend, show the user the payment address and amount
- Poll the status endpoint to detect when payment is confirmed

---------------------------------------------------------------------------------------------------------------

**Detailed System Explanation**

**Core Architecture**
The SolanaPaymentSystem class is the central component that manages all payment operations. Let me explain each part:

**Constructor and Configuration:**
```
constructor(config = {}) {
  this.network = config.network || 'devnet';
  this.connection = new Connection(clusterApiUrl(this.network), 'confirmed');
  
  this.pendingPayments = {};
  this.treasuryWallet = config.treasuryWallet;
  
  if (!this.treasuryWallet) {
    throw new Error('Treasury wallet public key is required');
  }
  
  try {
    this.treasuryPublicKey = new PublicKey(this.treasuryWallet);
  } catch (error) {
    throw new Error('Invalid treasury wallet public key');
  }
  
  this.paymentTimeout = config.paymentTimeout || 30 * 60 * 1000; 
  this.pollInterval = config.pollInterval || 15 * 1000; 
}
```

- **Network Configuration:** By default, the system connects to Solana's devnet for testing, but you can specify mainnet-beta for production use.
- **Connection Setup:** Creates a connection to the Solana blockchain with the confirmed commitment level, which provides a good balance between speed and certainty.
- **Pending Payments Storage:** Uses an in-memory JavaScript object to track all payment requests. In a production system, you might want to persist this to a database.
- **Treasury Wallet:** This is the single wallet address that will receive all user payments. The system validates that it's a properly formatted Solana public key.
- **Timeout Settings:** Configures how long a payment request remains valid (default: 30 minutes) and how frequently to check for payment confirmation (default: 15 seconds).

---------------------------------------------------------------------------------------------------------------

**Creating Payment Requests**
```
async createPaymentRequest(userId, amountSol, metadata = {}) {
  if (!userId) {
    throw new Error('User ID is required');
  }
  
  if (!amountSol || amountSol <= 0) {
    throw new Error('Amount must be greater than 0');
  }
  
  const paymentId = `payment_${userId}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  
  this.pendingPayments[paymentId] = {
    userId,
    amountLamports: amountSol * LAMPORTS_PER_SOL,
    status: 'pending',
    createdAt: Date.now(),
    expiresAt: Date.now() + this.paymentTimeout,
    metadata
  };
  
  return {
    paymentId,
    userId,
    walletAddress: this.treasuryWallet,
    amountSol,
    expiresAt: new Date(this.pendingPayments[paymentId].expiresAt).toISOString()
  };
}
```


- ** Input Validation:** Checks that both the user ID and amount are valid.
- ** Unique Payment ID:** Generates a unique identifier combining the user ID, current timestamp, and random bytes for uniqueness.
- **-Payment Details Storage:** Stores the payment information with the following details:

- userId: Links the payment to a specific user
- amountLamports: Converts SOL to lamports (1 SOL = 1,000,000,000 lamports)
- status: Tracks payment status (initially "pending")
- createdAt & expiresAt: Timestamps for payment creation and expiration
- metadata: Optional field for additional information


**Return Value:** Returns everything the frontend needs to display to the user, including the treasury wallet address to send funds to and when the payment request expires.







