# Learn-to-earn Challenge 2

## How to build and test

```sh
npm install
npm run test
```

## Challenge Question

### Background

The Mina spy master is receiving messages from agents, these arrive in batches, typically between 50 to 200 messages at a time, each message is identified by a message number.

The spy master wants you to write a program to check that the messages are valid. In particular a contract that can process batches of transactions and at the end store the highest message number that was processed.

### Each message has

- Message number
- Message details
  - Agent ID (should be between 0 and 3000)
  - Agent XLocation (should be between 0 and 15000)
  - Agent YLocation (should be between 5000 and 20000)
  - CheckSum

The message details should be private inputs.

Your program should process a batch of messages as it comes in and keep track of the highest message number that was correctly checked.

### You need to check that

- CheckSum is the sum of Agent ID, Agent XLocation, and Agent YLocation
- the 4 message details numbers are in the correct range
- Agent YLocation should be greater than Agent XLocation

If Agent ID is zero we don't need to check the other values, but this is still a valid message.

If the message details are incorrect, you can drop that message and carry on processing the next one.

In case the message number is not greater than the previous one, this means that this is a duplicate message. In this case it still should be processed, but the message details do not need to be checked.

This program is needed to run on low spec hardware so you need to find a way to process the batch so that the circuit size remains low.

The highest message number processed should be stored in a contract, this is the only value that needs to be persisted.

## Deliverables

1. A smart contract implementing the above functionality.
2. Tests for the contract.
