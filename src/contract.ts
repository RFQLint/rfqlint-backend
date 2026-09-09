import {
  Contract,
  TransactionBuilder,
  rpc,
  nativeToScVal,
  scValToNative,
  Keypair,
  BASE_FEE,
  type xdr,
} from "@stellar/stellar-sdk";
import { config } from "./config.js";

const server = new rpc.Server(config.sorobanRpcUrl);
const contract = new Contract(config.contractId);
const signer = Keypair.fromSecret(config.stellarSecretKey);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Read-only contract call: simulates only, never submits a transaction. */
export async function readContract<T>(method: string, args: xdr.ScVal[] = []): Promise<T | undefined> {
  const account = await server.getAccount(signer.publicKey());
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(`Simulation failed for ${method}: ${sim.error}`);
  }
  if (!rpc.Api.isSimulationSuccess(sim) || !sim.result) {
    return undefined;
  }
  return scValToNative(sim.result.retval) as T;
}

/** Writes to the contract: builds, signs, submits, and polls to completion. */
export async function writeContract<T>(method: string, args: xdr.ScVal[]): Promise<{ result: T; txHash: string }> {
  const account = await server.getAccount(signer.publicKey());
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const prepared = await server.prepareTransaction(tx);
  prepared.sign(signer);

  const sendResult = await server.sendTransaction(prepared);
  if (sendResult.status === "ERROR") {
    throw new Error(`Failed to submit ${method}: ${JSON.stringify(sendResult.errorResult)}`);
  }

  let getResult = await server.getTransaction(sendResult.hash);
  const deadline = Date.now() + 30_000;
  while (getResult.status === rpc.Api.GetTransactionStatus.NOT_FOUND) {
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${method} (${sendResult.hash})`);
    await sleep(1000);
    getResult = await server.getTransaction(sendResult.hash);
  }

  if (getResult.status !== rpc.Api.GetTransactionStatus.SUCCESS) {
    throw new Error(`Transaction ${sendResult.hash} for ${method} failed: ${getResult.status}`);
  }

  const result = getResult.returnValue ? (scValToNative(getResult.returnValue) as T) : (undefined as T);
  return { result, txHash: sendResult.hash };
}

export interface Attestation {
  timestamp: bigint;
  passed: boolean;
  result_hash: Buffer;
}

export async function getOnChainAttestation(domain: string): Promise<Attestation | undefined> {
  return readContract<Attestation>("get_attestation", [nativeToScVal(domain, { type: "string" })]);
}

export async function submitAttestation(
  domain: string,
  passed: boolean,
  resultHash: Buffer,
): Promise<{ txHash: string }> {
  const { txHash } = await writeContract<void>("attest", [
    nativeToScVal(domain, { type: "string" }),
    nativeToScVal(passed, { type: "bool" }),
    nativeToScVal(resultHash, { type: "bytes" }),
  ]);
  return { txHash };
}

export function backendPublicKey(): string {
  return signer.publicKey();
}
