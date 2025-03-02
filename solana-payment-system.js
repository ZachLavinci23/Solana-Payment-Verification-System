// Solana Payment Verification System

const { Connection, PublicKey, LAMPORTS_PER_SOL, clusterApiUrl } = require('@solana/web3.js');
const crypto = require('crypto');

class SolanaPaymentSystem {
  constructor(config = {}) {
    // Default to devnet, but can use mainnet-beta for production
    this.network = config.network || 'devnet';
    this.connection = new Connection(clusterApiUrl(this.network), 'confirmed');
    
    // Store mapping of user_id to payment addresses and amounts
    this.pendingPayments = {};
    
    // Main treasury wallet to receive all payments
    this.treasuryWallet = config.treasuryWallet;
    
    // Verify this is a valid Solana address
    if (!this.treasuryWallet) {
      throw new Error('Treasury wallet public key is required');
    }
    
    try {
      this.treasuryPublicKey = new PublicKey(this.treasuryWallet);
    } catch (error) {
      throw new Error('Invalid treasury wallet public key');
    }
    
    // How long to keep checking for a payment (in milliseconds)
    this.paymentTimeout = config.paymentTimeout || 30 * 60 * 1000; // 30 minutes default
    
    // How frequently to check for payment confirmation (in milliseconds)
    this.pollInterval = config.pollInterval || 15 * 1000; // 15 seconds default
  }
  
  /**
   * Generate a unique payment address for a user
   * @param {string} userId - Unique identifier for the user
   * @param {number} amountSol - Amount in SOL to be paid
   * @param {Object} metadata - Additional metadata to store with the payment
   * @returns {Object} Payment details including address
   */
  async createPaymentRequest(userId, amountSol, metadata = {}) {
    if (!userId) {
      throw new Error('User ID is required');
    }
    
    if (!amountSol || amountSol <= 0) {
      throw new Error('Amount must be greater than 0');
    }
    
    // Generate a unique payment ID
    const paymentId = `payment_${userId}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    
    // Store payment details
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
  
  /**
   * Check if a payment has been received
   * @param {string} paymentId - The payment ID to check
   * @returns {Promise<boolean>} True if payment is confirmed, false otherwise
   */
  async checkPaymentStatus(paymentId) {
    const payment = this.pendingPayments[paymentId];
    
    if (!payment) {
      throw new Error('Payment not found');
    }
    
    // Check if payment is already confirmed
    if (payment.status === 'confirmed') {
      return true;
    }
    
    // Check if payment is expired
    if (Date.now() > payment.expiresAt) {
      payment.status = 'expired';
      return false;
    }
    
    try {
      // Get the most recent transactions to the treasury wallet
      const signatures = await this.connection.getSignaturesForAddress(
        this.treasuryPublicKey,
        { limit: 10 }
      );
      
      // Only look at transactions after the payment was created
      const relevantSignatures = signatures.filter(
        sig => new Date(sig.blockTime * 1000) >= new Date(payment.createdAt)
      );
      
      // Check each transaction to see if it matches our expected payment
      for (const sig of relevantSignatures) {
        const tx = await this.connection.getTransaction(sig.signature);
        
        if (!tx || !tx.meta || tx.meta.err) {
          continue; // Skip failed transactions
        }
        
        // Look for a transfer to our treasury wallet with the right amount
        const preBalances = tx.meta.preBalances;
        const postBalances = tx.meta.postBalances;
        const accountKeys = tx.transaction.message.accountKeys;
        
        for (let i = 0; i < accountKeys.length; i++) {
          const key = accountKeys[i].toString();
          if (key === this.treasuryWallet) {
            const balanceChange = postBalances[i] - preBalances[i];
            
            // Allow for a small variance to account for transaction fees
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
      
      // Payment not yet received
      return false;
    } catch (error) {
      console.error('Error checking payment status:', error);
      return false;
    }
  }
  
  /**
   * Wait for payment confirmation with polling
   * @param {string} paymentId - The payment ID to wait for
   * @param {function} callback - Callback function called when payment is confirmed or timeout
   * @returns {Promise<void>}
   */
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
        
        // Continue polling
        setTimeout(checkPayment, this.pollInterval);
      } catch (error) {
        callback(error, null);
      }
    };
    
    // Start polling
    checkPayment();
  }
  
  /**
   * Get all pending payments for a user
   * @param {string} userId - The user ID to check
   * @returns {Array} List of pending payments
   */
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
  
  /**
   * Clean up old/expired payments to prevent memory leaks
   */
  cleanupExpiredPayments() {
    const now = Date.now();
    Object.keys(this.pendingPayments).forEach(paymentId => {
      const payment = this.pendingPayments[paymentId];
      // Remove payments that are expired or confirmed and older than 1 day
      if ((payment.status === 'expired' || payment.status === 'confirmed') && 
          now - payment.createdAt > 24 * 60 * 60 * 1000) {
        delete this.pendingPayments[paymentId];
      }
    });
  }
}

module.exports = SolanaPaymentSystem;

// Example usage
/*
const solanaPayments = new SolanaPaymentSystem({
  treasuryWallet: 'YOUR_TREASURY_WALLET_PUBLIC_KEY',
  network: 'mainnet-beta' // Use 'devnet' for testing
});

// Create payment request
app.post('/api/payment/create', async (req, res) => {
  try {
    const { userId, amountSol } = req.body;
    const paymentRequest = await solanaPayments.createPaymentRequest(userId, amountSol);
    res.json(paymentRequest);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Check payment status
app.get('/api/payment/status/:paymentId', async (req, res) => {
  try {
    const isConfirmed = await solanaPayments.checkPaymentStatus(req.params.paymentId);
    res.json({ 
      paymentId: req.params.paymentId,
      confirmed: isConfirmed,
      status: isConfirmed ? 'confirmed' : 'pending'
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Example webhook for payment confirmation
app.post('/api/payment/webhook', (req, res) => {
  const { paymentId } = req.body;
  
  solanaPayments.waitForPaymentConfirmation(paymentId, (error, result) => {
    if (error) {
      console.error('Payment verification error:', error);
      return;
    }
    
    if (result.status === 'confirmed') {
      // Payment confirmed, update subscription status
      console.log(`Payment confirmed for user ${result.userId}`);
      // Update user subscription in your database
    }
  });
  
  res.status(200).end();
});
*/
