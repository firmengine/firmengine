# PROJECT.md

Team: \[Team 9, Firm Engine]
Members: \[임태훈, 홍푸른, 배지열, 양대성]
Last updated: \[2026-10-06]

One page.
Draft it together before anyone writes a premortem, and come back to it after the merge.

You are not committing to this.
You are making it concrete enough to argue about, and concrete enough that a premortem about it means something.
A project idea you cannot imagine failing in a specific way is not yet an idea.

Later in the term you will run a Why Tree on this, and the Why Tree may well move it.
That is expected, and it is not wasted work.

Write in Korean or English.
Keep the headings exactly as they are.

\---

## What we think we are building



배경: 전통적인 개인회생 법무업무는 부채증명서의 내용을 충실하게 반영하고, 그에 따른 진술을 하여 법원을 설득하는 업무였습니다. 그러나 부채증명서의 내용은 ai가 충분히 빠르게 대체할 수 있는 부분이고, 법원에 출석하는 업무보다는 서류작업이 주가 되므로 ai가 빠르게 대체할 수 있는 부분입니다.  이에 따라 ai활용을 통해 업무의 효율을 확실하게 증가시킬 수 있는 부분이라고 판단되어 우선적으로 개발하게 되었습니다.



\[개인회생 희망 고객, 개인회생 담당 변호사, 개인회생 사건 담당자 (사무장), 개인회생 고객 상담직원을 위한 개인회생 AI-Automation 서비스입니다.

&#x20;의뢰인의 진술과 원본 금융 서류를 AI로 구조화된 신청서 초안으로 즉시 변환하여 수작업 데이터 입력을 최소화하고, 원본과 입력값의 검증 및 대조까지 AI가 수행하도록 합니다.

&#x20;변호사와 사무장은 까다로운 예외 사항 내지 전체 프로세스의 최종 검토 및 승인 단계 중심으로 개입하도록 하는 효율과 편의를 제공하고자 합니다.]

## Who it is for

* **Person:** \[개인회생 희망 고객 (고객 넣을지 말지 회의 제안), 개인회생 담당 변호사, 법률회사 개인회생 사건 담당자, 개인회생 고객 상담직원]
* **Situation:** \[1) 회생신청을 위한 고객 소비내역 (카드 등)과 진술 수취 후 증빙 간 서류와 진술이 일치하는지 하나하나 대조해 진술서와 신청서류를 작성하거나 수작업 검수,

&#x20;                  2) 법원 보정 명령이 오면 기존 서류와 새답변이 어긋나지 않았는지 하나하나 수작업 대조,

&#x20;                  3) 의뢰인이 부채증명서, 급여명세서, 재산 관련 서류를 정리되지 않은 채 한꺼번에 책상 위에 쏟아놓고,

&#x20;                     직원이 그 안에서 실제 원금과 이자를 뽑아 36개월 변제계획표를 만들어야 하는 순간

&#x20;

* **What they do today instead:**

&#x20;    \[서식은 회생 서류작성 프로그램으로 만들지만, 진술과 증빙 일치 여부는 담당자가 PDF 출력물을 대조하고 엑셀과 법원양식에 반복하여 금액을 옮겨 적는다. 고객진술은 카톡/메일을 다시 검색해 찾고, 이전 제출 서류와의 일관성은 담당자와 변호사의 기억에 의존한다. 놓친 불일치는 법원 보정명령이 와야 드러난다. 숫자가 맞지 않으면 빠진 데이터를 채우기 위해 의뢰인에게 카카오톡을 보내거나 전화를 걸어 확인합니다.]

## How we know this problem is real

\[본 Painpoint 사례는 실제 Decent 법률 사무소의 CEO 변호사 홍푸른님의 현장 경험 공유를 통해 알게 되고, 논의한 사실입니다.]



## Why us

\[CEO를 통한 시스템(빚오프 초기버전 홈페이지: https://debt-off.com)과 데이터, 현장과 실상 Access. 실제로 테스트할 수 있는 현장이 이미 마련되어 있고, 무엇이 효과가 있고 무엇이 실패하는지 정확히 알려줄 실무 직원들에게 바로 접근할 수 있습니다. 콜드콜 단계를 건너뛰고 파일럿을 실제 사무소에 곧바로 적용할 수 있습니다.]

## What would make us drop this idea

\[사용자 사전반응 기준: 실무자 (사건 담당자, 변호사 등) 대상 모수 중 60% 이상이 이 시스템의 프로토타입을 보고 "진술 증빙 대조는 지금방식이나 쓰는 프로그램으로 충반하다"고 하면 Drop 한다

\[작성 소요시간 기준: 수임이후 서류작성시간이 20%이상 빨라지지 않으면 Drop 한다.]





Revision log

|Date|What changed and why|
|-|-|
|\[YYYY-MM-DD]2026-10-06|Draft for consultation : <br />What would make us drop this idea 기준이 사용자의 시스템효과 동의 >> 소요시간 기준|
|\[YYYY-MM-DD]2026-10-09|Revised after consultation on \[date]: \[what changed]|



