/**
 * US telephone call-recording consent law, by state.
 *
 * PURPOSE
 * -------
 * This table backs a system that places RECORDED OUTBOUND CALLS to financial
 * institutions on behalf of an estate. Recording a call without the consent the
 * law requires is a CRIMINAL offence in many states, not a compliance nicety.
 *
 * SOURCING RULES APPLIED
 * ----------------------
 * Every `one_party` / `all_party` entry below was read from the primary text at
 * the `sourceUrl` on `retrievedAt`. `quote` is the operative sentence,
 * transcribed verbatim (internal line breaks and runs of whitespace collapsed to
 * single spaces so it fits in a string literal; no words changed, added, or
 * removed). Nothing here is from memory, and nothing is from a "50-state chart"
 * or other summary site.
 *
 * Where a primary source could not be reached, the entry is `unknown` with an
 * empty `quote` and a caveat saying what was tried. `unknown` makes the caller
 * escalate to a human. That is the correct outcome. It is strictly better than a
 * confident wrong answer, which is a crime.
 *
 * THE "TWELVE TWO-PARTY STATES" LIST IS WRONG IN ITS DETAILS. Specifically:
 *   - CA is all-party only for a "confidential communication" (§ 632(c)).
 *   - IL was struck down in 2014 and re-enacted; it now turns on "private
 *     conversation" (reasonable expectation of privacy).
 *   - OR is ONE-party for telecommunications and all-party for in-person talk.
 *   - NV's telephone statute is conjunctive ("(a) ... and (b) ..."), so
 *     one-party consent alone does not satisfy it.
 *   - CT's all-party rule lives in a CIVIL statute; the criminal one is
 *     one-party.
 *   - MA turns on "secretly"; MT turns on "hidden" and on warning.
 *   - MI's text says "all parties" but case law exempts participants.
 *   - DE has TWO live criminal provisions that disagree with each other.
 * Read the `caveat` field. It is not decoration.
 *
 * THE PRIVACY ELEMENT. Several "all-party" states do not in fact forbid all
 * unconsented recording — they forbid recording a communication that is
 * "confidential" (CA), "private" (WA, CT, IL, MI, NV § 200.650), or made with a
 * reasonable expectation of privacy. A flat all_party label OVERSTATES those
 * rules, and the overstatement is recorded in `caveat` for every entry it
 * applies to. It cuts the other way too: an institution's own "this call may be
 * recorded" greeting is an argument that the communication was never private.
 * That is a defence, not a safe harbour. Announce anyway.
 *
 * INDEPENDENT RE-VERIFICATION, 2026-07-28
 * ---------------------------------------
 * Every entry below marked `all_party`, plus DE and OR, was re-fetched from the
 * primary source by a second reviewer and the `quote` string was checked by exact
 * substring match against the page text (whitespace and quote-glyph normalised
 * only, no model in the loop). All matched. Supporting text relied on by a
 * `caveat` now lives in `supporting[]` and was checked the same way, because the
 * one material error found in this file was a fabricated quotation sitting inside
 * a `caveat`, where nothing was checking it. See the NV entry.
 */

export type ConsentRule = "one_party" | "all_party" | "unknown";

/**
 * Additional primary text a `caveat` depends on — a definition, an exemption, a
 * conflicting section, the penalty clause.
 *
 * This type exists because of a real defect. An earlier revision of this file
 * asserted, inside NV's `caveat` and in quotation marks, that NRS 200.650 makes
 * it an offence to record "any private conversation without the consent of all
 * parties thereto". That sentence is not in the Nevada Revised Statutes. The
 * actual § 200.650 says the opposite — it is satisfied by the authorisation of
 * ONE participant. The claim survived review because the tests only ever checked
 * the top-level `quote`, and prose in a `caveat` was checked by nobody.
 *
 * So: statutory language that a caveat leans on goes HERE, where the same
 * non-empty-and-cited discipline applies to it, and not in free prose.
 */
export interface SupportingText {
  /** e.g. "Cal. Penal Code § 632(c)". */
  citation: string;
  /** Verbatim, from the primary source at the entry's `sourceUrl` unless `sourceUrl` is set. */
  quote: string;
  /** Only when this text lives at a different URL from the entry's main quote. */
  sourceUrl?: string;
}

export interface ConsentLaw {
  /** Two-letter USPS code. */
  state: string;
  rule: ConsentRule;
  /** e.g. "Cal. Penal Code § 632(a)". Suffixed "(UNVERIFIED)" when rule is unknown. */
  citation: string;
  /** The primary-source URL actually fetched (or attempted, for `unknown`). */
  sourceUrl: string;
  /** Verbatim operative sentence. Empty ONLY when rule is "unknown". */
  quote: string;
  /** ISO date the primary source was read. */
  retrievedAt: string;
  caveat?: string;
  /** Verbatim primary text the `caveat` relies on. Never present on `unknown`. */
  supporting?: SupportingText[];
}

const RETRIEVED = "2026-07-28";

