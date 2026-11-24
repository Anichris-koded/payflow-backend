/**
 * Rebuild SQLite event projections from the locally retained contract events.
 * Stop the API/indexer before running to avoid concurrent writes.
 * Usage: npm run rebuild:projections
 */
import { StrKey } from "@stellar/stellar-sdk";
import { loadConfig, networkConfigs } from "../config.ts";
import { openStorage } from "../lib/store/index.ts";
import type { Storage } from "../lib/store/types.ts";
import { Indexer } from "../indexer.ts";
import { makeRpc } from "../lib/stellar.ts";
import { logger } from "../lib/logger.ts";

const args = process.argv.slice(2);
let merchant: string | undefined;
if (args.length > 0) {
  if (args.length !== 2 || args[0] !== "--merchant") {
    throw new Error("Usage: npm run rebuild:projections [-- --merchant <G...>]");
  }
  merchant = args[1];
  if (!merchant || !StrKey.isValidEd25519PublicKey(merchant)) {
    throw new Error("--merchant must be a valid Stellar account address");
  }
}

const config = loadConfig();
let failed = false;
for (const network of networkConfigs(config)) {
  let db: Storage | undefined;
  try {
    db = await openStorage(network);
    // Rebuild does not make RPC calls; the server is only a constructor dependency.
    const indexer = new Indexer(db, makeRpc(network), network);
    const applied = merchant
      ? await indexer.rebuildMerchantProjections(merchant)
      : await indexer.rebuildProjections();
    logger.info(
      { network: network.name, applied, ...(merchant ? { merchant } : {}) },
      merchant ? "merchant projections rebuilt from local events" : "projections rebuilt from local events",
    );
  } catch {
    failed = true;
    // Do not serialize thrown errors: RPC and environment secrets may be embedded.
    logger.error({ network: network.name }, "projection rebuild failed");
  } finally {
    await db?.close();
  }
}
if (failed) process.exitCode = 1;
