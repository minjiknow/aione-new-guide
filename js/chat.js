/**
 * 261028 누적 변경 요약 (현재 구현 기준)
 * - 홈 질문·첨부 전달과 일반 채팅의 API/SSE·대화 목록·메뉴를 처리합니다. 복사·평가·재검색·오류신고는 공통 답변 액션 UI에 연결합니다.
 *
 * AI-ONE 일반 채팅 (홈 입력창 · 작업 선택 "일반 대화")
 *
 * 역할
 * - 홈의 질문·첨부 전달과 챗봇의 대화·SSE 응답 표시를 처리한다.
 * - 대화 목록·프로젝트·내부자료 검색과 모델·작업 메뉴를 관리한다.
 * - 공통 답변 액션 UI에 피드백·복사·재검색·오류신고 API를 연결한다.
 *
 * 적용 페이지: html/chatbot.html(inline), html/home.html(handoff).
 * 주석 정리 기준일: 261016. 기존 추가·수정 날짜 구간은 유지합니다.
 * 파일 구성: 예시는 js/dummy, 고정 UI는 chatbot.html의 template, 동작은 이 파일에서 관리한다.
 * 변경 내용 · 관련 함수
 * [정적 UI] getChatTemplateHtml, addUserMessage, addAssistantMessage, buildPreviewPanel, createSearchMessage
 * [사용자 표시] renderChatUser: AIOneChatConfig.user를 기존 사용자 영역에 표시한다.
 * [모델·작업 메뉴] initComposerControls, initChatMenuPosition, initTaskSubmenu: 선택값·메뉴 위치·입력 이벤트를 연결한다.
 * [답변 액션] addAssistantMessage, applyFeedbackState, handleAction, openChatIssue
 * - 버튼 생성·오류신고 모달은 common.js의 AIOneChatMessageActions, 스타일은 common.css를 사용한다.
 * - 첨부 업로드는 챗봇 ND_uploadFile.do, 오류신고 접수는 cfg.issueBaseUrl의 ND_customer.do로 요청한다.
 * [사이드바] initSidebarToggle: 데스크톱 56px 접힘과 모바일 오버레이 상태를 분리한다.
 * - 261021 - 접힌 검색은 활성 표시와 기존 검색창·목록을 사용하며 사이드바 폭을 유지한다.
 * - 261021 - 검색 활성 중에는 일반 메뉴의 is-primary를 해제하고 검색을 닫으면 복원한다.
 * - 261021 - Work·Chat 모드 클릭은 사이드바를 펼치고 일반 메뉴 클릭은 접힘 상태를 유지한다.
 * - 261021 - 일반 홈 메뉴 이동 시 접힘 상태를 홈 사이드바에 한 번 전달한다.
 * [더미/실제 응답] dummy-api.js가 미리보기에서만 fetch를 대체하며 이 파일의 API 경로는 유지한다.
 *
 * 261019 서버 적용 (퍼블 261016판 + 운영 반영분 합침)
 *  - 국회답변초안생성(answer) 작업 숨김 : removeHiddenTasks · hasTaskMenu (AIOneChatConfig.hiddenTasks 로 바꿈)
 *  - 더보기 메뉴 "목록 고정" · 프로젝트 "프로젝트 설정" · 프로젝트 이름 바꾸기(openProjectRename)
 *  - 단축 메뉴의 "AI-ONE 챗봇" 아이콘을 눌러도 챗봇 메뉴를 다시 펼친다
 *  - 답변 액션 · 오류신고 : common.js 의 AIOneChatMessageActions 가 없으면 이 파일의 대체 버튼 · 신고 창을 쓴다
 *  - 표 · 코드 복사 막대 색을 테마 변수(--surface · --border · --text …)로 맞춤 (다크 모드)
 *  - 공통 사이드바와 나란히 두기 옵션(sidebarSideBySide) · 접힘 중 로고 안내 · common.js 없을 때 불러오기 (첫 번째 운영판에서 옮김)
 *
 * 서버 : ChatController (/intra/ai/chat/ND_*.do)
 * 흐름 : (첨부 업로드 ND_uploadFile) → 대화 생성 ND_createConversation(첫 질문 때 1회)
 *        → 질문 전송 ND_send (SSE 스트림을 받는 대로 화면에 그림) → 좋아요·싫어요 ND_feedback
 *
 * 화면 요소는 아래 기본 선택자로 찾는다. 다르면 window.AIOneChatConfig.selectors 로 바꾼다.
 *   #chatInput · #chatSendBtn · #chatAttachBtn · #chatFileInput · #chatAttachList · #chatMessages
 * 작업 선택이 "일반 대화"가 아닐 때는 [data-chat-task-current] 값을 보고 전송을 가로채지 않는다.
 *
 * 동작 방식 (cfg.mode)
 *   - 'inline'  : 이 화면에서 바로 대화한다 (챗봇 화면 MD_chatbot.do)
 *   - 'handoff' : 질문·첨부를 sessionStorage 에 담아 챗봇 화면으로 넘긴다 (홈 화면 MD_home.do)
 *                 챗봇 화면은 열리자마자 넘겨받은 질문을 보낸다.
 * 챗봇 화면에 #chatHistoryList · #chatHistorySearch · #chatNewBtn 이 있으면 대화 목록·검색·새 채팅도 처리한다.
 *
 * 대화 목록 항목의 더보기(⋮) 메뉴 : 고정하기·고정 해제(ND_conversationFavorite) · 이름 바꾸기(ND_updateChatTitle) · 프로젝트로 이동(ND_moveConversation) · 삭제(ND_deleteChat)
 * 프로젝트(#projectList · #projectView) : 목록 · 만들기 · 수정 · 삭제 · 맞춤형 지침 · 파일 · 프로젝트 대화 (명세 v1.0 No.2~14)
 *   메뉴·모달 마크업(#chatHistoryActionMenu · #chatRenameModal · #chatDeleteModal)이 있는 화면에서만 켜진다.
 * 챗봇 화면은 전용 계정 메뉴 표시·클릭 처리를 사용하며 모달·로그아웃은 공통 기능과 연결한다.
 *
 * 답변 본문 : 마크다운(일부) · HTML · 수식(LaTeX: $…$, $$…$$, \(…\), \[…\]) 을 그린다.
 * 내부자료 검색 : 작업 선택이 search 면 지능화검색(ND_search.do)으로 파일을 찾아 결과 카드로 보여 준다.
 * 응답 완료 알림 : 환경설정의 "응답 완료 알림"이 켜져 있으면 새 대화의 답변 · 탭이 가려진 동안 끝난 답변에 목록 파란 점을 띄운다.
 *
 * 외부에서 쓰는 API : window.AIOneChat.send(text) · loadConversation(id) · newConversation() · loadHistory() · debug(on)
 *
 * 콘솔 로그 (주고받는 값 확인용, 기본 꺼짐)
 *   켜기 : 주소에 ?chatDebug=Y (이미 ? 가 있으면 &chatDebug=Y) 를 붙여 한 번 열거나, 콘솔에서 AIOneChat.debug(true)
 *   끄기 : ?chatDebug=N 또는 AIOneChat.debug(false)   (이 브라우저 localStorage 에 기억된다)
 * [261020 변경 내용 · 관련 함수]
 * [표·코드 복사] ensureBlockCopyStyle: 공통 AIOneChatBlocks와 홈·챗봇 복사 도구줄 스타일을 연결합니다.
 *
 * [261021 추가·수정 - 홈 입력창 줄바꿈 배치]
 * - 적용 범위: .page > .home-prompt-composer #chatComposerForm. 챗봇 입력창은 제외한다.
 * - initHomeComposerLayout: 한 줄 배치의 너비로 자동 줄바꿈·개행을 측정해 form의 is-multiline을 전환한다.
 * - 한 줄은 가로 배치, 두 줄 이상은 입력란 위 / 버튼 아래로 배치하며, 다시 한 줄이면 복귀한다.
 * - 격리된 측정용 textarea로 줄 수를 계산하고 실제 높이가 바뀔 때만 --composer-input-height를 갱신한다(최대 200px).
 * - init에서 초기화하고 updateSendButton의 syncHomeComposerLayout 호출로 입력·내용 초기화를 반영한다.
 * - ResizeObserver와 폰트 로딩 완료 시에도 재측정한다. 펼친 상태에서도 한 줄 배치 너비를 기준으로 판단한다.
 * - 함께 반영: css/chat.css의 '홈 입력창: 내용에 따라 한 줄 / 여러 줄 배치를 전환한다' 블록과 홈 textarea의 rows="1".
 * - 홈의 기존 인라인 input 높이 이벤트와 resizeInput 함수·호출은 제거한 상태를 유지해 중복 계산을 막는다.
 * - 261022 주석 보완 - 프로젝트 이름 변경 구간의 제목을 맞추고 모바일 헤더 스크롤 상태 구간을 표시했다.
 * [모바일 헤더] initSidebarToggle: 대화 스크롤에 따라 is-scrolled를 전환하며 배경은 chat.css에서 관리한다.
 *
 * 기본 구간 형식: Start: 기능명 / End: 기능명
 * 변경 구간 형식: Start: YYMMDD 추가/수정 - 기능명 / End: YYMMDD 추가/수정 - 기능명
 * 주석 정리 내역
 * - 261023 주석 정리 - 구간 표시와 변경 내용 표기를 통일합니다. 기존 작업 날짜와 기능 설명은 유지합니다.
 */
