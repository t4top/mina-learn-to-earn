import { Balance } from "@proto-kit/library";
import { ModulesConfig } from "@proto-kit/common";
import { Balances } from "./balances";
import { PrivateMessageBox } from "./private_message_box";

export const modules = {
  Balances,
  PrivateMessageBox,
};

export const config: ModulesConfig<typeof modules> = {
  Balances: {
    totalSupply: Balance.from(10_000),
  },
  PrivateMessageBox: {
    initState: new Map(),
  },
};

export default {
  modules,
  config,
};
