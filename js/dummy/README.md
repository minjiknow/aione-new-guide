# 퍼블리싱 화면 확인용 더미 가이드

`js/dummy`는 퍼블리싱 작업 중 서버 없이 화면과 UI 동작을 확인하기 위해 추가한 폴더입니다. 실제 서비스 데이터나 백엔드 구현을 대신하는 코드가 아닙니다. 개발 전달 시 확인용으로 함께 보관해도 되며, 파일 삭제 없이 실제 API 모드로 전환할 수 있습니다.

## 파일 역할

| 파일 | 역할 |
| --- | --- |
| `preview-config.js` | 더미/실제 API 모드를 선택합니다. |
| `dummy-data.js` | 이력, 질의, 관련자료, 답변서 등 화면 확인용 예시 값을 관리합니다. |
| `dummy-work-support-data.js` | 업무지원 전용 작업 목록·본문·첨부·검색·참조자료·보고서·생성결과를 `workSupport`에서 독립 관리합니다. |
| `dummy-api.js` | 더미 모드에서 API 요청에 예시 응답을 제공합니다. 챗봇의 참고 파일은 로컬 예시 PDF를, 답변서 작업 화면의 기존 문서는 PDF 없음(204)을 반환합니다. |
| `vendor/pdfjs/` | 챗봇 미리보기용 PDF.js 5.6.205와 worker입니다. Apache License 2.0 원문을 `LICENSE`에 포함합니다. |
| `../../assets/dummy/chat/` | 챗봇 참고 파일 목록에 연결할 예시 PDF 3개를 보관합니다. |

HTML에는 데이터 표시 영역과 기존 템플릿을 두고, 목록과 본문은 기존 페이지 JS의 렌더러로 표시합니다. `ai-answer.html`에서 PDF가 없으면 기존 `answerDocumentPreviewTemplate`의 빈 canvas를 표시합니다. 회색 테두리, 모서리와 패딩은 `panel.css`의 `.answer-pdf-page`를 그대로 사용하며, 빈 페이지의 크기를 JS로 계산하지 않습니다. `chatbot.html`의 참고 파일은 기존 `chat.js`의 오른쪽 미리보기에서 로컬 예시 PDF를 표시합니다. 더미에서 문서 DOM이나 이벤트를 별도로 만들지 않습니다.

## 화면 확인 및 실제 API 전환

### 261015 HTML 중복 예시 정리

- 홈의 최근·전체 이력 행은 HTML에 두지 않고 기존 `ai-home.js` 렌더러가 응답으로 표시합니다.
- 답변서 제목·버전·비교 문서와 추천/채팅 건수는 빈 영역 또는 기본값만 두고 기존 답변서 렌더러가 갱신합니다.
- 질의분류 파일명·질의 건수·글자 수·필터 건수는 빈 상태로 시작하고 기존 분류 렌더러가 갱신합니다.
- 공통 예시는 `dummy-data.js`, 업무지원 예시는 `dummy-work-support-data.js`에서 독립 관리합니다. 화면 DOM은 기존 렌더러에서 생성합니다.

### 모드 선택

- `?preview=1`: 더미 데이터로 확인합니다. 예: `html/ai-answer.html?preview=1`
- `?preview=0`: 기존 URL과 요청 옵션으로 실제 API를 호출합니다. 개발 서버에서 연동 확인 시 사용합니다.
- URL에 다른 쿼리가 있으면 `&preview=0` 또는 `&preview=1`을 추가합니다.
- 선택값은 같은 탭의 `sessionStorage`에 유지되므로, 다른 페이지로 이동해도 적용됩니다. 모드를 바꾸려면 쿼리 값을 명시합니다.
- 별도 선택이 없으면 파일 직접 열기와 localhost/127.0.0.1/[::1], `*.vercel.app`에서는 더미 모드, 그 외 호스트에서는 실제 API 모드입니다. 로컬 개발 서버와 Vercel에서도 실제 API를 확인할 때는 `preview=0`을 지정해야 합니다. 이전에 실제 API 모드를 선택한 탭에서는 `preview=1`로 다시 전환합니다.

