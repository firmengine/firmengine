import type { CaseData } from "../lib/domain.ts";
import { buildLegalProposals } from "../lib/legal-proposals.ts";

/** Standalone read-only panel; parent route may mount it after review. */
export function LegalProposals({ data }: { data: CaseData }) {
  const result = buildLegalProposals(data);
  const money = (s: string) => {
    const [whole, fraction] = s.split(".");
    const grouped = BigInt(whole).toLocaleString("ko-KR");
    return `${grouped}${fraction ? `.${fraction}` : ""}원`;
  };
  return <section aria-labelledby="legal-proposals-heading" className="rounded-xl border p-4">
    <h2 id="legal-proposals-heading" className="text-lg font-semibold">근거 기반 법률 계산 제안</h2>
    <p className="mt-1 text-sm text-muted-foreground">기계가 확인한 사실과 초안 산식입니다. 가구원 인정, 추가생계비 인정, 법률요건 판단 또는 법원 인가를 뜻하지 않습니다.</p>
    <div className="mt-4 space-y-4">
      <article className="rounded-lg bg-muted/40 p-3">
        <h3 className="font-medium">월 생계비 기초 제안</h3>
        {result.livingCost.status === "proposal" ? <>
          <p>{result.livingCost.year}년 {result.livingCost.claimedHouseholdSize}인가구: 기준중위소득 {money(String(result.livingCost.medianIncomeWon))}의 60% = {money(result.livingCost.base60Percent.exactDecimalWon)}/월</p>
          <p className="text-sm">가구원 수의 법적 인정 및 추가생계비는 별도 검토가 필요합니다. 추가생계비 원문 입력: {result.livingCost.additionalExpenseWon ? money(result.livingCost.additionalExpenseWon) : "확인되지 않음"}</p>
        </> : <p>제안 차단: {result.livingCost.reason}</p>}
        <ul className="mt-2 list-disc pl-5 text-sm">{result.livingCost.sources.map((s) => <li key={s.url}><a className="underline" href={s.url} target="_blank" rel="noreferrer">{s.title}</a></li>)}</ul>
      </article>
      <article className="rounded-lg bg-muted/40 p-3">
        <h3 className="font-medium">서울회생법원 제424호 후보 경로</h3>
        <p>상태: {result.termCandidate.status} · 경로: {result.termCandidate.route ?? "판정 보류"}</p>
        <p className="text-sm">{result.termCandidate.reason}</p>
        <p className="mt-1 text-sm">문언: {result.termCandidate.clause}</p>
        <ul className="mt-2 list-disc pl-5 text-sm">{result.termCandidate.conditions.map((c) => <li key={c.id}>{c.id}: {c.status} — {c.detail}</li>)}</ul>
        <a className="mt-2 inline-block text-sm underline" href={result.termCandidate.sourceUrl} target="_blank" rel="noreferrer">공식 준칙 원문</a>
      </article>
      <article className="rounded-lg bg-muted/40 p-3">
        <h3 className="font-medium">이의 사건 §614(2)(3) 최소변제 비교</h3>
        <p>상태: {result.objectionMinimum.status}{result.objectionMinimum.status === "comparison" ? ` · 비교: ${result.objectionMinimum.comparison === "meets_minimum" ? "산술 기준 이상" : "산술 기준 미만"}` : ` · ${result.objectionMinimum.reason}`}</p>
        {result.objectionMinimum.status === "comparison" && <>
          <p className="text-sm">인가결정일 기준 채권 총액 현재가치 {money(result.objectionMinimum.claimTotalPresentValueWon)}과 계획 총변제 현재가치 {money(result.objectionMinimum.planPresentValueWon)}을 별도로 비교했습니다.</p>
          <p className="text-sm">기준액 = {result.objectionMinimum.minimumExact.numeratorWon}/{result.objectionMinimum.minimumExact.denominator}원; 원 단위 참고 ceiling {money(result.objectionMinimum.minimumExact.ceilingWholeWon)}원{result.objectionMinimum.minimumExact.capApplied ? " (3천만원 상한 적용)" : ""}.</p>
          <p className="text-sm">{result.objectionMinimum.minimumExact.calculationNote} 적용 사실 ID: {result.objectionMinimum.sourceFactIds.join(", ")} · 규칙판본: {result.objectionMinimum.ruleVersion}</p>
        </>}
        <p className="mt-1 text-xs text-muted-foreground">이의 사건의 추가 산술 비교일 뿐 인가 판단이 아닙니다. 이의가 없으면 이 기준을 적용하지 않습니다.</p>
        <details className="mt-2 text-sm"><summary className="cursor-pointer">공식 문언</summary><p className="mt-1">{result.objectionMinimum.sourceText}</p></details>
        <a className="mt-2 inline-block text-sm underline" href={result.objectionMinimum.sourceUrl} target="_blank" rel="noreferrer">{result.objectionMinimum.clause} — 공식 원문</a>
      </article>
      <p className="text-xs text-muted-foreground">현재 계획기간 입력: {result.currentPlanMonths ?? "미입력"}개월. 통상 36/60개월 산정 및 예외 인가는 이 제안 패널에서 자동 결정하지 않습니다.</p>
    </div>
  </section>;
}
