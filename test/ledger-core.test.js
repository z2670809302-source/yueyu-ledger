import test from "node:test";
import assert from "node:assert/strict";
import { monthOpeningBalance, summarize, validateBackup } from "../ledger-core.js";

const entries = [
  { id: "1", date: "2026-09-01", category: "salary", recordType: "expected", amount: 10000 },
  { id: "2", date: "2026-09-02", category: "salary", recordType: "actual", amount: 9800 },
  { id: "3", date: "2026-09-03", category: "rent", recordType: "expected", amount: 2500 },
  { id: "4", date: "2026-09-03", category: "rent", recordType: "actual", amount: 2500 },
  { id: "5", date: "2026-08-20", category: "daily", recordType: "actual", amount: 100 },
  { id: "6", date: "2026-09-04", category: "daily", recordType: "actual", paymentMethod: "huabei", amount: 300 },
  { id: "7", date: "2026-10-01", category: "repayment", recordType: "expected", amount: 100 }
];

test("monthly summary keeps expected and actual values separate", () => {
  const result = summarize(entries, "2026-09", 5000);
  assert.equal(result.expectedIncome, 10000);
  assert.equal(result.actualIncome, 9800);
  assert.equal(result.expectedExpense, 2500);
  assert.equal(result.actualExpense, 2500);
  assert.equal(result.expectedRemaining, 12500);
  assert.equal(result.actualRemaining, 12300);
  assert.equal(result.planDifference, -200);
  assert.equal(result.huabeiSpent, 300);
  assert.equal(result.categories.daily.huabei, 300);
});

test("next month opening follows changes to the previous month's actual balance", () => {
  assert.equal(monthOpeningBalance(5000, "2026-09", entries, "2026-10"), 12300);
  const changedEntries = [...entries, { id: "8", date: "2026-09-20", category: "daily", recordType: "actual", amount: 200 }];
  assert.equal(monthOpeningBalance(5000, "2026-09", changedEntries, "2026-10"), 12100);
  assert.equal(monthOpeningBalance(5000, "2026-09", entries, "2026-09"), 5000);
  assert.equal(monthOpeningBalance(5000, "2026-09", entries, "2026-08"), 5100);
});

test("huabei spending becomes next month's expected repayment", () => {
  const opening = monthOpeningBalance(5000, "2026-09", entries, "2026-10");
  const result = summarize(entries, "2026-10", opening);
  assert.equal(result.huabeiRepayment, 300);
  assert.equal(result.categories.repayment.expected, 400);
  assert.equal(result.expectedExpense, 400);
  assert.equal(result.expectedRemaining, 11900);
  assert.equal(result.actualRemaining, 12300);
  assert.equal(result.planDifference, 400);
});

test("old backups infer the balance anchor from the first actual month", () => {
  const restored = validateBackup({ version: 1, openingBalance: 5000, entries });
  assert.equal(restored.openingMonth, "2026-08");
});

test("backup validation rejects unknown categories", () => {
  assert.throws(() => validateBackup({ version: 1, openingBalance: 0, entries: [{ id: "x", date: "2026-09-01", category: "other", amount: 1 }] }), /无法识别/);
});
