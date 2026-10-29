/**
 * 261028 누적 변경 요약 (현재 구현 기준)
 * - 공통 입력창·채팅·자료 이벤트와 페이지 모듈 초기화를 조립합니다. 추천 프롬프트 전송과 chatOnly 화면의 제목 편집을 공통 처리에 연결합니다.
 *
 * AI-ONE 공통 패널 진입점
 * 적용 화면: ai-answer.html, work-support.html, sale-review.html
 * [공통 입력창] AIOneChatInput.resize: 자동 높이, 내부 스크롤, 펼침·접힘 및 상태별 툴팁을 관리한다.
 * 역할: 공통 상태·DOM, 채팅·자료 이벤트, 문서 전체보기와 초기화 순서
 * 연결: common.js → panel-*.js → 이 파일 → 각 페이지 진입점
 * - 261022 정리 - 공통 패널과 화면 전용 기능의 관리 범위를 분리합니다.
 *
 * 최근 변경 내용
 * - 261023 이동 - 추천 프롬프트 자동 전송
 *
 * 261026 변경 요약
 * - 수정 - chatOnly 화면에도 공통 제목 편집기 초기화
 * - 변경 - 매각페이지는 chatOnly 설정으로 공통 채팅과 제목 편집을 연결합니다.
 *
 * 기본 구간 형식: Start: 기능명 / End: 기능명
 * 변경 구간 형식: Start: YYMMDD 추가/수정 - 기능명 / End: YYMMDD 추가/수정 - 기능명
 * 주석 정리 내역
 * - 261023 주석 정리 - 구간 표시와 변경 내용 표기를 통일합니다. 기존 작업 날짜와 기능 설명은 유지합니다.
 */

// 페이지 연결: configure(상태·DOM) → 공통 모듈 → installPage(전용 처리 함수) → bindPage(이벤트).
// runtime.page: render/reset, renderSources/onSelectionChanged, loadConversation,
// receiveMetadata/completeResponse, activateView/showLoading/updateLoading/hideLoading,
// showNotice/closeNotice, getAssistantText/renderMessage/closeSourcePreview/onNewWorkspace.
// 사용하지 않는 페이지 처리 함수는 생략할 수 있습니다. API 필드·DOM data-* 계약은 유지합니다.

// [개발 연동 안내] HTML 예시/연결 위치는 html/ai-answer.html의 [API 연결 위치] 참조.
// 작성 이력·메시지: panel-conversation.js / 답변서: draft-report.js / 첨부·자료: panel-source.js / 버전 비교: draft-compare.js.
// 실제 HTTP 요청은 각 파일의 [API 연동], 공통 응답 처리는 panel-conversation.js의 requestJson() 참조.

