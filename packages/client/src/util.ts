import { createId } from "@paralleldrive/cuid2";

export const randomToken = () => {
  return Math.random().toString(36).slice(2);
};

export const randomId = () => {
  return createId();
};
