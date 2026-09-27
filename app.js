import { categories, currentBalance, monthKey, summarize, validateBackup } from "./ledger-core.js";

const STORAGE_KEY = "yueyu-ledger-v1";
const currency = new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY" });
const fullDate = new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "short" });
const detailDate = new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "short" });
const state = loadState();
let selectedDate = new Date();
let activeDetailCategory = null;

const $ = (selector) => document.querySelector(selector);
const entryDialog = $("#entryDialog");
const entryForm = $("#entryForm");

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? validateBackup(JSON.parse(raw)) : { version: 1, openingBalance: 0, entries: [] };
  } catch {
    return { version: 1, openingBalance: 0, entries: [] };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function formatMoney(value, signed = false) {
  if (signed && value > 0) return `+${currency.format(value)}`;
  return currency.format(value);
}

function selectedMonthKey() {
  return monthKey(selectedDate);
}

function defaultDateForSelectedMonth() {
  const lastDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate();
  const day = Math.min(new Date().getDate(), lastDay);
  return `${selectedMonthKey()}-${String(day).padStart(2, "0")}`;
}

function render() {
  const key = selectedMonthKey();
  const summary = summarize(state.entries, key);
  const nowKey = monthKey();
  $("#todayLabel").textContent = fullDate.format(new Date());
  $("#monthTitle").textContent = `${selectedDate.getFullYear()} 年 ${selectedDate.getMonth() + 1} 月`;
  $("#monthStatus").textContent = key === nowKey ? "本月" : key < nowKey ? "历史月份" : "未来计划";
  $("#currentBalance").textContent = formatMoney(currentBalance(state.openingBalance, state.entries));
  $("#expectedRemaining").textContent = formatMoney(summary.expectedRemaining, true);
  $("#actualRemaining").textContent = formatMoney(summary.actualRemaining, true);
  $("#planDifference").textContent = formatMoney(summary.planDifference, true);
  $("#planDifference").className = summary.planDifference < 0 ? "negative" : "positive";
  $("#openingBalance").value = state.openingBalance;

  $("#categoryRows").innerHTML = Object.entries(categories).map(([key, category]) => `
    <button class="ledger-row category-row" role="row" data-category="${key}" aria-label="查看${category.label}实际每日明细">
      <span role="cell"><i class="direction-mark ${category.direction}"></i>${category.label}</span>
      <strong role="cell">${formatMoney(summary.categories[key].expected)}</strong>
      <div class="category-actual" role="cell">
        <strong>${formatMoney(summary.categories[key].actual)}</strong>
        ${summary.categories[key].huabei ? `<small>花呗 ${formatMoney(summary.categories[key].huabei)}</small>` : ""}
      </div>
    </button>
  `).join("");
  if (activeDetailCategory) renderDetail();
}

function renderDetail() {
  const category = categories[activeDetailCategory];
  if (!category) return;
  const key = selectedMonthKey();
  const summary = summarize(state.entries, key);
  const categorySummary = summary.categories[activeDetailCategory];
  const entries = state.entries
    .filter((entry) => entry.recordType === "actual" && entry.category === activeDetailCategory && entry.date.startsWith(key))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

  $("#detailTitle").textContent = category.label;
  $("#detailMonth").textContent = `${selectedDate.getFullYear()} 年 ${selectedDate.getMonth() + 1} 月 · 实际按日记录`;
  $("#detailExpected").textContent = formatMoney(categorySummary.expected);
  $("#detailActual").textContent = formatMoney(categorySummary.actual);
  const huabeiNotice = activeDetailCategory === "repayment" && summary.huabeiRepayment
    ? `预计还款中有 ${formatMoney(summary.huabeiRepayment)} 来自上月花呗消费。`
    : categorySummary.huabei
      ? `本月花呗消费 ${formatMoney(categorySummary.huabei)}，不计入本月支出，已自动加入下月预计还款。`
      : "";
  $("#detailHuabeiNotice").textContent = huabeiNotice;
  $("#detailHuabeiNotice").hidden = !huabeiNotice;
  $("#detailCount").textContent = entries.length ? `${entries.length} 条记录` : "还没有记录";
  $("#detailEmpty").hidden = entries.length > 0;

  const groups = entries.reduce((result, entry) => {
    if (!result.has(entry.date)) result.set(entry.date, []);
    result.get(entry.date).push(entry);
    return result;
  }, new Map());
  $("#detailTimeline").innerHTML = [...groups].map(([date, dayEntries]) => `
    <section class="day-group">
      <h3>${detailDate.format(new Date(`${date}T12:00:00`))}</h3>
      <div class="entry-list">
        ${dayEntries.map((entry) => {
          const sign = category.direction === "income" ? "+" : "−";
          const note = entry.note ? escapeHtml(entry.note) : category.label;
          return `<button class="entry-item detail-entry" data-entry-id="${entry.id}">
            <span class="entry-main"><strong>${note}</strong><small>${entry.paymentMethod === "huabei" ? "花呗 · 下月还款" : "实际"}</small></span>
            <span class="entry-amount ${category.direction}">${sign}${formatMoney(entry.amount)}</span>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
          </button>`;
        }).join("")}
      </div>
    </section>
  `).join("");
}

function showView(viewId) {
  document.querySelectorAll(".view").forEach((view) => { view.hidden = view.id !== viewId; });
  document.querySelectorAll(".nav-item").forEach((item) => {
    const activeView = viewId === "detailView" ? "ledgerView" : viewId;
    item.classList.toggle("active", item.dataset.view === activeView);
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function escapeHtml(value) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}

function openEntryForm({ recordType = "actual", category = "daily", id = null } = {}) {
  entryForm.reset();
  $("#entryId").value = "";
  $("#deleteEntry").hidden = true;
  $("#entryDialogTitle").textContent = recordType === "expected" ? "录入计划" : "记一笔";
  entryForm.elements.recordType.value = recordType;
  $("#category").value = category;
  $("#entryDate").value = defaultDateForSelectedMonth();

  if (id) {
    const entry = state.entries.find((item) => item.id === id);
    if (!entry) return;
    $("#entryId").value = entry.id;
    $("#amount").value = entry.amount;
    $("#category").value = entry.category;
    $("#entryDate").value = entry.date;
    $("#note").value = entry.note;
    entryForm.elements.paymentMethod.value = entry.paymentMethod === "huabei" ? "huabei" : "cash";
    entryForm.elements.recordType.value = entry.recordType;
    $("#entryDialogTitle").textContent = "修改记录";
    $("#deleteEntry").hidden = false;
  }
  updateFormKind();
  entryDialog.showModal();
  window.setTimeout(() => $("#amount").focus(), 120);
}

function updateFormKind() {
  const expected = entryForm.elements.recordType.value === "expected";
  $("#actualDateField").hidden = expected;
  $("#actualNoteField").hidden = expected;
  $("#planMonthField").hidden = !expected;
  $("#entryDate").required = !expected;
  const acceptsHuabei = !expected && categories[$("#category").value]?.direction === "expense" && $("#category").value !== "repayment";
  $("#paymentMethodField").hidden = !acceptsHuabei;
  if (!acceptsHuabei) entryForm.elements.paymentMethod.value = "cash";
  $("#planMonthLabel").textContent = `${selectedDate.getFullYear()} 年 ${selectedDate.getMonth() + 1} 月`;
  $("#saveEntry").textContent = expected ? "保存月度预计" : "保存记录";
  if (expected) {
    const plans = state.entries.filter((item) => item.recordType === "expected" && item.category === $("#category").value && item.date.startsWith(selectedMonthKey()));
    $("#entryId").value = plans[0]?.id || "";
    $("#amount").value = plans.length ? plans.reduce((total, item) => total + Number(item.amount), 0) : "";
    $("#deleteEntry").hidden = plans.length === 0;
    $("#entryDialogTitle").textContent = plans.length ? "修改月度预计" : "录入月度预计";
  } else {
    const selectedEntry = state.entries.find((item) => item.id === $("#entryId").value);
    if (selectedEntry?.recordType === "expected") {
      $("#entryId").value = "";
      $("#amount").value = "";
      $("#deleteEntry").hidden = true;
    }
    if (!$("#entryId").value) $("#entryDialogTitle").textContent = "记一笔";
  }
}

function closeEntryForm() {
  entryDialog.close();
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2200);
}

function changeMonth(amount) {
  selectedDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + amount, 1);
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

$("#category").innerHTML = Object.entries(categories)
  .map(([value, item]) => `<option value="${value}">${item.label}</option>`).join("");

$("#previousMonth").addEventListener("click", () => changeMonth(-1));
$("#nextMonth").addEventListener("click", () => changeMonth(1));
$("#monthPicker").addEventListener("click", () => { selectedDate = new Date(); render(); });
$("#addEntry").addEventListener("click", () => openEntryForm({ category: $("#detailView").hidden ? "daily" : activeDetailCategory }));
$("#addExpected").addEventListener("click", () => openEntryForm({ recordType: "expected" }));
$("#detailAdd").addEventListener("click", () => openEntryForm({ category: activeDetailCategory }));
$("#detailEmptyAdd").addEventListener("click", () => openEntryForm({ category: activeDetailCategory }));
$("#detailBack").addEventListener("click", () => showView("ledgerView"));
$("#closeDialog").addEventListener("click", closeEntryForm);
$("#calibrateBalance").addEventListener("click", () => {
  showView("dataView");
  $("#openingBalance").focus();
});

document.addEventListener("click", (event) => {
  const categoryRow = event.target.closest("[data-category]");
  if (categoryRow) {
    activeDetailCategory = categoryRow.dataset.category;
    renderDetail();
    showView("detailView");
  }
  const entry = event.target.closest("[data-entry-id]");
  if (entry) openEntryForm({ id: entry.dataset.entryId });
});

entryForm.elements.recordType.forEach((radio) => radio.addEventListener("change", updateFormKind));
$("#category").addEventListener("change", updateFormKind);
entryForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const existingId = $("#entryId").value;
  const recordType = entryForm.elements.recordType.value;
  const expected = recordType === "expected";
  const category = $("#category").value;
  const planEntries = expected
    ? state.entries.filter((item) => item.recordType === "expected" && item.category === category && item.date.startsWith(selectedMonthKey()))
    : [];
  const sourceEntry = state.entries.find((item) => item.id === existingId) || planEntries[0];
  const entry = {
    id: sourceEntry?.id || crypto.randomUUID(),
    amount: Number($("#amount").value),
    category,
    date: expected ? `${selectedMonthKey()}-01` : $("#entryDate").value,
    note: expected ? "" : $("#note").value.trim(),
    recordType,
    paymentMethod: !expected && categories[category].direction === "expense" && category !== "repayment" && entryForm.elements.paymentMethod.value === "huabei" ? "huabei" : "cash",
    createdAt: sourceEntry?.createdAt || new Date().toISOString()
  };
  if (expected) {
    state.entries = state.entries.filter((item) => !(item.recordType === "expected" && item.category === category && item.date.startsWith(selectedMonthKey())));
    state.entries.push(entry);
  } else if (existingId) state.entries = state.entries.map((item) => item.id === existingId ? entry : item);
  else state.entries.push(entry);
  selectedDate = new Date(`${entry.date}T12:00:00`);
  saveState();
  closeEntryForm();
  render();
  showToast(expected ? "月度预计已保存" : existingId ? "记录已更新" : "已经记下");
});

