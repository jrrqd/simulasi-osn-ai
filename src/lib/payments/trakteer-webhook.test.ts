import assert from "node:assert/strict";
import test from "node:test";
import {
  extractEmailFromPayload,
  parseAmountIdr,
  parseTrakteerTipEvent,
} from "@/lib/payments/trakteer-webhook";

const MIN = 50_000;

test("parseAmountIdr handles Rp strings and numbers", () => {
  assert.equal(parseAmountIdr("Rp 50.000"), 50_000);
  assert.equal(parseAmountIdr("Rp50.000"), 50_000);
  assert.equal(parseAmountIdr(50_000), 50_000);
  assert.equal(parseAmountIdr(""), 0);
});

test("Nyawer-style tip payload (type tip, transaction_id, numeric price)", () => {
  const event = parseTrakteerTipEvent(
    {
      type: "tip",
      transaction_id: "tx-1",
      price: 50_000,
      net_amount: 47_500,
      quantity: 1,
      supporter_message: "bayar vip justradr@gmail.com",
    },
    MIN,
  );
  assert.equal(event.isSuccess, true);
  assert.equal(event.orderId, "tx-1");
  assert.equal(event.amountIdr, 50_000);
  assert.equal(
    extractEmailFromPayload({
      supporter_message: "bayar vip justradr@gmail.com",
    }),
    "justradr@gmail.com",
  );
});

test("stream-style new-tip-success with Rp price string", () => {
  const event = parseTrakteerTipEvent(
    {
      type: "new-tip-success",
      order_id: "ord-2",
      price: "Rp 50.000",
      quantity: 1,
      supporter_message: null,
    },
    MIN,
  );
  assert.equal(event.isSuccess, true);
  assert.equal(event.orderId, "ord-2");
  assert.equal(event.amountIdr, 50_000);
});

test("unit price × quantity reaches VIP minimum", () => {
  const event = parseTrakteerTipEvent(
    {
      type: "new-tip-success",
      order_id: "ord-3",
      price: "Rp 5.000",
      quantity: 10,
      supporter_message: "user@example.com",
    },
    MIN,
  );
  assert.equal(event.amountIdr, 50_000);
});

test("nested data envelope", () => {
  const event = parseTrakteerTipEvent(
    {
      data: {
        type: "tip",
        transaction_id: "tx-nested",
        price: 50_000,
        supporter_message: "a@b.co",
      },
    },
    MIN,
  );
  assert.equal(event.isSuccess, true);
  assert.equal(event.orderId, "tx-nested");
  assert.equal(event.amountIdr, 50_000);
});

test("dashboard test with empty amount stays below VIP", () => {
  const event = parseTrakteerTipEvent(
    {
      type: "new-tip-success",
      order_id: "test-empty",
    },
    MIN,
  );
  assert.equal(event.isSuccess, true);
  assert.equal(event.amountIdr, 0);
});
