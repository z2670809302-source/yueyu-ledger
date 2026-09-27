import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const port = 9334;
const profile = await mkdtemp(join(tmpdir(), "yueyu-chrome-"));
const chrome = spawn(chromePath, [
  "--headless=old",
  "--no-sandbox",
  "--disable-gpu",
  "--disable-software-rasterizer",
  "--disable-dev-shm-usage",
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  "--no-first-run",
  "about:blank"
], { stdio: "ignore" });

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function retry(callback, attempts = 40) {
  let lastError;
  for (let index = 0; index < attempts; index += 1) {
    try { return await callback(); } catch (error) { lastError = error; await delay(100); }
  }
  throw lastError;
}

try {
  const target = await retry(async () => {
    const response = await fetch(`http://127.0.0.1:${port}/json/new?http://localhost:4174`, { method: "PUT" });
    if (!response.ok) throw new Error("Chrome target is not ready");
    return response.json();
  });

  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  let id = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  });

  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const callId = ++id;
    pending.set(callId, { resolve, reject });
    socket.send(JSON.stringify({ id: callId, method, params }));
  });
  const evaluate = async (expression) => {
    const result = await call("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };
  const waitFor = async (expression) => retry(async () => {
    const result = await evaluate(expression);
    if (!result) throw new Error(`Waiting for ${expression}`);
    return result;
  });

  await call("Page.enable");
  await call("Runtime.enable");
  await call("Network.enable");
  await call("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
  await call("Page.navigate", { url: "http://localhost:4174" });
  await waitFor("document.readyState === 'complete'");
  await evaluate("localStorage.clear(); location.reload(); true");
  await waitFor("document.readyState === 'complete' && document.querySelector('#addEntry')");

  const addEntry = (recordType, amount, category, date, note) => evaluate(`(() => {
    document.querySelector('#addEntry').click();
    const form = document.querySelector('#entryForm');
    form.elements.recordType.value = ${JSON.stringify(recordType)};
    document.querySelector('#amount').value = ${JSON.stringify(amount)};
    document.querySelector('#category').value = ${JSON.stringify(category)};
    document.querySelector('#entryDate').value = ${JSON.stringify(date)};
    document.querySelector('#note').value = ${JSON.stringify(note)};
    form.requestSubmit();
    return true;
  })()`);

  await addEntry("expected", 10000, "salary", "2026-09-01", "九月工资计划");
  await addEntry("actual", 9800, "salary", "2026-09-02", "九月工资");
  await addEntry("expected", 2500, "rent", "2026-09-03", "九月房租计划");
  await addEntry("actual", 2500, "rent", "2026-09-03", "九月房租");
  await addEntry("actual", 35, "daily", "2026-09-04", "早餐和地铁");
  await addEntry("actual", 65, "daily", "2026-09-05", "日用品");

  const result = await evaluate(`(() => ({
    balance: document.querySelector('#currentBalance').textContent,
    expected: document.querySelector('#expectedRemaining').textContent,
    actual: document.querySelector('#actualRemaining').textContent,
    difference: document.querySelector('#planDifference').textContent,
    storedCount: JSON.parse(localStorage.getItem('yueyu-ledger-v1')).entries.length,
    homeDetailEntries: document.querySelectorAll('.entry-item').length,
    dailyTotal: document.querySelector('[data-category="daily"] strong:last-of-type').textContent,
    width: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    dialogClosed: !document.querySelector('#entryDialog').open
  }))()`);

  assert.equal(result.balance, "¥7,200.00");
  assert.equal(result.expected, "+¥7,500.00");
  assert.equal(result.actual, "+¥7,200.00");
  assert.equal(result.difference, "-¥300.00");
  assert.equal(result.storedCount, 6);
  assert.equal(result.homeDetailEntries, 0);
  assert.equal(result.dailyTotal, "¥100.00");
  assert.equal(result.width, 390);
  assert.equal(result.scrollWidth, 390);
  assert.equal(result.dialogClosed, true);

  const dailyDetail = await evaluate(`(() => {
    document.querySelector('[data-category="daily"]').click();
    return {
      title: document.querySelector('#detailTitle').textContent,
      total: document.querySelector('#detailActual').textContent,
      groups: document.querySelectorAll('.day-group').length,
      entries: document.querySelectorAll('#detailTimeline .entry-item').length,
      dates: [...document.querySelectorAll('.day-group h3')].map((item) => item.textContent)
    };
  })()`);
  assert.equal(dailyDetail.title, "日常开销");
  assert.equal(dailyDetail.total, "¥100.00");
  assert.equal(dailyDetail.groups, 2);
  assert.equal(dailyDetail.entries, 2);
  assert.ok(dailyDetail.dates.some((date) => date.includes("9月5日")));
  await evaluate("document.querySelector('#detailBack').click(); true");

  await addEntry("actual", 123, "special", "2026-09-04", "临时测试记录");
  await evaluate(`(() => {
    document.querySelector('[data-category="special"]').click();
    const item = [...document.querySelectorAll('.entry-item')].find((entry) => entry.textContent.includes('临时测试记录'));
    item.click();
    document.querySelector('#amount').value = '125';
    document.querySelector('#entryForm').requestSubmit();
    return true;
  })()`);
  assert.equal(await evaluate("document.querySelector('#currentBalance').textContent"), "¥7,075.00");
  await evaluate(`(() => {
    window.confirm = () => true;
    const item = [...document.querySelectorAll('.entry-item')].find((entry) => entry.textContent.includes('临时测试记录'));
    item.click();
    document.querySelector('#deleteEntry').click();
    return true;
  })()`);
  assert.equal(await evaluate("document.querySelector('#currentBalance').textContent"), "¥7,200.00");
  assert.equal(await evaluate("document.querySelectorAll('#detailTimeline .entry-item').length"), 0);
  await evaluate("document.querySelector('#detailBack').click(); true");

  const downloadName = await evaluate(`(() => {
    URL.createObjectURL = () => 'blob:test';
    URL.revokeObjectURL = () => {};
    HTMLAnchorElement.prototype.click = function () { window.__downloadName = this.download; };
    document.querySelector('#exportData').click();
    return window.__downloadName;
  })()`);
  assert.match(downloadName, /^月余备份-\d{4}-\d{2}-\d{2}\.json$/);

  const savedState = await evaluate("localStorage.getItem('yueyu-ledger-v1')");
  await evaluate(`(async () => {
    const input = document.querySelector('#importData');
    const transfer = new DataTransfer();
    transfer.items.add(new File([JSON.stringify({version: 1, openingBalance: 500, entries: []})], 'restore.json', {type: 'application/json'}));
    Object.defineProperty(input, 'files', { value: transfer.files, configurable: true });
    input.dispatchEvent(new Event('change'));
    await new Promise((resolve) => setTimeout(resolve, 60));
    return true;
  })()`);
  assert.equal(await evaluate("document.querySelector('#currentBalance').textContent"), "¥500.00");
  await evaluate(`localStorage.setItem('yueyu-ledger-v1', ${JSON.stringify(savedState)}); location.reload(); true`);
  await waitFor("document.readyState === 'complete' && JSON.parse(localStorage.getItem('yueyu-ledger-v1')).entries.length === 6");

  await mkdir(".impeccable/review", { recursive: true });
  const mobile = await call("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  await writeFile(".impeccable/review/mobile.png", Buffer.from(mobile.data, "base64"));

  await evaluate("document.querySelector('[data-category=\"daily\"]').click(); true");
  const detailMobile = await call("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  await writeFile(".impeccable/review/detail-mobile.png", Buffer.from(detailMobile.data, "base64"));
  await evaluate("document.querySelector('#detailBack').click(); true");

  await call("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  const desktop = await call("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  await writeFile(".impeccable/review/desktop.png", Buffer.from(desktop.data, "base64"));

  await evaluate("navigator.serviceWorker.ready.then(() => true)");
  await call("Network.emulateNetworkConditions", { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
  await call("Page.reload", { ignoreCache: false });
  await waitFor("document.readyState === 'complete' && document.title.includes('月余')");
  assert.equal(await evaluate("JSON.parse(localStorage.getItem('yueyu-ledger-v1')).entries.length"), 6);
  assert.equal(await evaluate("document.querySelector('[data-category=\"daily\"] strong:last-of-type').textContent"), "¥100.00");
  await call("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });

  console.log(JSON.stringify({ ...result, offlineReload: true }, null, 2));
  socket.close();
} finally {
  chrome.kill();
  await Promise.race([
    new Promise((resolve) => chrome.once("exit", resolve)),
    delay(1000)
  ]);
  await rm(profile, { recursive: true, force: true }).catch(() => {});
}
