**Solana Payment Verification System**
<br>
A lightweight, secure system for accepting and verifying Solana payments for subscriptions, digital products, or services.
<br>
Features

✅ Simple payment flow: generate a payment address → user pays → system verifies
<br>
✅ Direct blockchain verification (no third-party dependencies)
<br>
✅ Single treasury wallet design (no need to create new wallets)
<br>
✅ Automatic payment expiration and cleanup
<br>
✅ Configurable timeouts and polling intervals
<br>
✅ Webhook-style callback for payment confirmation
<br>
✅ Comprehensive error handling
<br>

------------------------------------------------------------------------------------------------------------------------------

**Installation**

```
# Install from npm
npm install solana-payment-system

# Install dependencies
npm install @solana/web3.js
```

**Quick Start**

```
const SolanaPaymentSystem = require('solana-payment-system');

const paymentSystem = new SolanaPaymentSystem({
  treasuryWallet: 'YOUR_SOLANA_WALLET_ADDRESS',
  network: 'mainnet-beta' // Use 'devnet' for testing
});

const paymentRequest = await paymentSystem.createPaymentRequest('user123', 1); // 1 SOL

console.log(`Please send ${paymentRequest.amountSol} SOL to ${paymentRequest.walletAddress}`);
console.log(`Payment expires at ${paymentRequest.expiresAt}`);

const isConfirmed = await paymentSystem.checkPaymentStatus(paymentRequest.paymentId);
if (isConfirmed) {
  console.log('Payment confirmed!');
}
```

**How It Works**
<br>
This system implements a simple yet effective approach to verifying Solana payments:

**1. Payment Request:** When a user initiates a payment, the system generates a unique payment ID and stores expected payment details.
<br>
**2. User Payment:** The user is shown your treasury wallet address to send the payment to.
<br>
**3. Verification:** The system checks the Solana blockchain for recent transactions to your treasury wallet and verifies:\

- That the transaction occurred after the payment request was created
- That the amount matches the expected payment

**4. Confirmation:** Once verified, the system marks the payment as confirmed and you can activate the user's subscription.

------------------------------------------------------------------------------------------------------------------------------

**API Reference**

**Constructor**

```
const paymentSystem = new SolanaPaymentSystem({
  treasuryWallet: 'YOUR_SOLANA_WALLET_ADDRESS', 
  network: 'mainnet-beta', 
  paymentTimeout: 1800000, 
  pollInterval: 15000 
});
```

**Create Payment Request**

```
const paymentRequest = await paymentSystem.createPaymentRequest(
  userId,
  amountSol,
  metadata 
);
```

**Returns:**

```
{
  paymentId: 'payment_user123_1614567890123_a1b2c3d4',
  userId: 'user123',
  walletAddress: 'YOUR_TREASURY_WALLET_ADDRESS',
  amountSol: 1,
  expiresAt: '2023-01-01T12:30:00.000Z'
}
```

**Check Payment Status**

```
const isConfirmed = await paymentSystem.checkPaymentStatus(paymentId);
```

Returns true if payment is confirmed, false otherwise.

**Wait For Payment Confirmation**

```
paymentSystem.waitForPaymentConfirmation(paymentId, (error, result) => {
  if (error) {
    console.error('Error checking payment:', error);
    return;
  }
  
  if (result.status === 'confirmed') {
    console.log(`Payment confirmed for user ${result.userId}`);
    // Activate subscription
  } else if (result.status === 'expired') {
    console.log(`Payment expired for user ${result.userId}`);
    // Notify user
  }
});
```

**Get User Pending Payments**

```
const pendingPayments = paymentSystem.getUserPendingPayments(userId);
```

Returns an array of pending payment objects for the specified user.

**Cleanup Expired Payments**

```
paymentSystem.cleanupExpiredPayments();
```

------------------------------------------------------------------------------------------------------------------------------

**Integration Examples**

**Express.js API**

```
const express = require('express');
const SolanaPaymentSystem = require('solana-payment-system');

const app = express();
app.use(express.json());

const paymentSystem = new SolanaPaymentSystem({
  treasuryWallet: 'YOUR_TREASURY_WALLET',
  network: 'mainnet-beta'
});

app.post('/api/payment/create', async (req, res) => {
  try {
    const { userId, amountSol } = req.body;
    const paymentRequest = await paymentSystem.createPaymentRequest(userId, amountSol);
    res.json(paymentRequest);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/payment/status/:paymentId', async (req, res) => {
  try {
    const isConfirmed = await paymentSystem.checkPaymentStatus(req.params.paymentId);
    res.json({ 
      paymentId: req.params.paymentId,
      confirmed: isConfirmed,
      status: isConfirmed ? 'confirmed' : 'pending'
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

**Telegram Bot Integration**

```
const { Telegraf } = require('telegraf');
const SolanaPaymentSystem = require('solana-payment-system');

