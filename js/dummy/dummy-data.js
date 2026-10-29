/**
 * [더미 데이터] 서버 없이 화면을 확인할 때 사용하는 예시 값.
 * 화면 생성/이벤트 코드는 포함하지 않습니다. 원본 페이지 렌더러가 이 데이터를 표시합니다.
 * 예시는 기존 HTML에서 옮겼으며, 변경 내용은 새로고침하면 초기화됩니다.
 * 각 이력의 상세 예시는 같은 기본 문서/답변서를 사용합니다.
 * 261015 수정 - HTML의 중복 예시 행·문서·버전·집계 값을 제거했습니다.
 * 홈 메뉴별 이력은 home.history, 비교 문서는 answer.sources/report/reportVersions,
 * 질의분류 파일·건수는 classification.document/questions를 기존 렌더러가 표시·계산합니다.
 *
 * 공통 기본형은 common.css, 페이지 전용 보정은 각 페이지 CSS에 작성합니다.
 * 변경 내용 · 관련 데이터
 * [파일업로드] answer.fileUpload
 * [업로드 이력 예시] answer.conversationFiles
 * [검색결과] answer.sourceSearch

 * [261021 변경 내용 · 관련 데이터]
 * [업무지원] dummy-work-support-data.js의 workSupport에서 별도 관리합니다.
 *
 * 기본 구간 형식: Start: 기능명 / End: 기능명
 * 변경 구간 형식: Start: YYMMDD 추가/수정 - 기능명 / End: YYMMDD 추가/수정 - 기능명
 * 주석 정리 내역
 * - 261023 주석 정리 - 구간 표시와 변경 내용 표기를 통일합니다. 기존 작업 날짜와 기능 설명은 유지합니다.
 */
