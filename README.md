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
