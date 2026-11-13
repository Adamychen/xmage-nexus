import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { catalogEntries, printingKey, sameName, unverified } from "./check-deck-catalog.mjs";

const CATALOG = fileURLToPath(new URL("../web/src/decks/metaDeckCatalog.ts", import.meta.url));
const TABLE = fileURLToPath(new URL("./deck-catalog-printings.json", import.meta.url));

test("DCK-29: every catalogue printing names the card the server loads for that set and number", () => {
  const entries = catalogEntries(fs.readFileSync(CATALOG, "utf8"));
  const table = JSON.parse(fs.readFileSync(TABLE, "utf8"));
  assert.ok(entries.length > 100, `only ${entries.length} entries parsed out of the catalogue`);
  const bad = unverified(entries, table).map(
    (e) => `${e.setCode}#${e.cardNumber} says "${e.cardName}" but loads ${e.loaded ?? "nothing"}`,
  );
  assert.deepEqual(bad, [], "run `node scripts/check-deck-catalog.mjs` to refresh the table");
});

test("an entry whose number belongs to another card is reported", () => {
  const entries = [{ cardName: "Kor Firewalker", setCode: "WWK", cardNumber: "10" }];
  const bad = unverified(entries, { "WWK#10": "Kitesail Apprentice", "WWK#11": "Kor Firewalker" });
  assert.equal(bad.length, 1);
  assert.equal(bad[0].loaded, "Kitesail Apprentice");
});

test("an entry whose printing does not exist is reported", () => {
  const bad = unverified([{ cardName: "Shared Animosity", setCode: "E01", cardNumber: "58" }], {});
  assert.equal(bad.length, 1);
  assert.equal(bad[0].loaded, null);
});

test("names match across accents, apostrophes and the faces of a split card", () => {
  assert.ok(sameName("Andúril", "Anduril"));
  assert.ok(sameName("Sensei's Divining Top", "Sensei’s Divining Top"));
  assert.ok(sameName("Dowsing Device", "Dowsing Device // Geode Grotto"));
  assert.ok(!sameName("Rest in Peace", "Pacifism"));
});

test("printing keys fold case and spacing so the table has one row per printing", () => {
  assert.equal(printingKey(" wwk ", " 11 "), "WWK#11");
});
