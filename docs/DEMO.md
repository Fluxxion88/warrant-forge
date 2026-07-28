# Three minutes

The rule for every number in this script: if it is in **bold**, it came out of a
command you can re-run in this repo. If it is marked `[NEEDS SOURCE]`, nobody has
sourced it yet and it must not be spoken aloud until somebody has.

Run before you stand up:

```bash
npx vite-node bench/discovery-demo.ts
```

---

## 0:00 — Open cold, on the finding

Do not say *ledger*, *warrant*, *provenance*, or *architecture* yet. Put the stack
of paper on the table. Then:

> "Margaret Hoyt died in January. Her daughter gave us a shoebox and a bank login.
>
> Fourteen dollars and thirty-two cents a month, to MetLife. There is no policy in
> the shoebox. No statement, no letter. Nobody in the family knows it exists. The
> only trace this policy leaves anywhere in the world is that debit — and it's still
> being paid, six months after she died."

Screen: the discovery queue. **MetLife, $14.32/month, 18 payments, strong
confidence, still charging after the date of death.**

> "The standard professional advice for finding a parent's life cover is to sit down
> with a year of bank statements and read them by hand. That's the advice because
> there's no registry to search. We do that pass in software."

**Why it survives a manual review:** a $14 line sits next to a $1,842 one. Say that.

---

## 0:35 — The second thing it found, and the thing it refused to find

> "Same pass, two more. A homeowner's policy — which matters because the estate
> still holds the house, so that one must not be cancelled. And a **$95** annual
> fee to First Republic, which means there is a safe deposit box, and its contents
> have to be inventoried before this estate can close."

Then the part most teams won't have:

> "And it found a fourth premium — Pacific Mutual — and threw it away. That policy
> is already in the file. A queue that cries wolf stops being read, so not reporting
> what you already know is as much of the job as reporting what you don't."

Screen: the suppressed row, showing `asset.life_policy.institution` as the reason.

---

## 1:10 — Now say what makes it safe

Only now introduce the mechanism, and introduce it as a constraint, not a feature.

> "None of that is a fact yet. It's a hypothesis with the debits attached. Nothing
> inferred from a payment pattern can enter the record — the record only takes a
> claim with a verbatim quote from a document we hold, and a deterministic checker
> goes and finds that sentence or the claim is quarantined.
>
> We ran the extractor live over nine documents: **41 facts proposed, 41 verified,
> zero quarantined**. When we feed it a fabricated citation, it quarantines it. The
> checker is not a model. No model is ever asked whether a model told the truth."

---

## 1:40 — The form, on screen, real

> "Because every fact carries its source, we can fill the paperwork."

Open **`out/pdf/estate-05-in-formal-probate__irs-56.pdf`** on the projector. Not a
screenshot — the file.

> "IRS Form 56. These are Alix's own sample estates. **Fourteen filled PDFs across
> five estates and four forms, 270 fields.**
>
> Nobody mapped these forms by hand. The fields are called `f1_01` through `f1_89`
> and they mean nothing. We read the words printed around every box straight off
> the page, and the model has to quote the printed label it relied on. If it invents
> a label, the mapping is refused — **258 widgets, 171 verified mappings.**"

Scroll to line 2a/2b.

> "One date box filled, not two. Which one depends on the authority basis, and
> that's a rule with a citation, not a guess."

If a technical judge is in the room, this is the moment for the honest limit:

> "Two of these mappings were wrong, and the quote check passed both — the model
> cited a label that really is printed there and routed it to the wrong field.
> A second model caught them. Verification proves the evidence is real. It does
> not prove the reasoning is right, and we don't claim it does."

Then the harder point, if there's time:

> "And of twenty possible form-estate pairs, **six were withheld**. Two because the
> licence is out of state — so the DMV form doesn't apply, and we say so and name
> the obligation instead of dropping it. One is **blocked, not skipped**: that
> decedent held a passport and no licence, so the honest answer is 'I don't know,
> and here's what I'd need.'"

---

## 2:20 — Close on the replay

Fifteen seconds. Nobody else will have this.

> "Last thing. A second appraisal comes in — the house is worth $760,000, not
> $740,000."

Click supersede. Recompute.

> "The probate route just changed. And these decision points" — point — "were
> provably not re-evaluated, because they don't depend on the value. Six months
> from now, when someone asks why the machine did that, you don't read a log. You
> re-run it."

---

## 2:50 — Stop

> "Every number on that screen has a sentence behind it. That's the whole product."

Sit down.

---

# The Anvil minute

If you get Mang-Git, use his own phrase — *paperwork to datawork* — and pitch
infrastructure, not an integration:

> "Your field detection is a convenience when a human is placing boxes on one form.
> It becomes something else when the mapping is generated and checked. We took
> **four forms the system had never seen, 258 fields**, and produced verified
> mappings plus Anvil Casts without anyone opening a template editor. That's what
> makes a few thousand forms tractable instead of a hiring plan."

