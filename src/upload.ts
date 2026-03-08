import fs from "fs";
import path from "path";
import FormData from "form-data";
import fetch from "node-fetch";
import { loadConfig, DEFAULT_ENDPOINT } from "./config.js";
import type { UploadOptions, UploadResponse } from "./types.js";

function getAuth() {
  const config = loadConfig();
  const apiKey = config.apiKey || process.env.UPFILE_API_KEY;
  const endpoint = config.endpoint || DEFAULT_ENDPOINT;
  if (!apiKey) throw new Error("No API key. Run: upfile signup --email your@email.com");
  return { apiKey, endpoint };
}

export async function signup(email: string, ownerEmail?: string): Promise<{ api_key: string; tier: string; storage_limit_gb: number; message: string }> {
  const { endpoint } = getAuth();
  const res = await fetch(`${endpoint}/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, owner_email: ownerEmail }),
  });
  if (!res.ok) throw new Error(`Signup failed (${res.status}): ${await res.text()}`);
  return res.json() as Promise<{ api_key: string; tier: string; storage_limit_gb: number; message: string }>;
}

export async function getStatus(): Promise<{ tier: string; storage_used_gb: string; storage_limit_gb: string }> {
  const { apiKey, endpoint } = getAuth();
  const res = await fetch(`${endpoint}/status`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`Status check failed (${res.status}): ${await res.text()}`);
  const data = await res.json() as { tier: string; storage_used_gb: string; storage_limit_gb: string };
  return data;
}

export async function getUpgradeUrl(notify = false): Promise<{ checkout_url?: string; checkout_id?: string; client_secret?: string; message: string; price?: string; self_pay?: boolean }> {
  const { apiKey, endpoint } = getAuth();
  const url = notify ? `${endpoint}/upgrade?notify=true` : `${endpoint}/upgrade`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`Upgrade check failed (${res.status}): ${await res.text()}`);
  return res.json() as Promise<{ checkout_url?: string; checkout_id?: string; client_secret?: string; message: string; price?: string; self_pay?: boolean }>;
}

export async function verifyUpgrade(sessionId: string): Promise<{ verified: boolean; status?: string; tier?: string; message: string }> {
  const { apiKey, endpoint } = getAuth();
  const res = await fetch(`${endpoint}/upgrade/verify?session=${sessionId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`Verify failed (${res.status}): ${await res.text()}`);
  return res.json() as Promise<{ verified: boolean; status?: string; tier?: string; message: string }>;
}

export async function uploadFile(filePath: string, opts: UploadOptions): Promise<UploadResponse> {
  const { apiKey, endpoint } = getAuth();
  const form = new FormData();
  form.append("file", fs.createReadStream(filePath), path.basename(filePath));
  form.append("visibility", opts.visibility);
  if (opts.ttl) form.append("ttl", String(opts.ttl));

  const res = await fetch(`${endpoint}/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, ...form.getHeaders() },
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(async () => ({ error: await res.text() }));
    const errorObj = err as { error?: string; storage_used_gb?: string; limit_gb?: string; message?: string };
    if (errorObj.error?.includes("Storage limit")) {
      throw new Error(
        `Storage limit reached (${errorObj.storage_used_gb}GB / ${errorObj.limit_gb}GB).\n` +
        `Options:\n` +
        `  • upfile upgrade --self-pay    # Pay with your AgentCard\n` +
        `  • upfile upgrade --notify      # Ask owner to pay`
      );
    }
    throw new Error(`Upload failed (${res.status}): ${errorObj.error || await res.text()}`);
  }
  return res.json() as Promise<UploadResponse>;
}

export async function uploadStdin(opts: UploadOptions): Promise<UploadResponse> {
  const { apiKey, endpoint } = getAuth();
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  const buffer = Buffer.concat(chunks);
  const form = new FormData();
  form.append("file", buffer, { filename: "upload.bin", contentType: "application/octet-stream" });
  form.append("visibility", opts.visibility);
  if (opts.ttl) form.append("ttl", String(opts.ttl));

  const res = await fetch(`${endpoint}/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, ...form.getHeaders() },
    body: form,
  });
  if (!res.ok) throw new Error(`Upload failed (${res.status}): ${await res.text()}`);
  return res.json() as Promise<UploadResponse>;
}

export async function listFiles(limit = 20): Promise<UploadResponse[]> {
  const { apiKey, endpoint } = getAuth();
  const res = await fetch(`${endpoint}/files?limit=${limit}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`List failed (${res.status}): ${await res.text()}`);
  const data = await res.json() as { files: UploadResponse[] };
  return data.files;
}

export async function deleteFile(id: string): Promise<void> {
  const { apiKey, endpoint } = getAuth();
  const res = await fetch(`${endpoint}/f/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`Delete failed (${res.status}): ${await res.text()}`);
}
