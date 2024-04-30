export {
  AgentId,
  AgentState,
  CHARACTERS_LENGTH,
  CODE_LENGTH,
  Message,
  MessageDetails,
  MessageBox,
  type MessageBoxConfig,
  String,
};

import { runtimeModule, state, runtimeMethod, RuntimeModule } from "@proto-kit/module";
import { StateMap, assert } from "@proto-kit/protocol";
import { Bool, CircuitString, Field, Provable, Struct } from "o1js";

/** Number of characters in a message details */
const CHARACTERS_LENGTH = 12;

/** Security code length */
const CODE_LENGTH = 2;

// ------------------
// Helper Classes
// ------------------

class AgentId extends Field {}

/** generic String class for handling CircuitString and its length calculation */
class String extends Struct({
  value: CircuitString,
}) {
  static fromString(val: string) {
    return new String({ value: CircuitString.fromString(val) });
  }

  getValue() {
    return this.value as CircuitString;
  }

  getLength() {
    let length = Field(0);
    for (let i = 0; i < CircuitString.maxLength; i++) {
      const character = (this.value as CircuitString).values[i];
      length = Provable.if(Bool.and(length.equals(0), character.value.equals(0)), Field.from(i), length);
    }

    return length;
  }
}

class AgentState extends Struct({
  lastMessageNumber: Field,
  securityCode: String,
}) {}

class MessageDetails extends Struct({
  agentId: AgentId,
  characters: String,
  securityCode: String,
}) {}

/** Message class */
class Message extends Struct({
  number: Field,
  details: MessageDetails,
}) {}

// ------------------
// Runtime Contract
// ------------------

interface MessageBoxConfig {
  initState: Map<AgentId, AgentState>;
}

/**
 * Protokit runtime contract for receiving messages as transactions
 */
@runtimeModule()
class MessageBox extends RuntimeModule<MessageBoxConfig> {
  @state() public contractState = StateMap.from<AgentId, AgentState>(AgentId, AgentState);

  /**
   * method to initialize contract state using module configuration
   */
  @runtimeMethod()
  public init(): void {
    this.config.initState.forEach((value, key) => this.contractState.set(key, value));
  }

  /**
   * Runtime method to receive a message; there is one message per transaction.
   *
   * @param message Incoming message
   */
  @runtimeMethod()
  public receiveMessage(message: Message): void {
    const agentId = message.details.agentId;

    // check that the AgentID exists in the system
    assert(this.contractState.get(agentId).isSome, "AgentID does not exist in the system");
    let contractState = this.contractState.get(agentId).value;

    // check that the security code matches that held for that AgentID
    assert(
      message.details.securityCode.getValue().equals(contractState.securityCode.getValue()),
      "Security code does not match",
    );

    // check that the message is of the correct length
    assert(message.details.characters.getLength().equals(Field(CHARACTERS_LENGTH)), "Message length is wrong");
    assert(message.details.securityCode.getLength().equals(Field(CODE_LENGTH)), "Security code length is wrong");

    // check that the message number is greater than the highest so far for that agent
    assert(
      message.number.greaterThan(contractState.lastMessageNumber),
      "Message number must be greater than the last highest in state",
    );

    // update the agent state and store the last message number received
    contractState.lastMessageNumber = message.number;
    this.contractState.set(agentId, contractState);
  }
}
