import { TestingAppChain } from "@proto-kit/sdk";
import { Field, Poseidon, PrivateKey, PublicKey, UInt64 } from "o1js";
import { AgentState, PrivateMessageBox } from "../src/private_message_box";
import { AgentIdHash, messageValidator } from "../src/offline_proof";
import { AgentId, Message, MessageDetails, String } from "../../../../challenge_3/packages/chain/dist/message_box";
import { log } from "@proto-kit/common";

log.setLevel("ERROR");

let appChain: ReturnType<typeof TestingAppChain.fromRuntime<{ PrivateMessageBox: typeof PrivateMessageBox }>>;
let messageBox: PrivateMessageBox;

const privateKey = PrivateKey.random();
const publicKey = privateKey.toPublicKey();

// Initialize Agents list
const agentId1 = new AgentId("1");
const agentIdHash1 = createAgentHash(agentId1);
const agentState1 = createAgentState(0, "AB");

describe("Challenge 3: PrivateMessageBox", () => {
  beforeAll(async () => {
    appChain = TestingAppChain.fromRuntime({
      PrivateMessageBox,
    });

    appChain.configurePartial({
      Runtime: {
        Balances: {},
        PrivateMessageBox: {
          initState: new Map(),
        },
      },
    });

    await appChain.start();
    appChain.setSigner(privateKey);

    messageBox = appChain.runtime.resolve("PrivateMessageBox");

    // initialize contract state
    const block = await sendTransaction(() => messageBox.initialize(agentIdHash1, agentState1));

    expect(block?.transactions[0].status.toBoolean()).toBe(true);
  }, 1_000_000);

  it("should deploy contract and initial states should be correct", async () => {
    const contractAgentState1 = await appChain.query.runtime.PrivateMessageBox.state.get(agentIdHash1);
    expect(contractAgentState1?.lastMessageNumber).toStrictEqual(Field(0));
  }, 1_000_000);

  it("should receive valid message for a valid agent", async () => {
    const message = createMessage(10, generateRandomString(12), agentId1, "AB");

    const messageProof = await messageValidator.verifyUserInputs(message);

    const block = await sendTransaction(() => messageBox.receiveMessageProof(messageProof));

    expect(block?.transactions[0].status.toBoolean()).toBe(true);

    const contractAgentState1 = await appChain.query.runtime.PrivateMessageBox.state.get(agentIdHash1);
    expect(contractAgentState1?.lastMessageNumber).toStrictEqual(Field(10));
  }, 1_000_000);
});

// ------------------
// Helper Functions
// ------------------

function createAgentHash(agentId: AgentId) {
  return new AgentIdHash(Poseidon.hash(agentId.toFields()));
}

function stringHash(str: string) {
  return Poseidon.hash(String.fromString(str).getValue().toFields());
}

function createAgentState(lastMessageNo: number, securityCode: string) {
  return new AgentState({
    lastMessageNumber: Field(lastMessageNo),
    securityCodeHash: stringHash(securityCode),
    blockHeight: UInt64.zero,
    sender: PublicKey.empty(),
    nonce: UInt64.zero,
  });
}

function createMessage(msgNum: number, msgText: string, agentId: AgentId, agentSecurityCode: string) {
  return new Message({
    number: Field(msgNum),
    details: new MessageDetails({
      agentId,
      characters: String.fromString(msgText),
      securityCode: String.fromString(agentSecurityCode),
    }),
  });
}

async function sendTransaction(callback: () => void) {
  const tx = await appChain.transaction(publicKey, callback);
  await tx.sign();
  await tx.send();
  const block = await appChain.produceBlock();

  return block;
}

function generateRandomString(length: number) {
  let result = "";
  const characters = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}
