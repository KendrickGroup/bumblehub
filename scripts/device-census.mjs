#!/usr/bin/env node
/**
 * Local smart-home network census. Run on a Mac on the LAN:
 *
 *   node scripts/device-census.mjs
 *
 * Pings the active /24, reads ARP, decodes a built-in OUI table, and
 * listens for Tuya UDP discovery via Python tinytuya.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import dns from "node:dns/promises";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const OUI_PATH = path.join(__dirname, "device-census-oui.json");

const PING_CONCURRENCY = 64;
const PING_TIMEOUT_MS = 200;
const DNS_TIMEOUT_MS = 400;
const TUYA_SCAN_SECONDS = 18;
const SMART_HOST_RE = /esp|smart|tuya|plug|switch/i;

const execOpts = { timeout: 15_000, maxBuffer: 2 * 1024 * 1024 };

function log(msg) {
  process.stderr.write(`${msg}\n`);
}

function normalizeMac(raw) {
  if (!raw) return null;
  const hex = raw
    .trim()
    .toLowerCase()
    .replace(/-/g, ":")
    .replace(/^0x/, "");
  const parts = hex.split(":").filter(Boolean);
  if (parts.length !== 6) return null;
  if (parts.some((p) => !/^[0-9a-f]{1,2}$/.test(p))) return null;
  return parts.map((p) => p.padStart(2, "0")).join(":");
}

function ouiFromMac(mac) {
  return mac.slice(0, 8).toUpperCase();
}

function pad(value, width) {
  const s = value == null || value === "" ? "—" : String(value);
  if (s.length >= width) return s;
  return s + " ".repeat(width - s.length);
}

function todayStamp() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function ipToParts(ip) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (!m) return null;
  return m.slice(1).map((n) => Number(n));
}

function prefix24(ip) {
  const parts = ipToParts(ip);
  if (!parts) return null;
  return `${parts[0]}.${parts[1]}.${parts[2]}`;
}

async function run(cmd, args, opts = {}) {
  const { stdout, stderr } = await execFileAsync(cmd, args, {
    ...execOpts,
    ...opts,
  });
  return { stdout: stdout ?? "", stderr: stderr ?? "" };
}

async function detectSubnet() {
  let iface = null;
  let gateway = null;
  let ip = null;

  if (process.platform === "darwin") {
    try {
      const { stdout } = await run("route", ["-n", "get", "default"]);
      const ifaceMatch = /interface:\s+(\S+)/.exec(stdout);
      const gwMatch = /gateway:\s+(\S+)/.exec(stdout);
      iface = ifaceMatch?.[1] ?? null;
      gateway = gwMatch?.[1] ?? null;
    } catch {
      // fall through
    }
    if (iface) {
      try {
        const { stdout } = await run("ipconfig", ["getifaddr", iface]);
        ip = stdout.trim() || null;
      } catch {
        // fall through
      }
    }
  }

  if (!ip) {
    const nics = os.networkInterfaces();
    for (const [name, addrs] of Object.entries(nics)) {
      if (!addrs) continue;
      for (const addr of addrs) {
        if (addr.internal || addr.family !== "IPv4") continue;
        if (addr.address.startsWith("127.")) continue;
        iface = name;
        ip = addr.address;
        break;
      }
      if (ip) break;
    }
  }

  if (!ip) {
    throw new Error("Could not detect an active IPv4 interface.");
  }

  const prefix = prefix24(ip);
  if (!prefix) {
    throw new Error(`Active IP ${ip} is not a dotted IPv4 address.`);
  }

  return {
    ip,
    iface,
    gateway,
    prefix,
    cidr: `${prefix}.0/24`,
  };
}

function pingArgs(ip) {
  if (process.platform === "darwin") {
    return ["-c", "1", "-n", "-W", String(PING_TIMEOUT_MS), ip];
  }
  return ["-c", "1", "-n", "-W", "1", ip];
}

async function pingHost(ip) {
  try {
    await run("ping", pingArgs(ip), { timeout: PING_TIMEOUT_MS + 800 });
    return true;
  } catch {
    return false;
  }
}

async function pingSweep(prefix) {
  const hosts = [];
  for (let i = 1; i <= 254; i++) hosts.push(`${prefix}.${i}`);

  log(`Pinging ${hosts.length} hosts on ${prefix}.0/24 …`);
  let live = 0;
  for (let i = 0; i < hosts.length; i += PING_CONCURRENCY) {
    const batch = hosts.slice(i, i + PING_CONCURRENCY);
    const results = await Promise.all(batch.map((ip) => pingHost(ip)));
    live += results.filter(Boolean).length;
  }
  log(`Ping sweep finished (${live} replies). Reading ARP table …`);
}

function parseArp(text) {
  const devices = new Map();
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    if (/\(incomplete\)/i.test(line)) continue;

    const ipMatch = /\((\d{1,3}(?:\.\d{1,3}){3})\)/.exec(line);
    const macMatch = /\sat\s+([0-9a-fA-F:.-]{11,17})(?:\s|$)/.exec(line);
    if (!ipMatch || !macMatch) continue;

    const mac = normalizeMac(macMatch[1]);
    if (!mac || mac === "00:00:00:00:00:00" || mac === "ff:ff:ff:ff:ff:ff") {
      continue;
    }

    const nameTok = line.trim().split(/\s+/)[0];
    const hostname =
      nameTok && nameTok !== "?" && !/^\d+\.\d+\.\d+\.\d+$/.test(nameTok)
        ? nameTok.replace(/\.$/, "")
        : null;

    devices.set(ipMatch[1], { ip: ipMatch[1], mac, hostname });
  }
  return [...devices.values()];
}

async function readArpTable(prefix) {
  const { stdout } = await run("arp", ["-a"]);
  return parseArp(stdout).filter((d) => d.ip.startsWith(`${prefix}.`));
}

async function reverseName(ip) {
  try {
    const names = await Promise.race([
      dns.reverse(ip),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("dns timeout")), DNS_TIMEOUT_MS),
      ),
    ]);
    return names?.[0]?.replace(/\.$/, "") ?? null;
  } catch {
    return null;
  }
}

function loadOuiTable() {
  const raw = JSON.parse(fs.readFileSync(OUI_PATH, "utf8"));
  /** @type {Record<string, string>} */
  const table = {};
  for (const [oui, vendor] of Object.entries(raw)) {
    table[oui.toUpperCase()] = vendor;
  }
  return table;
}