$("#deleteEntry").addEventListener("click", () => {
  const id = $("#entryId").value;
  const expected = entryForm.elements.recordType.value === "expected";
  const confirmation = expected ? "确定清除这个月的预计吗？" : "确定删除这条记录吗？删除后只能通过备份恢复。";
  if (!id || !window.confirm(confirmation)) return;
  if (expected) {
    const category = $("#category").value;
    state.entries = state.entries.filter((entry) => !(entry.recordType === "expected" && entry.category === category && entry.date.startsWith(selectedMonthKey())));
  } else {
    state.entries = state.entries.filter((entry) => entry.id !== id);
  }
  saveState();
  closeEntryForm();
  render();
  showToast(expected ? "月度预计已清除" : "记录已删除");
});

document.querySelectorAll(".nav-item").forEach((button) => {
  button.addEventListener("click", () => {
    showView(button.dataset.view);
  });
});

$("#balanceForm").addEventListener("submit", (event) => {
  event.preventDefault();
  state.openingBalance = Number($("#openingBalance").value);
  saveState();
  render();
  showToast("余额基准已保存");
});

$("#exportData").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `月余备份-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
  showToast("备份文件已导出");
});

$("#importData").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const restored = validateBackup(JSON.parse(await file.text()));
    if (!window.confirm(`备份中有 ${restored.entries.length} 条记录。恢复后将替换当前账本，是否继续？`)) return;
    state.version = restored.version;
    state.openingBalance = restored.openingBalance;
    state.entries = restored.entries;
    saveState();
    render();
    showToast("备份已恢复");
  } catch (error) {
    showToast(error.message || "备份文件无法读取");
  } finally {
    event.target.value = "";
  }
});

function waitForServiceWorker(worker) {
  if (!worker || worker.state === "activated" || worker.state === "redundant") return Promise.resolve();
  return Promise.race([
    new Promise((resolve) => worker.addEventListener("statechange", () => {
      if (worker.state === "activated" || worker.state === "redundant") resolve();
    })),
    new Promise((resolve) => window.setTimeout(resolve, 8000))
  ]);
}

$("#refreshApp").addEventListener("click", async () => {
  const button = $("#refreshApp");
  const label = $("#refreshAppLabel");
  button.disabled = true;
  label.textContent = "正在检查更新…";
  try {
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        await registration.update();
        await waitForServiceWorker(registration.installing || registration.waiting);
      }
    }
    window.location.reload();
  } catch {
    button.disabled = false;
    label.textContent = "刷新并检查更新";
    showToast(navigator.onLine ? "刷新失败，请稍后再试" : "当前离线，无法检查更新");
  }
});

entryDialog.addEventListener("click", (event) => {
  if (event.target === entryDialog) closeEntryForm();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js"));
}

render();
