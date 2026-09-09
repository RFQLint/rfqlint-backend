function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const config = {
  port: Number(process.env.PORT ?? 3003),
  stellarSecretKey: required("STELLAR_SECRET_KEY"),
  contractId: process.env.CONTRACT_ID ?? "CDWRHACVHZ7EDIUKKA64H34KNNQBISWWF2CZWYL3DG36IR2BPJ2M3UBD",
  sorobanRpcUrl: process.env.SOROBAN_RPC_URL ?? "https://soroban-testnet.stellar.org",
  networkPassphrase: process.env.NETWORK_PASSPHRASE ?? "Test SDF Network ; September 2015",
};

export function storePath(): string {
  return process.env.STORE_PATH ?? "./data/registry.json";
}
