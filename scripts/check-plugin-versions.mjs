#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { pluginContracts as contracts } from "./plugin-contracts.mjs";
import { compareVersions } from "./version-utils.mjs";

const args = process.argv.slice(2);
const jsonMode = args.includes("--json");
const strictMode = args.includes("--strict") || /^(1|true|yes|on)$/i.test(process.env.PLUGIN_VERSION_STRICT || "");
const envFileArg = args.find((arg) => arg.startsWith("--env-file="))?.slice("--env-file=".length);

for (const file of [envFileArg, ".env.local", ".env"].filter(Boolean)) {
  loadEnvFile(file);
}

const baseUrl = (process.env.HALO_BASE_URL || process.env.SMOKE_BASE_URL || "http://localhost:8090").replace(
  /\/+$/,
  "",
);
const token = process.env.HALO_PAT || process.env.HALO_TOKEN || process.env.HALO_API_TOKEN;
const timeoutMs = Number.parseInt(process.env.HALO_API_TIMEOUT_MS || "10000", 10);

if (!token) {
  console.error("Missing HALO_PAT/HALO_TOKEN. Create .env.local from .env.example or export HALO_PAT before running.");
  process.exit(2);
}

let endpoint;
try {
  endpoint = await fetchPluginEndpoint();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (jsonMode) {
    console.log(JSON.stringify({ baseUrl, strict: strictMode, error: message }, null, 2));
  } else {
    console.error(`Plugin version check failed for ${baseUrl}:\n${message}`);
  }
  process.exit(1);
}
const installed = new Map(endpoint.plugins.map((plugin) => [plugin.name, plugin]));
const aliasIndex = new Map();

for (const plugin of endpoint.plugins) {
  aliasIndex.set(normalizePluginName(plugin.name), plugin);
  if (plugin.displayName) {
    aliasIndex.set(normalizePluginName(plugin.displayName), plugin);
  }
}

const rows = contracts.map((contract) => {
  const plugin = findInstalledPlugin(contract.aliases, aliasIndex);
  return buildResultRow(contract, plugin);
});
const contractedNames = new Set(rows.map((row) => row.installedName).filter(Boolean));
const untracked = endpoint.plugins
  .filter((plugin) => !contractedNames.has(plugin.name))
  .sort((left, right) => left.name.localeCompare(right.name));

const failures = rows.filter(
  (row) => row.belowContract || (strictMode && ["newer", "missing", "inactive"].includes(row.result)),
);
const warnings = rows.filter((row) => ["newer", "missing", "inactive"].includes(row.result));

if (jsonMode) {
  console.log(
    JSON.stringify(
      {
        baseUrl,
        endpoint: endpoint.endpoint,
        strict: strictMode,
        rows,
        inventory: {
          installed: endpoint.plugins.length,
          contracted: contractedNames.size,
          outsideThemeContract: untracked,
        },
        summary: {
          total: rows.length,
          ok: rows.filter((row) => row.result === "ok" || row.result === "tested").length,
          warnings: warnings.length,
          failures: failures.length,
        },
      },
      null,
      2,
    ),
  );
} else {
  printTable(rows, endpoint.endpoint);
  printInventorySummary(endpoint.plugins.length, contractedNames.size, untracked);
}

if (failures.length > 0) {
  process.exit(1);
}

function loadEnvFile(file) {
  const resolved = path.resolve(process.cwd(), file);
  if (!fs.existsSync(resolved)) return;

  const content = fs.readFileSync(resolved, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index === -1) continue;

    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key && process.env[key] == null) {
      process.env[key] = value;
    }
  }
}

async function fetchPluginEndpoint() {
  const endpoints = [
    "/apis/api.console.halo.run/v1alpha1/plugins?size=200",
    "/apis/plugin.halo.run/v1alpha1/plugins?size=200",
  ];
  const errors = [];

  for (const endpoint of endpoints) {
    const url = `${baseUrl}${endpoint}`;
    try {
      const data = await fetchJson(url);
      const plugins = extractPlugins(data);
      if (plugins.length > 0) {
        return {
          endpoint,
          plugins,
        };
      }
      errors.push(`${endpoint}: no plugin items found`);
    } catch (error) {
      errors.push(`${endpoint}: ${error.message}`);
    }
  }

  throw new Error(`Unable to read plugin list from Halo API.\n${errors.join("\n")}`);
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "manual",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    const text = await response.text();
    if (response.status >= 300 && response.status < 400) {
      throw new Error(`redirected with status ${response.status}`);
    }
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new Error("response is not JSON");
    }
  } finally {
    clearTimeout(timeout);
  }
}

function extractPlugins(data) {
  const items = findArray(data, ["items", "plugins", "data.items", "data.plugins", "data"]);
  if (!items) return [];

  return items
    .map((item) => {
      const plugin = item.plugin || item.extension || item;
      const name = pick(plugin, [
        "metadata.name",
        "name",
        "spec.name",
        "status.name",
        "metadata.annotations.plugin\\.halo\\.run/name",
      ]);
      const version = pick(plugin, [
        "spec.version",
        "version",
        "status.version",
        "metadata.annotations.plugin\\.halo\\.run/version",
      ]);
      const displayName = pick(plugin, ["spec.displayName", "displayName", "status.displayName"]);
      const enabled = pick(plugin, ["spec.enabled", "enabled", "status.enabled"]);
      const phase = pick(plugin, ["status.phase", "phase", "status.status"]);

      if (!name) return null;
      return {
        name: String(name),
        version: version == null ? "" : String(version).replace(/^v/i, ""),
        displayName: displayName == null ? "" : String(displayName),
        enabled,
        phase: phase == null ? "" : String(phase),
      };
    })
    .filter(Boolean);
}