export const CONSENT_LAW: Record<string, ConsentLaw> = {
  AL: {
    state: "AL",
    rule: "unknown",
    citation: "Ala. Code § 13A-11-30, -31 (UNVERIFIED)",
    sourceUrl: "https://alison.legislature.state.al.us/code-of-alabama",
    quote: "",
    retrievedAt: RETRIEVED,
    caveat:
      "No primary text retrieved. Alabama publishes its Code through a JavaScript application that returned no statutory text to either the fetcher or a headless browser, and there is no static official copy. Alabama is widely reported as one-party, but that was NOT verified against primary text and is deliberately not encoded here.",
  },
  AK: {
    state: "AK",
    rule: "one_party",
    citation: "Alaska Stat. § 42.20.310(a)(1)",
    sourceUrl: "https://www.akleg.gov/basis/statutes.asp#42.20.310",
    quote:
      "A person may not (1) use an eavesdropping device to hear or record all or any part of an oral conversation without the consent of a party to the conversation",
    retrievedAt: RETRIEVED,
    caveat:
      "Prohibition runs only to recording without the consent of 'a party'. A participant on the call supplies that consent. AS 42.20.320 lists further exemptions not reviewed here.",
  },
  AZ: {
    state: "AZ",
    rule: "one_party",
    citation: "Ariz. Rev. Stat. § 13-3005(A)(1)",
    sourceUrl: "https://www.azleg.gov/ars/13/03005.htm",
    quote:
      "Intentionally intercepts a wire or electronic communication to which he is not a party, or aids, authorizes, employs, procures or permits another to so do, without the consent of either a sender or receiver thereof.",
    retrievedAt: RETRIEVED,
    caveat:
      "The offence reaches only a communication 'to which he is not a party'. A party to the call is outside the prohibition entirely.",
  },
  AR: {
    state: "AR",
    rule: "unknown",
    citation: "Ark. Code Ann. § 5-60-120 (UNVERIFIED)",
    sourceUrl: "https://www.arkleg.state.ar.us/Home/ArkansasCode",
    quote: "",
    retrievedAt: RETRIEVED,
    caveat:
      "No primary text retrieved. The Arkansas Code is published under contract by LexisNexis; the General Assembly site does not serve section text to this fetcher.",
  },
  CA: {
    state: "CA",
    rule: "all_party",
    citation: "Cal. Penal Code § 632(a)",
    sourceUrl:
      "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=PEN&sectionNum=632",
    quote:
      "A person who, intentionally and without the consent of all parties to a confidential communication, uses an electronic amplifying or recording device to eavesdrop upon or record the confidential communication, whether the communication is carried on among the parties in the presence of one another or by means of a telegraph, telephone, or other device, except a radio, shall be punished by a fine not exceeding two thousand five hundred dollars ($2,500) per violation, or imprisonment in a county jail not exceeding one year, or in the state prison, or by both that fine and imprisonment.",
    retrievedAt: RETRIEVED,
    caveat:
      "THIS IS THE 'CONFIDENTIALITY' STATE, AND THE FLAT all_party LABEL OVERSTATES IT. § 632 bites only on a 'confidential communication', defined in § 632(c) — quoted verbatim in `supporting` — which expressly EXCLUDES any circumstance in which the parties 'may reasonably expect that the communication may be overheard or recorded'. An institution that itself announces 'this call may be recorded' is a strong argument that the call was never confidential. DO NOT rely on that: it is a defence argued after charging, not a safe harbour, and § 632(a) is punishable by up to a year. Treat CA as all-party and announce. Last amended Stats. 2016, ch. 855 (AB 1671), effective 1 January 2017.",
    supporting: [
      {
        citation: "Cal. Penal Code § 632(c)",
        quote:
          "For the purposes of this section, “confidential communication” means any communication carried on in circumstances as may reasonably indicate that any party to the communication desires it to be confined to the parties thereto, but excludes a communication made in a public gathering or in any legislative, judicial, executive, or administrative proceeding open to the public, or in any other circumstance in which the parties to the communication may reasonably expect that the communication may be overheard or recorded.",
      },
    ],
  },
  CO: {
    state: "CO",
    rule: "one_party",
    citation: "Colo. Rev. Stat. § 18-9-303(1)(a)",
    sourceUrl:
      "https://leg.colorado.gov/sites/default/files/images/olls/crs2024-title-18.pdf",
    quote:
      "Any person not a sender or intended receiver of a telephone or telegraph communication commits wiretapping if he: (a) Knowingly overhears, reads, takes, copies, or records a telephone, telegraph, or electronic communication without the consent of either a sender or a receiver thereof or attempts to do so",
    retrievedAt: RETRIEVED,
    caveat:
      "Offence is limited on its face to a person 'not a sender or intended receiver'. A separate eavesdropping offence, § 18-9-304, covers non-telephonic conversation.",
  },
  CT: {
    state: "CT",
    rule: "all_party",
    citation: "Conn. Gen. Stat. § 52-570d(a)",
    sourceUrl: "https://www.cga.ct.gov/current/pub/chap_925.htm",
    quote:
      "No person shall use any instrument, device or equipment to record an oral private telephonic communication unless the use of such instrument, device or equipment (1) is preceded by consent of all parties to the communication and such prior consent either is obtained in writing or is part of, and obtained at the start of, the recording, or (2) is preceded by verbal notification which is recorded at the beginning and is part of the communication by the recording party, or (3) is accompanied by an automatic tone warning device which automatically produces a distinct signal that is repeated at intervals of approximately fifteen seconds during the communication while such instrument, device or equipment is in use.",
    retrievedAt: RETRIEVED,
    caveat:
      "COMMONLY MISREPORTED. § 52-570d is a CIVIL cause of action, not a crime: it is captioned 'Action for illegal recording of private telephonic communications' and subsection (c) gives an aggrieved person a suit for damages and fees. Connecticut's criminal statute is § 53a-189 (eavesdropping, class D felony), which turns on 'mechanical overhearing of a conversation' — defined in § 53a-187(a)(2), quoted in `supporting`, as recording 'without the consent of at least one party thereto, by a person not present thereat'. Both limbs of that definition exclude a participant who is recording their own call, so the CRIMINAL exposure in Connecticut is one-party. " +
      "The all_party label here reflects the civil statute, and § 52-570d is satisfied by any of three methods — note method (2): a recorded verbal notification at the start of the call suffices, without affirmative consent. Announcing therefore complies outright. " +
      "PRIVACY ELEMENT: § 52-570d reaches only an 'oral private telephonic communication'. A communication that is not private is outside it. As always, treat that as a defence rather than a licence. The (b) exceptions are law-enforcement, emergency, threat, common-carrier and broadcast cases and do not cover ordinary business calls. Amended P.A. 19-132 and P.A. 21-40, both to subsec. (b)(1) only; subsection (a) is unchanged since P.A. 90-305.",
    supporting: [
      {
        citation: "Conn. Gen. Stat. § 53a-187(a)(2) (criminal definition)",
        quote:
          "“Mechanical overhearing of a conversation” means the intentional overhearing or recording of a conversation or discussion, without the consent of at least one party thereto, by a person not present thereat, by means of any instrument, device or equipment.",
        sourceUrl: "https://www.cga.ct.gov/current/pub/chap_952.htm",
      },
      {
        citation: "Conn. Gen. Stat. § 53a-189(a)",
        quote:
          "A person is guilty of eavesdropping when he unlawfully engages in wiretapping or mechanical overhearing of a conversation.",
        sourceUrl: "https://www.cga.ct.gov/current/pub/chap_952.htm",
      },
    ],
  },
  DE: {
    state: "DE",
    rule: "all_party",
    citation: "Del. Code tit. 11, § 1335(a)(4); cf. § 2402(c)(4) (one-party)",
    sourceUrl: "https://delcode.delaware.gov/title11/c005/sc07/index.html",
    quote:
      "intercepts without the consent of all parties thereto a message by telephone, telegraph, letter or other means of communicating privately, including private conversation",
    retrievedAt: RETRIEVED,
    caveat:
      "RECLASSIFIED 2026-07-28, from one_party to all_party. Delaware has TWO live criminal provisions covering the recording of a telephone call and they do not agree. Both were re-fetched from delcode.delaware.gov and both are quoted verbatim (the § 2402 text is in `supporting`). " +
      "§ 2402(c)(4), the Delaware Wiretap Act, is one-party and mirrors 18 U.S.C. § 2511(2)(d). § 1335(a)(4), 'Violation of privacy', separately makes it a class A misdemeanour to intercept 'without the consent of all parties thereto a message by telephone'. § 1335 is not a dead letter — it is maintained in the current code and its section has been amended into the 2020s. " +
      "The previous revision coded Delaware one_party on the strength of § 2402. That is a defensible academic reading, but it is not one that follows from the text alone, and this table drives a system that records calls to banks. Delaware is one of the most common domiciles for banks and trust companies in the United States, so this is a high-traffic entry, not an edge case. Coded to the stricter of two verified provisions, which is also how MI is handled in this file. " +
      "PRIVACY ELEMENT: § 1335(a)(4) reaches a message sent by 'means of communicating privately'. " +
      "This is a genuine unresolved conflict rather than a sourcing failure, so it is not marked `unknown`; both texts are here and a human can weigh them. Announce.",
    supporting: [
      {
        citation: "Del. Code tit. 11, § 2402(c)(4) (the conflicting one-party provision)",
        quote:
          "For a person to intercept a wire, oral or electronic communication where the person is a party to the communication or where one of the parties to the communication has given prior consent to the interception, unless the communication is intercepted for the purpose of committing any criminal or tortious act in violation of the constitutions or laws of the United States, this State or any other state or any political subdivision of the United States or this or any other state.",
        sourceUrl: "https://delcode.delaware.gov/title11/c024/sc01/index.html",
      },
    ],
  },
  DC: {
    state: "DC",
    rule: "one_party",
    citation: "D.C. Code § 23-542(b)(3)",
    sourceUrl: "https://code.dccouncil.gov/us/dc/council/code/sections/23-542",
    quote:
      "a person not acting under color of law to intercept a wire or oral communication, where such person is a party to the communication, or where one of the parties to the communication has given prior consent to such interception, unless such communication is intercepted for the purpose of committing any criminal or tortious act in violation of the Constitution or laws of the United States, any State, or the District of Columbia, or for the purpose of committing any other injurious act.",
    retrievedAt: RETRIEVED,
  },
  FL: {
    state: "FL",
    rule: "all_party",
    citation: "Fla. Stat. § 934.03(2)(d)",
    sourceUrl:
      "http://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&URL=0900-0999/0934/Sections/0934.03.html",
    quote:
      "It is lawful under this section and ss. 934.04-934.09 for a person to intercept a wire, oral, or electronic communication when all of the parties to the communication have given prior consent to such interception.",
    retrievedAt: RETRIEVED,
    caveat:
      "The consent exception is expressly all-party, in contrast to the federal one-party exception it was modelled on. Florida applies § 934.03 to telephone calls.",
  },
  GA: {
    state: "GA",
    rule: "unknown",
    citation: "O.C.G.A. § 16-11-62, -66 (UNVERIFIED)",
    sourceUrl: "https://www.legis.ga.gov/legislation/ocga",
    quote: "",
    retrievedAt: RETRIEVED,
    caveat:
      "No primary text retrieved. The Official Code of Georgia Annotated is published under contract by LexisNexis; legis.ga.gov serves only a landing page.",
  },
  HI: {
    state: "HI",
    rule: "one_party",
    citation: "Haw. Rev. Stat. § 803-42(b)(3)(A)",
    sourceUrl:
      "https://www.capitol.hawaii.gov/hrscurrent/Vol14_Ch0701-0853/HRS0803/HRS_0803-0042.htm",
    quote:
      "It shall not be unlawful under this part for a person not acting under color of law to intercept a wire, oral, or electronic communication when the person is a party to the communication or when one of the parties to the communication has given prior consent to the interception unless the communication is intercepted for the purpose of committing any criminal or tortious act in violation of the Constitution or laws of the United States or of this State.",
    retrievedAt: RETRIEVED,
  },
  ID: {
    state: "ID",
    rule: "one_party",
    citation: "Idaho Code § 18-6702(2)(d)",
    sourceUrl:
      "https://legislature.idaho.gov/statutesrules/idstat/Title18/T18CH67/SECT18-6702/",
    quote:
      "It is lawful under this chapter for a person to intercept a wire, electronic or oral communication when one (1) of the parties to the communication has given prior consent to such interception.",
    retrievedAt: RETRIEVED,
    caveat:
      "§ 18-6702(2)(e) adds: 'It is unlawful to intercept any communication for the purpose of committing any criminal act.'",
  },
  IL: {
    state: "IL",
    rule: "all_party",
    citation: "720 ILCS 5/14-2(a)(2)",
    sourceUrl:
      "https://www.ilga.gov/documents/legislation/ilcs/documents/072000050K14-2.htm",
    quote:
      "Uses an eavesdropping device, in a surreptitious manner, for the purpose of transmitting or recording all or any part of any private conversation to which he or she is a party unless he or she does so with the consent of all other parties to the private conversation",
    retrievedAt: RETRIEVED,
    caveat:
      "AMENDED STATE — the pre-2014 version was held unconstitutional (People v. Clark; People v. Melongo) and re-enacted by P.A. 98-1142. Two limits now matter. (1) The conduct must be 'surreptitious'. (2) It must be a 'private conversation', defined in 720 ILCS 5/14-1 as 'any oral communication between 2 or more persons ... when one or more of the parties intended the communication to be of a private nature under circumstances reasonably justifying that expectation.' A separate offence, 5/14-2(a)(1), covers non-participants. Treat as all-party and announce — announcing also defeats 'surreptitious'.",
  },
  IN: {
    state: "IN",
    rule: "unknown",
    citation: "Ind. Code § 35-31.5-2-176; § 35-33.5-5-5 (UNVERIFIED)",
    sourceUrl: "https://iga.in.gov/laws/2025/ic/titles/35",
    quote: "",
    retrievedAt: RETRIEVED,
    caveat:
      "No primary text retrieved. iga.in.gov serves a single-page-application shell; neither the fetcher, a headless browser, nor the documented REST paths returned section text.",
  },
  IA: {
    state: "IA",
    rule: "one_party",
    citation: "Iowa Code § 808B.2(2)(c)",
    sourceUrl: "https://www.legis.iowa.gov/docs/code/808B.2.pdf",
    quote:
      "It is not unlawful under this chapter for a person not acting under color of law to intercept a wire, oral, or electronic communication if the person is a party to the communication or if one of the parties to the communication has given prior consent to the interception, unless the communication is intercepted for the purpose of committing a criminal or tortious act in violation of the Constitution or laws of the United States or of any state or for the purpose of committing any other injurious act.",
    retrievedAt: RETRIEVED,
  },
  KS: {
    state: "KS",
    rule: "one_party",
    citation: "Kan. Stat. Ann. § 21-6101(a)(1)",
    sourceUrl: "https://www.ksrevisor.gov/statutes/chapters/ch21/021_061_0001.html",
    quote:
      "Intercepting, without the consent of the sender or receiver, a message by telephone, telegraph, letter or other means of private communication",
    retrievedAt: RETRIEVED,
    caveat:
      "Framed as breach of privacy. Consent of either sender or receiver defeats the offence, so a participant may record.",
  },
  KY: {
    state: "KY",
    rule: "one_party",
    citation: "Ky. Rev. Stat. § 526.010",
    sourceUrl: "https://apps.legislature.ky.gov/law/statutes/statute.aspx?id=19948",
    quote:
      "\"Eavesdrop\" means to overhear, record, amplify or transmit any part of a wire or oral communication of others without the consent of at least one (1) party thereto by means of any electronic, mechanical or other device.",
    retrievedAt: RETRIEVED,
    caveat:
      "The one-party rule sits in the definition of 'eavesdrop', which is what the KRS 526 offences turn on. Note also the words 'of others'.",
  },
  LA: {
    state: "LA",
    rule: "one_party",
    citation: "La. Rev. Stat. § 15:1303(C)(4)",
    sourceUrl: "https://legis.la.gov/Legis/Law.aspx?d=78938",
    quote:
      "It shall not be unlawful under this Chapter for a person not acting under color of law to intercept a wire, electronic, or oral communication where such person is a party to the communication or where one of the parties to the communication has given prior consent to such interception, unless such communication is intercepted for the purpose of committing any criminal or tortious act in violation of the constitution or laws of the United States or of the state or for the purpose of committing any other injurious act.",
    retrievedAt: RETRIEVED,
  },
  ME: {
    state: "ME",
    rule: "one_party",
    citation: "15 M.R.S. § 709(4)",
    sourceUrl: "https://legislature.maine.gov/statutes/15/title15sec709.html",
    quote:
      "\"Intercept\" means to hear, record or aid another to hear or record the contents of any wire or oral communication through the use of any intercepting device by any person other than: A. The sender or receiver of that communication; B. A person within the range of normal unaided hearing or subnormal hearing corrected to not better than normal; or C. A person given prior authority by the sender or receiver.",
    retrievedAt: RETRIEVED,
    caveat:
      "The one-party rule is in the definition of 'intercept' (§ 709(4)), which the § 710 offence depends on. A sender or receiver is carved out of the definition entirely.",
  },
  MD: {
    state: "MD",
    rule: "all_party",
    citation: "Md. Code, Cts. & Jud. Proc. § 10-402(c)(3)",
    sourceUrl:
      "https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gcj&section=10-402&enactments=false",
    quote:
      "It is lawful under this subtitle for a person to intercept a wire, oral, or electronic communication where the person is a party to the communication and where all of the parties to the communication have given prior consent to the interception unless the communication is intercepted for the purpose of committing any criminal or tortious act in violation of the Constitution or laws of the United States or of this State.",
    retrievedAt: RETRIEVED,
    caveat:
      "Note the conjunctive: the recorder must be a party AND all parties must have consented.",
  },
  MA: {
    state: "MA",
    rule: "all_party",
    citation: "Mass. Gen. Laws ch. 272, § 99(B)(4)",
    sourceUrl:
      "https://malegislature.gov/Laws/GeneralLaws/PartIV/TitleI/Chapter272/Section99",
    quote:
      "The term \"interception\" means to secretly hear, secretly record, or aid another to secretly hear or secretly record the contents of any wire or oral communication through the use of any intercepting device by any person other than a person given prior authority by all parties to such communication",
    retrievedAt: RETRIEVED,
    caveat:
      "TURNS ON SECRECY, NOT CONSENT. The offence requires the recording be SECRET. Massachusetts courts have accordingly held that an openly disclosed recording is not an 'interception' even without affirmative consent. Announcing the recording is therefore both necessary and sufficient. Massachusetts has no business-use exception; the penalty is a felony.",
  },
  MI: {
    state: "MI",
    rule: "all_party",
    citation: "Mich. Comp. Laws § 750.539c",
    sourceUrl: "https://www.legislature.mi.gov/Laws/MCL?objectName=mcl-750-539c",
    quote:
      "Any person who is present or who is not present during a private conversation and who wilfully uses any device to eavesdrop upon the conversation without the consent of all parties thereto, or who knowingly aids, employs or procures another person to do the same in violation of this section, is guilty of a felony punishable by imprisonment in a state prison for not more than 2 years or by a fine of not more than $2,000.00, or both.",
    retrievedAt: RETRIEVED,
    caveat:
      "GENUINELY CONTESTED — encoded conservatively as all-party. The text plainly says 'without the consent of all parties' and expressly reaches a person 'who is present'. But the Michigan Court of Appeals in Sullivan v. Gray, 117 Mich. App. 476 (1982), read the defined term 'eavesdrop' (MCL 750.539a) to exclude a participant, making Michigan effectively one-party; the Michigan Supreme Court has never resolved it. Sullivan's textual hook is verified: § 750.539a(2), quoted in `supporting`, defines eavesdropping as overhearing 'the private discourse OF OTHERS' — a participant's own call is arguably not the discourse of others. Coded all-party anyway because § 750.539c's own words support it and the downside is a 2-year felony. " +
      "PRIVACY ELEMENT: the offence reaches only a 'private conversation', so a conversation that is not private is outside it. " +
      "TELEPHONE-SPECIFIC AND UNRESOLVED: the second sentence of § 750.539a(2) provides that neither that definition nor any other provision of the act 'shall modify or affect any law or regulation concerning interception, divulgence or recording of messages transmitted by communications common carriers.' A telephone call is carried by a common carrier, which is an argument that this chapter does not govern telephone recording in Michigan at all. That question is not resolved here and it cuts in an unpredictable direction. Announce. MCL current through PA 20 of 2026.",
    supporting: [
      {
        citation: "Mich. Comp. Laws § 750.539a(2)",
        quote:
          "“Eavesdrop” or “eavesdropping” means to overhear, record, amplify or transmit any part of the private discourse of others without the permission of all persons engaged in the discourse. Neither this definition or any other provision of this act shall modify or affect any law or regulation concerning interception, divulgence or recording of messages transmitted by communications common carriers.",
        sourceUrl: "https://www.legislature.mi.gov/Laws/MCL?objectName=mcl-750-539a",
      },
    ],
  },
  MN: {
    state: "MN",
    rule: "one_party",
    citation: "Minn. Stat. § 626A.02, subd. 2(d)",
    sourceUrl: "https://www.revisor.mn.gov/statutes/cite/626A.02",
    quote:
      "It is not unlawful under this chapter for a person not acting under color of law to intercept a wire, electronic, or oral communication where such person is a party to the communication or where one of the parties to the communication has given prior consent to such interception unless such communication is intercepted for the purpose of committing any criminal or tortious act in violation of the constitution or laws of the United States or of any state.",
    retrievedAt: RETRIEVED,
  },
  MS: {
    state: "MS",
    rule: "unknown",
    citation: "Miss. Code Ann. § 41-29-531(e) (UNVERIFIED)",
    sourceUrl: "https://legislature.ms.gov/",
    quote: "",
    retrievedAt: RETRIEVED,
    caveat:
      "No primary text retrieved. The Mississippi Code is published under contract by LexisNexis and the Legislature site does not serve section text.",
  },
  MO: {
    state: "MO",
    rule: "one_party",
    citation: "Mo. Rev. Stat. § 542.402.2(3)",
    sourceUrl: "https://revisor.mo.gov/main/OneSection.aspx?section=542.402",
    quote:
      "For a person not acting under law to intercept a wire communication where such person is a party to the communication or where one of the parties to the communication has given prior consent to such interception unless such communication is intercepted for the purpose of committing any criminal or tortious act.",
    retrievedAt: RETRIEVED,
  },
  MT: {
    state: "MT",
    rule: "all_party",
    citation: "Mont. Code Ann. § 45-8-213(1)(c)",
    sourceUrl:
      "https://mca.legmt.gov/bills/mca/title_0450/chapter_0080/part_0020/section_0130/0450-0080-0020-0130.html",
    quote:
      "records or causes to be recorded a conversation by use of a hidden electronic or mechanical device that reproduces a human conversation without the knowledge of all parties to the conversation",
    retrievedAt: RETRIEVED,
    caveat:
      "KNOWLEDGE, NOT CONSENT, AND ONLY IF 'HIDDEN'. The offence requires a HIDDEN device and absence of KNOWLEDGE by all parties, so it is not really an all-party consent rule at all; all_party is the conservative encoding. § 45-8-213(2)(a)(iii), quoted in `supporting`, exempts persons given warning outright and says so in terms. A clear announcement therefore takes the call outside the offence. Montana Code Annotated 2025.",
    supporting: [
      {
        citation: "Mont. Code Ann. § 45-8-213(2)(a)(iii)",
        quote:
          "persons given warning of the transcription or recording. If one person provides the warning, either party may record.",
      },
    ],
  },
  NE: {
    state: "NE",
    rule: "one_party",
    citation: "Neb. Rev. Stat. § 86-290(2)(c)",
    sourceUrl: "https://nebraskalegislature.gov/laws/statutes.php?statute=86-290",
    quote:
      "It is not unlawful under sections 86-271 to 86-295 for a person not acting under color of law to intercept a wire, electronic, or oral communication when such person is a party to the communication or when one of the parties to the communication has given prior consent to such interception unless such communication is intercepted for the purpose of committing any criminal or tortious act in violation of the Constitution or laws of the United States or of any state.",
    retrievedAt: RETRIEVED,
  },
  NV: {
    state: "NV",
    rule: "all_party",
    citation: "Nev. Rev. Stat. § 200.620(1)",
    sourceUrl: "https://www.leg.state.nv.us/NRS/NRS-200.html#NRS200Sec620",
    quote:
      "Except as otherwise provided in subsection 5 and NRS 179.410 to 179.515, inclusive, 209.419 and 704.195, it is unlawful for any person to intercept or attempt to intercept any wire communication unless: (a) The interception or attempted interception is made with the prior consent of one of the parties to the communication; and (b) An emergency situation exists and it is impractical to obtain a court order as required by NRS 179.410 to 179.515, inclusive, before the interception, in which event the interception is subject to the requirements of subsection 3.",
    retrievedAt: RETRIEVED,
    caveat:
      "THE CONJUNCTION IS THE WHOLE POINT, AND IT IS THE ONLY POINT. Lay readers see '(a) prior consent of one of the parties' and call Nevada one-party. But (a) and (b) are joined by 'and': one-party consent is lawful ONLY when an emergency also exists and the interception is ratified by a judge within 72 hours (§ 200.620(3)). An ordinary consensual business call satisfies (a) but not (b), so § 200.620 does not authorise it, and a telephone call is a 'wire communication' under § 200.610(2). Penalty is a category D felony (§ 200.690(1)(a)). " +
      "CORRECTED 2026-07-28: an earlier revision of this entry also cited NRS 200.650 as an independent all-party rule and put a sentence in quotation marks to that effect. That sentence does not exist. Section 200.650 is reproduced verbatim in `supporting` below and is a ONE-PARTY provision — it forbids surreptitiously recording 'the private discourse of others' and is satisfied 'unless authorized to do so by one of the persons engaging in the conversation'. It gives no support to an all-party reading and is not a second ground. " +
      "The all-party classification therefore rests on the conjunctive text of § 200.620 alone, which is verified, and on Lane v. Allstate Ins. Co., 114 Nev. 1176 (1998), which reads § 200.620 to require all-party consent for telephone recording. Lane was NOT retrieved from a primary source here and is cited from reputation only. Note also that § 200.620 is silent on whether a participant 'intercepts' at all — § 200.610 defines 'person', 'wire communication' and 'radio communication' but not 'intercept' — so the participant question is judge-made, not textual. Announce, and have counsel confirm Lane.",
    supporting: [
      {
        citation: "Nev. Rev. Stat. § 200.650 (the section previously misquoted here)",
        quote:
          "Except as otherwise provided in NRS 179.410 to 179.515, inclusive, and 704.195, a person shall not intrude upon the privacy of other persons by surreptitiously listening to, monitoring or recording, or attempting to listen to, monitor or record, by means of any mechanical, electronic or other listening device, any private conversation engaged in by the other persons, or disclose the existence, content, substance, purport, effect or meaning of any conversation so listened to, monitored or recorded, unless authorized to do so by one of the persons engaging in the conversation.",
      },
      {
        citation: "Nev. Rev. Stat. § 200.690(1)(a)",
        quote:
          "A person who willfully and knowingly violates NRS 200.620 to 200.650, inclusive:",
      },
    ],
  },
  NH: {
    state: "NH",
    rule: "all_party",
    citation: "N.H. Rev. Stat. Ann. § 570-A:2, I",
    sourceUrl: "https://gc.nh.gov/rsa/html/LVIII/570-A/570-A-2.htm",
    quote:
      "A person is guilty of a class B felony if, except as otherwise specifically provided in this chapter or without the consent of all parties to the communication, the person:",
    retrievedAt: RETRIEVED,
    caveat:
      "All-party consent is built into the chapeau of the offence itself rather than an exception clause. Class B felony.",
  },
  NJ: {
    state: "NJ",
    rule: "unknown",
    citation: "N.J. Stat. Ann. § 2A:156A-4(d) (UNVERIFIED)",
    sourceUrl: "https://www.njleg.state.nj.us/",
    quote: "",
    retrievedAt: RETRIEVED,
    caveat:
      "No primary text retrieved. The New Jersey Legislature's statute paths returned 404 and the State Library mirror did not serve the section. Matters because many card issuers and servicers operate from New Jersey.",
  },
  NM: {
    state: "NM",
    rule: "unknown",
    citation: "N.M. Stat. Ann. § 30-12-1(C) (UNVERIFIED)",
    sourceUrl: "https://nmonesource.com/nmos/nmsa/en/nav.do",
    quote: "",
    retrievedAt: RETRIEVED,
    caveat:
      "No primary text retrieved. NMOneSource (the Compilation Commission's official site) uses opaque item identifiers that could not be resolved to § 30-12-1 without its internal search.",
  },
  NY: {
    state: "NY",
    rule: "one_party",
    citation: "N.Y. Penal Law § 250.00(1); § 250.05",
    sourceUrl: "https://www.nysenate.gov/legislation/laws/PEN/250.00",
    quote:
      "\"Wiretapping\" means the intentional overhearing or recording of a telephonic or telegraphic communication by a person other than a sender or receiver thereof, without the consent of either the sender or receiver, by means of any instrument, device or equipment.",
    retrievedAt: RETRIEVED,
    caveat:
      "§ 250.05 makes eavesdropping a class E felony, but 'wiretapping' is defined in § 250.00(1) to exclude a sender or receiver and to require absence of consent from either. A participant may therefore record.",
  },
  NC: {
    state: "NC",
    rule: "one_party",
    citation: "N.C. Gen. Stat. § 15A-287(a)",
    sourceUrl:
      "https://www.ncleg.gov/EnactedLegislation/Statutes/HTML/BySection/Chapter_15A/GS_15A-287.html",
    quote:
      "Except as otherwise specifically provided in this Article, a person is guilty of a Class H felony if, without the consent of at least one party to the communication, the person:",
    retrievedAt: RETRIEVED,
    caveat:
      "One-party consent is written into the chapeau of the offence, so a participant's own consent defeats it.",
  },
  ND: {
    state: "ND",
    rule: "one_party",
    citation: "N.D. Cent. Code § 12.1-15-02(3)(c)",
    sourceUrl: "https://ndlegis.gov/cencode/t12-1c15.pdf",
    quote:
      "The actor was a party to the communication or one of the parties to the communication had given prior consent to such interception, and Such communication was not intercepted for the purpose of committing a crime or other unlawful harm.",
    retrievedAt: RETRIEVED,
    caveat:
      "Framed as a defence to prosecution rather than an exception to the offence, but operationally one-party.",
  },
  OH: {
    state: "OH",
    rule: "one_party",
    citation: "Ohio Rev. Code § 2933.52(B)(4)",
    sourceUrl: "https://codes.ohio.gov/ohio-revised-code/section-2933.52",
    quote:
      "A person who is not a law enforcement officer and who intercepts a wire, oral, or electronic communication, if the person is a party to the communication or if one of the parties to the communication has given the person prior consent to the interception, and if the communication is not intercepted for the purpose of committing a criminal offense or tortious act in violation of the laws or Constitution of the United States or this state or for the purpose of committing any other injurious act",
    retrievedAt: RETRIEVED,
  },
  OK: {
    state: "OK",
    rule: "one_party",
    citation: "Okla. Stat. tit. 13, § 176.4(5)",
    sourceUrl: "https://www.oscn.net/applications/oscn/DeliverDocument.asp?CiteID=65575",
    quote:
      "a person not acting under color of law to intercept a wire, oral or electronic communication when such person is a party to the communication or when one of the parties to the communication has given prior consent to such interception unless the communication is intercepted for the purpose of committing any criminal act",
    retrievedAt: RETRIEVED,
  },
  OR: {
    state: "OR",
    rule: "one_party",
    citation: "Or. Rev. Stat. § 165.540(1)(a)",
    sourceUrl: "https://www.oregonlegislature.gov/bills_laws/ors/ors165.html",
    quote:
      "Obtain or attempt to obtain the whole or any part of a telecommunication or a radio communication to which the person is not a participant, by means of any device, contrivance, machine or apparatus, whether electrical, mechanical, manual or otherwise, unless consent is given by at least one participant.",
    retrievedAt: RETRIEVED,
    caveat:
      "OREGON IS SPLIT AND IS ROUTINELY MISLISTED. Telephone calls fall under § 165.540(1)(a) — ONE-party. In-person conversation falls under § 165.540(1)(c), which requires that 'not all participants in the conversation are specifically informed that their conversation is being obtained', i.e. ALL-party notification. This entry encodes the TELEPHONE rule, which is what this system does. Do not reuse it for in-person recording.",
  },
  PA: {
    state: "PA",
    rule: "all_party",
    citation: "18 Pa. Cons. Stat. § 5704(4); offence at § 5703",
    sourceUrl: "https://www.legis.state.pa.us/WU01/LI/LI/CT/HTM/18/00.057.004.000..HTM",
    quote:
      "A person, to intercept a wire, electronic or oral communication, where all parties to the communication have given prior consent to such interception.",
    retrievedAt: RETRIEVED,
    caveat:
      "The § 5703 offence (third-degree felony) is excepted only where ALL parties consented. Pennsylvania enforces this against businesses; there is no general business-use exception.",
  },
  RI: {
    state: "RI",
    rule: "one_party",
    citation: "R.I. Gen. Laws § 11-35-21(c)(3)",
    sourceUrl: "http://webserver.rilegislature.gov/Statutes/TITLE11/11-35/11-35-21.htm",
    quote:
      "A person not acting under color of law to intercept a wire, electronic, or oral communication, where the person is a party to the communication, or one of the parties to the communication has given prior consent to the interception unless the communication is intercepted for the purpose of committing any criminal or tortious act in the violation of the constitution or laws of the United States or of any state or for the purpose of committing any other injurious act.",
    retrievedAt: RETRIEVED,
  },
  SC: {
    state: "SC",
    rule: "one_party",
    citation: "S.C. Code Ann. § 17-30-30(C)",
    sourceUrl: "https://www.scstatehouse.gov/code/t17c030.php",
    quote:
      "It is lawful under this chapter for a person not acting under color of law to intercept a wire, oral, or electronic communication where the person is a party to the communication or where one of the parties to the communication has given prior consent to the interception.",
    retrievedAt: RETRIEVED,
  },
  SD: {
    state: "SD",
    rule: "one_party",
    citation: "S.D. Codified Laws § 23A-35A-20(1)",
    sourceUrl: "https://sdlegislature.gov/Statutes/23A-35A-20",
    quote:
      "Except as provided in § 23A-35A-21, a person is guilty of a Class 5 felony who is not: (1) A sender or receiver of a communication who intentionally and by means of an eavesdropping device overhears or records a communication, or aids, authorizes, employs, procures, or permits another to overhear or record, without the consent of either a sender or receiver of the communication;",
    retrievedAt: RETRIEVED,
    caveat:
      "Awkwardly drafted, but the offence excludes a sender or receiver and requires absence of consent from either.",
  },
  TN: {
    state: "TN",
    rule: "unknown",
    citation: "Tenn. Code Ann. § 39-13-601(b)(5) (UNVERIFIED)",
    sourceUrl: "https://www.capitol.tn.gov/legislation/",
    quote: "",
    retrievedAt: RETRIEVED,
    caveat:
      "No primary text retrieved. The Tennessee Code is published under contract by LexisNexis; the General Assembly site does not serve section text.",
  },
  TX: {
    state: "TX",
    rule: "one_party",
    citation: "Tex. Penal Code § 16.02(c)(4)",
    sourceUrl: "https://statutes.capitol.texas.gov/Docs/PE/htm/PE.16.htm",
    quote:
      "a person not acting under color of law intercepts a wire, oral, or electronic communication, if: (A) the person is a party to the communication; or (B) one of the parties to the communication has given prior consent to the interception, unless the communication is intercepted for the purpose of committing an unlawful act;",
    retrievedAt: RETRIEVED,
    caveat: "Framed as an affirmative defence to prosecution under § 16.02(b).",
  },
  UT: {
    state: "UT",
    rule: "one_party",
    citation: "Utah Code § 77-23a-4(7)(b)",
    sourceUrl: "https://le.utah.gov/xcode/Title77/Chapter23A/77-23a-S4.html",
    quote:
      "A person not acting under color of law may intercept a wire, electronic, or oral communication if that person is a party to the communication or one of the parties to the communication has given prior consent to the interception, unless the communication is intercepted for the purpose of committing any criminal or tortious act in violation of state or federal laws.",
    retrievedAt: RETRIEVED,
    caveat:
      "Relevant in practice: several large credit-card banks are chartered in Utah.",
  },
  VT: {
    state: "VT",
    rule: "unknown",
    citation: "No Vermont wiretap or eavesdropping statute located (UNVERIFIED)",
    sourceUrl: "https://legislature.vermont.gov/statutes/title/13",
    quote: "",
    retrievedAt: RETRIEVED,
    caveat:
      "SPECIAL CASE — THERE MAY BE NO STATUTE TO CITE. Vermont is reported to be the only state with no general wiretap/eavesdropping statute, so the rule is said to come from 18 U.S.C. § 2511(2)(d) (one-party) overlaid with Vermont Constitution ch. I, art. 11 case law (State v. Geraw, 795 A.2d 1219 (Vt. 2002)), which bars warrantless surreptitious recording in the home. Proving a statutory negative was not possible from primary sources here, and Geraw's text was not retrieved. Escalate to a human.",
  },
  VA: {
    state: "VA",
    rule: "one_party",
    citation: "Va. Code Ann. § 19.2-62(B)(2)",
    sourceUrl: "https://law.lis.virginia.gov/vacode/title19.2/chapter6/section19.2-62/",
    quote:
      "It shall not be a criminal offense under this chapter for a person to intercept a wire, electronic or oral communication, where such person is a party to the communication or one of the parties to the communication has given prior consent to such interception.",
    retrievedAt: RETRIEVED,
  },
  WA: {
    state: "WA",
    rule: "all_party",
    citation: "Wash. Rev. Code § 9.73.030(1)(a)",
    sourceUrl: "https://app.leg.wa.gov/RCW/default.aspx?cite=9.73.030",
    quote:
      "Private communication transmitted by telephone, telegraph, radio, or other device between two or more individuals between points within or without the state by any device electronic or otherwise designed to record and/or transmit said communication regardless how such device is powered or actuated, without first obtaining the consent of all the participants in the communication",
    retrievedAt: RETRIEVED,
    caveat:
      "ANNOUNCEMENT IS EXPRESSLY SUFFICIENT AND MUST ITSELF BE RECORDED — see RCW 9.73.030(3), quoted verbatim in `supporting`. Note the statute expressly reaches calls 'between points within or without the state', so Washington claims reach over interstate calls. " +
      "PRIVACY ELEMENT: the prohibition bites only on a PRIVATE communication — the section is captioned 'Intercepting, recording, or divulging private communication' and subsection (1)(a) is limited to a 'private communication'. Washington courts treat privacy as a distinct element and assess it on the facts, including whether the parties had a reasonable expectation of privacy and whether either was notified. A call into a bank's recorded service line may well not be 'private'. Do not operate on that: it is an argument made after charging, and the all_party label is deliberately the conservative reading. " +
      "Subsection (2) separately allows one-party recording of communications of an emergency nature or conveying threats — not applicable to ordinary estate-administration calls. Last amended 2021 c 329 § 21.",
    supporting: [
      {
        citation: "Wash. Rev. Code § 9.73.030(3)",
        quote:
          "Where consent by all parties is needed pursuant to this chapter, consent shall be considered obtained whenever one party has announced to all other parties engaged in the communication or conversation, in any reasonably effective manner, that such communication or conversation is about to be recorded or transmitted: PROVIDED, That if the conversation is to be recorded that said announcement shall also be recorded.",
      },
    ],
  },
  WV: {
    state: "WV",
    rule: "one_party",
    citation: "W. Va. Code § 62-1D-3(e)",
    sourceUrl: "https://code.wvlegislature.gov/62-1D-3/",
    quote:
      "It is lawful under this article for a person to intercept a wire, oral or electronic communication where the person is a party to the communication or where one of the parties to the communication has given prior consent to the interception unless the communication is intercepted for the purpose of committing any criminal or tortious act in violation of the constitution or laws of the United States or the constitution or laws of this state",
    retrievedAt: RETRIEVED,
  },
  WI: {
    state: "WI",
    rule: "one_party",
    citation: "Wis. Stat. § 968.31(2)(c)",
    sourceUrl: "https://docs.legis.wisconsin.gov/statutes/statutes/968/31",
    quote:
      "For a person not acting under color of law to intercept a wire, electronic or oral communication where the person is a party to the communication or where one of the parties to the communication has given prior consent to the interception unless the communication is intercepted for the purpose of committing any criminal or tortious act in violation of the constitution or laws of the United States or of any state or for the purpose of committing any other injurious act.",
    retrievedAt: RETRIEVED,
  },
  WY: {
    state: "WY",
    rule: "one_party",
    citation: "Wyo. Stat. Ann. § 7-3-702(b)(iv)",
    sourceUrl: "https://wyoleg.gov/statutes/compress/title07.pdf",
    quote:
      "Any person from intercepting an oral, wire or electronic communication where the person is a party to the communication or where one (1) of the parties to the communication has given prior consent to the interception unless the communication is intercepted for the purpose of committing any criminal or tortious act;",
    retrievedAt: RETRIEVED,
  },
};

