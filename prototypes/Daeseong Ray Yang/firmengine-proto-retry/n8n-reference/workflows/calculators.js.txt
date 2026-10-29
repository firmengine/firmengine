/* PROTOTYPE: deterministic KRW arithmetic shared verbatim with the n8n Code node.
   This is a limited, reviewed-input calculation model, not a legal eligibility decision. */
function calculate(caseData) {
  const c = caseData || {}, blocked = [], warnings = [], inputRows = [];
  const MAX = BigInt(Number.MAX_SAFE_INTEGER);
  function number(value) { if (value > MAX || value < -MAX) throw new Error('지원 정수 범위를 초과했습니다.'); return Number(value); }
  function money(value, label) {
    if (value === null || value === undefined || value === '' || !/^\d+$/.test(String(value))) {
      blocked.push(`${label}: 원 단위 0 이상의 확정 금액이 필요합니다.`); return null;
    }
    const out = BigInt(value); if (out > MAX) { blocked.push(`${label}: 지원 정수 범위 초과`); return null; }
    return out;
  }
  function ym(value) { const m = /^(\d{4})-(\d{2})(?:-\d{2})?$/.exec(String(value || '')); return m && +m[2] >= 1 && +m[2] <= 12 ? +m[1] * 12 + +m[2] - 1 : null; }
  function labelMonth(value) { return `${Math.floor(value / 12)}-${String(value % 12 + 1).padStart(2, '0')}`; }
  const start = ym(c.period_start), end = ym(c.period_end);
  const periodValid = start !== null && end !== null && end >= start && end - start < 120;
  if (!periodValid) blocked.push('소득 대상기간의 시작·종료일을 확인하세요. 지원 범위는 최대 120개월입니다.');
  const months = periodValid ? end - start + 1 : 0;
  const monthly = Array.from({length: months}, (_, index) => ({month: labelMonth(start + index), gross: 0n, expense: 0n, sources: []}));
  const incomes = Array.isArray(c.incomes) ? c.incomes : [];
  let incomeUnknown = !incomes.length;
  if (!incomes.length) blocked.push('반복 소득원이 없습니다. 소득원과 대상기간 증빙을 추가하세요.');
  for (const income of incomes) {
    if (!income.confirmed) { blocked.push(`${income.label || income.id}: 소득 인정값 확인 필요`); incomeUnknown = true; continue; }
    if (!['business','salary','other','pension','rental','interest','dividend'].includes(income.kind)) {
      blocked.push(`${income.label || income.id}: 반복 소득의 법적 분류 확인 필요`); incomeUnknown = true; continue;
    }
    const gross = money(income.monthly_gross, `${income.label} 월 수입`), expense = money(income.monthly_expense, `${income.label} 월 인정경비`);
    const sourceStart = ym(income.period_start || c.period_start), sourceEnd = ym(income.period_end || c.period_end);
    if (gross === null || expense === null) { incomeUnknown = true; continue; }
    if (expense > gross) warnings.push(`${income.label}: 인정경비가 수입보다 큽니다. 원자료와 기간을 재확인하세요.`);
    if (sourceStart === null || sourceEnd === null || sourceEnd < sourceStart) { blocked.push(`${income.label}: 소득원 대상기간 확인 필요`); incomeUnknown = true; continue; }
    if (periodValid && (sourceEnd < start || sourceStart > end)) { blocked.push(`${income.label}: 사건 계산기간과 소득 증빙기간이 겹치지 않습니다.`); incomeUnknown = true; continue; }
    for (let i = 0; i < monthly.length; i++) if (start+i >= sourceStart && start+i <= sourceEnd) {
      monthly[i].gross += gross; monthly[i].expense += expense; monthly[i].sources.push(income.id);
    }
    inputRows.push({kind:'income',id:income.id,label:income.label,gross:number(gross),expense:number(expense),period_start:income.period_start || c.period_start,period_end:income.period_end || c.period_end,source_document_id:income.source_document_id || null});
  }
  const missingMonths = monthly.filter(row => !row.sources.length).map(row => row.month);
  if (missingMonths.length) { blocked.push(`소득 증빙이 없는 월: ${missingMonths.join(', ')}`); incomeUnknown = true; }
  const sumGross = monthly.reduce((s,r)=>s+r.gross,0n), sumExpense = monthly.reduce((s,r)=>s+r.expense,0n);
  const gross = months && !incomeUnknown ? sumGross/BigInt(months) : null, expense = months && !incomeUnknown ? sumExpense/BigInt(months) : null;
  const net = gross === null || expense === null ? null : gross - expense;
  const living = money(c.living_cost, '월 인정 생계비'), deductions = money(c.deductions, '월 추가 공제');
  const disposable = net === null || living === null || deductions === null ? null : (net-living-deductions > 0n ? net-living-deductions : 0n);
  if (disposable === 0n) blocked.push('현재 확정 소득·생계비로는 양의 가용소득이 없습니다. 소득·공제 또는 이행 재원을 검토하세요.');
  const term = Number(c.repayment_months);
  const termValid = Number.isSafeInteger(term) && term > 0 && term <= 120;
  if (!termValid) blocked.push('변제기간은 검토된 1~120개월 정수로 입력하세요. 이 범위는 소프트웨어 한도이며 법정 허용기간 판정이 아닙니다.');
  if (!c.rule_approved && !c.is_demo) blocked.push('적용 산식·기간·생계비·배분 방식에 대한 전문가 검토가 필요합니다.');
  let liquidation = 0n, assetUnknown = false;
  for (const a of c.assets || []) {
    if (!a.confirmed) { blocked.push(`${a.label}: 재산 평가·법적 공제 확인 필요`); assetUnknown = true; continue; }
    const market = money(a.market_value, `${a.label} 시가`), secured = money(a.secured_balance, `${a.label} 담보상환액`), exempt = money(a.exempt_amount, `${a.label} 법적 제외금액`);
    if (market === null || secured === null || exempt === null) { assetUnknown = true; continue; }
    const netValue = market-secured-exempt;
    liquidation += netValue > 0n ? netValue : 0n;
    inputRows.push({kind:'asset',id:a.id,label:a.label,market_value:number(market),secured_balance:number(secured),exempt_amount:number(exempt),net_value:number(netValue>0n?netValue:0n),valuation_source:a.valuation_source || null,valuation_date:a.valuation_date || null});
  }
  if (!c.assets_declared) { blocked.push('재산 목록의 완전성 확인이 필요합니다. 재산이 없으면 무재산 확인 사유를 남기세요.'); assetUnknown = true; }
  let principal = 0n, interest = 0n, debtUnknown = false;
  const debts = [];
  if (!(c.creditors || []).length) { blocked.push('계약별 채권 원금·이자·법적 분류가 필요합니다.'); debtUnknown = true; }
  for (const creditor of c.creditors || []) {
    const p = money(creditor.principal, `${creditor.name} 원금`), i = money(creditor.interest, `${creditor.name} 이자`);
    if (p === null || i === null) { debtUnknown = true; continue; }
    principal += p; interest += i;
    if (!creditor.confirmed) { blocked.push(`${creditor.name} (${creditor.contract_id || creditor.id}): 채권 인정값 확인 필요`); debtUnknown = true; }
    if (!creditor.contract_id) { blocked.push(`${creditor.name}: 복수 계약 구분을 위한 계약 식별자가 필요합니다.`); debtUnknown = true; }
    if (!['unsecured','secured'].includes(creditor.security) || !['ordinary','tax','priority'].includes(creditor.priority)) { blocked.push(`${creditor.name}: 채권 담보·우선순위 분류 필요`); debtUnknown = true; }
    if (creditor.security === 'secured' || creditor.disputed || creditor.estate_claim || creditor.non_dischargeable) {
      blocked.push(`${creditor.name}: 담보·다툼·재단/비면책 채권은 개별 법적 배분 검토가 필요합니다. 자동 일반채권 비례배분에서 제외합니다.`); debtUnknown = true;
    }
    debts.push({id:creditor.id,name:creditor.name,contract_id:creditor.contract_id,priority:creditor.priority,principal:p,interest:i,claim:p+i});
    inputRows.push({kind:'creditor',id:creditor.id,contract_id:creditor.contract_id,principal:number(p),interest:number(i),security:creditor.security,priority:creditor.priority});
  }
  const totalDebt = principal+interest;
  if (!totalDebt && !debtUnknown) { blocked.push('확정 채무 합계가 0원입니다. 신청 대상과 채권 자료를 확인하세요.'); debtUnknown = true; }
  const payment = disposable !== null && termValid && !debtUnknown ? (disposable*BigInt(term) > totalDebt ? totalDebt : disposable*BigInt(term)) : null;
  const allocations = [];
  if (payment !== null && totalDebt > 0n) {
    const priorities = debts.filter(d=>d.priority !== 'ordinary'), ordinary = debts.filter(d=>d.priority === 'ordinary');
    const priorityTotal = priorities.reduce((sum,row)=>sum+row.claim,0n);
    if (priorityTotal > payment) blocked.push('우선변제 채권 전액을 충당할 수 없습니다. 납부·유예·재원과 법적 취급을 검토하세요.');
    else {
      const ordinaryTotal = ordinary.reduce((sum,row)=>sum+row.claim,0n), remainder = payment-priorityTotal;
      const rows = ordinary.map(d=>({...d,allocated:ordinaryTotal ? remainder*d.claim/ordinaryTotal:0n,remainder:ordinaryTotal ? remainder*d.claim%ordinaryTotal:0n}));
      let extra = remainder-rows.reduce((sum,row)=>sum+row.allocated,0n);
      for (const row of [...rows].sort((a,b)=>a.remainder===b.remainder ? String(a.id).localeCompare(String(b.id)) : (a.remainder>b.remainder?-1:1))) {
        if (extra > 0n) { row.allocated++; extra--; }
      }
      for (const row of [...priorities.map(d=>({...d,allocated:d.claim})),...rows]) {
        const perMonth = row.allocated/BigInt(term), finalMonth = row.allocated-perMonth*BigInt(term-1);
        allocations.push({creditor_id:row.id,name:row.name,contract_id:row.contract_id,priority:row.priority,principal:number(row.principal),interest:number(row.interest),claim:number(row.claim),total_payment:number(row.allocated),monthly_payment:number(perMonth),final_payment:number(finalMonth),repayment_rate:row.claim?Number(row.allocated*10000n/row.claim)/100:0});
      }
    }
  }
  if (payment !== null && !assetUnknown && payment < liquidation) blocked.push('명목 변제총액이 현재 산정된 재산 순가치보다 적습니다. 청산가치 및 현재가치 기준을 전문가와 확인하세요.');
  warnings.push('현재가치 할인·변제비용·면제재산 적용과 예외는 별도 검토 대상입니다. 명목 변제총액을 현재가치로 표시하지 않습니다.');
  if (c.is_demo) warnings.push('합성 예시의 계산입니다. 실제 사건·승인 산식·실제 법원 서식 검증을 대체하지 않습니다.');
  const value = v=>v===null?null:number(v);
  return {
    monthly_income:value(gross),monthly_expense:value(expense),net_income:value(net),disposable_income:value(disposable),
    liquidation_value:assetUnknown?null:value(liquidation),total_principal:debtUnknown?null:value(principal),total_interest:debtUnknown?null:value(interest),total_debt:debtUnknown?null:value(totalDebt),
    monthly_payment:payment===null?null:value(payment/BigInt(term)),final_payment:payment===null?null:value(payment-(payment/BigInt(term))*BigInt(term-1)),total_payment:value(payment),
    repayment_rate:payment!==null && totalDebt>0n ? Number(payment*10000n/totalDebt)/100 : null,
    annual_income:months===12&&!incomeUnknown?number(sumGross):null,annual_expense:months===12&&!incomeUnknown?number(sumExpense):null,
    period_months:months,repayment_months:termValid?term:null,monthly:monthly.map(r=>({month:r.month,gross:number(r.gross),expense:number(r.expense),net:number(r.gross-r.expense),source_ids:r.sources})),
    allocations,inputs:inputRows,rule_version:c.rule_version || 'retry-arithmetic-1.0.0',rounding:'KRW integer; monthly averages floor; largest remainder for ordinary claims; final instalment adjustment',
    present_value:null,engine:'shared-code',blocked:[...new Set(blocked)],warnings:[...new Set(warnings)],
  };
}

// NODE_ADAPTER_START
if (typeof module !== 'undefined') module.exports = {calculate};
if (typeof require !== 'undefined' && require.main === module) {
  let input=''; process.stdin.setEncoding('utf8'); process.stdin.on('data',chunk=>input+=chunk);
  process.stdin.on('end',()=>{try{process.stdout.write(JSON.stringify(calculate(JSON.parse(input))));}catch(error){process.stderr.write(error.message);process.exitCode=1;}});
}
