// The voice agent: what it may say, and what it must hand over.
//
// An earlier version of this codebase refused to build outbound voice at all,
// on two grounds that do not survive examination.
//
// "It would be impersonation" is only true of an agent that claims to *be* the
// executor. An agent that opens by saying it is an automated assistant calling
// on behalf of a named estate, under written authority from the executor, is
// what every third-party administrator already is. Disclosure is the whole
// difference, and it costs one sentence.
//
// "California requires all-party consent to record" is true and is solved the
// way every bank solves it: announce the recording. Consent obtained by
// announcement is consent. What that argument actually implies is not "do not
// call" but "know which state's rule applies before you press record" — which
// is a jurisdiction lookup, and this codebase is made of those.
//
// So the constraint that survives is narrower and more useful than a refusal:
//
//   **The agent may ask. It may not assert anything that is not already a
//   verified fact, and it may not commit the estate to anything at all.**
//
// A bank asking "what was the date of death" is answerable from the ledger with
// a warrant behind it. A bank asking "will the executor indemnify us" is not
// answerable by a machine at any confidence, and the correct response is to
// bring in the specialist — not to improvise something reasonable.
//
// Everything below is that line, drawn concretely enough to test.

import type { Fact } from "./facts";
import { ledger } from "./facts";

/** Things the agent is permitted to do with its voice. */
export type SpeechAct =
  | "disclose"          // say what it is and who it acts for
  | "announce_recording"
  | "navigate_ivr"
  | "state_verified_fact"
  | "request"           // ask the institution for something
  | "confirm_receipt"   // acknowledge what the agent just said
  | "hand_over";        // bring in the specialist

/**
 * Acts the agent must never perform, with the reason each is out of bounds.
 *
 * Written as data rather than as an absence, so that a future change has to
 * delete a line with a justification attached to it rather than simply add a
 * capability nobody notices.
 */
export const FORBIDDEN: { act: string; because: string }[] = [
  {
    act: "claim to be the executor or any natural person",
    because:
      "That is impersonation. Disclosure as an authorised agent is legitimate and " +
      "costs one sentence; asserting a human identity is not and cannot be repaired.",
  },
  {
    act: "assert a fact that is not in the verified ledger",
    because:
      "A statement to a bank about an estate is relied upon. Anything the agent " +
      "says must already carry a warrant, or it is a guess with a voice.",
  },
  {
    act: "agree to terms, fees, indemnities or deadlines",
    because: "Committing the estate is the fiduciary's act, and cannot be delegated to a script.",
  },
  {
    act: "authorise a transfer, closure or payment",
    because: "Money movement is gated on a human decision everywhere else in this system.",
  },
  {
    act: "answer a question outside the prepared scope",
    because:
      "The failure mode is a plausible improvisation on a recorded line. Handing over " +
      "costs a minute; a wrong answer costs the estate its standing with that institution.",
  },
  {
    act: "continue after the institution asks to speak to a person",
    because: "A refusal to hand over is how an automated caller becomes a complaint.",
  },
];

export interface CallAuthority {
  /** The estate the agent is acting for. */
  estateName: string;
  /** Who authorised it, and in what capacity. */
  authorisedBy: string;
  authorisedTitle: string;
  /** Date the executor signed the engagement giving this authority. */
  authorisedOn: string;
  /** Name the agent gives for itself. Never a human name. */
  agentName: string;
  /** The firm the agent belongs to. */
  onBehalfOf: string;
}

/**
 * The opening. Said before anything else, every call, without exception.
 *
 * Three jobs in one breath: say it is a machine, say whose authority it holds,
 * and obtain recording consent. The order matters — disclosure first, because a
 * recording announcement from something the other party believes is human is
 * worse than no announcement at all.
 */
export function disclosure(a: CallAuthority, mustAnnounceRecording: boolean): string {
  const parts = [
    `Hello — this is ${a.agentName}, an automated assistant calling on behalf of ${a.onBehalfOf}.`,
    `I'm calling about the Estate of ${a.estateName}, under written authority from ` +
      `${a.authorisedBy}, the ${a.authorisedTitle.toLowerCase()}, dated ${a.authorisedOn}.`,
    `I'm not a person, and I can bring ${a.authorisedBy.split(" ")[0]}'s representative on to the line at any point.`,
  ];
  if (mustAnnounceRecording) {
    parts.push(`This call is being recorded. Please let me know if you'd prefer it not to be.`);
  }
  return parts.join(" ");
}

export type HandoverReason =
  | "out_of_scope"
  | "asked_for_human"
  | "asked_to_commit"
  | "fact_not_verified"
  | "identity_challenge"
  | "recording_refused"
  | "consent_unknown"
  | "distress";

export interface Handover {
  handOver: boolean;
  reason?: HandoverReason;
  /** What the agent says as it hands over. */
  say?: string;
  /** What the specialist needs to know when they pick up. */
  brief?: string;
}

const HANDOVER_SAY: Record<HandoverReason, string> = {
  out_of_scope: "That's outside what I'm able to answer. Let me bring our specialist on — one moment.",
  asked_for_human: "Of course. Connecting you to our specialist now.",
  asked_to_commit:
    "I'm not able to agree to that on the estate's behalf. Let me bring on someone who can.",
  fact_not_verified:
    "I don't have that confirmed in our records, and I don't want to guess. Let me bring our specialist on.",
  identity_challenge:
    "That's a fair question — let me bring our specialist on to verify our authority with you.",
  recording_refused: "Understood, I'll stop the recording. Let me bring our specialist on.",
  consent_unknown:
    "Let me bring our specialist on to continue — one moment.",
  distress: "I'm sorry. Let me bring a person on to speak with you.",
};

