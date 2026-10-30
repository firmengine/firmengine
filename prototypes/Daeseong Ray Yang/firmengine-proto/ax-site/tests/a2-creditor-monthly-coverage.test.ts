import test from "node:test";
import assert from "node:assert/strict";
import { constantCreditorMonthlyWon, type CreditorMonthLedger } from "../lib/creditor-monthly-payment.ts";

const ready = { status: "reconciled" as const };
const row = (installment:number, debtId="d1", principalWon="10", interestWon="0", otherComponentWon="0") =>
  ({installment,debtId,principalWon,interestWon,otherComponentWon});
const ledger = (rows: CreditorMonthLedger["rows"], status: CreditorMonthLedger["status"]="complete"): CreditorMonthLedger => ({status,rows});

test("a creditor paid only in the first month has no constant two-month payment", () => {
  const partial=ledger([row(1),row(2,"d2")]);
  assert.equal(constantCreditorMonthlyWon(partial,ready,"d1",2),null);
  assert.equal(constantCreditorMonthlyWon(partial,ready,"d2",2),null);
});
test("another complete creditor must not hide a partial creditor", () => {
  const mixed=ledger([row(1,"d1"),row(1,"d2","7"),row(2,"d2","7")]);
  assert.equal(constantCreditorMonthlyWon(mixed,ready,"d1",2),null);
  assert.equal(constantCreditorMonthlyWon(mixed,ready,"d2",2),"7");
});
test("actual zero in each month differs from an absent zero row", () => {
  assert.equal(constantCreditorMonthlyWon(ledger([row(1,"d1","0"),row(2,"d1","0")]),ready,"d1",2),"0");
  assert.equal(constantCreditorMonthlyWon(ledger([row(1,"d1","0")]),ready,"d1",2),null);
});
test("variable monthly installments remain unresolved", () => {
  assert.equal(constantCreditorMonthlyWon(ledger([row(1),row(2,"d1","11")]),ready,"d1",2),null);
});
test("large exact Won components are added without floating point", () => {
  const n="900719925474099200000";
  const exact=(BigInt(n)+5n).toString();
  assert.equal(constantCreditorMonthlyWon(ledger([row(1,"d1",n,"2","3"),row(2,"d1",n,"2","3")]),ready,"d1",2),exact);
});
test("36, 48 and 60 monthly rows return constant amounts", () => {
  for(const term of [36,48,60])
    assert.equal(constantCreditorMonthlyWon(ledger(Array.from({length:term},(_,i)=>row(i+1))),ready,"d1",term),"10");
});
test("invalid money, term, installment, or blocked recon stays unresolved", () => {
  assert.equal(constantCreditorMonthlyWon(ledger([row(1)]),ready,"d1",undefined),null);
  assert.equal(constantCreditorMonthlyWon(ledger([row(0),row(1)]),ready,"d1",2),null);
  assert.equal(constantCreditorMonthlyWon(ledger([row(1,"d1","oops"),row(2)]),ready,"d1",2),null);
  assert.equal(constantCreditorMonthlyWon(ledger([row(1),row(2)],"blocked"),ready,"d1",2),null);
  assert.equal(constantCreditorMonthlyWon(ledger([row(1),row(2)]),{status:"blocked"},"d1",2),null);
});
test("provisional ledger preview preserves legacy constant amount display", () => {
  assert.equal(constantCreditorMonthlyWon(ledger([row(1),row(2)],"provisional"),ready,"d1",2),"10");
});
test("noncontiguous or extra installment blocks constant monthly output", () => {
  assert.equal(constantCreditorMonthlyWon(ledger([row(1),row(3)]),ready,"d1",2),null);
  assert.equal(constantCreditorMonthlyWon(ledger([row(1),row(2),row(3)]),ready,"d1",2),null);
});
