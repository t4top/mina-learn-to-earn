export { Message, PublicMessage, BatchMessages, BATCH_SIZE };

import { Bool, Field, Poseidon, Provable, Struct } from "o1js";
import { Agent } from "./agent.js";

/** Message class with secret private details. This is processed only off-chain */
class Message extends Struct({ number: Field, agent: Agent }) {}

/** Public message class that is dispatched */
class PublicMessage extends Struct({ number: Field, isValid: Bool }) {
  static from(number: Field, isValid: Bool) {
    return new PublicMessage({ number, isValid });
  }
}

/** Number of messages sent in a batch at a time */
const BATCH_SIZE = 10;

/** Helper class for batching multiple Message objects together as a Provable Array */
class BatchMessages extends Struct({ value: Provable.Array(Message, BATCH_SIZE) }) {
  static from(messages: Message[]) {
    return new BatchMessages({ value: messages });
  }

  hash() {
    return Poseidon.hash(BatchMessages.toFields(this));
  }
}
