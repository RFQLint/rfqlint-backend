import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import { runAndRecordCheck } from "./checker.js";
import { getEntry, listEntries } from "./store.js";
import { getOnChainAttestation } from "./contract.js";

const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;

function isValidDomain(domain: unknown): domain is string {
  return typeof domain === "string" && domain.length <= 253 && DOMAIN_RE.test(domain);
}

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/healthz", (_req, res) => {
    res.json({ ok: true });
  });

  app.post("/api/checks", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { domain } = req.body ?? {};
      if (!isValidDomain(domain)) {
        return res.status(400).json({ error: "body must include a valid `domain` hostname" });
      }
      const entry = await runAndRecordCheck(domain);
      res.status(201).json(entry);
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/checks/:domain", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const entry = await getEntry(req.params.domain);
      if (!entry) return res.status(404).json({ error: "no stored check for this domain" });
      res.json(entry);
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/registry", async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const entries = await listEntries();
      res.json(
        entries.map(({ domain, passed, checkedAt, txHash }) => ({ domain, passed, checkedAt, txHash })),
      );
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/registry/:domain/onchain", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const attestation = await getOnChainAttestation(req.params.domain);
      if (!attestation) return res.status(404).json({ error: "no on-chain attestation for this domain" });
      res.json({
        domain: req.params.domain,
        passed: attestation.passed,
        timestamp: attestation.timestamp.toString(),
        resultHash: Buffer.from(attestation.result_hash).toString("hex"),
      });
    } catch (err) {
      next(err);
    }
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(502).json({ error: err.message });
  });

  return app;
}
