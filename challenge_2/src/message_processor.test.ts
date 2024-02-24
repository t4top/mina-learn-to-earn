import assert from "node:assert";
import { describe, it } from "node:test";
import { AccountUpdate, Cache, Field, Mina, PrivateKey, Reducer, UInt32 } from "o1js";
import { MessageProcessor } from "./message_processor.js";
import { Message, BatchMessages, BATCH_SIZE } from "./message.js";
import { Agent } from "./agent.js";

let zkApp: MessageProcessor;
let local: ReturnType<typeof Mina.LocalBlockchain>;

// ------------------
// Test Functions
// ------------------

describe("Challenge 2: Message Processor", async () => {
  const proofsEnabled = false;
  local = Mina.LocalBlockchain({ proofsEnabled });
  Mina.setActiveInstance(local);

  const zkAppPrivateKey = PrivateKey.random();
  const zkAppAddress = zkAppPrivateKey.toPublicKey();
  zkApp = new MessageProcessor(zkAppAddress);

  const log = (s = "") => {
    const highestMessageNumber = zkApp.highestMessageNumber.get();
    console.log(s, "highestMessageNumber:", highestMessageNumber.toString());

    const actionState = zkApp.actionState.get();
    const pendingActions = zkApp.reducer.getActions({ fromActionState: actionState });
    console.log(s, "pendingActions.length:", pendingActions.length);
    console.log(s, "pendingActions:", JSON.stringify(pendingActions));
  };

  // Test specs
  describe("Deployment", () => {
    it("should compile contract", async () => {
      const cacheDir = "build/cache";
      if (proofsEnabled) await MessageProcessor.compile({ cache: Cache.FileSystem(cacheDir) });
    });

    it("should deploy contract and initial states should be correct", async () => {
      const sender = local.testAccounts[0];
      const tx = await Mina.transaction(sender.publicKey, () => {
        AccountUpdate.fundNewAccount(sender.publicKey);
        zkApp.deploy();
      });
      await tx.prove();
      await tx.sign([zkAppPrivateKey, sender.privateKey]).send();

      const highestMessageNumber = zkApp.highestMessageNumber.get();
      const actionState = zkApp.actionState.get();

      assert.deepStrictEqual(highestMessageNumber, Field.empty());
      assert.deepStrictEqual(actionState, Reducer.initialActionState);
    });
  });

  describe("Contract Tests", () => {
    it("should process a message with zero as Agent ID", async () => {
      const msgNum = 1;
      const message = createMessage(msgNum, createAgent(0));

      await sendBatchMessages([message]);
      await rollup();

      const highestMessageNumber = zkApp.highestMessageNumber.get();
      assert.deepStrictEqual(highestMessageNumber, Field(msgNum));
    });

    it("should process a message with correct details", async () => {
      const msgNum = 2;
      const message = createMessage(msgNum, createAgent(1));

      await sendBatchMessages([message]);
      await rollup();

      const highestMessageNumber = zkApp.highestMessageNumber.get();
      assert.deepStrictEqual(highestMessageNumber, Field(msgNum));
    });

    it("should process message as duplicate if the message number is not greater than the previous one", async () => {
      const msgNum = 1;
      const message = createMessage(msgNum, createAgent(2));

      await sendBatchMessages([message]);
      await rollup();

      // previous highest number (i.e. 2) remains unchanged
      const highestMessageNumber = zkApp.highestMessageNumber.get();
      assert.deepStrictEqual(highestMessageNumber, Field(2));
    });

    it(`should process ${BATCH_SIZE} valid messages as a batch. The highest message number is ${BATCH_SIZE}`, async () => {
      let messages: Message[] = [];
      for (let i = 1; i <= BATCH_SIZE; i++) {
        messages.push(createMessage(i, createAgent(3)));
      }

      await sendBatchMessages(messages);
      await rollup();

      const highestMessageNumber = zkApp.highestMessageNumber.get();
      assert.deepStrictEqual(highestMessageNumber, Field(BATCH_SIZE));
    });

    it("should drop messages with incorrect Agent IDs", async () => {
      const msgNum = BATCH_SIZE + 10;
      const invalidAgentId1 = createAgent(3000);
      const message1 = createMessage(msgNum, invalidAgentId1);

      const invalidAgentId2 = createAgent(5000);
      const message2 = createMessage(msgNum, invalidAgentId2);

      await sendBatchMessages([message1, message2]);
      await rollup();

      // previous highest number remains unchanged
      const highestMessageNumber = zkApp.highestMessageNumber.get();
      assert.deepStrictEqual(highestMessageNumber, Field(BATCH_SIZE));
    });

    it("should drop messages with incorrect Agent XLocation", async () => {
      const msgNum = BATCH_SIZE + 10;
      const invalidAgentXLocation1 = createAgent(4, 0);
      const message1 = createMessage(msgNum, invalidAgentXLocation1);

      const invalidAgentXLocation2 = createAgent(5, 15000);
      const message2 = createMessage(msgNum, invalidAgentXLocation2);

      await sendBatchMessages([message1, message2]);
      await rollup();

      // previous highest number remains unchanged
      const highestMessageNumber = zkApp.highestMessageNumber.get();
      assert.deepStrictEqual(highestMessageNumber, Field(BATCH_SIZE));
    });

    it("should drop messages with incorrect Agent YLocation", async () => {
      const msgNum = BATCH_SIZE + 10;
      const invalidAgentYLocation1 = createAgent(6, 1000, 4999);
      const message1 = createMessage(msgNum, invalidAgentYLocation1);

      const invalidAgentYLocation2 = createAgent(7, 10000, 20000);
      const message2 = createMessage(msgNum, invalidAgentYLocation2);

      await sendBatchMessages([message1, message2]);
      await rollup();

      // previous highest number remains unchanged
      const highestMessageNumber = zkApp.highestMessageNumber.get();
      assert.deepStrictEqual(highestMessageNumber, Field(BATCH_SIZE));
    });

    it("should drop messages with incorrect checkSum", async () => {
      const msgNum = BATCH_SIZE + 10;
      const invalidCheckSum1 = createAgent(6, 1000, 7000, 1);
      const message1 = createMessage(msgNum, invalidCheckSum1);

      const invalidCheckSum2 = createAgent(7, 10000, 19000, 10);
      const message2 = createMessage(msgNum, invalidCheckSum2);

      await sendBatchMessages([message1, message2]);
      await rollup();

      // previous highest number remains unchanged
      const highestMessageNumber = zkApp.highestMessageNumber.get();
      assert.deepStrictEqual(highestMessageNumber, Field(BATCH_SIZE));
    });

    it("should drop messages with YLocation NOT greater than XLocation", async () => {
      const msgNum = BATCH_SIZE + 10;
      const yLocationEqual = createAgent(8, 7000, 7000);
      const message1 = createMessage(msgNum, yLocationEqual);

      const yLocationLess = createAgent(9, 10000, 9000);
      const message2 = createMessage(msgNum, yLocationLess);

      await sendBatchMessages([message1, message2]);
      await rollup();

      // previous highest number remains unchanged
      const highestMessageNumber = zkApp.highestMessageNumber.get();
      assert.deepStrictEqual(highestMessageNumber, Field(BATCH_SIZE));
    });

    it("should store highest message number on-chain", async () => {
      const highestNum = 100000;

      const message1 = createMessage(100);
      const message2 = createMessage(BATCH_SIZE);
      const message3 = createMessage(highestNum); // highest
      const message4 = createMessage(250);
      const message5 = createMessage(1);

      await sendBatchMessages([message1, message2, message3, message4, message5]);
      await rollup();

      const highestMessageNumber = zkApp.highestMessageNumber.get();
      assert.deepStrictEqual(highestMessageNumber, Field(highestNum));
    });
  });
});

