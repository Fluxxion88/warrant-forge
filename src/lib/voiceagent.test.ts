import { describe, expect, it, beforeEach } from "vitest";
import { _resetIds, admitAll } from "./facts";
import { buildScript, disclosure, mayState, shouldHandOver, FORBIDDEN } from "./voiceagent";
import { HOYT_DOCS } from "../fixtures/hoyt-estate";
import { RECORDED_CANDIDATES } from "../fixtures/recorded";

const AUTHORITY = {
  estateName: "Margaret Ellen Hoyt",
  authorisedBy: "Claire Hoyt",
  authorisedTitle: "Executor",
  authorisedOn: "2026-02-11",
  agentName: "Warrant Assistant",
  onBehalfOf: "Alix",
};

beforeEach(() => _resetIds());
const facts = () => admitAll(RECORDED_CANDIDATES, HOYT_DOCS, { now: 1 });

describe("disclosure", () => {
  it("says it is a machine before anything else", () => {
    const d = disclosure(AUTHORITY, true);
    expect(d).toMatch(/automated assistant/i);
    // Disclosure must precede the recording announcement: announcing a
    // recording to someone who thinks they are talking to a person is worse
    // than not announcing at all.
    expect(d.indexOf("automated assistant")).toBeLessThan(d.indexOf("being recorded"));
  });

  it("names the authority it holds and who gave it", () => {
    const d = disclosure(AUTHORITY, false);
    expect(d).toMatch(/Estate of Margaret Ellen Hoyt/);
    expect(d).toMatch(/Claire Hoyt/);
    expect(d).toMatch(/executor/i);
    expect(d).toMatch(/2026-02-11/);
  });

  it("never gives itself a human name", () => {
    const d = disclosure(AUTHORITY, true);
    // It calls itself the agent name, not the executor's name, and says so.
    expect(d).toMatch(/this is Warrant Assistant/);
    expect(d).toMatch(/I'm not a person/);
  });

  it("announces recording only where the law needs it", () => {
    expect(disclosure(AUTHORITY, true)).toMatch(/being recorded/);
    expect(disclosure(AUTHORITY, false)).not.toMatch(/being recorded/);
  });

  it("offers a person up front rather than on demand", () => {
    expect(disclosure(AUTHORITY, false)).toMatch(/bring .* representative on to the line/i);
  });
});

describe("what the agent may say", () => {
  const scope = ["decedent.full_name", "decedent.date_of_death", "asset.checking.institution"];

  it("states a fact only when the ledger has verified it", () => {
    const c = mayState("decedent.date_of_death", facts(), scope);
    expect(c.allowed).toBe(true);
    expect(c.backedBy?.value).toBeTruthy();
  });

  it("refuses a fact the ledger does not hold, rather than estimating", () => {
    const c = mayState("asset.residence.apn", facts(), [...scope, "asset.residence.apn"]);
    expect(c.allowed).toBe(false);
    expect(c.why).toMatch(/not confirmed|does not estimate/);
  });

  it("refuses anything outside the prepared scope even when it knows it", () => {
    // The agent holds this fact. It still may not volunteer it on a call whose
    // script did not anticipate the question — that is how a machine ends up
    // disclosing an asset to an institution with no need to know it.
    const c = mayState("decedent.full_name", facts(), ["asset.checking.institution"]);
    expect(c.allowed).toBe(false);
    expect(c.why).toMatch(/outside the prepared scope/);
  });
});

describe("when the agent stops talking", () => {
  const base = { scope: ["decedent.full_name"], consentSettled: true };

  it("hands over the moment a person is asked for", () => {
    for (const heard of [
      "Can I speak to a real person?",
      "Am I talking to a bot?",
      "Is this a recording?",
    ]) {
      const h = shouldHandOver({ ...base, heard });
      expect(h.handOver, heard).toBe(true);
      expect(h.reason).toBe("asked_for_human");
    }
  });

  it("never agrees to anything on the estate's behalf", () => {
    const h = shouldHandOver({
      ...base,
      heard: "Do you agree to indemnify the bank against any loss?",
    });
    expect(h.handOver).toBe(true);
    expect(h.reason).toBe("asked_to_commit");
    expect(h.say).toMatch(/not able to agree/i);
  });

  it("hands over when its authority is challenged rather than defending it", () => {
    const h = shouldHandOver({ ...base, heard: "Who authorised you to call about this account?" });
    expect(h.reason).toBe("identity_challenge");
  });

  it("stops if recording consent for the call is unsettled", () => {
    // An unknown in the consent map must stop the call, not default to
    // permitted. This is criminal law in some states.
    const h = shouldHandOver({ ...base, consentSettled: false, heard: "How can I help?" });
    expect(h.handOver).toBe(true);
    expect(h.reason).toBe("consent_unknown");
  });

  it("stops recording and hands over if the institution objects", () => {
    const h = shouldHandOver({ ...base, heard: "ok", recordingRefused: true });
    expect(h.reason).toBe("recording_refused");
    expect(h.say).toMatch(/stop the recording/i);
  });

  it("keeps going for an ordinary in-scope exchange", () => {
    expect(shouldHandOver({ ...base, heard: "What was the date of death?" }).handOver).toBe(false);
  });

  it("always tells the specialist why they are being pulled in", () => {
    const h = shouldHandOver({ ...base, heard: "Can you sign the indemnity?" });
    expect(h.brief?.length ?? 0).toBeGreaterThan(20);
  });
});

describe("the forbidden list", () => {
  it("gives a reason for every prohibition", () => {
    // Written as data so a future change has to delete a justification rather
    // than quietly add a capability.
    expect(FORBIDDEN.length).toBeGreaterThan(4);
    for (const f of FORBIDDEN) expect(f.because.length).toBeGreaterThan(40);
  });

  it("forbids claiming to be a person, and says why disclosure is different", () => {
    const impersonation = FORBIDDEN.find((f) => /claim to be the executor/.test(f.act));
    expect(impersonation).toBeDefined();
    expect(impersonation!.because).toMatch(/[Dd]isclosure/);
  });
});

describe("the script, resolved before dialling", () => {
  it("separates what it can answer from what it cannot, in advance", () => {
    const s = buildScript({
      authority: AUTHORITY,
      facts: facts(),
      scope: ["decedent.full_name", "decedent.date_of_death", "asset.residence.apn"],
      asks: ["Confirm the date-of-death balance", "Confirm any other accounts under the SSN"],
      enclosuresHeld: ["death_certificate"],
      mustAnnounceRecording: true,
    });

    expect(s.answerable.map((a) => a.key)).toContain("decedent.date_of_death");
    // The specialist learns the parcel number is missing before the call, not
    // when the bank asks for it.
    expect(s.cannotAnswer).toContain("asset.residence.apn");
    expect(s.asks).toHaveLength(2);
    expect(s.canSendNow).toContain("death_certificate");
    expect(s.forbidden).toBe(FORBIDDEN);
  });
});
