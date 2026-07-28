// Getting a bank on the phone without paying an agent to listen to hold music.
//
// Calling an institution is the slowest step in settling an estate and the one
// least amenable to automation. The bank will not take paperwork until the
// death is verified by a person; the person cannot be reached without twenty to
// fifty minutes on hold; and the executor is usually at work.
//
// The naive automation is a voice agent that calls, waits and talks. That fails
// on three counts. It costs continuously — inference billed per second of hold
// music. It is legally fraught: California requires all-party consent to record
// (Penal Code § 632), and a synthetic voice asserting it is the executor is
// impersonation whatever the intent. And it is unnecessary, because the
// expensive part of the call is not the talking.
//
// The expensive part is the waiting, and waiting is the part a machine should
// do. So the split here is:
//
//   the system dials, navigates the menu, holds the line, and watches for a
//   human — spending almost nothing while it does
//
//   the moment a person answers, it pages the specialist and hands over a live
//   call, with the account numbers and the script already on their screen
//
//   while they talk, it sends whatever the institution asks for — the death
//   certificate, the Letters, the Form 56 — over the channel that institution
//   accepts, without the specialist leaving the call
//
// Nobody is deceived, no synthetic voice claims to be anyone, and the
// specialist's time is spent only on the minutes that need a human. See
// docs/AUTOMATION-POLICY.md § 5 for why the voice half is a deliberate refusal
// rather than an unbuilt feature.

export type CallState =
  | "queued"
  | "dialing"
  | "ivr"
  | "on_hold"
  | "human_on_line"
  | "specialist_joined"
  | "completed"
  | "abandoned"
  | "failed";

/**
 * What the line sounds like, classified from audio rather than transcribed.
 *
 * The distinction is the whole cost argument. Deciding "is this hold music or a
 * person" is a cheap audio classification running on a short rolling window.
 * Transcribing and reasoning about speech is orders of magnitude more
 * expensive, and there is nothing to reason about until somebody says hello.
 */
export type LineSignal =
  | "ringing"
  | "ivr_prompt"
  | "hold_music"
  | "hold_message"
  | "silence"
  | "human_speech"
  | "disconnected";

export interface CallCosts {
  /** Carrier cost per minute of connected call, in USD. */
  carrierPerMinute: number;
  /** Audio classification while holding, per minute. */
  classifierPerMinute: number;
  /** Speech understanding once a human is on the line, per minute. */
  transcriptionPerMinute: number;
  /** Fully-loaded specialist cost per minute. */
  specialistPerMinute: number;
}

/**
 * Cost inputs are parameters, not constants, and every one is an assumption
 * until somebody sources it. `bench/economics.ts` treats the specialist rate
 * the same way. The point of holding them here rather than inlining them is
 * that a reader can see exactly which numbers the saving depends on.
 */
export const ASSUMED_COSTS: CallCosts = {
  carrierPerMinute: 0.014,
  classifierPerMinute: 0.002,
  transcriptionPerMinute: 0.06,
  specialistPerMinute: 1.25,
};

export interface CallSegment {
  state: CallState;
  signal: LineSignal;
  seconds: number;
}

export interface CallCostBreakdown {
  totalMinutes: number;
  holdMinutes: number;
  humanMinutes: number;
  machineCostUsd: number;
  specialistCostUsd: number;
  totalCostUsd: number;
  /** Specialist minutes avoided by not having them hold. */
  specialistMinutesSaved: number;
  specialistCostSavedUsd: number;
}

/**
 * Cost a call, and say what holding it for someone was worth.
 *
 * The saving is specialist minutes, not machine minutes: the comparison is
 * against a person sitting on hold, which is what happens today. Machine cost
 * is counted in full against it rather than netted out quietly.
 */
export function costCall(
  segments: CallSegment[],
  costs: CallCosts = ASSUMED_COSTS,
): CallCostBreakdown {
  let holdSeconds = 0;
  let humanSeconds = 0;
  let machine = 0;

  for (const s of segments) {
    const minutes = s.seconds / 60;
    machine += minutes * costs.carrierPerMinute;

    if (s.state === "specialist_joined" || s.state === "human_on_line") {
      humanSeconds += s.seconds;
      machine += minutes * costs.transcriptionPerMinute;
    } else {
      // Dialing, menus and hold all cost only the cheap classifier.
      holdSeconds += s.seconds;
      machine += minutes * costs.classifierPerMinute;
    }
  }

  const specialistMinutes = humanSeconds / 60;
  const holdMinutes = holdSeconds / 60;
  const specialistCost = specialistMinutes * costs.specialistPerMinute;

  return {
    totalMinutes: round(holdMinutes + specialistMinutes),
    holdMinutes: round(holdMinutes),
    humanMinutes: round(specialistMinutes),
    machineCostUsd: round(machine, 3),
    specialistCostUsd: round(specialistCost, 2),
    totalCostUsd: round(machine + specialistCost, 2),
    specialistMinutesSaved: round(holdMinutes),
    specialistCostSavedUsd: round(holdMinutes * costs.specialistPerMinute, 2),
  };
}

// ---------------------------------------------------------------------------
// The state machine
// ---------------------------------------------------------------------------

export interface Transition {
  from: CallState;
  on: LineSignal;
  to: CallState;
  /** Anything the runtime must do as the state changes. */
  effect?: "page_specialist" | "start_transcription" | "stop_transcription" | "hang_up" | "retry";
  why: string;
}

/**
 * The transitions that matter, written out rather than buried in a switch.
 *
 * Two are load-bearing. `hold_music -> human_speech` is the one the whole
 * design exists for: the instant a person speaks, page the specialist and start
 * understanding speech. And `human_on_line` after a long hold must NOT be
 * treated as a completed call — a specialist who does not pick up in time loses
 * the queue position, which is the single most expensive failure available
 * here, so it escalates rather than waiting quietly.
 */
