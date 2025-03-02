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

**Input Validation:** Checks that both the user ID and amount are valid.
<br>
**Unique Payment ID:** Generates a unique identifier combining the user ID, current timestamp, and random bytes for uniqueness.
<br>
**Payment Details Storage:** Stores the payment information with the following details:
<br>

- userId: Links the payment to a specific user
- amountLamports: Converts SOL to lamports (1 SOL = 1,000,000,000 lamports)
- status: Tracks payment status (initially "pending")
- createdAt & expiresAt: Timestamps for payment creation and expiration
- metadata: Optional field for additional information


**Return Value:** Returns everything the frontend needs to display to the user, including the treasury wallet address to send funds to and when the payment request expires.

---------------------------------------------------------------------------------------------------------------

**Checking Payment Status**

```
async checkPaymentStatus(paymentId) {
  const payment = this.pendingPayments[paymentId];
  
  if (!payment) {
    throw new Error('Payment not found');
  }
  
  if (payment.status === 'confirmed') {
    return true;
  }
  
  if (Date.now() > payment.expiresAt) {
    payment.status = 'expired';
    return false;
  }
  
  try {
    const signatures = await this.connection.getSignaturesForAddress(
      this.treasuryPublicKey,
      { limit: 10 }
    );
    
    const relevantSignatures = signatures.filter(
      sig => new Date(sig.blockTime * 1000) >= new Date(payment.createdAt)
    );
    
    for (const sig of relevantSignatures) {
      const tx = await this.connection.getTransaction(sig.signature);
      
      if (!tx || !tx.meta || tx.meta.err) {
        continue; // Skip failed transactions
      }
      
      const preBalances = tx.meta.preBalances;
      const postBalances = tx.meta.postBalances;
      const accountKeys = tx.transaction.message.accountKeys;
      
      for (let i = 0; i < accountKeys.length; i++) {
        const key = accountKeys[i].toString();
        if (key === this.treasuryWallet) {
          const balanceChange = postBalances[i] - preBalances[i];
          
          if (Math.abs(balanceChange - payment.amountLamports) < 1000) {
            // Payment confirmed!
            payment.status = 'confirmed';
            payment.confirmedAt = Date.now();
            payment.transactionSignature = sig.signature;
            return true;
          }
        }
      }
    }

    return false;
  } catch (error) {
    console.error('Error checking payment status:', error);
    return false;
  }
}
```

**Payment Lookup:** Retrieves the payment details from the pending payments store.
<br>
**Quick Checks:** Immediately returns if the payment is already confirmed or expired.
<br>
**Transaction History:** Queries the Solana blockchain for recent transactions to your treasury wallet (limited to 10 for efficiency).
<br>
**Relevant Transactions:** Filters for transactions that occurred after the payment was created.
<br>
**Transaction Analysis:** For each transaction:
<br>

1. Retrieves the full transaction details 
2. Skips any failed transactions 
3. Compares pre and post balances of your treasury wallet 
4. Checks if the balance change matches the expected payment amount
5. Allows small variance to account for network fees


**Confirmation:** When a matching transaction is found, it updates the payment status to "confirmed" and stores the transaction signature.
<br>
**Error Handling:** Catches and logs any errors during the verification process.
<br>

---------------------------------------------------------------------------------------------------------------

**Wait For Payment Confirmation**
```
async waitForPaymentConfirmation(paymentId, callback) {
  const payment = this.pendingPayments[paymentId];
  
  if (!payment) {
    callback(new Error('Payment not found'), null);
    return;
  }
  
  const checkPayment = async () => {
    try {
      const isConfirmed = await this.checkPaymentStatus(paymentId);
      
      if (isConfirmed) {
        callback(null, {
          paymentId,
          userId: payment.userId,
          status: 'confirmed',
          confirmedAt: new Date(payment.confirmedAt).toISOString()
        });
        return;
      }
      
      // Check if payment is expired
      if (Date.now() > payment.expiresAt) {
        callback(null, {
          paymentId,
          userId: payment.userId,
          status: 'expired',
          expiresAt: new Date(payment.expiresAt).toISOString()
        });
        return;
      }
      
      setTimeout(checkPayment, this.pollInterval);
    } catch (error) {
      callback(error, null);
    }
  };
  
  checkPayment();
}
```

- **Webhook-Style Callback:** This method implements a callback-based approach for asynchronous notification when a payment is confirmed.
- **Recursive Polling:** Creates a function that checks payment status and calls itself again after the polling interval if the payment is still pending.
- **Confirmation Handling:** When payment is confirmed, it calls the callback with the confirmation details.
- **Expiration Handling:** Also handles payment expiration and notifies through the callback.
- **Error Propagation:** Forwards any errors to the callback function.

---------------------------------------------------------------------------------------------------------------

**Additional Utility Methods**

