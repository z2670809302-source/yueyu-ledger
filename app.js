import { categories, monthKey, monthOpeningBalance, offsetMonthKey, parseAmountExpression, summarize, validateBackup } from "./ledger-core.js";

const STORAGE_KEY = "yueyu-ledger-v1";
const META_KEY = "yueyu-ledger-meta-v1";
const UPDATE_CHECK_TIMEOUT = 6000;
const UPDATE_INSTALL_TIMEOUT = 4000;
const currency = new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY" });
const fullDate = new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "short" });
const detailDate = new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "short" });
const state = loadState();
const meta = loadMeta();
let selectedDate = new Date();
let activeDetailCategory = null;
let statsYear = new Date().getFullYear();
let statsDirection = "expense";
let pendingUpdateWorker = null;
let reloadForUpdate = false;

const $ = (selector) => document.querySelector(selector);
const entryDialog = $("#entryDialog");
const statsDialog = $("#statsDialog");
const entryForm = $("#entryForm");
const statsColors = {
  expense: ["#b6412f", "#d66f52", "#8f2f22", "#d49a62"],
  income: ["#176b54", "#52917d"]
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? validateBackup(JSON.parse(raw)) : { version: 1, openingBalance: 0, openingMonth: monthKey(), entries: [] };
  } catch {
    return { version: 1, openingBalance: 0, openingMonth: monthKey(), entries: [] };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadMeta() {
  try {
    return JSON.parse(localStorage.getItem(META_KEY)) || { lastBackupAt: null };
  } catch {
    return { lastBackupAt: null };
  }
}

function saveMeta() {
  localStorage.setItem(META_KEY, JSON.stringify(meta));
}

function formatMoney(value, signed = false) {
  if (signed && value > 0) return `+${currency.format(value)}`;
  return currency.format(value);
}

function formatDirectionalMoney(value, direction) {
  if (!value) return formatMoney(0);
  return `${direction === "income" ? "+" : "−"}${formatMoney(value)}`;
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
  const openingBalance = monthOpeningBalance(state.openingBalance, state.openingMonth, state.entries, key);
  const summary = summarize(state.entries, key, openingBalance);
  const nowKey = monthKey();
  $("#todayLabel").textContent = fullDate.format(new Date());
  $("#monthTitle").textContent = `${selectedDate.getFullYear()} 年 ${selectedDate.getMonth() + 1} 月`;
  $("#monthStatus").textContent = key === nowKey ? "本月" : key < nowKey ? "历史月份" : "未来计划";
  $("#monthOpeningBalance").textContent = formatMoney(openingBalance);
  $("#expectedIncome").textContent = formatMoney(summary.expectedIncome, true);
  $("#expectedExpense").textContent = formatDirectionalMoney(summary.expectedExpense, "expense");
  $("#expectedRemaining").textContent = formatMoney(summary.expectedRemaining, true);
  $("#actualIncome").textContent = formatMoney(summary.actualIncome, true);
  $("#actualExpense").textContent = formatDirectionalMoney(summary.actualExpense, "expense");
  $("#actualRemaining").textContent = formatMoney(summary.actualRemaining, true);
  $("#planDifference").textContent = formatMoney(summary.planDifference, true);
  $("#planDifference").className = summary.planDifference < 0 ? "negative" : "positive";
  $("#openingBalanceMonth").textContent = `${selectedDate.getFullYear()} 年 ${selectedDate.getMonth() + 1} 月`;
  $("#openingBalance").value = openingBalance;

  $("#categoryRows").innerHTML = Object.entries(categories).map(([key, category]) => `
    <button class="ledger-row category-row" role="row" data-category="${key}" aria-label="查看${category.label}实际每日明细">
      <span role="cell"><i class="direction-mark ${category.direction}"></i>${category.label}</span>
      <strong role="cell">${formatDirectionalMoney(summary.categories[key].expected, category.direction)}</strong>
      <div class="category-actual" role="cell">
        <strong>${formatDirectionalMoney(summary.categories[key].actual, category.direction)}</strong>
        ${summary.categories[key].huabei ? `<small>花呗 ${formatMoney(summary.categories[key].huabei)}</small>` : ""}
      </div>
    </button>
  `).join("");
  renderStats();
  renderBackupStatus();
  if (activeDetailCategory) renderDetail();
}

function annualStats() {
  return Array.from({ length: 12 }, (_, index) => {
    const key = `${statsYear}-${String(index + 1).padStart(2, "0")}`;
    const summary = summarize(state.entries, key);
    const total = statsDirection === "income" ? summary.actualIncome : summary.actualExpense;
    return { key, month: index + 1, summary, total };
  });
}

function renderStats() {
  const months = annualStats();
  const annualTotal = months.reduce((total, item) => total + item.total, 0);
  const maxMonth = Math.max(1, ...months.map((item) => item.total));
  const directionLabel = statsDirection === "income" ? "收入" : "支出";
  const currentKey = monthKey();

  $("#statsYearTitle").textContent = `${statsYear} 年`;
  $("#annualTotalLabel").textContent = `年度${directionLabel}`;
  $("#annualTotal").textContent = formatMoney(annualTotal);
  $("#annualChart").setAttribute("aria-label", `每月${directionLabel}柱状图`);
  $("#annualChart").innerHTML = months.map((item) => `
    <button class="annual-month ${statsDirection}${item.key === currentKey ? " current" : ""}" type="button"
      data-stats-month="${item.key}" ${item.total ? "" : "disabled"}
      aria-label="${item.month}月${directionLabel} ${formatMoney(item.total)}">
      <span class="annual-bar-value">${item.total ? formatMoney(item.total) : ""}</span>
      <span class="annual-bar" style="--bar-height:${item.total / maxMonth * 100}%"></span>
    </button>
  `).join("");
  $("#annualEmpty").hidden = annualTotal > 0;
  $("#annualEmpty").textContent = `这一年还没有实际${directionLabel}`;
  $("#showExpense").classList.toggle("active", statsDirection === "expense");
  $("#showExpense").setAttribute("aria-pressed", String(statsDirection === "expense"));
  $("#showIncome").classList.toggle("active", statsDirection === "income");
  $("#showIncome").setAttribute("aria-pressed", String(statsDirection === "income"));
}

function openStatsDetail(key) {
  const summary = summarize(state.entries, key);
  const total = statsDirection === "income" ? summary.actualIncome : summary.actualExpense;
  const items = Object.entries(categories)
    .filter(([, category]) => category.direction === statsDirection)
    .map(([categoryKey, category], index) => ({
      ...category,
      amount: summary.categories[categoryKey].actual,
      color: statsColors[statsDirection][index]
    }))
    .filter((item) => item.amount > 0);
  const maxAmount = Math.max(1, ...items.map((item) => item.amount));
  const [year, month] = key.split("-").map(Number);

  $("#statsDialogTitle").textContent = `${year} 年 ${month} 月${statsDirection === "income" ? "收入" : "支出"}`;
  $("#statsDialogTotal").textContent = formatMoney(total);
  statsDialog.dataset.direction = statsDirection;
  $("#statsDetailBars").innerHTML = items.map((item) => `
    <div class="stats-detail-row">
      <span>${item.label}</span>
      <span class="stats-detail-track"><i style="--detail-width:${item.amount / maxAmount * 100}%;--detail-color:${item.color}"></i></span>
      <strong>${formatMoney(item.amount)}</strong>
    </div>
  `).join("");

  let angle = 0;
  const stops = items.map((item) => {
    const start = angle;
    angle += item.amount / total * 360;
    return `${item.color} ${start}deg ${angle}deg`;
  });
  $("#statsPie").style.background = `conic-gradient(${stops.join(",")})`;
  $("#statsPie").setAttribute("aria-label", `${month}月${statsDirection === "income" ? "收入" : "支出"}分类占比`);
  $("#statsPieLegend").innerHTML = items.map((item) => `
    <div><i style="--legend-color:${item.color}"></i><span>${item.label}</span><strong>${Math.round(item.amount / total * 100)}%</strong></div>
  `).join("");
  statsDialog.showModal();
}

function renderBackupStatus() {
  const lastBackup = meta.lastBackupAt ? new Date(meta.lastBackupAt) : null;
  const overdue = state.entries.length > 0 && (!lastBackup || Date.now() - lastBackup.getTime() > 31 * 24 * 60 * 60 * 1000);
  $("#backupStatus").textContent = lastBackup
    ? `最近备份：${lastBackup.toLocaleDateString("zh-CN")}${overdue ? " · 建议重新备份" : ""}`
    : `最近备份：尚未备份${overdue ? " · 建议现在备份" : ""}`;
  $("#backupStatus").classList.toggle("warning", overdue);
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
    const activeView = viewId === "detailView" ? "ledgerView" : viewId === "manageView" ? "statsView" : viewId;
    item.classList.toggle("active", item.dataset.view === activeView);
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function escapeHtml(value) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}

function updateAmountResult() {
  const input = $("#amount");
  const total = parseAmountExpression(input.value);
  const valid = Number.isFinite(total) && total > 0;
  input.setCustomValidity(input.value && !valid ? "请输入有效金额，例如 35+65 或 100-20" : "");
  $("#amountResult").hidden = !/[+-]/.test(input.value) || !valid;
  $("#amountResult").textContent = valid ? `= ${formatMoney(total)}` : "";
}

function appendAmountOperator(operator) {
  const input = $("#amount");
  const value = input.value.trim();
  if (!value || /[+-]$/.test(value) || !Number.isFinite(parseAmountExpression(value))) {
    input.reportValidity();
    input.focus();
    return;
  }
  input.value = `${value}${operator}`;
  updateAmountResult();
  input.focus();
}

function openEntryForm({ recordType = "actual", category = "daily", id = null } = {}) {
  entryForm.reset();
  $("#entryId").value = "";
  $("#deleteEntry").hidden = true;
  $("#entryDialogTitle").textContent = recordType === "expected" ? "录入计划" : "记一笔";
  entryForm.elements.recordType.value = recordType;
  $("#category").value = category;
  $("#entryDate").value = defaultDateForSelectedMonth();
  updateAmountResult();

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
  updateAmountResult();
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
  updateAmountResult();
}

function closeEntryForm() {
  entryDialog.close();
}

function showToast(message, action = null) {
  const toast = $("#toast");
  toast.hidden = false;
  toast.replaceChildren(document.createTextNode(message));
  if (action) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = action.label;
    button.addEventListener("click", () => {
      action.run();
      toast.classList.remove("show");
    }, { once: true });
    toast.append(button);
  }
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2200);
}