function vendorForMac(mac, table) {
  const oui = ouiFromMac(mac);
  const vendor = table[oui];
  if (vendor) return { vendor, oui };
  return { vendor: `unknown (${oui})`, oui };
}

function notesFor(device) {
  const flags = [];
  const vendorCore = device.vendor.replace(/^unknown.*/, "");
  if (/^Espressif$/i.test(device.vendor) || /^Tuya$/i.test(device.vendor)) {
    flags.push("likely smart");
  }
  if (device.hostname && SMART_HOST_RE.test(device.hostname)) {
    if (!flags.includes("likely smart")) flags.push("likely smart");
    flags.push("smart hostname");
  }
  if (device.tuya) flags.push("Tuya UDP");
  return flags.join("; ");
}

function isLikelySmart(device) {
  if (/^Espressif$/i.test(device.vendor) || /^Tuya$/i.test(device.vendor)) {
    return true;
  }
  return Boolean(device.hostname && SMART_HOST_RE.test(device.hostname));
}

async function ensureTinytuya() {
  try {
    await run("python3", ["-c", "import tinytuya"], { timeout: 10_000 });
    return true;
  } catch {
    log("tinytuya not installed — installing with pip (user) …");
    try {
      await run(
        "python3",
        ["-m", "pip", "install", "--user", "--quiet", "tinytuya"],
        { timeout: 120_000 },
      );
      await run("python3", ["-c", "import tinytuya"], { timeout: 10_000 });
      return true;
    } catch (error) {
      log(
        `Tuya scan skipped (could not import tinytuya): ${
          error instanceof Error ? error.message : error
        }`,
      );
      return false;
    }
  }
}

