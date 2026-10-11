# Premortem — [배지열]

Team: [9 and 빚오프]
Written on: [2026-10-02]
I wrote this before reading anyone else's list: [yes / no]

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
| 1 |교수님과 면담 이후 분위기가 무거워졌다. 프로젝트 주제가 적합하지 않다는 이야기를 들었고, 우리는 2:2로 의견이 갈렸다. |푸른님과 나는 현재 주제를 유지하되 조금 수정하자는 의견이 였고, 태훈님과 대성님은 아예 새로운 주제 선정해서 다시 시작하자고 하였다. | 이로 인해 우리는 주제 선정을 위해 다시 토론을 하였으며, 2주간의 시간을 낭비하여 최종과제 제출 전에 완결성이 부족한 결과물을 내게 되었다. |
| 2 | 토론 이후 우리는 주제를 바꾸기로 하였으나, 도메인 전문가가 없는 아이디어를 채택하고 말았다. 쓰임새와 아이디어 자체는 훌륭했으나, AI가 도출한 결과물에 대한 신뢰도가 매우 낮은 상태였다. | MVP를 만들었으나 제출 1주일 전까지 워크플로우와 프롬프트를 반복 수정하였음에도 AI agent 의 판단은 나아지지 않았다. | 조원 모두는 제출 마지막 주에 AI가 도출한 결과가 멋지게 보이게 하도록 푸른님이 결과물을 조작하는 것을 합의하였다. |
| 3 | 나는 태훈님과 대성님의 AI 를 활용한 스킬을 보고 놀라고 말았다. 바이브코딩과 AI 워크플로우를 순식간에 만드는 것을 보았고, 두명에게 의존하게 되었다. | MVP 플랫폼 구축 이후 진입 장벽을 쌓는 아이디어와 기획이라도 했어야 했지만, 팀작업물에서 생각한 결과물이 내 생각과 조금 다르자 아이디저 제시하는 것 조차 포기하였다. | 다들 생업이 바쁘고 내가 나이가 가장 많은 형이라서 딱히 클레임을 걸지 않았다. |
| 4 | 10월말 완성된 AI 에이전트를 연계한 빚오프 플랫폼은 업무 검토를 완료하는데 까지 걸리는 시간이 AI 도움이 없을때보다 1/5 수준으로 줄어들었다. 즉, 기존보다 5배 넘는 고객을 유치할 수 있는 capa는 확보되었다. | 그러나, 내가 맡은 법원 입장에서 검토하고 보정을 요구하는 AI API 부분에서 보정 요청율이 너무 높았다. 처음에 보수적인 입장을 견지하도록 설계를 하였는데 이것이 문제였다. 과거에 회생에 성공했던 사례를 넣어도 보정요구가 계속 나왔다. 이미 AI 에이전트는 보수적인 입장을 학습해 바꿀수 없었다.  | 보정 요구는 참조만 하는 flow로 가져 가는 것이고 최종 판단은 사람이하는 것이였으나, AI 에이전트의 판단 완성도 측면에서 낙제점을 받았다.|
| 5 | 11월말 갑자기 실시간 동적 질문 부분에서 이상한 질문이 나오기 시작했다. | MVP 사용이 거듭되면서 이상한 서류를 제출한 내용이 과정중에 학습된 것으로 판단되는데 원인을 정확히 규명할 수가 없었다. | 결국 동적 질문 검토 에이전트를 GPT에서 클로드로 바꾸게 되었는데 이는 최종 결과물에 영향을 미쳤다. 다시 처음부터 설계하기엔 시간이 없었다. | 

Three rules:

- **Past tense, specific.** "We never got one user outside our own team", not "user acquisition may be difficult".
- **Not generic.** "Scope creep" and "the team got busy" are true of every failed project ever, so they carry no information. What specifically crept? Who specifically got busy, in which week, because of what?
- **At least two causes involve the people in this team, and at least one of those is about you.** Skill gaps, who actually understands the code the AI wrote, who has a product launch at work in November, who says "sure" in meetings and disappears. If your list is all technical, it is a safe list, not an honest one.