function changeMonth(amount) {
  selectedDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + amount, 1);
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function copyPreviousPlans() {
  const currentMonth = selectedMonthKey();
  const previousMonth = offsetMonthKey(currentMonth, -1);
  const existingCategories = new Set(state.entries
    .filter((entry) => entry.recordType === "expected" && entry.date.startsWith(currentMonth))
    .map((entry) => entry.category));
  const previousPlans = state.entries
    .filter((entry) => entry.recordType === "expected" && entry.date.startsWith(previousMonth))
    .reduce((plans, entry) => {
      plans.set(entry.category, (plans.get(entry.category) || 0) + Number(entry.amount));
      return plans;
    }, new Map());
  const copied = [...previousPlans]
    .filter(([category]) => !existingCategories.has(category))
    .map(([category, amount]) => ({
      id: crypto.randomUUID(),
      date: `${currentMonth}-01`,
      category,
      recordType: "expected",
      paymentMethod: "cash",
      amount,
      note: "",
      createdAt: new Date().toISOString()
    }));
  if (!previousPlans.size) {
    showToast("上月没有可沿用的计划");
    return;
  }
  if (!copied.length) {
    showToast("本月计划已经齐全");
    return;
  }
  state.entries.push(...copied);
  saveState();
  render();
  showToast(`已沿用 ${copied.length} 项计划`);
}