/**
 * What governs an INTERSTATE call, where caller and institution sit in states
 * with different rules?
 *
 * THE HONEST ANSWER: IT IS UNSETTLED, AND PRACTITIONERS APPLY THE STRICTER RULE.
 *
 * There is no federal choice-of-law rule for this, and no Supreme Court holding.
 * What can be said from primary text actually retrieved:
 *
 *  1. Federal law sets a ONE-PARTY FLOOR, not a ceiling. 18 U.S.C. § 2511(2)(d)
 *     (retrieved 2026-07-28 from
 *     https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title18-section2511&num=0&edition=prelim):
 *
 *       "It shall not be unlawful under this chapter for a person not acting
 *        under color of law to intercept a wire, oral, or electronic
 *        communication where such person is a party to the communication or
 *        where one of the parties to the communication has given prior consent
 *        to such interception unless such communication is intercepted for the
 *        purpose of committing any criminal or tortious act in violation of the
 *        Constitution or laws of the United States or of any State."
 *
 *     Read the words "under this chapter". The federal safe harbour disclaims
 *     only federal liability. It does not license conduct a state criminalises,
 *     and the Wiretap Act does not preempt stricter state law.
 *
 *  2. States claim reach over calls crossing their border. Washington's statute
 *     is explicit on its face: RCW 9.73.030(1)(a) covers a private communication
 *     "between points within or without the state" (quoted in the WA entry
 *     above, retrieved from primary text).
 *
 *  3. The leading case is generally said to be Kearney v. Salomon Smith Barney,
 *     Inc., 39 Cal. 4th 95 (2006), in which the California Supreme Court applied
 *     California's § 632 to calls between a Georgia (one-party) office and
 *     California clients. CAVEAT: the opinion text could NOT be retrieved from a
 *     primary source here — the California Courts opinion archive returned 404
 *     for S124739 — so Kearney is cited from reputation, NOT quoted, and should
 *     be verified by counsel before being relied on.
 *
 * Consequence for this system, and the reason `consentFor` is written the way it
 * is: because either state may assert its own law, and because being wrong is a
 * felony in several of them, the only defensible operating rule is to apply the
 * STRICTER of the two states' rules and to announce the recording at the top of
 * every call. Announcing is not merely the cautious option; it is affirmatively
 * sufficient under the text of the strictest regimes we verified (WA
 * § 9.73.030(3), CT § 52-570d(a)(2), MT § 45-8-213(2)(a)(iii)), and it defeats
 * the "secretly"/"surreptitious"/"hidden" element in MA, IL and MT.
 */