```
getUserPendingPayments(userId) {
  return Object.values(this.pendingPayments)
    .filter(payment => payment.userId === userId && payment.status === 'pending')
    .map(payment => ({
      paymentId: Object.keys(this.pendingPayments).find(key => this.pendingPayments[key] === payment),
      userId: payment.userId,
      amountSol: payment.amountLamports / LAMPORTS_PER_SOL,
      createdAt: new Date(payment.createdAt).toISOString(),
      expiresAt: new Date(payment.expiresAt).toISOString()
    }));
}

cleanupExpiredPayments() {
  const now = Date.now();
  Object.keys(this.pendingPayments).forEach(paymentId => {
    const payment = this.pendingPayments[paymentId];
    if ((payment.status === 'expired' || payment.status === 'confirmed') && 
        now - payment.createdAt > 24 * 60 * 60 * 1000) {
      delete this.pendingPayments[paymentId];
    }
  });
}
```

- **User Pending Payments:** A helper method that retrieves all pending payments for a specific user, which is useful for showing payment history or reminding users of pending payments.
- **Cleanup Function:** Prevents memory leaks by removing old payment records (ones that are either confirmed or expired and older than 24 hours).

**How the System Authenticates Payments**

The key innovation in this system is how it determines when a payment has been made:

1. Direct Blockchain Verification: Instead of relying on webhooks or third-party services, it directly queries the Solana blockchain for transaction data.
2. Treasury Wallet Model: All payments go to a single treasury wallet, and the system identifies specific payments by:

- Filtering for transactions that occurred after the payment request was created
- Matching the exact payment amount

3. Balance Differential Analysis: It examines the pre and post-transaction balances of the treasury wallet to determine the exact amount received, accounting for transaction fees.
4. Small Variance Allowance: It allows for a small variance (< 1000 lamports) to account for network fees that might slightly reduce the received amount.

**Security Considerations**

**1. Idempotent Processing:** The system is designed to prevent double-counting payments by updating the payment status once confirmed.
<br>
**2. Expiration Handling:** Payment requests automatically expire after the configured timeout (default: 30 minutes).
<br>
**3. Input Validation:** All input parameters are validated before processing.
<br>
**4. Error Handling:** Robust error handling prevents system crashes from unexpected blockchain responses.
<br>
**5. Memory Management:** The cleanup function prevents memory leaks from accumulating payment records.
<br>

---------------------------------------------------------------------------------------------------------------

**Additional Implementation Details**

**Transaction Processing Logic**
<br>
The core verification algorithm works by analyzing transaction data from the Solana blockchain:
<br>

**1. Time-Based Filtering:** The system looks only at transactions that occurred after the payment request was created, ensuring that old transactions aren't accidentally counted as new payments.
<br>
**2. Balance Change Analysis:** Rather than relying on transaction memos or other metadata, the system simply checks whether the treasury wallet's balance increased by the expected amount. This is a simple but robust approach that works regardless of how the user initiates the transaction.
<br>
**3. Variance Handling:** The check Math.abs(balanceChange - payment.amountLamports) < 1000 allows for a small difference between the requested amount and received amount, which accommodates network fees that might be deducted from the transaction.
<br>

**Memory Management Approach**
<br>
The in-memory storage (this.pendingPayments) is designed to be efficient but needs periodic cleanup:

**1. Storage Format:** Uses a hash map with payment IDs as keys for O(1) lookup time.
**2. Cleanup Logic:** The cleanupExpiredPayments() method removes payments that are:

Already confirmed or expired (completed payments)
Older than 24 hours (to prevent memory leaks)

**3. Recommended Usage:** In a production environment, you should call this cleanup method on a schedule (e.g., via a cron job).

**Error Handling Strategy**
The system implements comprehensive error handling:

**Input Validation:** Checks for required parameters and valid values before processing.
**Transaction Errors:** Handles transaction retrieval failures gracefully.
**Network Errors:** Catches and logs connection issues with the Solana network.
**Payment Not Found:** Provides clear error messages when payment IDs don't exist.

**Scaling Considerations**
For high-volume implementations, consider these modifications:

1. Database Storage: Replace the in-memory pendingPayments object with a database table.
2. Batch Processing: Implement batch retrieval of blockchain data to reduce API calls.
3. Webhook Workers: Move the payment confirmation polling to background workers.
4. Transaction Indexing: For very high volumes, maintain your own index of transactions to your treasury wallet.

**Customization Options**
The system is designed to be extended for specific use cases:

1. Custom Verification Logic: You can subclass SolanaPaymentSystem and override checkPaymentStatus() to add additional verification steps.
2. Different Networks: The system supports both devnet and mainnet-beta, but you could extend it for other Solana clusters.
3. Payment Metadata: You can add additional information to the metadata field for tracking purposes.
4. Custom Confirmation Strategies: The webhook-style callback can be replaced with event emitters, promises, or other notification patterns.

With this implementation and the detailed GitHub README, you have everything you need to integrate Solana payments into your web applications or Telegram bots. The system is designed to be simple yet robust, handling the core payment verification flow while remaining flexible for custom extensions.
