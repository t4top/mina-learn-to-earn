export { AgentState, BlockHeight, PrivateMessageBox, type PrivateMessageBoxConfig };

import { runtimeModule, state, runtimeMethod } from "@proto-kit/module";
import { StateMap, assert } from "@proto-kit/protocol";
import { Field, PublicKey, Struct, UInt64 } from "o1js";
import { AgentIdHash, MessageProof } from "./offline_proof";
import { MessageBox } from "../../../../challenge_3/packages/chain/dist/message_box";

// ------------------
// Helper Classes
// ------------------

class BlockHeight extends UInt64 {}

class AgentState extends Struct({
  lastMessageNumber: Field,
  securityCodeHash: Field,
  blockHeight: BlockHeight,
  sender: PublicKey,
  nonce: UInt64,
}) {}

// ------------------
// Runtime Contract
// ------------------

interface PrivateMessageBoxConfig {
  initState: Map<AgentIdHash, AgentState>;
}

/**
 * Protokit runtime contract for receiving messages as transactions
 */
@runtimeModule()
class PrivateMessageBox extends MessageBox {
  @state() public state = StateMap.from<AgentIdHash, AgentState>(AgentIdHash, AgentState);
  @state() public blockState = StateMap.from<BlockHeight, AgentIdHash>(BlockHeight, AgentIdHash);

  /**
   * method to initialize contract state
   */
  @runtimeMethod()
  public initialize(idHash: AgentIdHash, agentState: AgentState): void {
    this.state.set(idHash, agentState);
  }

  /**
   * Runtime method to receive a message proof
   *
   * @param messageProof Incoming message proof
   */
  @runtimeMethod()
  public receiveMessageProof(messageProof: MessageProof): void {
    // verify the proof
    messageProof.verify();
    const output = messageProof.publicOutput;

    // check that the AgentID exists in the system
    const agenIdHash = output.agenIdHash;
    assert(this.state.get(agenIdHash).isSome, "AgentID does not exist in the system");
    let contractState = this.state.get(agenIdHash).value;

    // check that the security code matches that held for that AgentID
    assert(output.securityCodeHash.equals(contractState.securityCodeHash), "Security code does not match");

    // check that the message number is greater than the highest so far for that agent
    assert(
      output.messageNumber.greaterThan(contractState.lastMessageNumber),
      "Message number must be greater than the last highest in state",
    );

    // update the agent state and store the block height, sender, nonce and last message number received
    contractState.lastMessageNumber = output.messageNumber;
    contractState.blockHeight = this.network.block.height;
    contractState.sender = this.transaction.sender.value;
    contractState.nonce = this.transaction.nonce.value;
    this.state.set(agenIdHash, contractState);
  }
}
