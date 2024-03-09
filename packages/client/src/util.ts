import { customAlphabet } from "nanoid";

const nanoid = customAlphabet(
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
  24,
);

export const randomToken = () => {
  return nanoid(10);
};

export const randomId = () => {
  return nanoid();
};
