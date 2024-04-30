import { TestingAppChain } from "@proto-kit/sdk";
import { Field, PrivateKey } from "o1js";
import { AgentId, AgentState, Message, MessageDetails, MessageBox, String } from "../src/message_box";
import { log } from "@proto-kit/common";

log.setLevel("ERROR");

let appChain: ReturnType<typeof TestingAppChain.fromRuntime<{ MessageBox: typeof MessageBox }>>;
let messageBox: MessageBox;

const privateKey = PrivateKey.random();
const publicKey = privateKey.toPublicKey();

// Initialize Agents list
const agentId1 = new AgentId("1");
const agentState1 = createAgentState(0, "AB");

const agentId2 = new AgentId("2");
const agentState2 = createAgentState(0, "CD");

const agentId3 = new AgentId("3");
const agentState3 = createAgentState(0, "EF");

describe("Challenge 3: MessageBox", () => {
  beforeAll(async () => {
    appChain = TestingAppChain.fromRuntime({
      MessageBox,
    });

    appChain.configurePartial({
      Runtime: {
        Balances: {},
        MessageBox: {
          initState: new Map([
            [agentId1, agentState1],
            [agentId2, agentState2],
            [agentId3, agentState3],
          ]),
        },
      },
    });

    await appChain.start();
    appChain.setSigner(privateKey);

    messageBox = appChain.runtime.resolve("MessageBox");

    // initialize contract state
    const block = await sendTransaction(() => messageBox.init());

    expect(block?.transactions[0].status.toBoolean()).toBe(true);
  }, 1_000_000);

  it("should deploy contract and initial states should be correct", async () => {
    const contractAgentState2 = await appChain.query.runtime.MessageBox.contractState.get(agentId2);
    expect(contractAgentState2?.securityCode.getValue().toString()).toBe("CD");

    const contractAgentState3 = await appChain.query.runtime.MessageBox.contractState.get(agentId3);
    expect(contractAgentState3?.lastMessageNumber).toStrictEqual(Field(0));
    expect(contractAgentState3?.securityCode.getValue().toString()).toBe("EF");
  }, 1_000_000);

  it("should receive valid message for a valid agent", async () => {
    const message = createMessage(10, generateRandomString(12), agentId1, "AB");
    const block = await sendTransaction(() => messageBox.receiveMessage(message));

    expect(block?.transactions[0].status.toBoolean()).toBe(true);

    const contractAgentState1 = await appChain.query.runtime.MessageBox.contractState.get(agentId1);
    expect(contractAgentState1?.lastMessageNumber).toStrictEqual(Field(10));
  }, 1_000_000);
});

// ------------------
// Helper Functions
// ------------------

function createAgentState(lastMessageNo: number, securityCode: string) {
  return new AgentState({ lastMessageNumber: Field(lastMessageNo), securityCode: String.fromString(securityCode) });
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
