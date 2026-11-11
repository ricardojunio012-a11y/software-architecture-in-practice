# Contract tests. The first one is the test that breaks the build when someone
# changes openapi/v1.yaml in a way that current clients cannot handle.
from morada.contract.compatibility import compare_contracts
from morada.contract.openapi import read_contract
from morada.contract.validate import validate_response

current = read_contract("/data/openapi/v1.yaml")
published = read_contract("/data/openapi/published/v1.yaml")


def test_the_current_contract_is_compatible_with_the_published_one():
    breaks = [c for c in compare_contracts(published, current) if not c.compatible]
    assert breaks == []


def test_renaming_a_response_field_is_incompatible():
    proposal = read_contract("/data/input/proposals/b-rename.yaml")
    breaks = [
        c.text for c in compare_contracts(published, proposal) if not c.compatible
    ]
    assert breaks == [
        "GET /v1/communities/{community}/charges 200: "
        "field removed: data[].amountCents"
    ]


def test_a_response_with_the_wrong_type_fails_the_check():
    body = {
        "data": [
            {
                "id": "CH-02",
                "unit": "102",
                "dueDate": "2026-10-10",
                "amountCents": "450.00",
                "status": "open",
            }
        ],
        "next": None,
    }
    path = "/v1/communities/C-01/charges"
    errors = validate_response(current, "GET", path, 200, "application/json", body)
    assert errors == [
        "GET /v1/communities/{community}/charges 200: "
        "$.data[0].amountCents: expected integer, got string"
    ]
