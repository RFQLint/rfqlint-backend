import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";

const app = createApp();

describe("GET /healthz", () => {
  it("reports ok", async () => {
    const res = await request(app).get("/healthz");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});

describe("POST /api/checks", () => {
  it("rejects a missing domain", async () => {
    const res = await request(app).post("/api/checks").send({});
    expect(res.status).toBe(400);
  });

  it("rejects a malformed domain", async () => {
    const res = await request(app).post("/api/checks").send({ domain: "not a domain" });
    expect(res.status).toBe(400);
  });

  it("runs a real check against a domain with no SEP-38 support and records failure", async () => {
    const res = await request(app).post("/api/checks").send({ domain: "example.com" });
    expect(res.status).toBe(201);
    expect(res.body.passed).toBe(false);
    expect(res.body.txHash).toBe("");
  }, 30_000);
});

describe("GET /api/checks/:domain", () => {
  it("404s for a domain with no stored check", async () => {
    const res = await request(app).get("/api/checks/never-checked.example.org");
    expect(res.status).toBe(404);
  });

  it("returns a previously recorded check", async () => {
    await request(app).post("/api/checks").send({ domain: "example.net" });
    const res = await request(app).get("/api/checks/example.net");
    expect(res.status).toBe(200);
    expect(res.body.domain).toBe("example.net");
  }, 30_000);
});

describe("GET /api/registry", () => {
  it("includes domains that were checked, without the full report", async () => {
    await request(app).post("/api/checks").send({ domain: "registry-list.example.com" });
    const res = await request(app).get("/api/registry");
    expect(res.status).toBe(200);
    const listed = res.body.find((e: { domain: string }) => e.domain === "registry-list.example.com");
    expect(listed).toBeDefined();
    expect(listed.report).toBeUndefined();
  }, 30_000);
});

describe("GET /api/registry/:domain/onchain", () => {
  it("404s for a domain that was never attested on-chain", async () => {
    const res = await request(app).get("/api/registry/definitely-not-attested.example.org/onchain");
    expect(res.status).toBe(404);
  });
});
