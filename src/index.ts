import path from "path";
import { uploadFile, uploadStdin, listFiles, deleteFile, signup, getStatus, getUpgradeUrl, verifyUpgrade } from "./upload.js";
import { saveConfig, loadConfig } from "./config.js";
import { VERSION } from "./version.js";
import type { Visibility } from "./types.js";

const args = process.argv.slice(2);

function flag(name: string): string | undefined {
  const i = args.findIndex(a => a === `--${name}`);
  if (i === -1) return undefined;
  return args[i + 1];
}

function hasFlag(name: string): boolean {
  return args.includes(`--${name}`);
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

async function main() {
  const cmd = args[0];

  if (cmd === "-v" || cmd === "--version" || cmd === "version") {
    console.log(VERSION);
    return;
  }

  // upfile signup --email me@example.com [--owner-email owner@example.com]
  if (cmd === "signup") {
    const email = flag("email");
    const ownerEmail = flag("owner-email");
    if (!email) {
      console.error("Usage: upfile signup --email your@email.com [--owner-email owner@company.com]");
      process.exit(1);
    }
    const result = await signup(email, ownerEmail);
    console.log("✓ Account created");
    console.log(`API key: ${result.api_key}`);
    console.log(`Tier: ${result.tier} (${result.storage_limit_gb}GB)`);
    saveConfig({ apiKey: result.api_key });
    console.log("\nKey saved. You're ready to upload.");
    return;
  }

  // upfile status
  if (cmd === "status") {
    const status = await getStatus();
    console.log(`Tier: ${status.tier}`);
    console.log(`Storage: ${status.storage_used_gb}GB / ${status.storage_limit_gb}GB`);
    return;
  }

  // upfile upgrade [--self-pay|--notify|--verify <session>]
  if (cmd === "upgrade") {
    const selfPay = hasFlag("self-pay");
    const notify = hasFlag("notify");
    const verifySession = flag("verify");

    if (verifySession) {
      // Verify payment completed
      const result = await verifyUpgrade(verifySession);
      if (result.verified) {
        console.log(`✓ ${result.message}`);
        console.log(`Tier: ${result.tier}`);
      } else {
        console.log(`⏳ ${result.message}`);
        console.log(`Status: ${result.status}`);
      }
      return;
    }

    // Get checkout URL
    const result = await getUpgradeUrl(notify);
    if (result.checkout_url) {
      console.log(`Checkout URL: ${result.checkout_url}`);
      if (result.self_pay) {
        console.log("\n👉 Self-pay mode:");
        console.log("  1. Open the URL above in your browser");
        console.log("  2. Fill in your payment details");
        console.log("  3. After payment, run:");
        console.log(`     upfile upgrade --verify ${result.checkout_id}`);
      } else if (notify) {
        console.log(`\n📧 Owner notified: ${result.message}`);
      }
    } else {
      console.log("Manual upgrade:");
      console.log(result.message);
      console.log(`Price: ${result.price}`);
    }
    return;
  }

  // upfile config set/get
  if (cmd === "config") {
    if (args[1] === "set") {
      const [, , , key, value] = args;
      if (!key || !value) { console.error("Usage: upfile config set <key> <value>"); process.exit(1); }
      if (key === "api-key") saveConfig({ apiKey: value });
      else if (key === "endpoint") saveConfig({ endpoint: value });
      else { console.error(`Unknown config key: ${key}`); process.exit(1); }
      console.log(`✓ ${key} saved`);
    } else {
      console.log(JSON.stringify(loadConfig(), null, 2));
    }
    return;
  }

  // upfile ls [--limit N]
  if (cmd === "ls" || cmd === "list") {
    const limit = parseInt(flag("limit") || "20");
    const isJson = hasFlag("json");
    const files = await listFiles(limit);
    if (isJson) { console.log(JSON.stringify(files, null, 2)); return; }
    if (files.length === 0) { console.log("No files yet."); return; }
    for (const f of files) {
      const expires = f.expires_at ? ` (expires ${new Date(f.expires_at).toLocaleDateString()})` : "";
      console.log(`${f.id}  ${formatSize(f.size).padEnd(8)}  [${f.visibility}]${expires}`);
      console.log(`       ${f.url}`);
    }
    return;
  }

  // upfile rm <id>
  if (cmd === "rm" || cmd === "delete") {
    const id = args[1];
    if (!id) { console.error("Usage: upfile rm <id>"); process.exit(1); }
    await deleteFile(id);
    console.log(`✓ deleted ${id}`);
    return;
  }

  // upfile <file> [flags] OR stdin pipe
  const isJson = hasFlag("json");
  const isPrivate = hasFlag("private");
  const ttl = flag("expiry") ? parseInt(flag("expiry")!) : undefined;
  const visibility: Visibility = isPrivate ? "private" : ttl ? "expiring" : "public";
  const opts = { visibility, ttl, json: isJson };

  let result;
  if (!process.stdin.isTTY && !cmd) {
    result = await uploadStdin(opts);
  } else {
    const filePath = args.find(a => !a.startsWith("--"));
    if (!filePath) {
      console.error([
        "Usage:",
        "  upfile signup --email <email> [--owner-email <email>]  create account",
        "  upfile status                                           check storage",
        "  upfile upgrade [--self-pay|--notify|--verify <id>]       get upgrade link",
        "  upfile <file>                                          upload file (public)",
        "  upfile <file> --private                               private file",
        "  upfile <file> --expiry <seconds>                     expiring URL",
        "  upfile <file> --json                                  JSON output",
        "  cat file | upfile                                      pipe from stdin",
        "  upfile ls [--limit N] [--json]                         list your files",
        "  upfile rm <id>                                        delete a file",
        "  upfile config set api-key <key>",
        "  upfile config set endpoint <url>",
      ].join("\n"));
      process.exit(1);
    }
    result = await uploadFile(path.resolve(filePath), opts);
  }

  if (isJson) console.log(JSON.stringify(result, null, 2));
  else console.log(result.url);
}

main().catch(e => { console.error(e.message); process.exit(1); });
