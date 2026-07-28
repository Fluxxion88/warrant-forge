import { describe, expect, it } from "vitest";
import { ANVIL_RUN, ANVIL_RUN_AT } from "./FormOnboardingPane";
import { FIELD_MAPS } from "../forms/maps";

/**
 * The Form onboarding pane transcribes the results of a live Anvil run, because
 * the run output lands in `out/` and is not committed. That makes it the one
 * place on the pane where a number can drift away from the artefact it
 * describes, so it gets a guard.
 */
describe("the Anvil run figures shown on the onboarding pane", () => {
  it("covers every form we hold a map for", () => {
    for (const m of FIELD_MAPS) {
      expect(ANVIL_RUN[m.form], `no recorded Anvil run for ${m.form}`).toBeDefined();
    }
  });

  it("never claims more bindings than the map actually has", () => {
    // The failure this catches: a map shrinks — an entry demoted by
    // revalidation, say — and the pane keeps showing the old, flattering
    // joined count. Overstating coverage on the pane whose whole argument is
    // that claims must be substantiated would be the worst possible place.
    for (const m of FIELD_MAPS) {
      const run = ANVIL_RUN[m.form];
      expect(run.of, `${m.form}: run total exceeds map entries`).toBeLessThanOrEqual(
        m.entries.length,
      );
      expect(run.joined, `${m.form}: joined exceeds total`).toBeLessThanOrEqual(run.of);
    }
  });

  it("explains any form that did not join cleanly", () => {
    // A partial join without a reason reads as an unexplained failure. DL 142
    // is partial for a real and interesting reason, and the pane has to say so.
    for (const [form, run] of Object.entries(ANVIL_RUN)) {
      if (run.joined < run.of) {
        expect(run.note, `${form} joined partially with no explanation`).toBeTruthy();
        expect(run.note!.length).toBeGreaterThan(40);
      }
    }
  });

  it("dates the run, so the figures can be judged as evidence", () => {
    expect(ANVIL_RUN_AT).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
