import { Balance } from "@proto-kit/library";
import { ModulesConfig } from "@proto-kit/common";
import { Balances } from "./balances";
import { MessageBox } from "./message_box";

export const modules = {
  Balances,
  MessageBox,
};

export const config: ModulesConfig<typeof modules> = {
  Balances: {
    totalSupply: Balance.from(10_000),
  },
  MessageBox: {
    initState: new Map(),
  },
};

export default {
  modules,
  config,
};