const bot = new Telegraf('YOUR_TELEGRAM_BOT_TOKEN');
const paymentSystem = new SolanaPaymentSystem({
  treasuryWallet: 'YOUR_TREASURY_WALLET',
  network: 'mainnet-beta'
});

const userPayments = {};

bot.command('subscribe', async (ctx) => {
  const userId = ctx.from.id.toString();
  const chatId = ctx.chat.id;
  
  try {
    const payment = await paymentSystem.createPaymentRequest(userId, 1);
    userPayments[chatId] = payment.paymentId;
    
    ctx.reply(`Please send 1 SOL to this address:\n\n${payment.walletAddress}\n\nI'll notify you when payment is confirmed.`);
    
    paymentSystem.waitForPaymentConfirmation(payment.paymentId, (error, result) => {
      if (error) {
        return ctx.reply('Error checking payment. Please contact support.');
      }
      
      if (result.status === 'confirmed') {
        ctx.reply('Thank you! Your subscription is now active.');
        // Update subscription in database
      } else if (result.status === 'expired') {
        ctx.reply('Your payment request has expired. Please try again.');
      }
    });
  } catch (error) {
    ctx.reply(`Error: ${error.message}`);
  }
});

bot.command('status', async (ctx) => {
  const chatId = ctx.chat.id;
  const paymentId = userPayments[chatId];
  
  if (!paymentId) {
    return ctx.reply('No pending payment found. Try /subscribe to create a new payment request.');
  }
  
  try {
    const isConfirmed = await paymentSystem.checkPaymentStatus(paymentId);
    if (isConfirmed) {
      ctx.reply('Your payment has been confirmed and your subscription is active!');
    } else {
      ctx.reply('Still waiting for your payment. Please check the address and amount.');
    }
  } catch (error) {
    ctx.reply(`Error: ${error.message}`);
  }
});

bot.launch();
```

**Security Best Practices**

**1. Store Payment Records:** In a production environment, store payment records in a database instead of in-memory.
<br>
**2. Regular Cleanup:** Call cleanupExpiredPayments() regularly to prevent memory leaks.
<br>
**3. Transaction Verification:** For large payments, consider implementing additional verification steps.
<br>
**4. Rate Limiting:** Implement rate limiting on your API endpoints to prevent abuse.
<br>
**5. Error Handling:** Always handle errors gracefully to maintain a good user experience.
<br>

------------------------------------------------------------------------------------------------------------------------------

**Advanced Configuration**

C**ustom Transaction Verification**
For additional verification logic, you can extend the checkPaymentStatus method:

```
class CustomPaymentSystem extends SolanaPaymentSystem {
  async checkPaymentStatus(paymentId) {
    const isConfirmed = await super.checkPaymentStatus(paymentId);
    
    if (isConfirmed) {
      return true;
    }
    
    return false;
  }
}
```

Database Integration

```
class PersistentPaymentSystem extends SolanaPaymentSystem {
  constructor(config) {
    super(config);
    this.db = config.database; // Your database connection
  }
  
  async createPaymentRequest(userId, amountSol, metadata = {}) {
    const payment = await super.createPaymentRequest(userId, amountSol, metadata);
    
    await this.db.payments.create({
      paymentId: payment.paymentId,
      userId,
      amountSol,
      status: 'pending',
      createdAt: new Date(),
      expiresAt: new Date(payment.expiresAt)
    });
    
    return payment;
  }
  
}
```

**Troubleshooting**

**Payment Not Being Detected**

1. Ensure the transaction has been confirmed on the Solana blockchain.
2. Verify the exact amount matches what was requested.
3. Check the network configuration (devnet vs. mainnet-beta).
4. Increase the poll interval and timeout for slow transactions.

**Memory Issues**
If you're handling a large volume of payments, make sure to:

1. Call cleanupExpiredPayments() regularly (e.g., every hour).
2. Implement a database-backed version instead of the in-memory storage.
