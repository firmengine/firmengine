/* Exact, dependency-free n8n Code module. JSON monetary values remain strings.
 * Source: copied blueprint reference; partial numeric checks, never a legal decision.
 * This file executes unchanged in n8n and in the synthetic Node regression suite.
 */
'use strict';
const CALCULATOR_RELEASE = 'seoul-blueprint-arithmetic-v1';
const MEDIAN_2026 = ['2564238','4199292','5359036','6494738','7556719','8555952','9515150'];

function decimal(value) {
  if (typeof value !== 'string' && typeof value !== 'bigint') return null;
  const text = String(value);
  if (!/^-?\d+(?:\.\d+)?$/.test(text) || text.replace(/\D/g,'').length > 64) return null;
  const [whole, fraction=''] = text.split('.');
  return {n: BigInt(whole + fraction), s: fraction.length};
}
function power(n) { return 10n ** BigInt(n); }
function align(a,b) { const s=Math.max(a.s,b.s); return [a.n*power(s-a.s),b.n*power(s-b.s),s]; }
function add(a,b) { const [x,y,s]=align(a,b); return {n:x+y,s}; }
function subtract(a,b) { const [x,y,s]=align(a,b); return {n:x-y,s}; }
function multiply(a,b) { return {n:a.n*b.n,s:a.s+b.s}; }
function compare(a,b) { const [x,y]=align(a,b); return x<y?-1:x>y?1:0; }
function text(a) {
  const sign=a.n<0n?'-':''; let digits=String(a.n<0n?-a.n:a.n).padStart(a.s+1,'0');
  if (a.s) digits=(digits.slice(0,-a.s)+'.'+digits.slice(-a.s)).replace(/0+$/,'').replace(/\.$/,'');
  return sign+digits;
}
const ZERO={n:0n,s:0};
function currentAssertions(snapshot) {
  const all=Array.isArray(snapshot.assertions)?snapshot.assertions:[];
  const replaced=new Set(all.map(a=>a.supersedes).filter(Boolean));
  return all.filter(a=>a.state!=='RETRACTED'&&!replaced.has(a.id||a.assertion_id));
}
function findAssertion(rows,key,objectId) {
  const found=rows.filter(a=>a.feature_key===key&&(objectId===undefined||a.object_id===objectId));
  if (found.some(a=>a.state==='DISPUTED')) return null;
  const verified=found.filter(a=>a.state==='VERIFIED'&&a.value!==null&&a.value!==undefined&&a.value!=='');
  if (!verified.length) return null;
  const signatures=new Set(verified.map(a=>JSON.stringify([a.value,a.valid_at,a.period_start,a.period_end,a.source_period,a.measurement_period,a.currency,a.unit])));
  return signatures.size===1?verified[0]:null;
}
function money(a) {
  if (!a || (a.currency && a.currency!=='KRW')) return null;
  const value=decimal(a.value);
  return value&&value.n>=0n?value:null;
}
function truth(a) {
  if (!a) return 'UNKNOWN';
  if (a.value===true||['TRUE','YES','있음'].includes(String(a.value).toUpperCase())) return 'TRUE';
  if (a.value===false||['FALSE','NO','없음'].includes(String(a.value).toUpperCase())) return 'FALSE';
  return 'UNKNOWN';
}
function period(a) { return JSON.stringify([a?.period_start||null,a?.period_end||null,a?.valid_at||null,a?.source_period||null]); }
function monthly(a) { return !!a && (a.measurement_period==='MONTHLY'||['won/month','KRW/month','원/월'].includes(a.unit)); }
function complete(a) { return !!a&&['COMPLETE','VERIFIED_COMPLETE'].includes(String(a.value).toUpperCase()); }
function isoDate(value) { return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value; }
function scoped(a) { return !!a&&(isoDate(a.valid_at)||!!a.source_period||(isoDate(a.period_start)&&isoDate(a.period_end)&&a.period_start<=a.period_end)); }
function calculateCase(snapshot) {
  const rows=currentAssertions(snapshot), results=[];
  const release=snapshot.rule_release_id||snapshot.rule_release?.id||CALCULATOR_RELEASE;
  const get=(key,oid)=>findAssertion(rows,key,oid);
  function result(id,outcome,reason,values={},inputs=[],missing=[],notes=[]) {
    const row={rule_id:id,rule_version:CALCULATOR_RELEASE,rule_release_id:release,outcome,reason_code:reason,
      values:Object.fromEntries(Object.entries(values).map(([key,value])=>[key,text(value)])),
      input_assertion_ids:[...new Set(inputs.filter(Boolean).map(a=>a.id||a.assertion_id))],
      missing_features:missing,notes,not_court_decision:true}; results.push(row); return row;
  }
  const unknown=(id,reason,features,inputs=[])=>result(id,'UNKNOWN',reason,{},inputs,features);
  const selectedRelease=snapshot.rule_release||{};
  const compatibleRelease=release===CALCULATOR_RELEASE||selectedRelease.id===release&&selectedRelease.calculator_release_id===CALCULATOR_RELEASE
    &&['ACTIVE','VERIFIED','APPROVED'].includes(String(selectedRelease.status||'').toUpperCase());
  const application=snapshot.application_date;
  const temporalOk=isoDate(application)&&(!selectedRelease.effective_from||application>=selectedRelease.effective_from)
    &&(!selectedRelease.effective_to||application<=selectedRelease.effective_to);
  if(!compatibleRelease||!temporalOk){
    for(const key of ['KR.579.DEBT_LIMITS','SEOUL.405.BASIC_LIVING_2026','KR.614.MINIMUM_REPAYMENT','KR.614.LIQUIDATION_COMPARISON','SEOUL.405.ADDITIONAL_HOUSING','INCOME.MONTHLY_NET','PLAN.NOMINAL_PAYMENTS'])
      unknown(key,!compatibleRelease?'RULE_RELEASE_UNSUPPORTED':'APPLICATION_DATE_OR_RULE_PERIOD_UNKNOWN',['case.application_date','rule_release_id']);
    return {rule_release_id:release,calculator_version:CALCULATOR_RELEASE,case_revision:snapshot.revision,computed_by:'n8n-code',scope:'partial_numeric_rules',results};
  }

  // §579: classifications and collection completeness are prerequisites, not guesses.
  const capBinding=selectedRelease.parameters?.['KR.579.DEBT_LIMITS'];
  let securedLimit=decimal('1500000000'),otherLimit=decimal('1000000000'),capBindingValid=true;
  if(capBinding!==undefined){
    const sec=decimal(capBinding?.params?.secured_cap),uns=decimal(capBinding?.params?.unsecured_cap);
    capBindingValid=capBinding?.rule_id==='KR.579.DEBT_LIMITS'&&capBinding?.validator_version==='debt-limits-v1'
      &&capBinding?.source_id==='K01'&&typeof capBinding.version_id==='string'&&!!capBinding.version_id
      &&/^[0-9a-f]{64}$/.test(capBinding.content_hash||'')&&isoDate(capBinding.effective_from)&&capBinding.effective_from<=application
      &&capBinding.validation?.boundary_cases_passed>=5&&capBinding.validation?.semantic_template==='unchanged_or_reviewed_initial_caps'
      &&!!sec&&!!uns&&sec.s===0&&uns.s===0&&sec.n>0n&&uns.n>0n;
    if(capBindingValid){securedLimit=sec;otherLimit=uns;}
  }
  const debtIds=[...new Set([...(snapshot.objects||[]).filter(o=>['debt','creditor'].includes(o.type)).map(o=>o.id),
    ...rows.filter(a=>a.feature_key.startsWith('debts[]')).map(a=>a.object_id)].filter(Boolean))];
  const debtCoverage=get('coverage.debt_inventory');
  let debtInputs=[debtCoverage], secured=ZERO, other=ZERO, debtMissing=[];
  if (!complete(debtCoverage)||!debtIds.length) debtMissing.push('coverage.debt_inventory');
  for (const oid of debtIds) {
    const p=get('debts[].principal',oid),i=get('debts[].interest',oid),kind=get('debts[].security_status',oid),asof=get('debts[].amount_as_of',oid);
    debtInputs.push(p,i,kind,asof); const pv=money(p),iv=money(i);
    const classification=String(kind?.value||'').toUpperCase();
    if (!pv||!iv||!isoDate(asof?.value)||!['SECURED','UNSECURED','담보','무담보'].includes(classification)
      ||period(p)!==period(i)||(p.valid_at&&p.valid_at!==asof.value)||(i.valid_at&&i.valid_at!==asof.value)) {
      debtMissing.push('debts[].principal','debts[].interest','debts[].security_status','debts[].amount_as_of'); continue;
    }
    if (['SECURED','담보'].includes(classification)) secured=add(secured,add(pv,iv)); else other=add(other,add(pv,iv));
  }
  if(!capBindingValid)unknown('KR.579.DEBT_LIMITS','BOUND_PARAMETER_VERSION_UNVERIFIED',['rule_release.parameters.KR.579.DEBT_LIMITS'],debtInputs);
  else if (debtMissing.length) unknown('KR.579.DEBT_LIMITS','DEBT_SCOPE_OR_CLASSIFICATION_UNVERIFIED',[...new Set(debtMissing)],debtInputs);
  else result('KR.579.DEBT_LIMITS',compare(secured,securedLimit)<=0&&compare(other,otherLimit)<=0?'PASS':'FAIL',
    'TWO_SEPARATE_AMOUNT_CAPS',{secured,other,secured_limit:securedLimit,other_limit:otherLimit},debtInputs,[],['검증된 두 채무한도만 비교하며 전체 신청자격을 판정하지 않음']);
  if(capBindingValid&&capBinding){Object.assign(results[results.length-1],{parameter_version_id:capBinding.version_id,
    parameter_content_hash:capBinding.content_hash,parameter_effective_from:capBinding.effective_from,parameter_source_id:capBinding.source_id});}

  const household=get('household.recognized_count'),count=decimal(household?.value),year=String(snapshot.application_date||'').slice(0,4);
  if(year!=='2026'||!count||count.s!==0||count.n<1n||count.n>7n) unknown('SEOUL.405.BASIC_LIVING_2026','YEAR_OR_HOUSEHOLD_UNVERIFIED',['case.application_date','household.recognized_count'],[household]);
  else {const median=decimal(MEDIAN_2026[Number(count.n)-1]);result('SEOUL.405.BASIC_LIVING_2026','CALCULATED','SIXTY_PERCENT_ARITHMETIC_ONLY',
    {median_income:median,basic_living_expense:multiply(median,decimal('0.60'))},[household],[],['부양가구 결정·인정 생계비·원단위 반올림은 별도 검토']);}

  function pvPair(leftKey,rightKey) {
    const left=get(leftKey),right=get(rightKey),lv=money(left),rv=money(right);
    const compatible=left?.normalized===true&&right?.normalized===true&&isoDate(left.valuation_date)&&left.valuation_date===right.valuation_date&&left.basis_id&&left.basis_id===right.basis_id;
    return {left,right,lv,rv,ok:!!(lv&&rv&&compatible)};
  }
  const objection=get('court.objection_status'),objectionState=truth(objection);
  if(objectionState==='FALSE')result('KR.614.MINIMUM_REPAYMENT','NOT_APPLICABLE','NO_OBJECTION_FOR_THIS_CONDITION',{},[objection],[],['이 조건의 비적용이며 0원 변제 허용이 아님']);
  else if(objectionState!=='TRUE')unknown('KR.614.MINIMUM_REPAYMENT','OBJECTION_UNKNOWN',['court.objection_status'],[objection]);
  else {
    const p=pvPair('claims.total_present_value','plan.total_present_value');
    if(!p.ok)unknown('KR.614.MINIMUM_REPAYMENT','PV_NORMALIZATION_OR_BASIS_MISMATCH',['claims.total_present_value','plan.total_present_value'],[objection,p.left,p.right]);
    else {let floor=compare(p.lv,decimal('50000000'))<0?multiply(p.lv,decimal('0.05')):add(multiply(p.lv,decimal('0.03')),decimal('1000000'));
      if(compare(floor,decimal('30000000'))>0)floor=decimal('30000000');const margin=subtract(p.rv,floor);
      result('KR.614.MINIMUM_REPAYMENT',margin.n>=0n?'PASS':'FAIL','PARTIAL_MINIMUM_REPAYMENT_CHECK',
        {minimum_repayment_pv:floor,margin_pv:margin},[objection,p.left,p.right],[],['3천만원은 최저변제액 산식의 상한이며 계획총액 상한이 아님']);}
  }
  const pv=pvPair('plan.total_present_value','plan.liquidation_floor');
  if(!pv.ok)unknown('KR.614.LIQUIDATION_COMPARISON','PV_NORMALIZATION_OR_BASIS_MISMATCH',['plan.total_present_value','plan.liquidation_floor'],[pv.left,pv.right]);
  else {const margin=subtract(pv.lv,pv.rv);result('KR.614.LIQUIDATION_COMPARISON',margin.n>=0n?'PASS':'FAIL','SAME_BASIS_PV_COMPARISON',
    {plan_total_pv:pv.lv,liquidation_value_pv:pv.rv,margin_pv:margin},[pv.left,pv.right],[],['청산가치 자체의 법적 산정·동의 예외는 구현하지 않음']);}

  const housingKeys=['living.housing_actual','living.housing_included','living.housing_cap'],housing=housingKeys.map(key=>get(key)),hm=housing.map(money);
  const housingRequested=get('living.additional_housing_requested');
  if(truth(housingRequested)==='FALSE')result('SEOUL.405.ADDITIONAL_HOUSING','NOT_APPLICABLE','NO_ADDITIONAL_HOUSING_REQUEST',{},[housingRequested]);
  else if(hm.some(value=>value===null)||new Set(housing.map(period)).size!==1)unknown('SEOUL.405.ADDITIONAL_HOUSING','HOUSING_INPUT_SCOPE_UNVERIFIED',housingKeys,housing);
  else {let amount=subtract(hm[0],hm[1]);if(amount.n<0n)amount=ZERO;if(compare(amount,hm[2])>0)amount=hm[2];
    result('SEOUL.405.ADDITIONAL_HOUSING','CALCULATED','REVIEW_AMOUNT_NOT_RECOGNITION',{additional_housing_review:amount},housing,[],['적용표·실제 지출·추가 인정 여부는 별도 검토']);}

  // Each employment, business and passive source has its own object and period.
  const sourceIds=[...new Set([...(snapshot.objects||[]).filter(o=>o.type==='income_source').map(o=>o.id),
    ...rows.filter(a=>a.feature_key.startsWith('income_source.')).map(a=>a.object_id)].filter(Boolean))];
  let incomeValue=null,incomeInputs=[],incomeMissing=[];
  function sourceNet(oid) {
    const kind=get('income_source.kind',oid);incomeInputs.push(kind);
    const value=String(kind?.value||'').toLowerCase();
    if(['loan','own_transfer','between_owned_accounts'].includes(value))return {excluded:true};
    if(!['wage','salary','business','rent','interest','dividend','pension','benefit','benefits','other'].includes(value))return null;
    const net=get('income_source.net',oid);if(money(net)&&monthly(net)&&scoped(net)){incomeInputs.push(net);return {amount:money(net),period:period(net)};}
    const gross=get(value==='business'?'income_source.revenue':'income_source.gross',oid);
    const cost=get(value==='business'?'income_source.necessary_cost':'income_source.tax_social_insurance',oid);
    incomeInputs.push(gross,cost);const g=money(gross),c=money(cost);
    if(!g||!c||!monthly(gross)||!monthly(cost)||!scoped(gross)||!scoped(cost)||period(gross)!==period(cost))return null;
    return {amount:subtract(g,c),period:period(gross)};
  }
  if(sourceIds.length) {
    const coverage=get('coverage.income_sources');incomeInputs.push(coverage);
    if(!complete(coverage))incomeMissing.push('coverage.income_sources');
    let aggregate=ZERO,used=0;const sourcePeriods=new Set();
    for(const oid of sourceIds){const net=sourceNet(oid);if(!net)incomeMissing.push('income_source.kind','income_source.net');else if(!net.excluded){aggregate=add(aggregate,net.amount);sourcePeriods.add(net.period);used++;}}
    if(sourcePeriods.size>1)incomeMissing.push('income_source.period');
    if(!incomeMissing.length&&used)incomeValue=aggregate;
  } else {
    const net=get('income.monthly_net');
    if(money(net)&&monthly(net)&&scoped(net)){incomeValue=money(net);incomeInputs.push(net);}
    else {
      const business=snapshot.income_type==='business';
      const gross=get(business?'income.business_revenue':'income.monthly_gross'),cost=get(business?'income.necessary_cost':'income.tax_social_insurance');
      incomeInputs.push(gross,cost);const g=money(gross),c=money(cost);
      if(g&&c&&monthly(gross)&&monthly(cost)&&scoped(gross)&&scoped(cost)&&period(gross)===period(cost))incomeValue=subtract(g,c);
      else incomeMissing.push(business?'income.business_revenue':'income.monthly_gross',business?'income.necessary_cost':'income.tax_social_insurance');
    }
  }
  if(incomeValue===null)unknown('INCOME.MONTHLY_NET','INCOME_SOURCE_PERIOD_OR_COVERAGE_UNVERIFIED',[...new Set(incomeMissing.length?incomeMissing:['income_source.net'])],incomeInputs);
  else result('INCOME.MONTHLY_NET','CALCULATED','VERIFIED_MONTHLY_SOURCE_ARITHMETIC',{monthly_net:incomeValue},incomeInputs,[],['계좌 입금합계를 소득으로 간주하지 않음; 연간액을 자동으로 12로 나누지 않음']);

  const recognized=get('income.recognized_monthly_net'),living=get('living.recognized_total'),fee=get('plan.monthly_trustee_fee'),term=get('plan.term_months');
  const amount=money(recognized)||incomeValue,lv=money(living),fv=money(fee),months=decimal(term?.value);
  const planInputs=[recognized,living,fee,term,...incomeInputs];
  if(amount===null||!lv||!fv||!months||months.s!==0||months.n<=0n)unknown('PLAN.NOMINAL_PAYMENTS','PLAN_INPUTS_UNVERIFIED',
    ['income.recognized_monthly_net','living.recognized_total','plan.monthly_trustee_fee','plan.term_months'],planInputs);
  else {
    const disposable=subtract(amount,lv),payment=subtract(disposable,fv),total=multiply(payment,months);
    result('PLAN.NOMINAL_PAYMENTS',payment.n<0n?'FAIL':'CALCULATED',payment.n<0n?'NEGATIVE_DISPOSABLE_INCOME':'NOMINAL_PAYMENT_ARITHMETIC',
      {monthly_income:amount,monthly_disposable_income:disposable,monthly_payment:payment,repayment_months:months,total_nominal_repayment:total},planInputs,[],
      ['명목총액이며 현재가치가 아님; 기간의 법적 허용·채권별 배분·수행가능성은 별도 검토']);
  }
  return {rule_release_id:release,calculator_version:CALCULATOR_RELEASE,case_revision:snapshot.revision,computed_by:'n8n-code',scope:'partial_numeric_rules',results};
}
if(typeof module!=='undefined'&&module.exports)module.exports={calculateCase};
