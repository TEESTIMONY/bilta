import { test } from "node:test";
import assert from "node:assert/strict";
import { isWebOfferActive, webPackagePrice } from "../src/data/webDesign.js";

test("Business offer starts on 5 November 2026 in WAT", () => {
  assert.equal(webPackagePrice("business", "2026-11-04T22:59:59Z"), 400000);
  assert.equal(webPackagePrice("business", "2026-11-04T23:00:00Z"), 220000);
});

test("Offer includes all of 31 January 2027 in WAT, then returns to regular price", () => {
  assert.equal(isWebOfferActive("2027-01-31T23:59:59.999+01:00"), true);
  assert.equal(
    webPackagePrice("business", "2027-01-31T23:59:59.999+01:00"),
    220000,
  );
  assert.equal(isWebOfferActive("2027-02-01T00:00:00+01:00"), false);
  assert.equal(webPackagePrice("business", "2027-01-31T23:00:00Z"), 400000);
});

test("Only the Business package is discounted; custom briefs never receive an automatic price", () => {
  const duringOffer = "2026-12-15T12:00:00+01:00";
  assert.equal(webPackagePrice("starter", duringOffer), 200000);
  assert.equal(webPackagePrice("commerce", duringOffer), 600000);
  assert.equal(webPackagePrice("custom", duringOffer), null);
  assert.equal(webPackagePrice("unknown", duringOffer), null);
});

test("Invalid dates cannot activate the promotion", () => {
  assert.equal(isWebOfferActive("invalid"), false);
});
