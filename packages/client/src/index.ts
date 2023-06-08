export interface Artico {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}
