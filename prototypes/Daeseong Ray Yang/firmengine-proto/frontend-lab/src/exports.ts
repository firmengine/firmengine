import type { GeneratedSnapshot } from './model';

export const escapeHtml = (value: unknown): string => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
export function snapshotHtml(snapshot: GeneratedSnapshot): string {
  const p = snapshot.payload, e = escapeHtml;
  const status = snapshot.invalidated ? '변경 전 생성본 · 재검토 필요' : snapshot.lawyerReviewed ? '모의 검토 완료' : '미검토 초안';
  return `<!doctype html><html lang="ko"><meta charset="UTF-8"><meta name="viewport" content="width=device-width"><title>${e(p.title)} · 검토 보고서</title><style>body{max-width:900px;margin:50px auto;padding:24px;font:15px/1.8 system-ui,sans-serif;color:#173a32}table{border-collapse:collapse;width:100%}td,th{border:1px solid #dce4de;padding:12px;text-align:left}p{white-space:pre-wrap}.notice{background:#f3f0e5;padding:16px}small{color:#66776d}</style><h1>${e(p.title)}</h1><div class="notice">합성 예제 · 법원 제출용 아님 · ${e(status)}</div><p>생성본 ${e(snapshot.id)} / 사건 버전 ${e(snapshot.revision)}</p><h2>상담 기록</h2><p>${e(p.consultation)}</p>${p.narrative ? `<h2>검토 문구</h2><p>${e(p.narrative)}</p>` : ''}<h2>확인값과 근거</h2><table><thead><tr><th>항목</th><th>금액</th><th>출처</th><th>확인 사유</th></tr></thead><tbody>${p.fields.map(f => `<tr><td>${e(f.label)}</td><td>${f.value == null ? '미확인' : e(f.value.toLocaleString('ko-KR')) + '원'}</td><td>${e(p.documents.find(d => d.id === f.source?.documentId)?.name)} ${e(f.source?.page)}쪽<br>${e(f.source?.excerpt)}</td><td>${e(f.reason)}</td></tr>`).join('')}</tbody></table><h2>DEMO-1 예제 계산</h2><p>기간: ${e(p.months)}개월\n월 가용소득: ${e(p.calculation.disposableIncome.toLocaleString('ko-KR'))}원\n월 변제액: ${e(p.calculation.monthlyPayment.toLocaleString('ko-KR'))}원\n총 변제액: ${e(p.calculation.totalRepayment.toLocaleString('ko-KR'))}원\n계산상 잔여 채무: ${e(p.calculation.remainingDebt.toLocaleString('ko-KR'))}원</p><h2>모의 검토 기록</h2><p>담당자: ${snapshot.staffReviewed ? '확인' : '미확인'} / 변호사: ${snapshot.lawyerReviewed ? '확인' : '미확인'}</p><small>단순 산술로 작성한 로컬 테스트 보고서입니다. 실제 인증·전문가 승인·법원 서식·제출·접수·인가를 의미하지 않습니다. 다운로드 이후 변경 내용은 반영되지 않습니다.</small></html>`;
}
export function downloadSnapshot(snapshot: GeneratedSnapshot, format: 'html' | 'json') {
  const content = format === 'html' ? snapshotHtml(snapshot) : JSON.stringify({ kind: 'firmengine-local-test-snapshot', legalStatus: 'synthetic-not-for-filing', snapshot }, null, 2);
  const blob = new Blob([content], { type: format === 'html' ? 'text/html;charset=utf-8' : 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = `검토용-${snapshot.id}.${format}`; link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
