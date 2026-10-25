"""Browser smoke checks without extraction, customer data, or external AI calls.

Run with the local API running:
    python scripts/browser_smoke.py --screenshots

Only an in-memory synthetic PDF reaches the real upload API. All extraction,
record editing, generation and human review responses are browser-route mocks.
Optional screenshots contain the empty application, before any case is loaded.
Requires Python Playwright and its Chromium browser; no other third-party imports.
"""
from __future__ import annotations

import argparse
import asyncio
import copy
import json
from pathlib import Path
from urllib.parse import urlparse

from playwright.async_api import async_playwright


ROOT = Path(__file__).resolve().parents[1]


def synthetic_pdf() -> bytes:
    """A valid one-page PDF, built without PDF libraries or files on disk."""
    content = b"BT /F1 16 Tf 40 750 Td (Synthetic UI smoke test - no customer data) Tj ET"
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
        b"<< /Length " + str(len(content)).encode() + b" >>\nstream\n" + content + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    output = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for index, obj in enumerate(objects, 1):
        offsets.append(len(output))
        output.extend(f"{index} 0 obj\n".encode() + obj + b"\nendobj\n")
    start = len(output)
    output.extend(f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode())
    for offset in offsets[1:]:
        output.extend(f"{offset:010d} 00000 n \n".encode())
    output.extend(f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{start}\n%%EOF\n".encode())
    return bytes(output)


def fixture_session() -> dict:
    return {
        "id": "browserfixture01", "status": "ready", "stage": "review", "progress": 100,
        "message": "합성 UI 검증", "revision": 1,
        "documents": [{"id": "d1", "name": "synthetic-evidence.pdf", "pages": 4,
                       "evidence_pages": [2, 3, 4], "excluded_pages": [1]}],
        "records": [
            {"id": "r1", "key": "person.name", "entity": "본인", "label": "이름",
             "value": "합성 사용자", "unit": "", "period": "", "state": "unreviewed",
             "sources": [{"document_id": "d1", "page": 2,
                          "quote": "<script>window.fixtureInjected=true</script>"}], "candidates": []},
            {"id": "r2", "key": "business.revenue", "entity": "사업", "label": "과거 매출",
             "value": "1000", "unit": "KRW", "period": "2020", "state": "unreviewed",
             "sources": [], "candidates": []},
        ],
        "issues": [],
        "calculations": [{"key": "income", "label": "소득", "value": None,
                          "unit": "KRW", "status": "blocked", "formula": "확정값 대기"}],
        "artifacts": fixture_artifacts(),
        "reviews": {"caseworker": None, "lawyer": None}, "template_approved": False, "metrics": {},
    }


def fixture_artifacts() -> list[dict]:
    return [{"name": "synthetic.docx", "title": "합성 신청서", "kind": "document", "format": "DOCX",
             "url": "/api/sessions/browserfixture01/artifacts/synthetic.docx"}]


async def run(base_url: str, screenshots: bool) -> dict:
    base_url = base_url.rstrip("/")
    if urlparse(base_url).hostname not in {"localhost", "127.0.0.1"}:
        raise ValueError("Use the local application's localhost or 127.0.0.1 URL.")
    errors, images = [], []
    created_session = None
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1440, "height": 1050})
        page.on("pageerror", lambda error: errors.append(str(error)))
        try:
            response = await page.goto(base_url + "/", wait_until="networkidle")
            assert response and response.status == 200, "Application did not return HTTP 200"
            assert await page.locator("#sample-button").is_enabled(), "Frontend script did not initialize"
            assert await page.evaluate("typeof render === 'function'"), "Frontend JS asset failed to load"

            if screenshots:
                target = ROOT / ".runtime" / "screenshots"
                target.mkdir(parents=True, exist_ok=True)
                for name, viewport in [("empty-desktop.png", {"width": 1440, "height": 1050}),
                                       ("empty-mobile.png", {"width": 390, "height": 844})]:
                    await page.set_viewport_size(viewport)
                    await page.screenshot(path=str(target / name), full_page=True)
                    images.append(str(target / name))
                await page.set_viewport_size({"width": 1440, "height": 1050})

            # This is the only real mutation beyond deleting the synthetic session.
            await page.locator("#file-input").set_input_files({
                "name": "synthetic-ui.pdf", "mimeType": "application/pdf", "buffer": synthetic_pdf(),
            })
            async with page.expect_response(lambda result: urlparse(result.url).path == "/api/sessions"
                                            and result.request.method == "POST") as upload:
                await page.locator("#upload-button").click()
            uploaded = await upload.value
            assert uploaded.status == 200, "Synthetic upload failed"
            created_session = (await uploaded.json())["id"]
            await page.wait_for_function("document.getElementById('metric-documents').textContent === '1'")
            assert await page.locator("#run-button").is_visible()
            assert await page.locator("#caseworker-button").is_disabled()
            removed = await page.request.delete(f"{base_url}/api/sessions/{created_session}")
            assert removed.status == 200, "Synthetic session cleanup failed"
            created_session = None
            await page.reload(wait_until="networkidle")

            # All later API requests stay inside Playwright, including /run.
            state = fixture_session()

            async def mock_api(route):
                request = route.request
                path = urlparse(request.url).path
                result = {}
                if path == "/api/health":
                    result = {"model": "gpt-6-luna", "api_key_configured": True,
                              "n8n_url": "http://127.0.0.1:5679", "n8n_ready": True}
                elif path.endswith(("/sample", "/run")):
                    result = state
                elif "/records/" in path:
                    body = request.post_data_json
                    record = next(item for item in state["records"] if item["id"] == path.rsplit("/", 1)[1])
                    record.update(value=body["value"], state="excluded" if body.get("excluded") else "confirmed")
                    state.update(revision=state["revision"] + 1, artifacts=[], stage="edited",
                                 reviews={"caseworker": None, "lawyer": None})
                    result = state
                elif path.endswith("/generate"):
                    state.update(stage="review", artifacts=fixture_artifacts())
                    result = state
                elif path.endswith("/review"):
                    body = request.post_data_json
                    state["reviews"][body["role"]] = {"name": body["name"], "revision": state["revision"],
                                                     "at": "2026-10-26T01:00:00Z"}
                    if body["role"] == "lawyer":
                        state["status"] = "reviewed"
                    result = state
                elif request.method == "GET":
                    result = state
                await route.fulfill(status=200, json=copy.deepcopy(result))

            await page.route("**/api/**", mock_api)
            await page.locator("#sample-button").click()
            await page.locator("#record-table tr").first.wait_for()
            await page.locator("#record-table tr").first.get_by_role("button", name="검토", exact=True).click()
            assert "<script>" in await page.locator("#record-sources").inner_text()
            assert await page.evaluate("window.fixtureInjected === undefined"), "Evidence HTML was executed"
            await page.locator("#record-reason").fill("원본 대조 완료")
            await page.locator("#record-save").click()
            assert await page.locator("#artifact-list").is_hidden(), "Old artifacts survived an edit"
            await page.locator("#record-table tr").nth(1).get_by_role("button", name="검토", exact=True).click()
            await page.locator("#record-reason").fill("과거 기간 자료")
            await page.locator("#record-exclude").click()
            await page.wait_for_function("document.getElementById('metric-issues').textContent === '0'")
            await page.locator("#regenerate-button").click()
            await page.locator("#template-approved").check()
            await page.locator("#caseworker-name").fill("합성 담당자")
            await page.locator("#caseworker-button").click()
            await page.locator("#lawyer-name").fill("합성 변호사")
            await page.locator("#lawyer-button").click()
            await page.wait_for_function("document.getElementById('document-status').textContent === '검토 완료'")
            await page.set_viewport_size({"width": 390, "height": 844})
            assert await page.evaluate("document.documentElement.scrollWidth <= innerWidth"), "Mobile page overflows"
            assert not errors, errors
            return {"real_checks": ["static assets", "synthetic PDF upload", "review gate", "session deletion"],
                    "mock_checks": ["sample flow", "XSS-safe evidence", "confirm/exclude", "artifact invalidation",
                                    "regeneration", "caseworker/lawyer review", "390px layout"],
                    "javascript_errors": errors, "external_ai_calls": 0, "empty_screenshots": images}
        finally:
            if created_session:
                await page.request.delete(f"{base_url}/api/sessions/{created_session}")
            await browser.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://127.0.0.1:8010")
    parser.add_argument("--screenshots", action="store_true")
    args = parser.parse_args()
    print(json.dumps(asyncio.run(run(args.base_url, args.screenshots)), ensure_ascii=False, indent=2))