공통 더미 스크립트의 기본 로딩 순서는 다음과 같습니다. 업무지원은 아래 전용 파일을 추가합니다. 이후 기존 공통/페이지 스크립트가 실행됩니다.

```html
<script src="../js/dummy/preview-config.js"></script>
<script src="../js/dummy/dummy-data.js" defer></script>
<script src="../js/dummy/dummy-api.js" defer></script>
```

더미 파일을 보관한 채 `preview=0`으로 전환해도 됩니다. 배포본에서 미리보기 기능을 제외하려면 위 스크립트 연결 세 개를 제거합니다. 폴더만 삭제하고 HTML 연결을 남기면 파일 로딩 오류가 발생합니다. 연결을 모두 제거한 경우 기존 페이지 요청은 `window.fetch`로 처리됩니다.

### 로그인 화면 확인

로컬 미리보기의 `html/login.html`에서는 아이디와 비밀번호를 입력하면 `home.html?preview=1`로 이동합니다. 화면 이동 확인용이며 실제 인증은 하지 않습니다. 홈·답변서·질의분류·챗봇의 계정 메뉴에서 로그아웃을 확인하면 `login.html`로 돌아옵니다. `preview=0`에서 로그인 버튼을 누르면 실제 인증을 진행할 서버 로그인 화면으로 이동합니다.

## 더미 연결 방식 및 기존 코드 변경 범위

기존 페이지 JS는 원래 `fetch()`와 렌더러를 사용합니다. 더미 모드에서는 `dummy-api.js`가 `window.fetch`를 교체하여 같은 출처의 `ND_*.do` 요청에 예시 응답을 제공합니다. 그 외 요청은 원래 fetch로 전달하며, 실제 API 모드에서는 fetch를 교체하지 않습니다. 첨부 목록 API를 호출하지 않는 새 채팅은 `resetWorkspace()`에서 미리보기 여부를 확인하여 `answer.conversationFiles` 예시만 복사하고 기존 렌더러로 표시합니다.

`ND_reportSourcePreview.do`는 `chat.sourceDocuments`에 등록된 챗봇 예시 문서 ID를 받으면 해당 로컬 PDF를 반환합니다. 답변서 작업 화면에서 사용하는 기존 문서 ID는 종전처럼 PDF 없음(204)으로 응답하고 기존 템플릿의 빈 canvas를 표시합니다. 챗봇의 로컬 PDF.js 경로 설정은 `preview=1`에서만 적용합니다. `preview=0`에서는 서버의 PDF 응답과 기존 PDF.js 배포 경로를 사용합니다. `chat.js`의 로더는 기존 `.js`와 모듈형 `.mjs`를 모두 지원하며, 새 창 버튼은 받아 둔 PDF의 Blob 주소를 사용합니다.

API 위치 안내 주석은 유지했습니다. 원본과의 다른 기존 퍼블리싱 수정 사항까지 되돌린 것은 아니므로, 개발자 원본과 모든 JS가 동일하다는 의미는 아닙니다. 문서 미리보기는 실제 PDF와 더미 canvas가 panel.css의 공통 페이지 스타일을 사용합니다.

## 기존 API 위치 참고 — 수정 대상 목록 아님

아래는 기존 API 호출 위치를 찾기 위한 참고 목록입니다. **더미 화면 확인이나 모드 전환을 위해 아래 개발자 JS를 수정할 필요는 없습니다.** 예시 데이터와 미리보기 처리는 `js/dummy` 안에서 관리하고, 실제 API 확인은 `preview=0`으로 전환합니다. 아래 경로는 이 가이드가 있는 `js/dummy` 폴더 기준입니다.

- 홈 이력: `../ai-home.js`
- 답변서 대화/이력: `../panel-conversation.js`
- 답변서 조회/저장: `../draft-report.js`
- 답변서 첨부/자료 미리보기: `../panel-source.js`
- 질의분류 요청 공통: `../classification.js`의 `fetchJson()`
- 질의분류 세부 요청: `../classification-conversation.js`, `../classification-file.js`, `../classification-query.js` 등
- 챗봇: `../chat.js`

