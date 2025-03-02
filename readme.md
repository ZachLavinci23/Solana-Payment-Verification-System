**Solana Payment Verification System**
<br>
A lightweight, secure system for accepting and verifying Solana payments for subscriptions, digital products, or services.
<br>
**Features**

✅ Simple payment flow: generate a payment address → user pays → system verifies
✅ Direct blockchain verification (no third-party dependencies)
✅ Single treasury wallet design (no need to create new wallets)
✅ Automatic payment expiration and cleanup
✅ Configurable timeouts and polling intervals
✅ Webhook-style callback for payment confirmation
✅ Comprehensive error handling
<br>
------------------------------------------------------------------------------------------------------------------------------
<br>
**Installation**

```
# Install from npm
npm install solana-payment-system

# Install dependencies
npm install @solana/web3.js
```
<br>
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
This system implements a simple yet effective approach to verifying Solana payments:

**1. Payment Request: **When a user initiates a payment, the system generates a unique payment ID and stores expected payment details.
**2. User Payment:** The user is shown your treasury wallet address to send the payment to.
**3. Verification:** The system checks the Solana blockchain for recent transactions to your treasury wallet and verifies:

That the transaction occurred after the payment request was created
That the amount matches the expected payment

**4. Confirmation:** Once verified, the system marks the payment as confirmed and you can activate the user's subscription.

**API Reference**