function findArray(value, paths) {
  for (const pathValue of paths) {
    const found = pick(value, [pathValue]);
    if (Array.isArray(found)) return found;
  }
  if (Array.isArray(value)) return value;
  return null;
}

function pick(value, paths) {
  for (const pathValue of paths) {
    const parts = pathValue.replaceAll("\\.", "\u0000").split(".");
    let current = value;
    for (const part of parts) {
      const key = part.replaceAll("\u0000", ".");
      if (current == null || typeof current !== "object" || !(key in current)) {
        current = undefined;
        break;
      }
      current = current[key];
    }
    if (current != null && current !== "") return current;
  }
  return undefined;
}

function normalizePluginName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/^halo-plugin-/, "plugin-")
    .replace(/^plugin-/, "")
    .replace(/^plugin/, "")
    .replace(/[^a-z0-9]/g, "");
}

function findInstalledPlugin(aliases, aliasIndex) {
  for (const alias of aliases) {
    const normalized = normalizePluginName(alias);
    if (aliasIndex.has(normalized)) return aliasIndex.get(normalized);
  }
  return null;
}

function buildResultRow(contract, plugin) {
  if (!plugin) {
    return {
      plugin: contract.plugin,
      surface: contract.surface,
      contractVersion: contract.contractVersion,
      testedVersion: contract.testedVersion || "",
      status: contract.status,
      installedName: "",
      installedVersion: "",
      phase: "",
      result: "missing",
      belowContract: false,
      note: "not installed or API name changed",
    };
  }

  const compareToTested = contract.testedVersion ? compareVersions(plugin.version, contract.testedVersion) : null;
  const compareToContract = compareVersions(plugin.version, contract.contractVersion);
  const belowContract = compareToContract < 0;
  let result = "ok";
  let note = "matches contract";

  if (
    plugin.enabled === false ||
    (plugin.phase && !["STARTED", "RUNNING", "ENABLED"].includes(plugin.phase.toUpperCase()))
  ) {
    result = "inactive";
    note =
      plugin.enabled === false ? "installed but plugin is disabled" : `installed but plugin phase is ${plugin.phase}`;
    if (belowContract) {
      note += "; installed version is also below theme contract";
    }
  } else if (contract.testedVersion && compareToTested === 0) {
    result = "tested";
    note = "matches tested version";
  } else if (compareToContract < 0) {
    result = "older";
    note = "installed version is below theme contract";
  } else if (contract.testedVersion && compareToTested > 0) {
    result = "newer";
    note = "newer than tested version; run smoke before marking compatible";
  } else if (compareToContract > 0) {
    result = "newer";
    note = "newer than contract; run smoke before updating docs";
  }

  return {
    plugin: contract.plugin,
    surface: contract.surface,
    contractVersion: contract.contractVersion,
    testedVersion: contract.testedVersion || "",
    status: contract.status,
    installedName: plugin.name,
    installedVersion: plugin.version,
    phase: plugin.phase || String(plugin.enabled ?? ""),
    result,
    belowContract,
    note,
  };
}

function printTable(rows, endpoint) {
  const columns = [
    ["Plugin", "plugin"],
    ["Contract", "contractVersion"],
    ["Tested", "testedVersion"],
    ["Installed", "installedVersion"],
    ["Phase", "phase"],
    ["Result", "result"],
    ["Note", "note"],
  ];
  const widths = columns.map(([label, key]) =>
    Math.max(label.length, ...rows.map((row) => String(row[key] || "").length)),
  );

  console.log(`Halo plugin API: ${baseUrl}${endpoint}`);
  console.log(`Strict mode: ${strictMode ? "on" : "off"}`);
  console.log(
    formatRow(
      columns.map(([label]) => label),
      widths,
    ),
  );
  console.log(
    formatRow(
      widths.map((width) => "-".repeat(width)),
      widths,
    ),
  );
  for (const row of rows) {
    console.log(
      formatRow(
        columns.map(([, key]) => row[key] || ""),
        widths,
      ),
    );
  }
}

function printInventorySummary(installedCount, contractedCount, untracked) {
  console.log("");
  console.log(
    `Installed plugins: ${installedCount}; matched theme contracts: ${contractedCount}; outside theme contract: ${untracked.length}`,
  );
  if (untracked.length === 0) return;

  const columns = [
    ["Outside theme contract", "name"],
    ["Version", "version"],
    ["Phase", "phase"],
  ];
  const widths = columns.map(([label, key]) =>
    Math.max(label.length, ...untracked.map((plugin) => String(plugin[key] || "").length)),
  );
  console.log(
    formatRow(
      columns.map(([label]) => label),
      widths,
    ),
  );
  console.log(
    formatRow(
      widths.map((width) => "-".repeat(width)),
      widths,
    ),
  );
  for (const plugin of untracked) {
    console.log(
      formatRow(
        columns.map(([, key]) => plugin[key] || ""),
        widths,
      ),
    );
  }
}

function formatRow(values, widths) {
  return values.map((value, index) => String(value).padEnd(widths[index], " ")).join("  ");
}
