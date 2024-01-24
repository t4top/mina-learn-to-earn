import assert from "node:assert";
import { describe, it } from "node:test";
import { AccountUpdate, Bool, Cache, Field, MerkleMap, Mina, Poseidon, PrivateKey, UInt32 } from "o1js";
import { SecretMessageBox, MAX_ADDRESS_COUNT, NO_MESSAGE, DUMMY_MESSAGE } from "./secret_message_box.js";

/**
 * This merkle map serves as the tree tracking the off-chain storage
 * It stores eligible addresses mapped to messages, i.e.
 *   [ hash(address) -> message ]
 */
const messageBoxMap = new MerkleMap();

let zkApp: SecretMessageBox;
let local: ReturnType<typeof Mina.LocalBlockchain>;

// ------------------
// Test Functions
// ------------------

describe("Challenge 1: Secret Message Box", async () => {
  const proofsEnabled = false;
  local = Mina.LocalBlockchain({ proofsEnabled });
  Mina.setActiveInstance(local);

  const zkAppPrivateKey = PrivateKey.random();
  const zkAppAddress = zkAppPrivateKey.toPublicKey();
  zkApp = new SecretMessageBox(zkAppAddress);

  // Administrator user account
  const admin = user(0);

  // Test specs
  describe("Deployment", () => {
    it("should compile contract", async () => {
      const cacheDir = "build/cache";
      if (proofsEnabled) await SecretMessageBox.compile({ cache: Cache.FileSystem(cacheDir) });
    });

    it("should deploy contract and initial states should be correct", async () => {
      const tx = await Mina.transaction(admin.publicKey, () => {
        AccountUpdate.fundNewAccount(admin.publicKey);
        zkApp.deploy();
      });
      await tx.prove();
      await tx.sign([zkAppPrivateKey, admin.privateKey]).send();

      const onChainAdmin = zkApp.admin.get();
      const onChainMapRoot = zkApp.mapRoot.get();
      const onChainAddressCount = zkApp.addressCount.get();
      const onChainMessageCount = zkApp.messageCount.get();

      assert.deepStrictEqual(onChainAdmin, Poseidon.hash(admin.publicKey.toFields()));
      assert.deepStrictEqual(onChainMapRoot, messageBoxMap.getRoot());
      assert.deepStrictEqual(onChainAddressCount, UInt32.zero);
      assert.deepStrictEqual(onChainMessageCount, UInt32.zero);
    });
  });

  describe("Function 1: storeAddress", () => {
    it("should allow storing an address by the admininistrator", async () => {
      await storeUserAddress({ sender: admin, user: user(1) });

      const onChainMapRoot = zkApp.mapRoot.get();
      const onChainAddressCount = zkApp.addressCount.get();

      assert.deepStrictEqual(onChainMapRoot, messageBoxMap.getRoot());
      assert.deepStrictEqual(onChainAddressCount, UInt32.one);
    });

    it("should not allow storing of the same address multiple times", async () => {
      await assert.rejects(storeUserAddress({ sender: admin, user: user(1) }), "Should have failed");
    });

    it("should reject storing of address by a non-admin user", async () => {
      await assert.rejects(storeUserAddress({ sender: user(1), user: user(2) }), "Should have failed");
    });

    it(`should allow the administrator to store up to ${MAX_ADDRESS_COUNT} addresses`, async () => {
      // i starts from 2 because user(1) is already stored above
      for (let i = 2; i <= MAX_ADDRESS_COUNT; i++) {
        await storeUserAddress({ sender: admin, user: user(i) });
      }

      const onChainMapRoot = zkApp.mapRoot.get();
      const onChainAddressCount = zkApp.addressCount.get();

      assert.deepStrictEqual(onChainMapRoot, messageBoxMap.getRoot());
      assert.deepStrictEqual(onChainAddressCount, new UInt32(MAX_ADDRESS_COUNT));
    });

    it(`should reject storing more than ${MAX_ADDRESS_COUNT} addresses`, async () => {
      await assert.rejects(
        storeUserAddress({ sender: admin, user: user(MAX_ADDRESS_COUNT + 1) }),
        "Should have failed"
      );
    });
  });

  describe("Function 2: depositMessage", () => {
    it("should allow an eligible user to deposit a valid message (1)", async () => {
      const message = generateMessageFromFlags({ flag1: true }); // other flags are false by default
      await depositUserMessage({ sender: user(1), message });

      const onChainMapRoot = zkApp.mapRoot.get();
      assert.deepStrictEqual(onChainMapRoot, messageBoxMap.getRoot());
    });

    it("should allow an eligible user to deposit a valid message (2)", async () => {
      const message = generateMessageFromFlags({ flag2: true, flag3: true });
      await depositUserMessage({ sender: user(2), message });

      const onChainMapRoot = zkApp.mapRoot.get();
      assert.deepStrictEqual(onChainMapRoot, messageBoxMap.getRoot());
    });

    it("should allow an eligible user to deposit a valid message (3)", async () => {
      const message = generateMessageFromFlags({ flag4: true, flag5: false, flag6: false });
      await depositUserMessage({ sender: user(3), message });

      const onChainMapRoot = zkApp.mapRoot.get();
      assert.deepStrictEqual(onChainMapRoot, messageBoxMap.getRoot());
    });

    it("should confirm a counter of messages received is updated", async () => {
      const onChainMessageCount = zkApp.messageCount.get();
      assert.deepStrictEqual(onChainMessageCount, new UInt32(3));
    });

    it("should confirm an event is emitted after successful message deposit", async () => {
      const events = await zkApp.fetchEvents();
      assert.ok(events.length > 0);
      assert.deepStrictEqual(events[0].type, "evtMessageReceived");
    });

    it("should reject depositing messages multiple times by the same user", async () => {
      const message = generateMessageFromFlags({ flag1: true });
      await assert.rejects(depositUserMessage({ sender: user(1), message }), "Should have failed");
    });

    it("should not allow a non-eligible user to deposit a message", async () => {
      const message = generateMessageFromFlags({ flag1: true });
      const nonEligibleUser = user(MAX_ADDRESS_COUNT + 1);
      await assert.rejects(depositUserMessage({ sender: nonEligibleUser, message }), "Should have failed");
    });

    it("should reject depositing a non-valid message (1)", async () => {
      await assert.rejects(depositUserMessage({ sender: user(4), message: NO_MESSAGE }), "Should have failed");
    });

    it("should reject depositing a non-valid message (2)", async () => {
      await assert.rejects(depositUserMessage({ sender: user(4), message: DUMMY_MESSAGE }), "Should have failed");
    });

    it("should reject depositing a non-valid message (3)", async () => {
      const notValidMessage = generateMessageFromFlags({ flag1: true, flag3: true });
      await assert.rejects(depositUserMessage({ sender: user(4), message: notValidMessage }), "Should have failed");
    });

    it("should reject depositing a non-valid message (4)", async () => {
      const notValidMessage = generateMessageFromFlags({ flag2: true, flag3: false });
      await assert.rejects(depositUserMessage({ sender: user(4), message: notValidMessage }), "Should have failed");
    });

    it("should reject depositing a non-valid message (5)", async () => {
      const notValidMessage = generateMessageFromFlags({ flag4: true, flag5: true });
      await assert.rejects(depositUserMessage({ sender: user(4), message: notValidMessage }), "Should have failed");
    });
  });
});