$("#category").innerHTML = Object.entries(categories)
  .map(([value, item]) => `<option value="${value}">${item.label}</option>`).join("");

$("#previousMonth").addEventListener("click", () => changeMonth(-1));
$("#nextMonth").addEventListener("click", () => changeMonth(1));
$("#monthPicker").addEventListener("click", () => { selectedDate = new Date(); render(); });
$("#statsPreviousYear").addEventListener("click", () => { statsYear -= 1; renderStats(); });
$("#statsNextYear").addEventListener("click", () => { statsYear += 1; renderStats(); });
$("#statsYearPicker").addEventListener("click", () => { statsYear = new Date().getFullYear(); renderStats(); });
$("#showExpense").addEventListener("click", () => { statsDirection = "expense"; renderStats(); });
$("#showIncome").addEventListener("click", () => { statsDirection = "income"; renderStats(); });
$("#closeStatsDialog").addEventListener("click", () => statsDialog.close());
$("#addEntry").addEventListener("click", () => openEntryForm({ category: $("#detailView").hidden ? "daily" : activeDetailCategory }));
$("#addExpected").addEventListener("click", () => openEntryForm({ recordType: "expected" }));
$("#copyPreviousPlan").addEventListener("click", copyPreviousPlans);
$("#openManage").addEventListener("click", () => showView("manageView"));
$("#detailAdd").addEventListener("click", () => openEntryForm({ category: activeDetailCategory }));
$("#detailEmptyAdd").addEventListener("click", () => openEntryForm({ category: activeDetailCategory }));
$("#detailBack").addEventListener("click", () => showView("ledgerView"));
$("#closeDialog").addEventListener("click", closeEntryForm);
$("#calibrateBalance").addEventListener("click", () => {
  showView("manageView");
  $("#openingBalance").focus();
});

