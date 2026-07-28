# Automation policy

What the system is allowed to do on its own, what it must hand to a person, and
what it must never do at all.

This exists because the automation here touches courts, tax authorities, banks
and grieving families. The cost of a wrong action is not a retry — it is a
rejected filing, a missed deadline, or a bereaved person told something untrue
by a machine.

The governing principle is the one already in the engine: **surface the doubt,
never resolve it by guessing.** An automated step that is uncertain hands over.
It does not pick the likelier branch and continue.

---

## 1. Retrieval — reading public sources

Used to fetch court fee schedules, local rules and forms. HTTP fetching is
blocked by many court sites (`saccourt.ca.gov` returns 403; a real browser loads
the same page), so retrieval runs through a browser.

**Rules**

- **Identify honestly.** A descriptive user agent with a contact address. No
  impersonating a consumer browser to evade a block that was aimed at us.
- **Respect `robots.txt`.** If a path is disallowed, it is not fetched. A human
  can still open it themselves; the automation does not.
- **Rate limit** to no more than one request every 3 seconds per host, and back
  off on any 429 or 503 rather than retrying immediately.
- **Never solve a CAPTCHA, and never attempt to.** A CAPTCHA is the site saying
  it does not want automated access. Hitting one ends the run and pages a
  person — it is not an obstacle to route around.
- **Read only.** Retrieval never submits a form, creates an account, logs in, or
  clicks anything that changes state on the far side.
- **Cache and re-check rather than re-crawl.** The freshness model decides when
  a source is due; nothing is fetched on a schedule tighter than that.

**Fetch only what a matter needs.** Counties are acquired lazily — when a client
in that county arrives — not by sweeping all 3,000. This is a courtesy to the
courts as much as an economy for us.

---

## 2. Escalation — when the machine stops

Any of these ends the automated run and pages a named person. The run does not
retry, does not fall back, and does not carry on with a partial result.

| Trigger | Why |
|---|---|
| CAPTCHA or bot challenge | The site is refusing automated access |
| Login or paywall | We are not authorised, or should not be, without a person deciding |
| HTTP 403/401 after one polite retry | Access is being refused deliberately |
| Page structure not recognised | The site changed; a confident parse of an unfamiliar page is how wrong figures enter the system |
| A figure that would change a filing route | Any threshold, cap or fee that moves a decision point |
| Extracted value fails its quote check | The claim is unsupported by the page it came from |
| Anything that would cost money or be filed | See §4 |

**The escalation must reach a person, not a log.** Each carries: what was being
attempted, for which matter, the URL, what was actually seen, and the specific
question a human needs to answer. An escalation that says "RPA failed" is a
defect.

**On escalation the matter continues.** The blocked step becomes a named
`unresolved` item on that estate's plan, with what it needs. The rest of the
plan proceeds — one unreachable county page must not stall a filing that does
not depend on it.

---

## 3. Correspondence — email, fax and portals

The outreach packet builder produces the letter, the enclosures list and the
channel. Sending is a separate, gated act.

**Automatic, no approval:** drafting a packet; assembling enclosures; scheduling
a follow-up; logging a reply.

**Requires a named person's approval before transmission:** every outbound
message, without exception. Institutions treat correspondence from an estate as
a legal act, and so should we.

**Never automatic:** anything asserting authority the estate does not yet hold.
No letter claims Letters have issued before they have.

---

## 4. Filing and money

- **Nothing is filed with a court or agency automatically.** The system fills
  the form, reports what it could not fill, and a person signs it. This is not a
  temporary limitation; it is the design, and it is the reason the specialist
  stays in the loop.
- **No payment is ever initiated.** Not filing fees, not referee commissions,
  not anything.
- **No distribution to beneficiaries, ever, by any automated path.** It is the
  one irreversible act in an estate and it is gated behind an explicit human
  decision with the distribution hold cleared.

---

## 5. Voice

An earlier version of this document refused outbound voice outright, on two
grounds that do not survive examination. Both are recorded here because the
reasoning is the useful part.

**"It would be impersonation."** Only of an agent that claims to *be* the
executor. An agent that opens by saying it is automated, names the estate, and
names the person whose written authority it holds is what every third-party
administrator already is. Disclosure is the entire difference and it costs one
sentence.

**"California requires all-party consent to record."** True, and solved the way
every bank solves it — announce the recording. What that objection actually
implies is not "do not call" but "know which state's rule applies before you
press record", which is a jurisdiction lookup, and this codebase is made of
those. `src/rules/call-consent.ts` holds the map, sourced per state, and an
`unknown` there stops the call rather than defaulting to permitted.

**The constraint that survives is narrower and more useful than a refusal:**

> The agent may ask. It may not assert anything that is not already a verified
> fact, and it may not commit the estate to anything at all.

So the agent may: disclose itself, announce recording where required, navigate a
menu, hold, state facts that are in the verified ledger and within the prepared
scope, ask for what the estate needs, and hand over.

It may never: claim to be a person, state anything the ledger has not verified,
agree to terms or indemnities, authorise a movement of money, answer outside the
prepared scope, or continue after being asked for a human. `FORBIDDEN` in
`src/lib/voiceagent.ts` carries each prohibition with its reason, as data, so
removing one means deleting a justification rather than quietly adding a
capability.

Handover is deliberately eager. Triggering it unnecessarily costs a minute of
specialist time; failing to trigger it costs a wrong statement on a recorded
line to an institution the estate depends on.

See `src/lib/calldispatch.ts` for the hold-detection design — the machine does
the waiting, which is where the time actually goes.

---

## 6. Data handling

- Estate records contain SSNs, account numbers and addresses. They are never
  sent to a third-party service that is not already part of the matter.
- Model calls receive only the fields a task needs. Untrusted document text is
  fenced before it reaches a prompt.
- Credentials live in the OS config directory, held by Rust. The frontend
  receives `has_key: bool` and never a key.
- Nothing from a document is executed, followed as an instruction, or treated as
  a command. A document that says "ignore your instructions" is quoted to the
  reviewer, not obeyed.

---

## 7. What must stay true as this grows

Two invariants, stated so they can be checked rather than assumed:

1. **No automated action is irreversible without a human decision recorded
   against it.** The approval gate keys on reversibility and blast radius, and
   that gate is not to be widened for convenience.
2. **Every automated conclusion carries the evidence for it.** If a step cannot
   say where its answer came from, it does not get to contribute to a filing.
