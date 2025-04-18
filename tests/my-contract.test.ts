import { describe, expect, it } from "vitest";
import { Cl, tupleCV, principalCV, uintCV } from "@stacks/transactions";
import { initSimnet, Tx } from "@hirosystems/clarinet-sdk";

// Initialize the simulated network
const simnet = await initSimnet();
const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const sender = accounts.get("wallet_1")!;
const recipient = accounts.get("wallet_2")!;

// Assuming the contract principal (update with your actual contract principal)
const contractPrincipal = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.beans";

describe("Tipping Contract Tests", () => {
  it("should tip SIP-010 tokens successfully with fee deduction", async () => {
    const tipFee = 4000; // Fee in microSTX
    const feeCollector = deployer; // Matches the contract's fee-collector constant in Simnet

    // Get initial STX balances
    const senderInitialStx = simnet.getAssetsMap().get("STX")?.get(sender) || BigInt(0);
    const feeCollectorInitialStx = simnet.getAssetsMap().get("STX")?.get(feeCollector) || BigInt(0);

    // Mint tokens to the sender
    simnet.callPublicFn(
      "mock-sip010",
      "mint",
      [Cl.uint(10000000), Cl.principal(sender)],
      deployer
    );

    // Execute the tip-ft function
    const block = simnet.callPublicFn(
      "beans",
      "tip-ft",
      [
        Cl.principal("ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.mock-sip010"),
        Cl.principal(recipient),
        Cl.uint(10000000),
        Cl.some(Cl.buffer(Buffer.from("Great work!")))
      ],
      sender
    );

    // Check success and verify the returned tuple
    const result = block.result;
    expect(result).toBeOk(tupleCV({
      recipient: principalCV(recipient),
      "token-amount": uintCV(10000000),
      fee: uintCV(4000),
      token: principalCV("ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.mock-sip010")
    }));

    // Verify token balances
    const senderBalance = simnet.callReadOnlyFn(
      "mock-sip010",
      "get-balance",
      [Cl.principal(sender)],
      sender
    );
    const recipientBalance = simnet.callReadOnlyFn(
      "mock-sip010",
      "get-balance",
      [Cl.principal(recipient)],
      sender
    );

    expect(senderBalance.result).toBeOk(Cl.uint(0));
    expect(recipientBalance.result).toBeOk(Cl.uint(10000000));

    // Verify STX fee deduction
    const senderFinalStx = simnet.getAssetsMap().get("STX")?.get(sender) || BigInt(0);
    const feeCollectorFinalStx = simnet.getAssetsMap().get("STX")?.get(feeCollector) || BigInt(0);

    expect(senderFinalStx).toEqual(senderInitialStx - BigInt(tipFee));
    expect(feeCollectorFinalStx).toEqual(feeCollectorInitialStx + BigInt(tipFee));
  });

  it("should tip STX successfully with fee deduction", async () => {
    const tipAmount = 5000000; // 5 STX in microSTX
    const tipFee = 4000; // Fee in microSTX
    const feeCollector = deployer; // Matches the contract's fee-collector constant in Simnet

    // Get initial STX balances
    const senderInitialStx = simnet.getAssetsMap().get("STX")?.get(sender) || BigInt(0);
    const recipientInitialStx = simnet.getAssetsMap().get("STX")?.get(recipient) || BigInt(0);
    const feeCollectorInitialStx = simnet.getAssetsMap().get("STX")?.get(feeCollector) || BigInt(0);

    // Execute the tip-stx function
    const block = simnet.callPublicFn(
      "beans",
      "tip-stx",
      [
        Cl.principal(recipient),
        Cl.uint(tipAmount),
        Cl.some(Cl.buffer(Buffer.from("Thanks!")))
      ],
      sender
    );

    // Check success and verify the returned tuple
    const result = block.result;
    expect(result).toBeOk(tupleCV({
      recipient: principalCV(recipient),
      tip: uintCV(tipAmount),
      fee: uintCV(tipFee)
    }));

    // Verify STX balances
    const senderFinalStx = simnet.getAssetsMap().get("STX")?.get(sender) || BigInt(0);
    const recipientFinalStx = simnet.getAssetsMap().get("STX")?.get(recipient) || BigInt(0);
    const feeCollectorFinalStx = simnet.getAssetsMap().get("STX")?.get(feeCollector) || BigInt(0);

    expect(senderFinalStx).toEqual(senderInitialStx - BigInt(tipAmount + tipFee));
    expect(recipientFinalStx).toEqual(recipientInitialStx + BigInt(tipAmount));
    expect(feeCollectorFinalStx).toEqual(feeCollectorInitialStx + BigInt(tipFee));
  });

  it("should fail to tip STX when sender equals recipient", async () => {
    const tipAmount = 5000000; // 5 STX in microSTX
    const tipFee = 4000; // Fee in microSTX
    const feeCollector = deployer; // Matches the contract's fee-collector constant in Simnet

    // Get initial STX balances
    const senderInitialStx = simnet.getAssetsMap().get("STX")?.get(sender) || BigInt(0);
    const feeCollectorInitialStx = simnet.getAssetsMap().get("STX")?.get(feeCollector) || BigInt(0);

    // Attempt to tip oneself
    const block = simnet.callPublicFn(
      "beans",
      "tip-stx",
      [
        Cl.principal(sender), // Sender and recipient are the same
        Cl.uint(tipAmount),
        Cl.some(Cl.buffer(Buffer.from("Self-tip attempt")))
      ],
      sender
    );

    // Check failure due to same sender and recipient
    expect(block.result).toBeErr(Cl.uint(100)); // ERR_SAME_SENDER_RECIPIENT

    // Verify balances remain unchanged
    const senderFinalStx = simnet.getAssetsMap().get("STX")?.get(sender) || BigInt(0);
    const feeCollectorFinalStx = simnet.getAssetsMap().get("STX")?.get(feeCollector) || BigInt(0);

    expect(senderFinalStx).toEqual(senderInitialStx); // No STX should be deducted
    expect(feeCollectorFinalStx).toEqual(feeCollectorInitialStx); // No fee should be transferred
  });

  it("should fail to tip STX with insufficient STX balance", async () => {
    const tipAmount = 1000000000000000; // 1,000,000 STX in microSTX, exceeding Simnet balance
    const tipFee = 4000; // Fee in microSTX
    const feeCollector = deployer; // Matches the contract's fee-collector constant in Simnet

    // Get initial STX balances
    const senderInitialStx = simnet.getAssetsMap().get("STX")?.get(sender) || BigInt(0);
    const recipientInitialStx = simnet.getAssetsMap().get("STX")?.get(recipient) || BigInt(0);
    const feeCollectorInitialStx = simnet.getAssetsMap().get("STX")?.get(feeCollector) || BigInt(0);

    // Attempt to tip with insufficient STX
    const block = simnet.callPublicFn(
      "beans",
      "tip-stx",
      [
        Cl.principal(recipient),
        Cl.uint(tipAmount),
        Cl.some(Cl.buffer(Buffer.from("Large tip attempt")))
      ],
      sender
    );

    // Check failure due to insufficient STX
    expect(block.result).toBeErr(Cl.uint(102)); // ERR_INSUFFICIENT_STX

    // Verify balances remain unchanged
    const senderFinalStx = simnet.getAssetsMap().get("STX")?.get(sender) || BigInt(0);
    const recipientFinalStx = simnet.getAssetsMap().get("STX")?.get(recipient) || BigInt(0);
    const feeCollectorFinalStx = simnet.getAssetsMap().get("STX")?.get(feeCollector) || BigInt(0);

    expect(senderFinalStx).toEqual(senderInitialStx); // No STX should be deducted
    expect(recipientFinalStx).toEqual(recipientInitialStx); // No STX should be received
    expect(feeCollectorFinalStx).toEqual(feeCollectorInitialStx); // No fee should be transferred
  });

  it("should fail to tip SIP-010 tokens with insufficient token balance", async () => {
    const tipFee = 4000; // Fee in microSTX
    const feeCollector = deployer; // Matches the contract's fee-collector constant in Simnet

    // Do not mint tokens to the sender, so balance is 0
    const block = simnet.callPublicFn(
      "beans",
      "tip-ft",
      [
        Cl.principal("ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.mock-sip010"),
        Cl.principal(recipient),
        Cl.uint(10000000), // Attempting to tip 10,000,000 tokens without having any
        Cl.none()
      ],
      sender
    );

    // Check failure due to insufficient tokens
    expect(block.result).toBeErr(Cl.uint(103)); // ERR_INSUFFICIENT_TOKENS

    // Verify token balances remain unchanged
    const senderBalance = simnet.callReadOnlyFn(
      "mock-sip010",
      "get-balance",
      [Cl.principal(sender)],
      sender
    );
    const recipientBalance = simnet.callReadOnlyFn(
      "mock-sip010",
      "get-balance",
      [Cl.principal(recipient)],
      sender
    );

    expect(senderBalance.result).toBeOk(Cl.uint(0));
    expect(recipientBalance.result).toBeOk(Cl.uint(0));
  });

  it("should fail to tip SIP-010 tokens with insufficient STX for fee", async () => {
    const tipFee = 4000; // Fee in microSTX
    const feeCollector = deployer; // Matches the contract's fee-collector constant in Simnet

    // Mint tokens to the sender
    simnet.callPublicFn(
      "mock-sip010",
      "mint",
      [Cl.uint(10000000), Cl.principal(sender)],
      deployer
    );

    // Get sender's initial STX balance
    const initialStx = simnet.getAssetsMap().get("STX")?.get(sender) || BigInt(0);

    // Transfer most STX to recipient, leaving less than tipFee (e.g., 3999 microSTX)
    const transferAmount = initialStx - BigInt(tipFee - 1); // Leaves 3999 microSTX
    simnet.transferSTX(Number(transferAmount), recipient, sender);

    // Attempt to tip SIP-010 tokens with insufficient STX for fee
    const block = simnet.callPublicFn(
      "beans",
      "tip-ft",
      [
        Cl.principal("ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.mock-sip010"),
        Cl.principal(recipient),
        Cl.uint(10000000),
        Cl.none()
      ],
      sender
    );

    // Check failure due to insufficient STX for fee
    expect(block.result).toBeErr(Cl.uint(102)); // ERR_INSUFFICIENT_STX

    // Verify token balances remain unchanged
    const senderBalance = simnet.callReadOnlyFn(
      "mock-sip010",
      "get-balance",
      [Cl.principal(sender)],
      sender
    );
    const recipientBalance = simnet.callReadOnlyFn(
      "mock-sip010",
      "get-balance",
      [Cl.principal(recipient)],
      sender
    );

    expect(senderBalance.result).toBeOk(Cl.uint(10000000));
    expect(recipientBalance.result).toBeOk(Cl.uint(0));
  });

  it("should tip SIP-010 tokens without memo successfully", async () => {
    const tipFee = 4000; // Fee in microSTX
    const feeCollector = deployer; // Matches the contract's fee-collector constant in Simnet

    // Get initial STX balances
    const senderInitialStx = simnet.getAssetsMap().get("STX")?.get(sender) || BigInt(0);
    const feeCollectorInitialStx = simnet.getAssetsMap().get("STX")?.get(feeCollector) || BigInt(0);

    // Mint tokens to the sender
    simnet.callPublicFn(
      "mock-sip010",
      "mint",
      [Cl.uint(10000000), Cl.principal(sender)],
      deployer
    );

    // Execute the tip-ft function without memo
    const block = simnet.callPublicFn(
      "beans",
      "tip-ft",
      [
        Cl.principal("ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.mock-sip010"),
        Cl.principal(recipient),
        Cl.uint(10000000),
        Cl.none() // No memo
      ],
      sender
    );

    // Check success and verify the returned tuple
    const result = block.result;
    expect(result).toBeOk(tupleCV({
      recipient: principalCV(recipient),
      "token-amount": uintCV(10000000),
      fee: uintCV(4000),
      token: principalCV("ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.mock-sip010")
    }));

    // Verify token balances
    const senderBalance = simnet.callReadOnlyFn(
      "mock-sip010",
      "get-balance",
      [Cl.principal(sender)],
      sender
    );
    const recipientBalance = simnet.callReadOnlyFn(
      "mock-sip010",
      "get-balance",
      [Cl.principal(recipient)],
      sender
    );

    expect(senderBalance.result).toBeOk(Cl.uint(0));
    expect(recipientBalance.result).toBeOk(Cl.uint(10000000));

    // Verify STX fee deduction
    const senderFinalStx = simnet.getAssetsMap().get("STX")?.get(sender) || BigInt(0);
    const feeCollectorFinalStx = simnet.getAssetsMap().get("STX")?.get(feeCollector) || BigInt(0);

    expect(senderFinalStx).toEqual(senderInitialStx - BigInt(tipFee));
    expect(feeCollectorFinalStx).toEqual(feeCollectorInitialStx + BigInt(tipFee));
  });

  it("should fail to tip 0 SIP-010 tokens", async () => {
    const tipFee = 4000; // Fee in microSTX
    const feeCollector = deployer; // Matches the contract's fee-collector constant in Simnet

    // Mint tokens to the sender
    simnet.callPublicFn(
      "mock-sip010",
      "mint",
      [Cl.uint(10000000), Cl.principal(sender)],
      deployer
    );

    // Attempt to tip 0 tokens
    const block = simnet.callPublicFn(
      "beans",
      "tip-ft",
      [
        Cl.principal("ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.mock-sip010"),
        Cl.principal(recipient),
        Cl.uint(0), // 0 tokens
        Cl.none()
      ],
      sender
    );

    // Check failure due to invalid tip amount (0 tokens)
    expect(block.result).toBeErr(Cl.uint(104)); // ERR_INVALID_AMOUNT
  });

  it("should fail to tip STX with an extremely large amount", async () => {
    const largeAmount = 1000000000000000; // 1,000,000 STX in microSTX
    const feeCollector = deployer; // Matches the contract's fee-collector constant in Simnet

    const block = simnet.callPublicFn(
      "beans",
      "tip-stx",
      [Cl.principal(recipient), Cl.uint(largeAmount), Cl.none()],
      sender
    );

    // Expect failure due to insufficient STX balance
    expect(block.result).toBeErr(Cl.uint(102)); // ERR_INSUFFICIENT_STX
  });

  it("should fail to tip SIP-010 tokens with an extremely large amount", async () => {
    const largeAmount = 340282366920938463463374607431768211455n; // Max uint value
    const feeCollector = deployer; // Matches the contract's fee-collector constant in Simnet

    // Mint a small amount to the sender
    simnet.callPublicFn("mock-sip010", "mint", [Cl.uint(10000000), Cl.principal(sender)], deployer);

    const block = simnet.callPublicFn(
      "beans",
      "tip-ft",
      [
        Cl.principal("ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.mock-sip010"),
        Cl.principal(recipient),
        Cl.uint(largeAmount),
        Cl.none()
      ],
      sender
    );

    // Expect failure due to insufficient tokens
    expect(block.result).toBeErr(Cl.uint(103)); // ERR_INSUFFICIENT_TOKENS
  });

  it("should tip exact STX balance minus fee", async () => {
    const fee = 4000; // Fee in microSTX
    const feeCollector = deployer; // Matches the contract's fee-collector constant in Simnet
    const senderInitialStx = simnet.getAssetsMap().get("STX")?.get(sender) || BigInt(0);
    const tipAmount = senderInitialStx - BigInt(fee);

    const block = simnet.callPublicFn(
      "beans",
      "tip-stx",
      [Cl.principal(recipient), Cl.uint(tipAmount), Cl.none()],
      sender
    );

    // Verify the transaction succeeded
    expect(block.result).toBeOk(
      tupleCV({
        recipient: principalCV(recipient),
        tip: uintCV(tipAmount),
        fee: uintCV(fee),
      })
    );

    // Verify sender's STX balance is now 0
    const senderFinalStx = simnet.getAssetsMap().get("STX")?.get(sender) || BigInt(0);
    expect(senderFinalStx).toEqual(BigInt(0));
  });

  it("should tip exact token balance", async () => {
    const tokenAmount = 10000000; // Exact token balance to tip
    const feeCollector = deployer; // Matches the contract's fee-collector constant in Simnet

    // Mint exact token amount to sender
    simnet.callPublicFn("mock-sip010", "mint", [Cl.uint(tokenAmount), Cl.principal(sender)], deployer);

    const block = simnet.callPublicFn(
      "beans",
      "tip-ft",
      [
        Cl.principal("ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.mock-sip010"),
        Cl.principal(recipient),
        Cl.uint(tokenAmount),
        Cl.none()
      ],
      sender
    );

    // Verify the transaction succeeded
    expect(block.result).toBeOk(
      tupleCV({
        recipient: principalCV(recipient),
        "token-amount": uintCV(tokenAmount),
        fee: uintCV(4000), // Assuming fee is 4000 microSTX
        token: principalCV("ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.mock-sip010"),
      })
    );

    // Verify sender's token balance is now 0
    const senderBalance = simnet.callReadOnlyFn("mock-sip010", "get-balance", [Cl.principal(sender)], sender);
    expect(senderBalance.result).toBeOk(Cl.uint(0));
  });

  it("should tip smallest STX amount (1 microSTX)", async () => {
    const tipAmount = 1; // 1 microSTX
    const fee = 4000; // Fee in microSTX
    const feeCollector = deployer; // Matches the contract's fee-collector constant in Simnet

    // Get initial balances before the transaction
    const senderInitialStx = simnet.getAssetsMap().get("STX")?.get(sender) || BigInt(0);
    const recipientInitialStx = simnet.getAssetsMap().get("STX")?.get(recipient) || BigInt(0);

    const block = simnet.callPublicFn(
      "beans",
      "tip-stx",
      [Cl.principal(recipient), Cl.uint(tipAmount), Cl.none()],
      sender
    );

    // Verify the transaction succeeded
    expect(block.result).toBeOk(
      tupleCV({
        recipient: principalCV(recipient),
        tip: uintCV(tipAmount),
        fee: uintCV(fee),
      })
    );

    // Verify balances updated correctly
    const senderFinalStx = simnet.getAssetsMap().get("STX")?.get(sender) || BigInt(0);
    const recipientFinalStx = simnet.getAssetsMap().get("STX")?.get(recipient) || BigInt(0);
    expect(senderFinalStx).toEqual(senderInitialStx - BigInt(tipAmount + fee));
    expect(recipientFinalStx).toEqual(recipientInitialStx + BigInt(tipAmount));
  });

  it("should tip smallest token amount (1 token unit)", async () => {
    const tipAmount = 1; // 1 token unit
    const fee = 4000; // Fee in microSTX
    const feeCollector = deployer; // Matches the contract's fee-collector constant in Simnet

    // Mint 1 token unit to sender
    simnet.callPublicFn("mock-sip010", "mint", [Cl.uint(tipAmount), Cl.principal(sender)], deployer);

    const block = simnet.callPublicFn(
      "beans",
      "tip-ft",
      [
        Cl.principal("ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.mock-sip010"),
        Cl.principal(recipient),
        Cl.uint(tipAmount),
        Cl.none()
      ],
      sender
    );

    // Verify the transaction succeeded
    expect(block.result).toBeOk(
      tupleCV({
        recipient: principalCV(recipient),
        "token-amount": uintCV(tipAmount),
        fee: uintCV(fee),
        token: principalCV("ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.mock-sip010"),
      })
    );

    // Verify token balances
    const senderBalance = simnet.callReadOnlyFn("mock-sip010", "get-balance", [Cl.principal(sender)], sender);
    const recipientBalance = simnet.callReadOnlyFn("mock-sip010", "get-balance", [Cl.principal(recipient)], sender);
    expect(senderBalance.result).toBeOk(Cl.uint(0));
    expect(recipientBalance.result).toBeOk(Cl.uint(tipAmount));
  });

  it("should fail to tip STX to the contract itself", async () => {
    const tipAmount = 1000000; // 1 STX in microSTX
    const feeCollector = deployer; // Matches the contract's fee-collector constant in Simnet

    const block = simnet.callPublicFn(
      "beans",
      "tip-stx",
      [Cl.principal(contractPrincipal), Cl.uint(tipAmount), Cl.none()],
      sender
    );

    // Expect failure due to invalid recipient (contract itself)
    expect(block.result).toBeErr(Cl.uint(105)); // ERR_INVALID_RECIPIENT
  });

  it("should fail to tip SIP-010 tokens to the contract itself", async () => {
    const tipAmount = 1000000; // 1 token unit
    const feeCollector = deployer; // Matches the contract's fee-collector constant in Simnet

    // Mint tokens to sender
    simnet.callPublicFn("mock-sip010", "mint", [Cl.uint(tipAmount), Cl.principal(sender)], deployer);

    const block = simnet.callPublicFn(
      "beans",
      "tip-ft",
      [
        Cl.principal("ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.mock-sip010"),
        Cl.principal(contractPrincipal),
        Cl.uint(tipAmount),
        Cl.none()
      ],
      sender
    );

    // Expect failure due to invalid recipient (contract itself)
    expect(block.result).toBeErr(Cl.uint(105)); // ERR_INVALID_RECIPIENT
  });
});