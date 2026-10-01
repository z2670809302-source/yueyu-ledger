export const categories = {
  salary: { label: "工资", direction: "income" },
  receivable: { label: "收账", direction: "income" },
  repayment: { label: "当月还款", direction: "expense" },
  rent: { label: "当月房租", direction: "expense" },
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
    throw new Error("这不是可识别的月余备份文件。");
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
