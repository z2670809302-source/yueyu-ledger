import { categories, monthKey, monthOpeningBalance, offsetMonthKey, parseAmountExpression, searchEntries, summarize, validAmountExpression, validateBackup } from "./ledger-core.js";

const STORAGE_KEY = "yueyu-ledger-v1";
const META_KEY = "yueyu-ledger-meta-v1";
const UPDATE_CHECK_TIMEOUT = 12000;
const UPDATE_INSTALL_TIMEOUT = 4000;
const currency = new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY" });
const fullDate = new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "short" });
const lunarDate = new Intl.DateTimeFormat("zh-CN-u-ca-chinese", { year: "numeric", month: "long", day: "numeric" });
const detailDate = new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "short" });
const searchDate = new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
const state = loadState();
const meta = loadMeta();
let selectedDate = new Date();
let activeDetailCategory = null;
let statsYear = new Date().getFullYear();
let statsDirection = "expense";
let pendingUpdateWorker = null;
let pendingUpdateVersion = null;
let reloadForUpdate = false;
let amountExpressionDraft = "";
let manageReturnView = "statsView";

const $ = (selector) => document.querySelector(selector);
const entryDialog = $("#entryDialog");
const statsDialog = $("#statsDialog");
const entryForm = $("#entryForm");
const statsColors = {
  expense: ["#f07b4f", "#f2a441", "#d85d7f", "#9370c9"],
  income: ["#66a927", "#3aa58c"]
};
const categoryIcons = {
  salary: '<img src="./assets/illustrations/categories/salary.webp?v=2.212" alt="" decoding="sync" />',
  receivable: '<img src="./assets/illustrations/categories/receivable.webp?v=2.212" alt="" decoding="sync" />',
  repayment: '<img src="./assets/illustrations/categories/repayment.webp?v=2.212" alt="" decoding="sync" />',
  rent: '<img src="./assets/illustrations/categories/rent.webp?v=2.212" alt="" decoding="sync" />',
  daily: '<img src="./assets/illustrations/categories/daily.webp?v=2.212" alt="" decoding="sync" />',
  special: '<img src="./assets/illustrations/categories/special.webp?v=2.212" alt="" decoding="sync" />'
};
const subcategoryPresets = {
  salary: [["基本工资", "💵"], ["绩效奖金", "🏆"], ["津贴补贴", "🎫"], ["加班费", "⏰"], ["兼职副业", "💻"], ["年终奖", "🧨"], ["提成佣金", "📈"], ["其他", "🪙"]],
  receivable: [["转账收款", "📲"], ["报销到账", "🧾"], ["借款归还", "🤝"], ["红包礼金", "🧧"], ["退款返现", "↩️"], ["利息收入", "🏦"], ["二手转卖", "♻️"], ["其他", "💰"]],
  repayment: [["花呗", "🌼"], ["信用卡", "💳"], ["房贷", "🏠"], ["车贷", "🚗"], ["消费贷", "🧮"], ["借款归还", "🤝"], ["分期付款", "🗓️"], ["其他", "📅"]],
  rent: [["房租", "🏡"], ["物业费", "🏢"], ["水费", "💧"], ["电费", "💡"], ["燃气费", "🔥"], ["宽带费", "📶"], ["家居维修", "🧰"], ["其他", "🗝️"]],
  daily: [["吃饭", "🍚"], ["零食", "🍪"], ["买菜", "🥬"], ["交通出行", "🚌"], ["日用品", "🛍️"], ["通讯", "📱"], ["医疗", "🩹"], ["娱乐", "🎬"], ["服饰", "👕"], ["其他", "🧺"]],
  special: [["旅行", "🧳"], ["人情礼金", "🧧"], ["礼物", "🎁"], ["大件购物", "🛋️"], ["维修", "🧰"], ["学习提升", "📚"], ["宠物", "🐾"], ["保险", "🛡️"], ["其他", "✨"]]
};
function subcategoryIcon(category, label) {
  return subcategoryPresets[category]?.find(([name]) => name === label)?.[1] || "✏️";
}

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

function formatAmountExpression(expression) {
  return escapeHtml(expression.replace(/\+/g, " + ").replace(/-/g, " − "));
}

