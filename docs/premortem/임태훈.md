# Premortem — \[임태훈]

Team: \[9, 임태훈]
Written on: \[20206-10-04]
I wrote this before reading anyone else's list: \[yes / ***no***] ***다른 사람의 것을 읽어보면 안된다는 instruction을 사전에 읽고 숙지하지 못했습니다. 죄송합니다.***

Copy this file, rename it after yourself (for example `gildong.md`), and fill it in alone.
Do this before your team meets to merge, and do not read anyone else's list first.
Write your own list before you ask any artificial intelligence (AI).
An AI list anchors you the same way a teammate's would, and an AI does not know your team, so it can only give you the list every team would get.

Write in Korean or English, whichever you think in.
Keep the headings exactly as they are.

\---

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

|#|What happened (past tense, specific)|When it started|Why nobody stopped it|
|-|-|-|-|
|1| 사전 기획한 것 대비 1/3 수준의 단순 기본 기능만을 시연하고 발표가 짧게 끝났다. 교수님, TA, PEER review 및 오픈 코멘트에서 단순 API 기능 호출 정도로 구현되어, Timely 하지 못하고 단조롭다는 평, 그냥 GPT나 CLAUDE Enterprise를 쓰면되지 않겠냐는 평을 많이 받았다. | 11월 중순 개발 진척 팀회의를 하며 정해진 스케쥴안에 합의된 스펙안에서도 개발은 빡빡히 진행될 것으로 보였다. 하지만, 배지열님과 양대성님의 열정과 추진으로 업그레이드 및 차별화 요소를 계속 추가 기획 논의하며, 시도를 계속하게 되었다. 결국 여러가지 시도와 성능 검증은 많이 했지만, 기존 계획서상의 기능 구현 및 검증에도 시간과 인력 Resource가 충분히 집중되지 못했다.| 일부 우려 내지 조정 제안/의견은 있었으나, 과반 이상의 의견과 의향인 바, 별도로 진행할 수 밖에 없었다.|
|2| 데모시연한 서비스 관련, 교수님과 Peer Question에 일관된 답을 내지 못하고 혼선된 답변을 하며 아쉬움을 나겼다.| 9월 말부터 임태훈은 Opertor 역할을 하며 선제적으로 신속하게 카톡방에서 팀논의를 이끌며 정리하였으나, 팀원들과 충분한 구두 논의, 설명 및 일치를 검토하는 시간을 갖지 못했다. |홍푸른님의 경우, 실제 필드 관점에 집중, 배지열님은 신사업 비즈니스 경험과 이론 관점, 양대성님은 테크 관점에 집중하다보니 전체적인 이해를 Thorough 하게 컨센서스 하는데는 시간과 제약상 한계가 따랐다.|
|3|상담과정 Agent 위한 카카오톡 API, 통화 API 중 기술적으로 예측하지 못한 제약과 이슈가 있어, 에매한 상태로 개발 완료되어 시연하여 질문되었다.|10월 중순 유용한 기능이라 생각되어 초기 SPEC에 인풋확정되었으나, 구축해나가보니 API 제약 및 해당 플랫폼 보안 장벽등 넘어설수 없음을 발견하여ㅆ다.|이에 대해 정확히 아는 팀원이 아무도 없었다.|
|4|발표 데모를 시연하다가 기본적인 LLM API 호출에서 에러가 발생하였다.|10월부터 여러가지 논의와 회의 추가기획으로 인해, 마지막 까지 개발 수정이 일어나 데모에 대한 안정적인 검증을 할 시간적 여유가 없었다.| 일부 우려 내지 조정 제안/의견은 있었으나, 조원간 합치가 쉽게 되지 않아 조원 각자의 진행방향이 합치되지 못하고, 각자의 대안을 마련하는데 시간이 소요되어 개발이 오래 걸렸다.|
|5|발표/시연자가 본인이 집중하거나 중요하다여기는 내용 중심으로 발표하여, 발표시간 제약으로 인해 나머지 부분을 충분히 설명/시연하지 못했다|10월부터 여러차례의 회의에도 불구, 서비스에서 중요하거나 가치 있는 것에 대한 규정 및 컨센서스가 이뤄지지 않아 개인별로 중시하는 가치나 방점이 달랐다.|회의 내지 수렴 과정상 공감 내지 이해했다는 의견은 보이나, 개인별 차이로 합치 및 동의에 이르진 못했다.|

Three rules:

* **Past tense, specific.** "We never got one user outside our own team", not "user acquisition may be difficult".
* **Not generic.** "Scope creep" and "the team got busy" are true of every failed project ever, so they carry no information. What specifically crept? Who specifically got busy, in which week, because of what?
* **At least two causes involve the people in this team, and at least one of those is about you.** Skill gaps, who actually understands the code the AI wrote, who has a product launch at work in November, who says "sure" in meetings and disappears. If your list is all technical, it is a safe list, not an honest one.

