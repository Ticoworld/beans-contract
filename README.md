# Beans Contract
A tipping contract for sending STX or SIP-010 tokens to others on the Stacks Mainnet, with a small fee per transaction.

## Mainnet Address
- [`SP268NSDNZ8THZ9C1K995MVXKGYT4JNQH82DDM34T.beans`](https://explorer.stacks.co/address/SP268NSDNZ8THZ9C1K995MVXKGYT4JNQH82DDM34T.beans?chain=mainnet)

## Functions
- **`tip-stx`**: Send a tip in STX to another user.  
  - *Parameters*:  
    - `recipient` (principal): The address receiving the tip.  
    - `amount` (uint): The amount in microSTX (e.g., 1000000 = 1 STX).  
    - `memo` (optional buff): A short message (optional).  
  - *Behavior*: Transfers the specified STX amount to the recipient and deducts a 0.004 STX fee.  

- **`tip-ft`**: Send a tip in SIP-010 tokens to another user.  
  - *Parameters*:  
    - `token` (trait): The SIP-010 token contract address.  
    - `recipient` (principal): The address receiving the tip.  
    - `amount` (uint): The token amount to send.  
    - `memo` (optional buff): A short message (optional).  
  - *Behavior*: Transfers the specified token amount and deducts a 0.004 STX fee.

## Fee Collector
- `'SPPKR81WF4WY5RPQN34YAMBZST0XF2VFMRX5RB5N'` (the deployer’s address)

## How to Use
1. **Via Hiro Explorer Sandbox**:  
   - Visit [Hiro Explorer Sandbox](https://explorer.stacks.co/sandbox/contract-call?chain=mainnet).  
   - Enter the contract address: `SP268NSDNZ8THZ9C1K995MVXKGYT4JNQH82DDM34T.beans`.  
   - Choose a function (`tip-stx` or `tip-ft`), input the required parameters, and sign with Hiro Wallet.  

2. **Example (Tipping STX)**:  
   - To tip 1 STX to `SPRECIPIENTADDRESS`:  
     - Function: `tip-stx`  
     - Recipient: `SPRECIPIENTADDRESS`  
     - Amount: `1000000` (1 STX in microSTX)  
     - Memo: `"Great work!"` (optional)  

3. **Verify on Stacks Explorer**:  
   - Check transaction details at [Stacks Explorer](https://explorer.stacks.co/?chain=mainnet).

## Important Notes
- **Fees**: Each tip incurs a 0.004 STX fee, in addition to the tip amount.  
- **Restrictions**: You cannot tip yourself or the contract address.  
- **Token Support**: For `tip-ft`, ensure the token address complies with the SIP-010 standard.