async function tuyaScan() {
  const ready = await ensureTinytuya();
  if (!ready) return [];

  log(`Tuya UDP scan (${TUYA_SCAN_SECONDS}s, no poll) …`);
  const py = `
import json, sys
import tinytuya
seconds = int(sys.argv[1])
out_path = sys.argv[2]
found = tinytuya.deviceScan(
    verbose=False,
    maxretry=seconds,
    color=False,
    poll=False,
    forcescan=True,
)
with open(out_path, "w", encoding="utf-8") as fh:
    json.dump(found, fh, default=str)
`;

  const tmpPy = path.join(os.tmpdir(), "bumblehub-tuya-scan.py");
  const tmpJson = path.join(os.tmpdir(), "bumblehub-tuya-scan.json");
  fs.writeFileSync(tmpPy, py, "utf8");

  try {
    const { stderr } = await run("python3", [tmpPy, String(TUYA_SCAN_SECONDS), tmpJson], {
      timeout: 120_000,
      cwd: os.tmpdir(),
    });
    if (stderr.trim()) {
      const hint = stderr
        .trim()
        .split(/\n/)
        .filter((line) => !/NotOpenSSLWarning|urllib3/.test(line))
        .slice(-4)
        .join(" | ");
      if (hint) log(`tinytuya: ${hint}`);
    }
    if (!fs.existsSync(tmpJson)) {
      log("Tuya scan produced no output file.");
      return [];
    }
    const parsed = JSON.parse(fs.readFileSync(tmpJson, "utf8"));
    const list = [];
    for (const [key, value] of Object.entries(parsed ?? {})) {
      const rec = value && typeof value === "object" ? value : {};
      const ip = rec.ip || rec.address || key;
      if (!ip || typeof ip !== "string") continue;
      list.push({
        ip,
        id: rec.gwId || rec.id || rec.deviceId || null,
        version: rec.version != null ? String(rec.version) : null,
        productKey: rec.productKey || rec.productid || null,
      });
    }
    log(`Tuya scan found ${list.length} device(s).`);
    return list;
  } catch (error) {
    log(
      `Tuya scan failed: ${error instanceof Error ? error.message : error}`,
    );
    return [];
  } finally {
    try {
      fs.unlinkSync(tmpPy);
      fs.unlinkSync(tmpJson);
    } catch {
      // ignore
    }
  }
}

function printTable(rows) {
  const cols = [
    ["IP", "ip"],
    ["MAC", "mac"],
    ["VENDOR", "vendor"],
    ["HOSTNAME", "hostname"],
    ["TUYA?", "tuyaLabel"],
    ["NOTES", "notes"],
  ];
  const widths = cols.map(([header, key]) =>
    Math.max(header.length, ...rows.map((r) => String(r[key] ?? "—").length)),
  );

  const line = (cells) =>
    cells.map((cell, i) => pad(cell, widths[i])).join("  ");

  const header = line(cols.map(([h]) => h));
  const rule = widths.map((w) => "─".repeat(w)).join("  ");
  const body = rows.map((r) => line(cols.map(([, key]) => r[key])));

  const out = [header, rule, ...body].join("\n");
  process.stdout.write(`${out}\n`);
  return { header, rule, body };
}

function renderMarkdown(meta, rows, summary, tuyaDevices) {
  const lines = [];
  lines.push(`# Device census — ${meta.stamp}`);
  lines.push("");
  lines.push(`- Subnet: \`${meta.cidr}\``);
  lines.push(`- Interface: \`${meta.iface ?? "unknown"}\``);
  lines.push(`- Gateway: \`${meta.gateway ?? "unknown"}\``);
  lines.push(`- Host IP: \`${meta.ip}\``);
  lines.push(`- Generated: ${meta.generatedAt}`);
  lines.push("");
  lines.push("| IP | MAC | Vendor | Hostname | Tuya? | Notes |");
  lines.push("|---|---|---|---|---|---|");
  for (const r of rows) {
    const cells = [
      r.ip,
      r.mac,
      r.vendor,
      r.hostname || "—",
      r.tuyaLabel,
      r.notes || "—",
    ].map((c) => String(c).replace(/\|/g, "\\|"));
    lines.push(`| ${cells.join(" | ")} |`);
  }
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Total devices: **${summary.total}**`);
  lines.push(`- Confirmed Tuya (UDP): **${summary.tuyaCount}**`);
  lines.push("");
  lines.push("### Count by vendor");
  lines.push("");
  for (const [vendor, count] of summary.byVendor) {
    lines.push(`- ${vendor}: ${count}`);
  }
  lines.push("");
  lines.push("### Likely smart but NOT Tuya");
  lines.push("");
  if (summary.likelySmartNotTuya.length === 0) {
    lines.push("_None._");
  } else {
    for (const d of summary.likelySmartNotTuya) {
      lines.push(
        `- ${d.ip}  ${d.mac}  ${d.vendor}  ${d.hostname || "—"}`,
      );
    }
  }
  if (tuyaDevices.length) {
    lines.push("");
    lines.push("### Tuya UDP details");
    lines.push("");
    for (const t of tuyaDevices) {
      lines.push(
        `- ${t.ip}  id=\`${t.id ?? "?"}\`  ver=${t.version ?? "?"}  product=${t.productKey ?? "—"}`,
      );
    }
  }
  lines.push("");
  return lines.join("\n");
}

