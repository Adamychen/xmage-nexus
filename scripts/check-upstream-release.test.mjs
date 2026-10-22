import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateReleases, parseRelease } from "./check-upstream-release.mjs";

const ours = parseRelease("1.4.62V1");

test("fork on the newest release is up to date", () => {
  const r = evaluateReleases(["1_4_9v2", "1.4.61V1", "1.4.62V1"], ours);
  assert.equal(r.latest.text, "1.4.62-V1");
  assert.equal(r.unparsedNewer, null);
});

test("a parsed release newer than the fork is reported as the latest", () => {
  const r = evaluateReleases(["1.4.62V1", "1.4.63V1"], ours);
  assert.equal(r.latest.text, "1.4.63-V1");
});

test("old legacy tags that do not parse are ignored", () => {
  const r = evaluateReleases(["1_4_9v2", "1_4_61v1", "1.4.62V1"], ours);
  assert.equal(r.unparsedNewer, null);
});

test("a future tag the regex cannot parse (xmage_1.5.0) is flagged, not dropped", () => {
  const r = evaluateReleases(["1.4.62V1", "1.5.0"], ours);
  assert.equal(r.unparsedNewer, "1.5.0");
});

test("an unparsed tag with a newer numeric prefix (1_4_63) is flagged", () => {
  const r = evaluateReleases(["1.4.62V1", "1_4_63"], ours);
  assert.equal(r.unparsedNewer, "1_4_63");
});

test("the highest unparsed prefix is the one named", () => {
  const r = evaluateReleases(["1_4_63", "1.5.0", "1_4_70v1"], ours);
  assert.equal(r.unparsedNewer, "1.5.0");
});

test("with no parsable tag at all, unparsed tags are compared against the fork", () => {
  assert.equal(evaluateReleases(["1_4_9v2"], ours).latest, null);
  assert.equal(evaluateReleases(["2_0_0"], ours).unparsedNewer, "2_0_0");
});
