# Learn-to-earn Challenge 3

## Answer to the spymaster is worried that this design is not private.

### Is he correct?

Yes. The spy master is right to be worried. The current design is not private. All messages are public inputs, and their contents are visible to the sequencer. The agent IDs are also publicly visible in the on-chain state.

### How could you change the system to ensure that messages are private?

To ensure message privacy, the processing of messages should be moved off-chain and processed on the agent's local machine. Only the proof of the computation should be sent to the sequencer. Additionally, agent IDs and security codes must be hashed in the on-chain state to protect sensitive information. We can utilize a ZKProgram to enable agents to make off-chain private inputs from their local devices and then verify the proof on-chain.

## Prerequisites

- Node.js v18
- pnpm
- nvm

## How to build and test

```sh
nvm use
pnpm install
pnpm run test
```

## Challenge Question

### Background

The Mina spy master is unhappy with the current message processing systems and wants to try out Protokit.

He wants you to build a Protokit project that will receive messages as transactions, there will be one message per transaction.

Each message has

- Message number
- Message details
  - AgentID
  - 12 characters
  - Security code

The security code is a 2 character code that should match a value held in the contract for a particular agent.

The details about the agent needs to be checked against state in the contract.

This state should hold the following information

- AgentID
- Last message number received
- Security code

You can assume that this has been populated with valid data for all the existing agents.

When processing a message, ensure that:

- The AgentID exists in the system
- The security code matches that held for that AgentID
- The message is of the correct length.
- The message number is greater than the highest so far for that agent.
- You should update the agent state to store the last message number received.

The spymaster is worried that this design is not private.

Is he correct?
How could you change the system to ensure that messages are private?

## Deliverables

1. An app chain implementing the above functionality.
2. Tests for the chain to demonstrate the required functionality
3. An answer to the question regarding privacy (you don't need to implement that yet)
