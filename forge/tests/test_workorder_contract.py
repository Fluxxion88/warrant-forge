"""The seam with Warrant, asserted from Forge's side. docs/01-CONTRACT.md.

Replaces the mock's test. The mock is gone: Warrant now writes these files, from
its own rule pack, via `npx vite-node tools/emit-workorders.ts`. What Forge owes
the merge is the other half of the check — that whatever arrives in
artifacts/workorders/ is something Forge can actually consume.

These tests read the committed artifacts rather than generating them, because
the artifact on disk is what fill.py, bench.py and the review UI will open.
"""

from __future__ import annotations

import json

import pytest

from forge.estatepath import EstateData
from forge.registry import ESTATES_DIR, WORKORDERS_DIR, estate_path, load_work_order

ESTATE_IDS = sorted(p.stem for p in ESTATES_DIR.glob("*.json"))
FORM_IDS = {"irs-f56", "irs-ss4", "irs-f8821", "ca-dmv-dl142"}


def test_every_estate_has_a_work_order():
    have = {p.stem for p in WORKORDERS_DIR.glob("*.json")}
    assert set(ESTATE_IDS) <= have, f"missing work orders for {set(ESTATE_IDS) - have}"


@pytest.mark.parametrize("estate_id", ESTATE_IDS)
def test_work_order_shape(estate_id):
    order = load_work_order(estate_id)
    assert order["estateId"] == estate_id
    assert set(order) >= {
        "estateId",
        "estatePath",
        "jurisdiction",
        "route",
        "generatedAt",
        "forms",
    }
    # Every form in the registry appears, including the skipped ones — a missing
    # entry renders as unknown rather than as "not needed".
    assert {f["formId"] for f in order["forms"]} == FORM_IDS
    for f in order["forms"]:
        assert set(f) == {
            "formId",
            "applicable",
            "reason",
            "priority",
            "blastRadius",
            "reversibility",
        }
        if f["applicable"]:
            assert f["reason"] is None
            assert f["blastRadius"] in {"low", "medium", "high"}
            assert f["reversibility"] in {"reversible", "irreversible"}
        else:
            assert f["reason"], "an inapplicable form must say why"
            assert f["priority"] is None


@pytest.mark.parametrize("estate_id", ESTATE_IDS)
def test_estate_path_resolves_from_the_repository_root(estate_id):
    """fill.py opens this path. It must not depend on the process cwd."""
    order = load_work_order(estate_id)
    estate = EstateData.load(order["estatePath"])
    assert estate.estate_id == estate_id


@pytest.mark.parametrize("estate_id", ESTATE_IDS)
def test_the_decision_is_attributed(estate_id):
    """An unattributed work order is not reviewable. Warrant signs its output."""
    order = load_work_order(estate_id)
    assert order.get("generatedBy"), "no generatedBy — who decided this?"
    assert order.get("generatedAt")


def test_domain_denominators_hold_across_the_sample_set():
    """docs/00-DOMAIN.md §4: DL 142 applies to 2 of 5, SS-4 is live for 2 of 5."""
    applicable = {form_id: 0 for form_id in FORM_IDS}
    for estate_id in ESTATE_IDS:
        for f in load_work_order(estate_id)["forms"]:
            applicable[f["formId"]] += int(f["applicable"])
    assert applicable["ca-dmv-dl142"] == 2
    assert applicable["irs-ss4"] == 2
    assert applicable["irs-f56"] == 5
    assert applicable["irs-f8821"] == 5


def test_jurisdiction_and_route_come_from_the_estate():
    order = load_work_order("estate-05-in-formal-probate")
    assert order["jurisdiction"] == {"state": "IN", "county": "Marion"}
    assert order["route"] == "FORMAL_PROBATE"


def test_resolver_distinguishes_absent_from_empty():
    estate = EstateData.load(estate_path("estate-05-in-formal-probate"))

    present = estate.resolve("decedent.name.full")
    assert present.present and present.value

    absent = estate.resolve("decedent.nothing.here")
    assert not absent.present
    assert absent.value is None


def test_skip_reasons_are_sentences_a_human_reads_aloud():
    """docs/01: the reason is rendered verbatim on the FORMS NEEDED tab."""
    for estate_id in ESTATE_IDS:
        for f in load_work_order(estate_id)["forms"]:
            if not f["applicable"]:
                assert len(f["reason"]) > 30, (estate_id, f["formId"], f["reason"])
                assert json.dumps(f["reason"]).count("null") == 0
