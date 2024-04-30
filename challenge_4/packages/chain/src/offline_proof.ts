export { AgentIdHash, messageValidator, MessageProof, PublicOutput };

import { Experimental, Field, Poseidon, Struct } from "o1js";
import { assert } from "@proto-kit/protocol";
import { Message, CHARACTERS_LENGTH, CODE_LENGTH } from "../../../../challenge_3/packages/chain/dist/message_box";

class AgentIdHash extends Field {}

class PublicOutput extends Struct({
  agenIdHash: AgentIdHash,
  securityCodeHash: Field,
  messageNumber: Field,
}) {}

function validateMessage(message: Message): PublicOutput {
  const agentId = message.details.agentId;
  const characters = message.details.characters;
  const securityCode = message.details.characters;

  // check that the message is of the correct length
  assert(characters.getLength().equals(Field(CHARACTERS_LENGTH)), "Message length is wrong");
  assert(securityCode.getLength().equals(Field(CODE_LENGTH)), "Security code length is wrong");

  // calculate hash of the agent's ID and security code
  const agenIdHash = Poseidon.hash([agentId]);
  const securityCodeHash = Poseidon.hash(securityCode.getValue().toFields());

  // return only public output
  return new PublicOutput({
    agenIdHash,
    securityCodeHash,
    messageNumber: message.number,
  });
}

const messageValidator = Experimental.ZkProgram({
  key: "messageValidator",
  publicOutput: PublicOutput,

  methods: {
    verifyUserInputs: {
      privateInputs: [Message],
      method: validateMessage,
    },
  },
});

const _MessageProof = Experimental.ZkProgram.Proof(messageValidator);
class MessageProof extends _MessageProof {}