function selectedMonthKey() {
  return monthKey(selectedDate);
}

function defaultDateForSelectedMonth() {
  const lastDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate();
  const day = Math.min(new Date().getDate(), lastDay);
  return `${selectedMonthKey()}-${String(day).padStart(2, "0")}`;
}

function chineseDay(value) {
  const day = Number(value);
  const digits = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
  if (day <= 10) return `初${digits[day]}`;
  if (day < 20) return `十${digits[day - 10]}`;
  if (day === 20) return "二十";
  if (day < 30) return `廿${digits[day - 20]}`;
  return "三十";
}

function formatLunarDate(value, includeYear = false) {
  const date = value instanceof Date ? value : new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  const parts = Object.fromEntries(lunarDate.formatToParts(date).map((part) => [part.type, part.value]));
  const label = `农历${parts.month}${chineseDay(parts.day)}`;
  return includeYear && parts.yearName ? `${label} · ${parts.yearName}年` : label;
}

function updateEntryLunarDate() {
  const dateValue = $("#entryDate").value;
  $("#entryDateDisplay").textContent = dateValue ? dateValue.replaceAll("-", "/") : "请选择日期";
  $("#entryLunarDate").textContent = formatLunarDate(dateValue, true);
}

function render() {
  const key = selectedMonthKey();
  const openingBalance = monthOpeningBalance(state.openingBalance, state.openingMonth, state.entries, key);
  const summary = summarize(state.entries, key, openingBalance);
  const nowKey = monthKey();
  $("#todayLabel").textContent = fullDate.format(new Date());
  $("#todayLunarLabel").textContent = formatLunarDate(new Date());
  $("#monthTitle").textContent = `${selectedDate.getFullYear()} 年 ${selectedDate.getMonth() + 1} 月`;
  $("#monthStatus").textContent = key === nowKey ? "本月" : key < nowKey ? "历史月份" : "未来计划";
  $("#overviewMonth").textContent = `${selectedDate.getFullYear()}年${selectedDate.getMonth() + 1}月`;
  $("#monthOpeningBalance").textContent = formatMoney(openingBalance);
  $("#expectedIncome").textContent = formatMoney(summary.expectedIncome, true);
  $("#expectedExpense").textContent = formatDirectionalMoney(summary.expectedExpense, "expense");
  $("#expectedRemaining").textContent = formatMoney(summary.expectedRemaining, true);
  $("#actualIncome").textContent = formatMoney(summary.actualIncome, true);
  $("#actualExpense").textContent = formatDirectionalMoney(summary.actualExpense, "expense");
  $("#actualRemaining").textContent = formatMoney(summary.actualRemaining, true);
  $("#netAssetValue").textContent = formatMoney(summary.actualRemaining);
  const expectedMonthlyNet = summary.expectedIncome - summary.expectedExpense;
  const actualMonthlyNet = summary.actualIncome - summary.actualExpense;
  $("#expectedMonthlyNet").textContent = formatMoney(expectedMonthlyNet, true);
  $("#actualMonthlyNet").textContent = formatMoney(actualMonthlyNet, true);
  const progressWidth = (actual, expected) => `${Math.min(100, expected > 0 ? actual / expected * 100 : actual > 0 ? 100 : 0)}%`;
  $("#incomeProgress").style.width = progressWidth(summary.actualIncome, summary.expectedIncome);
  $("#expenseProgress").style.width = progressWidth(summary.actualExpense, summary.expectedExpense);
  $("#remainingProgress").style.width = progressWidth(Math.max(0, actualMonthlyNet), Math.max(0, expectedMonthlyNet));
  $("#planDifference").textContent = formatMoney(summary.planDifference, true);
  $("#planDifference").className = summary.planDifference < 0 ? "negative" : "positive";
  $("#openingBalanceMonth").textContent = `${selectedDate.getFullYear()} 年 ${selectedDate.getMonth() + 1} 月`;
  $("#openingBalance").value = openingBalance;

  $("#categoryRows").innerHTML = Object.entries(categories).map(([key, category]) => `
    <button class="ledger-row category-row" role="row" data-category="${key}" aria-label="查看${category.label}实际每日明细">
      <span role="cell"><i class="category-icon category-${key}">${categoryIcons[key]}</i>${category.label}</span>
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
  if (!$("#searchView").hidden) renderSearchResults();
}

function annualStats() {
  return Array.from({ length: 12 }, (_, index) => {
    const key = `${statsYear}-${String(index + 1).padStart(2, "0")}`;
    const summary = summarize(state.entries, key);
    const total = statsDirection === "income" ? summary.actualIncome : summary.actualExpense;
    return { key, month: index + 1, summary, total };
  });
}

function annualBalanceTrend() {
  const now = new Date();
  const monthCount = statsYear < now.getFullYear() ? 12 : statsYear === now.getFullYear() ? now.getMonth() + 1 : 0;
  return Array.from({ length: monthCount }, (_, index) => {
    const key = `${statsYear}-${String(index + 1).padStart(2, "0")}`;
    const balance = monthOpeningBalance(state.openingBalance, state.openingMonth, state.entries, offsetMonthKey(key, 1));
    return { month: index + 1, balance };
  });
}

function renderBalanceTrend() {
  const points = annualBalanceTrend();
  const target = $("#balanceTrend");
  if (!points.length) {
    target.innerHTML = '<p class="annual-empty">这一年还没有月末结余</p>';
    target.setAttribute("aria-label", "这一年还没有月末结余");
    return;
  }
  const width = 320;
  const height = 166;
  const padding = { top: 14, right: 10, bottom: 24, left: 10 };
  const values = points.map((item) => item.balance);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const spread = Math.max(1, rawMax - rawMin);
  const min = rawMin - spread * .12;
  const max = rawMax + spread * .12;
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const coordinates = points.map((item, index) => ({
    ...item,
    x: padding.left + (points.length === 1 ? plotWidth / 2 : index / (points.length - 1) * plotWidth),
    y: padding.top + (max - item.balance) / (max - min) * plotHeight
  }));
  const line = coordinates.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const area = `${padding.left},${height - padding.bottom} ${line} ${coordinates.at(-1).x.toFixed(1)},${height - padding.bottom}`;
  const labels = coordinates.filter((_, index) => index === 0 || index === coordinates.length - 1 || (index + 1) % 3 === 0);
  target.setAttribute("aria-label", `${statsYear}年月末结余走势，从${formatMoney(values[0])}到${formatMoney(values.at(-1))}`);
  target.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" aria-hidden="true" preserveAspectRatio="none">
      <defs><linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b9ed35" stop-opacity=".28"/><stop offset="1" stop-color="#b9ed35" stop-opacity="0"/></linearGradient></defs>
      <line class="trend-grid" x1="${padding.left}" y1="${padding.top + plotHeight * .25}" x2="${width - padding.right}" y2="${padding.top + plotHeight * .25}"/>
      <line class="trend-grid" x1="${padding.left}" y1="${padding.top + plotHeight * .75}" x2="${width - padding.right}" y2="${padding.top + plotHeight * .75}"/>
      <polygon class="trend-area" points="${area}"/>
      <polyline class="trend-line" points="${line}"/>
      ${coordinates.map((point) => `<circle class="trend-point" cx="${point.x}" cy="${point.y}" r="4"><title>${point.month}月 ${formatMoney(point.balance)}</title></circle>`).join("")}
      ${labels.map((point) => `<text class="trend-label" x="${point.x}" y="${height - 6}">${point.month}月</text>`).join("")}
    </svg>`;
}

function renderAnnualExpensePie(months) {
  const items = Object.entries(categories)
    .filter(([, category]) => category.direction === "expense")
    .map(([key, category], index) => ({
      label: category.label,
      color: statsColors.expense[index],
      amount: months.reduce((total, month) => total + month.summary.categories[key].actual, 0)
    }))
    .filter((item) => item.amount > 0);
  const total = items.reduce((sum, item) => sum + item.amount, 0);
  let angle = 0;
  const stops = items.map((item) => {
    const start = angle;
    angle += item.amount / total * 360;
    return `${item.color} ${start}deg ${angle}deg`;
  });
  $("#annualExpensePie").style.background = total ? `conic-gradient(${stops.join(",")})` : "conic-gradient(#eee9dc 0 360deg)";
  $("#annualExpensePie").setAttribute("aria-label", total ? `${statsYear}年支出分类占比` : `${statsYear}年没有实际支出`);
  $("#annualExpensePieTotal").textContent = formatMoney(total);
  $("#annualExpenseLegend").innerHTML = items.map((item) => `
    <div><i style="--legend-color:${item.color}"></i><span>${item.label}</span><strong>${Math.round(item.amount / total * 100)}%</strong></div>
  `).join("");
  $("#annualExpenseEmpty").hidden = total > 0;
}

function renderStats() {
  const months = annualStats();
  const annualTotal = months.reduce((total, item) => total + item.total, 0);
  const annualIncome = months.reduce((total, item) => total + item.summary.actualIncome, 0);
  const annualExpense = months.reduce((total, item) => total + item.summary.actualExpense, 0);
  const annualNet = annualIncome - annualExpense;
  const balancePoints = annualBalanceTrend();
  const latestBalance = balancePoints.at(-1)?.balance ?? monthOpeningBalance(
    state.openingBalance,
    state.openingMonth,
    state.entries,
    `${statsYear}-01`
  );
  const maxMonth = Math.max(1, ...months.map((item) => item.total));
  const directionLabel = statsDirection === "income" ? "收入" : "支出";
  const currentKey = monthKey();

  $("#statsYearTitle").textContent = `${statsYear} 年`;
  $("#statsAnnualIncome").textContent = formatMoney(annualIncome);
  $("#statsAnnualExpense").textContent = formatMoney(annualExpense);
  $("#statsAnnualNet").textContent = formatMoney(annualNet);
  $("#statsAnnualNet").classList.toggle("negative", annualNet < 0);
  $("#statsLatestBalance").textContent = formatMoney(latestBalance);
  $("#statsLatestBalance").classList.toggle("negative", latestBalance < 0);
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
  renderBalanceTrend();
  renderAnnualExpensePie(months);
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
  $("#detailMonth").textContent = `${category.label} · ${selectedDate.getFullYear()} 年 ${selectedDate.getMonth() + 1} 月明细`;
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
          const subcategory = escapeHtml(entry.subcategory || "");
          const note = entry.note ? escapeHtml(entry.note) : subcategory || category.label;
          const calculation = entry.amountExpression
            ? `${formatAmountExpression(entry.amountExpression)} = ${formatMoney(entry.amount)}`
            : "";
          const detailLabel = [entry.note && subcategory ? subcategory : "", entry.paymentMethod === "huabei" ? "花呗 · 下月还款" : "", calculation || (!entry.paymentMethod || entry.paymentMethod === "cash" ? "实际" : "")]
            .filter(Boolean).join(" · ");
          return `<button class="entry-item detail-entry" data-entry-id="${entry.id}">
            <i class="entry-subcategory-icon" aria-hidden="true">${subcategoryIcon(entry.category, entry.subcategory)}</i>
            <span class="entry-main"><strong>${note}</strong><small>${detailLabel}</small></span>
            <span class="entry-amount ${category.direction}">${sign}${formatMoney(entry.amount)}</span>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
          </button>`;
        }).join("")}
      </div>
    </section>
  `).join("");
}

function searchFilters() {
  return {
    keyword: $("#searchKeyword").value,
    amount: $("#searchAmount").value,
    startDate: $("#searchStartDate").value,
    endDate: $("#searchEndDate").value,
    minAmount: $("#searchMinAmount").value,
    maxAmount: $("#searchMaxAmount").value,
    category: $("#searchCategory").value,
    recordType: $("#searchRecordType").value,
    direction: $("#searchDirection").value,
    paymentMethod: $("#searchPayment").value
  };
}

function renderSearchResults() {
  const filters = searchFilters();
  const activeFilterCount = Object.values(filters).filter((value) => String(value).trim()).length;
  const hasQuery = activeFilterCount > 0;
  $("#searchSummary").hidden = !hasQuery;
  $("#searchResults").hidden = !hasQuery;
  if (!hasQuery) {
    $("#searchCount").textContent = "0";
    $("#searchIncome").textContent = formatMoney(0);
    $("#searchExpense").textContent = formatMoney(0);
    $("#searchHuabei").textContent = formatMoney(0);
    $("#searchResultHint").textContent = "";
    $("#searchEmpty").hidden = true;
    $("#searchResultList").hidden = true;
    $("#searchResultList").innerHTML = "";
    return;
  }
  const results = searchEntries(state.entries, filters);
  const actualEntries = results.filter((entry) => entry.recordType === "actual");
  const income = actualEntries
    .filter((entry) => categories[entry.category].direction === "income")
    .reduce((total, entry) => total + Number(entry.amount), 0);
  const huabei = actualEntries
    .filter((entry) => categories[entry.category].direction === "expense" && entry.paymentMethod === "huabei")
    .reduce((total, entry) => total + Number(entry.amount), 0);
  const expense = actualEntries
    .filter((entry) => categories[entry.category].direction === "expense" && entry.paymentMethod !== "huabei")
    .reduce((total, entry) => total + Number(entry.amount), 0);
  $("#searchCount").textContent = String(results.length);
  $("#searchIncome").textContent = formatMoney(income);
  $("#searchExpense").textContent = formatMoney(expense);
  $("#searchHuabei").textContent = formatMoney(huabei);
  $("#searchResultHint").textContent = `已应用 ${activeFilterCount} 项条件`;
  $("#searchEmpty").hidden = results.length > 0;
  $("#searchResultList").hidden = results.length === 0;
  $("#searchResultList").innerHTML = results.map((entry) => {
    const category = categories[entry.category];
    const actual = entry.recordType === "actual";
    const payment = actual && entry.paymentMethod === "huabei" ? "花呗" : actual ? "余额支付" : "预计";
    const calculation = entry.amountExpression ? `${formatAmountExpression(entry.amountExpression)} = ${formatMoney(entry.amount)}` : "";
    const subcategory = escapeHtml(entry.subcategory || "");
    const title = entry.note ? escapeHtml(entry.note) : subcategory || category.label;
    return `<button class="search-result-item" type="button" data-search-entry-id="${entry.id}">
      <time datetime="${entry.date}">${searchDate.format(new Date(`${entry.date}T12:00:00`))}</time>
      <span class="search-result-main">
        <strong>${title}</strong>
        <small>${category.label}${entry.note && subcategory ? ` · ${subcategory}` : ""} · ${payment}${calculation ? ` · ${calculation}` : ""}</small>
      </span>
      <strong class="search-result-amount ${category.direction}">${formatDirectionalMoney(entry.amount, category.direction)}</strong>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
    </button>`;
  }).join("");
}

function showView(viewId) {
  document.querySelectorAll(".view").forEach((view) => { view.hidden = view.id !== viewId; });
  document.querySelectorAll(".nav-item").forEach((item) => {
    const activeView = ["detailView", "searchView"].includes(viewId) ? "ledgerView" : viewId === "manageView" ? "statsView" : viewId;
    item.classList.toggle("active", item.dataset.view === activeView);
  });
  window.scrollTo({ top: 0, behavior: "auto" });
}

function escapeHtml(value) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}

function updateAmountResult() {
  const input = $("#amount");
  const total = parseAmountExpression(input.value);
  const valid = Number.isFinite(total) && total > 0;
  amountExpressionDraft = validAmountExpression(input.value, total);
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

function setSubcategoryMenu(open) {
  const menu = $("#subcategorySuggestions");
  menu.hidden = !open;
  $("#subcategoryToggle").setAttribute("aria-expanded", String(open));
}

function setSubcategory(value, { custom = false } = {}) {
  const category = $("#category").value;
  const normalized = String(value || "").trim().slice(0, 20);
  $("#subcategory").value = normalized;
  const display = $("#subcategoryValue");
  display.classList.toggle("placeholder", !normalized);
  display.innerHTML = normalized
    ? `<i aria-hidden="true">${custom ? "✏️" : subcategoryIcon(category, normalized)}</i><span>${escapeHtml(normalized)}</span>`
    : "<span>选择小分类</span>";
  $("#subcategoryCustomField").hidden = !custom;
  if (custom && $("#subcategoryCustom").value !== normalized) $("#subcategoryCustom").value = normalized;
  if (!custom) $("#subcategoryCustom").value = "";
  $("#subcategorySuggestions").querySelectorAll("[data-subcategory]").forEach((option) => {
    option.setAttribute("aria-selected", String(option.dataset.subcategory === normalized));
  });
}

function renderSubcategoryPicker() {
  const category = $("#category").value;
  const presets = subcategoryPresets[category] || [];
  const current = $("#subcategory").value.trim();
  $("#subcategorySuggestions").innerHTML = `${presets.map(([label, icon]) => `
    <button type="button" role="option" data-subcategory="${escapeHtml(label)}" aria-selected="${label === current}">
      <i aria-hidden="true">${icon}</i><span>${escapeHtml(label)}</span><b aria-hidden="true">✓</b>
    </button>`).join("")}
    <button class="custom-subcategory-option" type="button" role="option" data-subcategory-custom aria-selected="false">
      <i aria-hidden="true">✏️</i><span>自己输入</span><b aria-hidden="true">›</b>
    </button>`;
  const custom = Boolean(current) && !presets.some(([label]) => label === current);
  setSubcategory(current, { custom });
  setSubcategoryMenu(false);
}

function openEntryForm({ recordType = "actual", category = "daily", id = null } = {}) {
  entryForm.reset();
  setSubcategory("");
  setSubcategoryMenu(false);
  amountExpressionDraft = "";
  $("#entryId").value = "";
  $("#deleteEntry").hidden = true;
  $("#entryDialogTitle").textContent = recordType === "expected" ? "录入计划" : "记一笔";
  entryForm.elements.recordType.value = recordType;
  $("#category").value = category;
  $("#entryDate").value = defaultDateForSelectedMonth();
  updateEntryLunarDate();
  updateAmountResult();

  if (id) {
    const entry = state.entries.find((item) => item.id === id);
    if (!entry) return;
    $("#entryId").value = entry.id;
    $("#amount").value = entry.amountExpression || entry.amount;
    $("#category").value = entry.category;
    $("#subcategory").value = entry.subcategory || "";
    $("#entryDate").value = entry.date;
    updateEntryLunarDate();
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
  $("#categoryDisplay").textContent = categories[$("#category").value]?.label || "";
  renderSubcategoryPicker();
  $("#actualDateField").hidden = expected;
  $("#actualNoteField").hidden = expected;
  $("#actualSubcategoryField").hidden = expected;
  $("#planMonthField").hidden = !expected;
  $("#entryDate").required = !expected;
  const acceptsHuabei = !expected && categories[$("#category").value]?.direction === "expense" && $("#category").value !== "repayment";
  $("#paymentMethodField").hidden = !acceptsHuabei;
  if (!acceptsHuabei) entryForm.elements.paymentMethod.value = "cash";
  $("#planMonthLabel").textContent = `${selectedDate.getFullYear()} 年 ${selectedDate.getMonth() + 1} 月`;
  $("#saveEntry").textContent = expected ? "保存月度预计" : "保存记录";
  if (expected) {
    const plans = state.entries.filter((item) => item.recordType === "expected" && item.category === $("#category").value && item.date.startsWith(selectedMonthKey()));
    const planAmount = plans.reduce((total, item) => total + Number(item.amount), 0);
    amountExpressionDraft = plans.length === 1 ? validAmountExpression(plans[0].amountExpression, planAmount) : "";
    $("#entryId").value = plans[0]?.id || "";
    $("#amount").value = plans.length ? amountExpressionDraft || planAmount : "";
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
  setSubcategoryMenu(false);
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
      const existing = plans.get(entry.category);
      plans.set(entry.category, {
        amount: Number(entry.amount) + Number(existing?.amount || 0),
        amountExpression: existing ? "" : entry.amountExpression || ""
      });
      return plans;
    }, new Map());
  const copied = [...previousPlans]
    .filter(([category]) => !existingCategories.has(category))
    .map(([category, plan]) => ({
      id: crypto.randomUUID(),
      date: `${currentMonth}-01`,
      category,
      recordType: "expected",
      paymentMethod: "cash",
      amount: plan.amount,
      amountExpression: plan.amountExpression,
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
$("#searchCategory").insertAdjacentHTML("beforeend", Object.entries(categories)
  .map(([value, item]) => `<option value="${value}">${item.label}</option>`).join(""));

$("#previousMonth").addEventListener("click", () => changeMonth(-1));
$("#nextMonth").addEventListener("click", () => changeMonth(1));
$("#monthPicker").addEventListener("click", () => { selectedDate = new Date(); render(); });
$("#statsPreviousYear").addEventListener("click", () => { statsYear -= 1; renderStats(); });
$("#statsNextYear").addEventListener("click", () => { statsYear += 1; renderStats(); });
$("#statsYearPicker").addEventListener("click", () => { statsYear = new Date().getFullYear(); renderStats(); });
$("#showExpense").addEventListener("click", () => { statsDirection = "expense"; renderStats(); });
$("#showIncome").addEventListener("click", () => { statsDirection = "income"; renderStats(); });
$("#closeStatsDialog").addEventListener("click", () => statsDialog.close());
$("#openSearch").addEventListener("click", () => { renderSearchResults(); showView("searchView"); });
$("#searchBack").addEventListener("click", () => showView("ledgerView"));
$("#clearSearch").addEventListener("click", () => {
  $("#searchForm").reset();
  $("#searchMore").open = false;
  renderSearchResults();
});
$("#searchForm").addEventListener("input", renderSearchResults);
$("#searchForm").addEventListener("change", renderSearchResults);
$("#searchForm").addEventListener("submit", (event) => {
  event.preventDefault();
  renderSearchResults();
});
$("#addEntry").addEventListener("click", () => openEntryForm({ category: $("#detailView").hidden ? "daily" : activeDetailCategory }));
$("#addExpected").addEventListener("click", () => openEntryForm({ recordType: "expected" }));
$("#copyPreviousPlan").addEventListener("click", copyPreviousPlans);
$("#openManage").addEventListener("click", () => {
  manageReturnView = "statsView";
  showView("manageView");
});
$("#manageBack").addEventListener("click", () => showView(manageReturnView));
$("#detailAdd").addEventListener("click", () => openEntryForm({ category: activeDetailCategory }));
$("#detailEmptyAdd").addEventListener("click", () => openEntryForm({ category: activeDetailCategory }));
$("#detailBack").addEventListener("click", () => showView("ledgerView"));
$("#closeDialog").addEventListener("click", closeEntryForm);
$("#calibrateBalance").addEventListener("click", () => {
  manageReturnView = "ledgerView";
  showView("manageView");
  $("#openingBalance").focus();
});

document.addEventListener("click", (event) => {
  if (!event.target.closest("#actualSubcategoryField")) setSubcategoryMenu(false);
  const searchEntry = event.target.closest("[data-search-entry-id]");
  if (searchEntry) {
    const entry = state.entries.find((item) => item.id === searchEntry.dataset.searchEntryId);
    if (entry) selectedDate = new Date(`${entry.date}T12:00:00`);
    openEntryForm({ id: searchEntry.dataset.searchEntryId });
    return;
  }
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
$("#category").addEventListener("change", () => {
  setSubcategory("");
  updateFormKind();
});
$("#subcategoryToggle").addEventListener("click", () => {
  setSubcategoryMenu($("#subcategorySuggestions").hidden);
});
$("#subcategorySuggestions").addEventListener("click", (event) => {
  const customOption = event.target.closest("[data-subcategory-custom]");
  if (customOption) {
    setSubcategory("", { custom: true });
    setSubcategoryMenu(false);
    window.setTimeout(() => $("#subcategoryCustom").focus(), 0);
    return;
  }
  const option = event.target.closest("[data-subcategory]");
  if (!option) return;
  setSubcategory(option.dataset.subcategory);
  setSubcategoryMenu(false);
});
$("#subcategoryCustom").addEventListener("input", (event) => setSubcategory(event.target.value, { custom: true }));
$("#amount").addEventListener("input", updateAmountResult);
$("#entryDate").addEventListener("input", updateEntryLunarDate);
$("#entryDate").addEventListener("change", updateEntryLunarDate);
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
  amountExpressionDraft = validAmountExpression(expression, total);
  input.value = String(total);
  input.setCustomValidity("");
  $("#amountResult").hidden = false;
  $("#amountResult").textContent = `${expression} = ${formatMoney(total)}`;
  input.focus();
});
entryForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const rawAmount = $("#amount").value.trim();
  const amount = parseAmountExpression(rawAmount);
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
    amountExpression: validAmountExpression(rawAmount, amount) || validAmountExpression(amountExpressionDraft, amount),
    subcategory: expected ? "" : $("#subcategory").value.trim(),
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
  link.download = `厘清备份-${new Date().toISOString().slice(0, 10)}.json`;
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

function getWorkerVersion(worker) {
  if (!worker) return Promise.resolve(null);
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer = window.setTimeout(() => resolve(null), 1000);
    channel.port1.onmessage = (event) => {
      window.clearTimeout(timer);
      resolve(String(event.data || "") || null);
    };
    try {
      worker.postMessage("GET_VERSION", [channel.port2]);
    } catch {
      window.clearTimeout(timer);
      resolve(null);
    }
  });
}

async function showUpdateNotice(worker) {
  if (!worker || worker.state !== "installed" || !navigator.serviceWorker.controller) return;
  const [newVersion, activeVersion] = await Promise.all([
    getWorkerVersion(worker),
    getWorkerVersion(navigator.serviceWorker.controller)
  ]);
  if (!newVersion) return;
  if (newVersion === activeVersion || newVersion === meta.appliedUpdateVersion) {
    worker.postMessage("SKIP_WAITING");
    return;
  }
  pendingUpdateWorker = worker;
  pendingUpdateVersion = newVersion;
  $("#updateNotice").hidden = false;
}

function installPendingUpdate() {
  if (!pendingUpdateWorker) {
    window.location.reload();
    return;
  }
  reloadForUpdate = true;
  if (pendingUpdateVersion) {
    meta.appliedUpdateVersion = pendingUpdateVersion;
    saveMeta();
  }
  $("#installUpdate").disabled = true;
  $("#installUpdate").textContent = "更新中…";
  pendingUpdateWorker.postMessage("SKIP_WAITING");
  window.setTimeout(() => window.location.reload(), 4000);
}

function reloadFromNetwork() {
  const url = new URL(window.location.href);
  url.searchParams.set("_refresh", String(Date.now()));
  window.location.replace(url.href);
}

$("#installUpdate").addEventListener("click", installPendingUpdate);
$("#deferUpdate").addEventListener("click", () => { $("#updateNotice").hidden = true; });

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
          pendingUpdateVersion = await getWorkerVersion(readyWorker);
          installPendingUpdate();
          return;
        }
      }
    }
    window.location.reload();
  } catch (error) {
    if (navigator.onLine) {
      label.textContent = "正在重新加载…";
      reloadFromNetwork();
      return;
    }
    button.disabled = false;
    label.textContent = "刷新并检查更新";
    showToast("当前离线，无法检查更新");
  }
});

entryDialog.addEventListener("click", (event) => {
  if (event.target === entryDialog) closeEntryForm();
});

statsDialog.addEventListener("click", (event) => {
  if (event.target === statsDialog) statsDialog.close();
});

const isLocalPreview = ["localhost", "127.0.0.1"].includes(window.location.hostname)
  && new URLSearchParams(window.location.search).has("preview");

if ("serviceWorker" in navigator && isLocalPreview) {
  window.addEventListener("load", async () => {
    const previewId = new URLSearchParams(window.location.search).get("preview") || "current";
    const resetKey = `liqing-preview-reset-${previewId}`;
    const registrations = await navigator.serviceWorker.getRegistrations();
    const cacheKeys = "caches" in window ? await caches.keys() : [];
    const ledgerCaches = cacheKeys.filter((key) => key.startsWith("yueyu-"));
    await Promise.all([
      ...registrations.map((registration) => registration.unregister()),
      ...ledgerCaches.map((key) => caches.delete(key))
    ]);
    if ((navigator.serviceWorker.controller || registrations.length || ledgerCaches.length)
      && !sessionStorage.getItem(resetKey)) {
      sessionStorage.setItem(resetKey, "1");
      window.location.reload();
    }
  });
} else if ("serviceWorker" in navigator) {
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
