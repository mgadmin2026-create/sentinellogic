const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawn } = require("node:child_process");
const { chromium } = require("playwright-core");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_CONFIG = path.join(ROOT, "config.json");
const AGENT_ID = `${os.hostname()}-${process.pid}`;
const BLOCKED_ACTION_RE = /abschlie|abschluss|antrag\s*senden|zahlungspflichtig|kaufen|beantragen/i;
const args = process.argv.slice(2);

let edgeProcess = null;

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function loadConfig() {
  const configPath = path.resolve(process.env.AMIS_AGENT_CONFIG || DEFAULT_CONFIG);
  const fileConfig = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, "utf8")) : {};
  return {
    crmBaseUrl: process.env.CRM_BASE_URL || fileConfig.crmBaseUrl,
    amisNowUrl: process.env.AMIS_NOW_URL || fileConfig.amisNowUrl,
    pollIntervalMs: Number(process.env.POLL_INTERVAL_MS || fileConfig.pollIntervalMs || 30000),
    edgeDebugPort: Number(process.env.EDGE_DEBUG_PORT || fileConfig.edgeDebugPort || 9222),
    edgePath: process.env.EDGE_PATH || fileConfig.edgePath || defaultEdgePath(),
    edgeUserDataDir: process.env.EDGE_USER_DATA_DIR || fileConfig.edgeUserDataDir || path.join(ROOT, ".edge-profile"),
    screenshotDir: process.env.SCREENSHOT_DIR || fileConfig.screenshotDir || path.join(ROOT, "screenshots"),
    logDir: process.env.LOG_DIR || fileConfig.logDir || path.join(ROOT, "logs"),
    dryRun: parseBool(process.env.DRY_RUN, fileConfig.dryRun ?? false),
    personCreateOnly: args.includes("--person-create-only") || parseBool(process.env.PERSON_CREATE_ONLY, fileConfig.personCreateOnly ?? false),
    defaultTaskType: process.env.DEFAULT_TASK_TYPE || fileConfig.defaultTaskType || "person_create_quote",
    testJobFile: argValue("--test-job") || process.env.TEST_JOB_FILE || fileConfig.testJobFile,
    personCreate: fileConfig.personCreate || {},
    selectors: fileConfig.selectors || {},
  };
}