각 JS의 `[API 연동]`, `[API 공통]`과 HTML의 `[API 연결 위치]`는 호출 위치를 설명하는 주석이며, 코드 수정을 지시하는 내용이 아닙니다. 실제 API 호출 코드는 기존 파일에 유지되어 있습니다.

기존 `draft-static.js`, `classification-static.js`는 별도 미리보기 화면 처리가 중복되어 제거했습니다.

## 더미 확인 범위

### 답변서 패널 드래그앤드롭

더미·실제 API 모드 모두 기존 `draft.js` / `work-support.js` → `panel.js` → `panel-workspace.js` → `common.js` 경로로 패널 드래그를 초기화합니다. `dummy-api.js`에는 패널 초기화나 배치 보정 코드가 없습니다. 패널 헤더를 다른 패널로 드래그하면 위치를 교환하며 각 패널의 현재 폭도 함께 이동합니다.

HTML의 기본 배치는 참조소스 364px, 채팅 400px이며, 가운데 패널은 `minmax(0, 1fr)`로 남는 폭을 채웁니다. 기존 폭 배율 설정은 1로 바꿔 참조소스를 추가 확대하지 않습니다. 2560px 등 넓은 화면에서도 기존 레이아웃 계산과 리사이즈 처리가 화면 폭을 채웁니다.

HTML에 미리 들어 있던 `data-answer-panel-drag-ready="true"`는 제거했습니다. 초기화 완료 표시는 기존 스크립트가 이벤트 연결 후 설정합니다. 배치 저장·복원·초기화도 기존 기능을 그대로 사용합니다. 확대 폭이 저장된 이전 쿠키(v4)는 사용하지 않으며 새 배치는 v5 쿠키에 저장합니다. 접힌 참조소스를 이동한 뒤 펼칠 때 복원할 폭도 이동한 순서에 맞춰 갱신합니다. 공통 스크립트와 API·데이터 바인딩 계약은 변경하지 않았습니다.

### 참조소스 파일목록의 dot과 분류

`dummy-data.js`의 `answer.fileUpload`에서 사용자가 업로드한 파일의 표시 값을 관리합니다. 실제 선택한 파일에 설정값을 적용합니다.

`answer.conversationFiles`에는 PDF·HWPX 업로드 이력 예시 2건을 둡니다. 미리보기에서는 기존 더미 대화와 새 채팅 모두 같은 예시를 기존 참조소스 목록으로 표시합니다. 새 채팅의 예시는 선택 전까지 전송할 첨부파일에 포함되지 않습니다. 실제 연동 모드의 새 채팅에는 예시를 넣지 않으며, 자료가 없어도 목록 영역과 0건 표시는 유지합니다. 목록·선택 확인용 메타데이터이며 실제 파일 원본은 없습니다. 변경 상태는 현재 페이지에서 유지되고 새로고침하거나 새 채팅을 시작하면 예시가 복원됩니다.

- `default`: 기본 dot 파일 타입, 분류(`category`), 출처(`source_kind`).
- `extensions`: 확장자별 dot 파일 타입. 색상은 `common.css`의 `.file-icon.pdf`, `.file-icon.hwp`, `.file-icon.docx`, `.file-icon.txt`, `.file-icon.xls`, `.file-icon.img` 규칙을 그대로 사용합니다.
- `files`: 파일명별 설정. 확장자 설정보다 우선하며 `dot`에는 `pdf`, `hwp`, `docx`, `txt`, `xls`, `img` 중 하나를 넣습니다. 잘못된 값이거나 값이 없으면 파일 확장자의 타입을 사용합니다.
- `category`: 아코디언을 접었을 때 표시할 분류명. 값이 없으면 `업로드 파일`로 묶습니다.
- `source_kind`: `search`는 검색 건수, 그 외 값은 업로드 건수에 포함됩니다. 파일명별 검색 출처 설정은 첨부 이미지의 화면을 확인하기 위한 예시입니다.

예를 들어 `files`에 `"검토자료.pdf": { "dot": "hwp", "category": "법령·제도" }`를 추가하면 해당 파일을 업로드했을 때 공통 HWP 색상인 파랑과 지정한 분류로 표시됩니다. dot은 `file-icon file-dot hwp`처럼 기존 클래스를 조합하며, 크기와 원형 모양도 공통 `.file-dot`을 사용합니다. 기존 파일 선택, 반영 및 패널 접기 기능은 같은 파일행을 사용합니다. 파일목록은 기본으로 펼쳐지고, `.source-accordion`으로 접으면 실제 파일 수를 기준으로 분류별 건수가 표시됩니다.

