export { Agent };

import { Poseidon, Struct, UInt32 } from "o1js";

/** Agent class */
class Agent extends Struct({
  id: UInt32,
  xLocation: UInt32,
  yLocation: UInt32,
  checksum: UInt32,
}) {
  hash() {
    return Poseidon.hash(Agent.toFields(this));
  }
}