// ------------------
// Helper Functions
// ------------------

function createAgent(id: number = 1, xLoc: number = 1000, yLoc: number = 6000, checksum?: number) {
  return new Agent({
    id: UInt32.from(id),
    xLocation: UInt32.from(xLoc),
    yLocation: UInt32.from(yLoc),
    checksum: UInt32.from(checksum ? checksum : id + xLoc + yLoc),
  });
}

function createMessage(num: number = 0, agent?: Agent) {
  return new Message({
    number: Field(num),
    agent: agent ? agent : createAgent(num !== 0 ? 0 : 3000),
  });
}

async function sendBatchMessages(messages: Message[]) {
  // ensure batch size is correct
  const batchMsgs = messages.concat(new Array(BATCH_SIZE).fill(createMessage())).slice(0, BATCH_SIZE);

  // send the messages as a batch
  const sender = local.testAccounts[0];
  const tx = await Mina.transaction(sender.publicKey, () => {
    zkApp.receiveMessages(BatchMessages.from(batchMsgs));
  });
  await tx.prove();
  await tx.sign([sender.privateKey]).send();
}

async function rollup() {
  const sender = local.testAccounts[0];
  const tx = await Mina.transaction(sender.publicKey, () => {
    zkApp.processMessages();
  });
  await tx.prove();
  await tx.sign([sender.privateKey]).send();
}
