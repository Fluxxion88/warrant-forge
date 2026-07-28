import { describe, expect, it } from "vitest";
import {
  ASSUMED_COSTS,
  MAX_HOLD_MINUTES,
  TYPICAL_CALL,
  assessHold,
  costCall,
  dispatch,
  next,
  type Enclosure,
} from "./calldispatch";

describe("holding the line so a person does not have to", () => {
  it("pages the specialist the moment a human speaks", () => {
    const t = next("on_hold", "human_speech");
    expect(t?.to).toBe("human_on_line");
    expect(t?.effect).toBe("page_specialist");
  });

  it("does not mistake a gap in the hold loop for a person", () => {
    const t = next("on_hold", "silence");
    expect(t?.to).toBe("on_hold");
    expect(t?.effect).toBeUndefined();
  });

  it("only starts understanding speech once there is speech to understand", () => {
    // The cost argument in one assertion: nothing transcribes while holding.
    for (const signal of ["hold_music", "hold_message", "silence"] as const) {
      expect(next("on_hold", signal)?.effect).not.toBe("start_transcription");
    }
    expect(next("human_on_line", "human_speech")?.effect).toBe("start_transcription");
  });

  it("treats losing the agent before a specialist joins as abandoned, not done", () => {
    // Thirty minutes of queue position thrown away is the most expensive
    // failure available here, and it must not be recorded as a completed call.
    expect(next("human_on_line", "disconnected")?.to).toBe("abandoned");
    expect(next("specialist_joined", "disconnected")?.to).toBe("completed");
  });

  it("gives up on dead air rather than holding a corpse", () => {
    const v = assessHold(600, 120);
    expect(v.keepHolding).toBe(false);
    expect(v.reason).toMatch(/dead air/);
  });

  it("falls back to writing after the hold cap, and escalates", () => {
    const v = assessHold((MAX_HOLD_MINUTES + 1) * 60, 0);
    expect(v.keepHolding).toBe(false);
    expect(v.escalate).toBe(true);
    expect(v.reason).toMatch(/written channel/);
  });

  it("keeps holding while the queue is alive", () => {
    expect(assessHold(20 * 60, 10).keepHolding).toBe(true);
  });
});

describe("what the wait is worth", () => {
  it("bills hold time at the classifier rate, not the transcription rate", () => {
    const b = costCall(TYPICAL_CALL);
    // 34 minutes of hold must not cost like 34 minutes of speech understanding.
    const asIfTranscribed = b.holdMinutes * ASSUMED_COSTS.transcriptionPerMinute;
    expect(b.machineCostUsd).toBeLessThan(asIfTranscribed);
  });

  it("counts the saving in specialist minutes, against a person holding today", () => {
    const b = costCall(TYPICAL_CALL);
    expect(b.holdMinutes).toBeGreaterThan(30);
    expect(b.specialistMinutesSaved).toBe(b.holdMinutes);
    expect(b.specialistCostSavedUsd).toBeGreaterThan(b.machineCostUsd);
  });

  it("charges machine cost in full rather than netting it out quietly", () => {
    const b = costCall(TYPICAL_CALL);
    expect(b.totalCostUsd).toBeGreaterThan(b.specialistCostUsd);
  });

  it("scales with hold length, which is the only variable that matters", () => {
    const short = costCall([
      { state: "on_hold", signal: "hold_music", seconds: 5 * 60 },
      { state: "specialist_joined", signal: "human_speech", seconds: 9 * 60 },
    ]);
    const long = costCall(TYPICAL_CALL);
    expect(long.specialistCostSavedUsd).toBeGreaterThan(short.specialistCostSavedUsd * 3);
    // Talking time is the same either way, so it is not where the saving is.
    expect(Math.abs(long.humanMinutes - short.humanMinutes)).toBeLessThan(1);
  });
});

describe("sending what the institution asks for, mid-call", () => {
  const held = new Set<Enclosure>(["death_certificate", "letters_testamentary"]);

  it("never promises a document the estate does not hold", () => {
    // The failure mode this prevents: the specialist says "sending it now", the
    // bank waits, and the matter stalls a week when nothing arrives.
    const [r] = dispatch(
      [{ enclosure: "form_56", channel: "email", to: "estates@bank.example" }],
      held,
      { approved: true },
    );
    expect(r.status).toBe("unavailable");
    expect(r.why).toMatch(/Do not promise it on the call/);
  });

  it("prepares a packet but will not transmit without approval", () => {
    const [r] = dispatch(
      [{ enclosure: "death_certificate", channel: "fax", to: "+15550100" }],
      held,
    );
    expect(r.status).toBe("held_for_approval");
  });

  it("sends on the channel the institution named, with their reference", () => {
    const [r] = dispatch(
      [
        {
          enclosure: "letters_testamentary",
          channel: "email",
          to: "estates@bank.example",
          reference: "CASE-4471",
        },
      ],
      held,
      { approved: true },
    );
    expect(r.status).toBe("sent");
    expect(r.why).toMatch(/email/);
    expect(r.why).toMatch(/CASE-4471/);
  });
});
