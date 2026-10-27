export const categories = {
  salary: { label: "工资", direction: "income" },
  receivable: { label: "收账", direction: "income" },
  repayment: { label: "当月还款", direction: "expense" },
  rent: { label: "住房开销", direction: "expense" },
  daily: { label: "日常开销", direction: "expense" },
  special: { label: "特殊开销", direction: "expense" }
};

export function monthKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function offsetMonthKey(selectedMonth, offset) {
  const [year, month] = selectedMonth.split("-").map(Number);
  return monthKey(new Date(year, month - 1 + offset, 1));
}

export function signedAmount(entry) {
  const direction = categories[entry.category]?.direction;
  return direction === "income" ? Number(entry.amount) : -Number(entry.amount);
}

export function parseAmountExpression(value) {
  const expression = String(value ?? "").replace(/\s+/g, "");
  const amountPattern = "(?:\\d+(?:\\.\\d{0,2})?|\\.\\d{1,2})";
  if (!new RegExp(`^${amountPattern}(?:[+-]${amountPattern})*$`).test(expression)) return NaN;
  const parts = expression.match(new RegExp(`[+-]?${amountPattern}`, "g"));
  return Math.round(parts.reduce((total, part) => total + Number(part), 0) * 100) / 100;
}

export function validAmountExpression(value, amount) {
  const expression = String(value || "").replace(/\s+/g, "");
  return /[+-]/.test(expression)
    && expression.length <= 80
    && parseAmountExpression(expression) === Number(amount)
    ? expression
    : "";
}

export function searchEntries(entries, filters = {}) {
  const keyword = String(filters.keyword || "").trim().toLocaleLowerCase("zh-CN");
  const exactAmount = filters.amount === "" || filters.amount == null ? null : Number(filters.amount);
  const minAmount = filters.minAmount === "" || filters.minAmount == null ? null : Number(filters.minAmount);
  const maxAmount = filters.maxAmount === "" || filters.maxAmount == null ? null : Number(filters.maxAmount);
  const amountInCents = (value) => Math.round(Number(value) * 100);

  return entries.filter((entry) => {
    const category = categories[entry.category];
    if (!category) return false;
    const amount = Number(entry.amount);
    const paymentMethod = entry.paymentMethod === "huabei" ? "huabei" : "cash";
    const searchable = [
      entry.note,
      entry.subcategory,
      category.label,
      entry.amountExpression,
      entry.recordType === "expected" ? "预计 计划" : "实际",
      paymentMethod === "huabei" ? "花呗" : "余额支付"
    ].join(" ").toLocaleLowerCase("zh-CN");

    if (keyword && !searchable.includes(keyword)) return false;
    if (Number.isFinite(exactAmount) && amountInCents(amount) !== amountInCents(exactAmount)) return false;
    if (Number.isFinite(minAmount) && amount < minAmount) return false;
    if (Number.isFinite(maxAmount) && amount > maxAmount) return false;
    if (filters.startDate && entry.date < filters.startDate) return false;
    if (filters.endDate && entry.date > filters.endDate) return false;
    if (filters.category && entry.category !== filters.category) return false;
    if (filters.recordType && entry.recordType !== filters.recordType) return false;
    if (filters.direction && category.direction !== filters.direction) return false;
    if (filters.paymentMethod && (entry.recordType !== "actual" || paymentMethod !== filters.paymentMethod)) return false;
    return true;
  }).sort((a, b) => b.date.localeCompare(a.date) || String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}

export function summarize(entries, selectedMonth, openingBalance = 0) {
  const summary = {
    expectedIncome: 0,
    expectedExpense: 0,
    actualIncome: 0,
    actualExpense: 0,
    huabeiSpent: 0,
    huabeiRepayment: 0,
    categories: Object.fromEntries(Object.keys(categories).map((key) => [key, { expected: 0, actual: 0, huabei: 0 }]))
  };

  entries
    .filter((entry) => entry.date.startsWith(selectedMonth) && categories[entry.category])
    .forEach((entry) => {
      const amount = Number(entry.amount) || 0;
      const recordType = entry.recordType === "expected" ? "expected" : "actual";
      const direction = categories[entry.category].direction;
      if (recordType === "actual" && direction === "expense" && entry.paymentMethod === "huabei") {
        summary.categories[entry.category].huabei += amount;
        summary.huabeiSpent += amount;
        return;
      }
      summary.categories[entry.category][recordType] += amount;
      summary[`${recordType}${direction === "income" ? "Income" : "Expense"}`] += amount;
    });

  summary.huabeiRepayment = entries
    .filter((entry) => entry.recordType === "actual"
      && entry.paymentMethod === "huabei"
      && categories[entry.category]?.direction === "expense"
      && entry.date.startsWith(offsetMonthKey(selectedMonth, -1)))
    .reduce((total, entry) => total + Number(entry.amount || 0), 0);
  summary.categories.repayment.expected += summary.huabeiRepayment;
  summary.expectedExpense += summary.huabeiRepayment;

  summary.expectedRemaining = Number(openingBalance || 0) + summary.expectedIncome - summary.expectedExpense;
  summary.actualRemaining = Number(openingBalance || 0) + summary.actualIncome - summary.actualExpense;
  summary.planDifference = summary.actualRemaining - summary.expectedRemaining;
  return summary;
}

export function monthOpeningBalance(openingBalance, openingMonth, entries, selectedMonth) {
  const actualCashEntries = entries.filter((entry) => entry.recordType === "actual"
    && !(entry.paymentMethod === "huabei" && categories[entry.category]?.direction === "expense"));
  const netBetween = (startMonth, endMonth) => actualCashEntries
    .filter((entry) => entry.date.slice(0, 7) >= startMonth && entry.date.slice(0, 7) < endMonth)
    .reduce((total, entry) => total + signedAmount(entry), 0);

  if (selectedMonth >= openingMonth) {
    return Number(openingBalance || 0) + netBetween(openingMonth, selectedMonth);
  }
  return Number(openingBalance || 0) - netBetween(selectedMonth, openingMonth);
}

export function validateBackup(value) {
  if (!value || value.version !== 1 || !Array.isArray(value.entries)) {
    throw new Error("这不是可识别的厘清备份文件。");
  }

  const entries = value.entries.map((entry) => {
    if (!entry.id || !/^\d{4}-\d{2}-\d{2}$/.test(entry.date) || !categories[entry.category]) {
      throw new Error("备份中有无法识别的账目记录。");
    }
    const amount = Number(entry.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("备份中有无效金额。");
    }
    return {
      id: String(entry.id),
      date: entry.date,
      category: entry.category,
      recordType: entry.recordType === "expected" ? "expected" : "actual",
      paymentMethod: entry.paymentMethod === "huabei" ? "huabei" : "cash",
      amount,
      amountExpression: validAmountExpression(entry.amountExpression, amount),
      subcategory: String(entry.subcategory || "").trim().slice(0, 20),
      note: String(entry.note || "").slice(0, 60),
      createdAt: entry.createdAt || new Date().toISOString()
    };
  });

  const openingBalance = Number(value.openingBalance || 0);
  if (!Number.isFinite(openingBalance)) throw new Error("备份中的起始余额无效。");
  const inferredMonth = entries
    .filter((entry) => entry.recordType === "actual")
    .map((entry) => entry.date.slice(0, 7))
    .sort()[0] || monthKey();
  const openingMonth = /^\d{4}-\d{2}$/.test(value.openingMonth) ? value.openingMonth : inferredMonth;
  return { version: 1, openingBalance, openingMonth, entries };
}