(function () {
    "use strict";

    // Start: 261016 추가 - 정적 UI 템플릿 연결
    // 고정 마크업은 chatbot.html에서 관리한다. 서버 값은 escapeHtml/textContent로 따로 채운다.
    // 홈의 handoff 모드에서는 메시지·검색·미리보기 템플릿을 사용하지 않는다.
    function getChatTemplateHtml(id) {
        const template = document.getElementById(id);
        if (!(template instanceof HTMLTemplateElement)) throw new Error(`[chat] UI 템플릿을 찾을 수 없습니다: ${id}`);
        return template.innerHTML.trim();
    }
    // End: 261016 추가 - 정적 UI 템플릿 연결

    const cfg = Object.assign(
        {
            baseUrl: "/intra/ai/chat/",
            // 오류신고는 답변서 초안에서 사용 중인 문의 API에 연결한다.
            issueBaseUrl: "/intra/ai/answer/",
            mode: "inline", // 'inline' | 'handoff'
            chatbotUrl: "/intra/ai/chat/MD_chatbot.do", // handoff 모드에서 이동할 챗봇 화면
            maxFiles: 5,
            // 답변 타이핑 효과: 받은 글을 한꺼번에 그리지 않고 채팅하듯 조금씩 보여 준다 (panel-conversation.js 타이핑 방식 참고)
            //   typingUnit : 'char' = 글자 단위로 흘러나옴 · 'line' = 한 줄(줄바꿈)씩 나타남
            //   typingCps    : 최저 속도 (초당 글자 수). 답변이 느리게 올 때도 이 속도로 한 자씩 써진다
            //   typingLagMs  : 화면이 받은 글보다 최대 이만큼만 뒤처지게 한다 (서버가 빨리 보내면 그만큼 빨리 써진다)
            //                  → 타이핑 때문에 답변 완료가 늦어지지 않는다 (예전: 초당 120자 상한 때문에 20초 넘게 늦어짐)
            //   typingCatchupMs : 받기가 끝난 뒤 남은 글을 이 시간 안에 다 보여 준다
            //   typingCaret  : 타이핑 중 글 끝에 깜빡이는 커서 표시
            //   typingTickMs : 화면을 고치는 간격 (긴 답변은 자동으로 늘려 화면이 버벅이지 않게) · typingLineMs : 'line' 일 때 줄 사이 간격
            typing: true,
            typingUnit: "char",
            typingCps: 45,
            typingLagMs: 1000,
            typingCatchupMs: 1200,
            typingCaret: true,
            typingTickMs: 33,
            typingLineMs: 90,
            allowedExt: [".pdf", ".hwp", ".hwpx", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".png", ".jpg", ".jpeg", ".gif", ".bmp"],
            // 지금 고른 작업이 일반 대화인지. 작업 선택 메뉴가 [data-chat-task-current="chat"] 처럼 값을 남기면 그 값을 본다.
            // 이 스크립트가 직접 보내는 작업인지. 챗봇 화면(inline)은 일반 대화 + 국회답변서초안생성,
            // 홈(handoff)은 일반 대화만 맡고 나머지 작업은 chatScript.jsp 가 각 화면으로 보낸다.
            // 챗봇 화면은 내부자료 검색(search)도 이 스크립트가 맡는다 (지능화검색 ND_search.do)
            isChatTask: () => (cfg.mode === "handoff" ? currentTask() === "chat" : Object.prototype.hasOwnProperty.call(TASK_AGENTS, currentTask()) || currentTask() === "search"),
            // 모델 선택값 (예: "AI-ONE AI" 메뉴가 [data-chat-model="gemma-4"] 를 남기면 그 값을 보낸다. 없으면 기본 모델)
            getModel: () => document.querySelector("[data-chat-model]")?.getAttribute("data-chat-model") || "",
        },
        window.AIOneChatConfig || {},
    );

    const sel = Object.assign(
        {
            root: "[data-chat-root]",
            input: "#chatInput",
            sendBtn: "#chatSendBtn",
            attachBtn: "#chatAttachBtn",
            fileInput: "#chatFileInput",
            attachList: "#chatAttachList",
            messages: "#chatMessages",
            historyList: "#chatHistoryList",
            historySearch: "#chatHistorySearch",
            newBtn: "#chatNewBtn",
            composer: "[data-chat-model]",
        },
        cfg.selectors || {},
    );

    /** 홈 → 챗봇 화면으로 질문을 넘길 때 쓰는 sessionStorage 키 (같은 탭에서만 읽힌다) */
    const HANDOFF_KEY = "aiOneChatHandoff";
    /** 넘겨받은 질문의 유효 시간 (뒤로 가기 등으로 오래된 질문이 다시 보내지지 않게) */
    const HANDOFF_TTL = 5 * 60 * 1000;

    /*
     * 작업 선택 → AI 에이전트 (ND_createConversation · ND_send 의 agent 값, 서버 ChatController.AGENTS 와 맞춘다)
     *   chat   (일반 대화)            → chat              일반 채팅 에이전트
     *   answer (국회답변서초안생성)    → report_generator  국회질의 보고서생성 에이전트
     * 대화는 만들 때의 에이전트에 묶인다. 대화 중 작업을 바꿔 보내면 새 대화로 시작한다.
     * 목록에서 대화를 열면 그 대화의 에이전트에 맞춰 작업 선택도 바꾼다.
     */
    const TASK_AGENTS = Object.assign({ chat: "chat", answer: "report_generator" }, cfg.taskAgents || {});
    const AGENT_TASKS = Object.keys(TASK_AGENTS).reduce((map, task) => {
        map[TASK_AGENTS[task]] = task;
        return map;
    }, {});
    const AGENT_BADGES = Object.assign({ report_generator: "답변서" }, cfg.agentBadges || {});

    function currentTask() {
        return document.querySelector("[data-chat-task-current]")?.getAttribute("data-chat-task-current") || "chat";
    }
    // 프로젝트 안에서는 늘 일반 채팅(chat) — 프로젝트 에이전트가 chat 이고, 메시지의 prompt_type_option 도 이 값이어야 지침 · 파일이 붙는다 (명세 No.18)
    const currentAgent = () => (cfg.mode === "handoff" || state.projectId ? "chat" : TASK_AGENTS[currentTask()] || "chat");

    /** 작업 선택 메뉴를 바꾼다 (메뉴 항목 클릭과 같게 — 표시 글자·입력창 안내문은 chatScript.jsp 가 맞춘다) */
    /** 작업 선택 메뉴에 있는 작업인지 (국회답변초안생성은 2026.10.16 메뉴에서 제외) */
    const hasTaskMenu = (task) => !!document.querySelector(`[data-chat-menu="task"] [data-menu-value="${task}"]`);
    /** 메뉴에서 뺄 작업 (chatComposer.jsp 가 정적 include 라 예전 항목이 남아 있어도 화면에서 지운다). 다시 쓰려면 AIOneChatConfig.hiddenTasks = [] */
    const HIDDEN_TASKS = Array.isArray(window.AIOneChatConfig?.hiddenTasks) ? window.AIOneChatConfig.hiddenTasks : ["answer"];
    function removeHiddenTasks() {
        HIDDEN_TASKS.forEach((task) => {
            document.querySelectorAll(`[data-chat-menu="task"] [data-menu-value="${task}"]`).forEach((item) => item.remove());
        });
    }

    function selectTask(task) {
        if (!task || currentTask() === task) return;
        const item = document.querySelector(`[data-chat-menu="task"] [data-menu-value="${task}"]`);
        if (item) item.click();
        // 메뉴가 없는 화면에서도 API 작업 상태는 유지한다.
        const holder = document.querySelector("[data-chat-task-current]");
        if (holder && currentTask() !== task) holder.dataset.chatTaskCurrent = task;
    }

    const state = {
        conversationId: null,
        agent: null, // 지금 대화의 에이전트 value (chat · report_generator)
        projectId: null, // 열린 프로젝트 ID (프로젝트 화면 또는 프로젝트 대화). 없으면 일반 채팅
        files: [], // { key, name, status: 'uploading'|'ready'|'failed', obj }
        streaming: false,
        abort: null,
        streamConversationId: null, // 답변을 받고 있는 대화 (다른 대화를 보는 동안에도 뒤에서 계속 받는다)
    };

    const $ = (s) => document.querySelector(s);
    const el = {};

    /**
     * 화면 주소의 쿼리. 이미 ?가 있는 주소 뒤에 ?chatDebug=Y 처럼 ?를 또 붙여도 읽히도록 두 번째 ? 부터는 & 로 본다.
     *   예) MD_chatbot.do?conversationId=abc?chatDebug=Y → conversationId=abc · chatDebug=Y
     */
    const pageQuery = () => new URLSearchParams(window.location.search.replace(/(?!^)\?/g, "&"));

    // Start: 콘솔 로그 (디버그)
    const DEBUG_KEY = "aiOneChatDebug";
    let debugOn = (() => {
        if (cfg.debug != null) return !!cfg.debug;
        try {
            const q = pageQuery().get("chatDebug");
            if (q) window.localStorage.setItem(DEBUG_KEY, q.toUpperCase() === "Y" ? "Y" : "N");
            return window.localStorage.getItem(DEBUG_KEY) === "Y";
        } catch (e) {
            return false;
        }
    })();

    const LOG_STYLE = "color:#2563eb;font-weight:bold";
    function log(...args) {
        if (debugOn) console.log("%c[chat]", LOG_STYLE, ...args);
    }

    function setDebug(on) {
        debugOn = !!on;
        try {
            window.localStorage.setItem(DEBUG_KEY, debugOn ? "Y" : "N");
        } catch (e) {
            /* 무시 */
        }
        console.info("[chat] 콘솔 로그 " + (debugOn ? "켜짐" : "꺼짐"));
        return debugOn;
    }

    /** 요청 본문을 콘솔에서 보기 좋은 객체로 바꾼다 (폼 문자열 → 객체, 파일 → 이름·크기) */
    function describeBody(body) {
        if (body == null) return undefined;
        try {
            if (typeof body === "string") {
                const obj = Object.fromEntries(new URLSearchParams(body));
                if (obj.files) {
                    try {
                        obj.files = JSON.parse(obj.files);
                    } catch (e) {
                        /* 문자열 그대로 */
                    }
                }
                return obj;
            }
            if (body instanceof FormData) {
                return Array.from(body.entries()).map(([key, value]) => (value instanceof File ? { key, name: value.name, size: value.size, type: value.type } : { key, value }));
            }
        } catch (e) {
            /* 무시 */
        }
        return body;
    }

    const elapsed = (started) => `${Math.round(performance.now() - started)}ms`;

    // End: 콘솔 로그 (디버그)

    // Start: 공통
    const url = (name, baseUrl = cfg.baseUrl) => baseUrl.replace(/\/?$/, "/") + name;

    function toast(message) {
        const common = window.AIOneWorkspaceCommon;
        if (typeof cfg.toast === "function") cfg.toast(message);
        else if (common?.showToast) common.showToast(message);
        else window.alert(message);
    }

    /** 오류 안내 문구: 앞에 "오류가 발생했습니다." 를 붙인다 (이미 붙어 있으면 그대로) */
    const ERROR_PREFIX = "오류가 발생했습니다.";
    function errorText(message) {
        const text = String(message || "").trim();
        if (!text) return ERROR_PREFIX;
        return text.startsWith(ERROR_PREFIX) ? text : `${ERROR_PREFIX} ${text}`;
    }

    function escapeHtml(value) {
        // 퍼블 common.js 의 공통 함수를 쓰고, 없으면(공통 스크립트가 예전 판) 여기서 바꾼다 (261019)
        if (typeof window.AIOneWorkspaceCommon?.escapeHtml === "function") return window.AIOneWorkspaceCommon.escapeHtml(value);
        return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
    }

    function apiData(result) {
        if (result && result.success === false) throw new Error(result.message || "요청 처리에 실패했습니다.");
        return result && Object.prototype.hasOwnProperty.call(result, "data") ? result.data : result;
    }

    async function fetchJson(name, options, baseUrl = cfg.baseUrl) {
        const started = performance.now();
        const method = (options && options.method) || "GET";
        log(`→ ${method} ${name}`, describeBody(options && options.body));
        const response = await fetch(url(name, baseUrl), Object.assign({ cache: "no-store", credentials: "same-origin" }, options || {}));
        const text = await response.text();
        if (!response.ok) {
            log(`← ${name} 실패 HTTP ${response.status} ${elapsed(started)}`, text.slice(0, 1000));
            throw new Error(`요청 실패 (${response.status})`);
        }
        let parsed;
        try {
            parsed = text ? JSON.parse(text) : null;
        } catch (error) {
            log(`← ${name} JSON 아님 ${elapsed(started)}`, text.slice(0, 1000));
            throw new Error("세션이 만료되었거나 응답이 올바르지 않습니다. 다시 로그인해 주세요.");
        }
        log(`← ${name} ${response.status} ${elapsed(started)}`, parsed);
        return text ? apiData(parsed) : null;
    }

    function formBody(params) {
        const body = new URLSearchParams();
        Object.entries(params || {}).forEach(([key, value]) => {
            if (value != null) body.append(key, value);
        });
        return body;
    }

    const postForm = (name, params, signal) =>
        fetchJson(name, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
            body: formBody(params).toString(),
            signal,
        });

    const toList = (data) => (Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : Array.isArray(data?.data) ? data.data : []);

    // End: 공통

    // Start: 답변 본문 그리기
    const BLOCKED_TAGS = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "LINK", "META", "BASE", "FORM", "INPUT", "BUTTON", "TEXTAREA", "SELECT", "FRAME", "FRAMESET", "SVG", "MATH"]);

    /** 에이전트가 HTML 로 답한 경우: 스크립트·이벤트 속성·javascript: 링크를 걷어 낸다 */
    function sanitizeHtml(html) {
        const template = document.createElement("template");
        template.innerHTML = html;
        const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_ELEMENT);
        const remove = [];
        while (walker.nextNode()) {
            const node = walker.currentNode;
            if (BLOCKED_TAGS.has(node.tagName)) {
                remove.push(node);
                continue;
            }
            Array.from(node.attributes).forEach((attr) => {
                const name = attr.name.toLowerCase();
                const value = attr.value.trim().toLowerCase();
                if (name.startsWith("on") || name === "srcdoc" || ((name === "href" || name === "src" || name === "xlink:href" || name === "action") && /^(javascript|vbscript|data:text)/.test(value))) {
                    node.removeAttribute(attr.name);
                }
            });
            if (node.tagName === "A") {
                node.setAttribute("target", "_blank");
                node.setAttribute("rel", "noopener noreferrer");
            }
        }
        remove.forEach((node) => node.remove());
        return template.innerHTML;
    }

    // End: 답변 본문 그리기

    // Start: 수식(LaTeX) 표시
    /*
     * AI 답변에 섞여 오는 LaTeX 를 읽을 수 있는 글자로 바꾼다. (외부 라이브러리 없이 동작)
     *   $...$ · $$...$$ · \( ... \) · \[ ... \]  안쪽만 처리한다.
     *   - 글자 꾸밈 : \mathbf · \textbf → 굵게, \textit · \emph → 기울임, \text · \mathrm → 그대로
     *   - 수식      : x^2 · a_{i} → 위·아래 첨자, \frac{a}{b} → a/b, \sqrt{x} → √x, \times · \le · \alpha … → ×, ≤, α …
     *   - 괄호가 짝이 안 맞거나 $ 가 $$ 로 끝나는 등 깨진 수식도 남는 기호 없이 보이게 한다.
     *   - "$5 와 $10" 같은 금액은 수식으로 보지 않는다 ($ 안쪽에 \ ^ _ { 가 있을 때만 수식).
     *   - 코드 블록(```) · 인라인 코드(`)  안의 $ 는 건드리지 않는다.
     */
    const TEX_SYMBOLS = {
        times: "×",
        cdot: "·",
        div: "÷",
        pm: "±",
        mp: "∓",
        ast: "∗",
        star: "⋆",
        circ: "∘",
        bullet: "•",
        le: "≤",
        leq: "≤",
        ge: "≥",
        geq: "≥",
        ne: "≠",
        neq: "≠",
        approx: "≈",
        sim: "∼",
        simeq: "≃",
        equiv: "≡",
        propto: "∝",
        ll: "≪",
        gg: "≫",
        lt: "<",
        gt: ">",
        to: "→",
        rightarrow: "→",
        leftarrow: "←",
        leftrightarrow: "↔",
        Rightarrow: "⇒",
        Leftarrow: "⇐",
        Leftrightarrow: "⇔",
        implies: "⇒",
        iff: "⇔",
        mapsto: "↦",
        uparrow: "↑",
        downarrow: "↓",
        infty: "∞",
        partial: "∂",
        nabla: "∇",
        sum: "∑",
        prod: "∏",
        int: "∫",
        oint: "∮",
        in: "∈",
        notin: "∉",
        ni: "∋",
        subset: "⊂",
        subseteq: "⊆",
        supset: "⊃",
        supseteq: "⊇",
        cup: "∪",
        cap: "∩",
        emptyset: "∅",
        varnothing: "∅",
        forall: "∀",
        exists: "∃",
        neg: "¬",
        lnot: "¬",
        land: "∧",
        wedge: "∧",
        lor: "∨",
        vee: "∨",
        angle: "∠",
        perp: "⊥",
        parallel: "∥",
        therefore: "∴",
        because: "∵",
        degree: "°",
        ldots: "…",
        dots: "…",
        cdots: "⋯",
        vdots: "⋮",
        ddots: "⋱",
        langle: "⟨",
        rangle: "⟩",
        lfloor: "⌊",
        rfloor: "⌋",
        lceil: "⌈",
        rceil: "⌉",
        vert: "|",
        mid: "|",
        Vert: "‖",
        prime: "′",
        hbar: "ℏ",
        ell: "ℓ",
        Re: "ℜ",
        Im: "ℑ",
        aleph: "ℵ",
        alpha: "α",
        beta: "β",
        gamma: "γ",
        delta: "δ",
        epsilon: "ε",
        varepsilon: "ε",
        zeta: "ζ",
        eta: "η",
        theta: "θ",
        vartheta: "ϑ",
        iota: "ι",
        kappa: "κ",
        lambda: "λ",
        mu: "μ",
        nu: "ν",
        xi: "ξ",
        pi: "π",
        varpi: "ϖ",
        rho: "ρ",
        varrho: "ϱ",
        sigma: "σ",
        varsigma: "ς",
        tau: "τ",
        upsilon: "υ",
        phi: "φ",
        varphi: "φ",
        chi: "χ",
        psi: "ψ",
        omega: "ω",
        Gamma: "Γ",
        Delta: "Δ",
        Theta: "Θ",
        Lambda: "Λ",
        Xi: "Ξ",
        Pi: "Π",
        Sigma: "Σ",
        Upsilon: "Υ",
        Phi: "Φ",
        Psi: "Ψ",
        Omega: "Ω",
        quad: " ",
        qquad: "  ",
        space: " ",
        enspace: " ",
        thinspace: " ",
        sin: "sin",
        cos: "cos",
        tan: "tan",
        log: "log",
        ln: "ln",
        exp: "exp",
        lim: "lim",
        max: "max",
        min: "min",
        det: "det",
    };
    const TEX_STRONG = new Set(["mathbf", "textbf", "boldsymbol", "bm", "bf", "pmb"]);
    const TEX_EM = new Set(["textit", "mathit", "emph", "textsl", "it"]);
    const TEX_PLAIN = new Set([
        "text",
        "mathrm",
        "textrm",
        "mathsf",
        "textsf",
        "mathtt",
        "texttt",
        "textnormal",
        "operatorname",
        "mbox",
        "hbox",
        "mathbb",
        "mathcal",
        "mathscr",
        "mathfrak",
        "overline",
        "widehat",
        "hat",
        "bar",
        "vec",
        "tilde",
        "widetilde",
        "dot",
        "ddot",
    ]);
    const TEX_IGNORE = new Set([
        "left",
        "right",
        "big",
        "Big",
        "bigg",
        "Bigg",
        "bigl",
        "bigr",
        "Bigl",
        "Bigr",
        "biggl",
        "biggr",
        "displaystyle",
        "textstyle",
        "scriptstyle",
        "limits",
        "nolimits",
        "nonumber",
        "notag",
        "label",
        "tag",
        "quad!",
        "mathstrut",
        "strut",
        "centering",
    ]);

    /** LaTeX 조각 → 안전한 HTML (모든 글자는 escapeHtml 을 거친다) */
    function texToHtml(tex) {
        const s = String(tex);
        let i = 0;

        const readGroup = () => {
            while (s[i] === " ") i++;
            if (i >= s.length) return "";
            if (s[i] === "{") {
                i++;
                const html = parseUntil("}");
                if (s[i] === "}") i++;
                return html;
            }
            if (s[i] === "\\") return parseCommand();
            return escapeHtml(s[i++]);
        };

        const parseCommand = () => {
            i++; // '\' 건너뜀
            if (i >= s.length) return "";
            let name;
            if (/[A-Za-z]/.test(s[i])) {
                const start = i;
                while (i < s.length && /[A-Za-z]/.test(s[i])) i++;
                name = s.slice(start, i);
            } else {
                name = s[i++];
            }
            if (name === "\\") return "<br>"; // 줄바꿈 \\
            if (",;: ".includes(name)) return " ";
            if (name === "!") return "";
            if ("%&$#_{}".includes(name)) return escapeHtml(name);
            if (TEX_STRONG.has(name)) return `<strong>${readGroup()}</strong>`;
            if (TEX_EM.has(name)) return `<em>${readGroup()}</em>`;
            if (name === "underline") return `<u>${readGroup()}</u>`;
            if (TEX_PLAIN.has(name)) return readGroup();
            if (name === "frac" || name === "dfrac" || name === "tfrac" || name === "cfrac") {
                const a = readGroup();
                const b = readGroup();
                const wrap = (v) => (v.replace(/<[^>]+>/g, "").length > 1 ? `(${v})` : v);
                return `${wrap(a)}/${wrap(b)}`;
            }
            if (name === "sqrt") {
                let root = "";
                if (s[i] === "[") {
                    const end = s.indexOf("]", i);
                    if (end > i) {
                        root = escapeHtml(s.slice(i + 1, end));
                        i = end + 1;
                    }
                }
                const v = readGroup();
                return `${root ? `<sup>${root}</sup>` : ""}√${v.replace(/<[^>]+>/g, "").length > 1 ? `(${v})` : v}`;
            }
            if (name === "begin" || name === "end") {
                readGroup();
                return name === "end" ? "<br>" : "";
            }
            if (TEX_IGNORE.has(name)) {
                if ((name === "left" || name === "right") && s[i] === ".") i++; // \left. \right. 은 보이지 않는 괄호
                return "";
            }
            if (Object.prototype.hasOwnProperty.call(TEX_SYMBOLS, name)) return TEX_SYMBOLS[name];
            return escapeHtml(name); // 모르는 명령은 이름만 글자로
        };

        const parseUntil = (stop) => {
            let out = "";
            while (i < s.length) {
                const c = s[i];
                if (stop && c === stop) return out;
                if (c === "{") {
                    i++;
                    out += parseUntil("}");
                    if (s[i] === "}") i++;
                    continue;
                }
                if (c === "}") {
                    i++;
                    continue;
                } // 짝 없는 닫는 괄호는 버린다
                if (c === "\\") {
                    out += parseCommand();
                    continue;
                }
                if (c === "^") {
                    i++;
                    out += `<sup>${readGroup()}</sup>`;
                    continue;
                }
                if (c === "_") {
                    i++;
                    out += `<sub>${readGroup()}</sub>`;
                    continue;
                }
                if (c === "$") {
                    i++;
                    continue;
                } // 남은 수식 기호는 버린다
                if (c === "~") {
                    i++;
                    out += " ";
                    continue;
                }
                if (c === "&") {
                    i++;
                    out += " ";
                    continue;
                } // 정렬 기호
                out += escapeHtml(c);
                i++;
            }
            return out;
        };

        return parseUntil(null)
            .replace(/\s{2,}/g, " ")
            .trim();
    }

    /**
     * 본문에서 수식 구간을 찾는다.
     *  1) $$ … $$   2) $$ … $ (닫는 $ 하나 — AI 가 자주 틀리는 형태)   3) \[ … \]   4) \( … \)
     *  5) $ … $  (여는 $ 뒤·닫는 $ 앞이 공백이 아니고, 닫는 $ 뒤에 숫자가 오지 않을 때)
     */
    const MATH_RE = /\$\$([\s\S]+?)\$\$|\$\$([^\n$]+?)\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$([^\s$](?:[^$\n]*?[^\s$\\])?)\$(?!\d)/g;
    const looksLikeTex = (body) => /[\\^_{}]/.test(body);

    /**
     * text 안의 수식을 HTML 로 바꿔 store 에 넣고 자리표시자로 바꾼다.
     * 자리표시자는 \u0001번호\u0001 — 마크다운 처리가 끝난 뒤 되돌린다.
     */
    function extractMath(text, store) {
        return text.replace(MATH_RE, (match, dd, dOne, br, pr, single) => {
            const body = dd ?? dOne ?? br ?? pr ?? single ?? "";
            const display = dd != null || dOne != null || br != null;
            if (single != null && !looksLikeTex(body)) return match; // 금액 등 일반 글자
            const html = texToHtml(body);
            if (!html) return "";
            store.push(`<span class="chat-math${display ? " chat-math-block" : ""}">${html}</span>`);
            return `\u0001${store.length - 1}\u0001`;
        });
    }

    const restoreMath = (html, store) => html.replace(/\u0001(\d+)\u0001/g, (m, n) => store[Number(n)] ?? "");

    /*
     * 마크다운 → HTML
     *  - marked(GFM)가 있으면 그것으로 그린다: 표(| a | b |) · 취소선 · 작업 목록 · 자동 링크 · 줄바꿈(breaks) 등 GitHub 마크다운 전체.
     *    marked.min.js 는 chatScript.jsp 가 chat.js 보다 먼저 불러온다 (/resources/intra/ai/js/marked.min.js).
     *  - 없으면(파일 누락 · AMD 로더가 가로챈 경우) 아래 내장 렌더러로 그린다 (표 포함 기본 문법).
     *  - 어느 쪽이든: 코드 · 수식(LaTeX)은 먼저 떼어 두었다가 되돌리고, 결과 HTML 은 sanitizeHtml 을 거친다.
     *  - AI 가 표 칸 구분자를 $|$ · \| 처럼 수식 모양으로 보내는 경우가 있어, 표 줄에서는 | 로 바로잡는다.
     */
    /**
     * 화면에 있는 marked 를 찾는다. 버전마다 모양이 달라 모두 받는다.
     *   v4 이상: marked.parse(src, opts) · 일부 번들: marked.marked.parse · 옛 버전(v0~3): marked(src, opts)
     * @return (src, opts) => html 문자열, 없으면 null
     */
    const getMarked = () => {
        const m = window.marked;
        if (!m) return null;
        if (typeof m.parse === "function") return { parse: (src, opts) => m.parse(src, opts) };
        if (m.marked && typeof m.marked.parse === "function") return { parse: (src, opts) => m.marked.parse(src, opts) };
        if (typeof m === "function") return { parse: (src, opts) => m(src, opts) };
        return null;
    };

    /**
     * 표 줄(| 가 2개 이상인 줄)에 섞인 수식 표기를 일반 마크다운으로 바로잡는다.
     * AI 가 표 칸에 $\mathbf{1\text{주}}$ · $|$ · \dots 같은 LaTeX 를 쓰면 $ 와 | 가 엉켜 표가 깨진다.
     *   $|$ · $\vert$ · $\mid$          → |
     *   \mathbf{X} · \textbf{X} 등      → **X**   (안의 \text{…} 는 글자만)
     *   \text{X} · \textrm{X}           → X
     *   \dots · \ldots · \cdots         → …
     *   | 옆에 붙은 $ · 비어 버린 $ … $ → 지움
     * 코드 블록(```) 안의 줄은 건드리지 않는다.
     */
    const TABLE_BOLD_RE = /\\(?:mathbf|textbf|boldsymbol|bm)\s*\{((?:[^{}]|\{[^{}]*\})*)\}/g;
    const TABLE_TEXT_RE = /\\(?:text|textrm|textnormal|mathrm)\s*\{([^{}]*)\}/g;

    function normalizeTableLine(line) {
        let fixed = line
            .replace(TABLE_BOLD_RE, (m, inner) => `**${inner.replace(TABLE_TEXT_RE, "$1").trim()}**`)
            .replace(TABLE_TEXT_RE, "$1")
            .replace(/\\[lc]?dots\b/g, "…")
            // LaTeX 가 빠져 껍데기만 남은 $ … $ (굵게 · 줄임표) → 안쪽만. 금액($100 등)은 건드리지 않는다
            .replace(/\$\s*(\*\*[^*$|]+\*\*|…)\s*\$/g, "$1")
            // 수식 모양 칸 구분자 (공백 없이 붙은 것만: "$a$ | $b$" 의 "$ | $" 는 칸 두 개다)
            .replace(/\$\|\$|\$\\vert\$|\$\\mid\$/g, "|");
        // 칸 구분자 바로 옆에 남은 $
        fixed = fixed.replace(/\$+\s*\|/g, "|").replace(/\|\s*\$+(?=\s|$)/g, "|");
        return (fixed.match(/\|/g) || []).length >= 2 ? fixed : line;
    }

    function normalizeTablePipes(src) {
        let inFence = false;
        return src
            .split("\n")
            .map((line) => {
                if (/^\s*```/.test(line)) {
                    inFence = !inFence;
                    return line;
                }
                if (inFence || (line.match(/\|/g) || []).length < 2 || !/[$\\]/.test(line)) return line;
                return normalizeTableLine(line);
            })
            .join("\n");
    }

    /** 코드 블록 · 인라인 코드 · 수식을 자리표시자로 바꿔 둔다 (마크다운 · 수식 처리에서 건드리지 않게) */
    function protectSpecial(text) {
        const store = { blocks: [], codes: [], maths: [] };
        let src = normalizeTablePipes(String(text ?? "").replace(/\r\n?/g, "\n"));
        src = src.replace(/```([\w-]*)\n?([\s\S]*?)(```|$)/g, (m, lang, code) => {
            store.blocks.push(`<pre class="chat-code" data-lang="${escapeHtml(lang || "")}"><code>${escapeHtml(code.replace(/\n$/, ""))}</code></pre>`);
            return `\n\n@@CHATBLOCK${store.blocks.length - 1}@@\n\n`;
        });
        // 인라인 코드는 수식 처리 전에 떼어 둔다 (코드 안의 $ 를 수식으로 보지 않게)
        src = src.replace(/`([^`\n]+)`/g, (m, code) => {
            store.codes.push(`<code>${escapeHtml(code)}</code>`);
            return `@@CHATCODE${store.codes.length - 1}@@`;
        });
        src = extractMath(src, store.maths).replace(/\u0001(\d+)\u0001/g, "@@CHATMATH$1@@");
        // **'강조'**에 · **흐름(Flow)**을 처럼 닫는 ** 앞이 문장부호이고 바로 뒤에 글자(조사)가 붙으면
        // 마크다운 규칙상 굵게가 닫히지 않아 ** 가 글자 그대로 보인다 → 미리 <strong> 으로 바꾼다
        src = src.replace(/\*\*(?=\S)([^*\n]*?[^\s*\w가-힣])\*\*(?=[\w가-힣])/g, "<strong>$1</strong>");
        return { src, store };
    }

    function restoreSpecial(html, store) {
        return html
            .replace(/<p>\s*@@CHATBLOCK(\d+)@@\s*<\/p>/g, (m, i) => store.blocks[Number(i)] ?? "")
            .replace(/@@CHATBLOCK(\d+)@@/g, (m, i) => store.blocks[Number(i)] ?? "")
            .replace(/@@CHATCODE(\d+)@@/g, (m, i) => store.codes[Number(i)] ?? "")
            .replace(/@@CHATMATH(\d+)@@/g, (m, i) => store.maths[Number(i)] ?? "");
    }

    /** 그린 HTML 다듬기: 제목 단계 낮추기(h1→h3 …) · 표를 가로 스크롤 상자로 감싸기 · 링크 새 창 */
    function polishHtml(html) {
        const box = document.createElement("template");
        box.innerHTML = sanitizeHtml(html);
        box.content.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach((h) => {
            const level = Math.min(6, Number(h.tagName[1]) + 2);
            if (level === Number(h.tagName[1])) return;
            const next = document.createElement(`h${level}`);
            next.innerHTML = h.innerHTML;
            h.replaceWith(next);
        });
        box.content.querySelectorAll("table").forEach((table) => {
            table.classList.add("chat-table");
            if (table.parentElement?.classList.contains("chat-table-wrap")) return;
            const wrap = document.createElement("div");
            wrap.className = "chat-table-wrap";
            table.replaceWith(wrap);
            wrap.appendChild(table);
        });
        box.content.querySelectorAll('input[type="checkbox"]').forEach((input) => input.remove()); // sanitize 에서 지워진 경우 대비
        return box.innerHTML;
    }

    function renderMarkdown(text) {
        const { src, store } = protectSpecial(text);
        const marked = getMarked();
        let html;
        if (marked) {
            try {
                html = marked.parse(src, { gfm: true, breaks: true, async: false });
                if (typeof html !== "string") html = null; // 비동기 설정 등으로 문자열이 아니면 내장 렌더러로
            } catch (error) {
                log("marked 렌더 실패 → 내장 렌더러", error);
                html = null;
            }
        }
        if (html == null) html = renderMarkdownBasic(src);
        return polishHtml(restoreSpecial(html, store));
    }

    // ── 내장 렌더러 (marked 가 없을 때): 제목 · 목록 · 표 · 굵게 · 기울임 · 링크 · 문단
    function splitRow(line) {
        let row = line.trim();
        if (row.startsWith("|")) row = row.slice(1);
        if (row.endsWith("|") && !row.endsWith("\\|")) row = row.slice(0, -1);
        return row.split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, "|"));
    }
    const isTableSep = (line) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(line);

    function renderMarkdownBasic(src) {
        const inline = (s) =>
            escapeHtml(s)
                .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
                .replace(/(^|[^*])\*([^*\s][^*]*)\*(?!\*)/g, "$1<em>$2</em>")
                .replace(/~~([^~]+)~~/g, "<del>$1</del>")
                .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>');

        const out = [];
        let list = null; // 'ul' | 'ol'
        let para = [];
        const flushPara = () => {
            if (para.length) {
                out.push(`<p>${para.map(inline).join("<br>")}</p>`);
                para = [];
            }
        };
        const closeList = () => {
            if (list) {
                out.push(`</${list}>`);
                list = null;
            }
        };
        const lines = src.split("\n");

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].replace(/\s+$/, "");
            const heading = line.match(/^(#{1,6})\s+(.*)$/);
            const ul = line.match(/^\s*[-*•]\s+(.*)$/);
            const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
            if (!line.trim()) {
                flushPara();
                closeList();
                continue;
            }
            if (/^@@CHATBLOCK\d+@@$/.test(line.trim())) {
                flushPara();
                closeList();
                out.push(line.trim());
                continue;
            }
            // 표: 머리줄 + 구분줄(| --- | :---: |) + 본문 줄
            if (line.includes("|") && i + 1 < lines.length && isTableSep(lines[i + 1])) {
                flushPara();
                closeList();
                const head = splitRow(line);
                const aligns = splitRow(lines[i + 1]).map((c) => (/^:-+:$/.test(c) ? "center" : /-+:$/.test(c) ? "right" : /^:-+/.test(c) ? "left" : ""));
                const cellAttr = (n) => (aligns[n] ? ` style="text-align:${aligns[n]}"` : "");
                let body = "";
                i += 2;
                for (; i < lines.length && lines[i].trim() && lines[i].includes("|"); i++) {
                    const cells = splitRow(lines[i]);
                    body += `<tr>${head.map((h, n) => `<td${cellAttr(n)}>${inline(cells[n] ?? "")}</td>`).join("")}</tr>`;
                }
                i--;
                out.push(`<table><thead><tr>${head.map((h, n) => `<th${cellAttr(n)}>${inline(h)}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table>`);
                continue;
            }
            if (heading) {
                flushPara();
                closeList();
                out.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`);
                continue;
            }
            if (ul || ol) {
                flushPara();
                const type = ul ? "ul" : "ol";
                if (list !== type) {
                    closeList();
                    out.push(`<${type}>`);
                    list = type;
                }
                out.push(`<li>${inline((ul || ol)[1])}</li>`);
                continue;
            }
            closeList();
            para.push(line);
        }
        flushPara();
        closeList();
        return out.join("");
    }

    /*
     * 국회질의 보고서생성 답변의 맨 위 추천목록(doc-list) — <ol><li data-doc-id … data-score …>파일명 (유사도 n%)</li>…</ol>
     * 명세 No.6: 본문 = 상단 추천목록 + 이어서 초안(마크다운 또는 HTML).
     * 목록을 떼어 내 따로 그리고, 나머지 본문은 형식에 맞게 그린다 (목록 HTML 때문에 마크다운 본문이 글자 그대로 보이던 문제).
     */
    const DOC_LIST_RE = /<ol\b[^>]*>(?:(?!<\/ol>)[\s\S])*?data-doc-id[\s\S]*?<\/ol>/i;

    function splitDocList(text) {
        const src = String(text ?? "");
        const match = src.match(DOC_LIST_RE);
        if (!match) return { list: "", rest: src };
        return { list: match[0], rest: (src.slice(0, match.index) + src.slice(match.index + match[0].length)).replace(/^\s+/, "") };
    }

    /** doc-list(<ol data-doc-id>) → 유사답변서 항목 배열 (metadata 가 없을 때 대신 쓴다) */
    function sourcesFromDocList(listHtml) {
        if (!listHtml) return [];
        const box = document.createElement("template");
        box.innerHTML = listHtml;
        return Array.from(box.content.querySelectorAll("li[data-doc-id]")).map((li) => {
            const label = li.textContent.replace(/\s+/g, " ").trim();
            return {
                doc_id: li.getAttribute("data-doc-id"),
                title: label.replace(/\s*\(유사도[^)]*\)\s*$/, ""),
                score: parseFloat(li.getAttribute("data-score")),
            };
        });
    }

    /* ───────── 모델 출력 정리 (형식이 깨진 답변 살리기) ───────── */

    /** 코드 블록(```) 밖의 부분에만 fn 을 적용한다 */
    function mapOutsideFences(src, fn) {
        return src
            .split(/(```[\s\S]*?(?:```|$))/)
            .map((part, i) => (i % 2 ? part : fn(part)))
            .join("");
    }

    /*
     * 쓰레기 문자열 구간: 모델이 형식이 꼬인 뒤 내보내는 $ · ^ · * · | · \dots 덩어리
     *   예) $|$$\dots|$$\dots\|$$\dos$-$^*$^*$^*$-$^*$ … $*$ $*$ * * * *)$
     * 같은 조각이 그대로 반복되지 않고 조금씩 바뀌어서 "반복 생성 감지"로는 못 잡는다.
     * 기호(와 dots 조각)로만 된 40자 이상 구간 중 $ 가 12개 이상인 것만 쓰레기로 본다
     * (표 구분줄 |---| · 가로줄 --- · 목록 기호에는 $ 가 없으므로 걸리지 않는다).
     */
    const JUNK_RUN_RE = /(?:[$^*|\\{}()\-_.…~\s]|\\?d?o?t?s(?![A-Za-z가-힣]))+/g;
    const isJunkRun = (run) => run.length >= 40 && (run.match(/\$/g) || []).length >= 12;

    function stripJunk(src) {
        // 쓰레기 구간은 형식이 끊긴 자리이므로 문단을 나눈다 (뒤에 이어지는 정상 문장이 앞의 표 · 목록에 붙지 않게)
        return mapOutsideFences(src, (part) => part.replace(JUNK_RUN_RE, (run) => (isJunkRun(run) ? "\n\n" : run)));
    }

    /** 본문 끝이 쓰레기 구간으로 길게 이어지는지 (스트리밍 중 받기를 끊을지 판단) */
    function junkTailLength(text) {
        const tail = text.slice(-1500);
        const m = tail.match(/(?:[$^*|\\{}()\-_.…~\s]|\\?d?o?t?s(?![A-Za-z가-힣]))+$/);
        return m && isJunkRun(m[0]) ? m[0].length : 0;
    }

    /*
     * 한 줄로 붙어 온 표 살리기
     *   "| 주차 | 활동 | 산출물 |---|---|---| $| \mathbf{1\text{주}} $ | 분석 | 정의서 $| \mathbf{2\text{주}} $ | …"
     * 머리줄 뒤에 구분줄(|---|)이 줄바꿈 없이 붙은 줄만 고친다.
     *  - 머리줄 · 구분줄을 나누고, 나머지 칸을 행으로 묶는다.
     *  - 첫 칸이 "1주 · 2단계 · 3월"처럼 숫자+짧은 단위면 그런 칸이 나올 때마다 새 행, 아니면 머리줄 칸 수대로 묶는다.
     */
    const INLINE_SEP_RE = /\|\s*:?-{2,}:?\s*(?=\|)/;
    const ROW_KEY_RE = /^\**\s*\d+\s*[^\s|]{0,3}\s*\**$/;

    function splitCells(row) {
        let s = row.trim();
        if (s.startsWith("|")) s = s.slice(1);
        if (s.endsWith("|")) s = s.slice(0, -1);
        return s.split("|").map((c) => c.trim());
    }

    function repairInlineTable(line) {
        const sep = line.match(INLINE_SEP_RE);
        if (!sep || !/^\s*\|/.test(line) || sep.index === 0) return line;
        const head = splitCells(line.slice(0, sep.index + 1));
        if (head.length < 2 || head.some((c) => !c)) return line;
        // 구분줄 조각(|---|--| - 등)을 지나 본문 시작점을 찾는다
        let rest = line.slice(sep.index).replace(/^(?:\s*\|?\s*:?-+:?\s*)+/, "");
        rest = normalizeTableLine(`|${rest}|`).replace(/\$/g, "");
        const cells = splitCells(rest).filter((c) => c !== "");
        const n = head.length;
        const rows = [];
        if (cells.length && ROW_KEY_RE.test(cells[0])) {
            cells.forEach((c) => {
                if (ROW_KEY_RE.test(c) || !rows.length) rows.push([c]);
                else rows[rows.length - 1].push(c);
            });
        } else {
            for (let i = 0; i < cells.length; i += n) rows.push(cells.slice(i, i + n));
        }
        const fmt = (r) => `| ${Array.from({ length: n }, (_, i) => r[i] ?? "").join(" | ")} |`;
        return ["", fmt(head), `|${" --- |".repeat(n)}`, ...rows.map(fmt), ""].join("\n");
    }

    /** 답변을 그리기 전에 모델 출력의 흔한 형식 오류를 바로잡는다 (원문은 바꾸지 않고 화면에만 적용) */
    function cleanModelOutput(text) {
        let src = String(text ?? "").replace(/\r\n?/g, "\n");
        src = stripJunk(src);
        src = mapOutsideFences(src, (part) =>
            part
                .split("\n")
                .map(repairInlineTable)
                .join("\n")
                // "1.** 질문?**" 처럼 번호 바로 뒤에 ** 가 붙으면 굵게가 열리지 않는다 → "1. **질문?**"
                .replace(/(^|\n|<br\s*\/?>)(\s*\d+[.)])\*\*\s*/gi, "$1$2 **"),
        );
        return src;
    }

    /** 마크다운 표 구분줄(| --- | :---: |)이 있는지 — HTML 이 섞여 있어도 마크다운으로 그린다 (칸 안의 <br> 등) */
    const hasMarkdownTable = (text) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/m.test(text);

    /**
     * 마크다운 표시가 있는지 (제목 · 목록 · 인용 · 표 줄 · 굵게)
     * AI 가 마크다운 중간에 <br> 같은 HTML 을 섞어 보내는 경우가 있어, 이것이 있으면 HTML 이 섞여 있어도 마크다운으로 그린다.
     * (예전에는 <br> 하나만 있어도 전체를 HTML 로 그려 줄바꿈이 모두 사라지고 ### · ** · | 가 글자 그대로 보였다)
     */
    const hasMarkdownSyntax = (text) => /(^|\n)[ \t]{0,3}(#{1,6}[ \t]|[-*+][ \t]|\d+[.)][ \t]|>[ \t]|\|.*\|)|\*\*[^*\n]+\*\*/.test(text);

    function renderBody(rawText) {
        const text = cleanModelOutput(rawText);
        // 블록 HTML(<p> · <div> · <ol> · <table> …)로 된 답변만 HTML 로 그린다. <br> · <strong> 같은 줄 안 태그는 마크다운 안에서도 그려진다.
        const looksHtml = /<(p|div|ol|ul|li|table|h[1-6]|pre)[\s>/]/i.test(text);
        if (!looksHtml || hasMarkdownTable(text) || hasMarkdownSyntax(text)) return renderMarkdown(text);
        // HTML 로 온 답변도 수식은 바꿔 준다 (바꾼 결과는 sanitizeHtml 을 한 번 더 거친다)
        const maths = [];
        return sanitizeHtml(restoreMath(extractMath(String(text), maths), maths));
    }

    /**
     * 답변 본문을 그린다.
     * options.sourcesShown 이 true 면(유사답변서 목록 카드를 따로 그렸으면) 본문 위 doc-list 는 빼고,
     * 아니면 doc-list 도 목록 카드 모양으로 그려 준다.
     */
    function renderContent(target, text, options = {}) {
        const { list, rest } = splitDocList(text);
        let html = "";
        if (list && !options.sourcesShown) html += sourcesHtml(sourcesFromDocList(list));
        html += rest ? renderBody(rest) : "";
        target.innerHTML = html;
        addBlockCopyBars(target);
    }

    /* Start: 261020 수정 - 홈·챗봇 표·코드 블록 공통 복사 기능 연결
     * 행 생성·복사 버튼 SVG·클립보드 처리·완료 토스트: common.js의 AIOneChatBlocks.
     * 홈·챗봇의 도구줄 스타일만 ensureBlockCopyStyle에서 관리한다.
     * 업무지원·답변서의 표·도구줄 스타일은 draft-report.js의 wrapReportTables에서 관리한다.
     * 복사 클릭은 common.js에서 처리하므로 이 파일에 별도 이벤트를 등록하지 않는다.
     */
    function ensureBlockCopyStyle() {
        if (document.getElementById("aioneChatBlockCopyStyle")) return;
        const style = document.createElement("style");
        style.id = "aioneChatBlockCopyStyle";
        style.textContent = [
            ".chat-block{position:relative;margin:.75em 0;border:1px solid var(--border, #e5e7eb);border-radius:10px;background:var(--surface, #fff);overflow:hidden}",
            ".chat-block>.chat-table-wrap,.chat-block>pre{margin:0!important;border:0!important;border-radius:0!important}",
            ".chat-block>.chat-table-wrap{padding:0 12px 12px}",
            ".chat-block-bar{display:flex;align-items:center;justify-content:space-between;padding:6px 8px 6px 14px;font-size:12px;color:var(--text-muted, #6b7280)}",
            ".chat-block-bar::before{content:attr(data-label)}",
            ".chat-block-copy{position:relative;display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;padding:0;border:1px solid var(--border, #e5e7eb);border-radius:8px;background:var(--surface, #fff);color:var(--text, #374151);cursor:pointer}",
            ".chat-block-copy:hover,.chat-block-copy:focus-visible{background:var(--surface-el, #f3f4f6)}",
            ".chat-block-copy svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}",
            ".chat-block-copy.is-done{color:#059669}",
            ".chat-block-copy::after{content:attr(data-tip);position:absolute;top:calc(100% + 6px);right:0;padding:3px 8px;border-radius:6px;background:#111827;color:#fff;font-size:12px;white-space:nowrap;opacity:0;pointer-events:none;transition:opacity .12s;z-index:5}",
            ".chat-block-copy:hover::after,.chat-block-copy:focus-visible::after{opacity:1}",
        ].join("");
        document.head.appendChild(style);
    }

    function addBlockCopyBars(root) {
        ensureBlockCopyStyle();
        window.AIOneChatBlocks.decorate(root);
    }

    // 메시지 전체 복사도 공통 클립보드 함수를 재사용한다.
    const copyPlain = (text) => window.AIOneChatBlocks.copyPlain(text);
    /* End: 261020 수정 - 홈·챗봇 표·코드 블록 공통 복사 기능 연결 */

    /* ───────── 유사 과거 답변서 목록 (metadata.action.sources) ───────── */
    const SOURCE_TITLES = {
        report: "참고한 유사 과거 답변서",
        report_edited: "참고한 유사 과거 답변서",
        sources: "유사 과거 답변서 추천 목록",
    };

    /** 과거 답변서 원문 미리보기 주소 (명세 No.23 — AnswerController ND_reportSourcePreview.do, PDF) */
    const sourcePreviewUrl = (docId) => (cfg.sourcePreviewUrl || cfg.baseUrl.replace(/\/intra\/ai\/chat\/?$/, "") + "/intra/ai/answer/ND_reportSourcePreview.do") + "?documentId=" + encodeURIComponent(docId);

    /** 목록에 보여 줄 최대 건수 (유사도 높은 순 — 명세상 sources 는 이미 내림차순) */
    const SOURCES_LIMIT = Number(cfg.sourcesLimit) > 0 ? Number(cfg.sourcesLimit) : 3;

    function sourcesHtml(sources, kind, notice) {
        const all = (sources || []).filter((s) => s && (s.doc_id || s.title));
        if (!all.length && !notice) return "";
        const list = all.slice(0, SOURCES_LIMIT);
        const title = SOURCE_TITLES[kind] || "유사 과거 답변서";
        const items = list
            .map((s, i) => {
                const score = Number.isFinite(Number(s.score)) && s.score !== null && s.score !== "" ? `${Number(s.score).toFixed(1)}%` : "";
                const who = [s.member_name ? `${s.member_name} 의원` : "", s.party ? `(${s.party})` : ""].filter(Boolean).join(" ");
                const dates = [s.question_date ? `질의 ${s.question_date}` : "", s.answer_date ? `답변 ${s.answer_date}` : ""].filter(Boolean).join(" · ");
                const answerer = [s.answerer, s.answerer_org ? `(${s.answerer_org})` : ""].filter(Boolean).join(" ");
                const meta = [who, dates, answerer].filter(Boolean).map(escapeHtml).join('<span class="chat-sources-sep">|</span>');
                const name = escapeHtml(s.title || s.doc_id);
                const link = s.doc_id
                    ? `<a class="chat-sources-name" href="${escapeHtml(sourcePreviewUrl(s.doc_id))}" target="_blank" rel="noopener noreferrer"
             data-source-preview="${escapeHtml(s.doc_id)}" data-source-title="${escapeHtml(s.title || s.doc_id)}"
             data-source-score="${escapeHtml(score)}" title="원문 미리보기">${name}</a>`
                    : `<span class="chat-sources-name">${name}</span>`;
                return `<li class="chat-sources-item${s.doc_id ? " is-clickable" : ""}" data-source-item="${escapeHtml(s.doc_id || "")}"${s.doc_id ? ` tabindex="0" role="button" aria-label="${name} 미리보기"` : ""}>
          <span class="chat-sources-rank">${i + 1}</span>
          <div class="chat-sources-body">
            <div class="chat-sources-head">${link}${score ? `<span class="chat-sources-score">유사도 ${escapeHtml(score)}</span>` : ""}</div>
            ${meta ? `<div class="chat-sources-meta">${meta}</div>` : ""}
          </div>
        </li>`;
            })
            .join("");
        return `<section class="chat-sources" aria-label="${escapeHtml(title)}">
        <div class="chat-sources-title">${escapeHtml(title)}${list.length ? ` <span class="chat-sources-count">${list.length}건</span>` : ""}${all.length > list.length ? ` <span class="chat-sources-total">(전체 ${all.length}건 중 유사도 상위 ${list.length}건)</span>` : ""}</div>
        ${notice ? `<p class="chat-sources-notice">${escapeHtml(notice)}</p>` : ""}
        ${list.length ? `<ol class="chat-sources-list">${items}</ol>` : ""}
      </section>`;
    }

    // End: 수식(LaTeX) 표시

    // Start: 과거 답변서 미리보기 (오른쪽 분할 화면)
    /*
     * 유사 과거 답변서 목록에서 문서를 누르면 오른쪽에 미리보기 창을 연다.
     *  - 원문은 명세 No.23 (GET /report/sources/{document_id}/preview) — hwp·hwpx·docx 도 PDF 로 바꿔 준다.
     *    화면에서는 AnswerController ND_reportSourcePreview.do 를 부른다 (sourcePreviewUrl).
     *  - PDF 는 답변서 워크스페이스와 같은 pdf.js(/resources/libs/pdfjs)로 그린다. 확대·축소(맞춤 · 50~200%) 지원.
     *    pdf.js 를 불러오지 못하면 브라우저 PDF 뷰어(blob 주소 iframe)로 보여 준다.
     *  - 머리줄: 문서명 · 유사도 / 새 창 열기 · 배율 · 다운로드 · 전체 화면 · 닫기. Esc 로 닫는다.
     *  - 한 번 받은 문서는 이 화면에 있는 동안 다시 받지 않는다.
     */
    const PDFJS_SRC = cfg.pdfjsSrc || `${cfg.baseUrl.replace(/\/intra\/ai\/chat\/?$/, "")}/resources/libs/pdfjs/pdf.min.js`;
    const PDFJS_WORKER = cfg.pdfjsWorker || PDFJS_SRC.replace(/pdf\.min\.(m?js)(?=[?#]|$)/, "pdf.worker.min.$1");
    const ZOOM_OPTIONS = [
        ["fit", "너비 맞춤"],
        ["0.5", "50%"],
        ["0.75", "75%"],
        ["1", "100%"],
        ["1.25", "125%"],
        ["1.5", "150%"],
        ["2", "200%"],
    ];

    const preview = {
        panel: null,
        body: null,
        titleEl: null,
        subEl: null,
        zoomEl: null,
        downloadEl: null,
        openEl: null,
        docId: null,
        title: "",
        pdf: null,
        blobUrl: null,
        zoom: "fit",
        seq: 0,
        cache: new Map(),
        resizeTimer: 0,
    };

    let pdfjsPromise = null;
    function loadPdfJs() {
        if (window.pdfjsLib) {
            if (!window.pdfjsLib.GlobalWorkerOptions.workerSrc) window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
            return Promise.resolve(window.pdfjsLib);
        }
        if (!pdfjsPromise) {
            if (/\.mjs(?:[?#]|$)/i.test(PDFJS_SRC)) {
                pdfjsPromise = import(new URL(PDFJS_SRC, document.baseURI).href).then((pdfjs) => {
                    pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
                    window.pdfjsLib = pdfjs;
                    return pdfjs;
                });
            } else {
                pdfjsPromise = new Promise((resolve, reject) => {
                    const script = document.createElement("script");
                    script.src = PDFJS_SRC;
                    script.onload = () => {
                        if (!window.pdfjsLib) {
                            reject(new Error("pdf.js 없음"));
                            return;
                        }
                        window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
                        resolve(window.pdfjsLib);
                    };
                    script.onerror = () => reject(new Error("pdf.js 를 불러오지 못했습니다."));
                    document.head.appendChild(script);
                });
            }
            pdfjsPromise = pdfjsPromise.catch((error) => {
                pdfjsPromise = null;
                throw error;
            });
        }
        return pdfjsPromise;
    }

    function buildPreviewPanel() {
        if (preview.panel) return preview.panel;
        const host = document.querySelector(".chatbot-app") || document.body;
        const panel = document.createElement("aside");
        panel.className = "chat-preview split-handler-right";
        panel.setAttribute("aria-label", "과거 답변서 미리보기");
        panel.hidden = true;
        panel.innerHTML = getChatTemplateHtml("chatPreviewPanelTemplate");
        panel.querySelector(".chat-preview-zoom").replaceChildren(...ZOOM_OPTIONS.map(([value, label]) => new Option(label, value)));
        host.dataset.component = "split-handler";
        host.dataset.splitMin = "280";
        host.querySelector(":scope > .chatbot-main")?.classList.add("split-handler-left");
        const handle = document.createElement("div");
        handle.className = "chat-preview-resize split-handler-handle";
        handle.tabIndex = 0;
        handle.setAttribute("role", "separator");
        handle.setAttribute("aria-label", "대화와 문서 너비 조절");
        handle.setAttribute("aria-orientation", "vertical");
        host.append(handle, panel);

        Object.assign(preview, {
            panel,
            body: panel.querySelector(".chat-preview-body"),
            titleEl: panel.querySelector(".chat-preview-title"),
            subEl: panel.querySelector(".chat-preview-sub"),
            zoomEl: panel.querySelector(".chat-preview-zoom"),
            downloadEl: panel.querySelector("[data-preview-download]"),
            openEl: panel.querySelector("[data-preview-open]"),
        });
        preview.zoomEl.addEventListener("change", () => {
            preview.zoom = preview.zoomEl.value;
            renderPdfPages();
        });
        panel.querySelector("[data-preview-close]").addEventListener("click", closePreview);
        panel.querySelector("[data-preview-full]").addEventListener("click", () => {
            if (document.fullscreenElement) document.exitFullscreen?.();
            else panel.requestFullscreen?.().catch(() => panel.classList.toggle("is-maximized"));
        });
        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && !panel.hidden && !document.fullscreenElement && !document.querySelector(".chat-action-modal:not([hidden])")) closePreview();
        });
        window.addEventListener("resize", () => {
            window.AIOneSplitHandler?.reset(host);
            if (panel.hidden || preview.zoom !== "fit") return;
            window.clearTimeout(preview.resizeTimer);
            preview.resizeTimer = window.setTimeout(renderPdfPages, 150);
        });
        new ResizeObserver(() => {
            if (panel.hidden || preview.zoom !== "fit") return;
            window.clearTimeout(preview.resizeTimer);
            preview.resizeTimer = window.setTimeout(renderPdfPages, 150);
        }).observe(panel);
        return panel;
    }

    function setPreviewMessage(message, withLink) {
        preview.body.innerHTML = `<div class="chat-preview-state">
        <p>${escapeHtml(message)}</p>
        ${withLink && preview.docId ? `<a href="${escapeHtml(sourcePreviewUrl(preview.docId))}" target="_blank" rel="noopener noreferrer">새 창에서 열기</a>` : ""}
      </div>`;
    }

    function markPreviewing(docId) {
        document.querySelectorAll("[data-source-item].is-previewing").forEach((li) => li.classList.remove("is-previewing"));
        if (!docId) return;
        document.querySelectorAll("[data-source-item]").forEach((li) => {
            if (li.getAttribute("data-source-item") === docId) li.classList.add("is-previewing");
        });
    }

    async function openPreview({ docId, title, score }) {
        if (!docId) return;
        buildPreviewPanel();
        return window.AIOneLoadingOverlay.preview(preview.body, title || docId, () => loadPreview({ docId, title, score }));
    }

    async function loadPreview({ docId, title, score }) {
        if (!docId) return;
        buildPreviewPanel();
        const seq = ++preview.seq;
        preview.docId = docId;
        preview.title = title || docId;
        preview.pdf = null;
        window.AIOneWorkspaceCommon.renderDisplayTitle(preview.titleEl, preview.title);
        preview.titleEl.title = preview.title;
        preview.subEl.textContent = ["AI-ONE / 과거 답변서", score ? `유사도 ${score}` : ""].filter(Boolean).join(" · ");
        preview.openEl.href = sourcePreviewUrl(docId);
        preview.downloadEl.removeAttribute("href");
        preview.zoomEl.value = preview.zoom;
        preview.panel.hidden = false;
        el.root?.classList.add("has-preview");
        window.AIOneSplitHandler?.init(el.root);
        markPreviewing(docId);
        setPreviewMessage("미리보기를 불러오는 중입니다… 처음 여는 문서는 변환에 몇 초 걸릴 수 있습니다.");
        log("과거 답변서 미리보기", docId, title);

        try {
            let blob = preview.cache.get(docId);
            if (!blob) {
                const response = await fetch(sourcePreviewUrl(docId), { credentials: "same-origin", cache: "no-store" });
                if (!response.ok) throw new Error(response.status === 404 ? "문서를 찾을 수 없습니다." : `미리보기를 불러오지 못했습니다. (${response.status})`);
                const type = response.headers.get("Content-Type") || "";
                if (type && !/pdf|octet-stream/i.test(type)) throw new Error("세션이 만료되었거나 미리보기를 받을 수 없습니다.");
                blob = await response.blob();
                preview.cache.set(docId, blob);
            }
            if (seq !== preview.seq) return; // 그사이 다른 문서를 눌렀다
            if (preview.blobUrl) URL.revokeObjectURL(preview.blobUrl);
            preview.blobUrl = URL.createObjectURL(blob.type === "application/pdf" ? blob : new Blob([blob], { type: "application/pdf" }));
            preview.openEl.href = preview.blobUrl;
            preview.downloadEl.href = preview.blobUrl;
            preview.downloadEl.setAttribute("download", `${preview.title.replace(/\.(hwpx?|docx?|pdf)$/i, "")}.pdf`);

            try {
                const pdfjs = await loadPdfJs();
                const pdf = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
                if (seq !== preview.seq) return;
                preview.pdf = pdf;
                await renderPdfPages();
            } catch (pdfError) {
                // pdf.js 가 없거나 실패하면 브라우저 PDF 뷰어로
                console.warn("[chat] pdf.js 미리보기 실패 → 브라우저 뷰어 사용", pdfError);
                if (seq !== preview.seq) return;
                preview.zoomEl.disabled = true;
                preview.body.innerHTML = `<iframe class="chat-preview-frame" title="${escapeHtml(preview.title)}" src="${preview.blobUrl}"></iframe>`;
            }
        } catch (error) {
            if (seq !== preview.seq) return;
            setPreviewMessage(error.message || "미리보기를 불러오지 못했습니다.", true);
        }
    }

    /** pdf.js 로 모든 쪽을 그린다 (배율이 바뀌면 다시 그린다) */
    async function renderPdfPages() {
        const pdf = preview.pdf;
        if (!pdf || !preview.body) return;
        const seq = preview.seq;
        preview.zoomEl.disabled = false;
        const pages = document.createElement("div");
        pages.className = "chat-preview-pages";
        const available = Math.max(200, preview.body.clientWidth - 48);
        const ratio = window.devicePixelRatio || 1;
        for (let n = 1; n <= pdf.numPages; n++) {
            const page = await pdf.getPage(n);
            if (seq !== preview.seq || pdf !== preview.pdf) return;
            const base = page.getViewport({ scale: 1 });
            const scale = preview.zoom === "fit" ? available / base.width : Number(preview.zoom) || 1;
            const viewport = page.getViewport({ scale });
            const canvas = document.createElement("canvas");
            canvas.className = "chat-preview-page";
            canvas.width = Math.floor(viewport.width * ratio);
            canvas.height = Math.floor(viewport.height * ratio);
            canvas.style.width = `${Math.floor(viewport.width)}px`;
            canvas.style.height = `${Math.floor(viewport.height)}px`;
            const context = canvas.getContext("2d");
            context.setTransform(ratio, 0, 0, ratio, 0, 0);
            pages.appendChild(canvas);
            if (n === 1) {
                preview.body.innerHTML = "";
                preview.body.appendChild(pages);
            }
            await page.render({ canvasContext: context, viewport }).promise;
        }
    }

    function closePreview() {
        if (!preview.panel || preview.panel.hidden) return;
        preview.seq++;
        preview.panel.hidden = true;
        preview.panel.classList.remove("is-maximized");
        if (document.fullscreenElement === preview.panel) document.exitFullscreen?.();
        el.root?.classList.remove("has-preview");
        window.AIOneSplitHandler?.reset(el.root);
        preview.pdf = null;
        preview.body.innerHTML = "";
        markPreviewing(null);
    }

    /**
     * 목록 항목(카드 전체) 클릭 → 미리보기.
     * 문서 이름뿐 아니라 순번 · 유사도 · 의원/답변자 줄 어디를 눌러도 열린다. Enter · Space 로도 연다.
     * 문서 이름을 Ctrl·Shift·가운데 버튼으로 누르면 원래대로 새 창에서 연다.
     */
    function bindSourcePreview() {
        const linkOf = (target) => {
            const item = target.closest("[data-source-item]");
            return target.closest("[data-source-preview]") || item?.querySelector("[data-source-preview]") || null;
        };
        const open = (link) =>
            openPreview({
                docId: link.getAttribute("data-source-preview"),
                title: link.getAttribute("data-source-title"),
                score: link.getAttribute("data-source-score"),
            });
        el.messages?.addEventListener("click", (event) => {
            const link = linkOf(event.target);
            if (!link) return;
            if (event.target.closest("[data-source-preview]") && (event.ctrlKey || event.metaKey || event.shiftKey || event.button === 1)) return;
            event.preventDefault();
            open(link);
        });
        el.messages?.addEventListener("keydown", (event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            const item = event.target.closest?.("[data-source-item].is-clickable");
            if (!item || event.target !== item) return;
            event.preventDefault();
            const link = linkOf(item);
            if (link) open(link);
        });
    }

    // End: 과거 답변서 미리보기 (오른쪽 분할 화면)

    // Start: 메시지 영역
    /*
     * 자동 스크롤 (답변이 나오는 동안 맨 아래를 따라간다)
     *  - 질문을 보내거나 대화를 열면 "따라가기"를 켠다.
     *  - 사용자가 위로 스크롤(휠·터치·키보드·스크롤바)하면 끄고, 다시 맨 아래로 내리면 켠다.
     *  - 따라가기 여부는 "본문을 그리기 전" 상태로 정한다.
     *    (예전에는 본문을 그린 뒤 맨 아래와의 거리를 쟀기 때문에, 한 번에 80px 넘게 늘어나면 멈췄다)
     *  - 실제로 스크롤되는 요소가 #chatMessages 가 아니면(공통 CSS 등으로 높이가 안 잡힌 경우) 바깥 스크롤 영역을 찾아 내린다.
     */
    const BOTTOM_GAP = 80;
    const scroll = { follow: true, programmatic: 0, lastTop: 0 };

    function isScrollable(node) {
        if (!node || node.nodeType !== 1) return false;
        const overflowY = window.getComputedStyle(node).overflowY;
        return (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") && node.scrollHeight > node.clientHeight + 1;
    }

    /** 메시지가 넘칠 때 실제로 스크롤되는 요소 */
    function getScroller() {
        const box = el.messages;
        if (!box) return null;
        if (isScrollable(box)) return box;
        for (let node = box.parentElement; node && node !== document.body; node = node.parentElement) {
            if (isScrollable(node)) return node;
        }
        return document.scrollingElement || document.documentElement;
    }

    function nearBottom() {
        const box = getScroller();
        return !box || box.scrollHeight - box.scrollTop - box.clientHeight < BOTTOM_GAP;
    }

    function scrollToBottom(force) {
        if (force) scroll.follow = true;
        if (!scroll.follow) return;
        const box = getScroller();
        if (!box) return;
        scroll.programmatic++;
        box.scrollTop = box.scrollHeight;
        scroll.lastTop = box.scrollTop;
        // 그린 직후 글꼴·표·이미지로 높이가 조금 더 늘 수 있어 한 번 더 내린다
        requestAnimationFrame(() => {
            if (scroll.follow) {
                box.scrollTop = box.scrollHeight;
                scroll.lastTop = box.scrollTop;
            }
            requestAnimationFrame(() => {
                scroll.programmatic = Math.max(0, scroll.programmatic - 1);
            });
        });
    }

    /** 사용자가 직접 스크롤하면 따라가기를 끄고 켠다 */
    function bindAutoScroll() {
        const onUserScroll = () => {
            const box = getScroller();
            // 마지막으로 내린 위치보다 위로 올라갔으면 사용자가 올린 것 (본문이 늘어나도 scrollTop 은 줄지 않는다)
            if (box && box.scrollTop < scroll.lastTop - 2) {
                scroll.follow = false;
                scroll.lastTop = box.scrollTop;
                return;
            }
            if (scroll.programmatic) return; // 코드가 내린 스크롤은 무시
            scroll.follow = nearBottom();
            if (box) scroll.lastTop = box.scrollTop;
        };
        // 메시지 영역 또는 바깥 스크롤 영역 어디에서 스크롤되어도 받는다 (scroll 은 버블링되지 않아 캡처)
        document.addEventListener(
            "scroll",
            (event) => {
                const target = event.target === document ? document.scrollingElement : event.target;
                if (target && target.nodeType === 1 && (target === el.messages || target.contains(el.messages))) onUserScroll();
            },
            true,
        );
        // 위로 올리려는 동작은 스크롤 이벤트보다 먼저 따라가기를 끈다 (스트리밍 중 다시 끌려 내려가지 않게)
        const stopFollow = () => {
            scroll.follow = false;
        };
        el.messages?.addEventListener(
            "wheel",
            (event) => {
                if (event.deltaY < 0) stopFollow();
            },
            { passive: true },
        );
        let touchY = null;
        el.messages?.addEventListener(
            "touchstart",
            (event) => {
                touchY = event.touches[0]?.clientY ?? null;
            },
            { passive: true },
        );
        el.messages?.addEventListener(
            "touchmove",
            (event) => {
                const y = event.touches[0]?.clientY;
                if (touchY != null && y != null && y > touchY + 4) stopFollow();
            },
            { passive: true },
        );
        document.addEventListener("keydown", (event) => {
            if (["PageUp", "ArrowUp", "Home"].includes(event.key) && !event.target.closest?.("input, textarea, [contenteditable]")) stopFollow();
        });
    }

    function setChatting(on) {
        el.root?.classList.toggle("is-chatting", on);
        if (el.messages) el.messages.hidden = !on;
    }

    /*
     * 국회답변서초안생성(report_generator) 채팅방 안내
     *  - 작업을 "국회답변서초안생성"으로 고르면 대화 시작 전에 사용 안내(step1~4)를 대화 맨 위에 보여 준다.
     *  - 그 대화를 이어 가거나 목록에서 다시 열어도 맨 위에 남는다. 일반 대화에서는 보이지 않는다.
     *  - 안내 문구는 html/chatbot.html의 <template id="chatAnswerGuideTemplate"> 에서 고친다 (없으면 안내를 띄우지 않는다).
     */
    function renderTaskGuide() {
        if (!el.messages || cfg.mode === "handoff") return;
        const template = document.getElementById("chatAnswerGuideTemplate");
        const agent = state.conversationId ? state.agent : currentAgent();
        const show = !!template && agent === "report_generator";
        let guide = el.messages.querySelector(":scope > .chat-guide");

        if (show && !guide) {
            guide = document.createElement("div");
            guide.className = "chat-msg chat-msg-assistant chat-guide";
            guide.innerHTML = `<div class="chat-bubble chat-guide-card">${template.innerHTML}</div>`;
            el.messages.prepend(guide);
        } else if (!show && guide) {
            guide.remove();
        }
        // 대화 전에는 인사말 대신 안내를 보여 주고, 안내를 거두면 인사말로 돌아간다
        if (!state.conversationId) setChatting(show);
    }

    function addUserMessage(text, files) {
        const item = document.createElement("div");
        item.className = "chat-msg chat-msg-user";
        item.innerHTML = getChatTemplateHtml("chatUserMessageTemplate");
        item.querySelector(".chat-bubble").innerHTML = escapeHtml(text).replace(/\n/g, "<br>");
        const fileList = item.querySelector(".chat-msg-files");
        fileList.hidden = !files?.length;
        fileList.replaceChildren(
            ...(files || []).map((file) => {
                const row = document.createElement("li");
                row.textContent = file.name;
                return row;
            }),
        );
        el.messages.appendChild(item);
        scrollToBottom(true);
    }

    /**
     * 답변 청크를 이어 붙인다. AI 서버는 답을 조각(토큰) 단위로 보내고,
     * 마지막 청크에 전체 본문을 다시 실어 보낼 수 있다(명세 No.6 최종 청크).
     * - 지금까지의 본문과 같으면 무시 (전체 본문 재전송)
     * - 지금까지의 본문으로 시작하는 더 긴 청크면 바꿔 끼움 (누적본)
     *   단, 본문이 짧을 때는 "네" + "네트워크" 처럼 우연히 겹칠 수 있어 16자 이상일 때만 누적본으로 본다
     * - 그 외에는 이어 붙임 (조각)
     */
    function mergeChunk(text, chunk) {
        if (!text) return chunk;
        if (chunk === text) return text;
        if (text.length >= 16 && chunk.length > text.length && chunk.startsWith(text)) return chunk;
        return text + chunk;
    }

    /*
     * 반복 생성 감지
     * 모델이 형식이 꼬인 뒤 같은 조각(예: "\dots|\n…|\n")을 끝없이 내보내는 경우가 있다.
     * 본문 끝에서 길이 L(1~LOOP_MAX_UNIT)짜리 조각이 LOOP_MIN_REPEAT 번 이상 연달아 반복되면 반복으로 본다.
     *  - 표 구분줄(|---|---|) · 가로줄(-----) · 들여쓰기처럼 기호만 반복되는 것은 정상이므로 제외한다.
     *  - 매 청크마다 끝부분(LOOP_TAIL자)만 본다 (조각 길이 × 끝부분 길이 만큼만 비교).
     * @return 반복이 시작된 위치(첫 조각 하나는 남긴 뒤). 반복이 아니면 -1
     */
    const LOOP_TAIL = 800;
    const LOOP_MAX_UNIT = 80;
    const LOOP_MIN_REPEAT = 10;
    const LOOP_MIN_CHARS = 80;

    /** text 의 end 위치 바로 앞에서 반복이 있는지 본다. 있으면 { start(첫 조각 뒤), unit } */
    function repeatEndingAt(text, end) {
        if (end < LOOP_MIN_CHARS * 2) return null;
        const from = Math.max(0, end - LOOP_TAIL);
        for (let unit = 1; unit <= LOOP_MAX_UNIT; unit++) {
            let run = 0; // end 에서 거꾸로 "unit 앞 글자와 같은" 글자 수
            for (let i = end - 1; i - unit >= from && text[i] === text[i - unit]; i--) run++;
            if (run < unit * (LOOP_MIN_REPEAT - 1) || run < LOOP_MIN_CHARS) continue;
            if (!/[^\s|:\-=*_#>.·…]/.test(text.slice(end - unit, end))) continue; // 기호만 반복(표 구분줄 등)은 정상
            return { start: Math.max(0, end - run - unit), unit }; // 첫 조각부터 모두 뺀다
        }
        return null;
    }

    /** 스트리밍 중: 본문 끝이 반복이면 잘라 낼 위치, 아니면 -1 */
    function findRepeatStart(text) {
        const hit = repeatEndingAt(text, text.length);
        return hit ? hit.start : -1;
    }

    /** 저장된 답변: 중간에 낀 반복 구간을 모두 빼고 안내 한 줄로 바꾼다 (반복 뒤의 정상 본문은 남긴다) */
    function stripRepeats(text) {
        let src = String(text ?? "");
        let removed = false;
        for (let end = LOOP_MIN_CHARS * 2; end <= src.length; end += 40) {
            const hit = repeatEndingAt(src, Math.min(end, src.length));
            if (!hit) continue;
            let stop = Math.min(end, src.length);
            while (stop < src.length && src[stop] === src[stop - hit.unit]) stop++; // 반복이 끝나는 곳까지
            const NOTE = "_(같은 내용이 반복되어 일부를 생략했습니다.)_";
            let head = src.slice(0, hit.start).replace(/[\s|$\\]+$/, "");
            if (!head.endsWith(NOTE)) head += `\n\n${NOTE}`; // 반복이 이어서 또 나오면 안내는 한 번만
            src = `${head}\n\n${src.slice(stop).replace(/^[\s|$\\*^]+/, "")}`;
            removed = true;
            end = head.length;
        }
        return removed ? src : text;
    }

    /*
     * 타이핑 커서: 지금 써지고 있는 글 끝에 깜빡이는 막대를 붙인다 (한 자씩 써지는 느낌).
     * 마지막 글자가 들어 있는 가장 안쪽 요소(문단 · 목록 · 표 칸 등) 끝에 넣는다. 스타일은 한 번만 문서에 넣는다.
     */
    function addTypingCaret(root) {
        if (!document.getElementById("aioneChatCaretStyle")) {
            const style = document.createElement("style");
            style.id = "aioneChatCaretStyle";
            style.textContent =
                ".chat-caret{display:inline-block;width:2px;height:1.05em;margin-left:2px;vertical-align:-0.18em;" +
                "background:currentColor;opacity:.7;animation:aioneChatCaret 1s steps(1) infinite}" +
                "@keyframes aioneChatCaret{50%{opacity:0}}" +
                "@media (prefers-reduced-motion: reduce){.chat-caret{animation:none}}";
            document.head.appendChild(style);
        }
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode: (n) => (n.nodeValue.trim() && !n.parentElement.closest("pre, code, .chat-math") ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
        });
        let last = null;
        while (walker.nextNode()) last = walker.currentNode;
        const caret = document.createElement("span");
        caret.className = "chat-caret";
        caret.setAttribute("aria-hidden", "true");
        if (last) last.parentNode.insertBefore(caret, last.nextSibling);
        else root.appendChild(caret);
    }

    /*
     * Start: 261019 추가 - 답변 액션 대체 버튼
     * 퍼블 common.js 의 AIOneChatMessageActions 가 있으면 그것으로 만들고, 없으면(공통 스크립트가 예전 판) 같은 순서 · 아이콘으로 직접 만든다.
     */
    const MSG_ACTION_FALLBACK = {
        like: ["좋아요", '<path d="M7 10v11H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h3z"/><path d="M7 10l4-7a2.5 2.5 0 0 1 2.5 2.5V9h5.2a2 2 0 0 1 2 2.3l-1.2 8A2 2 0 0 1 17.5 21H7"/>', true],
        dislike: ["싫어요", '<path d="M17 14V3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-3z"/><path d="M17 14l-4 7a2.5 2.5 0 0 1-2.5-2.5V15H5.3a2 2 0 0 1-2-2.3l1.2-8A2 2 0 0 1 6.5 3H17"/>', true],
        research: ["다시 생성", '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>'],
        copy: ["복사", '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>'],
        issue: ["오류신고", '<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>'],
    };
    function createMessageActionButton(action) {
        if (window.AIOneChatMessageActions?.createButton) {
            return window.AIOneChatMessageActions.createButton(action, { className: "chat-action", attributes: { "data-chat-action": action } });
        }
        const [label, paths, toggle] = MSG_ACTION_FALLBACK[action] || [action, ""];
        const button = document.createElement("button");
        button.type = "button";
        button.className = "chat-action chat-action-icon";
        button.dataset.chatAction = action;
        button.title = label;
        button.setAttribute("aria-label", label);
        if (toggle) button.setAttribute("aria-pressed", "false");
        button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;
        return button;
    }
    // End: 261019 추가 - 답변 액션 대체 버튼

    /** 답변 말풍선. 스트리밍 중 갱신·완료·실패 처리를 담당한다. */
    function addAssistantMessage(initial) {
        const item = document.createElement("div");
        item.className = "chat-msg chat-msg-assistant";
        item.innerHTML = getChatTemplateHtml("chatAssistantMessageTemplate");
        el.messages.appendChild(item);

        const stage = item.querySelector(".chat-stage");
        const content = item.querySelector(".chat-content");
        const actions = item.querySelector(".chat-msg-actions");
        // 답변서 초안과 같은 순서·아이콘을 사용하고, 기존 챗봇 이벤트 계약을 유지한다.
        ["like", "dislike", "research", "copy", "issue"].forEach((action) => {
            actions.appendChild(createMessageActionButton(action));
        });
        let text = "";
        let frame = 0;

        const sourcesSlot = item.querySelector(".chat-sources-slot");
        let sourcesShown = false;

        /*
         * 타이핑 효과 (panel-conversation.js createChatTypingController 참고)
         *  - 받은 본문(text)은 그대로 모으고, 화면에는 앞에서부터 shown 글자까지만 그린다.
         *  - 일정한 간격(typingTickMs)마다 조금씩 늘린다. 밀린 글이 많으면 한 번에 더 많이 보여 줘 금방 따라잡는다.
         *  - 마지막 청크를 받아도(finish) 화면이 다 따라잡은 뒤에 마무리(복사 · 좋아요 버튼 등)한다.
         *  - 탭이 가려졌거나 다른 대화를 보고 있으면(화면에 없음) 기다리지 않고 바로 다 보여 준다.
         *  - 저장된 대화를 열 때 · 사용자가 멈췄을 때 · 동작 줄이기(prefers-reduced-motion) 설정이면 바로 다 보여 준다.
         */
        const reduceMotion = (() => {
            try {
                return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            } catch (e) {
                return false;
            }
        })();
        const typing = {
            on: cfg.typing !== false && !reduceMotion,
            line: cfg.typingUnit === "line",
            shown: 0, // 화면에 보여 준 글자 수
            carry: 0, // 아직 못 보여 준 글자 몫 (시간 기준 속도 계산용)
            last: 0, // 지난 틱 시각
            timer: 0,
            finishArgs: null, // 받기는 끝났고 화면이 따라잡기를 기다리는 finish 인자
            settled: false,
        };
        let resolveSettled;
        const settledPromise = new Promise((resolve) => {
            resolveSettled = resolve;
        });
        const settle = () => {
            if (typing.settled) return;
            typing.settled = true;
            item.classList.remove("is-typing");
            content.querySelectorAll(".chat-caret").forEach((c) => c.remove());
            resolveSettled();
        };

        const draw = () => {
            frame = 0;
            const partial = typing.shown < text.length;
            renderContent(content, partial ? text.slice(0, typing.shown) : text, { sourcesShown });
            if (typing.on && cfg.typingCaret !== false && !typing.settled && (partial || typing.finishArgs || item.classList.contains("is-typing"))) {
                addTypingCaret(content);
            }
            if (item.isConnected) scrollToBottom(); // 다른 대화를 보고 있으면(뒤에서 받는 중) 화면을 건드리지 않는다
        };

        const typingVisible = () => typing.on && item.isConnected && !document.hidden;
        const clearTyping = () => {
            if (typing.timer) {
                clearTimeout(typing.timer);
                typing.timer = 0;
            }
        };
        const scheduleTyping = () => {
            if (typing.timer) return;
            // 긴 답변은 한 번 그리는 데 시간이 들어 간격을 늘린다 (마크다운 전체를 다시 그리므로)
            const tick = (cfg.typingTickMs || 33) * (text.length > 6000 ? 3 : text.length > 3000 ? 2 : 1);
            typing.timer = setTimeout(typeTick, typing.line ? cfg.typingLineMs || 90 : tick);
        };

        function typeTick() {
            typing.timer = 0;
            const before = typing.shown;
            if (typing.shown < text.length) {
                if (!typingVisible()) {
                    typing.shown = text.length;
                } else if (typing.line) {
                    // 한 줄씩: 다음 줄바꿈까지. 아직 줄이 안 끝났으면 기다린다 (받기가 끝났으면 남은 것을 모두)
                    const nl = text.indexOf("\n", typing.shown);
                    if (nl >= 0) typing.shown = nl + 1;
                    else if (typing.finishArgs) typing.shown = text.length;
                } else {
                    // 한 자씩: 지난 틱 이후 흐른 시간 × 속도만큼만 늘린다 (한 틱에 몇 글자 이내 → 한 자씩 써지는 느낌)
                    const now = performance.now();
                    const dt = Math.min(250, typing.last ? now - typing.last : cfg.typingTickMs || 33);
                    typing.last = now;
                    const backlog = text.length - typing.shown;
                    // 속도 = max(최저 속도, 밀린 글 ÷ 허용 지연). 서버 속도를 따라가므로 화면이 1초 이상 뒤처지지 않는다
                    let cps = Math.max(cfg.typingCps || 45, backlog / ((cfg.typingLagMs || 1000) / 1000));
                    if (typing.finishArgs) {
                        // 받기가 끝나면 그 순간 남은 글 ÷ typingCatchupMs 로 속도를 고정한다 (남은 글이 줄어도 느려지지 않게)
                        if (!typing.catchupCps) typing.catchupCps = backlog / ((cfg.typingCatchupMs || 1200) / 1000);
                        cps = Math.max(cps, typing.catchupCps);
                    }
                    typing.carry += (cps * dt) / 1000;
                    const step = Math.floor(typing.carry);
                    if (step > 0) {
                        typing.carry -= step;
                        typing.shown = Math.min(text.length, typing.shown + step);
                        const code = text.charCodeAt(typing.shown - 1);
                        if (code >= 0xd800 && code <= 0xdbff) typing.shown++; // 이모지 등 한 글자가 둘로 잘리지 않게
                    }
                }
            }
            if (typing.shown !== before) draw();
            if (typing.shown < text.length) {
                scheduleTyping();
                return;
            }
            typing.last = 0; // 따라잡았으면 시계를 멈춘다 (다음 청크가 늦게 와도 몰아서 나오지 않게)
            typing.carry = 0;
            if (typing.finishArgs) {
                const args = typing.finishArgs;
                typing.finishArgs = null;
                finishNow(...args);
            }
        }

        /** 타이핑을 건너뛰고 받은 데까지 바로 다 보여 준다 */
        const flushTyping = () => {
            clearTyping();
            typing.shown = text.length;
            typeTick();
        };

        /** 마지막 청크 · 저장된 메시지의 metadata.action 으로 유사 과거 답변서 목록을 그린다 */
        const applyMetadata = (metadata) => {
            const action = metadata?.action;
            const html = action ? sourcesHtml(action.sources, action.kind, action.notice) : "";
            if (!html) return;
            sourcesSlot.innerHTML = html;
            sourcesSlot.hidden = false;
            sourcesShown = true;
        };

        const api = {
            element: item,
            setStage(label) {
                if (label) item.querySelector(".chat-stage-text").textContent = label;
            },
            append(chunk) {
                // 청크가 지금까지의 누적본이면 바꿔 끼우고, 조각이면 이어 붙인다.
                text = mergeChunk(text, chunk);
                stage.hidden = true;
                if (typing.on) {
                    item.classList.add("is-typing");
                    scheduleTyping();
                    return;
                }
                typing.shown = text.length;
                if (!frame) frame = requestAnimationFrame(draw);
            },
            /** 받기 끝: 화면 타이핑이 따라잡은 뒤 마무리한다 (돌려주는 Promise 는 마무리되면 끝난다) */
            finish(messageId, feedback, metadata) {
                if (typing.on && typing.shown < text.length && typingVisible()) {
                    typing.finishArgs = [messageId, feedback, metadata];
                    scheduleTyping();
                    return settledPromise;
                }
                clearTyping();
                typing.shown = text.length;
                finishNow(messageId, feedback, metadata);
                return settledPromise;
            },
            /** 타이핑 중이면 건너뛰고 바로 다 보여 준다 (멈춤 버튼 등) */
            flush: flushTyping,
            /** 화면 마무리(타이핑 포함)가 끝나면 이행되는 Promise */
            settled: () => settledPromise,
            stop() {
                clearTyping();
                typing.finishArgs = null;
                typing.shown = text.length;
                stopNow();
                settle();
            },
            /** 본문을 통째로 바꾼다 (반복 생성을 잘라 낼 때) */
            setText(value) {
                text = String(value ?? "");
                typing.shown = Math.min(typing.shown, text.length);
                if (typing.on) {
                    scheduleTyping();
                    return;
                }
                typing.shown = text.length;
                if (!frame) frame = requestAnimationFrame(draw);
            },
            /** 본문 아래 안내 한 줄 (반복 생성으로 멈춤 등) */
            notice(message) {
                if (item.querySelector(".chat-stopped")) return;
                content.insertAdjacentHTML("afterend", `<p class="chat-stopped">${escapeHtml(message)}</p>`);
                if (item.isConnected) scrollToBottom();
            },
            fail(message) {
                clearTyping();
                typing.finishArgs = null;
                if (frame) {
                    cancelAnimationFrame(frame);
                    frame = 0;
                }
                stage.hidden = true;
                item.classList.remove("is-streaming");
                item.classList.add("is-error");
                content.innerHTML = (text ? content.innerHTML : "") + `<p class="chat-error">${escapeHtml(message)}</p>`;
                settle();
            },
            getText: () => text,
        };

        /** 실제 마무리: 본문 전체 · 목록 카드 · 복사/좋아요 버튼 */
        function finishNow(messageId, feedback, metadata) {
            if (metadata) applyMetadata(metadata);
            if (frame) cancelAnimationFrame(frame);
            draw(); // 목록 카드를 그렸으면 본문 위 doc-list 를 뺀다
            stage.hidden = true;
            item.classList.remove("is-streaming");
            if (!text.trim() && !sourcesShown) {
                // 목록만 온 턴(재검색 등)은 빈 답변이 아니다
                api.fail("답변이 비어 있습니다.");
                return;
            }
            if (messageId) item.dataset.messageId = messageId;
            actions.hidden = false;
            if (item.isConnected) scrollToBottom();
            actions.querySelectorAll("[data-chat-action]").forEach((btn) => {
                btn.hidden = btn.dataset.chatAction !== "copy" && !messageId;
            });
            applyFeedbackState(item, feedback);
            settle();
        }

        /** 사용자가 멈춘 답변: 받은 데까지 보여 주고 아래에 안내를 붙인다 */
        function stopNow() {
            if (text.trim()) {
                finishNow(null);
                if (!item.querySelector(".chat-stopped")) {
                    content.insertAdjacentHTML("afterend", '<p class="chat-stopped">답변을 중지했습니다.</p>');
                }
            } else {
                if (frame) {
                    cancelAnimationFrame(frame);
                    frame = 0;
                }
                stage.hidden = true;
                item.classList.remove("is-streaming");
                item.classList.add("is-stopped");
                content.innerHTML = '<p class="chat-stopped">답변을 중지했습니다.</p>';
            }
            if (item.isConnected) scrollToBottom();
        }

        if (initial != null) {
            text = String(initial);
            // 저장된 답변에 반복 생성 부분이 남아 있으면(AI 서버는 끊기기 전까지 받은 것을 저장한다) 잘라서 보여 준다
            text = stripRepeats(text);
            typing.on = false; // 저장된 대화는 타이핑 없이 바로 보여 준다
            typing.shown = text.length;
            draw();
            stage.hidden = true;
        } else {
            item.classList.add("is-streaming");
        }
        scrollToBottom(true);
        return api;
    }

    // End: 메시지 영역

    // Start: 답변 중 다른 대화 보기
    /*
     * 답변을 기다리는 동안 다른 대화 · 새 채팅 · 프로젝트로 옮겨 가도 답변은 끊지 않고 뒤에서 계속 받는다.
     *  - 답변 중인 대화의 화면(메시지 노드)은 떼어 보관(parked)하고, 받은 내용은 거기에 계속 그린다.
     *  - 그 대화를 다시 열면 보관한 화면을 그대로 되붙여 이어서 보여 준다 (서버에서 다시 받지 않는다).
     *  - 다른 대화를 보는 동안 답변이 끝나면 응답 완료 알림(파란 점)을 띄운다 (알림이 켜져 있을 때).
     *  - 한 번에 하나의 답변만 받는다: 답변 중에는 다른 대화에서 질문을 보낼 수 없다 (안내만 띄운다).
     *  - 왼쪽 목록에서 답변 중인 대화에는 "답변 중" 표시(.is-answering)가 붙는다.
     *  - 대화를 만드는 아주 짧은 순간(질문을 화면에 그리기 전)에는 이동을 잠시 막는다.
     */
    const stream = { parked: null, ready: false };

    /** 지금 화면이 답변 중인 대화인지 */
    const viewingStream = () => state.streaming && !!state.streamConversationId && state.conversationId === state.streamConversationId;

    /** 이동해도 되는지 (질문을 그리기 전 짧은 순간만 막는다) */
    function canLeave() {
        if (state.streaming && !stream.ready) {
            toast("질문을 보내는 중입니다. 잠시 후 다시 눌러 주세요.");
            return false;
        }
        return true;
    }

    /** 대화 화면을 비운다. 답변 중인 대화를 보고 있었으면 지우지 않고 떼어 보관한다 */
    function clearMessagesView() {
        if (!el.messages) return;
        if (viewingStream() && stream.ready) {
            const box = document.createDocumentFragment();
            while (el.messages.firstChild) box.appendChild(el.messages.firstChild);
            stream.parked = box;
            log("답변 중인 대화를 뒤로 보냄", state.streamConversationId);
        }
        el.messages.innerHTML = "";
        syncStreamingUi();
    }

    /** 보관해 둔 답변 중 화면을 되붙인다 (그 대화를 다시 열 때) */
    function restoreStreamView() {
        if (!stream.parked || !el.messages) return false;
        el.messages.innerHTML = "";
        el.messages.appendChild(stream.parked);
        stream.parked = null;
        return true;
    }

    /** 멈춤 버튼 · 답변 중 표시는 답변 중인 대화를 보고 있을 때만 */
    function syncStreamingUi() {
        const live = viewingStream() || (state.streaming && !state.streamConversationId); // 대화를 만드는 중
        el.root?.classList.toggle("is-streaming", live);
        if (el.sendBtn) {
            el.sendBtn.classList.toggle("is-stop", live);
            el.sendBtn.classList.toggle("prompt-composer-stop", live);
            el.sendBtn.setAttribute("aria-label", live ? "생성 중지" : "보내기");
            el.sendBtn.title = live ? "생성 중지" : "보내기";
            el.sendBtn.dataset.tooltip = live ? "생성 중지" : "보내기";
            el.sendBtn.dataset.tooltipAuto = "";
            window.AIOneTooltip?.hide(el.sendBtn);
        }
        updateSendButton();
        markAnswering();
    }

    /** 왼쪽 목록에서 답변 중인 대화 표시 */
    function markAnswering() {
        const id = state.streaming ? state.streamConversationId : null;
        document.querySelectorAll("[data-conversation-id], [data-project-chat-open]").forEach((button) => {
            const cid = button.dataset.conversationId || button.dataset.projectChatOpen;
            button.closest("li")?.classList.toggle("is-answering", !!id && cid === id);
        });
    }

    // End: 답변 중 다른 대화 보기

    // Start: 대화
    async function ensureConversation(firstText, agent) {
        if (state.conversationId) return state.conversationId;
        const title = firstText.replace(/\s+/g, " ").trim().slice(0, 40);
        const projectId = state.projectId;
        const created = await postForm("ND_createConversation.do", { title, agent, projectId });
        const id = String(created?.id ?? created?.conversation_id ?? "").trim();
        if (!id) throw new Error("대화를 시작하지 못했습니다.");
        state.conversationId = id;
        state.agent = agent;
        window.clearTimeout(proj.pollTimer);
        renderTaskGuide();
        const query = pageQuery();
        query.set("conversationId", id);
        query.delete("newChat");
        window.history.replaceState(null, "", `${window.location.pathname}?${query}`);
        if (projectId) {
            // 프로젝트 대화는 일반 목록이 아니라 왼쪽 프로젝트 아래에 나온다
            expandedProjects.add(projectId);
            saveExpanded();
            projectChats[projectId] = sortPinned([{ id, title, display_title: created?.display_title || title, updated_at: new Date().toISOString() }].concat(Array.isArray(projectChats[projectId]) ? projectChats[projectId] : []));
            renderProjects();
            loadProjects();
        } else loadHistory();
        return id;
    }

    /**
     * @param options.projectId 프로젝트 대화로 열 때 그 프로젝트 ID (프로젝트 화면 · 주소의 projectId). 없으면 일반 채팅으로 연다.
     */
    async function loadConversation(conversationId, options = {}) {
        if (!conversationId || !canLeave()) return;
        const id = String(conversationId);
        const backToStream = state.streaming && id === state.streamConversationId && !!stream.parked;
        const list = backToStream ? [] : toList(await fetchJson(`ND_conversation.do?conversationId=${encodeURIComponent(id)}`));
        if (!backToStream && state.streaming && id === state.streamConversationId && !stream.parked && state.conversationId === id) return;
        closePreview();
        clearMessagesView(); // 답변 중인 대화를 보고 있었으면 뒤로 보낸다
        state.conversationId = String(conversationId);
        clearUnread(state.conversationId); // 열어 본 대화는 응답 완료 표시(파란 점)를 지운다
        window.clearTimeout(proj.pollTimer);
        if (options.projectId) {
            state.projectId = String(options.projectId);
            if (!expandedProjects.has(state.projectId)) {
                expandedProjects.add(state.projectId);
                saveExpanded();
                loadProjectChats(state.projectId, false);
            }
            proj.current = findProject(state.projectId) || proj.current || { id: state.projectId, name: "" };
        } else if (state.projectId) {
            state.projectId = null;
            proj.current = null;
        }
        // 이 대화의 에이전트: 목록 항목(agent) → 질문 메타데이터(prompt_type_option) → 일반 대화
        const cached = historyItems.find((item) => String(item.id ?? item.conversation_id ?? "") === state.conversationId);
        const fromMessages = list.find((m) => m.role === "user" && AGENT_TASKS[m.metadata?.prompt_type_option])?.metadata?.prompt_type_option;
        state.agent = cached?.agent || fromMessages || "chat";
        selectTask(AGENT_TASKS[state.agent] || "chat");
        const query = pageQuery();
        query.set("conversationId", state.conversationId);
        query.delete("newChat");
        if (state.projectId) query.set("projectId", state.projectId);
        else query.delete("projectId");
        window.history.replaceState(null, "", `${window.location.pathname}?${query}`);
        markActiveHistory();
        renderProjectChrome();
        setChatting(true);
        if (backToStream && restoreStreamView()) {
            // 답변 중인 대화로 돌아옴: 보관한 화면을 그대로 이어 보여 준다
            state.agent = stream.agent || state.agent;
            renderTaskGuide();
            syncStreamingUi();
            scrollToBottom(true);
            return;
        }
        // (답변 중인 대화로 돌아왔는데 그 사이 답변이 끝났으면 서버에서 다시 받는다)
        const messages = backToStream ? toList(await fetchJson(`ND_conversation.do?conversationId=${encodeURIComponent(id)}`)) : list;
        messages.forEach((message) => {
            if (message.role === "user") {
                addUserMessage(message.content || "", message.metadata?.files || []);
            } else if (message.role === "assistant") {
                const bubble = addAssistantMessage(message.content || "");
                bubble.finish(message.id, message.feedback, message.metadata);
            }
        });
        renderTaskGuide();
        syncStreamingUi();
        scrollToBottom(true);
    }

    /** 새 채팅. 답변 중이면 답변은 끊지 않고 뒤에서 계속 받는다 */
    function newConversation() {
        closePreview();
        clearMessagesView();
        state.conversationId = null;
        state.agent = null;
        state.files = [];
        renderAttachments();
        setChatting(false);
        leaveProject(); // 새 채팅은 일반 채팅으로 시작한다 (프로젝트 새 대화는 프로젝트 화면에서)
        const query = pageQuery();
        query.delete("conversationId");
        query.delete("projectId");
        const qs = query.toString();
        window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : ""));
        markActiveHistory();
        renderTaskGuide();
        syncStreamingUi();
        el.input?.focus();
    }

    // End: 대화

    // Start: 대화 목록 (챗봇 화면 왼쪽)
    /*
     * 목록은 서버에서 한 번 받아 두고(historyItems), 채팅 검색은 화면에서 바로 거른다.
     *  - 검색 대상은 목록에 보이는 제목(display_title, 없으면 title). 이름을 바꾼 대화도 바뀐 이름으로 찾는다.
     *    (서버 검색 title= 은 처음 제목(title)만 비교해 바꾼 이름으로는 찾지 못했다)
     *  - 대소문자·띄어쓰기를 가리지 않고, 여러 단어를 넣으면 모두 들어 있는 제목만 보여 준다.
     *  - 찾은 글자는 <mark> 로 표시한다. Esc 를 누르면 검색어를 지운다.
     */
    const HISTORY_PAGE_SIZE = 100;
    let historySeq = 0;
    let historyItems = [];
    let historyLoaded = false;

    const historyTitle = (item) => String(item?.display_title || item?.title || "제목 없음");
    const normalize = (value) =>
        String(value || "")
            .toLowerCase()
            .replace(/\s+/g, "");
    const searchWords = () => (el.historySearch?.value || "").trim().split(/\s+/).filter(Boolean);

    function matchesSearch(item, words) {
        if (!words.length) return true;
        const title = normalize(historyTitle(item));
        return words.every((word) => title.includes(normalize(word)));
    }

    /** 제목에서 검색어 부분을 <mark> 로 감싼다 (모든 글자는 escapeHtml 을 거친다) */
    function highlightTitle(title, words) {
        if (!words.length) return escapeHtml(title);
        const pattern = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
        return title
            .split(pattern)
            .map((part, i) => (i % 2 ? `<mark>${escapeHtml(part)}</mark>` : escapeHtml(part)))
            .join("");
    }

    /** 받아 둔 목록을 검색어로 걸러 그린다 (서버 호출 없음) */
    function renderHistory() {
        if (!el.historyList) return;
        if (!historyLoaded) return;
        const words = searchWords();
        const items = historyItems.filter((item) => matchesSearch(item, words));
        closeMoreMenu(false); // 다시 그리면 열려 있던 더보기 메뉴의 대상이 사라진다
        el.historyList.innerHTML = items.length
            ? items.map((item) => historyItemHtml(item, words)).join("")
            : `<li class="chatbot-history-empty"><p class="empty-title type1">${words.length ? "검색 결과가 없습니다." : "아직 대화가 없습니다."}</p></li>`;
        markActiveHistory();
    }

    async function loadHistory() {
        if (!el.historyList) return;
        const seq = ++historySeq;
        const params = new URLSearchParams({ page: "1", size: String(HISTORY_PAGE_SIZE) });
        try {
            const data = await fetchJson(`ND_conversationList.do?${params}`);
            if (seq !== historySeq) return; // 더 늦게 보낸 요청의 결과가 이미 그려졌다
            historyItems = toList(data);
            historyLoaded = true;
            renderHistory();
        } catch (error) {
            console.error("대화 목록 조회 실패", error);
            el.historyList.innerHTML = '<li class="chatbot-history-empty">대화 목록을 불러오지 못했습니다.</li>';
        }
    }

    function markActiveHistory() {
        if (proj.ready) markActiveProject();
        if (!el.historyList) return;
        el.historyList.querySelectorAll("[data-conversation-id]").forEach((button) => {
            const active = button.dataset.conversationId === state.conversationId;
            button.classList.toggle("is-active", active);
            if (active) button.setAttribute("aria-current", "page");
            else button.removeAttribute("aria-current");
        });
        refreshUnreadDots();
    }

    // End: 대화 목록 (챗봇 화면 왼쪽)

    // Start: 홈 → 챗봇 화면 넘기기
    function handoff(text) {
        if (state.files.some((f) => f.status === "uploading")) {
            toast("첨부 파일을 올리는 중입니다. 잠시 후 보내 주세요.");
            return;
        }
        const payload = {
            prompt: text,
            files: state.files.filter((f) => f.status === "ready").map((f) => f.obj),
            model: cfg.getModel() || "",
            at: Date.now(),
        };
        log("챗봇 화면으로 질문 넘김 (handoff)", payload);
        let target = cfg.chatbotUrl + (cfg.chatbotUrl.includes("?") ? "&" : "?") + "newChat=Y";
        try {
            window.sessionStorage.setItem(HANDOFF_KEY, JSON.stringify(payload));
        } catch (e) {
            // 저장소를 쓸 수 없으면(사생활 보호 모드 등) 질문만 주소로 넘긴다. 첨부는 넘기지 못한다.
            target += `&prompt=${encodeURIComponent(text.slice(0, 2000))}`;
            if (payload.files.length) toast("첨부 파일은 챗봇 화면에서 다시 올려 주세요.");
        }
        window.location.href = target;
    }

    /** 챗봇 화면: 홈에서 넘겨받은 질문을 꺼낸다 (한 번 읽으면 지운다) */
    function takeHandoff() {
        let payload = null;
        try {
            const raw = window.sessionStorage.getItem(HANDOFF_KEY);
            window.sessionStorage.removeItem(HANDOFF_KEY);
            payload = raw ? JSON.parse(raw) : null;
        } catch (e) {
            payload = null;
        }
        if (payload && (!payload.at || Date.now() - payload.at > HANDOFF_TTL)) payload = null;
        if (!payload) {
            const prompt = new URLSearchParams(window.location.search).get("prompt"); // 질문 글자의 ? 를 살리려고 원래대로 읽는다
            payload = prompt ? { prompt, files: [], model: "" } : null;
        }
        const result = payload && String(payload.prompt || "").trim() ? payload : null;
        if (result) log("홈에서 넘겨받은 질문 (handoff)", result);
        return result;
    }

    // End: 홈 → 챗봇 화면 넘기기

    // Start: 전송 (SSE)
    /**
     * 답변 중(생각 중 포함)에는 보내기 버튼을 멈춤 버튼(■)으로 바꾼다.
     * 누르면 브라우저 요청을 끊고(AbortController), 서버(ND_send)는 연결이 끊긴 것을 보고 AI 서버 요청도 끊는다.
     * 모양은 common.css의 공통 생성 중지 스타일이 담당한다 (전송 아이콘 대신 stop.svg 표시).
     */
    function setStreaming(on) {
        state.streaming = on;
        if (!on) {
            state.streamConversationId = null;
            stream.parked = null; // 다 받은 답변의 보관 화면은 버린다 (다시 열면 서버에서 받는다)
            stream.ready = false;
        }
        syncStreamingUi();
    }

    function updateSendButton() {
        syncPlaceholderTyping();
        syncHomeComposerLayout();
        if (!el.sendBtn) return;
        const uploading = state.files.some((f) => f.status === "uploading");
        const empty = !el.input?.value.trim();
        el.sendBtn.disabled = !viewingStream() && !(state.streaming && !state.streamConversationId) && (uploading || empty);
    }

    /** 답변 멈추기 (멈춤 버튼 · Esc) */
    function stop() {
        if (!state.streaming || !(viewingStream() || !state.streamConversationId)) return;
        log("사용자가 답변을 멈춤");
        state.abort?.abort();
    }

    async function send(rawText) {
        if (el.composer?.dataset.chatModelCurrent === "government") {
            toast("범정부 AI는 API 연결 준비 중입니다.");
            return;
        }
        const text = String(rawText ?? el.input?.value ?? "").trim();
        if (state.streaming) {
            if (viewingStream() || !state.streamConversationId) {
                stop();
                return;
            }
            toast("다른 대화의 답변을 받고 있습니다. 답변이 끝난 뒤 보내 주세요.");
            return;
        }
        if (!text) return;
        if (cfg.mode === "handoff") {
            handoff(text);
            return;
        }
        if (isSearchTask()) {
            runSearch(text);
            return;
        } // 내부자료 검색: AI 대화가 아니라 지능화검색
        if (state.files.some((f) => f.status === "uploading")) {
            toast("첨부 파일을 올리는 중입니다. 잠시 후 보내 주세요.");
            return;
        }

        const files = state.files.filter((f) => f.status === "ready").map((f) => f.obj);
        const controller = new AbortController();
        state.abort = controller;
        setStreaming(true);
        setChatting(true);

        let bubble = null;
        let isNewConversation = false;
        try {
            const agent = currentAgent();
            // 대화 중 작업(에이전트)을 바꿨으면 지금 대화를 이어 쓰지 않고 새 대화로 시작한다
            if (state.conversationId && state.agent && state.agent !== agent) {
                state.conversationId = null;
                el.messages.innerHTML = ""; // (아직 답변 전이라 보관할 화면이 없다)
                markActiveHistory();
                toast("작업이 바뀌어 새 대화로 시작합니다.");
            }
            isNewConversation = !state.conversationId;
            const conversationId = await ensureConversation(text, agent);
            state.streamConversationId = conversationId; // 이 대화의 답변을 받는 중 (다른 대화로 옮겨도 계속 받는다)
            stream.agent = state.agent || agent;
            clearUnread(conversationId); // 이어서 묻는 대화는 읽은 것으로
            addUserMessage(text, files);
            if (el.input) {
                el.input.value = "";
                el.input.dispatchEvent(new Event("input"));
            }
            state.files = [];
            renderAttachments();

            bubble = addAssistantMessage();
            stream.ready = true; // 이제부터는 다른 대화로 옮겨도 된다
            syncStreamingUi();
            const sendParams = {
                conversationId,
                content: text,
                files: files.length ? JSON.stringify(files) : null,
                llmModel: cfg.getModel() || null,
                agent: state.agent || agent,
            };
            log("→ POST ND_send.do (질문)", { conversationId, agent: sendParams.agent, content: text, files, llmModel: sendParams.llmModel });
            const response = await fetch(url("ND_send.do"), {
                method: "POST",
                credentials: "same-origin",
                headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8", Accept: "text/event-stream" },
                body: formBody(sendParams).toString(),
                signal: controller.signal,
            });
            log(`← ND_send.do HTTP ${response.status}`, response.headers.get("Content-Type"));
            if (!response.ok || !(response.headers.get("Content-Type") || "").includes("text/event-stream")) {
                throw new Error(response.ok ? "세션이 만료되었습니다. 다시 로그인해 주세요." : `요청 실패 (${response.status})`);
            }
            await readStream(response, bubble, controller.signal);
            // 응답 완료 알림 (파란 점): 새 대화 · 탭이 가려짐 · 다른 대화를 보고 있는 동안 끝남
            noteAnswerDone(conversationId, { isNew: isNewConversation, away: state.conversationId !== conversationId });
            if (state.conversationId !== conversationId) loadHistory(); // 목록 순서(최근 수정)를 맞춘다
        } catch (error) {
            log("전송 종료(예외)", error.name, error.message);
            if (error.name === "AbortError") {
                bubble?.stop();
            } else {
                console.error("일반 채팅 전송 실패", error);
                if (bubble) bubble.fail(errorText(error.message || "답변을 받지 못했습니다."));
                else toast(errorText(error.message || "질문을 보내지 못했습니다."));
                if (!state.conversationId) setChatting(false); // 대화를 만들지 못했으면 시작 화면(프로젝트 화면)으로 되돌린다
            }
        } finally {
            state.abort = null;
            setStreaming(false);
            if (el.input && document.activeElement !== el.historySearch) el.input.focus();
        }
    }

    /** ND_send 응답: "data: {json}" 이 빈 줄로 구분되어 온다 */
    async function readStream(response, bubble, signal) {
        const reader = response.body.getReader();
        // 멈춤: 요청 취소와 함께 읽던 스트림도 바로 닫는다 (프록시 등으로 취소가 늦게 전달되는 경우 대비)
        const onAbort = () => {
            reader.cancel().catch(() => {});
        };
        signal?.addEventListener("abort", onAbort, { once: true });
        const decoder = new TextDecoder("utf-8");
        let buffer = "";
        let lastMessageId = null;
        let lastMetadata = null; // 마지막 청크의 metadata (action · references · report)
        let finished = false;
        let looped = false; // 반복 생성을 감지해 받기를 끊었는지
        let checkedLength = 0; // 반복 검사를 마지막으로 한 본문 길이
        const started = performance.now();
        const stat = { frames: 0, chunks: 0, ignored: 0, withNewline: 0 };

        const handle = (line) => {
            if (!line.startsWith("data:")) {
                stat.ignored++;
                log("SSE 무시한 줄", line);
                return;
            }
            let frame;
            try {
                frame = JSON.parse(line.slice(5).trim());
            } catch (e) {
                stat.ignored++;
                log("SSE JSON 아님", line);
                return;
            }
            stat.frames++;
            if (!frame.type) stat.chunks++;
            log(`← SSE #${stat.frames} ${frame.type || "chunk"}`, frame.type ? frame : JSON.stringify(frame.content ?? ""), frame.type ? "" : frame);

            switch (frame.type) {
                case "stage":
                    bubble.setStage(frame.label);
                    return;
                // 보안(가드레일) 검사 단계도 안내한다 (AI 서버가 여기서 오래 머물면 화면이 멈춘 것처럼 보이지 않게)
                case "guardrail_scanning":
                    bubble.setStage("질문 내용을 확인하고 있습니다");
                    return;
                case "guardrail_scanning_done":
                    bubble.setStage(frame.blocked ? "질문 내용 확인 결과 답변이 제한되었습니다" : "답변을 생성하고 있습니다");
                    return;
                case "trace":
                    return;
                case "error":
                    finished = true;
                    bubble.fail(errorText(frame.message || "답변을 받지 못했습니다."));
                    return;
                case "done":
                    finished = true;
                    bubble.finish(lastMessageId, null, lastMetadata);
                    return;
                default:
                    break;
            }
            if (frame.type) return; // 명세에 없는 진행 프레임은 무시
            const content = String(frame.content ?? "");
            if (/^\s*\*\*ERROR\*\*/.test(content)) {
                // 명세: 오류는 본문 **ERROR**: 접두사
                finished = true;
                bubble.fail(errorText(content.replace(/^\s*\*\*ERROR\*\*:?\s*/, "") || "답변을 생성하지 못했습니다."));
                return;
            }
            if (frame.id) lastMessageId = frame.id;
            if (frame.metadata && (frame.metadata.action || frame.metadata.report || frame.metadata.references)) lastMetadata = frame.metadata;
            if (!content) return;
            if (stat.firstChunkMs == null) stat.firstChunkMs = Math.round(performance.now() - started);
            if (content.includes("\n")) stat.withNewline++;
            bubble.append(content);
            // 반복 생성 검사: 본문이 40자 이상 늘 때마다 끝부분만 본다
            const body = bubble.getText();
            if (body.length - checkedLength < 40) return;
            checkedLength = body.length;
            let cut = findRepeatStart(body);
            // 조금씩 바뀌며 이어지는 기호 덩어리($^*$-$^*$ …)가 1,000자 넘게 이어지면 회복하지 못한 것으로 보고 끊는다
            // (짧은 덩어리는 화면에서만 지우고 계속 받는다 — 모델이 다시 정상 문장으로 돌아오는 경우가 많다)
            if (cut < 0) {
                const junk = junkTailLength(body);
                if (junk >= 1000) cut = body.length - junk;
            }
            if (cut < 0) return;
            looped = true;
            finished = true;
            log(`반복 생성 감지 → 받기 중단 (본문 ${body.length}자 중 ${cut}자까지 표시)`, JSON.stringify(body.slice(cut, cut + 120)));
            bubble.setText(body.slice(0, cut).replace(/[\s|$\\]+$/, ""));
        };

        for (;;) {
            if (signal?.aborted || looped) break;
            const { value, done } = await reader.read();
            if (done || signal?.aborted) break;
            buffer += decoder.decode(value, { stream: true });
            let index;
            while (!looped && (index = buffer.indexOf("\n")) >= 0) {
                const line = buffer.slice(0, index).trim();
                buffer = buffer.slice(index + 1);
                if (line) handle(line);
            }
        }
        signal?.removeEventListener("abort", onAbort);
        if (signal?.aborted) throw new DOMException("사용자가 답변을 멈췄습니다.", "AbortError");
        if (looped) {
            // 스트림을 닫으면 서버(ND_send)가 연결 끊김을 보고 AI 서버 요청도 끊는다 (토큰 낭비 방지)
            reader.cancel().catch(() => {});
            bubble.finish(lastMessageId, null, lastMetadata);
            bubble.notice("같은 내용이 반복되어 답변을 중단했습니다. 질문을 조금 바꿔 다시 시도해 주세요.");
        } else {
            if (buffer.trim()) handle(buffer.trim());
            if (!finished) bubble.finish(lastMessageId, null, lastMetadata);
        }
        // 줄바꿈 점검: 답변이 긴데 줄바꿈이 든 청크가 하나도 없으면 표 · 제목이 한 줄로 붙는다 (AI 서버 쪽 확인 필요)
        if (stat.chunks > 20 && stat.withNewline === 0) {
            console.warn("[AIOneChat] 답변 청크에 줄바꿈(\\n)이 하나도 없습니다. AI 서버가 줄바꿈 토큰을 지우는지 확인하세요.");
        }
        // 타이핑이 끝날 때까지 "답변 중" 상태를 유지한다 (멈춤 버튼을 누르면 남은 글을 바로 다 보여 준다)
        const received = elapsed(started);
        const skipTyping = () => bubble.flush?.();
        signal?.addEventListener("abort", skipTyping, { once: true });
        await bubble.settled?.();
        signal?.removeEventListener("abort", skipTyping);
        log(
            `답변 완료 ${elapsed(started)} (받기 ${received} · 첫 글자까지 ${stat.firstChunkMs ?? "-"}ms) · 프레임 ${stat.frames}건(답변 청크 ${stat.chunks}건, 줄바꿈 든 청크 ${stat.withNewline}건) · 무시 ${stat.ignored}줄 · 반복중단=${looped} · messageId=${lastMessageId}`,
        );
        log("최종 답변 본문 ↓\n" + bubble.getText());
    }

    // End: 전송 (SSE)

    // Start: 첨부
    function renderAttachments() {
        if (!el.attachList) return;
        el.attachList.hidden = state.files.length === 0;
        el.attachList.innerHTML = state.files
            .map(
                (f) => `
      <li class="chat-attach-item is-${f.status}" data-key="${escapeHtml(f.key)}">
        <span class="chat-attach-name" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</span>
        <span class="chat-attach-state">${f.status === "uploading" ? "올리는 중" : f.status === "failed" ? "실패" : ""}</span>
        <button type="button" class="chat-attach-remove" aria-label="${escapeHtml(f.name)} 첨부 빼기" ${f.status === "uploading" ? "disabled" : ""}>×</button>
      </li>`,
            )
            .join("");
        updateSendButton();
    }

    async function addFiles(fileList) {
        const picked = Array.from(fileList || []);
        if (!picked.length) return;
        const invalid = picked.filter((f) => !cfg.allowedExt.some((ext) => f.name.toLowerCase().endsWith(ext)));
        if (invalid.length) toast(`첨부할 수 없는 형식입니다: ${invalid.map((f) => f.name).join(", ")}`);
        let files = picked.filter((f) => !invalid.includes(f));
        const room = cfg.maxFiles - state.files.length;
        if (files.length > room) {
            toast(`첨부는 ${cfg.maxFiles}개까지 할 수 있습니다.`);
            files = files.slice(0, Math.max(0, room));
        }
        if (!files.length) return;

        // 공통 보안 검사(있으면): 민감정보 파일 제외
        if (window.AIOneUploadSecurity?.validate) {
            const security = await window.AIOneUploadSecurity.validate(files);
            if (security.blocked?.length) {
                toast(`개인정보·민감정보가 감지된 파일은 제외했습니다: ${security.blocked.map((r) => r.file.name).join(", ")}`);
                files = files.filter((f) => !security.blocked.some((r) => r.file === f));
            }
            if (!files.length) return;
        }

        const entries = files.map((file) => ({ key: `${Date.now()}-${Math.random().toString(36).slice(2)}`, name: file.name, status: "uploading", obj: null }));
        state.files.push(...entries);
        renderAttachments();

        const form = new FormData();
        files.forEach((file) => form.append("files", file));
        try {
            const uploaded = toList(await fetchJson("ND_uploadFile.do", { method: "POST", body: form }));
            entries.forEach((entry, i) => {
                const obj = uploaded.find((u) => u?.name === entry.name) || uploaded[i];
                entry.obj = obj || null;
                entry.status = obj?.id ? "ready" : "failed";
            });
            if (entries.some((e) => e.status === "failed")) toast("일부 파일을 올리지 못했습니다.");
        } catch (error) {
            entries.forEach((entry) => {
                entry.status = "failed";
            });
            toast(error.message || "파일을 올리지 못했습니다.");
        }
        renderAttachments();
    }

    function removeFile(key) {
        const entry = state.files.find((f) => f.key === key);
        if (!entry) return;
        state.files = state.files.filter((f) => f !== entry);
        renderAttachments();
        if (entry.obj?.id) {
            postForm("ND_deleteFile.do", { fileId: entry.obj.id }).catch((error) => console.warn("첨부 삭제 실패", error));
        }
    }

    // End: 첨부

    // Start: 261016 수정 - 공통 답변 액션 및 오류신고 연결
    function applyFeedbackState(item, feedback) {
        item.querySelectorAll('[data-chat-action="like"],[data-chat-action="dislike"]').forEach((button) => {
            const active = button.dataset.chatAction === feedback;
            button.setAttribute("aria-pressed", String(active));
            button.classList.toggle("is-active", active);
        });
    }

    function openChatIssue(item) {
        if (!window.AIOneChatMessageActions?.openIssue) {
            openChatIssueFallback(item);
            return;
        }
        window.AIOneChatMessageActions.openIssue(item, {
            templateId: "chatIssueModalTemplate",
            showToast: toast,
            uploadFile: async (file) => {
                // [API 연동] 기존 챗봇 첨부 업로드와 같은 응답 계약을 사용한다.
                const form = new FormData();
                form.append("files", file);
                const uploaded = toList(await fetchJson("ND_uploadFile.do", { method: "POST", body: form }));
                return uploaded[0]?.id || uploaded[0]?.file_id;
            },
            submitIssue: (payload) =>
                fetchJson(
                    "ND_customer.do",
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json;charset=UTF-8" },
                        body: JSON.stringify(payload),
                    },
                    cfg.issueBaseUrl,
                ),
        });
    }

    /**
     * 261019 추가 - 오류신고 대체 창 (common.js 에 AIOneChatMessageActions 가 없을 때)
     * 화면의 #chatIssueModalTemplate 을 그대로 띄우고, 첨부는 ND_uploadFile.do · 접수는 cfg.issueBaseUrl 의 ND_customer.do(JSON)로 보낸다.
     */
    function openChatIssueFallback(item) {
        const sourceId = String(item?.dataset.messageId || "").trim();
        if (!sourceId) {
            toast("오류를 신고할 답변 정보가 없습니다.");
            return;
        }
        let backdrop;
        try {
            const box = document.createElement("div");
            box.innerHTML = getChatTemplateHtml("chatIssueModalTemplate");
            backdrop = box.firstElementChild;
        } catch (e) {
            toast("오류 신고 화면을 불러오지 못했습니다.");
            return;
        }
        document.querySelector(".chat-issue-backdrop")?.remove();
        const files = [];
        const list = backdrop.querySelector("[data-issue-file-list]");
        const input = backdrop.querySelector('input[type="file"]');
        const zone = backdrop.querySelector(".chat-issue-upload");
        const render = () => {
            list.innerHTML = files
                .map((f, i) => `<div class="chat-issue-file"><span title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</span><button type="button" data-issue-file-remove="${i}" aria-label="삭제">×</button></div>`)
                .join("");
        };
        const add = (incoming) => {
            Array.from(incoming || []).forEach((file) => {
                if (files.length >= 5) {
                    toast("파일은 최대 5개까지 첨부할 수 있습니다.");
                    return;
                }
                if (file.size > 10 * 1024 * 1024) {
                    toast(`${file.name} 파일은 10MB를 초과했습니다.`);
                    return;
                }
                if (!files.some((f) => f.name === file.name && f.size === file.size)) files.push(file);
            });
            render();
        };
        const onKey = (event) => {
            if (event.key === "Escape") close();
        };
        const close = () => {
            document.removeEventListener("keydown", onKey);
            backdrop.remove();
        };
        backdrop.addEventListener("click", (event) => {
            if (event.target === backdrop || event.target.closest("[data-issue-close]")) {
                close();
                return;
            }
            const remove = event.target.closest("[data-issue-file-remove]");
            if (remove) {
                files.splice(Number(remove.dataset.issueFileRemove), 1);
                render();
            }
        });
        input?.addEventListener("change", () => {
            add(input.files);
            input.value = "";
        });
        zone?.addEventListener("dragover", (event) => event.preventDefault());
        zone?.addEventListener("drop", (event) => {
            event.preventDefault();
            add(event.dataTransfer?.files);
        });
        backdrop.querySelector("[data-issue-submit]")?.addEventListener("click", async (event) => {
            const submit = event.currentTarget;
            submit.disabled = true;
            try {
                const fileIds = [];
                for (const file of files) {
                    const form = new FormData();
                    form.append("files", file);
                    // [API 연동] POST ND_uploadFile.do: 오류신고 첨부 업로드
                    const uploaded = toList(await fetchJson("ND_uploadFile.do", { method: "POST", body: form }));
                    const id = String(uploaded[0]?.id || uploaded[0]?.file_id || "").trim();
                    if (!id) throw new Error("첨부 파일을 올리지 못했습니다.");
                    fileIds.push(id);
                }
                // [API 연동] POST ND_customer.do: 오류신고 접수 (답변서 화면과 같은 문의 API)
                await fetchJson(
                    "ND_customer.do",
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json;charset=UTF-8" },
                        body: JSON.stringify({
                            issue_type: backdrop.querySelector('input[name="chatIssueType"]:checked')?.value || "inaccurate",
                            content: String(backdrop.querySelector("#chatIssueContent")?.value || "").trim(),
                            source_type: "conversation_log",
                            source_id: sourceId,
                            file_ids: fileIds,
                        }),
                    },
                    cfg.issueBaseUrl,
                );
                close();
                toast("오류신고가 접수되었습니다.");
            } catch (error) {
                toast(error.message || "오류신고를 접수하지 못했습니다.");
                submit.disabled = false;
            }
        });
        document.body.appendChild(backdrop);
        document.addEventListener("keydown", onKey);
        backdrop.querySelector("#chatIssueContent")?.focus();
    }

    async function handleAction(button) {
        const item = button.closest(".chat-msg-assistant");
        if (!item || button.disabled) return;
        const action = button.dataset.chatAction;
        if (action === "copy") {
            const text = item.querySelector(".chat-content")?.innerText || "";
            try {
                await copyPlain(text);
                toast("답변을 복사했습니다.");
            } catch (e) {
                toast("복사하지 못했습니다.");
            }
            return;
        }
        const messageId = item.dataset.messageId;
        if (!messageId) return;
        if (action === "research") {
            // send()는 생성 중 호출되면 중지하므로, 재검색은 완료 뒤에만 보낸다.
            if (state.streaming) {
                toast("답변이 끝난 뒤 재검색해 주세요.");
                return;
            }
            await send("관련자료를 다시 찾고 재검색해줘");
            return;
        }
        if (action === "issue") {
            openChatIssue(item);
            return;
        }
        if (action !== "like" && action !== "dislike") return;
        const pressed = button.getAttribute("aria-pressed") === "true";
        const next = pressed ? "" : action;
        const feedbackButtons = item.querySelectorAll('[data-chat-action="like"],[data-chat-action="dislike"]');
        feedbackButtons.forEach((control) => {
            control.disabled = true;
        });
        try {
            await postForm("ND_feedback.do", { messageId, feedback: next });
            applyFeedbackState(item, next);
        } catch (error) {
            toast(error.message || "평가를 저장하지 못했습니다.");
        } finally {
            feedbackButtons.forEach((control) => {
                control.disabled = false;
            });
        }
    }

    // End: 261016 수정 - 공통 답변 액션 및 오류신고 연결

    // Start: 대화 목록 더보기(⋮) : 고정하기 · 이름 바꾸기 · 프로젝트로 이동 · 삭제
    // MD_answer.jsp 채팅 목록(btn-more + 작업 메뉴 + 이름 변경·삭제 모달) 흐름을 따른다.
    // 메뉴·모달 마크업은 MD_chatbot.jsp 에 있고(#chatHistoryActionMenu · #chatRenameModal · #chatDeleteModal),
    // 없으면(홈 화면 등) 이 기능은 켜지지 않는다.
    //   이름 바꾸기 : ND_updateChatTitle.do  (= ND_updateConversationTitle.do, AI 서버 display_title)
    //   삭제        : ND_deleteChat.do       (= ND_deleteConversation.do)
    //   고정하기    : ND_conversationFavorite.do (즐겨찾기 No.19 · No.20). 고정한 대화는 목록 맨 위에 📌 와 함께 보인다.
    //                 메뉴 항목은 MD_chatbot.jsp 에 없어도 initHistoryMore 에서 "이름 바꾸기" 항목을 본떠 만들어 넣는다.
    //   (공유하기는 2026. 10. 14. 제거 — 메뉴 마크업에 남아 있어도 아래 initHistoryMore 에서 지운다)
    const MORE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="1.7"></circle>' + '<circle cx="12" cy="12" r="1.7"></circle><circle cx="12" cy="19" r="1.7"></circle></svg>';

    const more = {
        ready: false,
        current: null, // { id, title, li, button }
        lastFocus: null,
    };

    /** 목록 항목 1건의 HTML (loadHistory 에서 쓴다) */
    function historyItemHtml(item, words = []) {
        const id = String(item.id ?? item.conversation_id ?? "");
        const title = historyTitle(item);
        const moreBtn = more.ready
            ? `<button type="button" class="btn-more" data-history-more="${escapeHtml(id)}" aria-label="더보기" title="더보기"
           aria-haspopup="menu" aria-expanded="false" aria-controls="chatHistoryActionMenu">${MORE_ICON}</button>`
            : "";
        const badge = AGENT_BADGES[item.agent] ? `<span class="chatbot-history-badge">${escapeHtml(AGENT_BADGES[item.agent])}</span>` : "";
        // 고정 상태는 프로젝트 목록과 같은 is-pinned 및 공통 chatbot-pin 배지를 사용한다.
        const pin = item.is_favorite ? `<span class="chatbot-pin" aria-label="고정됨">${PIN_ICON}</span>` : "";
        return `<li class="chatbot-history-item${item.is_favorite ? " is-pinned" : ""}${more.ready ? " has-more-action" : ""}" data-history-id="${escapeHtml(id)}" data-agent="${escapeHtml(item.agent || "chat")}">
      <button type="button" class="chatbot-history-link" data-conversation-id="${escapeHtml(id)}" title="${escapeHtml(title)}">${pin}${badge}${highlightTitle(title, words)}</button>${moreBtn}
    </li>`;
    }

    const findHistoryItem = (id) => Array.from(el.historyList?.querySelectorAll("[data-history-id]") || []).find((li) => li.dataset.historyId === id) || null;

    function showActionToast(message) {
        const box = el.moreToast;
        if (!box) {
            toast(message);
            return;
        }
        box.textContent = message;
        box.hidden = false;
        window.clearTimeout(showActionToast.timer);
        showActionToast.timer = window.setTimeout(() => {
            box.hidden = true;
        }, 2200);
    }

    function placeMoreMenu(button) {
        const menu = el.moreMenu;
        const r = button.getBoundingClientRect();
        menu.style.left = "0px";
        menu.style.top = "0px";
        const mw = menu.offsetWidth;
        const mh = menu.offsetHeight;
        let top = r.bottom + 4;
        if (top + mh > window.innerHeight - 8) top = Math.max(8, r.top - mh - 4); // 아래 공간이 없으면 위로
        menu.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - mw - 8))}px`;
        menu.style.top = `${top}px`;
    }

    function openMoreMenu(button) {
        const li = button.closest("[data-history-id]");
        if (!li) return;
        closeMoreMenu(false);
        closeProjectMenu(false);
        closeProjectChatMenu(false);
        const link = li.querySelector("[data-conversation-id]");
        more.current = { id: li.dataset.historyId, title: link?.getAttribute("title") || link?.textContent.trim() || "", li, button };
        // 프로젝트로 이동: 프로젝트 기능이 있는 화면의 일반 대화만 (답변서 대화는 프로젝트 에이전트(chat)와 달라 옮기지 않는다)
        const moveItem = el.moreMenu.querySelector('[data-chat-list-action="move"]');
        if (moveItem) moveItem.hidden = !proj.ready || li.dataset.agent === "report_generator";
        setMenuItemLabel(el.moreMenu.querySelector('[data-chat-list-action="pin"]'), historyItemById(more.current.id)?.is_favorite ? "고정 해제" : "목록 고정");
        el.moreMenu.hidden = false;
        button.setAttribute("aria-expanded", "true");
        li.classList.add("is-more-open");
        placeMoreMenu(button);
        el.moreMenu.querySelector('[role="menuitem"]')?.focus();
    }

    function closeMoreMenu(restoreFocus) {
        if (!el.moreMenu || el.moreMenu.hidden) return;
        el.moreMenu.hidden = true;
        const cur = more.current;
        if (cur?.button) {
            cur.button.setAttribute("aria-expanded", "false");
            cur.li?.classList.remove("is-more-open");
            if (restoreFocus && document.body.contains(cur.button)) cur.button.focus();
        }
    }

    function openActionModal(modal, focusTarget) {
        more.lastFocus = more.current?.button || null;
        if (modal.matches("[data-modal]")) window.AIOneModal.open(modal, more.lastFocus);
        else modal.hidden = false;
        window.setTimeout(() => focusTarget?.focus(), 0);
    }

    function closeActionModal(modal) {
        if (modal.matches("[data-modal]")) {
            window.AIOneModal.close(modal);
            return;
        }
        modal.hidden = true;
        if (more.lastFocus && document.body.contains(more.lastFocus)) more.lastFocus.focus();
    }

    /** 목록 화면에서 해당 항목 제목만 바로 바꾼다 (서버 목록을 다시 받기 전에도 즉시 보이게) */
    function applyHistoryTitle(id, title) {
        const cached = historyItems.find((item) => String(item.id ?? item.conversation_id ?? "") === id);
        if (cached) {
            cached.display_title = title;
            renderHistory();
            return;
        } // 검색 중이면 새 이름 기준으로 다시 거른다
        const link = findHistoryItem(id)?.querySelector("[data-conversation-id]");
        if (!link) return;
        link.textContent = title;
        link.setAttribute("title", title);
    }

    // ── 고정하기 · 고정 해제
    const historyItemById = (id) => historyItems.find((item) => String(item.id ?? item.conversation_id ?? "") === String(id)) || null;

    /** 메뉴 항목 글자만 바꾼다 (아이콘은 그대로) */
    function setMenuItemLabel(item, label) {
        if (!item) return;
        const span = item.querySelector("span");
        if (span) {
            span.textContent = label;
            return;
        }
        const text = Array.from(item.childNodes)
            .reverse()
            .find((n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim());
        if (text) text.textContent = ` ${label}`;
        else item.appendChild(document.createTextNode(label));
    }

    /**
     * 더보기 메뉴 맨 위에 "고정하기" 항목을 넣는다.
     * MD_chatbot.jsp 에 [data-chat-list-action="pin"] 항목이 있으면 그것을 쓰고, 없으면 "이름 바꾸기" 항목을 본떠 만든다
     * (모양 · 키보드 이동 · 스타일이 다른 항목과 같도록). 감싼 <li> 가 있으면 <li> 째로 복제한다.
     */
    function addPinMenuItem() {
        if (el.moreMenu.querySelector('[data-chat-list-action="pin"]')) return;
        const rename = el.moreMenu.querySelector('[data-chat-list-action="rename"]');
        const base = rename || el.moreMenu.querySelector('[role="menuitem"]');
        if (!base) return;
        const wrap = base.parentElement;
        const cloneWrap = wrap && wrap !== el.moreMenu && wrap.tagName === "LI" && wrap.children.length === 1;
        const copy = (cloneWrap ? wrap : base).cloneNode(true);
        const item = cloneWrap ? copy.firstElementChild : copy;
        item.dataset.chatListAction = "pin";
        item.removeAttribute("id");
        item.removeAttribute("hidden");
        const icon = item.querySelector("svg, img");
        if (icon) icon.outerHTML = PIN_MENU_ICON;
        setMenuItemLabel(item, "목록 고정");
        (cloneWrap ? wrap : base).before(copy);
    }

    /** 대화 고정 · 고정 해제 (즐겨찾기). 목록을 고정한 대화 먼저로 다시 정렬한다 */
    async function togglePinHistory(target) {
        const item = historyItemById(target.id);
        const next = !item?.is_favorite;
        try {
            await postForm("ND_conversationFavorite.do", { conversationId: target.id, favorite: String(next) });
            if (item) item.is_favorite = next;
            historyItems = sortPinned(historyItems);
            renderHistory();
            // 같은 대화가 프로젝트 아래 목록에도 있으면 함께 맞춘다
            if (proj.ready) {
                let changed = false;
                Object.keys(projectChats).forEach((pid) => {
                    if (!Array.isArray(projectChats[pid])) return;
                    const chat = projectChats[pid].find((c) => String(c.id) === String(target.id));
                    if (!chat) return;
                    chat.is_favorite = next;
                    projectChats[pid] = sortPinned(projectChats[pid]);
                    changed = true;
                });
                if (changed) renderProjects();
            }
            showActionToast(next ? "대화를 고정했습니다." : "대화 고정을 해제했습니다.");
        } catch (error) {
            showActionToast(error.message || "고정 상태를 바꾸지 못했습니다.");
        }
    }

    // ── 이름 바꾸기
    function openRename() {
        el.renameInput.value = more.current.title;
        el.renameError.hidden = true;
        el.renameConfirm.disabled = false;
        openActionModal(el.renameModal, el.renameInput);
        window.setTimeout(() => el.renameInput.select(), 0);
    }

    async function submitRename() {
        const target = more.current;
        if (!target || el.renameConfirm.disabled) return;
        let title = el.renameInput.value.trim();
        if (!title) {
            el.renameError.hidden = false;
            el.renameInput.focus();
            return;
        }
        if (title === target.title) {
            closeActionModal(el.renameModal);
            return;
        }

        el.renameConfirm.disabled = true;
        try {
            const result = await postForm("ND_updateChatTitle.do", { conversationId: target.id, title });
            if (result?.display_title) title = String(result.display_title); // 서버가 60자로 자른 최종 제목
            target.title = title;
            applyHistoryTitle(target.id, title); // 즉시 반영
            closeActionModal(el.renameModal);
            showActionToast("대화 이름을 변경했습니다.");
            document.dispatchEvent(new CustomEvent("aione:chat-renamed", { detail: { conversationId: target.id, title } }));
            loadHistory(); // 서버 목록으로 다시 그리기
        } catch (error) {
            showActionToast(error.message || "이름을 변경하지 못했습니다.");
        } finally {
            el.renameConfirm.disabled = false;
        }
    }

    // ── 삭제
    function openDelete() {
        el.deleteConfirm.disabled = false;
        openActionModal(el.deleteModal, el.deleteConfirm);
    }

    async function submitDelete() {
        const target = more.current;
        if (!target || el.deleteConfirm.disabled) return;
        el.deleteConfirm.disabled = true;
        try {
            await postForm("ND_deleteChat.do", { conversationId: target.id });
            historyItems = historyItems.filter((item) => String(item.id ?? item.conversation_id ?? "") !== target.id);
            findHistoryItem(target.id)?.remove(); // 즉시 반영
            more.lastFocus = null;
            closeActionModal(el.deleteModal);
            more.current = null;
            // 보고 있던 대화를 지웠으면 새 채팅 화면으로
            if (target.id === state.conversationId) newConversation();
            showActionToast("대화를 삭제했습니다.");
            document.dispatchEvent(new CustomEvent("aione:chat-deleted", { detail: { conversationId: target.id } }));
            loadHistory(); // 서버 목록으로 다시 그리기
        } catch (error) {
            showActionToast(error.message || "대화를 삭제하지 못했습니다.");
        } finally {
            el.deleteConfirm.disabled = false;
        }
    }

    /** 더보기 메뉴·모달 연결. 마크업이 없는 화면에서는 아무것도 하지 않는다. */
    function initHistoryMore() {
        Object.assign(el, {
            moreMenu: document.getElementById("chatHistoryActionMenu"),
            renameModal: document.getElementById("chatRenameModal"),
            renameInput: document.getElementById("chatRenameInput"),
            renameError: document.getElementById("chatRenameError"),
            renameConfirm: document.getElementById("chatRenameConfirm"),
            deleteModal: document.getElementById("chatDeleteModal"),
            deleteConfirm: document.getElementById("chatDeleteConfirm"),
            moreToast: document.getElementById("chatActionToast"),
        });
        if (!el.historyList || !el.moreMenu || !el.renameModal || !el.deleteModal) return;

        // 레이아웃(SiteMesh)이 감싼 요소 안에 있으면 위치·겹침 순서가 틀어질 수 있어 body 바로 아래로 옮긴다
        [el.moreMenu, el.renameModal, el.deleteModal, el.moreToast].forEach((node) => {
            if (node && node.parentNode !== document.body) document.body.appendChild(node);
        });
        more.ready = true;

        // 공유하기 제거: MD_chatbot.jsp 메뉴 마크업에 항목이 남아 있어도 화면에서 지운다 (감싼 <li> 가 있으면 함께)
        el.moreMenu.querySelectorAll('[data-chat-list-action="share"]').forEach((item) => {
            const wrap = item.parentElement;
            const onlyChild = wrap && wrap !== el.moreMenu && wrap.tagName === "LI" && wrap.children.length === 1;
            (onlyChild ? wrap : item).remove();
        });

        addPinMenuItem();

        el.moreMenu.addEventListener("click", (event) => {
            const item = event.target.closest("[data-chat-list-action]");
            if (!item || !more.current) return;
            event.stopPropagation();
            const action = item.dataset.chatListAction;
            closeMoreMenu(false);
            if (action === "pin") togglePinHistory(more.current);
            else if (action === "rename") openRename();
            else if (action === "move") openMoveModal(more.current);
            else if (action === "delete") openDelete();
        });
        el.moreMenu.addEventListener("keydown", (event) => {
            const items = Array.from(el.moreMenu.querySelectorAll('[role="menuitem"]:not([hidden])'));
            const index = items.indexOf(document.activeElement);
            if (event.key === "ArrowDown") {
                event.preventDefault();
                items[(index + 1) % items.length].focus();
            } else if (event.key === "ArrowUp") {
                event.preventDefault();
                items[(index - 1 + items.length) % items.length].focus();
            } else if (event.key === "Tab") closeMoreMenu(false);
        });

        [el.renameModal, el.deleteModal].forEach((modal) =>
            modal.addEventListener("click", (event) => {
                if (event.target.closest("[data-chat-modal-close]")) closeActionModal(modal);
            }),
        );
        el.renameConfirm.addEventListener("click", submitRename);
        el.renameInput.addEventListener("keydown", (event) => {
            if (event.key === "Enter" && !event.isComposing && event.keyCode !== 229) {
                event.preventDefault();
                submitRename();
            }
        });
        el.renameInput.addEventListener("input", () => {
            if (el.renameInput.value.trim()) el.renameError.hidden = true;
        });
        el.deleteConfirm.addEventListener("click", submitDelete);

        document.addEventListener("click", (event) => {
            if (!el.moreMenu.hidden && !el.moreMenu.contains(event.target) && !event.target.closest("[data-history-more]")) closeMoreMenu(false);
        });
        document.addEventListener("keydown", (event) => {
            if (event.key !== "Escape") return;
            if (!el.moreMenu.hidden) {
                closeMoreMenu(true);
                return;
            }
            if (!el.renameModal.hidden) closeActionModal(el.renameModal);
            if (!el.deleteModal.hidden) closeActionModal(el.deleteModal);
        });
        window.addEventListener("resize", () => closeMoreMenu(false));
        // 목록을 스크롤하면 닫는다 (scroll 은 버블링되지 않아 캡처로 받는다)
        document.addEventListener(
            "scroll",
            (event) => {
                if (!el.moreMenu.hidden && event.target?.nodeType === 1 && event.target.contains(el.historyList)) closeMoreMenu(false);
            },
            true,
        );
    }

    // End: 대화 목록 더보기(⋮) : 고정하기 · 이름 바꾸기 · 프로젝트로 이동 · 삭제

    // Start: 프로젝트 (명세 v1.0 No.2~14)
    /*
     * 프로젝트 = 대화 · 파일 · 맞춤형 지침을 한곳에 모은 작업 공간 (에이전트는 일반 채팅 chat 고정)
     *  - 왼쪽 "프로젝트" 목록(ND_projectList) → 누르면 가운데에 프로젝트 화면(#projectView)
     *      대화 목록(ND_projectConversations) · 맞춤형 지침(ND_projectUpdate) · 파일(ND_projectSources / ND_projectUploadSources)
     *  - 프로젝트 화면에서 아래 입력창으로 보내면 그 프로젝트의 새 대화가 된다 (ND_createConversation + projectId)
     *    대화 중에는 메시지 위에 "📁 프로젝트명" 표시(#chatProjectCrumb)가 나오고, 누르면 프로젝트 화면으로 돌아간다.
     *  - 프로젝트 대화는 일반 채팅 목록에 나오지 않는다 (AI 서버 No.13 기본 동작). 프로젝트 화면의 대화 목록에서 연다.
     *  - 채팅 목록 더보기 → "프로젝트로 이동"(ND_moveConversation). 답변서(report_generator) 대화는 옮길 수 없다.
     *  - 파일은 분석 · 색인이 끝나 "사용 가능"(completed)이 된 뒤 보내는 질문부터 반영된다. 처리 중이면 4초마다 다시 확인한다.
     *  - 프로젝트 삭제(permanent=true): 파일 · 지침은 지워지고 대화는 일반 채팅 목록으로 옮겨진다.
     * 마크업(#projectList · #projectView …)이 없는 화면에서는 아무것도 하지 않는다.
     */
    const PROJECT_POLL_MS = 4000;
    const PROJECT_RECHECK_MS = 2 * 60 * 1000; // chunking_failed 가 completed 로 바뀌는 경우가 있어 올린 뒤 2분간 다시 확인
    const PROJECT_MAX_FILES = 10;
    const SOURCE_BUSY = new Set(["pending", "filtering", "filtering_completed", "chunking"]);
    const SOURCE_FAILED = new Set(["failed", "filtering_failed", "chunking_failed"]);
    const FOLDER_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg>';
    const FOLDER_OPEN_ICON =
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17V7a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v1"></path><path d="M3 17l2.4-6.2A1.5 1.5 0 0 1 6.8 10H21l-2.6 7.4A2 2 0 0 1 16.5 19H5a2 2 0 0 1-2-2z"></path></svg>';
    /*
     * 고정(= 즐겨찾기) 표시는 common.css의 공통 핀 배지로 통일한다.
     *   PIN_ICON      : 목록 제목 앞 표시 (채팅 목록 · 프로젝트 아래 목록 · 프로젝트 화면 목록 공통)
     *   PIN_MENU_ICON : 더보기 메뉴 "고정하기" 항목 아이콘 (다른 메뉴 아이콘처럼 선만)
     */
    const PIN_ICON = '<img class="icon" src="../assets/icons/pin.svg" data-icon="pin" alt="" aria-hidden="true">';
    const PIN_MENU_ICON = '<img class="icon drawer-list-action-icon" src="../assets/icons/pin.svg" data-icon="pin" alt="" aria-hidden="true">';
    const PEN_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h8"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"></path></svg>';
    /*
     * 왼쪽 프로젝트 목록 아래 대화 (ChatGPT 의 프로젝트 목록처럼)
     *  - 왼쪽 메뉴가 보이면 모든 프로젝트 아래에 프로젝트 대화(ND_projectConversations, 최근 20건)를 펼쳐 보여 준다.
     *  - 프로젝트 이름(또는 폴더 아이콘)을 누르면 그 프로젝트의 대화를 숨기고, 다시 누르면 펼친다.
     *    프로젝트 화면(지침 · 파일 · 새 채팅)은 연필 버튼으로 연다.
     *  - 접어 둔 프로젝트는 이 브라우저에 기억해 새로고침해도 접어 둔다. 대화가 없는 프로젝트는 아래에 아무것도 그리지 않는다.
     *  - 채팅 검색어는 프로젝트 이름과 그 아래 대화 제목에 함께 적용한다.
     *  - "프로젝트 ⌄" 제목을 누르면 프로젝트 목록 전체를 접고 편다.
     */
    const PROJECT_COLLAPSED_KEY = "aiOneChatProjectCollapsed";
    const PROJECT_SIDEBAR_CHATS = 20; // 왼쪽 목록에 보여 줄 프로젝트별 대화 수
    const PROJECT_SECTION_KEY = "aiOneChatProjectSection";
    const projectChats = {}; // 프로젝트 ID → 대화 목록 (배열) · 'loading' · 'error'
    /** 기본은 모두 펼침 — 사용자가 접은 프로젝트만 기억한다 */
    const collapsedProjects = new Set(
        (() => {
            try {
                return JSON.parse(window.localStorage.getItem(PROJECT_COLLAPSED_KEY) || "[]").map(String);
            } catch (e) {
                return [];
            }
        })(),
    );
    const expandedProjects = {
        has: (id) => !collapsedProjects.has(String(id)),
        add: (id) => {
            collapsedProjects.delete(String(id));
        },
        delete: (id) => {
            collapsedProjects.add(String(id));
        },
    };
    function saveExpanded() {
        try {
            window.localStorage.setItem(PROJECT_COLLAPSED_KEY, JSON.stringify(Array.from(collapsedProjects).slice(-100)));
        } catch (e) {
            /* 무시 */
        }
    }

    const proj = {
        ready: false,
        items: [], // 프로젝트 목록 (ND_projectList)
        loaded: false,
        current: null, // 열린 프로젝트 상세 (ND_project)
        chatMenu: null, // 왼쪽 프로젝트 대화 더보기 메뉴 대상 { pid, cid, title, li, button }
        menu: null, // 왼쪽 목록 더보기 메뉴 대상 { id, li, button }
        conversations: [],
        sources: [],
        uploading: [], // 올리는 중인 파일 이름
        seq: 0,
        listSeq: 0,
        pollTimer: null,
        recheckUntil: 0,
        savedPlaceholder: null,
        form: null, // { mode: 'create' | 'edit' }
        confirmAction: null,
        moveTarget: null,
        lastFocus: null,
    };

    const projectName = (item) => String(item?.name || "이름 없는 프로젝트");
    const findProject = (id) => proj.items.find((p) => String(p.id) === String(id)) || null;

    function fileSize(bytes) {
        const n = Number(bytes);
        if (!Number.isFinite(n) || n < 0) return "";
        if (n < 1024) return `${n}B`;
        if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10240 ? 1 : 0)}KB`;
        return `${(n / 1024 / 1024).toFixed(1)}MB`;
    }

    function shortDate(iso) {
        const d = iso ? new Date(iso) : null;
        if (!d || Number.isNaN(d.getTime())) return "";
        const now = new Date();
        const pad = (v) => String(v).padStart(2, "0");
        if (d.toDateString() === now.toDateString()) return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
        return d.getFullYear() === now.getFullYear() ? `${d.getMonth() + 1}월 ${d.getDate()}일` : `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
    }

    /** 주소창 값 바꾸기 (새로고침 · 공유 시 같은 화면이 열리게) */
    function setQuery(changes) {
        const query = pageQuery();
        Object.entries(changes).forEach(([key, value]) => (value ? query.set(key, value) : query.delete(key)));
        const qs = query.toString();
        window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : ""));
    }

    // ── 왼쪽 프로젝트 목록
    async function loadProjects() {
        if (!el.projectList) return;
        const seq = ++proj.listSeq;
        try {
            const data = await fetchJson("ND_projectList.do?page=1&size=100");
            if (seq !== proj.listSeq) return;
            proj.items = toList(data).filter((p) => p && p.id && p.is_active !== false);
            proj.loaded = true;
            if (proj.current) {
                const fresh = findProject(proj.current.id);
                if (fresh) proj.current = Object.assign({}, proj.current, fresh);
            }
            renderProjects();
            renderProjectChrome();
            // 펼친 프로젝트(기본: 전부)의 대화를 받는다. 없어진 프로젝트는 접힘 기억에서 뺀다.
            proj.items.forEach((p) => {
                if (expandedProjects.has(p.id)) loadProjectChats(p.id, true);
            });
            Array.from(collapsedProjects).forEach((pid) => {
                if (!findProject(pid)) collapsedProjects.delete(pid);
            });
            saveExpanded();
        } catch (error) {
            console.error("프로젝트 목록 조회 실패", error);
            el.projectList.innerHTML = '<li class="chatbot-history-empty">프로젝트를 불러오지 못했습니다.</li>';
        }
    }

    /** 프로젝트 대화를 받아 왼쪽 목록에 넣는다 (펼칠 때 · 대화가 바뀔 때) */
    async function loadProjectChats(projectId, force) {
        const id = String(projectId || "");
        if (!id || !el.projectList) return;
        if (!force && Array.isArray(projectChats[id])) return;
        if (!Array.isArray(projectChats[id])) {
            projectChats[id] = "loading";
            renderProjects();
        }
        try {
            const data = await fetchJson(`ND_projectConversations.do?projectId=${encodeURIComponent(id)}&size=${PROJECT_SIDEBAR_CHATS}`);
            projectChats[id] = toList(data);
        } catch (error) {
            console.error("프로젝트 대화 목록 조회 실패", error);
            if (!Array.isArray(projectChats[id])) projectChats[id] = "error";
        }
        renderProjects();
    }

    function setProjectExpanded(projectId, expanded) {
        const id = String(projectId || "");
        if (!id) return;
        if (expanded) {
            expandedProjects.add(id);
            loadProjectChats(id, false);
        } else {
            expandedProjects.delete(id);
        }
        saveExpanded();
        renderProjects();
    }

    function projectChatsHtml(id, chats, words, nameMatched) {
        if (!Array.isArray(chats)) return ""; // 받는 중 · 실패: 아래에 그리지 않는다 (목록이 깜빡이지 않게)
        const list = words.length && !nameMatched ? chats.filter((c) => matchesSearch(c, words)) : chats;
        if (!list.length) return "";
        const pid = escapeHtml(id);
        return `<ul class="chatbot-project-chats">${list
            .map((c) => {
                const cid = escapeHtml(c.id);
                const title = historyTitle(c);
                const pinned = !!c.is_favorite;
                const moreBtn = el.projectChatMenu
                    ? `<button type="button" class="btn-more" data-project-chat-more="${cid}" data-project-id="${pid}" aria-label="대화 더보기" title="더보기"
             aria-haspopup="menu" aria-expanded="false" aria-controls="projectChatActionMenu">${MORE_ICON}</button>`
                    : "";
                return `<li class="chatbot-project-chat-item${pinned ? " is-pinned" : ""}${el.projectChatMenu ? " has-more-action" : ""}" data-project-chat-item="${cid}">
        <button type="button" class="chatbot-project-chat" data-project-chat-open="${cid}" data-project-id="${pid}" title="${escapeHtml(title)}">${pinned ? `<span class="chatbot-pin" aria-label="고정됨">${PIN_ICON}</span>` : ""}${highlightTitle(title, words)}</button>${moreBtn}
      </li>`;
            })
            .join("")}</ul>`;
    }

    function renderProjects() {
        if (!el.projectList || !proj.loaded) return;
        closeProjectMenu(false); // 다시 그리면 열려 있던 메뉴의 대상이 사라진다
        closeProjectChatMenu(false);
        const words = searchWords();
        const matchName = (p) => words.every((w) => normalize(projectName(p)).includes(normalize(w)));
        const matchChats = (p) => Array.isArray(projectChats[p.id]) && projectChats[p.id].some((c) => matchesSearch(c, words));
        const items = proj.items.filter((p) => !words.length || matchName(p) || matchChats(p));
        el.projectList.innerHTML = items.length
            ? items
                  .map((p) => {
                      const id = escapeHtml(p.id);
                      const name = projectName(p);
                      // 대화 수(conversation_count)는 표시하지 않는다 — 대화는 프로젝트 아래에 바로 보인다
                      const nameMatched = !words.length || matchName(p);
                      // 검색 중에는 대화 제목이 맞은 프로젝트를 펼쳐 보여 준다
                      const expanded = expandedProjects.has(String(p.id)) || (!!words.length && !nameMatched);
                      const tools = el.projectMenu
                          ? `<button type="button" class="btn-new-chat" data-project-newchat="${id}" aria-label="프로젝트 열기 (새 채팅 · 지침 · 파일)" title="프로젝트 열기 (새 채팅 · 지침 · 파일)">${PEN_ICON}</button>
             <button type="button" class="btn-more" data-project-more="${id}" aria-label="프로젝트 더보기" title="더보기"
               aria-haspopup="menu" aria-expanded="false" aria-controls="projectActionMenu">${MORE_ICON}</button>`
                          : "";
                      return `<li class="chatbot-project-item${el.projectMenu ? " has-more-action" : ""}${expanded ? " is-expanded" : ""}" data-project-item="${id}">
          <button type="button" class="chatbot-project-link" data-project-open="${id}" title="${escapeHtml(name)} — 눌러서 대화 ${expanded ? "숨기기" : "보이기"}" aria-expanded="${expanded}">
            <span class="chatbot-project-icon" data-project-toggle="${id}" title="${expanded ? "대화 접기" : "대화 펼치기"}">${expanded ? FOLDER_OPEN_ICON : FOLDER_ICON}</span><span class="chatbot-project-name">${highlightTitle(name, words)}</span>
          </button>${tools}
          ${expanded ? projectChatsHtml(String(p.id), projectChats[p.id], words, nameMatched) : ""}
        </li>`;
                  })
                  .join("")
            : `<li class="chatbot-history-empty"><p class="empty-title type1">${words.length ? "검색 결과가 없습니다." : "프로젝트를 만들어 대화 · 파일 · 지침을 모아 보세요."}</p></li>`;
        markActiveProject();
    }

    function markActiveProject() {
        el.projectList?.querySelectorAll("[data-project-open]").forEach((button) => {
            const active = button.dataset.projectOpen === state.projectId;
            button.classList.toggle("is-active", active);
            if (active) button.setAttribute("aria-current", "page");
            else button.removeAttribute("aria-current");
        });
        el.projectList?.querySelectorAll("[data-project-chat-open]").forEach((button) => {
            const active = !!state.conversationId && button.dataset.projectChatOpen === state.conversationId;
            button.classList.toggle("is-active", active);
            if (active) button.setAttribute("aria-current", "page");
            else button.removeAttribute("aria-current");
        });
        refreshUnreadDots();
    }

    /** 프로젝트 화면 · 대화 위 표시 · 입력창 안내를 지금 상태에 맞춘다 */
    function renderProjectChrome() {
        if (!proj.ready) return;
        const inProject = !!state.projectId;
        el.root?.classList.toggle("is-project", inProject);
        if (el.projectView) el.projectView.hidden = !inProject;
        if (el.projectCrumb) el.projectCrumb.hidden = !inProject;
        const name = projectName(proj.current || findProject(state.projectId));
        if (el.projectCrumbName) el.projectCrumbName.textContent = name;
        if (el.input) {
            if (inProject) {
                if (proj.savedPlaceholder == null) proj.savedPlaceholder = el.input.placeholder;
                el.input.placeholder = `${name} 프로젝트에서 질문해 보세요`;
            } else if (proj.savedPlaceholder != null) {
                el.input.placeholder = proj.savedPlaceholder;
                proj.savedPlaceholder = null;
            }
        }
        markActiveProject();
    }

    /** 프로젝트에서 나간다 (상태만 정리 — 화면은 부르는 쪽이 정한다) */
    function leaveProject() {
        if (!state.projectId) return;
        state.projectId = null;
        proj.current = null;
        proj.seq++;
        window.clearTimeout(proj.pollTimer);
        setQuery({ projectId: null });
        renderProjectChrome();
    }

    // ── 프로젝트 화면
    async function openProject(id) {
        if (!id || !proj.ready) return;
        if (!canLeave()) return; // 답변 중이어도 이동할 수 있다 (답변은 뒤에서 계속 받는다)
        closePreview();
        closeMoreMenu(false);
        clearMessagesView(); // 답변 중인 대화를 보고 있었으면 뒤로 보낸다 (대화 ID 를 지우기 전에)
        state.conversationId = null;
        state.agent = null;
        state.files = [];
        renderAttachments();
        state.projectId = String(id);
        proj.current = findProject(id) || { id: state.projectId, name: "" };
        proj.conversations = [];
        if (!expandedProjects.has(state.projectId)) {
            expandedProjects.add(state.projectId);
            saveExpanded();
            renderProjects();
        }
        proj.sources = [];
        selectTask("chat"); // 프로젝트 에이전트는 일반 채팅
        setQuery({ projectId: state.projectId, conversationId: null, newChat: null });
        markActiveHistory();
        setChatting(false);
        renderProjectChrome();
        renderProjectView(true);
        renderTaskGuide();
        el.input?.focus();
        await refreshProject();
    }

    async function refreshProject() {
        const id = state.projectId;
        if (!id) return;
        const seq = ++proj.seq;
        const q = `projectId=${encodeURIComponent(id)}`;
        const [detail, convs, sources] = await Promise.allSettled([fetchJson(`ND_project.do?${q}`), fetchJson(`ND_projectConversations.do?${q}`), fetchJson(`ND_projectSources.do?${q}`)]);
        if (seq !== proj.seq || id !== state.projectId) return;
        if (detail.status === "rejected") {
            toast(detail.reason?.message || "프로젝트를 찾을 수 없습니다.");
            newConversation();
            loadProjects();
            return;
        }
        proj.current = detail.value || proj.current;
        proj.conversations = convs.status === "fulfilled" ? toList(convs.value) : null;
        if (Array.isArray(proj.conversations)) {
            projectChats[id] = proj.conversations.slice();
            renderProjects();
        }
        proj.sources = sources.status === "fulfilled" ? toList(sources.value) : null;
        renderProjectChrome();
        renderProjectView(false);
        schedulePoll();
    }

    function renderProjectView(loading) {
        if (!el.projectView || !proj.current) return;
        const p = proj.current;
        el.projectName.textContent = projectName(p);
        el.projectDesc.textContent = p.description || "";
        el.projectDesc.hidden = !p.description;
        if (!loading || !el.projectInstructions.dataset.dirty) {
            el.projectInstructions.value = p.system_instructions || "";
            el.projectInstructions.dataset.dirty = "";
        }
        updateInstructionsState(loading ? "" : null);
        renderProjectConversations(loading);
        renderProjectSources(loading);
    }

    function renderProjectConversations(loading) {
        const list = proj.conversations;
        if (el.projectChatCount) el.projectChatCount.textContent = Array.isArray(list) && list.length ? String(list.length) : "";
        if (loading) {
            el.projectChatList.innerHTML = '<li class="project-empty">불러오는 중…</li>';
            return;
        }
        if (!Array.isArray(list)) {
            el.projectChatList.innerHTML = '<li class="project-empty">대화 목록을 불러오지 못했습니다.</li>';
            return;
        }
        el.projectChatList.innerHTML = list.length
            ? list
                  .map((c) => {
                      const id = escapeHtml(c.id);
                      const title = historyTitle(c);
                      return `<li class="project-chat-item">
          <button type="button" class="project-chat-link" data-project-chat="${id}" title="${escapeHtml(title)}">
            <span class="project-chat-title">${c.is_favorite ? `<span class="chatbot-pin" aria-label="고정됨">${PIN_ICON}</span>` : ""}${escapeHtml(title)}</span>
            ${c.last_message ? `<span class="project-chat-last">${escapeHtml(String(c.last_message).slice(0, 120))}</span>` : ""}
          </button>
          <span class="project-chat-date">${escapeHtml(shortDate(c.updated_at))}</span>
          <button type="button" class="project-icon-btn" data-project-chat-remove="${id}" data-title="${escapeHtml(title)}" aria-label="프로젝트에서 빼기" title="프로젝트에서 빼기 (일반 채팅 목록으로)">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14 4 9l5-5"></path><path d="M4 9h11a5 5 0 0 1 0 10h-3"></path></svg>
          </button>
        </li>`;
                  })
                  .join("")
            : '<li class="project-empty">아직 대화가 없습니다. 아래 입력창에서 첫 질문을 보내 보세요.</li>';
    }

    function sourceStatus(s) {
        if (SOURCE_BUSY.has(s.status)) return { cls: "is-busy", label: "분석 중" };
        if (s.status === "completed") return { cls: "is-ready", label: "사용 가능" };
        if (s.status === "chunking_failed" && Date.now() < proj.recheckUntil) return { cls: "is-busy", label: "확인 중" };
        if (SOURCE_FAILED.has(s.status)) return { cls: "is-failed", label: "실패" };
        return { cls: "is-busy", label: s.status || "확인 중" };
    }

    function renderProjectSources(loading) {
        const list = proj.sources;
        const uploading = proj.uploading
            .map(
                (name) => `<li class="project-file-item">
        <span class="project-file-name" title="${escapeHtml(name)}">${escapeHtml(name)}</span>
        <span class="project-file-status is-busy">올리는 중</span>
      </li>`,
            )
            .join("");
        if (loading) {
            el.projectFileList.innerHTML = '<li class="project-empty">불러오는 중…</li>';
            return;
        }
        if (!Array.isArray(list)) {
            el.projectFileList.innerHTML = uploading + '<li class="project-empty">파일 목록을 불러오지 못했습니다.</li>';
            return;
        }
        const rows = list
            .map((s) => {
                const st = sourceStatus(s);
                const size = fileSize(s.size);
                return `<li class="project-file-item">
        <span class="project-file-name" title="${escapeHtml(s.name || "")}">${escapeHtml(s.name || "이름 없는 파일")}</span>
        ${size ? `<span class="project-file-size">${escapeHtml(size)}</span>` : ""}
        <span class="project-file-status ${st.cls}">${st.label}</span>
        <button type="button" class="project-icon-btn" data-project-source-delete="${escapeHtml(s.id)}" data-title="${escapeHtml(s.name || "")}" aria-label="파일 삭제" title="파일 삭제">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"></path></svg>
        </button>
      </li>`;
            })
            .join("");
        el.projectFileList.innerHTML = uploading + rows || '<li class="project-empty">올린 파일이 없습니다. 답변에 참고할 자료를 올려 보세요.</li>';
        const busy = proj.uploading.length || list.some((s) => sourceStatus(s).cls === "is-busy");
        if (el.projectFileHint) {
            el.projectFileHint.textContent = busy ? '분석 중인 파일은 "사용 가능"이 된 뒤 보내는 질문부터 반영됩니다.' : '"사용 가능" 상태의 파일을 참고해 답변합니다.';
        }
    }

    async function refreshSources() {
        const id = state.projectId;
        if (!id || state.conversationId) return;
        try {
            const data = await fetchJson(`ND_projectSources.do?projectId=${encodeURIComponent(id)}`);
            if (id !== state.projectId) return;
            proj.sources = toList(data);
            renderProjectSources(false);
        } catch (error) {
            console.error("프로젝트 파일 목록 조회 실패", error);
        }
        schedulePoll();
    }

    /** 처리 중인 파일이 있으면 잠시 뒤 상태를 다시 받는다 (프로젝트 화면을 보고 있을 때만) */
    function schedulePoll() {
        window.clearTimeout(proj.pollTimer);
        if (!state.projectId || state.conversationId || !Array.isArray(proj.sources)) return;
        const recheck = Date.now() < proj.recheckUntil && proj.sources.some((s) => SOURCE_FAILED.has(s.status));
        if (recheck || proj.sources.some((s) => SOURCE_BUSY.has(s.status))) {
            proj.pollTimer = window.setTimeout(refreshSources, PROJECT_POLL_MS);
        }
    }

    async function uploadProjectFiles(fileList) {
        const id = state.projectId;
        const picked = Array.from(fileList || []);
        if (!id || !picked.length) return;
        const invalid = picked.filter((f) => !cfg.allowedExt.some((ext) => f.name.toLowerCase().endsWith(ext)));
        if (invalid.length) {
            toast(`올릴 수 없는 형식입니다: ${invalid.map((f) => f.name).join(", ")}`);
            return;
        }
        if (picked.length > PROJECT_MAX_FILES) {
            toast(`한 번에 ${PROJECT_MAX_FILES}개까지 올릴 수 있습니다.`);
            return;
        }

        const form = new FormData();
        form.append("projectId", id);
        picked.forEach((file) => form.append("files", file));
        proj.uploading = picked.map((f) => f.name);
        renderProjectSources(false);
        el.projectFileAdd.disabled = true;
        try {
            const added = toList(await fetchJson("ND_projectUploadSources.do", { method: "POST", body: form }));
            if (added.length < picked.length) toast("일부 파일을 올리지 못했습니다.");
            else showActionToast(`파일 ${added.length}개를 올렸습니다. 분석이 끝나면 답변에 반영됩니다.`);
            proj.recheckUntil = Date.now() + PROJECT_RECHECK_MS;
        } catch (error) {
            toast(error.message || "파일을 올리지 못했습니다.");
        } finally {
            proj.uploading = [];
            el.projectFileAdd.disabled = false;
            if (id === state.projectId) refreshSources();
        }
    }

    // ── 맞춤형 지침
    function updateInstructionsState(message) {
        const value = el.projectInstructions.value;
        const saved = proj.current?.system_instructions || "";
        const dirty = value !== saved;
        el.projectInstructions.dataset.dirty = dirty ? "Y" : "";
        el.projectInstructionsSave.disabled = !dirty;
        const max = Number(el.projectInstructions.getAttribute("maxlength")) || 8000;
        el.projectInstructionsCount.textContent = `${value.length.toLocaleString()} / ${max.toLocaleString()}`;
        if (message != null) el.projectInstructionsState.textContent = message;
        else el.projectInstructionsState.textContent = dirty ? "저장하지 않음" : saved ? "적용 중" : "";
    }

    async function saveInstructions() {
        const id = state.projectId;
        if (!id || el.projectInstructionsSave.disabled) return;
        el.projectInstructionsSave.disabled = true;
        try {
            const value = el.projectInstructions.value.trim();
            const result = await postForm("ND_projectUpdate.do", { projectId: id, instructions: value });
            if (id !== state.projectId) return;
            proj.current = Object.assign({}, proj.current, result || {}, { system_instructions: result?.system_instructions ?? (value || null) });
            el.projectInstructions.value = proj.current.system_instructions || "";
            updateInstructionsState(value ? "저장했습니다 · 다음 질문부터 적용" : "지침을 지웠습니다");
        } catch (error) {
            toast(error.message || "지침을 저장하지 못했습니다.");
            updateInstructionsState(null);
        }
    }

    // ── 모달 (만들기 · 수정 / 확인 / 프로젝트로 이동)
    function openProjectModal(modal, focusTarget) {
        proj.lastFocus = document.activeElement;
        if (modal.matches("[data-modal]")) window.AIOneModal.open(modal, proj.lastFocus);
        else modal.hidden = false;
        window.setTimeout(() => focusTarget?.focus(), 0);
    }

    function closeProjectModal(modal) {
        if (!modal || modal.hidden) return;
        if (modal.matches("[data-modal]")) {
            window.AIOneModal.close(modal);
            return;
        }
        modal.hidden = true;
        if (proj.lastFocus && document.body.contains(proj.lastFocus)) proj.lastFocus.focus();
    }

    /**
     * 프로젝트 만들기 · 프로젝트 설정 모달 (이름 · 설명 · 맞춤형 지침)
     * @param projectId 수정할 프로젝트 (생략하면 열려 있는 프로젝트). 왼쪽 목록 더보기에서는 열려 있지 않은 프로젝트도 고친다.
     */
    async function openProjectForm(mode, projectId) {
        let target = null;
        if (mode === "edit") {
            const id = String(projectId || state.projectId || "");
            if (!id) return;
            target = id === state.projectId && proj.current ? proj.current : findProject(id);
            try {
                // 최신 값(특히 맞춤형 지침)으로 채운다
                target = Object.assign({}, target, await fetchJson(`ND_project.do?projectId=${encodeURIComponent(id)}`));
            } catch (error) {
                if (!target) {
                    toast(error.message || "프로젝트를 찾을 수 없습니다.");
                    return;
                }
            }
            target.id = id;
        }
        proj.form = { mode, project: target };
        el.projectFormTitle.textContent = mode === "edit" ? "프로젝트 설정" : "새 프로젝트";
        el.projectFormConfirm.textContent = mode === "edit" ? "저장" : "만들기";
        const msg = document.getElementById("projectFormMsg");
        if (msg) msg.textContent = mode === "edit" ? "바꾼 이름 · 설명 · 맞춤형 지침은 다음 질문부터 적용됩니다. 지침을 비우고 저장하면 지침이 지워집니다." : "관련 대화 · 파일 · 맞춤형 지침을 한곳에 모아 이어서 작업할 수 있습니다.";
        el.projectFormName.value = target ? target.name || "" : "";
        el.projectFormDesc.value = target ? target.description || "" : "";
        if (el.projectFormInstructions) el.projectFormInstructions.value = target ? target.system_instructions || "" : "";
        el.projectFormError.hidden = true;
        el.projectFormConfirm.disabled = false;
        openProjectModal(el.projectFormModal, el.projectFormName);
    }

    async function submitProjectForm() {
        if (!proj.form || el.projectFormConfirm.disabled) return;
        const name = el.projectFormName.value.trim();
        const description = el.projectFormDesc.value.trim();
        if (!name) {
            el.projectFormError.hidden = false;
            el.projectFormName.focus();
            return;
        }
        el.projectFormConfirm.disabled = true;
        try {
            if (proj.form.mode === "edit") {
                const id = String(proj.form.project.id);
                const params = { projectId: id, name, description };
                if (el.projectFormInstructions) params.instructions = el.projectFormInstructions.value.trim(); // 빈 값이면 지침을 지운다
                const result = await postForm("ND_projectUpdate.do", params);
                const updated = {
                    name: result?.name || name,
                    description: result ? (result.description ?? null) : description,
                    system_instructions: result && "system_instructions" in result ? result.system_instructions : (params.instructions ?? proj.form.project.system_instructions),
                };
                const cached = findProject(id);
                if (cached) Object.assign(cached, updated);
                closeProjectModal(el.projectFormModal);
                renderProjects();
                if (id === state.projectId) {
                    // 열려 있는 프로젝트면 화면도 바로 바꾼다
                    proj.current = Object.assign({}, proj.current, result || {}, updated);
                    if (el.projectInstructions) el.projectInstructions.dataset.dirty = "";
                    renderProjectChrome();
                    renderProjectView(false);
                }
                showActionToast("프로젝트 설정을 저장했습니다.");
            } else {
                const instructions = el.projectFormInstructions?.value.trim() || null;
                const created = await postForm("ND_projectCreate.do", { name, description, instructions });
                const id = String(created?.id ?? "").trim();
                if (!id) throw new Error("프로젝트를 만들지 못했습니다.");
                proj.items.unshift(created);
                proj.loaded = true;
                renderProjects();
                closeProjectModal(el.projectFormModal);
                showActionToast("프로젝트를 만들었습니다.");
                if (proj.moveTarget) {
                    // "프로젝트로 이동" 에서 새로 만든 경우: 바로 옮긴다
                    await moveConversation(proj.moveTarget, id);
                } else {
                    await openProject(id);
                }
                loadProjects();
            }
        } catch (error) {
            toast(error.message || "저장하지 못했습니다.");
        } finally {
            el.projectFormConfirm.disabled = false;
        }
    }

    // Start: 261016 추가 - 프로젝트 이름 바꾸기 (ND_projectUpdate.do 에 name 만 보내 설명 · 지침은 그대로)
    function openProjectRename(projectId) {
        const id = String(projectId || state.projectId || "");
        if (!id || !el.projectRenameModal) return;
        const target = id === state.projectId && proj.current ? proj.current : findProject(id);
        proj.rename = { id, name: target?.name || "" };
        el.projectRenameInput.value = proj.rename.name;
        el.projectRenameError.hidden = true;
        el.projectRenameConfirm.disabled = false;
        openProjectModal(el.projectRenameModal, el.projectRenameInput);
        window.setTimeout(() => el.projectRenameInput.select(), 0);
    }

    async function submitProjectRename() {
        const target = proj.rename;
        if (!target || el.projectRenameConfirm.disabled) return;
        const name = el.projectRenameInput.value.trim();
        if (!name) {
            el.projectRenameError.hidden = false;
            el.projectRenameInput.focus();
            return;
        }
        if (name === target.name) {
            closeProjectModal(el.projectRenameModal);
            return;
        }
        el.projectRenameConfirm.disabled = true;
        try {
            // [API 연동] POST ND_projectUpdate.do: 프로젝트 이름만 수정 (name)
            const result = await postForm("ND_projectUpdate.do", { projectId: target.id, name });
            const finalName = result?.name || name;
            const cached = findProject(target.id);
            if (cached) cached.name = finalName;
            if (target.id === state.projectId && proj.current) {
                proj.current = Object.assign({}, proj.current, { name: finalName });
                renderProjectChrome();
                renderProjectView(false);
            }
            renderProjects();
            closeProjectModal(el.projectRenameModal);
            proj.rename = null;
            showActionToast("프로젝트 이름을 변경했습니다.");
        } catch (error) {
            toast(error.message || "이름을 변경하지 못했습니다.");
        } finally {
            el.projectRenameConfirm.disabled = false;
        }
    }
    // End: 261016 추가 - 프로젝트 이름 바꾸기 (ND_projectUpdate.do 에 name 만 보내 설명 · 지침은 그대로)

    /** 확인 모달 하나를 프로젝트 삭제 · 파일 삭제 · 대화 빼기에 같이 쓴다 */
    function confirmProject({ title, message, confirmText, danger, action }) {
        const icon = el.projectConfirmModal.querySelector("[data-modal-icon]");
        icon.className = danger ? "modal-icon danger" : "modal-icon confirm";
        icon.textContent = danger ? "⚠" : "?";
        el.projectConfirmTitle.textContent = title;
        el.projectConfirmMsg.innerHTML = message;
        el.projectConfirmOk.textContent = confirmText;
        el.projectConfirmOk.className = danger ? "btn-confirm danger" : "btn-confirm";
        el.projectConfirmOk.disabled = false;
        proj.confirmAction = action;
        openProjectModal(el.projectConfirmModal, el.projectConfirmOk);
    }

    async function runConfirm() {
        if (!proj.confirmAction || el.projectConfirmOk.disabled) return;
        el.projectConfirmOk.disabled = true;
        try {
            await proj.confirmAction();
            proj.confirmAction = null;
            closeProjectModal(el.projectConfirmModal);
        } catch (error) {
            toast(error.message || "처리하지 못했습니다.");
        } finally {
            el.projectConfirmOk.disabled = false;
        }
    }

    /** @param projectId 지울 프로젝트 (생략하면 열려 있는 프로젝트) */
    function askDeleteProject(projectId) {
        const id0 = String(projectId || state.projectId || "");
        const p = id0 && id0 === state.projectId && proj.current ? proj.current : findProject(id0);
        if (!p) return;
        confirmProject({
            title: "프로젝트 삭제",
            message: `<strong>${escapeHtml(projectName(p))}</strong> 프로젝트를 삭제하시겠습니까?<br />` + "프로젝트의 파일과 맞춤형 지침은 지워지고 되돌릴 수 없습니다.<br />프로젝트의 대화는 지워지지 않고 일반 채팅 목록으로 옮겨집니다.",
            confirmText: "삭제",
            danger: true,
            action: async () => {
                const id = String(p.id);
                await postForm("ND_projectDelete.do", { projectId: id, permanent: "true" });
                proj.items = proj.items.filter((item) => String(item.id) !== id);
                delete projectChats[id];
                collapsedProjects.delete(id);
                saveExpanded();
                if (state.projectId === id) newConversation();
                renderProjects();
                showActionToast("프로젝트를 삭제했습니다.");
                loadProjects();
                loadHistory(); // 옮겨진 대화가 일반 목록에 나온다
            },
        });
    }

    function askRemoveConversation(conversationId, title) {
        const id = state.projectId;
        confirmProject({
            title: "프로젝트에서 빼기",
            message: `<strong>${escapeHtml(title || "선택한")}</strong> 대화를 프로젝트에서 빼시겠습니까?<br />대화는 지워지지 않고 일반 채팅 목록으로 옮겨지며, 이후 프로젝트 지침 · 파일은 적용되지 않습니다.`,
            confirmText: "빼기",
            danger: false,
            action: async () => {
                await postForm("ND_projectRemoveConversation.do", { projectId: id, conversationId });
                if (id !== state.projectId) return;
                proj.conversations = (proj.conversations || []).filter((c) => String(c.id) !== conversationId);
                if (Array.isArray(projectChats[id])) projectChats[id] = projectChats[id].filter((c) => String(c.id) !== conversationId);
                renderProjects();
                renderProjectConversations(false);
                showActionToast("대화를 일반 채팅 목록으로 옮겼습니다.");
                loadHistory();
                loadProjects();
            },
        });
    }

    function askDeleteSource(sourceId, name) {
        const id = state.projectId;
        confirmProject({
            title: "파일 삭제",
            message: `<strong>${escapeHtml(name || "선택한")}</strong> 파일을 프로젝트에서 삭제하시겠습니까?<br />삭제한 파일은 되돌릴 수 없고, 이후 답변에 참고하지 않습니다.`,
            confirmText: "삭제",
            danger: true,
            action: async () => {
                await postForm("ND_projectDeleteSource.do", { projectId: id, sourceId });
                if (id !== state.projectId) return;
                proj.sources = (proj.sources || []).filter((s) => String(s.id) !== sourceId);
                renderProjectSources(false);
                showActionToast("파일을 삭제했습니다.");
            },
        });
    }

    // ── 채팅 목록 더보기 → 프로젝트로 이동
    function openMoveModal(target) {
        proj.moveTarget = target;
        el.moveTitle.textContent = target.title || "선택한 대화";
        const items = proj.items;
        el.moveList.innerHTML = items.length
            ? items
                  .map(
                      (p, i) => `<label class="project-move-option">
          <input type="radio" name="chatMoveProject" value="${escapeHtml(p.id)}"${i === 0 ? " checked" : ""} />
          ${FOLDER_ICON}<span>${escapeHtml(projectName(p))}</span>
        </label>`,
                  )
                  .join("")
            : '<p class="project-empty">아직 프로젝트가 없습니다. 새 프로젝트를 만들어 옮겨 보세요.</p>';
        el.moveConfirm.disabled = !items.length;
        openProjectModal(el.moveModal, el.moveList.querySelector("input") || el.moveCreate);
    }

    async function moveConversation(target, projectId) {
        await postForm("ND_moveConversation.do", { conversationId: target.id, projectId });
        proj.moveTarget = null;
        historyItems = historyItems.filter((item) => String(item.id ?? item.conversation_id ?? "") !== target.id);
        renderHistory();
        const p = findProject(projectId);
        expandedProjects.add(String(projectId));
        saveExpanded();
        loadProjectChats(projectId, true);
        showActionToast(`"${projectName(p)}" 프로젝트로 옮겼습니다.`);
        if (target.id === state.conversationId) {
            // 보고 있던 대화: 이제 그 프로젝트 대화로 이어 간다
            state.projectId = String(projectId);
            proj.current = p || { id: state.projectId, name: "" };
            setQuery({ projectId: state.projectId });
            renderProjectChrome();
        }
        loadHistory();
        loadProjects();
    }

    async function submitMove() {
        const target = proj.moveTarget;
        const picked = el.moveList.querySelector("input:checked");
        if (!target || !picked || el.moveConfirm.disabled) return;
        el.moveConfirm.disabled = true;
        try {
            await moveConversation(target, picked.value);
            closeProjectModal(el.moveModal);
        } catch (error) {
            toast(error.message || "대화를 옮기지 못했습니다.");
        } finally {
            el.moveConfirm.disabled = false;
        }
    }

    // ── 왼쪽 프로젝트 목록 더보기(⋮) 메뉴 : 프로젝트 설정 · 프로젝트 이름 바꾸기 · 프로젝트 삭제
    function openProjectMenu(button) {
        const li = button.closest("[data-project-item]");
        if (!li || !el.projectMenu) return;
        closeMoreMenu(false);
        closeProjectMenu(false);
        closeProjectChatMenu(false);
        proj.menu = { id: li.dataset.projectItem, li, button };
        const menu = el.projectMenu;
        menu.hidden = false;
        button.setAttribute("aria-expanded", "true");
        li.classList.add("is-more-open");
        const r = button.getBoundingClientRect();
        menu.style.left = "0px";
        menu.style.top = "0px";
        let top = r.bottom + 4;
        if (top + menu.offsetHeight > window.innerHeight - 8) top = Math.max(8, r.top - menu.offsetHeight - 4);
        menu.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - menu.offsetWidth - 8))}px`;
        menu.style.top = `${top}px`;
        menu.querySelector('[role="menuitem"]')?.focus();
    }

    function closeProjectMenu(restoreFocus) {
        if (!el.projectMenu || el.projectMenu.hidden) return;
        el.projectMenu.hidden = true;
        const cur = proj.menu;
        if (cur?.button) {
            cur.button.setAttribute("aria-expanded", "false");
            cur.li?.classList.remove("is-more-open");
            if (restoreFocus && document.body.contains(cur.button)) cur.button.focus();
        }
    }

    // ── 왼쪽 프로젝트 아래 대화 더보기(⋮) 메뉴 : 고정하기(고정 해제) · 삭제
    /*
     * 고정 = 대화 즐겨찾기 (명세 No.19 등록 · No.20 해제, 프로젝트 대화도 일반 대화와 같음)
     *   고정한 대화는 프로젝트 안에서 맨 위에 📌 표시와 함께 보인다 (서버 ND_projectConversations 가 is_favorite 를 채워 정렬).
     * 삭제 = 대화 삭제 (No.15). 프로젝트에서 빼는 것이 아니라 대화 자체를 지운다 (되돌릴 수 없음).
     */
    const chatOf = (pid, cid) => (Array.isArray(projectChats[pid]) ? projectChats[pid] : []).find((c) => String(c.id) === String(cid)) || null;

    /** 고정한 대화를 위로 (같은 고정 상태끼리는 최근 수정 순) */
    function sortPinned(list) {
        const time = (c) => Date.parse(c.updated_at || c.created_at || "") || 0;
        return list.slice().sort((a, b) => !!b.is_favorite - !!a.is_favorite || time(b) - time(a));
    }

    function openProjectChatMenu(button) {
        const li = button.closest("[data-project-chat-item]");
        const menu = el.projectChatMenu;
        if (!li || !menu) return;
        closeMoreMenu(false);
        closeProjectMenu(false);
        closeProjectChatMenu(false);
        const pid = button.dataset.projectId;
        const cid = li.dataset.projectChatItem;
        const chat = chatOf(pid, cid);
        proj.chatMenu = { pid, cid, title: chat ? historyTitle(chat) : "", li, button };
        const pinItem = menu.querySelector('[data-project-chat-action="pin"] span');
        if (pinItem) pinItem.textContent = chat?.is_favorite ? "고정 해제" : "목록 고정";
        menu.hidden = false;
        button.setAttribute("aria-expanded", "true");
        li.classList.add("is-more-open");
        const r = button.getBoundingClientRect();
        menu.style.left = "0px";
        menu.style.top = "0px";
        let top = r.bottom + 4;
        if (top + menu.offsetHeight > window.innerHeight - 8) top = Math.max(8, r.top - menu.offsetHeight - 4);
        menu.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - menu.offsetWidth - 8))}px`;
        menu.style.top = `${top}px`;
        menu.querySelector('[role="menuitem"]')?.focus();
    }

    function closeProjectChatMenu(restoreFocus) {
        if (!el.projectChatMenu || el.projectChatMenu.hidden) return;
        el.projectChatMenu.hidden = true;
        const cur = proj.chatMenu;
        if (cur?.button) {
            cur.button.setAttribute("aria-expanded", "false");
            cur.li?.classList.remove("is-more-open");
            if (restoreFocus && document.body.contains(cur.button)) cur.button.focus();
        }
    }

    async function togglePinProjectChat(target) {
        const chat = chatOf(target.pid, target.cid);
        const next = !chat?.is_favorite;
        try {
            await postForm("ND_conversationFavorite.do", { conversationId: target.cid, favorite: String(next) });
            if (chat) chat.is_favorite = next;
            if (Array.isArray(projectChats[target.pid])) projectChats[target.pid] = sortPinned(projectChats[target.pid]);
            if (target.pid === state.projectId && Array.isArray(proj.conversations)) {
                const inView = proj.conversations.find((c) => String(c.id) === target.cid);
                if (inView) inView.is_favorite = next;
                proj.conversations = sortPinned(proj.conversations);
                if (!state.conversationId) renderProjectConversations(false);
            }
            renderProjects();
            const inHistory = historyItemById(target.cid); // 왼쪽 채팅 목록에도 있으면 함께 맞춘다
            if (inHistory) {
                inHistory.is_favorite = next;
                historyItems = sortPinned(historyItems);
                renderHistory();
            }
            showActionToast(next ? "대화를 고정했습니다." : "대화 고정을 해제했습니다.");
        } catch (error) {
            toast(error.message || "고정 상태를 바꾸지 못했습니다.");
        }
    }

    /**
     * 이름 바꾸기 — 채팅 목록의 이름 바꾸기 모달(#chatRenameModal · ND_updateChatTitle)을 그대로 쓴다.
     * 저장되면 submitRename 이 보내는 aione:chat-renamed 이벤트를 받아 프로젝트 아래 목록 · 프로젝트 화면 목록을 바로 고친다.
     */
    function renameProjectChat(target) {
        if (!more.ready || !el.renameModal) {
            toast("이름 바꾸기를 사용할 수 없는 화면입니다.");
            return;
        }
        more.current = { id: target.cid, title: target.title, li: null, button: target.button };
        openRename();
    }

    function applyProjectChatTitle(conversationId, title) {
        const id = String(conversationId || "");
        let changed = false;
        Object.keys(projectChats).forEach((pid) => {
            (Array.isArray(projectChats[pid]) ? projectChats[pid] : []).forEach((c) => {
                if (String(c.id) === id) {
                    c.display_title = title;
                    changed = true;
                }
            });
        });
        (Array.isArray(proj.conversations) ? proj.conversations : []).forEach((c) => {
            if (String(c.id) === id) {
                c.display_title = title;
                changed = true;
            }
        });
        if (!changed) return;
        renderProjects();
        if (state.projectId && !state.conversationId) renderProjectConversations(false);
    }

    /**
     * 프로젝트에서 제거 (명세 No.8) — 대화는 지우지 않고 일반 채팅 목록으로 옮긴다.
     * 이후 그 대화에는 프로젝트 지침 · 파일이 적용되지 않는다. 보고 있던 대화면 일반 채팅으로 이어 간다.
     */
    function askRemoveProjectChat(target) {
        const p = findProject(target.pid);
        confirmProject({
            title: "프로젝트에서 제거",
            message:
                `<strong>${escapeHtml(target.title || "선택한")}</strong> 대화를 <strong>${escapeHtml(projectName(p))}</strong> 프로젝트에서 제거하시겠습니까?<br />` +
                "대화는 지워지지 않고 일반 채팅 목록으로 옮겨지며, 이후 프로젝트 지침 · 파일은 적용되지 않습니다.",
            confirmText: "제거",
            danger: false,
            action: async () => {
                await postForm("ND_projectRemoveConversation.do", { projectId: target.pid, conversationId: target.cid });
                if (Array.isArray(projectChats[target.pid])) projectChats[target.pid] = projectChats[target.pid].filter((c) => String(c.id) !== target.cid);
                if (target.pid === state.projectId && Array.isArray(proj.conversations)) {
                    proj.conversations = proj.conversations.filter((c) => String(c.id) !== target.cid);
                    if (!state.conversationId) renderProjectConversations(false);
                }
                if (p && p.conversation_count) p.conversation_count--;
                if (target.cid === state.conversationId && state.projectId) {
                    // 보고 있던 대화: 일반 채팅으로 이어 간다
                    state.projectId = null;
                    proj.current = null;
                    setQuery({ projectId: null });
                    renderProjectChrome();
                }
                renderProjects();
                showActionToast("대화를 일반 채팅 목록으로 옮겼습니다.");
                loadHistory();
                loadProjects();
            },
        });
    }

    function askDeleteProjectChat(target) {
        confirmProject({
            title: "대화 삭제",
            message: "해당 대화를 삭제하시겠습니까?",
            confirmText: "삭제",
            danger: true,
            action: async () => {
                await postForm("ND_deleteChat.do", { conversationId: target.cid });
                if (Array.isArray(projectChats[target.pid])) projectChats[target.pid] = projectChats[target.pid].filter((c) => String(c.id) !== target.cid);
                if (Array.isArray(proj.conversations)) proj.conversations = proj.conversations.filter((c) => String(c.id) !== target.cid);
                const cached = findProject(target.pid);
                if (cached && cached.conversation_count) cached.conversation_count--;
                renderProjects();
                showActionToast("대화를 삭제했습니다.");
                // 보고 있던 대화를 지웠으면 그 프로젝트 화면으로, 프로젝트 화면을 보고 있었으면 목록만 고친다
                if (target.cid === state.conversationId) openProject(target.pid);
                else if (target.pid === state.projectId && !state.conversationId) renderProjectConversations(false);
                document.dispatchEvent(new CustomEvent("aione:chat-deleted", { detail: { conversationId: target.cid } }));
                loadProjects();
            },
        });
    }

    function initProjects() {
        Object.assign(el, {
            projectList: document.getElementById("projectList"),
            projectMenu: document.getElementById("projectActionMenu"),
            projectChatMenu: document.getElementById("projectChatActionMenu"),
            projectFormInstructions: document.getElementById("projectFormInstructions"),
            projectNewBtn: document.getElementById("projectNewBtn"),
            projectView: document.getElementById("projectView"),
            projectName: document.getElementById("projectViewName"),
            projectDesc: document.getElementById("projectViewDesc"),
            projectChatList: document.getElementById("projectChatList"),
            projectChatCount: document.getElementById("projectChatCount"),
            projectInstructions: document.getElementById("projectInstructions"),
            projectInstructionsSave: document.getElementById("projectInstructionsSave"),
            projectInstructionsState: document.getElementById("projectInstructionsState"),
            projectInstructionsCount: document.getElementById("projectInstructionsCount"),
            projectFileList: document.getElementById("projectFileList"),
            projectFileAdd: document.getElementById("projectFileAddBtn"),
            projectFileInput: document.getElementById("projectFileInput"),
            projectFileHint: document.getElementById("projectFileHint"),
            projectCrumb: document.getElementById("chatProjectCrumb"),
            projectCrumbName: document.getElementById("chatProjectCrumbName"),
            projectFormModal: document.getElementById("projectFormModal"),
            projectRenameModal: document.getElementById("projectRenameModal"),
            projectRenameInput: document.getElementById("projectRenameInput"),
            projectRenameError: document.getElementById("projectRenameError"),
            projectRenameConfirm: document.getElementById("projectRenameConfirm"),
            projectFormTitle: document.getElementById("projectFormModalTitle"),
            projectFormName: document.getElementById("projectFormName"),
            projectFormDesc: document.getElementById("projectFormDesc"),
            projectFormError: document.getElementById("projectFormError"),
            projectFormConfirm: document.getElementById("projectFormConfirm"),
            projectConfirmModal: document.getElementById("projectConfirmModal"),
            projectConfirmTitle: document.getElementById("projectConfirmModalTitle"),
            projectConfirmMsg: document.getElementById("projectConfirmMsg"),
            projectConfirmOk: document.getElementById("projectConfirmOk"),
            moveModal: document.getElementById("chatMoveModal"),
            moveTitle: document.getElementById("chatMoveTitle"),
            moveList: document.getElementById("chatMoveList"),
            moveConfirm: document.getElementById("chatMoveConfirm"),
            moveCreate: document.getElementById("chatMoveCreate"),
        });
        if (cfg.mode === "handoff" || !el.projectList || !el.projectView || !el.projectFormModal || !el.projectConfirmModal) return;
        proj.ready = true;

        const modals = [el.projectFormModal, el.projectRenameModal, el.projectConfirmModal, el.moveModal].filter(Boolean);
        [el.projectMenu, el.projectChatMenu].forEach((menu) => {
            if (menu && menu.parentNode !== document.body) document.body.appendChild(menu);
        });
        modals.forEach((modal) => {
            if (modal.parentNode !== document.body) document.body.appendChild(modal);
            modal.addEventListener("click", (event) => {
                if (event.target.closest("[data-chat-modal-close]")) {
                    closeProjectModal(modal);
                    if (modal === el.moveModal) proj.moveTarget = null;
                }
            });
        });

        // 왼쪽 목록
        el.projectNewBtn?.addEventListener("click", () => {
            proj.moveTarget = null;
            openProjectForm("create");
        });
        el.projectList.addEventListener("click", (event) => {
            const moreBtn = event.target.closest("[data-project-more]");
            if (moreBtn) {
                // 더보기(⋮): 프로젝트를 열지 않고 메뉴만 연다
                event.preventDefault();
                event.stopPropagation();
                if (!el.projectMenu.hidden && proj.menu?.button === moreBtn) closeProjectMenu(true);
                else openProjectMenu(moreBtn);
                return;
            }
            const chatMore = event.target.closest("[data-project-chat-more]");
            if (chatMore) {
                // 대화 더보기(⋮): 대화를 열지 않고 메뉴만 연다
                event.preventDefault();
                event.stopPropagation();
                if (!el.projectChatMenu.hidden && proj.chatMenu?.button === chatMore) closeProjectChatMenu(true);
                else openProjectChatMenu(chatMore);
                return;
            }
            const toggle = event.target.closest("[data-project-toggle]");
            if (toggle) {
                // 폴더 아이콘: 대화 펼치기 · 접기
                event.preventDefault();
                event.stopPropagation();
                setProjectExpanded(toggle.dataset.projectToggle, !expandedProjects.has(toggle.dataset.projectToggle));
                return;
            }
            const chat = event.target.closest("[data-project-chat-open]");
            if (chat) {
                // 프로젝트 아래 대화
                if (chat.dataset.projectChatOpen === state.conversationId) return;
                loadConversation(chat.dataset.projectChatOpen, { projectId: chat.dataset.projectId }).catch((error) => toast(error.message || "대화를 불러오지 못했습니다."));
                return;
            }
            const newChat = event.target.closest("[data-project-newchat]");
            if (newChat) {
                // 연필: 이 프로젝트에서 새 채팅 (= 프로젝트 화면)
                if (newChat.dataset.projectNewchat !== state.projectId || state.conversationId) openProject(newChat.dataset.projectNewchat);
                else el.input?.focus();
                return;
            }
            // 프로젝트 이름: 아래 대화를 숨기거나 다시 보여 준다 (프로젝트 화면은 연필 버튼으로 연다)
            const button = event.target.closest("[data-project-open]");
            if (!button) return;
            setProjectExpanded(button.dataset.projectOpen, !expandedProjects.has(button.dataset.projectOpen));
        });
        el.historySearch?.addEventListener("input", renderProjects);
        // "프로젝트 ⌄" : 프로젝트 목록 전체 접기 · 펴기 (이 브라우저에 기억)
        const sectionToggle = document.getElementById("projectSectionToggle");
        if (sectionToggle) {
            const section = sectionToggle.closest(".chatbot-projects");
            const applySection = (collapsed) => {
                section?.classList.toggle("is-collapsed", collapsed);
                sectionToggle.setAttribute("aria-expanded", String(!collapsed));
                el.projectList.hidden = collapsed;
            };
            let collapsed = false;
            try {
                collapsed = window.localStorage.getItem(PROJECT_SECTION_KEY) === "collapsed";
            } catch (e) {
                /* 무시 */
            }
            applySection(collapsed);
            sectionToggle.addEventListener("click", () => {
                collapsed = !collapsed;
                applySection(collapsed);
                try {
                    window.localStorage.setItem(PROJECT_SECTION_KEY, collapsed ? "collapsed" : "open");
                } catch (e) {
                    /* 무시 */
                }
            });
        }
        document.addEventListener("aione:chat-renamed", (event) => applyProjectChatTitle(event.detail?.conversationId, event.detail?.title));
        if (el.projectChatMenu) {
            const menu = el.projectChatMenu;
            menu.addEventListener("click", (event) => {
                const item = event.target.closest("[data-project-chat-action]");
                if (!item || !proj.chatMenu) return;
                event.stopPropagation();
                const target = proj.chatMenu;
                closeProjectChatMenu(false);
                proj.lastFocus = target.button;
                if (item.dataset.projectChatAction === "pin") togglePinProjectChat(target);
                else if (item.dataset.projectChatAction === "rename") renameProjectChat(target);
                else if (item.dataset.projectChatAction === "remove") askRemoveProjectChat(target);
                else if (item.dataset.projectChatAction === "delete") askDeleteProjectChat(target);
            });
            menu.addEventListener("keydown", (event) => {
                const items = Array.from(menu.querySelectorAll('[role="menuitem"]'));
                const index = items.indexOf(document.activeElement);
                if (event.key === "ArrowDown") {
                    event.preventDefault();
                    items[(index + 1) % items.length].focus();
                } else if (event.key === "ArrowUp") {
                    event.preventDefault();
                    items[(index - 1 + items.length) % items.length].focus();
                } else if (event.key === "Tab") closeProjectChatMenu(false);
            });
            document.addEventListener("click", (event) => {
                if (!menu.hidden && !menu.contains(event.target) && !event.target.closest("[data-project-chat-more]")) closeProjectChatMenu(false);
            });
            window.addEventListener("resize", () => closeProjectChatMenu(false));
            document.addEventListener(
                "scroll",
                (event) => {
                    if (!menu.hidden && event.target?.nodeType === 1 && event.target.contains(el.projectList)) closeProjectChatMenu(false);
                },
                true,
            );
        }
        if (el.projectMenu) {
            el.projectMenu.addEventListener("click", (event) => {
                const item = event.target.closest("[data-project-menu-action]");
                if (!item || !proj.menu) return;
                event.stopPropagation();
                const id = proj.menu.id;
                closeProjectMenu(true); // 모달을 닫으면 숨겨진 메뉴 항목 대신 더보기 버튼으로 초점을 돌린다.
                if (item.dataset.projectMenuAction === "edit") openProjectForm("edit", id);
                else if (item.dataset.projectMenuAction === "rename") openProjectRename(id);
                else if (item.dataset.projectMenuAction === "delete") askDeleteProject(id);
            });
            el.projectMenu.addEventListener("keydown", (event) => {
                const items = Array.from(el.projectMenu.querySelectorAll('[role="menuitem"]'));
                const index = items.indexOf(document.activeElement);
                if (event.key === "ArrowDown") {
                    event.preventDefault();
                    items[(index + 1) % items.length].focus();
                } else if (event.key === "ArrowUp") {
                    event.preventDefault();
                    items[(index - 1 + items.length) % items.length].focus();
                } else if (event.key === "Tab") closeProjectMenu(false);
            });
            document.addEventListener("click", (event) => {
                if (!el.projectMenu.hidden && !el.projectMenu.contains(event.target) && !event.target.closest("[data-project-more]")) closeProjectMenu(false);
            });
            window.addEventListener("resize", () => closeProjectMenu(false));
            document.addEventListener(
                "scroll",
                (event) => {
                    if (!el.projectMenu.hidden && event.target?.nodeType === 1 && event.target.contains(el.projectList)) closeProjectMenu(false);
                },
                true,
            );
        }

        // 프로젝트 화면
        el.projectView.addEventListener("click", (event) => {
            const action = event.target.closest("[data-project-action]")?.dataset.projectAction;
            if (action === "edit") {
                openProjectForm("edit");
                return;
            }
            if (action === "delete") {
                askDeleteProject();
                return;
            }
            const remove = event.target.closest("[data-project-chat-remove]");
            if (remove) {
                askRemoveConversation(remove.dataset.projectChatRemove, remove.dataset.title);
                return;
            }
            const removeSource = event.target.closest("[data-project-source-delete]");
            if (removeSource) {
                askDeleteSource(removeSource.dataset.projectSourceDelete, removeSource.dataset.title);
                return;
            }
            const chat = event.target.closest("[data-project-chat]");
            if (chat) {
                loadConversation(chat.dataset.projectChat, { projectId: state.projectId }).catch((error) => toast(error.message || "대화를 불러오지 못했습니다."));
            }
        });
        el.projectInstructions.addEventListener("input", () => updateInstructionsState(null));
        el.projectInstructions.addEventListener("keydown", (event) => {
            if (event.key === "s" && (event.ctrlKey || event.metaKey)) {
                event.preventDefault();
                saveInstructions();
            }
        });
        el.projectInstructionsSave.addEventListener("click", saveInstructions);
        el.projectFileAdd.addEventListener("click", () => el.projectFileInput.click());
        el.projectFileInput.addEventListener("change", () => {
            uploadProjectFiles(el.projectFileInput.files);
            el.projectFileInput.value = "";
        });
        el.projectCrumb?.addEventListener("click", (event) => {
            if (event.target.closest("[data-project-back]") && state.projectId) openProject(state.projectId);
        });

        // 모달
        el.projectFormConfirm.addEventListener("click", submitProjectForm);
        el.projectFormName.addEventListener("keydown", (event) => {
            if (event.key === "Enter" && !event.isComposing && event.keyCode !== 229) {
                event.preventDefault();
                submitProjectForm();
            }
        });
        el.projectFormName.addEventListener("input", () => {
            if (el.projectFormName.value.trim()) el.projectFormError.hidden = true;
        });
        el.projectConfirmOk.addEventListener("click", runConfirm);
        el.projectRenameConfirm?.addEventListener("click", submitProjectRename);
        el.projectRenameInput?.addEventListener("keydown", (event) => {
            if (event.key === "Enter" && !event.isComposing && event.keyCode !== 229) {
                event.preventDefault();
                submitProjectRename();
            }
        });
        el.projectRenameInput?.addEventListener("input", () => {
            if (el.projectRenameInput.value.trim()) el.projectRenameError.hidden = true;
        });
        el.moveConfirm?.addEventListener("click", submitMove);
        el.moveCreate?.addEventListener("click", () => {
            const target = proj.moveTarget;
            closeProjectModal(el.moveModal);
            proj.moveTarget = target; // 만들고 나서 바로 옮긴다
            openProjectForm("create");
        });
        document.addEventListener("keydown", (event) => {
            if (event.key !== "Escape") return;
            if (el.projectMenu && !el.projectMenu.hidden) {
                closeProjectMenu(true);
                return;
            }
            if (el.projectChatMenu && !el.projectChatMenu.hidden) {
                closeProjectChatMenu(true);
                return;
            }
            const open = modals.find((modal) => !modal.hidden);
            if (open) {
                closeProjectModal(open);
                if (open === el.moveModal) proj.moveTarget = null;
            }
        });

        // 프로젝트 안에서는 일반 대화만 쓴다 (국회답변서초안생성으로 바꾸면 되돌린다)
        const taskHolder = document.querySelector("[data-chat-task-current]");
        if (taskHolder) {
            new MutationObserver(() => {
                if (state.projectId && currentTask() !== "chat") {
                    selectTask("chat");
                    toast("프로젝트에서는 일반 대화만 사용할 수 있습니다.");
                }
                if (state.projectId) renderProjectChrome(); // 작업 메뉴가 바꾼 입력창 안내를 프로젝트 안내로 되돌린다
            }).observe(taskHolder, { attributes: true, attributeFilter: ["data-chat-task-current"] });
        }

        // 프로젝트 화면이 보일 때 파일을 끌어다 놓으면 프로젝트 파일로 올린다
        el.projectView.addEventListener("dragover", (event) => {
            if (!Array.from(event.dataTransfer?.types || []).includes("Files")) return;
            event.preventDefault();
            event.stopPropagation();
            el.projectView.classList.add("is-file-dragover");
        });
        el.projectView.addEventListener("dragleave", (event) => {
            if (!el.projectView.contains(event.relatedTarget)) el.projectView.classList.remove("is-file-dragover");
        });
        el.projectView.addEventListener("drop", (event) => {
            if (!event.dataTransfer?.files?.length) return;
            event.preventDefault();
            event.stopPropagation();
            el.projectView.classList.remove("is-file-dragover");
            uploadProjectFiles(event.dataTransfer.files);
        });
    }

    // End: 프로젝트 (명세 v1.0 No.2~14)

    // Start: 내부자료 검색 (지능화검색 API v1.1)
    /*
     * 작업 선택 "내부자료 검색"(search)으로 보내면 AI 대화가 아니라 지능화검색(ND_search.do → POST /file/search)으로 파일을 찾는다.
     *  - 접근권한 판정 사용자(user_id)는 서버 설정(api-config.search.userId, 기본 interweb@moef.com)으로 정해진다.
     *  - 결과는 이 화면에만 보이고 채팅 목록에는 저장되지 않는다 (지능화검색은 대화 기록이 없다).
     *  - 정렬(관련도 · 최신 수정 · 이름) 바꾸기, "더 보기"(다음 페이지)를 지원한다.
     *  - 서버가 정한 순위(rank)를 그대로 쓰고 화면에서 다시 정렬하지 않는다 (명세 No.1).
     */
    const SEARCH_SORTS = [
        { value: "", label: "관련도순" },
        { value: "modified_at", label: "최신 수정순" },
        { value: "created_at", label: "최신 등록순" },
        { value: "name", label: "이름순" },
    ];
    const SENSITIVITY_LABELS = { C: "등급 C", S: "등급 S", O: "등급 O" };
    const MATCH_LABELS = { name: "파일명 일치", content: "내용 일치", both: "파일명 · 내용 일치" };
    const searchState = { busy: false };

    const isSearchTask = () => cfg.mode !== "handoff" && !state.projectId && currentTask() === "search";

    function searchDate(iso) {
        const d = iso ? new Date(iso) : null;
        if (!d || Number.isNaN(d.getTime())) return "";
        const pad = (v) => String(v).padStart(2, "0");
        return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
    }

    function searchSize(bytes) {
        const n = Number(bytes);
        if (!Number.isFinite(n) || n < 0) return "";
        if (n < 1024) return `${n}B`;
        if (n < 1024 * 1024) return `${Math.round(n / 1024)}KB`;
        return `${(n / 1024 / 1024).toFixed(1)}MB`;
    }

    /** 파일명 · 경로에서 질의 매칭 토큰(highlights)을 <mark> 로 */
    function markHighlights(text, highlights) {
        const words = (highlights || [])
            .map((w) => String(w || "").trim())
            .filter((w) => w.length > 0)
            .slice(0, 20);
        if (!words.length) return escapeHtml(text);
        const pattern = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
        return String(text)
            .split(pattern)
            .map((part, i) => (i % 2 ? `<mark>${escapeHtml(part)}</mark>` : escapeHtml(part)))
            .join("");
    }

    function searchItemHtml(item) {
        const name = String(item.name || "이름 없는 파일");
        const ext = (name.match(/\.([A-Za-z0-9]{1,6})$/) || [])[1] || "file";
        const meta = [item.author ? escapeHtml(item.author) : "", item.modified_at ? `수정 ${escapeHtml(searchDate(item.modified_at))}` : "", searchSize(item.size)].filter(Boolean).join(" · ");
        const level = item.sensitivity_level
            ? `<span class="chat-search-level is-${escapeHtml(String(item.sensitivity_level).toLowerCase())}" title="정보등급 ${escapeHtml(item.sensitivity_level)}">${escapeHtml(SENSITIVITY_LABELS[item.sensitivity_level] || item.sensitivity_level)}</span>`
            : "";
        const match = MATCH_LABELS[item.match_type] ? `<span class="chat-search-match">${MATCH_LABELS[item.match_type]}</span>` : "";
        return `<li class="chat-search-item" data-file-id="${escapeHtml(item.file_id || "")}">
      <span class="chat-search-ext ext-${escapeHtml(ext.toLowerCase())}" aria-hidden="true">${escapeHtml(ext.toUpperCase())}</span>
      <div class="chat-search-body">
        <div class="chat-search-name" title="${escapeHtml(name)}">${markHighlights(name, item.highlights)}</div>
        ${item.path ? `<div class="chat-search-path" title="${escapeHtml(item.path)}">${markHighlights(item.path, item.highlights)}</div>` : ""}
        <div class="chat-search-meta">${meta}${match}${level}</div>
        ${
            item.highlights?.length
                ? `<div class="chat-search-tags">${item.highlights
                      .slice(0, 6)
                      .map((h) => `<span>${escapeHtml(h)}</span>`)
                      .join("")}</div>`
                : ""
        }
      </div>
    </li>`;
    }

    /** 검색 결과 말풍선 하나 (질의 · 정렬 · 페이지를 품고 있다) */
    function createSearchMessage(query) {
        const node = document.createElement("div");
        node.className = "chat-msg chat-msg-assistant chat-search-msg";
        node.innerHTML = getChatTemplateHtml("chatSearchMessageTemplate");
        node.querySelector("[data-search-sort]").replaceChildren(...SEARCH_SORTS.map(({ value, label }) => new Option(label, value)));
        el.messages.appendChild(node);
        const ctx = { node, query, page: 0, sort: "", shown: 0, total: 0, seq: 0 };
        node.querySelector("[data-search-sort]").addEventListener("change", (event) => {
            ctx.sort = event.target.value;
            loadSearchPage(ctx, 1);
        });
        node.querySelector("[data-search-more]").addEventListener("click", () => loadSearchPage(ctx, ctx.page + 1));
        return ctx;
    }

    async function loadSearchPage(ctx, page) {
        const seq = ++ctx.seq;
        const list = ctx.node.querySelector("[data-search-list]");
        const count = ctx.node.querySelector("[data-search-count]");
        const notice = ctx.node.querySelector("[data-search-notice]");
        const more = ctx.node.querySelector("[data-search-more]");
        const sortSelect = ctx.node.querySelector("[data-search-sort]");
        if (page === 1) {
            list.innerHTML = '<li class="chat-search-loading"><span class="chat-stage-dot" aria-hidden="true"></span>내부자료를 찾고 있습니다</li>';
            notice.hidden = true;
            count.textContent = "검색 중…";
        }
        more.disabled = true;
        sortSelect.disabled = true;
        searchState.busy = true;
        try {
            const data = await postForm("ND_search.do", { query: ctx.query, page: String(page), sort: ctx.sort || null });
            if (seq !== ctx.seq) return;
            const items = Array.isArray(data?.items) ? data.items : [];
            ctx.total = Number(data?.total) || 0;
            ctx.page = page;
            if (page === 1) {
                list.innerHTML = "";
                ctx.shown = 0;
            }
            list.insertAdjacentHTML("beforeend", items.map(searchItemHtml).join(""));
            ctx.shown += items.length;
            count.textContent = ctx.total ? `${ctx.total.toLocaleString()}건` : "0건";
            if (!ctx.shown) {
                notice.textContent = data?.notice || "검색 결과가 없습니다. 다른 검색어로 찾아보세요.";
                notice.hidden = false;
            }
            more.hidden = !(ctx.shown < ctx.total && items.length > 0);
        } catch (error) {
            if (seq !== ctx.seq) return;
            if (page === 1) list.innerHTML = "";
            count.textContent = "";
            notice.textContent = errorText(error.message || "검색하지 못했습니다.");
            notice.hidden = false;
        } finally {
            if (seq === ctx.seq) {
                more.disabled = false;
                sortSelect.disabled = false;
                searchState.busy = false;
            }
            if (page === 1) scrollToBottom(true);
        }
    }

    function runSearch(text) {
        if (searchState.busy) {
            toast("검색 중입니다. 잠시 후 다시 시도해 주세요.");
            return;
        }
        // 열려 있던 대화와 섞이지 않게 새 화면에서 검색한다 (작업 선택은 그대로 "내부자료 검색")
        if (state.conversationId || state.projectId) newConversation();
        setChatting(true);
        addUserMessage(text, []);
        if (el.input) {
            el.input.value = "";
            el.input.dispatchEvent(new Event("input"));
        }
        if (state.files.length) {
            toast("내부자료 검색에는 첨부 파일이 쓰이지 않습니다.");
            state.files = [];
            renderAttachments();
        }
        loadSearchPage(createSearchMessage(text), 1);
    }

    // End: 내부자료 검색 (지능화검색 API v1.1)

    // Start: 응답 완료 알림 표시 (파란 점)
    /*
     * 환경설정 > 알림 > "응답 완료 알림"(공통 레이아웃의 .notification-toggle, aria-checked)이 켜져 있을 때만 동작한다.
     * 답변이 끝났을 때 아래 경우면 그 대화를 "안 읽음"으로 표시해 왼쪽 목록(채팅 · 프로젝트 아래 대화)에 파란 점을 띄운다.
     *   - 새로 만든 대화의 첫 답변
     *   - 답변이 끝날 때 브라우저 탭이 가려져 있던 경우
     *   - 답변을 기다리는 동안 다른 대화로 옮겨 가 있던 경우
     * 목록에서 그 대화를 누르거나(다시 열기), 그 대화에서 이어서 질문을 보내면 점이 사라진다.
     *   (답변을 읽느라 대화 영역을 누르거나 스크롤해도 사라지지 않는다)
     * 안 읽음 목록은 이 브라우저(localStorage)에 기억해 새로고침 · 다른 화면에 다녀와도 남는다.
     * 점은 챗봇 화면 왼쪽 대화 목록의 그 대화 항목에만 띄운다 (공통 메뉴 "AI-ONE 챗봇"의 .nav-complete-dot 은 건드리지 않는다).
     */
    const UNREAD_KEY = "aiOneChatUnread";
    const unread = new Set(
        (() => {
            try {
                return JSON.parse(window.localStorage.getItem(UNREAD_KEY) || "[]").map(String);
            } catch (e) {
                return [];
            }
        })(),
    );

    function saveUnread() {
        try {
            window.localStorage.setItem(UNREAD_KEY, JSON.stringify(Array.from(unread).slice(-200)));
        } catch (e) {
            /* 무시 */
        }
    }

    /*
     * 응답 완료 알림이 켜져 있는지 — 아래 순서로 판단한다 (cfg.notifyEnabled 함수가 있으면 그것을 쓴다)
     *   1) 공통 스크립트(common.js)가 저장해 둔 값 : localStorage 에서 이름에 notif 가 들어간 키
     *      (환경설정 모달을 열기 전에는 스위치의 aria-checked 가 아직 채워지지 않은 경우가 있어 저장값을 먼저 본다)
     *   2) 환경설정 스위치(.notification-toggle) 의 켜짐 표시 : aria-checked · aria-pressed · is-on/on/active/checked 클래스
     *   3) 둘 다 없으면(공통 레이아웃 없이 열린 화면) 켜진 것으로 본다
     */
    const ON_VALUES = new Set(["true", "on", "y", "yes", "1", "enabled", "enable", "granted"]);
    const OFF_VALUES = new Set(["false", "off", "n", "no", "0", "disabled", "disable", "denied"]);

    function storedNotifySetting() {
        try {
            const store = window.localStorage;
            for (let i = 0; i < store.length; i++) {
                const key = store.key(i);
                if (!key || !/notif/i.test(key) || key === UNREAD_KEY) continue;
                const raw = String(store.getItem(key) ?? "").trim();
                let value = raw.toLowerCase();
                try {
                    // {"enabled":true} 같은 JSON 도 받는다
                    const parsed = JSON.parse(raw);
                    if (typeof parsed === "boolean") value = String(parsed);
                    else if (parsed && typeof parsed === "object") {
                        const v = parsed.enabled ?? parsed.on ?? parsed.value ?? parsed.responseComplete;
                        if (v != null) value = String(v).toLowerCase();
                    }
                } catch (e) {
                    /* 문자열 그대로 */
                }
                if (ON_VALUES.has(value)) return { on: true, from: `localStorage.${key}=${raw}` };
                if (OFF_VALUES.has(value)) return { on: false, from: `localStorage.${key}=${raw}` };
            }
        } catch (e) {
            /* 저장소를 못 쓰면 스위치로 판단 */
        }
        return null;
    }

    function notifySetting() {
        if (typeof cfg.notifyEnabled === "function") return { on: !!cfg.notifyEnabled(), from: "cfg.notifyEnabled" };
        const stored = storedNotifySetting();
        if (stored) return stored;
        const toggle = document.querySelector(".notification-toggle");
        if (toggle) {
            const on = toggle.getAttribute("aria-checked") === "true" || toggle.getAttribute("aria-pressed") === "true" || /\b(is-on|on|active|checked|is-active|is-checked)\b/.test(toggle.className);
            return { on, from: `.notification-toggle aria-checked=${toggle.getAttribute("aria-checked")} class="${toggle.className}"` };
        }
        return { on: true, from: "설정 화면 없음(기본 켜짐)" };
    }

    const notifyEnabled = () => notifySetting().on;

    function refreshUnreadDots() {
        markAnswering();
        const on = notifyEnabled();
        document.querySelectorAll("[data-conversation-id], [data-project-chat-open]").forEach((button) => {
            const id = button.dataset.conversationId || button.dataset.projectChatOpen;
            const li = button.closest("li");
            if (!li) return;
            const show = on && unread.has(id);
            li.classList.toggle("has-unread", show);
            if (show) button.setAttribute("data-unread", "Y");
            else button.removeAttribute("data-unread");
        });
    }

    function markUnread(conversationId) {
        const id = String(conversationId || "");
        if (!id || unread.has(id)) return;
        unread.add(id);
        saveUnread();
        log("응답 완료 알림 표시", id);
        refreshUnreadDots();
    }

    function clearUnread(conversationId) {
        const id = String(conversationId || "");
        if (!id || !unread.delete(id)) return;
        saveUnread();
        refreshUnreadDots();
    }

    /** 답변이 끝났을 때 알림 표시 여부를 정한다 */
    function noteAnswerDone(conversationId, { isNew, away }) {
        const setting = notifySetting();
        log("응답 완료 알림 판단", { conversationId, isNew, away, hidden: document.hidden, enabled: setting.on, 근거: setting.from });
        if (!conversationId || !setting.on) return;
        if (isNew || away || document.hidden) markUnread(conversationId);
    }

    function initUnread() {
        // 알림 스위치를 바꾸면 바로 반영 (공통 스크립트가 값을 바꾼 뒤에 읽는다)
        document.addEventListener("click", (event) => {
            if (event.target.closest?.(".notification-toggle")) window.setTimeout(refreshUnreadDots, 0);
        });
        // 지운 대화는 안 읽음에서 뺀다
        document.addEventListener("aione:chat-deleted", (event) => clearUnread(event.detail?.conversationId));
        // 목록에서 그 대화를 누르면(지금 보고 있는 대화여도) 읽은 것으로 본다
        document.addEventListener(
            "click",
            (event) => {
                const button = event.target.closest?.("[data-conversation-id], [data-project-chat-open]");
                if (button && !event.target.closest(".btn-more")) clearUnread(button.dataset.conversationId || button.dataset.projectChatOpen);
            },
            true,
        );
        // 다른 탭에서 바뀐 안 읽음 목록도 맞춘다
        window.addEventListener("storage", (event) => {
            if (event.key && event.key !== UNREAD_KEY && /notif/i.test(event.key)) {
                refreshUnreadDots();
                return;
            }
            if (event.key !== UNREAD_KEY) return;
            unread.clear();
            try {
                JSON.parse(event.newValue || "[]").forEach((id) => unread.add(String(id)));
            } catch (e) {
                /* 무시 */
            }
            refreshUnreadDots();
        });
        // 스위치 표시가 바뀌면(공통 스크립트가 값을 채우거나 사용자가 바꾸면) 다시 그린다
        const toggle = document.querySelector(".notification-toggle");
        if (toggle) new MutationObserver(refreshUnreadDots).observe(toggle, { attributes: true, attributeFilter: ["aria-checked", "aria-pressed", "class"] });
        // 공통 스크립트가 알림 스위치 값을 늦게 채우는 경우를 대비해 한 번 더 그린다
        window.setTimeout(refreshUnreadDots, 800);
        refreshUnreadDots();
    }

    // End: 응답 완료 알림 표시 (파란 점)

    // Start: 챗봇 화면 틀 (계정 메뉴 · 왼쪽 메뉴 접기)
    // MD_chatbot.jsp 에 있던 화면 스크립트. .chatbot-app 이 있는 화면(챗봇)에서만 동작한다.
    const ctx = cfg.ctx ?? cfg.baseUrl.replace(/\/intra\/ai\/chat\/?$/, "");

    /**
     * [261016 최신 개발자 소스 반영] 원래 MD_chatbot.jsp 화면 스크립트에서 분리된 계정 메뉴 처리.
     * 제공받은 최신 js/ai-chat.js의 챗봇 전용 클릭 차단·강제 표시 로직을 이곳에 복원했다.
     * HTML에는 연결 속성과 마크업만 두며, 모달 열기·실제 로그아웃은 common.js가 담당한다.
     */
    function initAccountMenu() {
        const toggles = Array.from(document.querySelectorAll(".chatbot-sidebar .sidebar-footer [data-sidebar-account-toggle]"));
        const card = document.querySelector(".chatbot-sidebar .sidebar-footer .user-card");
        if (!toggles.length || !card) return;

        let menu = document.getElementById("sidebarAccountMenu");
        const fallback = document.getElementById("chatbotAccountFallback");
        // 공통 CSS 가 ".sidebar .user-account-menu" 처럼 사이드바 안에서만 모양을 주므로
        // 같은 클래스를 가진 빈 상자를 body 끝에 만들고 그 안으로 옮긴다. (상자 자체는 chat.css 에서 크기·배경을 없앤다)
        const host = document.querySelector(".chatbot-account-host") || document.createElement("div");
        host.className = "sidebar app-sidebar chatbot-account-host";
        document.body.appendChild(host);
        if (menu) {
            ["sidebarAccountMenu", "sidebarProfileModal", "sidebarSettingsModal", "sidebarLogoutModal"].forEach((id) => {
                const node = document.getElementById(id);
                if (node) {
                    host.appendChild(node);
                    node.classList.add("chatbot-raised");
                }
            });
            fallback?.remove();
        } else {
            menu = fallback;
            toggles.forEach((t) => t.setAttribute("aria-controls", "chatbotAccountFallback"));
            if (menu) host.appendChild(menu);
        }
        if (!menu) return;
        menu.classList.add("chatbot-raised", "chatbot-account-menu");

        // 메뉴 위쪽 요약에 이름·직급을 함께 보여 준다 (공통 레이아웃은 이름만 출력)
        const summaryName = menu.querySelector(".user-account-summary strong");
        const cardName = card.querySelector(".user-name")?.textContent.trim();
        if (summaryName && cardName) summaryName.textContent = cardName;

        /*
         * 열기·닫기
         *  - 공통 스크립트(common.js)도 같은 메뉴를 hidden 속성 · .hidden 클래스 · 바깥 클릭 닫기로 다루기 때문에
         *    사용자 카드를 눌러 aria-expanded 는 true 가 되어도 메뉴가 다시 숨겨지는 경우가 있었다.
         *  - 그래서 열림 상태는 이 스크립트가 직접 기억하고(isOpenFlag), 열 때는 숨김 수단을 모두 풀고 표시를 강제한다.
         *  - 카드·톱니 버튼 클릭은 window 캡처 단계에서 가장 먼저 받아 다른 스크립트로 넘기지 않는다.
         */
        let isOpenFlag = false;
        const isOpen = () => isOpenFlag;
        /*
         * 단축 메뉴(공통 사이드바 #sidebar 가 접힌 아이콘 줄) 맨 아래 사용자 아이콘도 같은 계정 메뉴를 연다.
         * 공통 레이아웃의 버튼(data-sidebar-account-toggle)이라 common.js 가 열려고 하지만, 메뉴를 챗봇 화면 앞으로 옮겨 두어
         * 그쪽에서는 열리지 않거나 엉뚱한 곳에 떴다가 바로 닫혔다 → 이 스크립트가 함께 맡는다.
         */
        const RAIL_TOGGLE = "aside.app-sidebar:not(.chatbot-account-host) [data-sidebar-account-toggle]";
        const allToggles = () => [...toggles, ...document.querySelectorAll(RAIL_TOGGLE)];
        let anchor = card; // 메뉴를 붙여 띄울 기준 (챗봇 사용자 카드 또는 단축 메뉴 사용자 아이콘)
        let anchorToggle = toggles[0];
        const place = () => {
            const fromRail = !card.contains(anchor);
            const rect = anchor.getBoundingClientRect();
            if (fromRail) {
                // 단축 메뉴: 아이콘 오른쪽에 아래쪽을 맞춰 띄운다
                menu.style.setProperty("left", `${Math.round(rect.right + 8)}px`, "important");
                menu.style.setProperty("bottom", `${Math.max(8, Math.round(window.innerHeight - rect.bottom))}px`, "important");
            } else {
                menu.style.setProperty("left", `${Math.max(8, rect.left + 8)}px`, "important");
                menu.style.setProperty("bottom", `${window.innerHeight - rect.top + 8}px`, "important");
            }
            menu.style.setProperty("top", "auto", "important");
            menu.style.setProperty("right", "auto", "important");
        };
        const SHOW_STYLES = { display: "block", visibility: "visible", opacity: "1", "pointer-events": "auto", transform: "none" };
        const applyVisibility = (open) => {
            menu.hidden = !open;
            menu.classList.toggle("hidden", !open);
            menu.classList.toggle("is-open", open);
            menu.classList.toggle("show", open);
            menu.setAttribute("aria-hidden", String(!open));
            Object.keys(SHOW_STYLES).forEach((prop) => {
                if (open) menu.style.setProperty(prop, SHOW_STYLES[prop], "important");
                else menu.style.removeProperty(prop);
            });
            if (!open) menu.style.setProperty("display", "none", "important");
        };
        const setOpen = (open, from) => {
            if (open && from) {
                anchorToggle = from;
                anchor = card.contains(from) ? card : from.closest(".user-card") || from;
            }
            isOpenFlag = open;
            applyVisibility(open);
            allToggles().forEach((t) => t.setAttribute("aria-expanded", String(open && (anchor === card ? card.contains(t) : !card.contains(t)))));
            card.classList.toggle("is-menu-open", open);
            if (open) {
                place();
                menu.querySelector('[role="menuitem"]')?.focus({ preventScroll: true });
            }
        };
        setOpen(false);
        card.closest(".chatbot-sidebar")?.addEventListener("chatbot:sidebar-close", () => setOpen(false));

        // 다른 스크립트가 열린 메뉴를 숨기면(속성·클래스·style 변경) 다시 보이게 한다
        new MutationObserver(() => {
            if (!isOpenFlag) return;
            const shown = window.getComputedStyle(menu).display !== "none" && !menu.hidden && !menu.classList.contains("hidden");
            if (!shown) applyVisibility(true);
        }).observe(menu, { attributes: true, attributeFilter: ["hidden", "class", "style", "aria-hidden"] });

        const toggleOf = (event) => event.target?.closest?.(".chatbot-sidebar .sidebar-footer [data-sidebar-account-toggle]") || event.target?.closest?.(RAIL_TOGGLE);

        // 카드·톱니 버튼: 누를 때(mousedown 등) 다른 스크립트의 "바깥 누르면 닫기"가 먼저 닫지 않게 막고, 클릭에서 연다·닫는다
        ["pointerdown", "mousedown", "touchstart"].forEach((type) =>
            window.addEventListener(
                type,
                (event) => {
                    if (toggleOf(event)) event.stopPropagation();
                },
                { capture: true, passive: true },
            ),
        );
        window.addEventListener(
            "click",
            (event) => {
                const toggle = toggleOf(event);
                if (toggle) {
                    event.preventDefault();
                    event.stopPropagation();
                    event.stopImmediatePropagation();
                    window.AIOneTooltip?.hide?.();
                    // 같은 버튼을 다시 누르면 닫고, 다른 쪽(카드 ↔ 단축 메뉴) 버튼이면 그 자리로 옮겨 연다
                    const sameSide = card.contains(toggle) === (anchor === card);
                    setOpen(!(isOpen() && sameSide), toggle);
                    return;
                }
                // 메뉴 밖을 누르면 닫는다 (메뉴 안의 클릭은 common.js 가 처리하도록 그대로 둔다)
                if (isOpen() && !menu.contains(event.target)) setOpen(false);
            },
            true,
        );
        // 키보드(Enter · Space)로 카드에 포커스를 두고 눌러도 click 이 발생하므로 위에서 함께 처리된다.

        // 메뉴 항목을 누르면(모달 열기 등은 common.js 가 처리) 메뉴는 닫는다.
        menu.addEventListener("click", (event) => {
            if (event.target.closest('[role="menuitem"]')) window.setTimeout(() => setOpen(false), 0);
        });
        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && isOpen()) {
                setOpen(false);
                (anchorToggle?.isConnected ? anchorToggle : toggles[0]).focus();
            }
        });
        window.addEventListener("resize", () => {
            if (isOpen()) place();
        });

        // 공통 레이아웃이 없을 때의 로그아웃 (SSO 로그아웃이 있으면 그것을 쓴다)
        document.querySelector("[data-chatbot-logout]")?.addEventListener("click", () => {
            if (window.AIOneSidebar?.logout) window.AIOneSidebar.logout();
            else window.location.href = `${ctx}/login/ND_processLogout.do`;
        });
    }

    /**
     * 챗봇 메뉴 접기 버튼 아이콘을 공통 사이드바(MD_Manage.jsp #sidebarCollapseBtn)와 같은 sidebar-collapse.svg 로 맞춘다.
     * MD_chatbot.jsp 의 기존 아이콘은 그림을 불러오지 못하면 그대로 되돌린다. 경로는 cfg.sidebarToggleIcon 으로 바꿀 수 있다.
     */
    function setSidebarToggleIcon(toggle) {
        if (cfg.sidebarToggleIcon === false || toggle.querySelector('img[data-icon="sidebar-collapse"]')) return;
        const original = toggle.innerHTML;
        const img = document.createElement("img");
        img.className = "collapse-icon icon icon-text chatbot-toggle-icon";
        img.src = cfg.sidebarToggleIcon || `${ctx}/resources/intra/ai/assets/icons/sidebar-collapse.svg`;
        img.alt = "";
        img.setAttribute("aria-hidden", "true");
        img.dataset.icon = "sidebar-collapse";
        img.addEventListener(
            "error",
            () => {
                toggle.innerHTML = original;
            },
            { once: true },
        );
        toggle.replaceChildren(img);
    }

    /**
     * 왼쪽 메뉴 접기·펼치기 (상태는 이 브라우저에만 기억)
     *
     * 접으면 공통 레이아웃(MD_Manage.jsp)의 접힌 사이드바(#sidebar.collapsed)를 단축 메뉴로 보여 준다.
     *   - 아이콘: 로고 · AI-ONE 홈 · 국회 답변서 초안 생성 · 국유재산 · 정책 안내서 · 정책변경보고서 검증 · 내부 자료 검색 · AI-ONE 챗봇
     *     (항목 · 권한 · 현재 화면 표시 · 마우스를 올리면 나오는 이름 툴팁은 공통 레이아웃과 common.js 가 그대로 처리)
     *   - 챗봇 화면(.chatbot-app)을 단축 메뉴 폭(56px)만큼 오른쪽으로 비키고 챗봇 메뉴는 숨긴다 (chat.css .is-rail-mode)
     *   - 단축 메뉴의 로고(또는 공통 사이드바를 펼치는 동작)를 누르면 챗봇 메뉴를 다시 펼친다
     * 공통 사이드바가 없는 화면은 56px로 접어 기존 로고와 메뉴 아이콘을 남긴다.
     */
    function initSidebarToggle() {
        const app = document.querySelector(".chatbot-app");
        const toggle = document.getElementById("chatbotSidebarToggle");
        if (!app || !toggle) return;
        setSidebarToggleIcon(toggle);
        const KEY = "aiOneChatbotSidebar";
        const rail = cfg.sidebarRail === false ? null : document.getElementById("sidebar") || document.querySelector("aside.app-sidebar:not(.chatbot-account-host)");
        const sidebar = document.getElementById("chatbotSidebar");
        const brandLink = sidebar?.querySelector(".chatbot-brand-link");
        const mobileToggle = document.getElementById("chatbotMobileToggle");
        const backdrop = document.getElementById("chatbotSidebarBackdrop");
        const mobileHeader = app.querySelector(".chatbot-mobile-header");
        const main = app.querySelector(".chatbot-main");
        // Start: 261022 주석 보완 - 모바일 헤더 스크롤 상태 연결
        // 대화 스크롤에만 반응하며 배경 투명도는 모바일 CSS에서 처리한다.
        document.addEventListener(
            "scroll",
            (event) => {
                const scroller = event.target === document ? document.scrollingElement : event.target;
                if (scroller !== document.scrollingElement && scroller !== main && !main?.contains(scroller)) return;
                mobileHeader?.classList.toggle("is-scrolled", scroller.scrollTop > 0);
            },
            { capture: true, passive: true },
        );
        // End: 261022 주석 보완 - 모바일 헤더 스크롤 상태 연결
        // chat.css와 같은 경계. 모바일 메뉴 상태는 데스크톱 저장값을 바꾸지 않는다.
        const mobileQuery = window.matchMedia("(max-width: 768px)");
        const hasMobileMenu = !!(sidebar && mobileToggle && backdrop && mobileHeader && main);
        const isMobile = () => hasMobileMenu && mobileQuery.matches;
        let desktopCollapsed = false;
        let railMode = false;
        // 261016 운영: 공통 사이드바와 나란히 두기(AIOneChatConfig.sidebarSideBySide = true). 기본은 챗봇 메뉴가 공통 사이드바 위를 덮는다
        const sideBySide = !!rail && cfg.sidebarSideBySide === true && rail.parentElement === app.parentElement;
        app.classList.toggle("is-side-by-side", sideBySide);
        // 접혀 있는 동안 단축 메뉴 로고에 "챗봇 메뉴 펼치기" 안내를 붙인다
        const railBrand = rail?.querySelector("#sidebarBrandButton, .sidebar-brand");
        const railBrandOrig = railBrand ? { title: railBrand.getAttribute("title"), label: railBrand.getAttribute("aria-label") } : null;
        const setBrandHint = (on) => {
            if (!railBrand) return;
            const title = on ? "챗봇 메뉴 펼치기" : railBrandOrig.title;
            const label = on ? "챗봇 메뉴 펼치기" : railBrandOrig.label;
            if (title == null) railBrand.removeAttribute("title");
            else railBrand.setAttribute("title", title);
            if (label == null) railBrand.removeAttribute("aria-label");
            else railBrand.setAttribute("aria-label", label);
            if (railBrand.dataset.tooltip != null || on) railBrand.dataset.tooltip = on ? "챗봇 메뉴 펼치기" : railBrandOrig.title || "";
        };

        /** 공통 사이드바를 접힌(아이콘) 상태로 맞춘다. 저장은 하지 않는다 (다른 화면의 상태에 영향 없게) */
        const collapseRail = () => {
            if (!rail) return;
            if (!rail.classList.contains("collapsed")) {
                if (window.AIOneSidebar?.setCollapsed) window.AIOneSidebar.setCollapsed(rail, true, { persist: false });
                else rail.classList.add("collapsed");
            }
            markRailActive();
        };

        /*
         * 단축 메뉴에서 "AI-ONE 챗봇"을 현재 화면으로 표시한다.
         * MD_Manage.jsp 는 servletPath 로 현재 메뉴를 고르는데, 챗봇 화면에서는 그 값이 맞지 않아
         * otherwise 분기로 빠져 "국회질의분류"(admin · clsf 권한)가 선택된 것처럼 보였다.
         */
        const RAIL_PAGE = cfg.sidebarRailPage || "chatbot";
        function markRailActive() {
            if (!rail) return;
            const links = Array.from(rail.querySelectorAll(".nav-link"));
            const current = links.find((link) => link.dataset.page === RAIL_PAGE);
            if (!current) return;
            links.forEach((link) => {
                const on = link === current;
                link.classList.toggle("active", on);
                if (on) link.setAttribute("aria-current", "page");
                else link.removeAttribute("aria-current");
            });
        }

        let animTimer = 0;
        const apply = (collapsed, animate = true) => {
            collapsed = !isMobile() && collapsed;
            // 접히는 · 펼쳐지는 동안만 메뉴 상자가 내용을 잘라 보여 준다 (chat.css .is-sidebar-animating)
            if (animate) {
                app.classList.add("is-sidebar-animating");
                clearTimeout(animTimer);
                animTimer = setTimeout(() => app.classList.remove("is-sidebar-animating"), 320);
            }
            railMode = !!rail && collapsed;
            app.classList.toggle("is-sidebar-collapsed", collapsed);
            app.classList.toggle("is-rail-mode", railMode);
            document.body.classList.toggle("is-chatbot-rail-mode", railMode);
            if (railMode && !sideBySide) collapseRail(); // 나란히 배치면 공통 사이드바를 억지로 접지 않는다
            setBrandHint(railMode);
            if (brandLink) {
                const brandExpands = collapsed && !railMode;
                brandLink.title = brandExpands ? "사이드바 펼치기" : "AI-ONE 홈";
                brandLink.dataset.tooltip = brandLink.title;
                brandLink.setAttribute("aria-label", brandLink.title);
                if (brandExpands) {
                    brandLink.setAttribute("role", "button");
                    brandLink.setAttribute("aria-expanded", "false");
                    if (document.activeElement === toggle) brandLink.focus({ preventScroll: true });
                } else {
                    brandLink.removeAttribute("role");
                    brandLink.removeAttribute("aria-expanded");
                }
            }
            toggle.setAttribute("aria-expanded", String(!collapsed));
            toggle.setAttribute("aria-label", collapsed ? "메뉴 펼치기" : "메뉴 접기");
            toggle.title = collapsed ? "사이드바 펼치기" : "사이드바 접기";
            toggle.dataset.tooltip = toggle.title;
            if (collapsed) closeMoreMenu(false);
        };
        const save = (collapsed) => {
            desktopCollapsed = collapsed;
            try {
                window.localStorage.setItem(KEY, collapsed ? "collapsed" : "open");
            } catch (e) {
                /* 무시 */
            }
        };
        const expand = () => {
            apply(false);
            save(false);
            window.AIOneTooltip?.hide?.();
            toggle.focus({ preventScroll: true });
        };

        const expandFromBrand = (event) => {
            if (isMobile() || railMode || !app.classList.contains("is-sidebar-collapsed")) return;
            event.preventDefault();
            expand();
        };
        // Start: 261021 수정 - 검색·일반 메뉴 클릭 시 접힘 유지
        const searchControl = el.historySearch?.closest(".chatbot-search");
        // Start: 261021 수정 - 검색과 일반 메뉴 활성 표시 단일화
        const primaryNavItems = Array.from(sidebar?.querySelectorAll(".chatbot-nav-item.is-primary") || []);
        const setSearchActive = (active) => {
            searchControl?.classList.toggle("is-active", active);
            primaryNavItems.forEach((item) => item.classList.toggle("is-primary", !active));
        };
        // End: 261021 수정 - 검색과 일반 메뉴 활성 표시 단일화
        const closeSidebarSearch = () => {
            sidebar?.classList.remove("is-search-open");
            setSearchActive(false);
            searchControl?.setAttribute("data-tooltip-auto", "");
        };
        el.historySearch?.addEventListener("focus", () => {
            if (isMobile() || railMode || !app.classList.contains("is-sidebar-collapsed")) return;
            const searchTop = searchControl.getBoundingClientRect().top - sidebar.getBoundingClientRect().top;
            sidebar.style.setProperty("--chatbot-search-top", `${searchTop}px`);
            sidebar.classList.add("is-search-open");
            setSearchActive(true);
            searchControl.removeAttribute("data-tooltip-auto");
            window.AIOneTooltip?.hide?.();
        });
        sidebar?.addEventListener(
            "click",
            (event) => {
                if (!event.target.closest(".chatbot-nav-item") || isMobile() || railMode) return;
                const wasCollapsed = app.classList.contains("is-sidebar-collapsed");
                closeSidebarSearch();
                // 메뉴 자체의 동작이 끝난 뒤에도 클릭 전 접힘 상태를 유지합니다.
                if (wasCollapsed)
                    queueMicrotask(() => {
                        if (!app.classList.contains("is-sidebar-collapsed")) apply(true, false);
                        save(true);
                    });
            },
            true,
        );
        document.addEventListener("pointerdown", (event) => {
            if (!event.target.closest(".chatbot-search, .chatbot-history")) closeSidebarSearch();
        });
        document.addEventListener("focusin", (event) => {
            if (!event.target.closest(".chatbot-search, .chatbot-history")) closeSidebarSearch();
        });
        el.historySearch?.addEventListener("keydown", (event) => {
            if (event.key !== "Escape" || !sidebar.classList.contains("is-search-open")) return;
            closeSidebarSearch();
            el.historySearch.blur();
        });
        // End: 261021 수정 - 검색·일반 메뉴 클릭 시 접힘 유지
        // Start: 261021 수정 - Work·Chat 모드 클릭 시 사이드바 펼치기
        // 공통 모드 전환·페이지 이동보다 먼저 펼침 상태를 반영합니다.
        sidebar?.addEventListener(
            "click",
            (event) => {
                const modeLink = event.target.closest(".nav-mode > .nav-link");
                if (!modeLink || !sidebar.contains(modeLink) || isMobile() || railMode || !app.classList.contains("is-sidebar-collapsed")) return;
                closeSidebarSearch();
                apply(false);
                save(false);
                window.AIOneTooltip?.hide?.();
            },
            true,
        );
        // End: 261021 수정 - Work·Chat 모드 클릭 시 사이드바 펼치기
        // Start: 261021 수정 - 일반 홈 메뉴 이동 시 접힘 상태 유지
        sidebar?.querySelector('.chatbot-nav-item[href="home.html"]')?.addEventListener("click", (event) => {
            if (isMobile() || event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
            try {
                window.sessionStorage.setItem("aiOneHomeSidebarHandoff", app.classList.contains("is-sidebar-collapsed") ? "collapsed" : "open");
            } catch (error) {
                // 저장소를 사용할 수 없어도 기존 홈 이동은 유지합니다.
            }
        });
        // End: 261021 수정 - 일반 홈 메뉴 이동 시 접힘 상태 유지
        brandLink?.addEventListener("click", expandFromBrand);
        brandLink?.addEventListener("keydown", (event) => {
            if (event.key === " ") expandFromBrand(event);
        });

        const setMobileOpen = (open, restoreFocus = true) => {
            if (!hasMobileMenu) return;
            const mobile = isMobile();
            const wasOpen = app.classList.contains("is-mobile-sidebar-open");
            const nextOpen = mobile && open;
            app.classList.toggle("is-mobile-sidebar-open", nextOpen);
            backdrop.hidden = !nextOpen;
            main.inert = nextOpen;
            mobileHeader.inert = nextOpen;
            // 닫힌 메뉴에 포커스가 남거나 Tab으로 들어가지 않도록 이동 후 비활성화한다.
            const focusInMenu = [sidebar, el.moreMenu, el.projectMenu, el.projectChatMenu, document.getElementById("sidebarAccountMenu")].some((menu) => menu?.contains(document.activeElement));
            if (!nextOpen && mobile && ((restoreFocus && wasOpen) || focusInMenu)) {
                mobileToggle.focus({ preventScroll: true });
            }
            sidebar.inert = mobile && !nextOpen;
            if (mobile) sidebar.setAttribute("aria-hidden", String(!nextOpen));
            else sidebar.removeAttribute("aria-hidden");
            mobileToggle.setAttribute("aria-expanded", String(nextOpen));
            if (mobile) {
                toggle.setAttribute("aria-expanded", String(nextOpen));
                toggle.setAttribute("aria-label", "채팅 메뉴 닫기");
                toggle.title = "채팅 메뉴 닫기";
            }
            if (nextOpen) {
                window.AIOneTooltip?.hide?.();
                toggle.focus({ preventScroll: true });
            } else if (mobile || wasOpen) {
                closeMoreMenu(false);
                closeProjectMenu(false);
                closeProjectChatMenu(false);
                sidebar.dispatchEvent(new Event("chatbot:sidebar-close"));
            }
        };

        // 저장된 상태는 움직임 없이 바로 적용한다 (화면을 열 때마다 메뉴가 접히는 모습이 보이지 않게)
        app.classList.add("is-sidebar-instant");
        try {
            desktopCollapsed = window.localStorage.getItem(KEY) === "collapsed";
        } catch (e) {
            /* 무시 */
        }
        apply(desktopCollapsed, false);
        setMobileOpen(false, false);
        requestAnimationFrame(() => requestAnimationFrame(() => app.classList.remove("is-sidebar-instant")));
        toggle.addEventListener("click", () => {
            if (isMobile()) {
                setMobileOpen(false);
                return;
            }
            const collapsed = !app.classList.contains("is-sidebar-collapsed");
            apply(collapsed);
            save(collapsed);
        });

        if (hasMobileMenu) {
            mobileToggle.addEventListener("click", () => setMobileOpen(true));
            backdrop.addEventListener("click", () => setMobileOpen(false));
            sidebar.addEventListener("click", (event) => {
                if (!isMobile() || !event.target.closest("#chatNewBtn, [data-conversation-id], [data-project-chat-open], [data-project-newchat]")) return;
                setMobileOpen(false);
            });
            // 계정·더보기 메뉴와 모달은 body로 이동하므로 해당 영역의 Escape 처리는 그대로 둔다.
            window.addEventListener("keydown", (event) => {
                if (event.key !== "Escape" || event.defaultPrevented || !isMobile() || !app.classList.contains("is-mobile-sidebar-open") || !sidebar.contains(event.target)) return;
                event.preventDefault();
                setMobileOpen(false);
            });
            mobileQuery.addEventListener("change", () => {
                const needsDesktopFocus = mobileHeader.contains(document.activeElement) || sidebar.contains(document.activeElement);
                apply(desktopCollapsed, false);
                setMobileOpen(false, false);
                if (!isMobile() && needsDesktopFocus) {
                    const target = railMode ? rail.querySelector("#sidebarBrandButton, .sidebar-brand, #sidebarCollapseBtn") : desktopCollapsed ? brandLink : toggle;
                    target?.focus({ preventScroll: true });
                }
            });
        }

        if (!rail) return;
        // 단축 메뉴의 로고 = 챗봇 메뉴 펼치기 (common.js 가 공통 사이드바를 펼치거나 홈으로 가기 전에 가장 먼저 받는다)
        window.addEventListener(
            "click",
            (event) => {
                if (!railMode) return;
                if (sideBySide && !rail.classList.contains("collapsed")) return; // 나란히 배치에서 공통 사이드바를 펼쳐 둔 경우는 원래 동작
                // 로고 · 펼치기 버튼 · 현재 화면 아이콘(AI-ONE 챗봇) = 챗봇 메뉴 다시 펼치기 (261016 운영 반영)
                const brand = event.target.closest?.(`#sidebarBrandButton, .sidebar-brand, #sidebarCollapseBtn, .nav-link[data-page="${RAIL_PAGE}"]`);
                if (!brand || !rail.contains(brand)) return;
                event.preventDefault();
                event.stopPropagation();
                expand();
            },
            true,
        );
        // 다른 경로로 공통 사이드바가 펼쳐지면(화면 크기 변화 등) 공통 사이드바는 접어 두고 챗봇 메뉴를 펼친다
        rail.addEventListener("sidebar:collapse-change", (event) => {
            if (!railMode || event.detail?.collapsed !== false) return;
            if (rail.dataset.sidebarResponsiveRail === "true") {
                collapseRail();
                return;
            }
            expand();
            collapseRail();
        });
        // common.js(defer)가 나중에 공통 사이드바 상태를 정해도 단축 메뉴 모드면 접힌 상태를 유지한다
        // (common.js 의 configure 가 현재 메뉴 표시를 다시 정할 수 있어 그 뒤에도 챗봇을 현재 화면으로 맞춘다)
        markRailActive();
        window.addEventListener(
            "load",
            () => {
                markRailActive();
                if (railMode) collapseRail();
            },
            { once: true },
        );
        setTimeout(markRailActive, 0);
    }

    // Start: 261016 추가 - 사용자 표시 데이터 연결
    // 실제 연동: AIOneChatConfig.user에 로그인 사용자 값을 전달한다.
    // 미리보기: dummy-api.js가 dummy-data.js의 chat.user를 같은 설정에 전달한다.
    function renderChatUser() {
        const user = cfg.user;
        if (!user) return;
        document.querySelectorAll("[data-chat-user]").forEach((node) => {
            const key = node.dataset.chatUser;
            node.textContent = String(user[key] || (key === "name" ? "사용자" : ""));
            if (key === "greeting") node.hidden = !user.greeting;
        });
        const lineBreak = document.querySelector("[data-chat-user-greeting-break]");
        if (lineBreak) lineBreak.hidden = !user.greeting;
    }
    // End: 261016 추가 - 사용자 표시 데이터 연결

    /** common.js 는 공통 레이아웃(MD_Manage.jsp)이 불러온다. 공통 레이아웃 없이 열렸을 때만 불러온다 (261016 운영) */
    function ensureCommonScript() {
        if (document.querySelector('script[src*="/resources/intra/ai/js/common.js"]')) return;
        const script = document.createElement("script");
        script.src = `${cfg.ctx ?? cfg.baseUrl.replace(/\/intra\/ai\/chat\/?$/, "")}/resources/intra/ai/js/common.js`;
        document.head.appendChild(script);
    }

    function initChatbotPage() {
        if (!document.querySelector(".chatbot-app")) return; // 홈 등 다른 화면
        ensureCommonScript();
        renderChatUser();
        initAccountMenu();
        // 공통 모달은 일반 사이드바의 사용자 카드로 값을 갱신하므로 챗봇 설정을 다시 연결한다.
        document.getElementById("sidebarProfileModal")?.addEventListener("modal:open", renderChatUser);
        initSidebarToggle();
    }

    // End: 챗봇 화면 틀 (계정 메뉴 · 왼쪽 메뉴 접기)

    // Start: 끌어다 놓기 · 붙여넣기로 첨부
    /*
     * 입력창(테두리 상자) 위로 파일을 끌어다 놓으면 + 버튼으로 고른 것과 똑같이 첨부한다 (addFiles).
     *  - 끌고 들어오면 상자에 "여기에 파일을 놓으세요" 안내를 띄운다 (chat.css .is-file-dragover).
     *  - 상자 밖(화면 아무 곳)에 놓쳐도 브라우저가 파일을 열어 버리지 않게 막는다.
     *  - 입력창에 Ctrl+V 로 파일(캡처 이미지 등)을 붙여넣어도 첨부한다.
     */
    const hasFiles = (event) => Array.from(event.dataTransfer?.types || []).includes("Files");

    function getDropZone() {
        if (!el.input) return null;
        return el.input.closest(".prompt-composer-shell") || el.input.closest("#chatComposerForm, .prompt-composer") || el.input.closest("#chatComposer") || el.input.parentElement;
    }

    function bindFileDrop() {
        const zone = getDropZone();
        if (!zone) return;
        zone.classList.add("chat-drop-zone");
        let depth = 0; // 자식 요소를 오갈 때 생기는 dragleave 를 걸러낸다
        const setOver = (on) => zone.classList.toggle("is-file-dragover", on);

        zone.addEventListener("dragenter", (event) => {
            if (!hasFiles(event)) return;
            event.preventDefault();
            depth++;
            setOver(true);
        });
        zone.addEventListener("dragover", (event) => {
            if (!hasFiles(event)) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
        });
        zone.addEventListener("dragleave", (event) => {
            if (!hasFiles(event)) return;
            depth = Math.max(0, depth - 1);
            if (!depth) setOver(false);
        });
        zone.addEventListener("drop", (event) => {
            if (!hasFiles(event)) return;
            event.preventDefault();
            event.stopPropagation();
            depth = 0;
            setOver(false);
            const files = event.dataTransfer.files;
            log(
                "파일 끌어다 놓기",
                Array.from(files || []).map((f) => f.name),
            );
            if (files?.length) addFiles(files);
            el.input?.focus();
        });

        // 상자 밖에 놓친 파일 때문에 화면이 그 파일로 바뀌지 않게 막는다
        window.addEventListener("dragover", (event) => {
            if (hasFiles(event)) event.preventDefault();
        });
        window.addEventListener("drop", (event) => {
            if (!hasFiles(event)) return;
            event.preventDefault();
            depth = 0;
            setOver(false);
        });
        window.addEventListener("dragend", () => {
            depth = 0;
            setOver(false);
        });

        // Ctrl+V 로 파일 붙여넣기 (글자 붙여넣기는 그대로)
        el.input?.addEventListener("paste", (event) => {
            const files = Array.from(event.clipboardData?.files || []);
            if (!files.length) return;
            event.preventDefault();
            addFiles(files);
        });
    }

    // End: 끌어다 놓기 · 붙여넣기로 첨부

    // Start: 이벤트 · 시작
    // Start: 261015 추가 - 빈 입력창 placeholder 타이핑·커서·삭제 효과
    let syncPlaceholderTyping = () => {};

    function initPlaceholderTyping() {
        const input = el.input;
        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
        let text = input.placeholder;
        let characters = Array.from(text);
        let index = 0;
        let timer = 0;
        let phase = "typing";
        let blinkCount = 0;

        // 작업 메뉴에서 설정한 문구만 감지하고, 타이핑 자체의 변경은 제외한다.
        const observer = new MutationObserver(() => {
            text = input.placeholder;
            characters = Array.from(text);
            reset();
        });
        const observe = () => observer.observe(input, { attributes: true, attributeFilter: ["placeholder"] });
        const write = (value) => {
            observer.disconnect();
            input.placeholder = value;
            observe();
        };
        const shouldPause = () => input.value.length > 0 || document.hidden || reducedMotion.matches || !text;

        function tick() {
            timer = 0;
            if (shouldPause()) {
                write(text);
                return;
            }
            let delay = 90;
            let cursor = "|";

            if (phase === "typing") {
                index += 1;
                if (index === characters.length) {
                    phase = "holding";
                    blinkCount = 0;
                    delay = 400;
                }
            } else if (phase === "holding") {
                // 문구 완성 후 커서를 깜빡인 다음 오른쪽 끝부터 지운다.
                blinkCount += 1;
                cursor = blinkCount % 2 ? "" : "|";
                delay = 400;
                if (blinkCount === 6) {
                    phase = "deleting";
                    delay = 55;
                }
            } else {
                index -= 1;
                delay = 55;
                if (index === 0) {
                    phase = "typing";
                    delay = 500;
                }
            }

            write(characters.slice(0, index).join("") + cursor);
            timer = window.setTimeout(tick, delay);
        }

        function sync() {
            if (shouldPause()) {
                window.clearTimeout(timer);
                timer = 0;
                index = 0;
                phase = "typing";
                blinkCount = 0;
                write(text);
            } else if (!timer) {
                write("|");
                timer = window.setTimeout(tick, 400);
            }
        }

        function reset() {
            window.clearTimeout(timer);
            timer = 0;
            index = 0;
            phase = "typing";
            blinkCount = 0;
            sync();
        }

        observe();
        document.addEventListener("visibilitychange", reset);
        reducedMotion.addEventListener("change", reset);
        return sync;
    }
    // End: 261015 추가 - 빈 입력창 placeholder 타이핑·커서·삭제 효과

    /**
     * [261016 HTML 인라인 스크립트 이동] chatbot.html의 모델·작업 선택 및 폼 이벤트를 이곳에 통합.
     * 전송은 send()로 연결하며 메뉴 선택 표시는 common.js를 사용한다.
     * HTML에는 AIOneChatConfig.composerControls 설정만 남긴다.
     */
    // Start: 261016 수정 - 모델·작업 선택 및 입력창 이벤트
    let syncHomeComposerLayout = () => {};

    function initHomeComposerLayout() {
        if (!el.input?.closest(".page > .home-prompt-composer")) return () => {};
        return window.AIOneHomeComposerLayout.init(el.input);
    }

    function initComposerControls() {
        if (!cfg.composerControls || !el.composer) return;
        const controls = cfg.composerControls;
        // 선택 표시와 라벨은 common.js의 Dropdown Menu가 담당한다.
        el.composer.addEventListener("dropdownmenu:select", (event) => {
            const { item, value } = event.detail;
            if (item.closest('[data-task-submenu-ready="true"]')) return;
            const menu = item.closest("[data-chat-menu]");
            if (menu?.dataset.chatMenu === "task") {
                el.composer.dataset.chatTaskCurrent = value;
                el.input.placeholder = controls.placeholders?.[value] || controls.placeholders?.chat || "";
            } else if (menu?.dataset.chatMenu === "model") {
                el.composer.dataset.chatModel = controls.modelMap?.[value] || "";
            }
        });
        el.input.closest("form")?.addEventListener("submit", (event) => {
            event.preventDefault();
            if (!state.streaming) send();
        });
    }

    function initTaskSubmenu() {
        window.AIOneModelTaskMenu.init({
            composer: el.composer,
            input: el.input,
            placeholders: cfg.composerControls?.placeholders,
        });
    }

    function bindEvents() {
        el.input?.addEventListener("keydown", (event) => {
            // 답변 중 Esc → 멈춤
            if (event.key === "Escape" && viewingStream()) {
                event.preventDefault();
                stop();
                return;
            }
            // 한글 조합 중 Enter 는 글자 확정용이므로 보내지 않는다.
            if (event.key !== "Enter" || event.shiftKey || event.isComposing || event.keyCode === 229) return;
            if (!cfg.isChatTask()) return;
            event.preventDefault();
            if (state.streaming) {
                // 답변 중 Enter 는 멈추지 않는다 (멈춤은 버튼·Esc 로만)
                if (!viewingStream()) toast("다른 대화의 답변을 받고 있습니다. 답변이 끝난 뒤 보내 주세요.");
                return;
            }
            send();
        });
        el.input?.addEventListener("input", () => {
            updateSendButton();
        });

        el.sendBtn?.addEventListener("click", (event) => {
            if (state.streaming) {
                event.preventDefault();
                send();
                return;
            } // 멈춤 버튼 (다른 대화를 보는 중이면 안내만)
            if (!cfg.isChatTask()) return; // 다른 작업(국회답변초안생성 등)은 기존 처리에 맡긴다
            event.preventDefault();
            send();
        });

        el.attachBtn?.addEventListener("click", () => el.fileInput?.click());
        el.fileInput?.addEventListener("change", () => {
            addFiles(el.fileInput.files);
            el.fileInput.value = "";
        });
        el.attachList?.addEventListener("click", (event) => {
            const button = event.target.closest(".chat-attach-remove");
            if (button) removeFile(button.closest(".chat-attach-item")?.dataset.key);
        });
        el.messages?.addEventListener("click", (event) => {
            const blockCopy = event.target.closest("[data-chat-block-copy]");
            if (blockCopy) {
                return;
            } // 표·코드 복사는 common.js의 위임 이벤트에서 처리
            const button = event.target.closest("[data-chat-action]");
            if (button) handleAction(button);
        });
        // 채팅 제목 버튼: aria-controls는 대상 안내용이므로 클릭 시 목록 표시 상태를 직접 바꾼다.
        // aria-expanded를 함께 갱신하면 기존 .chatbot-section-toggle CSS가 화살표도 회전시킨다.
        const historyToggle = document.getElementById("chatbotHistoryTitle");
        if (historyToggle && el.historyList) {
            historyToggle.addEventListener("click", () => {
                const expanded = historyToggle.getAttribute("aria-expanded") === "true";
                historyToggle.setAttribute("aria-expanded", String(!expanded));
                el.historyList.hidden = expanded;
            });
        }
        el.historyList?.addEventListener("click", (event) => {
            const moreBtn = event.target.closest("[data-history-more]");
            if (moreBtn) {
                // 더보기(⋮): 대화를 열지 않고 메뉴만 연다
                event.preventDefault();
                event.stopPropagation();
                if (!el.moreMenu.hidden && more.current?.button === moreBtn) closeMoreMenu(true);
                else openMoreMenu(moreBtn);
                return;
            }
            const button = event.target.closest("[data-conversation-id]");
            if (!button || button.dataset.conversationId === state.conversationId) return;
            loadConversation(button.dataset.conversationId).catch((error) => toast(error.message || "대화를 불러오지 못했습니다."));
        });
        // 채팅 검색: 받아 둔 목록을 화면에서 바로 거른다 (한글 조합 중에도 글자가 바뀔 때마다 반영)
        const searchClear = document.querySelector(".chat-search-clear");
        const syncSearchClear = () => {
            if (searchClear) searchClear.hidden = !el.historySearch?.value;
        };
        searchClear?.addEventListener("click", (event) => {
            event.preventDefault();
            el.historySearch.value = "";
            el.historySearch.dispatchEvent(new Event("input", { bubbles: true }));
            el.historySearch.focus();
        });
        el.historySearch?.addEventListener("input", syncSearchClear);
        syncSearchClear();
        el.historySearch?.addEventListener("input", renderHistory);
        el.historySearch?.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && el.historySearch.value) {
                event.preventDefault();
                event.stopPropagation();
                el.historySearch.value = "";
                el.historySearch.dispatchEvent(new Event("input", { bubbles: true }));
            }
        });
        el.newBtn?.addEventListener("click", () => {
            newConversation();
        });
        window.addEventListener("beforeunload", () => state.abort?.abort());
    }

    let initialized = false;
    // End: 261016 수정 - 모델·작업 선택 및 입력창 이벤트

    function init() {
        removeHiddenTasks();
        if (initialized) return;
        initialized = true;
        Object.keys(sel).forEach((key) => {
            el[key] = $(sel[key]);
        });
        initChatbotPage();
        initHistoryMore();
        initProjects();
        if (!el.input || (cfg.mode !== "handoff" && !el.messages)) {
            console.warn("[chat] 입력창(#chatInput) 또는 메시지 영역(#chatMessages)이 없어 일반 채팅을 시작하지 않습니다.");
            return;
        }
        syncPlaceholderTyping = initPlaceholderTyping();
        initTaskSubmenu();
        initComposerControls();
        syncHomeComposerLayout = initHomeComposerLayout();
        bindEvents();
        bindAutoScroll();
        bindFileDrop();
        bindSourcePreview();
        // 작업 선택이 바뀌면(일반 대화 ↔ 국회답변서초안생성) 안내를 붙이거나 거둔다
        const taskHolder = document.querySelector("[data-chat-task-current]");
        if (taskHolder && cfg.mode !== "handoff") {
            new MutationObserver(renderTaskGuide).observe(taskHolder, { attributes: true, attributeFilter: ["data-chat-task-current"] });
        }
        renderAttachments();
        updateSendButton();
        if (debugOn) console.info("[chat] 콘솔 로그 켜짐 · mode=" + cfg.mode + " · baseUrl=" + cfg.baseUrl + " (끄기: AIOneChat.debug(false))");
        if (cfg.mode !== "handoff") initUnread(); // 응답 완료 알림 (파란 점) — 챗봇 화면 대화 목록에만
        if (cfg.mode === "handoff") return; // 홈: 질문을 넘기기만 한다

        setChatting(false);
        renderTaskGuide();
        loadHistory();
        loadProjects();

        // 홈에서 작업을 정해 넘어온 경우(?task=search 등) 작업 선택을 맞춘다
        const taskFromUrl = pageQuery().get("task");
        if (taskFromUrl) {
            if (hasTaskMenu(taskFromUrl)) selectTask(taskFromUrl); // 메뉴에서 빠진 작업(?task=answer)은 무시하고 일반 대화
            setQuery({ task: null });
        }

        // 홈에서 넘겨받은 질문이 있으면 새 대화로 바로 보낸다
        const handed = takeHandoff();
        if (handed) {
            const query = pageQuery();
            query.delete("prompt");
            window.history.replaceState(null, "", window.location.pathname + (query.toString() ? `?${query}` : ""));
            state.files = (handed.files || [])
                .filter((f) => f && f.id)
                .map((obj) => ({
                    key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                    name: obj.name || "첨부 파일",
                    status: "ready",
                    obj,
                }));
            renderAttachments();
            if (handed.model && el.composer) el.composer.setAttribute("data-chat-model", handed.model);
            send(handed.prompt);
            return;
        }

        const fromUrl = pageQuery().get("conversationId");
        const projectFromUrl = proj.ready ? pageQuery().get("projectId") : null;
        if (projectFromUrl && !fromUrl) {
            // 프로젝트 화면 (새로고침 · 링크)
            openProject(projectFromUrl);
            return;
        }
        if (fromUrl) {
            loadConversation(fromUrl, { projectId: projectFromUrl }).catch((error) => {
                console.error("대화 불러오기 실패", error);
                toast(error.message || "대화를 불러오지 못했습니다.");
            });
        }
    }

    window.AIOneChat = {
        renderMarkdown,
        send,
        stop,
        openPreview,
        closePreview,
        loadConversation,
        newConversation,
        loadHistory,
        loadProjects,
        openProject,
        init,
        debug: setDebug,
        state,
        // 응답 완료 알림 확인용: 콘솔에서 AIOneChat.notify() → 켜짐 여부와 판단 근거 · 안 읽은 대화 목록
        notify: () => ({ ...notifySetting(), unread: Array.from(unread) }),
    };

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
    // End: 이벤트 · 시작
})();
