# Premortem — [홍푸른]

Team: [9, Firm Engine]
Written on: [2026-10-03]
I wrote this before reading anyone else's list: [no]

Copy this file, rename it after yourself (for example `gildong.md`), and fill it in alone.
Do this before your team meets to merge, and do not read anyone else's list first.
Write your own list before you ask any artificial intelligence (AI).
An AI list anchors you the same way a teammate's would, and an AI does not know your team, so it can only give you the list every team would get.

Write in Korean or English, whichever you think in.
Keep the headings exactly as they are.

---

## The premise

It is December 19, 2026.
Demo Day.
Your team's project failed.
Not "went okay" — failed, visibly, in front of the class.

You are writing the explanation of why.

Write in the past tense, as fact.
This is not a hedge-your-bets risk survey.
Asserting the failure is what makes the honest answers come out, and that is the whole reason the technique works.

## My list

Four minutes.
At least five causes.
Include the uncomfortable one.
In class you wrote three in four minutes, about yourself; this one is about the project, and you have longer.

| # | What happened (past tense, specific) | When it started | Why nobody stopped it |
|---|---|---|---|
| 1 | [이용자 친화성] 의뢰인들의 디지털 친화성이 예상보다 낮아, 수임 전부터 직원이 가입과 자료 제출을 일일이 도와야 했다. | 개발 전, 이용자 특성을 검토할 때부터. | 기능 구현에 집중했고, 실제 의뢰인이 도움 없이 사용할 수 있는지는 충분히 확인하지 않았다. |
| 2 | [품질 측면] 다양한 기능을 추가했지만 의뢰인들은 핵심 기능만 사용했고, 쓰이지 않는 기능을 개발하고 수정하느라 시간이 낭비됐다. | 개발 범위를 정할 때부터. 2026년 11월 개발 완료 시점에 문제가 드러났다. | 팀원들의 요구를 취사선택하고 개발 범위를 정할 리더십이 부족했다. |
| 3 | [AI의 윤리적 측면] 가족 명의 통장 사용이나 부적절한 지출처럼 소명이 까다로운 사례에서, AI가 적절한 설명을 만들지 못하거나 요청을 거부해 사람이 다시 처리해야 했다. | 개발 이후, 실제 사례를 넣어 검증할 때. | 불리한 사실을 소명하는 일과 사실과 다른 사유를 만드는 요청을 구분하지 않은 채, 기존 처리 방식까지 AI가 재현할 수 있다고 생각했다. |
| 4 | [호환 측면] 새로운 애플리케이션을 만들었지만 기존 도구와 연동되지 않아, 같은 자료를 두 번 입력하는 비효율이 생겼다. | 개발 이후, 기존 업무에 연결할 때. | 새 기능을 만드는 데 집중했고, 기존 도구와의 연동 방식이나 업무 변화에 대한 검토는 미뤘다. |
| 5 | [팀 내 역할] 내가 법률 검토에 충분히 참여하지 못해, 뒤늦게 발견한 문제를 고치느라 개발 일정이 밀렸다. | 역할을 나누면서 검토 시간을 정하지 않았을 때부터. | 나는 본업과 병행하면서 필요할 때 검토하면 된다고 생각했고, 팀도 내 확인을 기다리는 작업의 기한을 정하지 않았다. |

Three rules:

- **Past tense, specific.** "We never got one user outside our own team", not "user acquisition may be difficult".
- **Not generic.** "Scope creep" and "the team got busy" are true of every failed project ever, so they carry no information. What specifically crept? Who specifically got busy, in which week, because of what?
- **At least two causes involve the people in this team, and at least one of those is about you.** Skill gaps, who actually understands the code the AI wrote, who has a product launch at work in November, who says "sure" in meetings and disappears. If your list is all technical, it is a safe list, not an honest one.