// 가이드는 같은 예시 값을 직접 읽으며 API 가로채기는 사용하지 않습니다.
if (window.AIOnePreview?.enabled || document.body?.dataset.page === "common-ui-guide") window.AIOneDummyData = {
  // 홈 테이블에 서비스 메뉴 6종을 한 행씩 표시하며 각 서비스 페이지로 이동합니다.
  "home": {
    "history": [
      {
        "id": "fd851dc2-cfee-4984-abb1-50ed1493bf17", "agentId": "inquiry",
        "serviceName": "질의분류", "title": "김승수 의원실 남태령역 시위 관련 질의 분류",
        "typeText": "질의분류", "badgeClass": "search", "icon": "nav-classification",
        "target": "classifcation.html", "status": { "text": "완료", "css": "done" },
        "createdAt": "2026-10-16T09:00:00+09:00", "updatedAt": "2026-10-16T10:00:00+09:00"
      },
      {
        "id": "c58c70da-8ac3-4460-9564-7bd265c6119b", "agentId": "report_generator",
        "serviceName": "답변서 초안 생성", "title": "기재부 특화 데이터플랫폼·생성형 AI 답변서 초안",
        "typeText": "답변서", "badgeClass": "ai", "icon": "nav-answer",
        "target": "ai-answer.html", "status": { "text": "완료", "css": "done" },
        "createdAt": "2026-10-16T08:50:00+09:00", "updatedAt": "2026-10-16T09:50:00+09:00"
      },
      {
        "id": "dummy-home-sale", "agentId": "asset",
        "serviceName": "매각표준검토서 검증", "title": "국유재산 매각표준검토서 필수 항목 검증",
        "typeText": "국유재산", "badgeClass": "search", "icon": "nav-sale",
        "target": "sale-review.html", "status": { "text": "완료", "css": "done" },
        "createdAt": "2026-10-16T08:40:00+09:00", "updatedAt": "2026-10-16T09:40:00+09:00"
      },
      {
        "id": "dummy-home-policy", "agentId": "policy-verify",
        "serviceName": "정책변경보고서 검증", "title": "재정지원 정책변경보고서 변경 사항 검증",
        "typeText": "정책안내", "badgeClass": "search", "icon": "nav-policy",
        "target": "policy.html", "status": { "text": "완료", "css": "done" },
        "createdAt": "2026-10-16T08:30:00+09:00", "updatedAt": "2026-10-16T09:30:00+09:00"
      },
      {
        "id": "dummy-home-search", "agentId": "searchwrite",
        "serviceName": "내부자료 검색", "title": "지방채 인수 제도 및 예산 현황 자료 검색",
        "typeText": "내부자료", "badgeClass": "search", "icon": "nav-search",
        "target": "work-support.html", "status": { "text": "완료", "css": "done" },
        "createdAt": "2026-10-16T08:20:00+09:00", "updatedAt": "2026-10-16T09:20:00+09:00"
      },
      {
        "id": "dummy-chat-budget-execution", "agentId": "chat",
        "serviceName": "챗봇", "title": "예산집행",
        "typeText": "AI대화", "badgeClass": "ai", "icon": "nav-chatbot",
        "target": "chatbot.html", "status": { "text": "완료", "css": "done" },
        "createdAt": "2026-10-16T08:10:00+09:00", "updatedAt": "2026-10-16T09:10:00+09:00"
      }
    ]
  },
  "answer": {
    // Start: 261015 수정 - 관련자료 업로드자료 예시
    "conversationFiles": [
      {
        "id": "dummy-upload-example",
        "file_name": "2026년_지방채_인수계획_국고실.pdf",
        "size": 245760,
        "dot": "pdf",
        "category": "지방채·추경",
        "source_kind": "upload",
        "created_at": "2026-10-15T09:00:00+09:00"
      },
      {
        "id": "dummy-upload-local-bond-budget-memo",
        "file_name": "지방채_추경편성_검토메모.hwpx",
        "size": 102400,
        "dot": "hwp",
        "category": "지방채·추경",
        "source_kind": "upload",
        "created_at": "2026-10-15T09:05:00+09:00"
      }
    ],
    // End: 261015 수정 - 관련자료 업로드자료 예시
    // Start: 261012 추가 - 참조소스 파일의 색상 타입과 아코디언 분류 예시
    "fileUpload": {
      "default": {
        "dot": "txt",
        "category": "업로드 파일",
        "source_kind": "upload"
      },
      "extensions": {
        "pdf": { "dot": "pdf" },
        "hwp": { "dot": "hwp" },
        "hwpx": { "dot": "hwp" },
        "doc": { "dot": "docx" },
        "docx": { "dot": "docx" },
        "xls": { "dot": "xls" },
        "xlsx": { "dot": "xls" },
        "ppt": { "dot": "img" },
        "pptx": { "dot": "img" },
        "png": { "dot": "img" },
        "jpg": { "dot": "img" },
        "jpeg": { "dot": "img" },
        "gif": { "dot": "img" },
        "webp": { "dot": "img" },
        "svg": { "dot": "img" },
        "bmp": { "dot": "img" },
        "avif": { "dot": "img" }
      },
      "files": {
        "2026년_지방채_인수계획_국고실.pdf": {
          "dot": "pdf",
          "category": "지방채·추경"
        },
        "지방채_추경편성_검토메모.hwpx": {
          "dot": "hwp",
          "category": "지방채·추경"
        },
        "공자기금 지방채 인수 제도 및 법적 근거": {
          "dot": "txt",
          "category": "법령·제도",
          "source_kind": "search"
        },
        "지방채 인수 예산 현황표(2016~2026)": {
          "dot": "txt",
          "category": "재정·통계",
          "source_kind": "search"
        },
        "지방재정 채무관리 지표 및 위기관리 기준": {
          "dot": "txt",
          "category": "재정·통계",
          "source_kind": "search"
        }
      }
    },
    // End: 261012 추가 - 참조소스 파일의 색상 타입과 아코디언 분류 예시
    // Start: 261014 추가 - 소스 검색결과 예시 데이터
    // 소스 검색 UI용 예시. 검색 키워드는 더미 공급자에서만 사용하고 응답에는 포함하지 않는다.
    "sourceSearch": [
      {
        "document_id": "dummy-source-search-01",
        "file_type": "hwp",
        "document_name": "지방채 인수 추경 편성 사유 답변",
        "content": "지방채 인수에 필요한 추가경정예산 편성 사유와 공공자금관리기금 운용 계획에 대한 질의 답변입니다.",
        "similarity": 0.964,
        "meta": { "answerer_org": "국고국", "answer_date": "2026-04-02" },
        "keywords": ["질의", "지방채", "추경", "인수", "예산"]
      },
      {
        "document_id": "dummy-source-search-02",
        "file_type": "hwp",
        "document_name": "260402_재정위 전체 의원 질의 답변 통합본",
        "content": "재정위원회 의원들의 재정 운용, 세입 전망, 예산 집행 관련 질의와 부처 답변을 정리한 통합 자료입니다.",
        "similarity": 0.948,
        "meta": { "answerer_org": "기획재정담당관", "answer_date": "2026-04-02" },
        "keywords": ["질의", "재정위", "국회", "예산", "답변"]
      },
      {
        "document_id": "dummy-source-search-03",
        "file_type": "pdf",
        "document_name": "236467_(25-3-31) 김영환(개별)-1번_제출.pdf",
        "content": "김영환 의원의 지역 재정 지원 및 사업별 예산 집행 현황 질의에 대한 제출 자료입니다.",
        "similarity": 0.931,
        "meta": { "member_name": "김영환", "answerer_org": "재정정책국", "answer_date": "2025-03-31" },
        "keywords": ["질의", "김영환", "재정", "예산", "제출"]
      },
      {
        "document_id": "dummy-source-search-04",
        "file_type": "hwp",
        "document_name": "공공자금관리기금 지방채 인수 제도 및 법적 근거",
        "content": "공공자금관리기금의 지방채 인수 절차와 관련 법령, 자금 배분 기준에 관한 질의 검토 자료입니다.",
        "similarity": 0.917,
        "meta": { "answerer_org": "국고국", "answer_date": "2026-03-25" },
        "keywords": ["질의", "지방채", "공자기금", "법령", "인수"]
      },
      {
        "document_id": "dummy-source-search-05",
        "file_type": "hwp",
        "document_name": "지방채 인수 예산 현황표(2016~2026)",
        "content": "연도별 지방채 인수 예산과 집행액, 잔액을 비교하고 예산 증감 사유에 관한 질의를 정리했습니다.",
        "similarity": 0.902,
        "meta": { "answerer_org": "국고국", "answer_date": "2026-03-20" },
        "keywords": ["질의", "지방채", "예산", "통계", "현황"]
      },
      {
        "document_id": "dummy-source-search-06",
        "file_type": "hwp",
        "document_name": "2026년 지방재정 채무관리 지표 및 위기관리 기준",
        "content": "지방재정의 채무 비율과 지방채 발행 한도, 재정위기 대응 기준에 관한 질의 참고 자료입니다.",
        "similarity": 0.891,
        "meta": { "answerer_org": "재정정책국", "answer_date": "2026-03-18" },
        "keywords": ["질의", "지방채", "지방재정", "채무", "위기관리"]
      },
      {
        "document_id": "dummy-source-search-07",
        "file_type": "hwp",
        "document_name": "추가경정예산 재원 조달 및 국채 발행 검토",
        "content": "추가경정예산 편성을 위한 가용 재원, 국채 발행 규모 및 재정수지 영향에 관한 질의 검토 문서입니다.",
        "similarity": 0.878,
        "meta": { "answerer_org": "예산실", "answer_date": "2026-03-15" },
        "keywords": ["질의", "추경", "국채", "재원", "재정수지"]
      },
      {
        "document_id": "dummy-source-search-08",
        "file_type": "hwp",
        "document_name": "지방채 이자 부담 완화 및 상환 계획 답변자료",
        "content": "금리 변동에 따른 지방채 이자 부담과 만기별 상환 계획, 지방자치단체 지원 방안에 대한 질의 답변입니다.",
        "similarity": 0.865,
        "meta": { "answerer_org": "국고국", "answer_date": "2026-03-12" },
        "keywords": ["질의", "지방채", "금리", "이자", "상환"]
      },
      {
        "document_id": "dummy-source-search-09",
        "file_type": "hwp",
        "document_name": "2025 회계연도 결산 재정위원회 서면질의 답변",
        "content": "회계연도 결산의 주요 불용액, 이월액 및 사업별 집행 실적에 대한 재정위원회 서면질의 답변 자료입니다.",
        "similarity": 0.852,
        "meta": { "answerer_org": "기획재정담당관", "answer_date": "2026-03-10" },
        "keywords": ["질의", "결산", "재정위", "불용", "이월"]
      },
      {
        "document_id": "dummy-source-search-10",
        "file_type": "hwp",
        "document_name": "지역경제 활성화 재정지원 사업 집행 현황",
        "content": "지역경제 활성화를 위한 재정지원 사업의 예산 집행 현황과 성과 점검 관련 질의 참고 문서입니다.",
        "similarity": 0.841,
        "meta": { "answerer_org": "재정정책국", "answer_date": "2026-03-07" },
        "keywords": ["질의", "지역경제", "재정지원", "사업", "집행"]
      },
      {
        "document_id": "dummy-source-search-11",
        "file_type": "hwp",
        "document_name": "지방채 인수 한도 조정 및 심사 기준 검토",
        "content": "지방채 인수 한도 조정의 필요성과 지방자치단체별 재정 여건을 반영한 심사 기준에 대한 질의 검토 자료입니다.",
        "similarity": 0.829,
        "meta": { "answerer_org": "국고국", "answer_date": "2026-03-05" },
        "keywords": ["질의", "지방채", "한도", "심사", "인수"]
      },
      {
        "document_id": "dummy-source-search-12",
        "file_type": "hwp",
        "document_name": "중기 재정전망 및 국가채무 관리계획 질의 답변",
        "content": "중기 세입·세출 전망과 국가채무 관리계획, 재정 건전성 확보 방안에 대한 질의와 답변을 정리했습니다.",
        "similarity": 0.814,
        "meta": { "answerer_org": "재정정책국", "answer_date": "2026-03-03" },
        "keywords": ["질의", "재정전망", "국가채무", "관리계획", "건전성"]
      }
    ],
    // End: 261014 추가 - 소스 검색결과 예시 데이터
    "conversations": [
      {
        "id": "c58c70da-8ac3-4460-9564-7bd265c6119b",
        "display_title": "기재부 특화 데이터플랫폼-생성형 AI의 구체적인 내용은 무엇인가?",
        "created_at": "2026-09-22T10:04:00+09:00",
        "updated_at": "2026-09-22T10:04:00+09:00",
        "is_favorite": false,
        "agent_id": "report_generator"
      },
      {
        "id": "73ca4e1a-999b-4b5a-812e-522da1fef2ad",
        "display_title": "기재부 특화 데이터플랫폼-생성형 AI의 구체적인 내용은 무엇인가?",
        "created_at": "2026-09-19T18:32:00+09:00",
        "updated_at": "2026-09-19T18:32:00+09:00",
        "is_favorite": false,
        "agent_id": "report_generator"
      },
      {
        "id": "13098ab3-0b3d-4739-abbc-b4e9adab5e6b",
        "display_title": "기재부 특화 데이터플랫폼-생성형 AI의 구체적인 내용은 무엇인가?",
        "created_at": "2026-09-19T18:13:00+09:00",
        "updated_at": "2026-09-19T18:13:00+09:00",
        "is_favorite": false,
        "agent_id": "report_generator"
      },
      {
        "id": "eecaac28-e03f-49fa-8ef8-1bccc3ef507d",
        "display_title": "법인세율 인하가 실제 투자 및 고용 증가에 미친 영향과 그 근거에 대한 질의 답변서 생성해줘",
        "created_at": "2026-09-18T17:08:00+09:00",
        "updated_at": "2026-09-18T17:08:00+09:00",
        "is_favorite": false,
        "agent_id": "report_generator"
      },
      {
        "id": "3a8bdeb0-d303-4c78-af0d-e73c5f3aa8d3",
        "display_title": "3. 신규 생성 시 채팅 제목 요약 안됨 4. 문서 미리보기 안되는 건 있음",
        "created_at": "2026-09-17T14:34:00+09:00",
        "updated_at": "2026-09-17T14:34:00+09:00",
        "is_favorite": false,
        "agent_id": "report_generator"
      },
      {
        "id": "ac9612e1-559a-434f-82d1-d1c5ba0a9e02",
        "display_title": "예산집행",
        "created_at": "2026-09-17T13:48:00+09:00",
        "updated_at": "2026-09-17T13:48:00+09:00",
        "is_favorite": false,
        "agent_id": "report_generator"
      },
      {
        "id": "5a9d89d5-08e0-4906-9d48-e4beebb34ba7",
        "display_title": "국가데이터처가 출범한지 약 1년이 됐습니다. 국가전략으로 AI DX를 추진하고 있는 가운데 데이터의 중요성은 이견이 없을 것입니다. 그럼에도 불구하고 데이터기본법 등 데이터처의 업무 기반이 될 법적 근거 미비와 정부간 정보/데이터 연계성 부족 등이 계속되고 있습니다. 국내 경제정책 총괄로써 경제정책의 AI DX에도 데이터처의 활성화가 시급하다고 봅니다. 재정경제부 소관 생산 행정 자료부터 데이터처와의 연계성 강화 절실합니다. 국내외 거시·미시 경제/금융, 관세 정보 등이 대표적입니다. 데이터처의 전신인 통계청장을 역임한 후보자의 일련의 상황에 대한 견해와 향후 재경부의 적극적 행정 데이터 연계 활성화 방안은?",
        "created_at": "2026-09-17T14:28:00+09:00",
        "updated_at": "2026-09-17T14:28:00+09:00",
        "is_favorite": false,
        "agent_id": "report_generator"
      },
      {
        "id": "90795537-942e-4a19-ba8b-791a7e58773a",
        "display_title": "New Chat",
        "created_at": "2026-09-16T19:24:00+09:00",
        "updated_at": "2026-09-16T19:24:00+09:00",
        "is_favorite": false,
        "agent_id": "report_generator"
      },
      {
        "id": "78944406-950d-44b7-9951-ca2353f496d4",
        "display_title": "New Chat",
        "created_at": "2026-09-16T19:24:00+09:00",
        "updated_at": "2026-09-16T19:24:00+09:00",
        "is_favorite": false,
        "agent_id": "report_generator"
      },
      {
        "id": "6332cd8b-eedb-4704-8e1d-0d73d0da7de5",
        "display_title": "New Chat",
        "created_at": "2026-09-16T19:25:00+09:00",
        "updated_at": "2026-09-16T19:25:00+09:00",
        "is_favorite": false,
        "agent_id": "report_generator"
      },
      {
        "id": "9591dbe3-9e87-47fa-a88e-9de592485d97",
        "display_title": "New Chat",
        "created_at": "2026-09-16T19:24:00+09:00",
        "updated_at": "2026-09-16T19:24:00+09:00",
        "is_favorite": false,
        "agent_id": "report_generator"
      },
      {
        "id": "c6cb26e3-fb0d-4c2c-b585-840548a2a014",
        "display_title": "New Chat",
        "created_at": "2026-09-16T19:17:00+09:00",
        "updated_at": "2026-09-16T19:17:00+09:00",
        "is_favorite": false,
        "agent_id": "report_generator"
      },
      {
        "id": "a2f52565-83c2-4dae-b304-893712499f91",
        "display_title": "New Chat",
        "created_at": "2026-09-16T19:17:00+09:00",
        "updated_at": "2026-09-16T19:17:00+09:00",
        "is_favorite": false,
        "agent_id": "report_generator"
      },
      {
        "id": "94cf1cd4-f6be-4521-adb8-9e5a7670079a",
        "display_title": "New Chat",
        "created_at": "2026-09-16T19:17:00+09:00",
        "updated_at": "2026-09-16T19:17:00+09:00",
        "is_favorite": false,
        "agent_id": "report_generator"
      },
      {
        "id": "b2ba5587-43b0-47e2-833b-31999721222a",
        "display_title": "New Chat",
        "created_at": "2026-09-16T19:17:00+09:00",
        "updated_at": "2026-09-16T19:17:00+09:00",
        "is_favorite": false,
        "agent_id": "report_generator"
      },
      {
        "id": "cc930537-7b27-4c07-a4b1-7258aeb6be41",
        "display_title": "New Chat",
        "created_at": "2026-09-16T19:17:00+09:00",
        "updated_at": "2026-09-16T19:17:00+09:00",
        "is_favorite": false,
        "agent_id": "report_generator"
      },
      {
        "id": "52c072da-c43f-45c3-b9d3-178f9b12fc58",
        "display_title": "New Chat",
        "created_at": "2026-09-16T19:17:00+09:00",
        "updated_at": "2026-09-16T19:17:00+09:00",
        "is_favorite": false,
        "agent_id": "report_generator"
      },
      {
        "id": "70e3639f-813b-401a-ac8c-36c8ba1f2cef",
        "display_title": "New Chat",
        "created_at": "2026-09-16T19:16:00+09:00",
        "updated_at": "2026-09-16T19:16:00+09:00",
        "is_favorite": false,
        "agent_id": "report_generator"
      },
      {
        "id": "15f76835-ac00-443a-84aa-b62b33f767b5",
        "display_title": "New Chat",
        "created_at": "2026-09-16T19:17:00+09:00",
        "updated_at": "2026-09-16T19:17:00+09:00",
        "is_favorite": false,
        "agent_id": "report_generator"
      },
      {
        "id": "3e0546e8-ae90-41ad-a028-16cbe3305069",
        "display_title": "New Chat",
        "created_at": "2026-09-16T19:16:00+09:00",
        "updated_at": "2026-09-16T19:16:00+09:00",
        "is_favorite": false,
        "agent_id": "report_generator"
      },
      {
        "id": "574fa5f9-b8f8-440f-8361-b6789e2863cd",
        "display_title": "New Chat",
        "created_at": "2026-09-16T19:17:00+09:00",
        "updated_at": "2026-09-16T19:17:00+09:00",
        "is_favorite": false,
        "agent_id": "report_generator"
      },
      {
        "id": "54a777cb-0bd8-4f4a-96cb-7c3912476a4b",
        "display_title": "New Chat",
        "created_at": "2026-09-16T19:16:00+09:00",
        "updated_at": "2026-09-16T19:16:00+09:00",
        "is_favorite": false,
        "agent_id": "report_generator"
      },
      {
        "id": "e2b288a4-f9d2-4a72-9366-c106e4244c40",
        "display_title": "New Chat",
        "created_at": "2026-09-16T19:16:00+09:00",
        "updated_at": "2026-09-16T19:16:00+09:00",
        "is_favorite": false,
        "agent_id": "report_generator"
      },
      {
        "id": "8d9dd8dd-e30b-4477-80a0-53dae362975d",
        "display_title": "New Chat",
        "created_at": "2026-09-16T19:15:00+09:00",
        "updated_at": "2026-09-16T19:15:00+09:00",
        "is_favorite": false,
        "agent_id": "report_generator"
      },
      {
        "id": "e3458a59-19eb-46ac-9451-3c9740db9caf",
        "display_title": "New Chat",
        "created_at": "2026-09-16T19:15:00+09:00",
        "updated_at": "2026-09-16T19:15:00+09:00",
        "is_favorite": false,
        "agent_id": "report_generator"
      },
      {
        "id": "796401c2-d7e4-4f2f-8910-0d1f5036bc86",
        "display_title": "예산집행",
        "created_at": "2026-09-16T18:30:00+09:00",
        "updated_at": "2026-09-16T18:30:00+09:00",
        "is_favorite": false,
        "agent_id": "report_generator"
      },
      {
        "id": "9451e11b-edd2-4366-8759-d1152614af73",
        "display_title": "국가데이터처가 출범한지 약 1년이 됐습니다. 국가전략으로 AI DX를 추진하고 있는 가운데 데이터의 중요성은 이견이 없을 것입니다. 그럼에도 불구하고 데이터기본법 등 데이터처의 업무 기반이 될 법적 근거 미비와 정부간 정보/데이터 연계성 부족 등이 계속되고 있습니다.  국내 경제정책 총괄로써 경제정책의 AI DX에도 데이터처의 활성화가 시급하다고 봅니다. 재정경제부 소관 생산 행정 자료부터 데이터처와의 연계성 강화 절실합니다. 국내외 거시·미시 경제/금융, 관세 정보 등이 대표적입니다.  데이터처의 전신인 통계청장을 역임한 후보자의 일련의 상황에 대한 견해와 향후 재경부의 적극적 행정 데이터 연계 활성화 방안은?",
        "created_at": "2026-09-16T18:19:00+09:00",
        "updated_at": "2026-09-16T18:19:00+09:00",
        "is_favorite": false,
        "agent_id": "report_generator"
      },
      {
        "id": "dbb88764-1708-4b5e-90cc-9d8ddc23a6d9",
        "display_title": "New Chat",
        "created_at": "2026-09-16T17:53:00+09:00",
        "updated_at": "2026-09-16T17:53:00+09:00",
        "is_favorite": false,
        "agent_id": "report_generator"
      },
      {
        "id": "a6bebd0c-2876-437a-a14d-02e5abe8dca2",
        "display_title": "New Chat",
        "created_at": "2026-09-16T17:53:00+09:00",
        "updated_at": "2026-09-16T17:53:00+09:00",
        "is_favorite": false,
        "agent_id": "report_generator"
      },
      {
        "id": "153001ea-9d1a-49ce-abbb-aacb0814a56d",
        "display_title": "New Chat",
        "created_at": "2026-09-16T17:53:00+09:00",
        "updated_at": "2026-09-16T17:53:00+09:00",
        "is_favorite": false,
        "agent_id": "report_generator"
      },
      {
        "id": "6e474436-e829-454f-8289-bb8d67d88a82",
        "display_title": "New Chat",
        "created_at": "2026-09-16T17:53:00+09:00",
        "updated_at": "2026-09-16T17:53:00+09:00",
        "is_favorite": false,
        "agent_id": "report_generator"
      },
      {
        "id": "a16ef22f-d91d-46ff-ad2a-1e7eb9d473cd",
        "display_title": "New Chat",
        "created_at": "2026-09-16T17:53:00+09:00",
        "updated_at": "2026-09-16T17:53:00+09:00",
        "is_favorite": false,
        "agent_id": "report_generator"
      },
      {
        "id": "38206549-6a3c-4eab-9ffe-a5a7b9337880",
        "display_title": "New Chat",
        "created_at": "2026-09-16T17:53:00+09:00",
        "updated_at": "2026-09-16T17:53:00+09:00",
        "is_favorite": false,
        "agent_id": "report_generator"
      },
      {
        "id": "0eb6e9a7-ad78-4b69-8887-10fb6b0351ac",
        "display_title": "New Chat",
        "created_at": "2026-09-16T17:53:00+09:00",
        "updated_at": "2026-09-16T17:53:00+09:00",
        "is_favorite": false,
        "agent_id": "report_generator"
      },
      {
        "id": "b85ac78c-25fa-4ab3-ae10-5c96db72dcb9",
        "display_title": "New Chat",
        "created_at": "2026-09-16T17:53:00+09:00",
        "updated_at": "2026-09-16T17:53:00+09:00",
        "is_favorite": false,
        "agent_id": "report_generator"
      },
      {
        "id": "ccf845b7-816c-4830-82f0-1a5840f0b2ff",
        "display_title": "New Chat",
        "created_at": "2026-09-16T17:53:00+09:00",
        "updated_at": "2026-09-16T17:53:00+09:00",
        "is_favorite": false,
        "agent_id": "report_generator"
      },
      {
        "id": "1b5b4ee6-3e22-4384-98c3-2d7eb320158c",
        "display_title": "New Chat",
        "created_at": "2026-09-16T17:53:00+09:00",
        "updated_at": "2026-09-16T17:53:00+09:00",
        "is_favorite": false,
        "agent_id": "report_generator"
      },
      {
        "id": "b0d1a1df-d6fd-491a-a804-d2f7962da2e3",
        "display_title": "New Chat",
        "created_at": "2026-09-16T17:53:00+09:00",
        "updated_at": "2026-09-16T17:53:00+09:00",
        "is_favorite": false,
        "agent_id": "report_generator"
      },
      {
        "id": "3cc8ed63-9a3a-420e-a176-b4ead6f4a312",
        "display_title": "New Chat",
        "created_at": "2026-09-16T17:53:00+09:00",
        "updated_at": "2026-09-16T17:53:00+09:00",
        "is_favorite": false,
        "agent_id": "report_generator"
      },
      {
        "id": "f0347691-b117-47a6-8636-c309ab68103e",
        "display_title": "New Chat",
        "created_at": "2026-09-16T17:53:00+09:00",
        "updated_at": "2026-09-16T17:53:00+09:00",
        "is_favorite": false,
        "agent_id": "report_generator"
      },
      {
        "id": "493ccc6e-7d2f-4a56-986e-8bc4b7941cf3",
        "display_title": "New Chat",
        "created_at": "2026-09-16T17:53:00+09:00",
        "updated_at": "2026-09-16T17:53:00+09:00",
        "is_favorite": false,
        "agent_id": "report_generator"
      },
      {
        "id": "336a5b53-74a1-44d9-b21f-c549208c1f94",
        "display_title": "New Chat",
        "created_at": "2026-09-16T17:52:00+09:00",
        "updated_at": "2026-09-16T17:52:00+09:00",
        "is_favorite": false,
        "agent_id": "report_generator"
      },
      {
        "id": "92e29d13-9b8d-4186-9ff5-3ec54d9131a4",
        "display_title": "New Chat",
        "created_at": "2026-09-16T17:26:00+09:00",
        "updated_at": "2026-09-16T17:26:00+09:00",
        "is_favorite": false,
        "agent_id": "report_generator"
      },
      {
        "id": "43299bd3-f1b7-40ab-8e77-a1881d44c56d",
        "display_title": "New Chat",
        "created_at": "2026-09-16T17:26:00+09:00",
        "updated_at": "2026-09-16T17:26:00+09:00",
        "is_favorite": false,
        "agent_id": "report_generator"
      },
      {
        "id": "d1bd5a5a-8099-43a7-8aab-1fac08cb8956",
        "display_title": "물가 상승에 대한 정부의 대책은?",
        "created_at": "2026-09-16T16:40:00+09:00",
        "updated_at": "2026-09-16T16:40:00+09:00",
        "is_favorite": false,
        "agent_id": "report_generator"
      },
      {
        "id": "6e4e2f19-8507-4e1d-9101-6327a1027d70",
        "display_title": "물가 상승에 대한 정부의 대책은?",
        "created_at": "2026-09-16T17:42:00+09:00",
        "updated_at": "2026-09-16T17:42:00+09:00",
        "is_favorite": false,
        "agent_id": "report_generator"
      },
      {
        "id": "f2d8f216-1a01-4e0a-b1c8-8766cd854c2c",
        "display_title": "예산집행",
        "created_at": "2026-09-16T16:20:00+09:00",
        "updated_at": "2026-09-16T16:20:00+09:00",
        "is_favorite": false,
        "agent_id": "report_generator"
      },
      {
        "id": "087eb788-e75b-4fc3-8c50-2241cfdafed3",
        "display_title": "물가 상승에 대한 정부의 대책은?",
        "created_at": "2026-09-16T16:35:00+09:00",
        "updated_at": "2026-09-16T16:35:00+09:00",
        "is_favorite": false,
        "agent_id": "report_generator"
      },
      {
        "id": "b041e932-0455-41e1-a460-2dd0204014e6",
        "display_title": "물가 상승에 대한 정부의 대책은?",
        "created_at": "2026-09-16T15:30:00+09:00",
        "updated_at": "2026-09-16T15:30:00+09:00",
        "is_favorite": false,
        "agent_id": "report_generator"
      },
      {
        "id": "9405dd9f-35f8-4f00-8146-43fef7593386",
        "display_title": "정상외교 네트워크 부재로 트럼프 정부와의 관세협상 등 실기가 우려되는데, 대응 방안은?",
        "created_at": "2026-09-16T15:51:00+09:00",
        "updated_at": "2026-09-16T15:51:00+09:00",
        "is_favorite": false,
        "agent_id": "report_generator"
      }
    ],
    "sources": [
      {
        "doc_id": "b982515889c011f1a41675ba8476cbe8",
        "title": "(과기부 참고)윤영덕의원_광주AI집적단지.hwp",
        "score": 50.8,
        "summary": "질의자 윤영덕",
        "member_name": "윤영덕"
      },
      {
        "doc_id": "ab411e82874311f1a41675ba8476cbe8",
        "title": "236050_양부남 의원_생성형AI.hwp",
        "score": 49.6,
        "summary": "질의자 양부남 · 답변자 주현동",
        "member_name": "원스톱수출수주지원단"
      },
      {
        "doc_id": "19a4b91a896511f1a41675ba8476cbe8",
        "title": "250428 QA_피지컬AI 제조특화 선도사업 증액 필요 v2.hwp",
        "score": 49.4,
        "summary": "현재 질의와 관련된 과거 답변 자료입니다.",
        "member_name": "과거답변서"
      },
      {
        "doc_id": "7de24c76896511f1a41675ba8476cbe8",
        "title": "250712 유상범의원(AI허브).hwp",
        "score": 48.9,
        "summary": "질의자 유상범",
        "member_name": "유상범"
      },
      {
        "doc_id": "d2f46290869e11f1a41675ba8476cbe8",
        "title": "227649_(이인선 의원실)-최근5년 성인지사업(기획재정담당관)_240924.hwp",
        "score": 47.6,
        "summary": "질의자 이인선 · 답변자 이준범",
        "member_name": "기획재정담당관"
      },
      {
        "doc_id": "414343be869111f1a41675ba8476cbe8",
        "title": "234825_(임미애 의원실)-2025년 사업설명자료_기획재정담당관.hwp",
        "score": 47.3,
        "summary": "질의자 임미애 · 답변자 이준범",
        "member_name": "기획재정담당관"
      },
      {
        "doc_id": "5ebe7a70874611f1a41675ba8476cbe8",
        "title": "235131_(서삼석 의원실)-2025년 사업설명자료_기획재정담당관.hwp",
        "score": 47.3,
        "summary": "질의자 서삼석 · 답변자 이준범",
        "member_name": "기획재정담당관"
      },
      {
        "doc_id": "1ae92f94874511f1a41675ba8476cbe8",
        "title": "235539_(진성준 의원실)-2025년 사업설명자료_기획재정담당관.hwp",
        "score": 47.2,
        "summary": "질의자 진성준 · 답변자 박경찬",
        "member_name": "기획재정담당관"
      },
      {
        "doc_id": "e57fc150874511f1a41675ba8476cbe8",
        "title": "235330_(안호영 의원실)-2025년 사업설명자료_기획재정담당관.hwp",
        "score": 47.2,
        "summary": "질의자 안호영 · 답변자 박경찬",
        "member_name": "기획재정담당관"
      },
      {
        "doc_id": "a9f84fbe874311f1a41675ba8476cbe8",
        "title": "236052_250310 양부남의원 요구(생성형 AI구독비용) 답변자료.hwp",
        "score": 47.2,
        "summary": "질의자 양부남 · 답변자 최지영",
        "member_name": "경제공급망기획관"
      },
      {
        "doc_id": "a4a0bf54874511f1a41675ba8476cbe8",
        "title": "235396_(25-2-6) 엄태영 의원실-(생성형 AI 관련 보안 대응 2025-298).hwp",
        "score": 46.9,
        "summary": "질의자 엄태영 · 답변자 김진홍",
        "member_name": "정보보호팀"
      },
      {
        "doc_id": "6cc6ee42896511f1a41675ba8476cbe8",
        "title": "[수정](최은석3-2) 250711 신성장과.hwp",
        "score": 46.9,
        "summary": "질의자 최은석",
        "member_name": "최은석"
      },
      {
        "doc_id": "c9eda8e8874611f1a41675ba8476cbe8",
        "title": "234959_(박지혜 의원실)-2025년 사업설명자료_기획재정담당관.hwp",
        "score": 46.8,
        "summary": "질의자 박지혜 · 답변자 이준범",
        "member_name": "기획재정담당관"
      },
      {
        "doc_id": "de156d428a6b11f1a41675ba8476cbe8",
        "title": "236318_250325_구자근 의원요구자료(데이터플랫폼 구축사업 관련).hwp",
        "score": 46.7,
        "summary": "질의자 구자근 · 답변자 안영성",
        "member_name": "정보화담당관"
      },
      {
        "doc_id": "54c14644866d11f1a41675ba8476cbe8",
        "title": "199664_(220808)-조직개편 현황(인사과).hwp",
        "score": 46.7,
        "summary": "질의자 이용우 · 답변자 박문규",
        "member_name": "인사과"
      },
      {
        "doc_id": "6fd8786487c411f1a41675ba8476cbe8",
        "title": "정태호 13.hwp",
        "score": 46.6,
        "summary": "질의자 정태호 · 답변자 권재관",
        "member_name": "경제구조개혁국"
      },
      {
        "doc_id": "027d969e87cb11f1a41675ba8476cbe8",
        "title": "이인선의원실 인사청문회 요구자료(사업설명자료).hwp",
        "score": 46.4,
        "summary": "질의자 이인선 · 답변자 김석헌",
        "member_name": "기획재정담당관"
      },
      {
        "doc_id": "824aed06865c11f1a41675ba8476cbe8",
        "title": "206273_220930 기재부 업무공간(공급망기획단).hwp",
        "score": 46.2,
        "summary": "질의자 김주영 · 답변자 강희민",
        "member_name": "경제공급망기획관"
      },
      {
        "doc_id": "909b1b4a896511f1a41675ba8476cbe8",
        "title": "인사청문회 구두질의답변_정태호 의원 1번.hwp",
        "score": 46.1,
        "summary": "질의자 정태호 · 답변자 황경임",
        "member_name": "신성장정책과"
      },
      {
        "doc_id": "40909b56874011f1a41675ba8476cbe8",
        "title": "237776_답변서(정태호 의원).hwp",
        "score": 45.9,
        "summary": "질의자 정태호 · 답변자 박찬호",
        "member_name": "감사관"
      }
    ],
    // Start: 261015 수정 - 기존 답변 근거를 유지하고 검색자료 예시 추가
    "references": [
      {
        "document_id": "7de24c76896511f1a41675ba8476cbe8",
        "document_name": "250712 유상범의원(AI허브).hwp",
        "similarity": 0.276,
        "content": "□ ‘AI 허브’는 기획재정부 직원들이 ChatGPT(범용대화형 AI)와 Perplexity(자료검색특화 AI)를 업무에 활용할 수 있도록 보안을 강화하여 기재부 인터넷 포털에 구축한 AI..."
      },
      {
        "document_id": "dummy-search-public-fund-local-bond",
        "document_name": "공자기금 지방채 인수 제도 및 법적 근거",
        "source_kind": "search",
        "category": "법령·제도",
        "similarity": 0.936,
        "content": "공공자금관리기금의 지방채 인수 제도와 관련 법령을 정리한 예시 자료입니다. 지방채 인수 대상, 자금 운용 절차 및 적용 근거를 확인할 수 있습니다."
      },
      {
        "document_id": "dummy-search-local-bond-budget-2016-2026",
        "document_name": "지방채 인수 예산 현황표(2016~2026)",
        "source_kind": "search",
        "category": "재정·통계",
        "similarity": 0.912,
        "content": "2016년부터 2026년까지의 지방채 인수 예산 현황을 정리한 예시 자료입니다. 연도별 예산과 인수 규모의 변화를 비교하는 데 사용합니다."
      },
      {
        "document_id": "dummy-search-local-finance-debt-management",
        "document_name": "지방재정 채무관리 지표 및 위기관리 기준",
        "source_kind": "search",
        "category": "재정·통계",
        "similarity": 0.894,
        "content": "지방재정의 채무관리 지표와 재정위기 관리 기준을 정리한 예시 자료입니다. 채무 현황 점검 항목과 관리 절차를 확인할 수 있습니다."
      }
    ],
    // End: 261015 수정 - 기존 답변 근거를 유지하고 검색자료 예시 추가
    "report": {
      "report_id": "dummy-report",
      "title": "기재부 특화 데이터플랫폼-생성형 AI의 구체적인 내용은 무엇인가?",
      "version": 1,
      "latest_version": 1,
      "versions": [
        1
      ],
      "content": "<div style=\"font-family:'Malgun Gothic',sans-serif;font-size:14px;line-height:1.6\">\n<h3>질의</h3>\n<p style=\"margin:2px 0\">기재부 특화 데이터플랫폼-생성형 AI의 구체적인 내용은 무엇인가?</p>\n<div style=\"height:6px\"></div>\n<h3>스크립트</h3>\n<p style=\"margin:2px 0\">□ [현황] 기재부 인터넷 포털 내 AI 플랫폼 '<strong>AI\n허브</strong>' 구축 <button type=\"button\" class=\"draft-ref-marker\" data-reference-marker=\"1\" title=\"근거 1 확인\" style=\"cursor: pointer; pointer-events: auto;\">¹</button>\n</p>\n<p style=\"margin:2px 0\"> ㅇ <strong>보안 강화</strong>한 <strong>생성형\nAI 서비스</strong> 제공 <button type=\"button\" class=\"draft-ref-marker\" data-reference-marker=\"1\" title=\"근거 1 확인\" style=\"cursor: pointer; pointer-events: auto;\">¹</button>\n</p>\n<p style=\"margin:2px 0\"> * ChatGPT(범용), Perplexity(검색특화)</p>\n<p style=\"margin:2px 0\">□ [향후계획] <strong>업무 생산성 향상</strong> AI\n서비스 <strong>추가 연동 추진</strong> <button type=\"button\" class=\"draft-ref-marker\" data-reference-marker=\"1\" title=\"근거 1 확인\" style=\"cursor: pointer; pointer-events: auto;\">¹</button>\n</p>\n<div style=\"height:6px\"></div>\n<h3>참고: 출처</h3>\n<p style=\"margin:2px 0\">1. 250712 유상범의원(AI허브).hwp</p>\n</div>"
    },
    "reportVersions": [
      {
        "version": 2,
        "content": "<div style=\"font-family:'Malgun Gothic',sans-serif;font-size:14px;line-height:1.6\">\n<h3>질의</h3>\n<p style=\"margin:2px 0\">기재부 특화 데이터플랫폼-생성형 AI의 구체적인 내용은 무엇인가?</p>\n<div style=\"height:6px\"></div>\n<h3>스크립트</h3>\n<p style=\"margin:2px 0\">□ [현황] 기재부 인터넷 포털 내 AI 플랫폼 '<strong>AI\n허브</strong>' 구축 <button type=\"button\" class=\"draft-ref-marker\" data-reference-marker=\"1\" title=\"근거 1 확인\" style=\"cursor: pointer; pointer-events: auto;\">¹</button>\n</p>\n<p style=\"margin:2px 0\"> ㅇ <strong>접근 권한 관리와 보안을 강화</strong>한 <strong>생성형\nAI 서비스</strong> 제공 <button type=\"button\" class=\"draft-ref-marker\" data-reference-marker=\"1\" title=\"근거 1 확인\" style=\"cursor: pointer; pointer-events: auto;\">¹</button>\n</p>\n<p style=\"margin:2px 0\"> * ChatGPT(범용), Perplexity(검색특화)</p>\n<p style=\"margin:2px 0\">□ [향후계획] <strong>자료 검색·요약 및 답변서 작성 지원</strong>을 위한 AI\n서비스 <strong>단계적 확대 추진</strong> <button type=\"button\" class=\"draft-ref-marker\" data-reference-marker=\"1\" title=\"근거 1 확인\" style=\"cursor: pointer; pointer-events: auto;\">¹</button>\n</p>\n<div style=\"height:6px\"></div>\n<h3>추진 방향</h3>\n<p style=\"margin:2px 0\">ㅇ 부서별 업무 수요를 파악하여 활용 과제를 선정하고, 시범 적용 결과를 바탕으로 서비스 범위를 확대할 계획입니다.</p>\n<div style=\"height:6px\"></div>\n<h3>참고: 출처</h3>\n<p style=\"margin:2px 0\">1. 250712 유상범의원(AI허브).hwp</p>\n</div>"
      }
    ],
    "messages": [
      {
        "id": "4771b695-af6c-4c1b-b3dc-c02bfcf0302d",
        "role": "user",
        "content": "기재부 특화 데이터플랫폼-생성형 AI의 구체적인 내용은 무엇인가?",
        "created_at": "2026-09-22T10:04:00+09:00"
      },
      {
        "id": "2a255633-2239-47a0-9b6a-73bb55358658",
        "role": "assistant",
        "content": "\n\t\t\t\t\t\t\t\t\t<p>답변서가 생성되었습니다.</p>\n\t\t\t\t\t\t\t\t",
        "created_at": "2026-09-22T10:04:00+09:00"
      }
    ]
  },
  "classification": {
    "conversations": [
      {
        "id": "fd851dc2-cfee-4984-abb1-50ed1493bf17",
        "display_title": "제목없는 국회질의",
        "created_at": "2026-09-16T18:08:00+09:00",
        "updated_at": "2026-09-16T18:08:00+09:00",
        "is_favorite": false,
        "agent_id": "inquiry"
      },
      {
        "id": "7b50d028-491f-4b54-92d8-167f61cad2fc",
        "display_title": "제목없는 국회질의",
        "created_at": "2026-09-16T18:07:00+09:00",
        "updated_at": "2026-09-16T18:07:00+09:00",
        "is_favorite": false,
        "agent_id": "inquiry"
      },
      {
        "id": "5415b7e1-5cbe-42bc-aece-5072e06096fa",
        "display_title": "제목없는 국회질의",
        "created_at": "2026-09-16T17:44:00+09:00",
        "updated_at": "2026-09-16T17:44:00+09:00",
        "is_favorite": false,
        "agent_id": "inquiry"
      },
      {
        "id": "fd2a343f-b8d6-4f03-8327-7084a5b2c93b",
        "document_status": "processing",
        "display_title": "제목없는 국회질의",
        "created_at": "2026-09-16T17:34:00+09:00",
        "updated_at": "2026-09-16T17:34:00+09:00",
        "is_favorite": false,
        "agent_id": "inquiry"
      },
      {
        "id": "eeb075ce-c722-487f-8e2b-26a2a7477616",
        "display_title": "제목없는 국회질의",
        "created_at": "2026-09-16T17:28:00+09:00",
        "updated_at": "2026-09-16T17:28:00+09:00",
        "is_favorite": false,
        "agent_id": "inquiry"
      },
      {
        "id": "b3b9961e-ddb4-490e-acae-e7d44278bf30",
        "display_title": "제목없는 국회질의",
        "created_at": "2026-08-25T15:07:00+09:00",
        "updated_at": "2026-08-25T15:07:00+09:00",
        "is_favorite": false,
        "agent_id": "inquiry"
      }
    ],
    "document": {
      "file_name": "(의정)(25-1-9)김승수 의원실-(남태령역 트랙터 시위 관련, 2025-106).pdf",
      "file_size": 129229,
      "status": "completed",
      "question_count": 9,
      "member_name": "김승수"
    },
    "questions": [
      {
        "question_id": "8f9175fa-36f3-4560-bf84-ad18590e9a0d",
        "question_order": 1,
        "question_text": "재정준칙과 중기재정계획에 따른 총지출 관리 및 국가채무·국채발행·기금여유재원 활용 계획은?",
        "question_original_text": "재정준칙과 중기재정계획에 따른 총지출 관리 및 국가채무·국채발행·기금여유재원 활용 계획은?",
        "primary_departments": [
          {
            "id": "dummy-dept-5",
            "name": "경제정책국",
            "dept_nm": "경제정책국",
            "dept_cd": "dummy-dept-5",
            "organization_name": "재정경제부"
          }
        ],
        "predicted_department": {
          "id": "dummy-dept-5",
          "name": "경제정책국"
        },
        "support_departments": [],
        "confidence": 76,
        "reason": "재정준칙과 중기재정계획에 관한 질의로 경제정책국을 추천합니다. 국가채무 및 기금 관련 수동 룰도 매칭되어 근거 확인이 필요합니다.",
        "is_deleted": false,
        "is_submitted": false,
        "member_name": "김승수",
        "question_date": "2025-01-09",
        "rule_matches": [
          {
            "rule_id": "dummy-match-1",
            "name": "재정준칙 검토 룰",
            "department": {
              "name": "경제정책국"
            },
            "match_mode": "all",
            "matched_keywords": [
              "재정준칙",
              "중기재정계획"
            ],
            "description": "재정준칙과 중기재정계획을 모두 포함",
            "is_representative": true,
            "exclude_keywords": [
              "지방재정"
            ]
          },
          {
            "rule_id": "dummy-match-2",
            "name": "총지출 관리 원칙 룰",
            "department": {
              "name": "경제정책국"
            },
            "match_mode": "all",
            "matched_keywords": [
              "총지출",
              "중기재정계획"
            ],
            "description": "총지출과 중기재정계획을 모두 포함",
            "is_representative": false,
            "exclude_keywords": []
          },
          {
            "rule_id": "dummy-match-3",
            "name": "국가채무 관리 룰",
            "department": {
              "name": "국고국"
            },
            "match_mode": "any",
            "matched_keywords": [
              "국가채무",
              "국채발행"
            ],
            "description": "국가채무 또는 국채발행 관련 문맥 포함",
            "is_representative": false,
            "exclude_keywords": []
          },
          {
            "rule_id": "dummy-match-4",
            "name": "기금여유재원 활용 룰",
            "department": {
              "name": "국고국"
            },
            "match_mode": "any",
            "matched_keywords": [
              "기금여유재원"
            ],
            "description": "기금여유재원 관련 표현 포함",
            "is_representative": false,
            "exclude_keywords": []
          }
        ]
      },
      {
        "question_id": "fe8eb75f-eec4-4772-8c0c-b92420f65aa1",
        "question_order": 2,
        "question_text": "최근 20년간 이들 단체들의 시위로 인한 피해 규모 및 검찰 피해 현황(피해규모 등)",
        "question_original_text": "최근 20년간 이들 단체들의 시위로 인한 피해 규모 및 경찰 피해 현황(피해규모 등)",
        "primary_departments": [
          {
            "id": "dummy-dept-2",
            "name": "기획조정실",
            "dept_nm": "기획조정실",
            "dept_cd": "dummy-dept-2",
            "organization_name": "재정경제부"
          }
        ],
        "support_departments": [],
        "confidence": 43,
        "reason": "특정 사건이나 시위와 관련된 피해 현황, 민원·진정 성격의 자료 요청은 기획조정실 소관이며, 유사 예시 중 정부사업 중단 사례 및 피해 규모 질의가 기획조정실로 배정된 것과 맥락이 일치함.",
        "classification_reason": "특정 사건이나 시위와 관련된 피해 현황, 민원·진정 성격의 자료 요청은 기획조정실 소관이며, 유사 예시 중 정부사업 중단 사례 및 피해 규모 질의가 기획조정실로 배정된 것과 맥락이 일치함.",
        "is_deleted": false,
        "is_submitted": false,
        "member_name": "김승수",
        "question_date": "2025-01-09"
      },
      {
        "question_id": "a0a00b2f-0c71-4a43-b263-a38f1fe1602e",
        "question_order": 3,
        "question_text": "지난 2019년도에 트랙터 수십대를 전농 및 북송을 위해 통일부에 반출 신청 여부(날짜, 북송 반출 요청 단체명, 대표자명, 반출규모 등 상세내역, 단체가 요청한 공문, 반출 미승인 사유 및 정부가 단체에 보낸 공문서 등 상세내역)",
        "question_original_text": "지난 2019년도에 트랙터 수십대를 전농 및 북송을 위해 통일부에 반출 신청 여부(날짜, 북송 반출 요청 단체명, 대표자명, 반출규모 등 상세내역, 단체가 요청한 공문, 반출 미승인 사유 및 정부가 단체에 보낸 공문서 등 상세내역)",
        "primary_departments": [
          {
            "id": "dummy-dept-4",
            "name": "대외경제국",
            "dept_nm": "대외경제국",
            "dept_cd": "dummy-dept-4",
            "organization_name": "재정경제부"
          }
        ],
        "support_departments": [],
        "confidence": 99,
        "reason": "대북 지원사업 물품의 반출 승인 현황 및 상세 내역에 관한 질의로, 유사 예시에서 동일한 성격의 질의를 대외경제국에서 담당한 사례가 있음.",
        "classification_reason": "대북 지원사업 물품의 반출 승인 현황 및 상세 내역에 관한 질의로, 유사 예시에서 동일한 성격의 질의를 대외경제국에서 담당한 사례가 있음.",
        "is_deleted": false,
        "is_submitted": false,
        "member_name": "김승수",
        "question_date": "2025-01-09"
      },
      {
        "question_id": "83c7f2cf-c77d-4490-825f-cb4d069f5992",
        "question_order": 4,
        "question_text": "트랙터 지원과 관련하여 국비 및 기금에서 지원된 예산 현황(국비 및 기금 지원 현황, 해당 단체에 지원하였거나 현재 지원하고 있는 예산 등 상세내역(최근 10년간 지원내역), 결산보고자료 및 연도별 회계내역 등 상세내역)",
        "question_original_text": "트랙터 지원과 관련하여 국비 및 기금에서 지원된 예산 현황(국비 및 기금 지원 현황, 해당 단체에 지원하였거나 현재 지원하고 있는 예산 등 상세내역(최근 10년간 지원내역), 결산보고자료 및 연도별 회계내역 등 상세내역)",
        "primary_departments": [
          {
            "id": "dummy-dept-2",
            "name": "기획조정실",
            "dept_nm": "기획조정실",
            "dept_cd": "dummy-dept-2",
            "organization_name": "재정경제부"
          }
        ],
        "support_departments": [],
        "confidence": 50,
        "reason": "특정 사업이나 단체에 지원된 예산의 집행 현황, 결산 및 회계 내역을 요청하는 질의는 유사 예시(전장연 지원 예산, 보조금 지원 제한 단체 현황 등)에 비추어 기획조정실에서 담당하는 경향이 강함.",
        "classification_reason": "특정 사업이나 단체에 지원된 예산의 집행 현황, 결산 및 회계 내역을 요청하는 질의는 유사 예시(전장연 지원 예산, 보조금 지원 제한 단체 현황 등)에 비추어 기획조정실에서 담당하는 경향이 강함.",
        "is_deleted": false,
        "is_submitted": false,
        "member_name": "김승수",
        "question_date": "2025-01-09"
      },
      {
        "question_id": "2500e912-84ec-407e-82c6-5eef97383f22",
        "question_order": 5,
        "question_text": "남태령 시위에 동원된 트랙터가 문재인 정부 당시인 2019년 북송용으로 구매했으나, 대북제재로 인해 보관하다가 반전부 시위에 대거 동원했다는 주장에 대한 정부의 입장과 정부예산(국비 및 기금, 지원금 등등) 지원된 게 있는지 여부 등 상세내역",
        "question_original_text": "남태령 시위에 동원된 트랙터가 문재인 정부 당시인 2019년 북송용으로 구매했으나, 대북제재로 인해 보관하다가 반전부 시위에 대거 동원했다는 주장에 대한 정부의 입장과 정부예산(국비 및 기금, 지원금 등등) 지원된 게 있는지 여부 등 상세내역",
        "primary_departments": [
          {
            "id": "dummy-dept-2",
            "name": "기획조정실",
            "dept_nm": "기획조정실",
            "dept_cd": "dummy-dept-2",
            "organization_name": "재정경제부"
          }
        ],
        "support_departments": [],
        "confidence": 50,
        "reason": "특정 단체나 사업에 지원된 국비 및 기금의 상세 내역을 요청하는 질의는 제공된 유사 예시(전장연 지원 예산, 보조금 지원 제한 단체 현황 등)에 따라 기획조정실에서 담당하는 경향이 매우 강함.",
        "classification_reason": "특정 단체나 사업에 지원된 국비 및 기금의 상세 내역을 요청하는 질의는 제공된 유사 예시(전장연 지원 예산, 보조금 지원 제한 단체 현황 등)에 따라 기획조정실에서 담당하는 경향이 매우 강함.",
        "is_deleted": false,
        "is_submitted": false,
        "member_name": "김승수",
        "question_date": "2025-01-09"
      },
      {
        "question_id": "667c34f9-2542-4cd1-afdc-559d3436bdc7",
        "question_order": 6,
        "question_text": "국비 등 예산지원했을 시 또는 대북 지원 물품을 시위에 사용했을 경우 관련 법적근거 및 관련 규정 등 상세내역",
        "question_original_text": "국비 등 예산지원했을 시 또는 대북 지원 물품을 시위에 사용했을 경우 관련 법적근거 및 관련 규정 등 상세내역",
        "primary_departments": [
          {
            "id": "dummy-dept-4",
            "name": "대외경제국",
            "dept_nm": "대외경제국",
            "dept_cd": "dummy-dept-4",
            "organization_name": "재정경제부"
          }
        ],
        "support_departments": [],
        "confidence": 87,
        "reason": "질의의 핵심 대상이 '대북 지원 물품' 및 관련 예산으로, 유사 예시 중 '대북 지원사업 관련 물품 반출 승인'을 대외경제국에서 담당한 사례와 일치함.",
        "classification_reason": "질의의 핵심 대상이 '대북 지원 물품' 및 관련 예산으로, 유사 예시 중 '대북 지원사업 관련 물품 반출 승인'을 대외경제국에서 담당한 사례와 일치함.",
        "is_deleted": false,
        "is_submitted": false,
        "member_name": "김승수",
        "question_date": "2025-01-09"
      },
      {
        "question_id": "516fda84-d385-433d-9e15-4de1efbc81b2",
        "question_order": 7,
        "question_text": "대북 지원 물품(트랙터 등) 등을 관리해야 할 주체 및 관련 법적 근거는?",
        "question_original_text": "대북 지원 물품(트랙터 등) 등을 관리해야 할 주체 및 관련 법적 근거는?",
        "primary_departments": [
          {
            "id": "dummy-dept-4",
            "name": "대외경제국",
            "dept_nm": "대외경제국",
            "dept_cd": "dummy-dept-4",
            "organization_name": "재정경제부"
          }
        ],
        "support_departments": [],
        "confidence": 87,
        "reason": "제시된 유사 예시 중 '대북 지원사업 관련 물품 반출 승인' 업무를 대외경제국에서 담당하고 있으며, 대북 지원 물품의 관리 및 법적 근거 역시 동일한 업무 영역에 해당함.",
        "classification_reason": "제시된 유사 예시 중 '대북 지원사업 관련 물품 반출 승인' 업무를 대외경제국에서 담당하고 있으며, 대북 지원 물품의 관리 및 법적 근거 역시 동일한 업무 영역에 해당함.",
        "is_deleted": false,
        "is_submitted": false,
        "member_name": "김승수",
        "question_date": "2025-01-09"
      },
      {
        "question_id": "dummy-question-multi-8",
        "question_order": 8,
        "question_text": "대북 지원 물품 사업의 예산 집행 현황과 대외경제 협력 정책의 연계 효과 및 향후 관리 방안은?",
        "question_original_text": "대북 지원 물품 사업의 예산 집행 현황과 대외경제 협력 정책의 연계 효과 및 향후 관리 방안은?",
        "primary_departments": [
          {
            "id": "dummy-dept-4",
            "name": "대외경제국",
            "dept_nm": "대외경제국",
            "dept_cd": "dummy-dept-4",
            "organization_name": "재정경제부"
          }
        ],
        "support_departments": [
          {
            "id": "dummy-dept-5",
            "name": "경제정책국",
            "dept_nm": "경제정책국",
            "dept_cd": "dummy-dept-5",
            "organization_name": "재정경제부"
          }
        ],
        "confidence": 92,
        "reason": "대북 지원사업과 대외경제 협력은 대외경제국이 주관하고, 경제정책 연계 효과 검토는 경제정책국이 협조하는 복수소관 예시입니다.",
        "classification_reason": "대북 지원사업과 대외경제 협력은 대외경제국이 주관하고, 경제정책 연계 효과 검토는 경제정책국이 협조하는 복수소관 예시입니다.",
        "is_deleted": false,
        "is_submitted": false,
        "member_name": "김승수",
        "question_date": "2025-01-09"
      },
      {
        "question_id": "dummy-question-none-9",
        "question_order": 9,
        "question_text": "남태령역 트랙터 시위 당시 경찰의 교통 통제 기준과 현장 안전관리 조치 내역은?",
        "question_original_text": "남태령역 트랙터 시위 당시 경찰의 교통 통제 기준과 현장 안전관리 조치 내역은?",
        "primary_departments": [],
        "support_departments": [],
        "organization_name": "경찰청",
        "confidence": 92,
        "reason": "경찰의 교통 통제 및 현장 안전관리에 관한 질의로, 재정경제부 소관에 해당하지 않는 경찰청 소관 예시입니다.",
        "classification_reason": "경찰의 교통 통제 및 현장 안전관리에 관한 질의로, 재정경제부 소관에 해당하지 않는 경찰청 소관 예시입니다.",
        "is_deleted": false,
        "is_submitted": false,
        "member_name": "김승수",
        "question_date": "2025-01-09"
      }
    ],
    "rules": [
      { "rule_id": "dummy-rule-1", "name": "에너지", "include_keywords": ["에너지"], "department": { "id": "dummy-dept-6", "name": "혁신성장실" }, "is_active": true, "match_mode": "any" },
      { "rule_id": "dummy-rule-2", "name": "친환경 에너지, 미래산업, 구조개혁", "include_keywords": ["친환경 에너지", "미래산업", "구조개혁"], "department": { "id": "dummy-dept-6", "name": "혁신성장실" }, "is_active": true, "match_mode": "any" },
      { "rule_id": "dummy-rule-3", "name": "청년, 일자리", "include_keywords": ["청년", "일자리"], "department": { "id": "dummy-dept-7", "name": "경제구조개혁국" }, "is_active": true, "match_mode": "any" },
      { "rule_id": "dummy-rule-4", "name": "청년, 주거", "include_keywords": ["청년", "주거"], "department": { "id": "dummy-dept-8", "name": "민생경제국" }, "is_active": true, "match_mode": "any" },
      { "rule_id": "dummy-rule-5", "name": "청년, 복지, 재정지원", "include_keywords": ["청년", "복지", "재정지원"], "department": { "id": "dummy-dept-8", "name": "민생경제국" }, "is_active": true, "match_mode": "any" },
      { "rule_id": "dummy-rule-6", "name": "국가채무", "include_keywords": ["국가채무"], "department": { "id": "dummy-dept-5", "name": "경제정책국" }, "is_active": true, "match_mode": "any" },
      { "rule_id": "dummy-rule-7", "name": "재정준칙", "include_keywords": ["재정준칙"], "department": { "id": "dummy-dept-5", "name": "경제정책국" }, "is_active": true, "match_mode": "any" },
      { "rule_id": "dummy-rule-8", "name": "총지출, 추가경정예산, 국가채무", "include_keywords": ["총지출", "추가경정예산", "국가채무"], "department": { "id": "dummy-dept-5", "name": "경제정책국" }, "is_active": true, "match_mode": "any" }
    ],
    "departments": [
      { "id": "dummy-dept-6", "name": "혁신성장실", "dept_nm": "혁신성장실", "dept_cd": "dummy-dept-6", "organization_name": "재정경제부" },
      { "id": "dummy-dept-7", "name": "경제구조개혁국", "dept_nm": "경제구조개혁국", "dept_cd": "dummy-dept-7", "organization_name": "재정경제부" },
      { "id": "dummy-dept-8", "name": "민생경제국", "dept_nm": "민생경제국", "dept_cd": "dummy-dept-8", "organization_name": "재정경제부" },
      {
        "id": "dummy-dept-1",
        "name": "공공정책국",
        "dept_nm": "공공정책국",
        "dept_cd": "dummy-dept-1",
        "organization_name": "재정경제부"
      },
      {
        "id": "dummy-dept-2",
        "name": "기획조정실",
        "dept_nm": "기획조정실",
        "dept_cd": "dummy-dept-2",
        "organization_name": "재정경제부"
      },
      {
        "id": "dummy-dept-3",
        "name": "대변인",
        "dept_nm": "대변인",
        "dept_cd": "dummy-dept-3",
        "organization_name": "재정경제부"
      },
      {
        "id": "dummy-dept-4",
        "name": "대외경제국",
        "dept_nm": "대외경제국",
        "dept_cd": "dummy-dept-4",
        "organization_name": "재정경제부"
      },
      {
        "id": "dummy-dept-5",
        "name": "경제정책국",
        "dept_nm": "경제정책국",
        "dept_cd": "dummy-dept-5",
        "organization_name": "재정경제부"
      }
    ]
  },
  "chat": {
    // Start: 261016 추가 - 챗봇 사용자 표시 예시
    "user": {
      "name": "일반담당자",
      "department": "시스템운영팀",
      "role": "일반담당자",
      "greeting": "박재정 주무관님! "
    },
    // End: 261016 추가 - 챗봇 사용자 표시 예시
    // Start: 261016 추가 - 프로젝트 목록·세부사항 수정·삭제 예시
    "projects": [
      {
        "id": "dummy-project-add",
        "name": "추가",
        "description": "새로 추가할 화면과 기능을 정리하는 프로젝트입니다.",
        "system_instructions": "기존 화면과 컴포넌트를 기준으로 필요한 변경 사항을 정리해 주세요.",
        "is_active": true
      },
      {
        "id": "dummy-project-test",
        "name": "테스트",
        "description": "화면 동작과 확인할 항목을 정리하는 프로젝트입니다.",
        "system_instructions": "확인 순서와 기대 결과를 함께 정리해 주세요.",
        "is_active": true
      },
      {
        "id": "dummy-project-review",
        "name": "검토",
        "description": "프로젝트 기능 미리보기",
        "system_instructions": "근거를 함께 설명해 주세요.",
        "is_active": true
      }
    ],
    // End: 261016 추가 - 프로젝트 목록·세부사항 수정·삭제 예시
    "searchItems": [{ "file_id": "dummy-search-file", "name": "업무 검토 자료.pdf", "path": "/업무자료/검토", "author": "미리보기", "size": 2048, "modified_at": "2026-10-16T09:00:00+09:00", "match_type": "content", "highlights": ["검토"] }],
    // Start: 261016 수정 - 개발 렌더러용 채팅 이력·본문·참고 파일 예시
    // agent는 목록 배지, 메시지의 prompt_type_option은 대화 안내문과 작업 선택에 사용합니다.
    "conversations": [
      {
        "id": "dummy-chat-budget-execution",
        "display_title": "예산집행",
        "agent": "report_generator",
        "is_favorite": true,
        "created_at": "2026-10-16T09:30:00+09:00"
      },
      {
        "id": "dummy-chat-budget-review",
        "display_title": "신규 사업 예산 편성 및 법적 근거 검토",
        "agent": "report_generator",
        "is_favorite": true,
        "created_at": "2026-10-16T09:20:00+09:00"
      },
      {
        "id": "dummy-chat-budget-management",
        "display_title": "예산 집행 현황과 부진 사업 관리 방안",
        "agent": "report_generator",
        "created_at": "2026-10-16T09:10:00+09:00"
      },
      {
        "id": "dummy-chat-budget-schedule",
        "display_title": "법률 개정 일정에 따른 예산 집행 계획",
        "agent": "report_generator",
        "created_at": "2026-10-15T16:30:00+09:00"
      },
      {
        "id": "dummy-chat-report-summary",
        "display_title": "국회 질의 답변서 검토 사항 정리",
        "agent": "report_generator",
        "created_at": "2026-10-15T15:00:00+09:00"
      },
      {
        "id": "dummy-chat-meeting",
        "display_title": "예산 검토 회의에서 확인할 사항",
        "agent": "chat",
        "created_at": "2026-10-15T14:00:00+09:00"
      },
      {
        "id": "dummy-chat-checklist",
        "display_title": "업무 자료 검토 체크리스트",
        "agent": "chat",
        "created_at": "2026-10-15T13:00:00+09:00"
      },
      {
        "id": "dummy-chat-project-scope",
        "project_id": "dummy-project-add",
        "display_title": "목업기준? 개발기준?",
        "agent": "chat",
        "created_at": "2026-10-16T10:00:00+09:00"
      }
    ],
    // preview_file만 정적 미리보기용입니다. API의 action.sources에는 개발 응답 필드만 전달합니다.
    "sourceDocuments": [
      {
        "doc_id": "dummy-chat-source-execution",
        "title": "251105 최형두 6번(1).hwp",
        "score": 52.6,
        "member_name": "최형두",
        "party": "국민의힘",
        "answerer": "검토 담당자",
        "answerer_org": "예산정책과",
        "preview_file": "budget-execution.pdf"
      },
      {
        "doc_id": "dummy-chat-source-review",
        "title": "251109 최형두 16번(1).hwp",
        "score": 52.5,
        "member_name": "최형두",
        "party": "국민의힘",
        "answerer": "검토 담당자",
        "answerer_org": "예산정책과",
        "preview_file": "budget-review.pdf"
      },
      {
        "doc_id": "dummy-chat-source-management",
        "title": "251110 예산집행 점검 참고자료.hwp",
        "score": 51.8,
        "answerer": "검토 담당자",
        "answerer_org": "재정관리과",
        "preview_file": "budget-management.pdf"
      }
    ],
    // 이력별 내용은 한 곳에서 관리하며 dummy-api.js가 기존 role/content/metadata 형식으로 응답합니다.
    "scenarios": {
      "dummy-chat-budget-execution": {
        "question": "예산집행",
        "answer": "예산집행 관련 답변서 초안입니다.\n\n정부는 신규 사업의 예산 편성 및 집행에 앞서 관련 법률의 제·개정 진행 상황을 확인하고, 사업별 추진 일정과 필요한 절차를 함께 검토할 계획입니다.\n\n법적 근거 마련이 지연되는 사업은 관계 부처와 집행 가능 시점 및 후속 조치를 점검하고, 집행 상황을 지속적으로 관리하겠습니다.",
        "source_ids": ["dummy-chat-source-execution", "dummy-chat-source-review", "dummy-chat-source-management"]
      },
      "dummy-chat-budget-review": {
        "question": "신규 사업의 예산 편성 전에 법률 제·개정 완료 여부를 어떻게 확인하는지 답변서를 작성해줘.",
        "answer": "신규 사업 예산 편성 관련 답변서 초안입니다.\n\n사업별 법적 근거와 법률 제·개정 진행 상황을 검토하고, 소관 부처 및 관계 기관과 추진 일정을 확인하겠습니다.\n\n예산 편성 이후에도 선행 절차의 완료 여부를 확인할 수 있도록 사업별 점검 항목과 담당 부서를 정리할 계획입니다.",
        "source_ids": ["dummy-chat-source-execution", "dummy-chat-source-review"]
      },
      "dummy-chat-budget-management": {
        "question": "예산 집행이 부진한 사업의 점검 및 관리 방안을 정리해줘.",
        "answer": "예산 집행 관리 방안에 대한 답변서 초안입니다.\n\n집행 실적과 추진 일정을 비교해 지연 원인을 확인하고, 사업별 보완 사항을 정리하겠습니다.\n\n관계 부처와 정기적으로 진행 상황을 점검하고 필요한 후속 조치를 관리하겠습니다.",
        "source_ids": ["dummy-chat-source-management"]
      },
      "dummy-chat-budget-schedule": {
        "question": "법률 개정이 늦어질 경우 예산 집행 계획은 어떻게 조정하는지 알려줘.",
        "answer": "법률 개정 일정과 예산 집행 계획에 대한 답변서 초안입니다.\n\n법률 개정 진행 상황과 사업 추진 일정을 함께 검토하겠습니다. 선행 절차가 필요한 사업은 절차 완료 여부를 확인한 뒤 집행 시점과 후속 조치를 검토할 계획입니다.",
        "source_ids": ["dummy-chat-source-execution", "dummy-chat-source-review"]
      },
      "dummy-chat-report-summary": {
        "question": "국회 질의 답변서 제출 전에 확인할 내용을 간단히 정리해줘.",
        "answer": "답변서 검토 항목입니다.\n\n1. 질의의 쟁점과 답변 내용이 일치하는지 확인합니다.\n2. 인용한 자료의 작성 시점과 출처를 확인합니다.\n3. 사업별 법적 근거 및 추진 일정을 담당 부서와 확인합니다.\n4. 참고 자료와 답변서의 수치·명칭을 대조합니다.",
        "source_ids": ["dummy-chat-source-execution", "dummy-chat-source-review", "dummy-chat-source-management"]
      },
      "dummy-chat-meeting": {
        "question": "예산 검토 회의에서 확인할 사항을 정리해줘.",
        "answer": "예산 검토 회의에서는 다음 사항을 확인해 보세요.\n\n- 사업별 추진 일정과 집행 현황\n- 법적 근거 및 선행 절차의 완료 여부\n- 지연 사유와 후속 조치\n- 담당 부서별 확인 사항과 회신 일정"
      },
      "dummy-chat-checklist": {
        "question": "업무 자료를 검토할 때 쓸 체크리스트를 만들어줘.",
        "answer": "업무 자료 검토 체크리스트입니다.\n\n- 제목과 작성일 확인\n- 최신 자료 및 변경 이력 확인\n- 인용 수치와 출처 대조\n- 담당 부서 확인\n- 검토 의견과 후속 조치 정리"
      },
      "dummy-chat-project-scope": {
        "question": "프로젝트 화면은 목업 기준으로 확인하면 될까, 개발 기준으로 확인하면 될까?",
        "answer": "화면 구성과 버튼 동작은 목업으로 확인하고, 실제 데이터 저장과 API 응답은 개발 연동 후 확인하면 됩니다.\n\n프로젝트 이름 옆 더보기 메뉴에서 세부사항을 수정하거나 프로젝트를 삭제할 수 있습니다. 이 미리보기에서 변경한 내용은 새로고침하면 초기화됩니다."
      }
    }
    // End: 261016 수정 - 개발 렌더러용 채팅 이력·본문·참고 파일 예시
  },
  "messages": {
    "answer": "미리보기용 답변서가 생성되었습니다. 답변서 초안 탭에서 예시를 확인할 수 있습니다.",
    "chat": "미리보기용 응답입니다. 실제 AI 답변은 서버 연동 시 제공됩니다."
  }
};
