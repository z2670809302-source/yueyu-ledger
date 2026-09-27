import test from "node:test";
import assert from "node:assert/strict";
import { currentBalance, summarize, validateBackup } from "../ledger-core.js";

const entries = [
  { id: "1", date: "2026-09-01", category: "salary", recordType: "expected", amount: 10000 },
  { id: "2", date: "2026-09-02", category: "salary", recordType: "actual", amount: 9800 },
  { id: "3", date: "2026-09-03", category: "rent", recordType: "expected", amount: 2500 },
  { id: "4", date: "2026-09-03", category: "rent", recordType: "actual", amount: 2500 },
  { id: "5", date: "2026-08-20", category: "daily", recordType: "actual", amount: 100 }
];

test("monthly summary keeps expected and actual values separate", () => {
  const result = summarize(entries, "2026-09");
  assert.equal(result.expectedIncome, 10000);
  assert.equal(result.actualIncome, 9800);
  assert.equal(result.expectedExpense, 2500);
  assert.equal(result.actualExpense, 2500);
  assert.equal(result.expectedRemaining, 7500);
  assert.equal(result.actualRemaining, 7300);
  assert.equal(result.planDifference, -200);
});

test("current balance uses actual records across all months", () => {
  assert.equal(currentBalance(3000, entries), 10200);
});

test("backup validation rejects unknown categories", () => {
  assert.throws(() => validateBackup({ version: 1, openingBalance: 0, entries: [{ id: "x", date: "2026-09-01", category: "other", amount: 1 }] }), /无法识别/);
});
