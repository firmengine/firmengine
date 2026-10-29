import { useEffect, useRef, useState } from "react";
import { createFinancialDemo, deriveFinancialDemo, type CaseRecord, type DemoAssetRow, type DemoDebtRow, type DemoIncomeRow, type FinancialDemo, type LabAction, type Role } from "./model";

export interface FinancialWorkbenchProps { current: CaseRecord; role: Role; dispatch: (action: LabAction) => void }
const won = (value: number | null) => value === null ? "확인 필요" : `${value.toLocaleString("ko-KR")}원`;
const storageKey = (id: string) => `firmengine-frontend-financial-demo-v1:${id}`;
const money = (value: string) => value.trim() === "" ? null : Number(value);
const inputStyle = { minWidth: 105, width: "100%", padding: "8px", border: "1px solid #dfe4e8", borderRadius: 6 };
function readData(current: CaseRecord): FinancialDemo {
  try {
    const raw = localStorage.getItem(storageKey(current.id));
    if (raw) { const value = JSON.parse(raw); if (Array.isArray(value.incomes) && Array.isArray(value.debts) && Array.isArray(value.assets) && value.schema === 1) return value.data ?? value; }
  } catch { /* An unavailable local store keeps the current in-memory demo usable. */ }
  return createFinancialDemo(current);
}
function FinancialEditor({ current, role, dispatch }: FinancialWorkbenchProps) {
  const [data, setData] = useState<FinancialDemo>(() => readData(current));
  const [tab, setTab] = useState<"income" | "debts" | "assets" | "budget">("income");
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState("");
  const saved = useRef(JSON.stringify(data));
  const [, setSavedVersion] = useState(0);
  const editable = role === "staff" || role === "lawyer";
  const result = deriveFinancialDemo(data), dirty = saved.current !== JSON.stringify(data);
  useEffect(() => { setNotice(""); }, [current.id]);
  function update(next: FinancialDemo) { if (editable) { setData(next); setNotice("미저장 변경이 있습니다. 이유를 적고 저장하세요."); } }
  function save() {
    if (!editable || !reason.trim()) { setNotice("담당자·변호사 역할에서 변경 이유를 입력하세요."); return false; }
    let persisted = true;
    try { localStorage.setItem(storageKey(current.id), JSON.stringify({ ...data, schema: 1 })); }
    catch { persisted = false; }
    dispatch({ type: "EXTERNAL_CHANGE", caseId: current.id, reason: `재무 작업: ${reason.trim()}` });
    if (persisted) saved.current = JSON.stringify(data); setSavedVersion(value => value + 1);
    setNotice(persisted ? "재무 작업을 저장했습니다. 이전 초안의 모의 검토가 초기화됩니다." : "브라우저 저장소를 사용할 수 없습니다. 현재 화면에만 변경을 유지하며 이전 모의 검토는 초기화됩니다."); return true;
  }
  function applyTotals() {
    if (role !== "staff") { setNotice("핵심 금액 반영은 담당자 역할에서 진행하세요."); return; }
    if (!result.ready || !reason.trim()) { setNotice("모든 행의 금액·기간·출처·검토와 중복을 확인하고 이유를 입력하세요."); return; }
    if (dirty && !save()) return;
    for (const [key, value] of [["income", result.incomeGross], ["expenses", result.incomeExpenses], ["livingCost", data.livingCost], ["debt", result.debtTotal], ["assets", result.assetValue]] as const) dispatch({ type: "EDIT_FIELD", caseId: current.id, key, value, reason: `재무 합계 반영: ${reason.trim()}` });
    dispatch({ type: "SET_MONTHS", caseId: current.id, months: data.months });
    setNotice("수입·경비·생계비·채무·재산 합계를 후보값으로 반영했습니다. 원문 대조 화면에서 다시 확인하세요. 비용·우선배분 예시는 이 재무표에 별도로 보존합니다.");
  }
  const income = (id: string, patch: Partial<DemoIncomeRow>) => update({ ...data, incomes: data.incomes.map(row => row.id === id ? { ...row, ...patch, ...("confirmed" in patch ? {} : { confirmed: false }) } : row) });
  const debt = (id: string, patch: Partial<DemoDebtRow>) => update({ ...data, debts: data.debts.map(row => row.id === id ? { ...row, ...patch, ...("confirmed" in patch ? {} : { confirmed: false }) } : row) });
  const asset = (id: string, patch: Partial<DemoAssetRow>) => update({ ...data, assets: data.assets.map(row => row.id === id ? { ...row, ...patch, ...("confirmed" in patch ? {} : { confirmed: false }) } : row) });
  const nextId = (prefix: string) => `${prefix}-${Math.max(0, ...[...data.incomes, ...data.debts, ...data.assets].map(row => Number(row.id.split("-").at(-1)) || 0)) + 1}`;
  const numeric = (label: string, value: number | null, onChange: (value: number | null) => void) => <input aria-label={label} style={inputStyle} type="number" min="0" step="1" value={value ?? ""} disabled={!editable} onChange={event => onChange(money(event.target.value))} placeholder="미확인" />;
  const text = (label: string, value: string, onChange: (value: string) => void, type = "text") => <input aria-label={label} style={inputStyle} type={type} value={value} disabled={!editable} onChange={event => onChange(event.target.value)} />;
  const remove = (label: string, action: () => void) => <button className="button secondary" aria-label={`${label} 삭제`} disabled={!editable} onClick={action}>삭제</button>;
  const review = (label: string, checked: boolean, onChange: (value: boolean) => void) => <label style={{ whiteSpace: "nowrap" }}><input type="checkbox" aria-label={`${label} 행 검토`} checked={checked} disabled={!editable} onChange={event => onChange(event.target.checked)} /> 행 검토</label>;
  return <section className="panel financial-workbench" aria-label="재무 작업실" style={{ padding: 20 }}>
    <div className="panel-heading"><div><h2>재무 작업실</h2><p>합성 자료의 여러 행을 직접 대조하는 DEMO입니다. 산식·분류·공제는 검증된 법률 기준이 아닙니다.</p></div></div>
    <div role="tablist" aria-label="재무 항목" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>{([["income", "소득원·대상기간"], ["debts", "채권 계약"], ["assets", "재산·처분"], ["budget", "비용·배분 예시"]] as const).map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} className={`button ${tab === id ? "primary" : "secondary"}`} onClick={() => setTab(id)}>{label}</button>)}</div>
    {tab === "income" && <div role="tabpanel" aria-label="소득원·대상기간">
      <p>각 행의 금액은 입력한 대상기간의 <strong>월 환산 예시값</strong>입니다. 기간 총액을 자동으로 월평균으로 바꾸지 않습니다. 같은 소득원·겹친 기간은 중복 확인 대상입니다.</p>
      <div style={{ overflowX: "auto" }}><table style={{ width: "100%" }}><thead><tr>{["소득원", "월 총수입", "월 경비", "시작일", "종료일", "출처", "검토", "관리"].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{data.incomes.map((row, index) => <tr key={row.id}>
        <td>{text(`소득 ${index + 1} 이름`, row.label, label => income(row.id, { label }))}</td><td>{numeric(`소득 ${index + 1} 총수입`, row.gross, gross => income(row.id, { gross }))}</td><td>{numeric(`소득 ${index + 1} 경비`, row.expenses, expenses => income(row.id, { expenses }))}</td>
        <td>{text(`소득 ${index + 1} 시작일`, row.from, from => income(row.id, { from }), "date")}</td><td>{text(`소득 ${index + 1} 종료일`, row.to, to => income(row.id, { to }), "date")}</td><td>{text(`소득 ${index + 1} 출처`, row.source, source => income(row.id, { source }))}</td><td>{review(row.label, row.confirmed, confirmed => income(row.id, { confirmed }))}</td><td>{remove(row.label, () => update({ ...data, incomes: data.incomes.filter(item => item.id !== row.id) }))}</td>
      </tr>)}</tbody></table></div>
      <button className="button secondary" disabled={!editable} onClick={() => update({ ...data, incomes: [...data.incomes, { id: nextId("income"), label: "새 합성 소득원", gross: null, expenses: null, from: "2026-01-01", to: "2026-09-30", source: "", confirmed: false }] })}>소득원 추가</button>
    </div>}
    {tab === "debts" && <div role="tabpanel" aria-label="채권 계약">
      <p>같은 금융기관도 계약별로 구분하세요. 담보·조세·우선·다툼 표시는 사용자 선택 예시이며 일반채권 배분에서 제외됩니다.</p>
      <div style={{ overflowX: "auto" }}><table style={{ width: "100%" }}><thead><tr>{["계약·채권자", "원금", "이자", "담보", "분류", "기준일", "출처", "검토", "관리"].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{data.debts.map((row, index) => <tr key={row.id}>
        <td>{text(`채권 ${index + 1} 계약`, row.label, label => debt(row.id, { label }))}</td><td>{numeric(`채권 ${index + 1} 원금`, row.principal, principal => debt(row.id, { principal }))}</td><td>{numeric(`채권 ${index + 1} 이자`, row.interest, interest => debt(row.id, { interest }))}</td><td><input aria-label={`채권 ${index + 1} 담보`} type="checkbox" checked={row.secured} disabled={!editable} onChange={event => debt(row.id, { secured: event.target.checked })} /></td>
        <td><select aria-label={`채권 ${index + 1} 분류`} style={inputStyle} disabled={!editable} value={row.priority} onChange={event => debt(row.id, { priority: event.target.value as DemoDebtRow["priority"] })}>{Object.entries({ ordinary: "일반 예시", priority: "우선 검토", tax: "조세 검토", disputed: "다툼 검토" }).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></td>
        <td>{text(`채권 ${index + 1} 기준일`, row.asOf, asOf => debt(row.id, { asOf }), "date")}</td><td>{text(`채권 ${index + 1} 출처`, row.source, source => debt(row.id, { source }))}</td><td>{review(row.label, row.confirmed, confirmed => debt(row.id, { confirmed }))}</td><td>{remove(row.label, () => update({ ...data, debts: data.debts.filter(item => item.id !== row.id) }))}</td>
      </tr>)}</tbody></table></div>
      <button className="button secondary" disabled={!editable} onClick={() => update({ ...data, debts: [...data.debts, { id: nextId("debt"), label: "새 합성 채권 계약", principal: null, interest: null, secured: false, priority: "ordinary", asOf: "2026-10-01", source: "", confirmed: false }] })}>채권 계약 추가</button>
    </div>}
    {tab === "assets" && <div role="tabpanel" aria-label="재산·처분">
      <p>재산 예시 = max(0, 평가액 − 담보잔액 − 비용 − 검토한 공제) × 지분. 처분 현금 예시 = max(0, 매각대금 − 담보잔액 − 비용) × 지분. 공제의 법적 허용 여부를 자동 판단하지 않습니다.</p>
      <div style={{ display: "grid", gap: 16 }}>{data.assets.map((row, index) => <fieldset key={row.id} style={{ border: "1px solid #dfe4e8", borderRadius: 8, padding: 16 }}><legend>재산 {index + 1}</legend><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 }}>
        <label>재산명{text(`재산 ${index + 1} 이름`, row.label, label => asset(row.id, { label }))}</label><label>평가액{numeric(`재산 ${index + 1} 평가액`, row.marketValue, marketValue => asset(row.id, { marketValue }))}</label><label>담보잔액{numeric(`재산 ${index + 1} 담보잔액`, row.securedBalance, securedBalance => asset(row.id, { securedBalance }))}</label><label>처분 비용{numeric(`재산 ${index + 1} 비용`, row.costs, costs => asset(row.id, { costs }))}</label><label>검토한 공제 예시{numeric(`재산 ${index + 1} 공제`, row.exemption, exemption => asset(row.id, { exemption }))}</label><label>지분 bp (10000=100%){numeric(`재산 ${index + 1} 지분`, row.ownershipBps, value => asset(row.id, { ownershipBps: value ?? -1 }))}</label><label>평가기준일{text(`재산 ${index + 1} 기준일`, row.asOf, asOf => asset(row.id, { asOf }), "date")}</label><label>출처{text(`재산 ${index + 1} 출처`, row.source, source => asset(row.id, { source }))}</label>
        <label><input type="checkbox" aria-label={`재산 ${index + 1} 처분`} checked={row.disposal} disabled={!editable} onChange={event => asset(row.id, { disposal: event.target.checked })} /> 처분 계획 예시</label>{row.disposal && <label>매각대금{numeric(`재산 ${index + 1} 매각대금`, row.salePrice, salePrice => asset(row.id, { salePrice }))}</label>}{review(row.label, row.confirmed, confirmed => asset(row.id, { confirmed }))}{remove(row.label, () => update({ ...data, assets: data.assets.filter(item => item.id !== row.id) }))}
      </div></fieldset>)}</div>
      <button className="button secondary" disabled={!editable} onClick={() => update({ ...data, assets: [...data.assets, { id: nextId("asset"), label: "새 합성 재산", marketValue: null, securedBalance: null, costs: null, exemption: null, ownershipBps: 10000, disposal: false, salePrice: null, asOf: "2026-10-01", source: "", confirmed: false }] })}>재산 추가</button>
    </div>}
    {tab === "budget" && <div role="tabpanel" aria-label="비용·배분 예시">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12 }}><label>월 생계비 예시{numeric("예산 생계비", data.livingCost, livingCost => update({ ...data, livingCost }))}</label><label>월 보수·비용 예시{numeric("예산 비용", data.fees, fees => update({ ...data, fees }))}</label><label>월 우선변제 예시{numeric("예산 우선변제", data.priorityPayment, priorityPayment => update({ ...data, priorityPayment }))}</label><label>예시 기간<select aria-label="재무 예시 기간" style={inputStyle} value={data.months} disabled={!editable} onChange={event => update({ ...data, months: Number(event.target.value) as FinancialDemo["months"] })}>{[36, 48, 60].map(months => <option key={months} value={months}>{months}개월</option>)}</select></label></div>
      <p>일반 배분 월 예산 = max(0, 수입 − 경비 − 생계비 − 비용 − 우선변제). 일반채권에 한해 원금+이자 비율로 정수 원 단위 절사합니다. 잔여 원은 자동 배분하지 않습니다.</p>
      <dl style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 16 }}>{[["월 수입", result.incomeGross], ["월 경비", result.incomeExpenses], ["가용액 예시", result.disposableIncome], ["일반 배분 월 예산", result.ordinaryBudget], ["일반채권 합계", result.ordinaryDebt], ["기간 배분 예산", result.repaymentPool], ["미배분 잔여 원", result.unallocated], ["일반채권 부족액", result.shortfall], ["처분 현금 예시", result.disposalProceeds], ["남는 재산 예시", result.remainingAssets]].map(([label, value]) => <div key={String(label)}><dt>{label}</dt><dd><strong>{won(value as number | null)}</strong></dd></div>)}</dl>
      {result.allocations.length > 0 && <table style={{ width: "100%" }}><thead><tr><th>일반채권 계약</th><th>기간 배분 예시</th></tr></thead><tbody>{result.allocations.map(row => <tr key={row.id}><td>{row.label}</td><td>{won(row.amount)}</td></tr>)}</tbody></table>}
    </div>}
    {[...result.duplicates, ...result.issues].length > 0 && <div className="notice amber" role="status" style={{ display: "block", marginTop: 16 }}><strong>계산·반영 보류</strong><ul>{[...result.duplicates, ...result.issues].map((issue, index) => <li key={`${index}-${issue}`}>{issue}</li>)}</ul></div>}
    {result.warnings.length > 0 && <ul>{result.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>}
    <div style={{ borderTop: "1px solid #e4e7ec", paddingTop: 16, marginTop: 18 }}><label>변경·반영 이유<input aria-label="재무 변경 이유" style={{ ...inputStyle, marginTop: 6 }} value={reason} disabled={!editable} onChange={event => setReason(event.target.value)} placeholder="합성 자료에서 확인한 대상·기간·변경 이유" /></label><div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}><button className="button secondary" disabled={!editable || !dirty || !reason.trim()} onClick={save}>재무 작업 저장</button><button className="button primary" disabled={role !== "staff" || !result.ready || !reason.trim()} onClick={applyTotals}>핵심 금액 후보로 반영</button><span>{dirty ? "미저장 변경" : "현재 작업 저장됨"}</span></div><p>핵심 반영 뒤에도 금액·출처 확인과 새 초안의 순차 모의 검토가 필요합니다. 법원 제출이나 법적 승인 기능은 없습니다.</p>{notice && <p role="status">{notice}</p>}</div>
  </section>;
}
export function FinancialWorkbench(props: FinancialWorkbenchProps) { return <FinancialEditor key={props.current.id} {...props} />; }
export default FinancialWorkbench;