document.addEventListener("click", (event) => {
  const statsMonth = event.target.closest("[data-stats-month]");
  if (statsMonth) openStatsDetail(statsMonth.dataset.statsMonth);
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
$("#amount").addEventListener("input", updateAmountResult);
$("#addAmountPart").addEventListener("click", () => appendAmountOperator("+"));
$("#subtractAmountPart").addEventListener("click", () => appendAmountOperator("-"));
$("#calculateAmount").addEventListener("click", () => {
  const input = $("#amount");
  const expression = input.value.trim();
  const total = parseAmountExpression(expression);
  if (!Number.isFinite(total) || total <= 0) {
    updateAmountResult();
    input.reportValidity();
    input.focus();
    return;
  }
  input.value = String(total);
  input.setCustomValidity("");
  $("#amountResult").hidden = false;
  $("#amountResult").textContent = `${expression} = ${formatMoney(total)}`;
  input.focus();
});
entryForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const amount = parseAmountExpression($("#amount").value);
  if (!Number.isFinite(amount) || amount <= 0) {
    updateAmountResult();
    $("#amount").reportValidity();
    return;
  }
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
    amount,
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
  const confirmation = expected ? "确定清除这个月的预计吗？" : "确定删除这条记录吗？";
  if (!id || !window.confirm(confirmation)) return;
  let deletedEntries = [];
  if (expected) {
    const category = $("#category").value;
    deletedEntries = state.entries.filter((entry) => entry.recordType === "expected" && entry.category === category && entry.date.startsWith(selectedMonthKey()));
    state.entries = state.entries.filter((entry) => !(entry.recordType === "expected" && entry.category === category && entry.date.startsWith(selectedMonthKey())));
  } else {
    deletedEntries = state.entries.filter((entry) => entry.id === id);
    state.entries = state.entries.filter((entry) => entry.id !== id);
  }
  saveState();
  closeEntryForm();
  render();
  showToast(expected ? "月度预计已清除" : "记录已删除", {
    label: "撤销",
    run: () => {
      state.entries.push(...deletedEntries);
      saveState();
      render();
      showToast("已经恢复");
    }
  });
});