export const INTERSTATE_RULE_NOTE =
  "Unsettled. No federal choice-of-law rule governs interstate call recording; " +
  "18 U.S.C. § 2511(2)(d) disclaims only federal liability ('under this chapter') " +
  "and does not preempt stricter state law, and states such as Washington claim " +
  "reach over calls 'between points within or without the state' (RCW 9.73.030(1)(a)). " +
  "Practitioners therefore apply the stricter of the two states' rules; the case " +
  "usually cited for a strict state reaching an out-of-state caller is Kearney v. " +
  "Salomon Smith Barney, Inc., 39 Cal. 4th 95 (2006), whose text was not verifiable " +
  "from a primary source here.";

/** Higher number = stricter. `unknown` is treated as maximally strict. */
function strictness(rule: ConsentRule): number {
  switch (rule) {
    case "one_party":
      return 1;
    case "all_party":
      return 2;
    case "unknown":
      return 3;
  }
}

function normalize(code: string): string {
  return code.trim().toUpperCase();
}

export interface ConsentDecision {
  rule: ConsentRule;
  /** Human-readable explanation naming the state whose rule governed. */
  because: string;
  /** Whether the call must open with a recording announcement. */
  mustAnnounce: boolean;
  /** The two-letter codes considered, caller first. */
  states: string[];
}