화면에서 변경한 예시 데이터는 현재 페이지 메모리에만 유지되며 새로고침 또는 페이지 이동 시 초기화됩니다. 답변서 작업 화면의 여러 이력은 공통 예시 문서와 빈 canvas를 사용합니다. 챗봇은 이력별 질문·답변과 로컬 참고 PDF를 사용하지만, 채팅 응답과 분류 결과는 실제 AI 생성 결과가 아닙니다. 실제 서버 연동, 실제 문서 내용 및 서버 파일 다운로드는 개발 환경에서 별도로 확인해야 합니다. `tmp`는 테스트 스크립트·캡처·백업 보관용이며 개발 전달이나 배포 대상에서 제외할 수 있습니다.


### 최신 챗봇 기능

`chatbot.html`은 `chat.js`의 실제 API 호출과 렌더링을 사용합니다. `preview=1`일 때만 프로젝트 목록·생성·수정·삭제, 지침·파일, 대화 이름 변경·고정·삭제·이동 및 내부자료 검색을 `dummy-api.js`가 대신 응답합니다. 예시 프로젝트와 검색 자료는 `dummy-data.js`의 `chat.projects`, `chat.searchItems`에서 관리합니다. 변경값은 새로고침하면 초기화됩니다.

프로젝트 예시는 `추가`, `테스트`, `검토` 3개입니다. `추가` 아래의 `목업기준? 개발기준?` 대화는 `chat.conversations[].project_id`로 연결하고, 본문은 `chat.scenarios`에서 관리합니다. 프로젝트 이름을 누르면 하위 대화를 접거나 펼치고, 오른쪽 `⋮` 버튼을 누르면 기존 `세부사항 수정`·`삭제` 팝업이 열립니다. 수정하면 목록에 즉시 반영되며, 삭제는 확인 창을 거친 뒤 처리하고 소속 대화는 일반 채팅 목록으로 이동합니다.

국회답변서 생성은 챗봇 안에서 `report_generator` 에이전트로 전송합니다. 미리보기 응답은 예시 문구이며 실제 생성 품질이나 서버 권한을 검증하지 않습니다. `preview=0`에서는 더미 처리를 실행하지 않습니다.

### 261016 챗봇 이력·참고 파일·오른쪽 PDF 미리보기