/* Start: 261023 이동 - 추천 프롬프트 자동 전송 */
// common.js가 추천 문구를 입력한 뒤 발생시키는 공통 칩 이벤트를 사용한다.
document.addEventListener("chip:action", (event) => {
    const button = event.target.closest(".chat-tag");
    const target = event.detail?.target;
    if (!button || !(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;

    // 자동 전송은 data-chip-send="true"가 지정된 추천 프롬프트에만 적용.
    // 실제 API/SSE 호출은 각 화면의 기존 전송 버튼 이벤트가 담당한다.
    if ((button.dataset.chipSend ?? button.closest("[data-chip-target]")?.dataset.chipSend) !== "true") return;
    const area = target.closest(".chat-input-area, [data-chat-composer], .chat-composer") || target.parentElement;
    const sendButton = area?.querySelector("#sendBtn, #chatSendBtn, [data-chat-send], .chat-send");
    if (sendButton && !sendButton.disabled) {
        sendButton.click();
    } else if (!sendButton) {
        const form = target.closest("form");
        if (form && typeof form.requestSubmit === "function") form.requestSubmit();
    }
});
/* End: 261023 이동 - 추천 프롬프트 자동 전송 */

/* Start: 261022 주석 보완 - 공통 입력창 자동 높이·펼침·툴팁 */
/* 공통 채팅 입력: 내용 자동 높이와 명시적인 접기/펼치기 상태를 분리한다. */
(() => {
    function resize(input) {
        if (!input?.matches("textarea.chat-input")) return;
        const field = input.closest(".chat-input-field");
        const style = getComputedStyle(input);
        const lineHeight = parseFloat(style.lineHeight) || 20;
        const verticalPadding = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
        // min-height가 실제 한 줄 높이보다 작아도 한 줄을 여러 줄로 판단하지 않는다.
        const minimum = Math.max(parseFloat(style.minHeight) || 18, lineHeight + verticalPadding);
        input.style.height = `${minimum}px`;
        const contentHeight = input.scrollHeight;
        const multiline = contentHeight > minimum + 1;
        const mode = field?.dataset.inputSize;
        if (mode === "expanded") {
            // 펼침 높이는 CSS에서 관리하여 vh 변경에도 자동으로 대응한다.
            input.style.removeProperty("height");
            input.style.removeProperty("overflow-y");
        } else {
            const height = Math.min(120, Math.max(minimum, contentHeight));
            input.style.height = `${height}px`;
            input.style.overflowY = input.scrollHeight > height ? "auto" : "hidden";
        }
        const expanded = mode === "expanded";
        const toggle = field?.querySelector(".chat-input-toggle");
        if (toggle) {
            toggle.hidden = !multiline && !expanded;
            if (toggle.hidden) window.AIOneTooltip?.hide(toggle);
            toggle.setAttribute("aria-expanded", String(expanded));
            const label = expanded ? "입력창 접기" : "입력창 펼치기";
            toggle.setAttribute("aria-label", label);
            toggle.dataset.tooltip = label;
        }
    }
    function init() {
        document.querySelectorAll("textarea.chat-input").forEach((input) => {
            input.addEventListener("input", () => resize(input));
            input
                .closest(".chat-input-field")
                ?.querySelector(".chat-input-toggle")
                ?.addEventListener("click", (event) => {
                    const toggle = event.currentTarget;
                    input.closest(".chat-input-field").dataset.inputSize = toggle.getAttribute("aria-expanded") === "true" ? "collapsed" : "expanded";
                    resize(input);
                    input.focus({ preventScroll: true });
                });
            new ResizeObserver(() => {
                const width = input.clientWidth;
                if (input.dataset.inputWidth === String(width)) return;
                input.dataset.inputWidth = String(width);
                resize(input);
            }).observe(input);
            resize(input);
        });
    }
    window.AIOneChatInput = Object.freeze({ resize });
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
    else init();
})();
/* End: 261022 주석 보완 - 공통 입력창 자동 높이·펼침·툴팁 */

window.AIOnePanel = {
    // API 없이 패널 UI만 사용하는 화면도 같은 컨트롤러를 연결한다.
    initShell({ container = document.querySelector(".three-panel"), collapse = true, accessory = true } = {}) {
        if (!container || container.dataset.panelShellReady) return;
        container.dataset.panelShellReady = "true";
        window.AIOneWorkspaceUi.initPanelDragDrop({ container });
        if (collapse) window.AIOneWorkspaceUi.initPanelCollapse({ container });
        if (accessory) window.AIOneWorkspaceUi.initAccessoryController({ container: () => container });
    },
    bindChatInput({ input, button, form, onSend, onInput = () => {} }) {
        const sync = () => {
            window.AIOneChatInput?.resize(input);
            onInput();
        };
        input.addEventListener("input", sync);
        input.addEventListener("keydown", (event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
                event.preventDefault();
                if (!button.disabled) onSend();
            }
        });
        if (form)
            form.addEventListener("submit", (event) => {
                event.preventDefault();
                if (!button.disabled) onSend();
            });
        else button.addEventListener("click", () => onSend());
        return { sync };
    },

    init({ config = {}, configure = () => {}, installPage = () => {}, bindPage = () => {} } = {}) {
        const common = window.AIOneCommon || {};
        if (document.body.dataset.panelReady) return;
        document.body.dataset.panelReady = "true";
        const featureRuntime = Object.create(null);
        featureRuntime.page = {};
        featureRuntime.config = config;
        const featureInstallers = window.AIOnePanelFeatureModules || {};
        const workspaceCommon = window.AIOneWorkspaceCommon;
        if (!workspaceCommon) {
            throw new Error("common.js의 AIOneWorkspaceCommon이 먼저 로드되어야 합니다.");
        }
        // 퍼블 ai-answer.js의 data-icon hydration을 서버 경로에 맞게 이식

        const customConfirm =
            common?.customConfirm ||
            function (title, message, onConfirm) {
                if (window.confirm((title ? title + "\n\n" : "") + message)) onConfirm();
            };
        const state = {
            conversationId: "",
            conversations: [],
            conversationPage: 1,
            conversationPages: 1,
            conversationLoadingMore: false,
            conversationSearchTitle: "",
            conversationFavoriteOnly: false,
            uploadedFiles: [],
            // v1.5 No.18: 현재 대화에 이미 연결된 첨부파일 목록.
            // "이번 턴에 전송할 파일(uploadedFiles)"과 분리해 둔다.
            conversationFiles: [],
            recommendationItems: [],
            references: [],
            selectedReferenceKeys: new Set(),
            activeReferenceKey: "",
            recommendZoom: 100,
            recommendPdf: null,
            recommendPdfRenderSeq: 0,
            sending: false,
            uploading: false,
            conversationActionId: "",
            pendingFileDeleteIndex: -1,
            // 삭제 대상 구분: pending(이번 턴 첨부) / history(첨부 완료 이력) / search(검색 결과 목록)
            pendingFileDeleteSource: "",
            openingFilePicker: false,
            pendingRenameConversationId: "",
            pendingDeleteConversationId: "",
            actionModalTrigger: null,
        };
        const pendingConversationIds = new Set();
        // 사이드바 메뉴와 별개로 대화방의 미확인 완료 상태를 관리한다.
        const completedConversationIds = new Set();
        const pendingNewWorkspaceEpochs = new Set();
        let workspaceEpoch = 0;

        // 비동기 대화 조회가 늦게 끝나더라도 다른 대화 화면을 덮어쓰지 않게 한다.

        const PAGE_SIZE = window.AIOneConversationDrawer.PAGE_SIZE;
        const el = {
            chatBody: document.getElementById(config.chatBodyId || "chatBody"),
            chatInput: document.getElementById("chatInput"),
            sendBtn: document.getElementById("sendBtn"),
            newChatBtn: document.getElementById("newChatBtn"),
            fileButton: document.getElementById("referenceFileButton"),
            fileInput: document.getElementById("referenceFileInput"),
            fileList: document.getElementById("referenceFileList"),
            fileCount: document.getElementById("sourceFileCount"),
            fileReset: document.getElementById("sourceResetBtn"),
            chatFileChips: document.getElementById("chatFileChips"),
            selectedReferenceList: document.getElementById("selectedReferenceList"),
            selectedReferenceCount: document.getElementById("selectedReferenceCount"),
            selectedReferenceEmpty: document.getElementById("selectedReferenceEmpty"),
            selectedReferenceFooter: document.getElementById("selectedReferenceFooter"),
            applyReferencesMessage: document.getElementById("applyReferencesMessage"),
            applyReferencesBtn: document.getElementById("applyReferencesBtn"),
            sourcePreview: document.getElementById("sourcePreview"),
            previewScore: document.getElementById("previewScore"),
            recommendCharCount: document.getElementById("recommendCharCount"),
            recommendPageCurrent: document.getElementById("recommendPageCurrent"),
            recommendPageTotal: document.getElementById("recommendPageTotal"),
            recommendZoomOut: document.getElementById("recommendZoomOut"),
            recommendZoomIn: document.getElementById("recommendZoomIn"),
            recommendZoomPercent: document.getElementById("recommendZoomPercent"),
            recommendFullscreenBtn: document.getElementById("recommendFullscreenBtn"),
            historyBtn: document.getElementById("draftHistoryBtn"),
            historyDrawer: document.getElementById("runDrawer"),
            historyPositionBtn: document.getElementById("runDrawerPositionBtn") || document.querySelector("#runDrawer .drawer-position-button"),
            historyList: document.getElementById("chatTopics"),
            historyTotal: document.getElementById("runListTotal"),
            historySearch: document.getElementById("runListSearch"),
            historySearchBtn: document.getElementById("runListSearchBtn"),
            historySearchClear: document.getElementById("runListSearchClear"),
            historySort: document.getElementById("runListSort"),
            historyPager: document.getElementById("draftHistoryPagination"),
            workspaceTitleBtn: document.getElementById("answerWorkspaceTitleBtn"),
            workspaceTitleText: document.getElementById("answerWorkspaceTitleText"),
            workspaceTitleInput: document.getElementById("answerWorkspaceTitleInput"),
        };
        if (!el.chatBody || !el.chatInput || !el.sendBtn) return;

        // ─── 보조도구 모음 ───
        const ANSWER_UI_FONT_COOKIE = "ai_one_answer_font_percent";
        const ANSWER_UI_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

        // ─── Panel Layout / Drag & Drop ───
        // 질의분류와 동일하게 패널 헤더를 드래그해서 좌/중/우 배치를 서로 교환한다.
        // AI 참조소스(folder) 패널은 HTML에 설정된 기본 폭을 그대로 사용한다.
        const ANSWER_SOURCE_PANEL_WIDTH_SCALE = 1;
        // 이전 확대 폭(v4)이 새 기본값을 덮지 않도록 쿠키 버전을 올린다.
        const ANSWER_PANEL_LAYOUT_COOKIE = config.layoutCookie;
        let answerDefaultPanelLayout = null;
        const answerPanelLayoutController = window.AIOneWorkspaceUi.createPanelLayoutController({
            cookieKey: ANSWER_PANEL_LAYOUT_COOKIE,
            cookieMaxAge: ANSWER_UI_COOKIE_MAX_AGE,
            includeSlot: true,
            getState: (container) => window.AIOneWorkspaceUi.getLayoutState(container, { includeSlot: true }),
            applyState: (container, state) => applyAnswerPanelLayout(container, state),
            onRestoreError: (error) => console.warn("답변서 패널 배치 복원 실패", error),
        });

        // escapeHtml: 해당 기능의 세부 처리를 담당.
        function escapeHtml(value) {
            return workspaceCommon.escapeHtml(value);
        }
        // parseMarkdown: 해당 기능의 세부 처리를 담당.
        function parseMarkdown(markdown) {
            const value = String(markdown || "");
            if (window.marked && typeof window.marked.parse === "function") {
                console.groupCollapsed("[MARKDOWN DEBUG] parseMarkdown");
                console.log("[1] INPUT 원본:", value);
                console.log("[1-1] INPUT table 태그 포함:", /<table[\\s>]/i.test(value));
                console.log("[1-2] INPUT tr 개수:", (value.match(/<tr[\\s>]/gi) || []).length);
                console.log("[1-3] INPUT td 개수:", (value.match(/<td[\\s>]/gi) || []).length);
                console.log("[1-4] INPUT th 개수:", (value.match(/<th[\\s>]/gi) || []).length);
                const html = window.marked.parse(value, { breaks: true, gfm: true });
                console.log("[2] MARKED 결과:", html);
                console.log("[2-1] MARKED table 태그 포함:", /<table[\\s>]/i.test(html));
                console.log("[2-2] MARKED tr 개수:", (html.match(/<tr[\\s>]/gi) || []).length);
                console.log("[2-3] MARKED td 개수:", (html.match(/<td[\\s>]/gi) || []).length);
                console.log("[2-4] MARKED th 개수:", (html.match(/<th[\\s>]/gi) || []).length);
                const sanitized = window.DOMPurify ? window.DOMPurify.sanitize(html) : html;
                console.log("[3] PURIFY 결과:", sanitized);
                console.log("[3-1] PURIFY table 태그 포함:", /<table[\\s>]/i.test(sanitized));
                console.log("[3-2] PURIFY tr 개수:", (sanitized.match(/<tr[\\s>]/gi) || []).length);
                console.log("[3-3] PURIFY td 개수:", (sanitized.match(/<td[\\s>]/gi) || []).length);
                console.log("[3-4] PURIFY th 개수:", (sanitized.match(/<th[\\s>]/gi) || []).length);
                console.groupEnd();
                return sanitized;
            }
            console.warn("[MARKDOWN DEBUG] marked 없음 - escapeHtml fallback 사용");
            return escapeHtml(value).replace(/\n/g, "<br>");
        }

        // sleep: 해당 기능의 세부 처리를 담당.
        function sleep(ms) {
            return new Promise((resolve) => window.setTimeout(resolve, ms));
        }

        // nestedValue: 해당 기능의 세부 처리를 담당.
        function nestedValue(source, key) {
            if (source == null) return null;
            if (Array.isArray(source)) {
                for (const item of source) {
                    const value = nestedValue(item, key);
                    if (value != null && value !== "") return value;
                }
                return null;
            }
            if (typeof source !== "object") return null;
            if (Object.prototype.hasOwnProperty.call(source, key) && source[key] != null) {
                return source[key];
            }
            for (const value of Object.values(source)) {
                const found = nestedValue(value, key);
                if (found != null && found !== "") return found;
            }
            return null;
        }

        // singleResponse: 해당 기능의 세부 처리를 담당.
        function singleResponse(data) {
            if (!data) return null;
            if (Array.isArray(data)) {
                if (!data.length) return null;
                if (data.length === 1) return singleResponse(data[0]);
                return data[0];
            }
            if (data && typeof data === "object") {
                if (data.report_id || data.id || data.content) return data;
                if (Array.isArray(data.items) && data.items.length) return data.items[0];
                if (data.data) return singleResponse(data.data);
                for (const value of Object.values(data)) {
                    const found = singleResponse(value);
                    if (found) return found;
                }
            }
            return null;
        }

        // listResponse: 해당 기능의 세부 처리를 담당.
        function listResponse(data, preferredKey) {
            if (!data) return [];
            if (Array.isArray(data)) {
                if (data.length === 1 && Array.isArray(data[0])) return data[0];
                if (data.length === 1 && data[0] && Array.isArray(data[0].items)) return data[0].items;
                if (data.every((item) => item && typeof item === "object")) return data;
            }
            if (data && typeof data === "object") {
                if (preferredKey && Array.isArray(data[preferredKey])) return data[preferredKey];
                if (Array.isArray(data.items)) return data.items;
                if (Array.isArray(data.data)) return data.data;
                for (const value of Object.values(data)) {
                    if (Array.isArray(value)) return value;
                }
            }
            return [];
        }

        // 공통 모듈은 동일한 상태 객체와 서비스 참조를 사용한다.
        const getChatDateLabel = (...args) => featureRuntime.getChatDateLabel(...args);
        const formatChatTime = (...args) => featureRuntime.formatChatTime(...args);
        const getCurrentTime = (...args) => featureRuntime.getCurrentTime(...args);
        const formatMessageTime = (...args) => featureRuntime.formatMessageTime(...args);
        const getMessageDateKey = (...args) => featureRuntime.getMessageDateKey(...args);
        const getMessageDateLabel = (...args) => featureRuntime.getMessageDateLabel(...args);
        const appendChatDateDivider = (...args) => featureRuntime.appendChatDateDivider(...args);
        const setTab = (...args) => featureRuntime.setTab(...args);
        const normalizeChatDisplayText = (...args) => featureRuntime.normalizeChatDisplayText(...args);
        const getAssistantChatDisplayText = (...args) => featureRuntime.getAssistantChatDisplayText(...args);
        const copyChatMessageText = (...args) => featureRuntime.copyChatMessageText(...args);
        const applyMessageFeedbackState = (...args) => featureRuntime.applyMessageFeedbackState(...args);
        const saveMessageFeedback = (...args) => featureRuntime.saveMessageFeedback(...args);
        const loadMessageFeedback = (...args) => featureRuntime.loadMessageFeedback(...args);
        const openMessageFeedbackEditor = (...args) => featureRuntime.openMessageFeedbackEditor(...args);
        const openCustomerIssueModal = (...args) => featureRuntime.openCustomerIssueModal(...args);
        const attachFeedbackControlsToMessage = (...args) => featureRuntime.attachFeedbackControlsToMessage(...args);
        const appendMessage = (...args) => featureRuntime.appendMessage(...args);
        const setMessageMarkdown = (...args) => featureRuntime.setMessageMarkdown(...args);
        const createChatTypingController = (...args) => featureRuntime.createChatTypingController(...args);
        const showSearchSkeleton = (...args) => featureRuntime.showSearchSkeleton(...args);
        const hideSearchSkeleton = (...args) => featureRuntime.hideSearchSkeleton(...args);
        const updateSearchSkeleton = (...args) => featureRuntime.updateSearchSkeleton(...args);
        const showLoading = (...args) => featureRuntime.showLoading(...args);
        const syncSendButton = (...args) => featureRuntime.syncSendButton(...args);
        const syncChatInputHeight = (...args) => featureRuntime.syncChatInputHeight(...args);
        const setBusy = (...args) => featureRuntime.setBusy(...args);
        const getConversationPageInfo = (...args) => featureRuntime.getConversationPageInfo(...args);
        const requestJson = (...args) => featureRuntime.requestJson(...args);
        const loadConversationList = (...args) => featureRuntime.loadConversationList(...args);
        const isPinnedConversation = (...args) => featureRuntime.isPinnedConversation(...args);
        const setConversationFavorite = (...args) => featureRuntime.setConversationFavorite(...args);
        const togglePinnedConversation = (...args) => featureRuntime.togglePinnedConversation(...args);
        const getConversationById = (...args) => featureRuntime.getConversationById(...args);
        const renameConversation = (...args) => featureRuntime.renameConversation(...args);
        const getDefaultAnswerWorkspaceTitle = (...args) => featureRuntime.getDefaultAnswerWorkspaceTitle(...args);
        const getActiveConversationTitle = (...args) => featureRuntime.getActiveConversationTitle(...args);
        const renderAnswerWorkspaceTitle = (...args) => featureRuntime.renderAnswerWorkspaceTitle(...args);
        const bindAnswerWorkspaceTitleEdit = (...args) => featureRuntime.bindAnswerWorkspaceTitleEdit(...args);
        const deleteConversation = (...args) => featureRuntime.deleteConversation(...args);
        const ensureHistorySortOptions = (...args) => featureRuntime.ensureHistorySortOptions(...args);
        const requestNextConversationPage = (...args) => featureRuntime.requestNextConversationPage(...args);
        const ensureConversationInfiniteScroll = (...args) => featureRuntime.ensureConversationInfiniteScroll(...args);
        const renderConversationPagination = (...args) => featureRuntime.renderConversationPagination(...args);
        const renderConversationHistory = (...args) => featureRuntime.renderConversationHistory(...args);
        const selectConversation = (...args) => featureRuntime.selectConversation(...args);
        const loadConversationAttachments = (...args) => featureRuntime.loadConversationAttachments(...args);
        const loadConversationMessages = (...args) => featureRuntime.loadConversationMessages(...args);
        const parseSseEvent = (...args) => featureRuntime.parseSseEvent(...args);
        const sendMessageStream = (...args) => featureRuntime.sendMessageStream(...args);
        const ensureConversation = (...args) => featureRuntime.ensureConversation(...args);
        const recoverLatestAssistantMetadata = (...args) => featureRuntime.recoverLatestAssistantMetadata(...args);
        const sendChat = (...args) => featureRuntime.sendChat(...args);
        const getAnswerWelcomeHtml = (...args) => featureRuntime.getAnswerWelcomeHtml(...args);
        const resetWorkspace = (...args) => featureRuntime.resetWorkspace(...args);
        const syncDrawerPositionButton = (...args) => featureRuntime.syncDrawerPositionButton(...args);
        const toggleDrawerPosition = (...args) => featureRuntime.toggleDrawerPosition(...args);
        const openDrawer = (...args) => featureRuntime.openDrawer(...args);
        const closeDrawer = (...args) => featureRuntime.closeDrawer(...args);
        const getFileFromResponse = (...args) => featureRuntime.getFileFromResponse(...args);
        const getUploadedFileChunkCount = (...args) => featureRuntime.getUploadedFileChunkCount(...args);
        const getUploadedFileExtension = (...args) => featureRuntime.getUploadedFileExtension(...args);
        const getUploadedFileType = (...args) => featureRuntime.getUploadedFileType(...args);
        const getUploadedFileIdentity = (...args) => featureRuntime.getUploadedFileIdentity(...args);
        const isUploadedFileSelected = (...args) => featureRuntime.isUploadedFileSelected(...args);
        const renderUploadedFiles = (...args) => featureRuntime.renderUploadedFiles(...args);
        const uploadFile = (...args) => featureRuntime.uploadFile(...args);
        const uploadFiles = (...args) => featureRuntime.uploadFiles(...args);
        const referenceKey = (...args) => featureRuntime.referenceKey(...args);
        const addSelectedReferenceKey = (...args) => featureRuntime.addSelectedReferenceKey(...args);
        const clonePrototypeElement = (...args) => featureRuntime.clonePrototypeElement(...args);
        const createRecommendationTagFromPublicPrototype = (...args) => featureRuntime.createRecommendationTagFromPublicPrototype(...args);
        const normalizeRecommendations = (...args) => featureRuntime.normalizeRecommendations(...args);
        const setRecommendations = (...args) => featureRuntime.setRecommendations(...args);
        const buildPublicDocMetaBox = (...args) => featureRuntime.buildPublicDocMetaBox(...args);
        const buildPublicDocSection = (...args) => featureRuntime.buildPublicDocSection(...args);
        const buildPublicDocPage = (...args) => featureRuntime.buildPublicDocPage(...args);
        const renderRecommendations = (...args) => featureRuntime.page.renderSources?.(...args);
        const renderSelectedReferences = (...args) => featureRuntime.renderSelectedReferences(...args);
        const getCurrentVisiblePage = (...args) => featureRuntime.getCurrentVisiblePage(...args);
        const updateRecommendDocumentStats = (...args) => featureRuntime.updateRecommendDocumentStats(...args);
        const renderRecommendPdfPages = (...args) => featureRuntime.renderRecommendPdfPages(...args);
        const downloadOriginalFile = (...args) => featureRuntime.downloadOriginalFile(...args);
        const ensurePreviewHwpDownloadControl = (...args) => featureRuntime.ensurePreviewHwpDownloadControl(...args);
        const renderPreview = (...args) => featureRuntime.renderPreview(...args);
        const getFileDeleteTarget = (...args) => featureRuntime.getFileDeleteTarget(...args);
        const openFileDeleteModal = (...args) => featureRuntime.openFileDeleteModal(...args);
        const closeFileDeleteModal = (...args) => featureRuntime.closeFileDeleteModal(...args);
        const confirmFileDelete = (...args) => featureRuntime.confirmFileDelete(...args);
        const openReferenceFilePicker = (...args) => featureRuntime.openReferenceFilePicker(...args);
        const activateHistoricalFile = (...args) => featureRuntime.activateHistoricalFile(...args);
        // 답변서 capability가 없는 내부자료 검색은 보고서·버전 API를 실행하지 않는다.
        const selectedDocIdsFromUi = (...args) => featureRuntime.selectedDocIdsFromUi(...args);
        // Start: 261020 수정 - 보고서·채팅 표 스타일 및 복사 행 연결
        // wrapDocumentTables: 표 스타일을 적용하고 채팅 표에 공통 복사 행을 연결한다.
        function wrapDocumentTables(body, { chat = false } = {}) {
            if (!body) return;
            if (chat) window.AIOneChatBlocks.decorate(body, { includeCode: false });
            body.querySelectorAll("table").forEach((table) => {
                // 서버 HTML은 <table><tr><td> 구조만 내려오고
                // border / padding / header 스타일은 없어서 화면상 일반 텍스트처럼 보인다.
                // 표 스타일은 이 함수의 inline style에서 관리한다.
                table.style.borderCollapse = "collapse";
                table.style.borderSpacing = "0";
                table.style.width = "max-content";
                table.style.minWidth = "100%";
                table.style.maxWidth = "none";
                table.style.tableLayout = "auto";
                table.style.border = "1px solid #d9dee7";
                const rows = Array.from(table.querySelectorAll("tr"));
                rows.forEach((row, rowIndex) => {
                    row.querySelectorAll("th, td").forEach((cell) => {
                        cell.style.border = "1px solid #d9dee7";
                        cell.style.padding = "8px 10px";
                        cell.style.verticalAlign = "top";
                        cell.style.whiteSpace = "normal";
                        cell.style.wordBreak = "keep-all";
                        cell.style.overflowWrap = "break-word";
                        cell.style.minWidth = "120px";
                        cell.style.lineHeight = "1.5";
                        // 현재 서버 표는 th 없이 첫 행도 td로 내려오므로
                        // 첫 행을 화면상 헤더처럼 표시한다.
                        if (rowIndex === 0) {
                            cell.style.fontWeight = "700";
                            cell.style.background = "#f5f7fa";
                        }
                    });
                });
                // Start: 261020 추가 - 채팅 표 복사 행·버튼 스타일
                // 행 생성·기존 SVG·복사·토스트는 common.js의 AIOneChatBlocks를 재사용한다.
                // 보고서 본문에는 도구줄을 추가하지 않는다.
                if (chat) {
                    // Start: 261020 수정 - 채팅 표 좌우 테두리 중복 제거
                    // 좌우 외곽선은 .chat-block에서만 표시하고 내부 셀 구분선은 유지한다.
                    table.style.borderLeft = "0";
                    table.style.borderRight = "0";
                    rows.forEach((row) => {
                        if (row.cells.length) {
                            row.cells[0].style.borderLeft = "0";
                            row.cells[row.cells.length - 1].style.borderRight = "0";
                        }
                    });
                    // End: 261020 수정 - 채팅 표 좌우 테두리 중복 제거
                    const scroll = table.parentElement;
                    const block = scroll.parentElement;
                    const bar = block.querySelector(".chat-block-bar");
                    const button = bar.querySelector(".chat-block-copy");
                    Object.assign(block.style, {
                        margin: "12px 0 10px",
                        maxWidth: "100%",
                        minWidth: "0",
                        border: "1px solid #d9dee7",
                        borderRadius: "10px",
                        background: "var(--surface, #fff)",
                        overflow: "hidden",
                    });
                    Object.assign(bar.style, {
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "flex-end",
                        minHeight: "34px",
                        padding: "2px 8px",
                    });
                    Object.assign(button.style, {
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "30px",
                        height: "30px",
                        padding: "0",
                        border: "0",
                        borderRadius: "6px",
                        cursor: "pointer",
                    });
                    Object.assign(button.querySelector("svg").style, {
                        width: "16px",
                        height: "16px",
                        fill: "none",
                        stroke: "currentColor",
                        strokeWidth: "2",
                        strokeLinecap: "round",
                        strokeLinejoin: "round",
                    });
                    Object.assign(scroll.style, {
                        width: "100%",
                        maxWidth: "100%",
                        overflowX: "auto",
                        overflowY: "hidden",
                        margin: "0",
                    });
                    return;
                }
                // End: 261020 추가 - 채팅 표 복사 행·버튼 스타일
                if (table.parentElement?.classList.contains("report-table-scroll")) return;
                const wrapper = document.createElement("div");
                wrapper.className = "report-table-scroll";
                wrapper.style.width = "100%";
                wrapper.style.maxWidth = "100%";
                wrapper.style.overflowX = "auto";
                wrapper.style.overflowY = "hidden";
                wrapper.style.margin = "12px 0";
                table.parentNode.insertBefore(wrapper, table);
                wrapper.appendChild(table);
            });
        }

        // End: 261020 수정 - 보고서·채팅 표 스타일 및 복사 행 연결

        const showToast = (...args) => featureRuntime.showToast(...args);
        const isConversationPending = (...args) => featureRuntime.isConversationPending(...args);
        const syncBusyForActiveConversation = (...args) => featureRuntime.syncBusyForActiveConversation(...args);
        const isWorkspaceSelectionActive = (...args) => featureRuntime.isWorkspaceSelectionActive(...args);
        const getScaledAnswerDefaultPanelLayout = (...args) => featureRuntime.getScaledAnswerDefaultPanelLayout(...args);
        const applyAnswerPanelLayout = (...args) => featureRuntime.applyAnswerPanelLayout(...args);
        const resetAnswerPanelLayout = (...args) => featureRuntime.resetAnswerPanelLayout(...args);
        const initAnswerPanelDragDrop = (...args) => featureRuntime.initAnswerPanelDragDrop(...args);
        const initAnswerAccessoryTools = (...args) => featureRuntime.initAnswerAccessoryTools(...args);
        const applyRecommendZoom = (...args) => featureRuntime.applyRecommendZoom(...args);

        Object.defineProperties(featureRuntime, {
            ANSWER_PANEL_LAYOUT_COOKIE: {
                get: () => ANSWER_PANEL_LAYOUT_COOKIE,
                set: (value) => {
                    ANSWER_PANEL_LAYOUT_COOKIE = value;
                },
                configurable: true,
            },
            ANSWER_SOURCE_PANEL_WIDTH_SCALE: {
                get: () => ANSWER_SOURCE_PANEL_WIDTH_SCALE,
                set: (value) => {
                    ANSWER_SOURCE_PANEL_WIDTH_SCALE = value;
                },
                configurable: true,
            },
            ANSWER_UI_COOKIE_MAX_AGE: {
                get: () => ANSWER_UI_COOKIE_MAX_AGE,
                set: (value) => {
                    ANSWER_UI_COOKIE_MAX_AGE = value;
                },
                configurable: true,
            },
            ANSWER_UI_FONT_COOKIE: {
                get: () => ANSWER_UI_FONT_COOKIE,
                set: (value) => {
                    ANSWER_UI_FONT_COOKIE = value;
                },
                configurable: true,
            },
            PAGE_SIZE: {
                get: () => PAGE_SIZE,
                set: (value) => {
                    PAGE_SIZE = value;
                },
                configurable: true,
            },
            answerDefaultPanelLayout: {
                get: () => answerDefaultPanelLayout,
                set: (value) => {
                    answerDefaultPanelLayout = value;
                },
                configurable: true,
            },
            answerPanelLayoutController: {
                get: () => answerPanelLayoutController,
                set: (value) => {
                    answerPanelLayoutController = value;
                },
                configurable: true,
            },
            completedConversationIds: {
                get: () => completedConversationIds,
                set: (value) => {
                    completedConversationIds = value;
                },
                configurable: true,
            },
            customConfirm: {
                get: () => customConfirm,
                set: (value) => {
                    customConfirm = value;
                },
                configurable: true,
            },
            el: {
                get: () => el,
                set: (value) => {
                    el = value;
                },
                configurable: true,
            },
            entryParams: {
                get: () => entryParams,
                set: (value) => {
                    entryParams = value;
                },
                configurable: true,
            },
            escapeHtml: {
                get: () => escapeHtml,
                set: (value) => {
                    escapeHtml = value;
                },
                configurable: true,
            },
            featureInstallers: {
                get: () => featureInstallers,
                set: (value) => {
                    featureInstallers = value;
                },
                configurable: true,
            },
            featureRuntime: {
                get: () => featureRuntime,
                set: (value) => {
                    featureRuntime = value;
                },
                configurable: true,
            },
            historyConversationId: {
                get: () => historyConversationId,
                set: (value) => {
                    historyConversationId = value;
                },
                configurable: true,
            },
            isNewChatEntry: {
                get: () => isNewChatEntry,
                set: (value) => {
                    isNewChatEntry = value;
                },
                configurable: true,
            },
            listResponse: {
                get: () => listResponse,
                set: (value) => {
                    listResponse = value;
                },
                configurable: true,
            },
            nestedValue: {
                get: () => nestedValue,
                set: (value) => {
                    nestedValue = value;
                },
                configurable: true,
            },
            parseMarkdown: {
                get: () => parseMarkdown,
                set: (value) => {
                    parseMarkdown = value;
                },
                configurable: true,
            },
            pendingConversationIds: {
                get: () => pendingConversationIds,
                set: (value) => {
                    pendingConversationIds = value;
                },
                configurable: true,
            },
            pendingNewWorkspaceEpochs: {
                get: () => pendingNewWorkspaceEpochs,
                set: (value) => {
                    pendingNewWorkspaceEpochs = value;
                },
                configurable: true,
            },
            singleResponse: {
                get: () => singleResponse,
                set: (value) => {
                    singleResponse = value;
                },
                configurable: true,
            },
            sleep: {
                get: () => sleep,
                set: (value) => {
                    sleep = value;
                },
                configurable: true,
            },
            state: {
                get: () => state,
                set: (value) => {
                    state = value;
                },
                configurable: true,
            },
            workspaceCommon: {
                get: () => workspaceCommon,
                set: (value) => {
                    workspaceCommon = value;
                },
                configurable: true,
            },
            workspaceEpoch: {
                get: () => workspaceEpoch,
                set: (value) => {
                    workspaceEpoch = value;
                },
                configurable: true,
            },
        });
        Object.assign(featureRuntime, {
            getChatDateLabel,
            formatChatTime,
            getCurrentTime,
            formatMessageTime,
            getMessageDateKey,
            getMessageDateLabel,
            appendChatDateDivider,
            setTab,
            normalizeChatDisplayText,
            getAssistantChatDisplayText,
            copyChatMessageText,
            applyMessageFeedbackState,
            saveMessageFeedback,
            loadMessageFeedback,
            openMessageFeedbackEditor,
            openCustomerIssueModal,
            attachFeedbackControlsToMessage,
            appendMessage,
            setMessageMarkdown,
            createChatTypingController,
            showSearchSkeleton,
            hideSearchSkeleton,
            updateSearchSkeleton,
            showLoading,
            syncSendButton,
            syncChatInputHeight,
            setBusy,
            getConversationPageInfo,
            requestJson,
            loadConversationList,
            isPinnedConversation,
            setConversationFavorite,
            togglePinnedConversation,
            getConversationById,
            renameConversation,
            getDefaultAnswerWorkspaceTitle,
            getActiveConversationTitle,
            renderAnswerWorkspaceTitle,
            bindAnswerWorkspaceTitleEdit,
            deleteConversation,
            ensureHistorySortOptions,
            requestNextConversationPage,
            ensureConversationInfiniteScroll,
            renderConversationPagination,
            renderConversationHistory,
            selectConversation,
            loadConversationAttachments,
            loadConversationMessages,
            parseSseEvent,
            sendMessageStream,
            ensureConversation,
            recoverLatestAssistantMetadata,
            sendChat,
            getAnswerWelcomeHtml,
            resetWorkspace,
            syncDrawerPositionButton,
            toggleDrawerPosition,
            openDrawer,
            closeDrawer,
            getFileFromResponse,
            getUploadedFileChunkCount,
            getUploadedFileExtension,
            getUploadedFileType,
            getUploadedFileIdentity,
            isUploadedFileSelected,
            renderUploadedFiles,
            uploadFile,
            uploadFiles,
            referenceKey,
            addSelectedReferenceKey,
            clonePrototypeElement,
            createRecommendationTagFromPublicPrototype,
            normalizeRecommendations,
            setRecommendations,
            buildPublicDocMetaBox,
            buildPublicDocSection,
            buildPublicDocPage,
            renderRecommendations,
            renderSelectedReferences,
            getCurrentVisiblePage,
            updateRecommendDocumentStats,
            renderRecommendPdfPages,
            downloadOriginalFile,
            ensurePreviewHwpDownloadControl,
            renderPreview,
            getFileDeleteTarget,
            openFileDeleteModal,
            closeFileDeleteModal,
            confirmFileDelete,
            openReferenceFilePicker,
            activateHistoricalFile,
            selectedDocIdsFromUi,
            wrapDocumentTables,
            showToast,
            isConversationPending,
            syncBusyForActiveConversation,
            isWorkspaceSelectionActive,
            getScaledAnswerDefaultPanelLayout,
            applyAnswerPanelLayout,
            resetAnswerPanelLayout,
            initAnswerPanelDragDrop,
            initAnswerAccessoryTools,
            applyRecommendZoom,
        });

        configure(featureRuntime);

        Object.values(featureInstallers).forEach((install) => {
            if (typeof install === "function") install(featureRuntime);
        });

        installPage(featureRuntime);
        bindPage(featureRuntime);

        // 검증 파일·이력을 별도로 관리하는 화면은 채팅만 연결한다.
        if (config.chatOnly) {
            // Start: 261026 수정 - 분석 제목 편집기 연결
            bindAnswerWorkspaceTitleEdit();
            // End: 261026 수정 - 분석 제목 편집기 연결
            window.AIOnePanel.bindChatInput({
                input: el.chatInput,
                button: el.sendBtn,
                form: el.chatInput.closest("form"),
                onSend: () => sendChat(),
                onInput: syncSendButton,
            });
            el.newChatBtn?.addEventListener("click", resetWorkspace);
            initAnswerPanelDragDrop();
            window.AIOnePanel.initShell({ accessory: false });
            initAnswerAccessoryTools();
            syncChatInputHeight();
            syncSendButton();
            return;
        }

        el.selectedReferenceList.addEventListener("click", (event) => {
            const selectedFileUnselect = event.target.closest("[data-selected-file-unselect]");
            if (selectedFileUnselect) {
                event.preventDefault();
                event.stopPropagation();
                const index = Number(selectedFileUnselect.dataset.selectedFileUnselect);
                const file = Number.isInteger(index) ? state.uploadedFiles[index] : null;
                if (!file) return;
                const identity = getUploadedFileIdentity(file);
                state.uploadedFiles = state.uploadedFiles.filter((item) => getUploadedFileIdentity(item) !== identity);
                renderUploadedFiles();
                showToast("이번 질문의 첨부 선택을 해제했습니다.");
                return;
            }
            const button = event.target.closest("[data-selected-remove]");
            if (!button) return;
            state.selectedReferenceKeys.delete(button.dataset.selectedRemove);
            renderSelectedReferences();
            renderRecommendations();
            featureRuntime.page.onSelectionChanged?.();
        });
        // 퍼블 컴포넌트가 click을 가로채더라도 먼저 실행되도록 capture 단계에서 처리한다.
        el.fileButton.addEventListener("click", openReferenceFilePicker, true);
        el.fileButton.addEventListener("keydown", (event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            openReferenceFilePicker(event);
        });
        // input 자체 클릭이 부모 upload-zone 클릭으로 재귀하지 않도록 차단한다.
        el.fileInput.addEventListener("click", (event) => {
            event.stopPropagation();
        });
        el.fileInput.addEventListener("change", async (event) => {
            event.stopPropagation();
            const selectedFiles = Array.from(event.target.files || []);
            if (!selectedFiles.length) return;
            await uploadFiles(selectedFiles);
        });
        // 퍼블 FileUpload 컴포넌트가 활성화된 환경에서는 이 이벤트로도 파일이 넘어온다.
        el.fileButton.addEventListener("app:file-upload", async (event) => {
            event.stopPropagation();
            const incoming = Array.from(event.detail?.files || []);
            if (!incoming.length) return;
            // 같은 사용자 동작에서 native change + app:file-upload가 모두 오는 경우 중복 방지
            const signature = incoming.map((file) => [file.name, file.size, file.lastModified].join(":")).join("|");
            const now = Date.now();
            if (el.fileButton.dataset.lastUploadSignature === signature && now - Number(el.fileButton.dataset.lastUploadAt || 0) < 800) {
                return;
            }
            el.fileButton.dataset.lastUploadSignature = signature;
            el.fileButton.dataset.lastUploadAt = String(now);
            await uploadFiles(incoming);
        });
        ["dragenter", "dragover"].forEach((type) => {
            el.fileButton.addEventListener(type, (event) => {
                event.preventDefault();
                event.stopPropagation();
                if (!state.uploading && !state.sending) {
                    el.fileButton.classList.add("is-dragover");
                }
            });
        });
        ["dragleave", "drop"].forEach((type) => {
            el.fileButton.addEventListener(type, (event) => {
                event.preventDefault();
                event.stopPropagation();
                el.fileButton.classList.remove("is-dragover");
            });
        });
        el.fileButton.addEventListener("drop", async (event) => {
            if (state.uploading || state.sending) return;
            const dropped = Array.from(event.dataTransfer?.files || []);
            if (!dropped.length) return;
            await uploadFiles(dropped);
        });

        el.fileList.addEventListener("click", (event) => {
            const historyRemove = event.target.closest("[data-file-history-remove]");
            if (historyRemove) {
                event.preventDefault();
                event.stopPropagation();
                const index = Number(historyRemove.dataset.fileHistoryRemove);
                if (!Number.isInteger(index) || !state.conversationFiles[index]) return;
                openFileDeleteModal(index, "history");
                return;
            }
            const remove = event.target.closest("[data-file-remove]");
            if (remove) {
                event.preventDefault();
                event.stopPropagation();
                const index = Number(remove.dataset.fileRemove);
                if (!Number.isInteger(index) || !state.uploadedFiles[index]) return;
                openFileDeleteModal(index, "pending");
                return;
            }
            const historyItem = event.target.closest("[data-file-history='true']");
            if (!historyItem) return;
            event.preventDefault();
            activateHistoricalFile(historyItem);
        });
        el.fileList.addEventListener("keydown", (event) => {
            if (event.target.closest("button")) return;
            if (event.key !== "Enter" && event.key !== " ") return;
            const historyItem = event.target.closest("[data-file-history='true']");
            if (!historyItem) return;
            event.preventDefault();
            activateHistoricalFile(historyItem);
        });
        // Start: 261014 추가 - 파일·검색결과 삭제 모달 이벤트
        // 파일/검색 삭제 모달은 기존 닫기·확인 함수를 함께 사용한다.
        document.querySelectorAll("#answerSourceFileDeleteModal, #answerSourceSearchDeleteModal").forEach((modal) => {
            modal.addEventListener("click", (event) => {
                if (event.target.closest("[data-file-delete-close]")) {
                    event.preventDefault();
                    closeFileDeleteModal();
                    return;
                }
                if (event.target.closest("[data-file-delete-confirm]")) {
                    event.preventDefault();
                    confirmFileDelete();
                }
            });
        });
        // End: 261014 추가 - 파일·검색결과 삭제 모달 이벤트
        document.getElementById("sourceCollapseBtn")?.addEventListener("click", (event) => {
            if (event.currentTarget.classList.contains("source-expand")) return;
            if (document.querySelector('.three-panel [data-panel="result"]')) return;
            event.preventDefault();
            const panel = document.querySelector('.three-panel [data-panel="folder"], [data-panel="folder"]');
            if (!panel) return;
            const layout = panel.closest(".three-panel");
            const button = event.currentTarget;
            const collapsing = !panel.classList.contains("panel-collapsed");
            panel.classList.toggle("panel-collapsed", collapsing);
            panel.querySelector(".answer-source-file-section, .file-list-section")?.classList.toggle("is-collapsed", collapsing);
            layout?.classList.toggle("is-source-collapsed", collapsing);
            if (layout) {
                if (collapsing) {
                    // 펼쳐진 상태의 실제 grid 폭을 저장한다.
                    if (!layout.dataset.sourceExpandedGrid) {
                        layout.dataset.sourceExpandedGrid = layout.style.gridTemplateColumns || window.getComputedStyle(layout).gridTemplateColumns || "";
                    }
                    const directPanels = Array.from(layout.children).filter((child) => child.matches?.(".panel[data-panel], .panel[data-slot]"));
                    const tracks = [];
                    Array.from(layout.children).forEach((child) => {
                        if (child === panel) {
                            tracks.push("44px");
                            return;
                        }
                        if (child.matches?.(".panel-resize-handle, [data-component='split-handler']")) {
                            const width = Math.max(1, Math.round(child.getBoundingClientRect().width || 2));
                            tracks.push(width + "px");
                            return;
                        }
                        if (child.matches?.(".panel[data-panel], .panel[data-slot]")) {
                            const slot = child.dataset.panel || child.dataset.slot || "";
                            // 가운데 관련자료/답변서 영역은 남는 폭을 전부 사용
                            if (slot === "center") {
                                tracks.push("minmax(0, 1fr)");
                            } else {
                                // AI 채팅 등 다른 고정 패널은 현재 폭 유지
                                const width = Math.max(180, Math.round(child.getBoundingClientRect().width || 320));
                                tracks.push(width + "px");
                            }
                            return;
                        }
                        // 예상치 못한 direct child가 있으면 현재 폭 유지
                        const width = Math.max(1, Math.round(child.getBoundingClientRect().width || 1));
                        tracks.push(width + "px");
                    });
                    if (tracks.length) {
                        layout.style.gridTemplateColumns = tracks.join(" ");
                    }
                    panel.style.removeProperty("width");
                    panel.style.removeProperty("flex-basis");
                } else {
                    // 접기 전 grid 상태로 복원
                    const restoreGrid = layout.dataset.sourceExpandedGrid || "";
                    if (restoreGrid) {
                        layout.style.gridTemplateColumns = restoreGrid;
                    } else {
                        layout.style.removeProperty("grid-template-columns");
                    }
                    delete layout.dataset.sourceExpandedGrid;
                    panel.style.removeProperty("width");
                    panel.style.removeProperty("flex-basis");
                    // 공통 SplitHandler가 있으면 복원 후 다시 동기화
                    window.AIOneSplitHandler?.init?.(layout);
                }
            }
            const label = collapsing ? "참조소스 패널 펼치기" : "참조소스 패널 접기";
            button.setAttribute("aria-expanded", String(!collapsing));
            button.setAttribute("aria-label", label);
            button.title = label;
        });
        // 퍼블 접힘 상태의 + 버튼에서도 파일 선택창을 연다.
        document.querySelector("[data-source-file-add]")?.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (state.uploading || state.sending) return;
            if (el.fileInput) {
                // 같은 파일을 다시 선택해도 change 이벤트가 발생하도록 초기화
                el.fileInput.value = "";
                el.fileInput.click();
            }
        });
        el.fileReset?.addEventListener("click", (event) => {
            event.preventDefault();
            // 초기화 버튼은 "업로드한 파일"만 비운다.
            state.uploadedFiles = [];
            if (el.fileInput) el.fileInput.value = "";
            renderUploadedFiles();
            showToast("업로드 파일을 초기화했습니다.");
        });
        window.AIOnePanel.bindChatInput({ input: el.chatInput, button: el.sendBtn, onSend: () => sendChat(), onInput: syncSendButton });
        el.newChatBtn.addEventListener("click", () => {
            resetWorkspace({ advanceTitleNumber: true });
            // Start: 261021 수정 - 업무지원 새 작업 생성결과 초기화
            featureRuntime.page.onNewWorkspace?.();
            // End: 261021 수정 - 업무지원 새 작업 생성결과 초기화
            featureRuntime.page.showNotice?.();
        });
        el.historyBtn?.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            openDrawer();
        });
        document.addEventListener("click", (event) => {
            const historyTrigger = event.target.closest("#draftHistoryBtn");
            if (!historyTrigger || historyTrigger === el.historyBtn) return;
            event.preventDefault();
            openDrawer();
        });
        el.historyDrawer?.addEventListener("click", (event) => {
            const positionButton = event.target.closest("#runDrawerPositionBtn, .drawer-position-button");
            if (positionButton) {
                event.preventDefault();
                event.stopPropagation();
                toggleDrawerPosition();
                return;
            }
            if (event.target.closest("[data-drawer-close]")) closeDrawer();
            const topic = event.target.closest(".chat-topic[data-conversation-id]");
            if (topic) {
                selectConversation(topic.dataset.conversationId);
                closeDrawer();
            }
        });
        window.AIOneConversationDrawer.bindActions({
            drawer: el.historyDrawer,
            onAction: async (detail) => {
                const { conversationId, action } = detail;
                if (action === "rename") {
                    const title = String(detail.title || "").trim();
                    if (!title) return;
                    const saved = await renameConversation(conversationId, title);
                    if (!saved) {
                        await loadConversationList({
                            title: state.conversationSearchTitle,
                            page: state.conversationPage,
                        });
                    }
                    return;
                }
                if (action === "delete") {
                    const deleted = await deleteConversation(conversationId, detail.title);
                    if (!deleted) {
                        await loadConversationList({
                            title: state.conversationSearchTitle,
                            page: state.conversationPage,
                        });
                    }
                    return;
                }
                if (action === "pin") {
                    const favorite = Boolean(detail.pinned);
                    const saved = await setConversationFavorite(conversationId, favorite);
                    if (!saved) {
                        await loadConversationList({
                            title: state.conversationSearchTitle,
                            page: state.conversationPage,
                            favoriteOnly: state.conversationFavoriteOnly,
                        });
                        return;
                    }
                    showToast(favorite ? "대화를 즐겨찾기에 등록했습니다." : "대화 즐겨찾기를 해제했습니다.");
                    if (state.conversationFavoriteOnly && !favorite) {
                        await loadConversationList({
                            title: state.conversationSearchTitle,
                            page: 1,
                            favoriteOnly: true,
                        });
                    }
                    return;
                }
                if (action === "share") {
                    const shareUrl = window.location.origin + window.location.pathname + "?conversationId=" + encodeURIComponent(conversationId);
                    if (navigator.clipboard && window.isSecureContext) {
                        try {
                            await navigator.clipboard.writeText(shareUrl);
                            showToast("대화 링크를 복사했습니다.");
                        } catch (error) {
                            showToast("대화 공유 링크를 복사하지 못했습니다.");
                        }
                    } else {
                        showToast("이 환경에서는 대화 링크 복사를 사용할 수 없습니다.");
                    }
                }
            },
        });
        window.AIOneConversationDrawer.bindControls({
            search: el.historySearch,
            searchButton: el.historySearchBtn,
            searchClear: el.historySearchClear,
            sort: el.historySort,
            sortValue: el.historySort?.value || "latest",
            onSearch: (title) => {
                state.conversationSearchTitle = title;
                loadConversationList({
                    title,
                    page: 1,
                    favoriteOnly: state.conversationFavoriteOnly,
                });
            },
            onClear: () => {
                state.conversationSearchTitle = "";
                state.conversationPage = 1;
                loadConversationList({
                    title: "",
                    page: 1,
                    favoriteOnly: state.conversationFavoriteOnly,
                });
            },
            onSort: () => {
                loadConversationList({
                    title: state.conversationSearchTitle,
                    page: 1,
                    favoriteOnly: false,
                });
            },
        });
        el.recommendZoomOut?.addEventListener("click", () => {
            state.recommendZoom = Math.max(50, state.recommendZoom - 10);
            applyRecommendZoom();
        });
        el.recommendZoomIn?.addEventListener("click", () => {
            state.recommendZoom = Math.min(200, state.recommendZoom + 10);
            applyRecommendZoom();
        });
        el.sourcePreview?.closest(".doc-viewer-body")?.addEventListener("scroll", updateRecommendDocumentStats);
        document.addEventListener("keydown", (event) => {
            if (event.key !== "Escape") return;
            if (el.historyDrawer.getAttribute("aria-hidden") === "false") closeDrawer();
        });
        document.addEventListener("keydown", (event) => {
            if (event.key !== "Escape") return;
            closeFileDeleteModal();
            featureRuntime.page.closeNotice?.();
        });
        // 초기화
        window.AIOneIcons?.hydrate(document);
        initAnswerPanelDragDrop();
        window.AIOnePanel.initShell({ collapse: false, accessory: false });
        initAnswerAccessoryTools();
        renderUploadedFiles();
        renderRecommendations();
        renderSelectedReferences();
        renderPreview();
        applyRecommendZoom();
        updateRecommendDocumentStats();
        featureRuntime.page.render?.();
        syncChatInputHeight();
        syncSendButton();
        setTab("recommend");
        appendMessage("ai", getAnswerWelcomeHtml(), undefined, undefined, { rawHtml: true });
        const entryParams = new URLSearchParams(window.location.search);
        const historyConversationId = String(entryParams.get("conversationId") || "").trim();
        const isPagePreview = window.AIOnePreview?.enabled && config.newWorkspaceInPreview === true;
        const isNewChatEntry = entryParams.get("newChat") === "Y" || isPagePreview;
        // 진입 안내의 표시 여부와 내용은 각 페이지에서 결정한다.
        featureRuntime.page.showNotice?.();
        if (historyConversationId) {
            // 최근 사용 이력에서 들어온 경우에만 지정된 기존 대화방을 연다.
            loadConversationList({ openLatest: false, page: 1, title: "" })
                .then(() => selectConversation(historyConversationId))
                .then(() => featureRuntime.initializeSourceSearch())
                .catch((error) => console.error("[최근 사용 이력] 답변서 대화 이동 실패", error));
        } else if (isNewChatEntry) {
            // 홈 서비스 카드/사이드바 진입: 최신 대화를 자동 선택하지 않고 빈 새 채팅을 유지한다.
            resetWorkspace();
            loadConversationList({ openLatest: false, page: 1, title: "" }).then(() => featureRuntime.initializeSourceSearch());
        } else {
            loadConversationList({ openLatest: true, page: 1, title: "" }).then(() => featureRuntime.initializeSourceSearch());
        }
        bindAnswerWorkspaceTitleEdit();
    },
};