function argValue(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function parseBool(value, fallback) {
  if (value == null) return fallback;
  return ["1", "true", "yes", "ja"].includes(String(value).toLowerCase());
}

function defaultEdgePath() {
  const candidates = [
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || "msedge.exe";
}

const config = loadConfig();
ensureDir(config.logDir);
ensureDir(config.screenshotDir);
const logFile = path.join(config.logDir, "agent.log");

function log(level, message, data = {}) {
  const entry = { ts: new Date().toISOString(), level, message, agentId: AGENT_ID, ...data };
  const line = JSON.stringify(entry);
  fs.appendFileSync(logFile, `${line}\n`);
  console.log(line);
}

function requireConfig() {
  const missing = [];
  if (!config.testJobFile && !process.env.AMIS_AGENT_TOKEN) missing.push("AMIS_AGENT_TOKEN");
  if (!config.crmBaseUrl) missing.push("crmBaseUrl/CRM_BASE_URL");
  if (!config.amisNowUrl) missing.push("amisNowUrl/AMIS_NOW_URL");
  if (missing.length) throw new Error(`Missing configuration: ${missing.join(", ")}`);
}

async function api(pathname, options = {}) {
  const url = new URL(pathname, config.crmBaseUrl).toString();
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${process.env.AMIS_AGENT_TOKEN}`,
      "Content-Type": "application/json",
      "X-Agent-Id": AGENT_ID,
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(`${options.method || "GET"} ${url} failed ${response.status}: ${text}`);
  return body;
}

async function claimJob() {
  if (config.testJobFile) {
    const file = path.resolve(ROOT, config.testJobFile);
    const job = JSON.parse(fs.readFileSync(file, "utf8"));
    return { job: { id: `local-test-${Date.now()}`, title: "Lokaler Personentest", ...job } };
  }
  return api("/api/amis-agent/jobs", { method: "POST" });
}

async function reportResult(jobId, result) {
  if (config.testJobFile) {
    log("info", "Local test result", { jobId, result });
    return;
  }
  await api(`/api/amis-agent/jobs/${jobId}/result`, {
    method: "POST",
    body: JSON.stringify(result),
  });
}

async function ensureEdge() {
  const endpoint = `http://127.0.0.1:${config.edgeDebugPort}`;
  try {
    const browser = await chromium.connectOverCDP(endpoint);
    log("info", "Connected to existing Edge debug session");
    return browser;
  } catch (_) {
    log("info", "Starting Edge with remote debugging", { edgePath: config.edgePath });
    edgeProcess = spawn(config.edgePath, [
      `--remote-debugging-port=${config.edgeDebugPort}`,
      `--user-data-dir=${config.edgeUserDataDir}`,
      "--start-maximized",
      config.amisNowUrl,
    ], { detached: true, stdio: "ignore" });
    edgeProcess.unref();
    await delay(3500);
    return chromium.connectOverCDP(endpoint);
  }
}

async function getPage(browser) {
  const context = browser.contexts()[0] || await browser.newContext();
  const existing = context.pages().find((page) => page.url().includes(new URL(config.amisNowUrl).hostname));
  const page = existing || await context.newPage();
  await page.goto(config.amisNowUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  return page;
}

function getValue(source, dottedPath) {
  return String(dottedPath).split(".").reduce((value, key) => value == null ? undefined : value[key], source);
}

function resolveValue(source, valueOrTemplate) {
  if (typeof valueOrTemplate !== "string") return valueOrTemplate;
  if (!valueOrTemplate.includes("${")) return getValue(source, valueOrTemplate);
  return valueOrTemplate.replace(/\$\{([^}]+)\}/g, (_, dataPath) => {
    const value = getValue(source, dataPath.trim());
    return value == null ? "" : String(value);
  }).replace(/\s+/g, " ").trim();
}

function validateRequired(source, requiredPaths = []) {
  const missing = [];
  const genderGroup = new Set(["amis_input.gender_male", "amis_input.gender_female"]);
  const requiresGender = requiredPaths.some((path) => genderGroup.has(path));
  for (const dataPath of requiredPaths) {
    if (genderGroup.has(dataPath)) continue;
    const value = getValue(source, dataPath);
    if (value == null || value === "") missing.push(dataPath);
  }
  if (requiresGender && !getValue(source, "amis_input.gender_male") && !getValue(source, "amis_input.gender_female")) {
    missing.push("amis_input.gender_male or amis_input.gender_female");
  }
  if (missing.length) throw new Error(`Missing required person data: ${missing.join(", ")}`);
}

async function fillField(page, selector, value) {
  if (value == null || value === "") return;
  const locator = page.locator(selector).first();
  await locator.waitFor({ state: "visible", timeout: 15000 });
  await locator.fill(String(value));
}

async function fillDateMask(page, selector, value) {
  if (value == null || value === "") return;
  const match = String(value).match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$|^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) throw new Error(`Date value for ${selector} must be DD.MM.YYYY or YYYY-MM-DD`);
  const day = (match[1] || match[6]).padStart(2, "0");
  const month = (match[2] || match[5]).padStart(2, "0");
  const year = match[3] || match[4];
  const root = page.locator(selector).first();
  await root.waitFor({ state: "visible", timeout: 15000 });
  await root.locator("input[placeholder='tt'], input[aria-label*='Tagesfeld']").fill(day);
  await root.locator("input[placeholder='mm'], input[aria-label*='Monatsfeld']").fill(month);
  await root.locator("input[placeholder='jjjj'], input[aria-label*='Jahresfeld']").fill(year);
}

async function selectRadio(page, selector, enabled) {
  if (!enabled) return;
  const locator = page.locator(selector).first();
  await locator.waitFor({ state: "attached", timeout: 15000 });
  await locator.check({ force: true });
}

async function setCheckbox(page, selector, enabled) {
  if (!enabled) return;
  const locator = page.locator(selector).first();
  await locator.waitFor({ state: "attached", timeout: 15000 });
  await locator.check({ force: true });
}

async function safeClick(page, selector) {
  const locator = page.locator(selector).first();
  await locator.waitFor({ state: "visible", timeout: 15000 });
  const label = await locator.innerText().catch(() => "");
  const aria = await locator.getAttribute("aria-label").catch(() => "");
  const text = `${label} ${aria}`;
  if (BLOCKED_ACTION_RE.test(text)) {
    throw new Error(`Blocked forbidden AMIS action: ${text.trim()}`);
  }
  if (config.dryRun) {
    log("info", "Dry-run: skipping calculate click", { selector, text: text.trim() });
    return;
  }
  await locator.click();
}

async function createPersonIfConfigured(page, job) {
  const personCreate = config.personCreate || {};
  if (!personCreate.enabled) return;

  validateRequired(job, personCreate.required || []);
  log("info", "Opening person creation modal", { jobId: job.id });
  const openActions = Array.isArray(personCreate.openActions) && personCreate.openActions.length
    ? personCreate.openActions
    : [personCreate.openButton];
  for (const selector of openActions) {
    await safeClick(page, selector);
    await delay(500);
  }

  const modal = page.locator(personCreate.modal || "nx-modal-container[role='dialog']:has-text('Person anlegen')").first();
  await modal.waitFor({ state: "visible", timeout: 30000 });

  for (const [selector, dataPath] of Object.entries(personCreate.radios || {})) {
    const value = resolveValue(job, dataPath);
    log("info", "Selecting person radio", { jobId: job.id, selector, dataPath, value: Boolean(value) });
    await selectRadio(page, selector, Boolean(value));
  }

  for (const [selector, valueOrPath] of Object.entries(personCreate.checkboxes || {})) {
    const value = typeof valueOrPath === "boolean" ? valueOrPath : resolveValue(job, valueOrPath);
    log("info", "Setting person checkbox", { jobId: job.id, selector, value: Boolean(value) });
    await setCheckbox(page, selector, Boolean(value));
  }

  for (const [selector, dataPath] of Object.entries(personCreate.fields || {})) {
    const value = resolveValue(job, dataPath);
    log("info", "Filling person field", { jobId: job.id, selector, dataPath, hasValue: value != null && value !== "" });
    await fillField(page, selector, value);
  }

  for (const [selector, dataPath] of Object.entries(personCreate.dateMasks || {})) {
    const value = resolveValue(job, dataPath);
    log("info", "Filling person date", { jobId: job.id, selector, dataPath, hasValue: value != null && value !== "" });
    await fillDateMask(page, selector, value);
  }

  log("info", "Submitting person creation modal", { jobId: job.id });
  await safeClick(page, personCreate.submitButton || "#submitBtn");
  if (!config.dryRun) {
    await modal.waitFor({ state: "hidden", timeout: 60000 }).catch(() => undefined);
  }
}

async function readText(page, selector) {
  const locator = page.locator(selector).first();
  await locator.waitFor({ state: "visible", timeout: 60000 });
  return (await locator.innerText()).trim();
}

async function processJob(browser, job) {
  const page = await getPage(browser);
  const taskType = job.amis_task_type || (config.personCreateOnly ? "person_create" : config.defaultTaskType);
  log("info", "Processing job", { jobId: job.id, title: job.title, taskType });

  await createPersonIfConfigured(page, job);
  if (taskType === "person_create") {
    const screenshotPath = path.join(config.screenshotDir, `${job.id}-person-created-${Date.now()}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    log("info", "Person-create task completed", { jobId: job.id, screenshotPath });
    await reportResult(job.id, {
      status: "person_created",
      screenshotPath,
    });
    return;
  }

  if (!config.selectors.calculateButton) throw new Error("Missing configuration: selectors.calculateButton");
  if (!config.selectors.premium) throw new Error("Missing configuration: selectors.premium");
  if (!config.selectors.quoteNumber) throw new Error("Missing configuration: selectors.quoteNumber");

  for (const [selector, dataPath] of Object.entries(config.selectors.fields || {})) {
    const value = resolveValue(job, dataPath);
    log("info", "Filling AMIS field", { jobId: job.id, selector, dataPath, hasValue: value != null && value !== "" });
    await fillField(page, selector, value);
  }

  log("info", "Starting AMIS calculation", { jobId: job.id });
  await safeClick(page, config.selectors.calculateButton);

  const premium = config.dryRun ? "DRY_RUN" : await readText(page, config.selectors.premium);
  const quoteNumber = config.dryRun ? `DRY-${Date.now()}` : await readText(page, config.selectors.quoteNumber);
  const screenshotPath = path.join(config.screenshotDir, `${job.id}-${Date.now()}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });

  log("info", "AMIS calculation completed", { jobId: job.id, premium, quoteNumber, screenshotPath });
  await reportResult(job.id, {
    status: "quoted",
    premium,
    quoteNumber,
    screenshotPath,
  });
}

async function runOnce(browser) {
  const { job } = await claimJob();
  if (!job) {
    log("info", "No queued jobs");
    return;
  }

  try {
    await processJob(browser, job);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log("error", "Job failed", { jobId: job.id, error: message });
    await reportResult(job.id, { status: "error", error: message }).catch((reportError) => {
      log("error", "Failed to report job error", { jobId: job.id, error: String(reportError) });
    });
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  requireConfig();
  log("info", "AMIS.Now agent starting", {
    dryRun: config.dryRun,
    crmBaseUrl: config.crmBaseUrl,
    personCreateOnly: config.personCreateOnly,
    defaultTaskType: config.defaultTaskType,
    testJobFile: config.testJobFile || null,
  });
  const browser = await ensureEdge();
  process.on("SIGINT", async () => {
    log("info", "AMIS.Now agent stopping");
    await browser.close().catch(() => undefined);
    process.exit(0);
  });

  if (config.testJobFile) {
    await runOnce(browser).catch((error) => log("error", "Local test failed", { error: String(error) }));
    await browser.close().catch(() => undefined);
    return;
  }

  while (true) {
    await runOnce(browser).catch((error) => log("error", "Polling cycle failed", { error: String(error) }));
    await delay(config.pollIntervalMs);
  }
}

main().catch((error) => {
  log("fatal", "AMIS.Now agent crashed", { error: error instanceof Error ? error.stack : String(error) });
  process.exit(1);
});