작업 폴더를 루트로 정적 HTTP 서버를 8765 포트에서 실행한 뒤 [챗봇 미리보기](http://127.0.0.1:8765/html/chatbot.html?preview=1)를 엽니다. 백엔드 서버는 필요하지 않습니다. 로컬 PDF와 JavaScript 모듈을 불러오므로 파일 직접 열기보다 HTTP 주소를 사용합니다.

아래 값은 `dummy-data.js`의 `chat`에서 수정합니다.

| 위치 | 편집 내용과 연결 규칙 |
| --- | --- |
| `conversations` | 목록의 `id`, `display_title`, `agent`, `is_favorite`, `created_at`입니다. `agent: "report_generator"`이면 기존 답변서 배지와 안내문을 사용하고, `"chat"`이면 일반 대화로 표시합니다. |
| `scenarios[대화 ID]` | 해당 이력의 `question`, `answer`, `source_ids`를 관리합니다. `source_ids`는 아래 문서의 `doc_id`를 순서대로 참조합니다. 일반 대화는 생략할 수 있습니다. |
| `sourceDocuments` | 참고 파일의 `doc_id`, `title`, `score`, `member_name`, `party`, `answerer`, `answerer_org`를 관리합니다. `score`는 `52.6`처럼 백분율 값입니다. |
| `sourceDocuments[].preview_file` | `assets/dummy/chat/` 기준 PDF 파일명입니다. 표시용 HWP 제목과 실제 PDF 미리보기 파일을 연결합니다. 이 필드는 화면 확인용이며 API의 `action.sources`에는 포함하지 않습니다. |

`dummy-api.js`의 `seedConversation()`은 이력별 예시를 기존 `role/content/metadata` 메시지 형식으로 구성합니다. 사용자 메시지의 `metadata.prompt_type_option`에는 대화의 `agent`를 넣습니다. `chatReply()`는 답변의 `metadata.action`에 `kind: "report"`, 안내문과 참고 파일 목록을 넣어 기존 파일 카드 렌더러에 전달합니다. 기본 표시는 최대 3건이며 전체 건수는 전달한 목록 길이를 따릅니다.

기존 이력에서 추가 질문을 보내면 해당 시나리오의 예시 답변을 다시 반환합니다. 새 답변서 대화는 예산집행 시나리오를 사용하고, 새 일반 대화는 `messages.chat`의 예시 문구를 사용합니다. `ND_send.do`가 반환한 질문·답변·메타데이터는 현재 페이지 메모리에 저장하므로 다른 이력에 갔다 돌아와도 유지됩니다. 새로고침하면 초기 예시로 돌아갑니다.

수동 확인 순서는 다음과 같습니다.

1. 답변서 배지 옆 제목을 눌러 기존 안내문·질문·답변·참고 파일 목록을 확인합니다.
2. 참고 파일을 눌러 오른쪽 PDF, 파일 선택 표시, 확대·축소, 새 창, 내려받기와 닫기를 확인합니다. 화면 너비가 1100px 이하이면 기존 CSS에 따라 미리보기를 전체 화면으로 표시합니다.
3. 일반 대화를 열어 답변서 안내문과 참고 파일이 붙지 않는지 확인합니다.
4. 추가 질문을 보낸 뒤 다른 이력으로 이동했다 돌아와 질문·답변과 참고 파일이 유지되는지 확인합니다.

예시 PDF는 화면 확인용 자료입니다. 실제 HWP 변환이나 서버 문서 조회를 수행하지 않습니다. PDF.js 5.6.205 배포 파일과 worker는 `js/dummy/vendor/pdfjs/`에 함께 보관하며, 라이선스는 같은 폴더의 `LICENSE`를 따릅니다.

## 업무지원 더미데이터 분리 (261021)

work-support.html은 dummy-data.js → dummy-work-support-data.js → dummy-api.js 순서로 로드합니다. 업무지원 예시를 수정할 때는 dummy-work-support-data.js의 workSupport만 수정합니다. answer 객체를 복사하거나 참조하는 런타임 코드는 없습니다. 업무지원 작업명과 자료는 업무계획·회의록·예산 집행·일정·업무분장 예시로 교체했습니다. 답변서 데이터와 수정 내용이 서로 반영되지 않습니다.

- conversations / messages: 작업 목록과 저장된 대화 본문
- conversationFiles / fileUpload: 기존 첨부와 업로드 표시 설정
- sourceSearch / sources / references: 자료 검색·가져오기와 답변 참조자료
- report / reportVersions: 기존 보고서 API 계약용 예시
- responses.question / welcome / answer / search: 초기 질문·안내·요약·검색 응답
- results / generation / resultsDelay: 생성결과 목록·생성 설정·조회 지연

업무지원 HTML에는 preview-config.js를 포함한 더미 스크립트가 총 4개 있습니다. 실제 API 확인은 ?preview=0을 사용하며, 배포본에서 더미를 제외할 때는 이 연결 4개를 함께 제거합니다.

작업 목록은 공통 renderChatItems에 showIcon: false를 전달해 채팅 아이콘 없이 표시합니다. 작업 이름 변경 메뉴·모달·작업이름 입력 안내는 work-support.html에서, 저장·실패 알림은 panel-conversation.js에서 관리합니다. 검색 결과 전체 보기 버튼은 공통 data-tooltip을 사용해 아래 방향으로 툴팁을 표시합니다.

실제 API 주소와 공통 렌더러는 유지합니다. 더미 API는 업무지원 페이지에서 workSupport 저장소를 선택하며, 새 작업의 첨부 초기화도 같은 저장소를 사용합니다. 응답의 answer/search는 편집하기 쉬운 객체로 보관하고 렌더러/SSE에 전달할 때 JSON 문자열로 변환합니다.