document.querySelectorAll(".nav-item").forEach((button) => {
  button.addEventListener("click", () => {
    showView(button.dataset.view);
  });
});

$("#balanceForm").addEventListener("submit", (event) => {
  event.preventDefault();
  state.openingBalance = Number($("#openingBalance").value);
  state.openingMonth = selectedMonthKey();
  saveState();
  render();
  showToast("本月月初余额已保存");
});

$("#exportData").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `月余备份-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
  meta.lastBackupAt = new Date().toISOString();
  saveMeta();
  renderBackupStatus();
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
    state.openingMonth = restored.openingMonth;
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
  if (!worker || ["installed", "activated", "redundant"].includes(worker.state)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("UPDATE_TIMEOUT")), UPDATE_INSTALL_TIMEOUT);
    worker.addEventListener("statechange", () => {
      if (["installed", "activated", "redundant"].includes(worker.state)) resolve();
      if (["installed", "activated", "redundant"].includes(worker.state)) window.clearTimeout(timer);
    });
  });
}

function checkForUpdate(registration) {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("UPDATE_TIMEOUT")), UPDATE_CHECK_TIMEOUT);
    registration.update().then((result) => {
      window.clearTimeout(timer);
      resolve(result);
    }, (error) => {
      window.clearTimeout(timer);
      reject(error);
    });
  });
}

function showUpdateNotice(worker) {
  if (!worker || worker.state !== "installed" || !navigator.serviceWorker.controller) return;
  pendingUpdateWorker = worker;
  $("#updateNotice").hidden = false;
}

function installPendingUpdate() {
  if (!pendingUpdateWorker) {
    window.location.reload();
    return;
  }
  reloadForUpdate = true;
  $("#installUpdate").disabled = true;
  $("#installUpdate").textContent = "更新中…";
  pendingUpdateWorker.postMessage("SKIP_WAITING");
  window.setTimeout(() => window.location.reload(), 4000);
}

$("#installUpdate").addEventListener("click", installPendingUpdate);

$("#refreshApp").addEventListener("click", async () => {
  const button = $("#refreshApp");
  const label = $("#refreshAppLabel");
  button.disabled = true;
  label.textContent = "正在检查更新…";
  try {
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        await checkForUpdate(registration);
        const worker = registration.installing || registration.waiting;
        await waitForServiceWorker(worker);
        const readyWorker = registration.waiting || worker;
        if (readyWorker?.state === "installed" && navigator.serviceWorker.controller) {
          pendingUpdateWorker = readyWorker;
          installPendingUpdate();
          return;
        }
      }
    }
    window.location.reload();
  } catch (error) {
    button.disabled = false;
    label.textContent = "刷新并检查更新";
    showToast(!navigator.onLine
      ? "当前离线，无法检查更新"
      : error.message === "UPDATE_TIMEOUT"
        ? "检查超时，请稍后重试"
        : "刷新失败，请稍后再试");
  }
});

entryDialog.addEventListener("click", (event) => {
  if (event.target === entryDialog) closeEntryForm();
});

statsDialog.addEventListener("click", (event) => {
  if (event.target === statsDialog) statsDialog.close();
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloadForUpdate) window.location.reload();
  });
  window.addEventListener("load", async () => {
    const registration = await navigator.serviceWorker.register("./sw.js");
    if (registration.waiting) showUpdateNotice(registration.waiting);
    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      worker?.addEventListener("statechange", () => {
        if (worker.state === "installed") showUpdateNotice(worker);
      });
    });
    if (navigator.onLine) checkForUpdate(registration).catch(() => {});
  });
}

render();
