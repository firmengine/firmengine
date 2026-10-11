# QUESTIONS.md

Team: [9, Firm Engine]
Last updated: [2026-10-06]

Your biggest open questions about this project.
Write this together, after the premortem merge.

At most five, most important first.
The consultation opens with question 1, so put the one you are least sure about there, not the one that is easiest to ask.

Write in Korean or English.
Keep the headings exactly as they are.

---

## What counts as an open question

- **The answer would change what you do next.** If every possible answer leaves your next two weeks the same, it is curiosity, not an open question.
- **It is specific to this project.** "Is our idea good?" cannot be answered in 30 minutes. "We assume the person in `PROJECT.md` will enter data by hand every day, and none of us has asked one. How do we test that in a week?" can.
- **You have already tried something.** Say what you think the answer is today, even if it is a guess. A question with a guess attached gets a much better answer than a bare one.

Two good places to look for questions:

- `docs/PREMORTEM.md` — a cause of failure you could not find a countermeasure for is a question.
- `docs/PROJECT.md` — the section you argued about longest, or the one where you wrote "nobody yet".

## Our questions

### 1. [ “현재 저희가 설정한 빚오프 프로젝트의 workflow와 기능 범위가 ‘one intense pain point for one specific person’을 해결하는 수준으로 충분히 집중되어 있다고 보시는지, 아니면 최종 working product의 완성도를 위해 scope를 더 좁히는 것이 좋을지 의견을 듣고 싶습니다. 현재 저희는 제출서류 및 진술서의 AI 입력 및 검증 대조를 핵심 workflow로 보고 있습니다.” ]

- **Why it matters:** SCOPE과 우선순위 가치에 따라 개발 우선순위 변경 [what you would do differently depending on the answer]
- **What we think today:** 제출서류 및 진술서의 AI 입력 및 검증, 대조 [your current guess, and what you tried or read]
- **Who could answer it:** the instructor, a specific kind of user, someone at a member's company  

### 2. [빅테크의 범용 AI가 계속 발전하면, 저희가 구축한 에이전틱 워크플로우의 결과가 자료를 한 번에 넣어 분석한 결과보다 못할 수도 있다고 봅니다. 그렇다면 결국 책임자가 확인·승인하는 휴먼인더루프 프로세스가 중요해진다고 생각하는데, 저희 기획에서 이 사람 책임 부분을 프로세스 안에 명확히 드러내는 것에 대해 어떻게 보시는지 궁금합니다.   ]

- **Why it matters:** 책임구조가 중요가치가 맞다면, 승인/반려/단계와 검수로그 개발을 우선순위화하고, 아니라면 자동화 정확도, 처리시간 단축에 집중 
- **What we think today:** 분석성능은 범용 AI가 계속 고도화되므로, 차별점은 "누가 확인, 승인했는가"를 남기는 책임구조가 될 수 있다 봅니다. 그래서 Agent를 관제/2차검수 하나로 통합하고 제출전 담당자 승인단계를 둡니다. 다만, 사용자에게 추가 업무로 여겨질지는 추가 고민 필요합니다.
- **Who could answer it:** the instructor, 개인회생사무소 실무자, 팀 내 변호사

### 3. [보정권고 사전대응 부분에서 저희팀 과제에서도는 변호사인 푸른팀과 논의한 결과, 반복학습 데이터의 부족, 사건정보의 사후 사용, 비교적 단순하고 정형화된 업무 사유로, 개인회생 부분에는 DB축적과 반복 학습의 개념을 적용하지 않는 것으로 의견을 모았는데, 이 콜드스타트와 데이터 거버넌스 문제를 현실적으로 풀 수 있는 접근이 있을까요?]

- **Why it matters:** 현실적 대안이 있으면 보정권고 사전대응을 핵심기능으로 유지하고, 없으면 체크리스트로 축소해 1번 Workflow에 집중
- **What we think today:** 데이터 축적 대신 실무준칙/보정권고 빈출 유형 기반의 규칙형 사전검증 내지 법령지식 MCP 등으로 우회하고 (ex. Prompt-Engineering, Law Graph 등), 사건정보는 처리중에만 쓰고 금번 데모까지는 저장하지 않음. 규칙 내지 MCP로 보정권고를 얼마나 줄일지, 비식별 데이터의 제한적 축적이 장기적으로 필요할지는 향후 검토 필요
- **Who could answer it:**: the instructor 

[ 저희팀 과제의 효과 측정을 위해, 크레딧 사용량, 업무 처리시간, 보정 권고 감소 등의 KPI를 잡으려고하는데, AI agent 개발 시 추천해주실만한 다른 KPI가 있으실지 여쭙습니다. ]

## Where we disagree

[Optional, and often the most useful part.
If two members would answer one of the questions above differently, write both answers here, without deciding who is right.]

---

## After the consultation

Fill this in within a week of your slot.

| # | What we heard | What we will do about it | Owner | By when |
| 1 | 포괄적인 scope로, 누구를 위한 service인지 targeting 필요 | 프로젝트 진행하며 실제 사용처에 맞는 scope 구체화 진행 | - | - |
| 2 | Gpt, claude, gemini와 같은 AI Service에 동일 기능 요청 시, 어느 수준으로 가능한지 testing 필요 | AI활용 동의 고객 사례에 대해 민감정보 masking 후 test 진행 | - | - |
| 3 | 사용자 Feedback을 통한 자체 품질향상 가능한 구조 반영 필요. 어려울 수 있으나, 다양한 방식 검토해볼 것 | HITL 절차 추가 시, 해당 절차에서 발생하는 데이터를 바탕으로 feedback loop 구현 검토 | - | - |
| 4 | 기술적으로 flat해 질 수 있으나, 이 점에 대한 product의 차별화 요소 검토 필요 | product 차별화 요소 추가 검토 | - | - |



## Revision log

| Date | What changed and why |
|---|---|
| [2026-10-06] | Draft for consultation |
| [YYYY-MM-DD] | Revised after consultation on [date]: [what changed] |
