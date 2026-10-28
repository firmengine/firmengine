import test from "node:test";
import assert from "node:assert/strict";
import { EXTRACT_INSTRUCTIONS, PROMPT_VERSION } from "../lib/extraction.ts";

test("current OCR prompt version advances with the cleaned source-reading contract", () => {
  assert.equal(PROMPT_VERSION, "luna-evidence-3.21.0");
});

test("extraction quotes stay source-bound while bbox is optional and has one frame rule", () => {
  assert.match(EXTRACT_INSTRUCTIONS, /모든 비null 필드에는 원문의 정확한 quote를 기록한다/);
  assert.match(EXTRACT_INSTRUCTIONS, /bbox는 인용한 원문 위치를 이미지에서 확인할 수 있을 때만 기록하고, 위치가 불확실하면 null이다/);
  assert.match(EXTRACT_INSTRUCTIONS, /기본은 원본 페이지 좌표이며, 별도 영역 판독에서는 현재 영역 좌표를 쓴다/);
  assert.doesNotMatch(EXTRACT_INSTRUCTIONS, /모든 비null 필드에는 정확한 원문 quote와 0~1정규화 bbox를 기록한다/);
});

test("cleanup retains uncertainty, literal units, and non-legal-authority boundaries", () => {
  assert.match(EXTRACT_INSTRUCTIONS, /원문에 단위가 없거나 확인할 수 없으면 unit은 null/);
  assert.match(EXTRACT_INSTRUCTIONS, /blank\/illegible\/not_seen의 value는 null/);
  assert.match(EXTRACT_INSTRUCTIONS, /법적 결론, 승인예측, 계산한 월평균\/청산가치\/변제액을 새 사실로 만들지 않는다/);
  assert.match(EXTRACT_INSTRUCTIONS, /근거가 없거나 모호하면 unknown 또는 null로 둔다/);
});