/**
 * Should the agent stop talking?
 *
 * Deliberately eager. Every one of these is cheap to trigger and expensive to
 * miss: handing over unnecessarily costs a minute of specialist time, and not
 * handing over costs a wrong statement on a recorded line to an institution the
 * estate needs.
 */
export function shouldHandOver(input: {
  /** What the institution just said, already transcribed. */
  heard: string;
  /** Fact keys the prepared script can answer from. */
  scope: string[];
  /** Whether recording consent is settled for this call. */
  consentSettled: boolean;
  /** True once the institution has objected to the recording. */
  recordingRefused?: boolean;
}): Handover {
  const said = input.heard.toLowerCase();

  const hit = (reason: HandoverReason, brief: string): Handover => ({
    handOver: true,
    reason,
    say: HANDOVER_SAY[reason],
    brief,
  });

  if (input.recordingRefused) {
    return hit("recording_refused", "The institution objected to being recorded. Recording stopped.");
  }
  if (!input.consentSettled) {
    return hit(
      "consent_unknown",
      "Recording consent for this state pair could not be established, so the call may not be recorded and the agent must not continue unsupervised.",
    );
  }
  if (
    /speak (to|with) (a|an|someone|a real)?\s*(person|human|representative|agent|advisor)|(are|am i) (you|talking to|speaking to)( a| an)? ?(robot|bot|machine|computer|ai)|is this a (recording|robot|bot|machine)/.test(
      said,
    )
  ) {
    return hit("asked_for_human", "The institution asked for a person.");
  }

  // Checked BEFORE the commitment test. "Who authorised you to call?" contains
  // the word "authorised" and was being classified as a request to commit,
  // which produced the wrong handover line — the agent apologised for being
  // unable to agree to something, when it had been asked who it was.
  if (
    /prove|verif(y|ication) of your authority|who (authoris|authoriz)ed|what authority|power of attorney|letters testamentary\?/.test(
      said,
    )
  ) {
    return hit("identity_challenge", "The institution challenged the agent's authority to act.");
  }

  if (
    /do you (agree|accept)|can you (confirm you will|sign|commit)|will you (agree|accept|sign)|indemnif|indemnit|hold harmless|\bsign\b|waive|approve the (transfer|payment|closure)/.test(
      said,
    )
  ) {
    return hit("asked_to_commit", `Asked the estate to commit to something: "${input.heard}"`);
  }
  if (/upset|grieving|passed away recently|i'm sorry for your loss/.test(said)) {
    // Rare on an institutional line, but if the human on the other end turns
    // this into a human conversation, a machine should not be holding it.
    return hit("distress", "The call turned personal.");
  }

  return { handOver: false };
}

export interface UtteranceCheck {
  allowed: boolean;
  /** The fact backing it, when the agent is stating one. */
  backedBy?: { key: string; value: string };
  why: string;
}

/**
 * May the agent say this?
 *
 * The gate that makes the whole thing safe: a statement of fact is permitted
 * only when that exact fact is in the verified ledger. Not "the model believes
 * it", not "it was in the record we imported" — verified, with a warrant. If it
 * is not, the agent says it does not have it confirmed, which is both true and
 * the correct thing to say to a bank.
 */
export function mayState(
  key: string,
  facts: Fact[],
  scope: string[],
): UtteranceCheck {
  if (!scope.includes(key)) {
    return {
      allowed: false,
      why: `"${key}" is outside the prepared scope for this call. Hand over rather than answer it.`,
    };
  }
  const held = ledger(facts).get(key);
  if (!held) {
    return {
      allowed: false,
      why: `"${key}" is not a verified fact. The agent says it is not confirmed; it does not estimate.`,
    };
  }
  return {
    allowed: true,
    backedBy: { key, value: String(held.value) },
    why: `Verified fact, ${held.warrant.kind} warrant.`,
  };
}

export interface CallScript {
  disclosure: string;
  /** Facts the agent may state, each already verified. */
  answerable: { key: string; value: string }[];
  /** Facts the script wanted and the ledger does not hold. */
  cannotAnswer: string[];
  /** What the agent is calling to obtain. */
  asks: string[];
  /** Documents ready to send the moment they are requested. */
  canSendNow: string[];
  forbidden: typeof FORBIDDEN;
}

/**
 * Build the script before dialling.
 *
 * Everything the agent might need to say is resolved against the ledger up
 * front, so the decision "is this sayable" is made in advance rather than under
 * time pressure mid-call. Facts the ledger does not hold are listed as
 * `cannotAnswer` — the specialist sees them before the call rather than
 * discovering them when the bank asks.
 */
export function buildScript(input: {
  authority: CallAuthority;
  facts: Fact[];
  scope: string[];
  asks: string[];
  enclosuresHeld: string[];
  mustAnnounceRecording: boolean;
}): CallScript {
  const answerable: { key: string; value: string }[] = [];
  const cannotAnswer: string[] = [];

  for (const key of input.scope) {
    const check = mayState(key, input.facts, input.scope);
    if (check.allowed && check.backedBy) answerable.push(check.backedBy);
    else cannotAnswer.push(key);
  }

  return {
    disclosure: disclosure(input.authority, input.mustAnnounceRecording),
    answerable,
    cannotAnswer,
    asks: input.asks,
    canSendNow: input.enclosuresHeld,
    forbidden: FORBIDDEN,
  };
}