// ------------------
// Helper Functions
// ------------------

const MAX_FLAGS_SIZE = 6;

type User = ReturnType<typeof user>;

function user(index: number) {
  // TestAccounts only available up to 10
  if (index < 10) return local.testAccounts[index];

  // Use random addresses for remaining users
  const privateKey = PrivateKey.random();
  const publicKey = privateKey.toPublicKey();
  return { privateKey, publicKey };
}

const storeUserAddress = async ({ sender, user }: { sender: User; user: User }) => {
  const userHash = Poseidon.hash(user.publicKey.toFields());

  const tx = await Mina.transaction(sender.publicKey, () => {
    const witness = messageBoxMap.getWitness(userHash);
    zkApp.storeAddress(user.publicKey, witness);
  });
  await tx.prove();
  await tx.sign([sender.privateKey]).send();

  // update off-chain storage if the transaction is successful
  messageBoxMap.set(userHash, DUMMY_MESSAGE);
};

const depositUserMessage = async ({ sender, message }: { sender: User; message: Field }) => {
  const userHash = Poseidon.hash(sender.publicKey.toFields());

  const tx = await Mina.transaction(sender.publicKey, () => {
    const witness = messageBoxMap.getWitness(userHash);
    zkApp.depositMessage(message, witness);
  });
  await tx.prove();
  await tx.sign([sender.privateKey]).send();

  // update off-chain storage as well
  messageBoxMap.set(userHash, message);
};

function generateMessageFromFlags({
  flag1 = false,
  flag2 = false,
  flag3 = false,
  flag4 = false,
  flag5 = false,
  flag6 = false,
}): Field {
  let msg = Field(0).toBits();
  const len = msg.length;
  msg[len - MAX_FLAGS_SIZE + 0] = Bool(flag1);
  msg[len - MAX_FLAGS_SIZE + 1] = Bool(flag2);
  msg[len - MAX_FLAGS_SIZE + 2] = Bool(flag3);
  msg[len - MAX_FLAGS_SIZE + 3] = Bool(flag4);
  msg[len - MAX_FLAGS_SIZE + 4] = Bool(flag5);
  msg[len - MAX_FLAGS_SIZE + 5] = Bool(flag6);
  return Field.fromBits(msg);
}
