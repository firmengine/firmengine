# Premortem — [your name]

Team: [9, Firm Engine]
Written on: [2026-10-03]
I wrote this before reading anyone else's list: [yes]

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
| 1 | [품질 측면] 가장 중요한 법원 제출문서 생성 초안에 있어, 사건을 분석 후 제대로 필요 서류 정리를 하지 못했거나(정보 미흡) 필요한 서류를 제출했어도 승인으로 이어질 수 없는 문서를 생성하였거나, 실제 직원 혹은 변호사가 해당 문서를 수정하는데에 목표 수준 이상의 시간이 소요되는 경우가 발생하였을 때| 2026. 11 (Demo day 전 개발 완료 시점) | 제품 개발 과정 중 시연/검증/보완절차 미흡(시간적 여유, 참여도 문제), 기술 도입 한계 |
| 2 | [품질 측면] 초기 목표안 대비 타 서비스와의 차별점을 두기 위해 추가 서브 요소들을 고안하였으나, 해당 서브 요소들이 완성도 있게 동작하지 않거나 핵심 기능과 조화롭지 못하게 구성될 경우. 즉, 사용자 관점에서 활용성을 증대시키는 것이 아니라 감소시키는 방향으로 서브 요소들이 동작하는 경우.| 2026. 11 (Demo day 전 개발 완료 시점) | 제품 개발 과정 중 UX 요소에 대한 검증/보완절차 미흡(시간적 여유, 참여도 문제) |
| 3 | [품질 측면] 품질 확보를 위해 실제 사례 및 학습 데이터가 필요한 경우가 발생할 수 있으나, 충분힌 학습용 데이터나 검증용 사례를 확보하기 어려운 경우. 예를 들어 상황은 동일하더라도 취할 수 있는 전략이 다양하고, 실제 승인 사례를 바탕으로 승인 가능한 전략을 지속적으로 추론하도록 Rule 주입이 필요한데, 분석 가능한 실 사례 수가 적어 모델에 반영하기 어려울 경우 | 2026. 10 | 실제 고객정보 취급과 관련되어있어 모든 사례를 알기는 어려울 수 있으며 공개 사례의 수가 적은 경우, 제품 개발 과정 중 데이터 수집 절차 미흡 |
| 4 | [품질 측면] 3과 유사하나, 검증 단계에 초점. 가장 좋은 평가 방법은 실제 도입 효과를 확인하는 것이나, 많은 건수의 실사례를 확보하며 피드백 루프로 인한 품질 상승 등의 평가는 어려울 수 있다고 생각. 실사용을 통해 많은 승인/반려 사례를 취득하고 여기에 맞게 자연스럽게 진화해나가는 구조를 Best로 생각하고 있으나, 초기에는 품질 상승을 위한 과거 데이터를 기반으로 제작된 다량의 간이 Test set을 필요로 할 수 있고 데이터 수량 측면의 문제가 검증 관점에서도 발생할 수 있음 | 2026. 10 | 데이터 부족을 고려한 합리적인 검증/성능강화 방안을 모색하지 못했기 때문에 |

Three rules:

- **Past tense, specific.** "We never got one user outside our own team", not "user acquisition may be difficult".
- **Not generic.** "Scope creep" and "the team got busy" are true of every failed project ever, so they carry no information. What specifically crept? Who specifically got busy, in which week, because of what?
- **At least two causes involve the people in this team, and at least one of those is about you.** Skill gaps, who actually understands the code the AI wrote, who has a product launch at work in November, who says "sure" in meetings and disappears. If your list is all technical, it is a safe list, not an honest one.