function summarize(devices) {
  const byVendorMap = new Map();
  for (const d of devices) {
    byVendorMap.set(d.vendor, (byVendorMap.get(d.vendor) ?? 0) + 1);
  }
  const byVendor = [...byVendorMap.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0]);
  });
  const tuyaCount = devices.filter((d) => d.tuya).length;
  const likelySmartNotTuya = devices.filter((d) => isLikelySmart(d) && !d.tuya);
  return {
    total: devices.length,
    byVendor,
    tuyaCount,
    likelySmartNotTuya,
  };
}

function printSummary(summary) {
  process.stdout.write("\nSummary\n");
  process.stdout.write("───────\n");
  process.stdout.write(`Total devices: ${summary.total}\n`);
  process.stdout.write(`Confirmed Tuya (UDP): ${summary.tuyaCount}\n`);
  process.stdout.write("Count by vendor:\n");
  for (const [vendor, count] of summary.byVendor) {
    process.stdout.write(`  ${count.toString().padStart(3)}  ${vendor}\n`);
  }
  process.stdout.write("Likely smart but NOT Tuya:\n");
  if (summary.likelySmartNotTuya.length === 0) {
    process.stdout.write("  (none)\n");
  } else {
    for (const d of summary.likelySmartNotTuya) {
      process.stdout.write(
        `  ${d.ip.padEnd(15)}  ${d.mac}  ${d.vendor}  ${d.hostname || "—"}\n`,
      );
    }
  }
}

async function main() {
  const ouiTable = loadOuiTable();
  const net = await detectSubnet();
  log(`Active interface ${net.iface ?? "?"}  IP ${net.ip}  subnet ${net.cidr}`);
  if (net.gateway) log(`Default gateway ${net.gateway}`);

  await pingSweep(net.prefix);
  const arpDevices = await readArpTable(net.prefix);
  log(`ARP table: ${arpDevices.length} live MAC(s) on ${net.cidr}.`);

  await Promise.all(
    arpDevices.map(async (d) => {
      if (d.hostname) return;
      d.hostname = await reverseName(d.ip);
    }),
  );

  const tuyaDevices = await tuyaScan();
  const tuyaByIp = new Map(tuyaDevices.map((t) => [t.ip, t]));

  const devices = arpDevices
    .map((d) => {
      const { vendor, oui } = vendorForMac(d.mac, ouiTable);
      const tuya = tuyaByIp.get(d.ip) ?? null;
      const row = {
        ip: d.ip,
        mac: d.mac,
        oui,
        vendor,
        hostname: d.hostname,
        tuya: Boolean(tuya),
        tuyaId: tuya?.id ?? null,
        tuyaVersion: tuya?.version ?? null,
        tuyaProductKey: tuya?.productKey ?? null,
        notes: "",
      };
      row.notes = notesFor(row);
      row.tuyaLabel = row.tuya ? "yes" : "no";
      return row;
    })
    .sort((a, b) => {
      const ap = ipToParts(a.ip);
      const bp = ipToParts(b.ip);
      for (let i = 0; i < 4; i++) {
        if ((ap?.[i] ?? 0) !== (bp?.[i] ?? 0)) {
          return (ap?.[i] ?? 0) - (bp?.[i] ?? 0);
        }
      }
      return 0;
    });

  const summary = summarize(devices);
  process.stdout.write("\n");
  printTable(devices);
  printSummary(summary);

  const stamp = todayStamp();
  const generatedAt = new Date().toISOString();
  const meta = { ...net, stamp, generatedAt };
  const jsonPath = path.join(REPO_ROOT, `device-census-${stamp}.json`);
  const mdPath = path.join(REPO_ROOT, `device-census-${stamp}.md`);

  const payload = {
    generatedAt,
    subnet: net.cidr,
    interface: net.iface,
    gateway: net.gateway,
    hostIp: net.ip,
    devices: devices.map(({ tuyaLabel, ...rest }) => rest),
    tuyaScan: tuyaDevices,
    summary: {
      total: summary.total,
      tuyaCount: summary.tuyaCount,
      byVendor: Object.fromEntries(summary.byVendor),
      likelySmartNotTuya: summary.likelySmartNotTuya.map((d) => ({
        ip: d.ip,
        mac: d.mac,
        vendor: d.vendor,
        hostname: d.hostname,
      })),
    },
  };
  fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`);
  fs.writeFileSync(
    mdPath,
    renderMarkdown(meta, devices, summary, tuyaDevices),
  );
  log(`\nWrote ${path.relative(REPO_ROOT, jsonPath)}`);
  log(`Wrote ${path.relative(REPO_ROOT, mdPath)}`);
}

main().catch((error) => {
  process.stderr.write(
    `device-census failed: ${error instanceof Error ? error.stack ?? error.message : error}\n`,
  );
  process.exit(1);
});