/**
 * Resolve the consent rule for a call between two states by applying the
 * STRICTER of the two, and explain which state governed.
 *
 * `unknown` on either side propagates to `unknown` overall. It never falls back
 * to `one_party`. An `unknown` result means: do not place the call unattended,
 * ask a human.
 *
 * `mustAnnounce` is true for both `all_party` and `unknown` — announcing is
 * required in the former and is the only safe posture in the latter.
 */
export function consentFor(
  callerState: string,
  calleeState: string,
): ConsentDecision {
  const caller = normalize(callerState);
  const callee = normalize(calleeState);
  const states = caller === callee ? [caller] : [caller, callee];

  const callerLaw = CONSENT_LAW[caller];
  const calleeLaw = CONSENT_LAW[callee];

  const unrecognized: string[] = [];
  if (!callerLaw) unrecognized.push(caller || "(empty)");
  if (!calleeLaw) unrecognized.push(callee || "(empty)");

  if (unrecognized.length > 0) {
    return {
      rule: "unknown",
      because:
        `Not a recognized US jurisdiction code: ${unrecognized.join(", ")}. ` +
        "Cannot determine the recording-consent rule; a human must decide.",
      mustAnnounce: true,
      states,
    };
  }

  const callerRule = callerLaw.rule;
  const calleeRule = calleeLaw.rule;

  // unknown dominates everything, on either side.
  if (callerRule === "unknown" || calleeRule === "unknown") {
    const blanks = [
      callerRule === "unknown" ? callerLaw : null,
      calleeRule === "unknown" ? calleeLaw : null,
    ].filter((l): l is ConsentLaw => l !== null);
    const names = blanks.map((l) => l.state).join(" and ");
    return {
      rule: "unknown",
      because:
        `${names} could not be established from a primary source, so the rule for ` +
        `${states.join("–")} is unknown. Not defaulting to one_party. ` +
        "A human must confirm the law before a recorded call is placed. " +
        (blanks[0]?.caveat ?? ""),
      mustAnnounce: true,
      states,
    };
  }

  if (callerRule === calleeRule) {
    const shared = callerLaw;
    const both =
      caller === callee
        ? `${caller} (${shared.citation})`
        : `${caller} (${callerLaw.citation}) and ${callee} (${calleeLaw.citation})`;
    return {
      rule: callerRule,
      because:
        callerRule === "all_party"
          ? `Both sides require all-party consent: ${both}. All parties must consent; announce the recording.`
          : `Both sides are one-party consent: ${both}. The caller's own consent suffices.`,
      mustAnnounce: callerRule === "all_party",
      states,
    };
  }

  // Rules differ and neither is unknown: exactly one is all_party.
  const stricter = strictness(callerRule) > strictness(calleeRule) ? callerLaw : calleeLaw;
  const looser = stricter === callerLaw ? calleeLaw : callerLaw;
  const strictSide = stricter === callerLaw ? "caller" : "callee";

  return {
    rule: stricter.rule,
    because:
      `${looser.state} is one-party (${looser.citation}) but ${stricter.state} ` +
      `requires all-party consent (${stricter.citation}), and ${stricter.state} is the ` +
      `${strictSide}. The stricter rule governs: which state's law controls an interstate ` +
      "call is unsettled, so both are assumed to apply. All parties must consent; " +
      "announce the recording.",
    mustAnnounce: true,
    states,
  };
}