export const TRANSITIONS: Transition[] = [
  { from: "queued", on: "ringing", to: "dialing", why: "Call placed." },
  { from: "dialing", on: "ivr_prompt", to: "ivr", why: "Menu reached; navigate it." },
  { from: "dialing", on: "human_speech", to: "human_on_line", effect: "page_specialist", why: "Answered directly." },
  { from: "dialing", on: "disconnected", to: "failed", effect: "retry", why: "No answer." },
  { from: "ivr", on: "hold_music", to: "on_hold", why: "Queued for an agent." },
  { from: "ivr", on: "hold_message", to: "on_hold", why: "Queued for an agent." },
  { from: "ivr", on: "human_speech", to: "human_on_line", effect: "page_specialist", why: "Agent picked up from the menu." },
  {
    from: "on_hold",
    on: "human_speech",
    to: "human_on_line",
    effect: "page_specialist",
    why: "A person is on the line. This is the moment the design exists for.",
  },
  { from: "on_hold", on: "silence", to: "on_hold", why: "Silence between hold loops is not a person." },
  { from: "on_hold", on: "disconnected", to: "failed", effect: "retry", why: "Dropped while holding." },
  {
    from: "human_on_line",
    on: "human_speech",
    to: "specialist_joined",
    effect: "start_transcription",
    why: "Specialist has joined and is speaking.",
  },
  { from: "human_on_line", on: "disconnected", to: "abandoned", why: "Lost the agent before a specialist joined." },
  { from: "specialist_joined", on: "disconnected", to: "completed", effect: "stop_transcription", why: "Call ended." },
];

export function next(state: CallState, signal: LineSignal): Transition | null {
  return TRANSITIONS.find((t) => t.from === state && t.on === signal) ?? null;
}

/**
 * How long to hold before giving up and trying another channel.
 *
 * Not infinite: a queue that has not produced a human in an hour usually will
 * not, and the estate is better served by a letter that starts its own clock.
 */
export const MAX_HOLD_MINUTES = 45;

/** Silence long enough to suspect the call has quietly died. */
export const DEAD_AIR_SECONDS = 90;

export interface HoldVerdict {
  keepHolding: boolean;
  reason: string;
  escalate: boolean;
}

export function assessHold(heldSeconds: number, silenceSeconds: number): HoldVerdict {
  if (silenceSeconds >= DEAD_AIR_SECONDS) {
    return {
      keepHolding: false,
      reason: `${silenceSeconds}s of dead air — the call has probably dropped without a disconnect signal.`,
      escalate: false,
    };
  }
  if (heldSeconds / 60 >= MAX_HOLD_MINUTES) {
    return {
      keepHolding: false,
      reason: `Held ${Math.round(heldSeconds / 60)} minutes with no agent. Fall back to the written channel.`,
      escalate: true,
    };
  }
  return { keepHolding: true, reason: "Queue is still live.", escalate: false };
}

// ---------------------------------------------------------------------------
// What the institution asks for, sent while the call is still up
// ---------------------------------------------------------------------------

export type Enclosure =
  | "death_certificate"
  | "letters_testamentary"
  | "form_56"
  | "form_8821"
  | "small_estate_affidavit"
  | "trust_certification"
  | "photo_id"
  | "account_statement";

export interface DispatchRequest {
  enclosure: Enclosure;
  /** How this institution wants it. */
  channel: "email" | "fax" | "portal" | "postal";
  to: string;
  /** Reference the agent gave on the call, so it lands on the right desk. */
  reference?: string;
}

export interface DispatchResult {
  request: DispatchRequest;
  status: "sent" | "held_for_approval" | "unavailable";
  why: string;
}

/**
 * Send what was asked for, mid-call.
 *
 * This is where the forty minutes actually goes today: the agent asks for the
 * death certificate, the executor says they will post it, and the matter waits
 * a week for the next call. Sending it while the agent is still on the line
 * collapses that week into a minute — but only if we hold the document already,
 * so an enclosure we do not have is reported as a gap on the call rather than
 * promised.
 *
 * Transmission still needs a person's approval, per the automation policy.
 * The gain is not that it sends itself; it is that the specialist approves a
 * prepared packet in one click without leaving the call.
 */
export function dispatch(
  requests: DispatchRequest[],
  held: Set<Enclosure>,
  opts: { approved?: boolean } = {},
): DispatchResult[] {
  return requests.map((request) => {
    if (!held.has(request.enclosure)) {
      return {
        request,
        status: "unavailable",
        why: `The estate does not hold ${request.enclosure.replace(/_/g, " ")} yet. Do not promise it on the call — say when it is expected.`,
      };
    }
    if (!opts.approved) {
      return {
        request,
        status: "held_for_approval",
        why: "Packet prepared and waiting for the specialist to release it.",
      };
    }
    return {
      request,
      status: "sent",
      why: `Sent by ${request.channel} to ${request.to}${request.reference ? ` (ref ${request.reference})` : ""}.`,
    };
  });
}

function round(n: number, dp = 1): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

/**
 * A typical institution call, for costing. Not measured — a shape to reason
 * about until real call logs exist, and labelled as such wherever it is used.
 */
export const TYPICAL_CALL: CallSegment[] = [
  { state: "dialing", signal: "ringing", seconds: 20 },
  { state: "ivr", signal: "ivr_prompt", seconds: 100 },
  { state: "on_hold", signal: "hold_music", seconds: 34 * 60 },
  { state: "human_on_line", signal: "human_speech", seconds: 45 },
  { state: "specialist_joined", signal: "human_speech", seconds: 9 * 60 },
];
