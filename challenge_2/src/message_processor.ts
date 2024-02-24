export { MessageProcessor };

import { Bool, Field, method, Provable, Reducer, SmartContract, state, State, UInt32 } from "o1js";
import { BatchMessages, Message, PublicMessage } from "./message.js";

/**
 * MessageProcessor contract for receiving messages from agents in batches.
 * It verifies the messages and dispatches their number field and validity as actions.
 * The dispatched actions are then processed when reduce is called at a later time.
 */
class MessageProcessor extends SmartContract {
  /** A state storing the highest message number that was correctly processed */
  @state(Field) highestMessageNumber = State<Field>();
  /** A field to store the point in the action history that our on-chain state is at */
  @state(Field) actionState = State<Field>();

  /** A reducer for handing actions that we can dispatch and reduce later */
  reducer = Reducer({ actionType: PublicMessage });

  init() {
    super.init();

    // initialize contract states
    this.highestMessageNumber.set(Field.empty());
    this.actionState.set(Reducer.initialActionState);
  }

  /**
   * Receive batches of messages and dispatch them as actions
   *
   * We can't dispatch message object just like that since the message details should be private inputs.
   * This means, we will do validity check off-chain and dispatch only message number and its validity.
   */
  @method
  receiveMessages(messages: BatchMessages) {
    messages.value.forEach(message => {
      const isValid = this.isValid(message);
      this.reducer.dispatch(PublicMessage.from(message.number, isValid));
    });
  }

  isValid(message: Message) {
    const { id, xLocation, yLocation, checksum } = message.agent;

    // check if Agent ID is zero
    const idIsZero = id.equals(UInt32.zero);

    // CheckSum should be the sum of Agent ID, Agent XLocation, and Agent YLocation
    const checkSumIsValid = checksum.equals(id.add(xLocation.add(yLocation)));

    // Agent ID should be between 0 and 3000
    const idIsValid = id.greaterThan(UInt32.zero).and(id.lessThan(new UInt32(3000)));

    // Agent XLocation should be between 0 and 15000
    const xLocationIsValid = xLocation.greaterThan(UInt32.zero).and(xLocation.lessThan(new UInt32(15000)));

    // Agent YLocation should be between 5000 and 20000
    const yLocationIsValid = yLocation.greaterThan(new UInt32(5000)).and(yLocation.lessThan(new UInt32(20000)));

    // Agent YLocation should be greater than Agent XLocation
    const yLocationIsGreater = yLocation.greaterThan(xLocation);

    return Provable.if(
      idIsZero,
      Bool(true),
      checkSumIsValid.and(idIsValid).and(xLocationIsValid).and(yLocationIsValid).and(yLocationIsGreater)
    );
  }

  /** Process messages by rolling up pending actions using reducer */
  @method
  processMessages() {
    // preconditions
    const highestMessageNumber = this.highestMessageNumber.getAndRequireEquals();
    const actionState = this.actionState.getAndRequireEquals();

    // get list of pending actions
    const pendingActions = this.reducer.getActions({
      fromActionState: actionState,
    });

    // reduce pending actions
    const { state: newhighestMessageNumber, actionState: newActionState } = this.reducer.reduce(
      pendingActions,
      Field,
      (state: Field, message: PublicMessage) => {
        // if the message number is not greater than the previous one, message is duplicate
        const higherNumber = Provable.if(message.number.lessThanOrEqual(state), state, message.number);
        // keep track of the highest message number that was correctly checked
        return Provable.if(message.isValid, higherNumber, state);
      },
      { state: highestMessageNumber, actionState }
    );

    // update on-chain state
    this.highestMessageNumber.set(newhighestMessageNumber);
    this.actionState.set(newActionState);
  }
}