**Be straight about this if asked:** the Casts are generated and validated; they
have **not** been uploaded, because we don't have an Anvil key. Say that plainly
rather than implying a live integration.

---

# The four questions

**"What happens when the model is wrong?"**
That's the system. Three layers: a claim without a locatable quote is quarantined
and cannot reach a rule; a rule with a missing input reports itself blocked and
names what it needs rather than guessing; and an action is gated on reversibility
and blast radius — requesting records executes itself, distributing money does not.

**"Is your confidence calibrated?"**
Partly, and here is exactly how far. Run `npx vite-node bench/calibration.ts`.

We mapped the same four forms twice, with two different models, from identical
evidence. They agreed on **87 of 94** fields — **92.6%**. Of the seven
disagreements, **three were confirmed errors**, so disagreement is a high-yield
review signal: roughly two in five are worth a human's time.

The number we cannot give you is the one you actually want. **Zero confirmed
errors among the 87 agreements — but nobody has audited those 87.** It is a lower
bound, not a clean bill of health, and the benchmark prints it as one.

What we can say concretely is that quote verification has a ceiling. Both
confirmed errors were mappings where the model cited a label that really is
printed on the form and routed it to the wrong field — Form 56 line 2c asks
whether the *assets* are in the court's custody, and it was wired to "does a
court case exist", so every generated form ticked Yes. The evidence check passes
and the mapping is still wrong. That is why the human gate exists, and why we
found it by rendering the PDF and reading it rather than by adding another model.

*(Do not claim we have demonstrated correlated failure — that both models make
the same mistake. An earlier run suggested it, but the two runs used different
prompts, so the comparison was confounded and we threw the result out.)*

**"Why not fine-tune a model on this?"**
You'd lose the provenance, and the provenance is the product. A fine-tuned model
gives you a better guess. It cannot hand you the sentence it relied on, and a
specialist signing a court filing needs the sentence.

**"What was hardest?"**
Jurisdiction fragmentation, and specifically that the correct answer decays. The
§ 13100 small-estate limit is $208,850 for deaths on or after 1 April 2025; almost
every model still says $184,500, because that's what the training data says. We
verified all three California thresholds against the Judicial Council's own DE-300.
The same thing bit us on our own model catalogue mid-build — a stale reference made
us "correct" a model ID that had been right all along.

---

# Do not

- Explain the architecture before showing a result
- Say "AI-powered" or "leveraging LLMs"
- Demo more than three threads
- Apologise for what isn't built
- Run over three minutes

# The denominator — read this before quoting 900 hours

We went and sourced it. Full working in [alix-claims.md](alix-claims.md).

**"900 hours" is an n=1 anecdote wearing a statistic's clothes.** It traces to
Mysoor's own estate — *"Little did I know, that simple list would consume 900
hours and over 18 months to complete"* (meetalix.com/about-us). It has since been
restated as a population average, including by her — *"which is an average amount
of time for a simple estate"* (Business Insider, 2025-12-16) — and journalists now
cite it back as "industry estimates" with no study behind it. It appears on at
least six Alix pages with **no citation anywhere**.

If you build your impact model on 900, the model dies to one question: *where does
900 come from?* Do not take that risk in front of a judge who has read the site.

**What to say instead, in order of preference:**

1. **Their published range, verbatim** — *"On average, families spend 600–900 hours
   and 12–18 months navigating it all"* (go.meetalix.com/probate). It is their own
   language, it is a range rather than a point estimate, and its low end brackets
   the only properly-surveyed figure.
2. **570 executor-hours (EstateExec, n=1,201, ±3%)** if you need a number with a
   methodology. Cite EstateExec, not Alix.
3. **Their price, if you want a number nobody can dispute: 1% of estate assets,
   $9,000 minimum.** It is the hardest published figure in the whole chain, and
   cost-per-estate is a cleaner denominator than hours anyway.

Also worth knowing: the domain is **meetalix.com**, not alixnow.com — the latter
refused connection. Series A was **$20M**, $30.65M total raised, July 2025.

# Still unsourced

- `[NEEDS SOURCE]` **Specialist hourly cost.** `bench/economics.ts` holds it as an
  explicit assumption and marks anything derived from it as tainted.
- `[NEEDS SOURCE]` **Form onboarding time today.** Ask Ian: how long does onboarding
  a new institution form take, and who does it? A number from their own PM is
  unarguable in a way our benchmark never will be. Then the line is "Ian told us X,
  we did it in Y" — and Y has to be measured, not estimated.
- **Face value of the MetLife policy.** Unknown, and we should not imply otherwise.
  The premium implies a policy; only the carrier's reply gives the amount.
