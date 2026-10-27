/**
 * AI-ONE 보고서/답변서 진입점
 *
 * 역할
 * - 페이지 공용 상태와 DOM 참조를 관리한다.
 * - 보고서 기능 모듈을 조립하고 초기화 순서를 제어한다.
 * - 공통 이벤트를 연결하고 최초 화면 상태를 구성한다.
 *
 * 기능별 상세 로직은 draft-*.js 모듈에서 담당한다.
 *
 * 기본 구간 형식: Start: 기능명 / End: 기능명
 * 변경 구간 형식: Start: YYMMDD 추가/수정 - 기능명 / End: YYMMDD 추가/수정 - 기능명
 * 주석 정리 내역
 * - 261023 주석 정리 - 구간 표시와 변경 내용 표기를 통일합니다. 기존 작업 날짜와 기능 설명은 유지합니다.
 */
(function initAnswerWorkspace(document, common) {
  "use strict";
  const featureRuntime = Object.create(null);
  const featureInstallers = window.AIOneAnswerFeatureModules || {};
  const workspaceCommon = window.AIOneWorkspaceCommon;
  if (!workspaceCommon) {
    throw new Error("common.js의 AIOneWorkspaceCommon이 먼저 로드되어야 합니다.");
  }
  // 퍼블 ai-answer.js의 data-icon hydration을 서버 경로에 맞게 이식


  const customConfirm = common?.customConfirm || function (title, message, onConfirm) {
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
    // v1.5 No.16/17: 보고서에 저장된 선택 문서 ID.
    reportSelectedDocIds: new Set(),
    recommendationItems: [],
    references: [],
    selectedReferenceKeys: new Set(),
    activeReferenceKey: "",
    reportId: "",
    reportTitle: "",
    reportVersion: 0,
    reportContent: "",
    reportVersions: [],
    dismissedVersions: new Set(),
    editPreservedMarkers: "",
    zoom: 100,
    recommendZoom: 100,
    recommendPdf: null,
    recommendPdfRenderSeq: 0,
    sending: false,
    uploading: false,
    conversationActionId: "",
    pendingFileDeleteIndex: -1,
    // 삭제 대상 구분: pending(이번 턴 첨부) / history(첨부 완료 이력)
    pendingFileDeleteSource: "",
    openingFilePicker: false,
    pendingRenameConversationId: "",
    pendingDeleteConversationId: "",
    compareSelectedSourceKey: "",
    compareSelectedVersion: 0,
    comparePanelsSwapped: false,
    compareScrollSync: true,
    compareRenderSeq: 0,
    // 답변서 초안 탭 표시 모드: single(단일 보기) / compare(버전 비교)
    draftDisplayMode: "single",
    draftCompareLeftVersion: 0,
    draftCompareRightVersion: 0,
    draftCompareScrollSync: true,
    draftCompareRenderSeq: 0,
    draftCompareZoom: 100,
    actionModalTrigger: null
  };
  const pendingConversationIds = new Set();
  // 작업 완료 알림은 공통 Manage 메뉴가 아니라 실제 작업이 끝난 대화방에 표시한다.
  const completedConversationIds = new Set();
  const pendingNewWorkspaceEpochs = new Set();
  let workspaceEpoch = 0;


  // 비동기 대화 조회가 늦게 끝나더라도 다른 대화 화면을 덮어쓰지 않게 한다.

  const PAGE_SIZE = window.AIOneConversationDrawer.PAGE_SIZE;
  const el = {
    chatBody: document.getElementById("chatBody"),
    chatInput: document.getElementById("chatInput"),
    sendBtn: document.getElementById("sendBtn"),
    newChatBtn: document.getElementById("newChatBtn"),
    fileButton: document.getElementById("referenceFileButton"),
    fileInput: document.getElementById("referenceFileInput"),
    fileList: document.getElementById("referenceFileList"),
    fileCount: document.getElementById("sourceFileCount"),
    fileReset: document.getElementById("sourceResetBtn"),
    chatFileChips: document.getElementById("chatFileChips"),
    recommendList: document.getElementById("recommendationList"),
    recommendEmpty: document.getElementById("recommendationEmpty"),
    recommendCount: document.getElementById("recommendTabCount"),
    recommendFooterCount: document.getElementById("recommendFooterCount"),
    filterAllCount: document.getElementById("filterAllCount"),
    filterHistoryCount: document.getElementById("filterHistoryCount"),
    filterEvidenceCount: document.getElementById("filterEvidenceCount"),
    selectAllReferences: document.getElementById("selectAllReferences"),
    selectedReferenceList: document.getElementById("selectedReferenceList"),
    selectedReferenceCount: document.getElementById("selectedReferenceCount"),
    selectedReferenceEmpty: document.getElementById("selectedReferenceEmpty"),
    selectedReferenceFooter: document.getElementById("selectedReferenceFooter"),
    applyReferencesMessage: document.getElementById("applyReferencesMessage"),
    applyReferencesBtn: document.getElementById("applyReferencesBtn"),
    sourcePreview: document.getElementById("sourcePreview"),
    previewScore: document.getElementById("previewScore"),
    reportTitle: document.getElementById("reportTitle"),
    reportVersionBadge: document.getElementById("reportVersionBadge"),
    reportVersionSelect: document.getElementById("reportVersionSelect"),
    reportRestoreBtn: document.getElementById("reportRestoreBtn"),
    reportEditBtn: document.getElementById("reportEditBtn"),
    draftDownloadBtn: document.getElementById("draftDownloadBtn"),
    reportDownloadMenu: document.getElementById("reportDownloadMenu"),
    reportDownloadWrap: document.getElementById("reportDownloadWrap"),
    draftDownloadConfirmModal: document.getElementById("draftDownloadConfirmModal"),
    draftDownloadConfirmFormat: document.getElementById("draftDownloadConfirmFormat"),
    draftDownloadConfirmBtn: document.getElementById("draftDownloadConfirmBtn"),
    draftPaper: document.getElementById("draftPaper"),
    draftScroll: document.getElementById("draftScroll"),
    draftCharCount: document.getElementById("draftCharCount"),
    draftPageCurrent: document.getElementById("draftPageCurrent"),
    draftPageTotal: document.getElementById("draftPageTotal"),
    recommendCharCount: document.getElementById("recommendCharCount"),
    recommendPageCurrent: document.getElementById("recommendPageCurrent"),
    recommendPageTotal: document.getElementById("recommendPageTotal"),
    recommendZoomOut: document.getElementById("recommendZoomOut"),
    recommendZoomIn: document.getElementById("recommendZoomIn"),
    recommendZoomPercent: document.getElementById("recommendZoomPercent"),
    recommendFullscreenBtn: document.getElementById("recommendFullscreenBtn"),
    zoomPercent: document.getElementById("zoomPercent"),
    zoomOut: document.getElementById("zoomOut"),
    zoomIn: document.getElementById("zoomIn"),
    fitBtn: document.getElementById("fitBtn"),
    draftTabCount: document.getElementById("draftTabCount"),
    compareTabCount: document.getElementById("compareTabCount"),
    comparePanel: document.getElementById("answerPanelCompare"),
    compareEmpty: document.getElementById("answerCompareEmpty"),
    compareView: document.getElementById("answerCompareView"),
    compareReferenceSelect: document.getElementById("compareReferenceSelect"),
    compareDraftVersionSelect: document.getElementById("compareDraftVersionSelect"),
    compareDocumentSwap: document.getElementById("compareDocumentSwap"),
    compareScrollSync: document.getElementById("compareScrollSync"),
    compareSelectionNote: document.getElementById("compareSelectionNote"),
    compareGrid: document.getElementById("answerCompareGrid"),
    compareBasePanel: document.getElementById("compareBasePanel"),
    compareBaseBody: document.getElementById("compareBaseBody"),
    compareBaseTitle: document.getElementById("compareBaseTitle"),
    compareBaseBadge: document.getElementById("compareBaseBadge"),
    compareDraftPanel: document.getElementById("compareDraftPanel"),
    compareDraftBody: document.getElementById("compareDraftBody"),
    compareDraftTitle: document.getElementById("compareDraftTitle"),
    compareDraftBadge: document.getElementById("compareDraftBadge"),
    versionChips: document.getElementById("reportVersionChips"),
    evidenceBody: document.getElementById("draftEvidenceBody"),
    evidencePanel: document.getElementById("draftEvidencePanel"),
    evidenceClose: document.getElementById("draftEvidenceClose"),
    evidenceSubtitle: document.getElementById("draftEvidenceSubtitle"),
    evidenceStatus: document.getElementById("draftEvidenceStatus"),
    evidenceSentence: document.getElementById("draftEvidenceSentence"),
    evidenceSentenceNumber: document.getElementById("draftEvidenceSentenceNumber"),
    evidenceReferenceList: document.getElementById("draftEvidenceReferenceList"),
    searchSkeleton: document.getElementById("answerSearchSkeleton"),
    searchSkeletonText: document.getElementById("answerSearchSkeletonText"),
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
    editBackdrop: document.getElementById("reportEditModalBackdrop"),
    editContent: document.getElementById("reportEditContent"),
    editClose: document.getElementById("reportEditModalClose"),
    editCancel: document.getElementById("reportEditCancel"),
    editSave: document.getElementById("reportEditSave")
  };
  if (!el.chatBody || !el.chatInput || !el.sendBtn) return;

  // ─── 보조도구 모음 ───
  const ANSWER_UI_FONT_COOKIE = 'ai_one_answer_font_percent';
  const ANSWER_UI_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

  // ─── Panel Layout / Drag & Drop ───
  // 질의분류와 동일하게 패널 헤더를 드래그해서 좌/중/우 배치를 서로 교환한다.
  // AI 참조소스(folder) 패널의 기본 폭을 기존 렌더링 폭의 정확히 1.3배로 사용한다.
  const ANSWER_SOURCE_PANEL_WIDTH_SCALE = 1.3;
  // 1.5배 기본 폭(v3)에 저장된 값이 새 기본값을 덮지 않도록 쿠키 버전을 올린다.
  const ANSWER_PANEL_LAYOUT_COOKIE = 'ai_one_answer_panel_layout_v4';
  let answerDefaultPanelLayout = null;
  const answerPanelLayoutController = window.AIOneWorkspaceUi.createPanelLayoutController({
    cookieKey: ANSWER_PANEL_LAYOUT_COOKIE,
    cookieMaxAge: ANSWER_UI_COOKIE_MAX_AGE,
    includeSlot: true,
    getState: (container) => window.AIOneWorkspaceUi.getLayoutState(container, { includeSlot: true }),
    applyState: (container, state) => applyAnswerPanelLayout(container, state),
    onRestoreError: (error) => console.warn('답변서 패널 배치 복원 실패', error)
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
      const sanitized = window.DOMPurify
        ? window.DOMPurify.sanitize(html)
        : html;
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





























  // 퍼블과 동일한 파일 타입별 색상 클래스







  // 같은 원본 문서가 과거답변서/참조소스 양쪽에 동시에 존재해도
  // 선택자료 영역에는 doc_id 기준으로 하나만 유지한다.

  // ===== 퍼블 UI 렌더링 어댑터 시작 =====






  // ===== 퍼블 UI 렌더링 어댑터 끝 =====


















  let compareScrollLock = false;







































  let selectedSourcesSaveTimer = 0;


  // 선택한 버전에 유사답변서가 없을 때 사용할 최신 유사답변서만 찾는다.
  // references는 선택한 답변서 버전에 종속되므로 다른 버전에서 가져오지 않는다.

  // 보고서 조회가 겹쳐도 가장 마지막 요청만 화면 상태를 변경한다.
  let reportDetailRequestSeq = 0;


  // 현재 응답에 새 보고서가 없을 때는 본문만 비운다.
  // 기존 보고서 ID / 버전 목록 / 상단 버전 칩 / selectbox는 그대로 유지한다.


  // 버전 등록 시각 조회 - 날짜는 제외하고 HH:mm:ss만 표시

  // 버전 레이블(v1.0(09:18) 형태) 칩 렌더링













  // ============================ 답변서 초안 버전 비교 ============================
  // 퍼블 ai-answer-after의 "버전 비교 ↔ 단일 보기" 동작을 서버 reportVersions 구조에 맞게 이식한다.
















  /**
   * 보고서 버전 복원
   * 현재 보고서의 전체 버전을 모달에서 선택하고, 선택한 버전의 본문을
   * ND_reportVersion.do로 다시 저장하여 최신 버전 + 1을 생성한다.
   */








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
  const isNewChatNoticeHiddenForToday = (...args) => featureRuntime.isNewChatNoticeHiddenForToday(...args);
  const hideNewChatNoticeForOneDay = (...args) => featureRuntime.hideNewChatNoticeForOneDay(...args);
  const closeNewChatNoticeModal = (...args) => featureRuntime.closeNewChatNoticeModal(...args);
  const showNewChatNoticeModal = (...args) => featureRuntime.showNewChatNoticeModal(...args);
  const getAnswerWelcomeHtml = (...args) => featureRuntime.getAnswerWelcomeHtml(...args);
  const resetWorkspace = (...args) => featureRuntime.resetWorkspace(...args);
  const syncDrawerPositionButton = (...args) => featureRuntime.syncDrawerPositionButton(...args);
  const toggleDrawerPosition = (...args) => featureRuntime.toggleDrawerPosition(...args);
  const openDrawer = (...args) => featureRuntime.openDrawer(...args);
  const closeDrawer = (...args) => featureRuntime.closeDrawer(...args);
  const openEditModal = (...args) => featureRuntime.openEditModal(...args);
  const closeEditModal = (...args) => featureRuntime.closeEditModal(...args);
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
  const createFallbackRecommendationCard = (...args) => featureRuntime.createFallbackRecommendationCard(...args);
  const createRecommendationCardFromPublicPrototype = (...args) => featureRuntime.createRecommendationCardFromPublicPrototype(...args);
  const createRecommendationTagFromPublicPrototype = (...args) => featureRuntime.createRecommendationTagFromPublicPrototype(...args);
  const syncRecommendationCardPublic = (...args) => featureRuntime.syncRecommendationCardPublic(...args);
  const bindDynamicRecommendationCard = (...args) => featureRuntime.bindDynamicRecommendationCard(...args);
  const normalizeRecommendations = (...args) => featureRuntime.normalizeRecommendations(...args);
  const setRecommendations = (...args) => featureRuntime.setRecommendations(...args);
  const getVisibleRecommendationItems = (...args) => featureRuntime.getVisibleRecommendationItems(...args);
  const createPublicRecommendationCardPrototype = (...args) => featureRuntime.createPublicRecommendationCardPrototype(...args);
  const clonePublicRecommendationCard = (...args) => featureRuntime.clonePublicRecommendationCard(...args);
  const createPublicRecommendationTag = (...args) => featureRuntime.createPublicRecommendationTag(...args);
  const syncPublicRecommendationTags = (...args) => featureRuntime.syncPublicRecommendationTags(...args);
  const syncPublicRecommendationCard = (...args) => featureRuntime.syncPublicRecommendationCard(...args);
  const buildPublicDocMetaBox = (...args) => featureRuntime.buildPublicDocMetaBox(...args);
  const buildPublicDocSection = (...args) => featureRuntime.buildPublicDocSection(...args);
  const buildPublicDocPage = (...args) => featureRuntime.buildPublicDocPage(...args);
  const renderRecommendations = (...args) => featureRuntime.renderRecommendations(...args);
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
  const reportItems = (...args) => featureRuntime.reportItems(...args);
  const loadConversationReports = (...args) => featureRuntime.loadConversationReports(...args);
  const getVersionList = (...args) => featureRuntime.getVersionList(...args);
  const selectedDocIdsFromUi = (...args) => featureRuntime.selectedDocIdsFromUi(...args);
  const applySavedDocIdsToSelection = (...args) => featureRuntime.applySavedDocIdsToSelection(...args);
  const loadReportSelectedSources = (...args) => featureRuntime.loadReportSelectedSources(...args);
  const saveReportSelectedSources = (...args) => featureRuntime.saveReportSelectedSources(...args);
  const scheduleSelectedSourcesSave = (...args) => featureRuntime.scheduleSelectedSourcesSave(...args);
  const loadReportVersionContext = (...args) => featureRuntime.loadReportVersionContext(...args);
  const loadLatestReportRecommendationContext = (...args) => featureRuntime.loadLatestReportRecommendationContext(...args);
  const loadReportDetail = (...args) => featureRuntime.loadReportDetail(...args);
  const clearReport = (...args) => featureRuntime.clearReport(...args);
  const clearReportContentOnly = (...args) => featureRuntime.clearReportContentOnly(...args);
  const normalizeVersionNumbers = (...args) => featureRuntime.normalizeVersionNumbers(...args);
  const getVersionTime = (...args) => featureRuntime.getVersionTime(...args);
  const renderVersionChips = (...args) => featureRuntime.renderVersionChips(...args);
  const cleanEvidenceSentenceText = (...args) => featureRuntime.cleanEvidenceSentenceText(...args);
  const getEvidenceSentenceText = (...args) => featureRuntime.getEvidenceSentenceText(...args);
  const getReferenceByMarker = (...args) => featureRuntime.getReferenceByMarker(...args);
  const renderDraftEvidence = (...args) => featureRuntime.renderDraftEvidence(...args);
  const createDraftEvidenceSplitHandle = (...args) => featureRuntime.createDraftEvidenceSplitHandle(...args);
  const openDraftEvidence = (...args) => featureRuntime.openDraftEvidence(...args);
  const closeDraftEvidence = (...args) => featureRuntime.closeDraftEvidence(...args);
  const decorateDraftReferenceMarkers = (...args) => featureRuntime.decorateDraftReferenceMarkers(...args);
  const getDraftPlainText = (...args) => featureRuntime.getDraftPlainText(...args);
  const getDraftPageMetrics = (...args) => featureRuntime.getDraftPageMetrics(...args);
  const updateDraftDocumentStats = (...args) => featureRuntime.updateDraftDocumentStats(...args);
  const wrapReportTables = (...args) => featureRuntime.wrapReportTables(...args);
  const renderReport = (...args) => featureRuntime.renderReport(...args);
  const extractReportMarkers = (...args) => featureRuntime.extractReportMarkers(...args);
  const getEditableReportHtml = (...args) => featureRuntime.getEditableReportHtml(...args);
  const clearCurrentAnswerResult = (...args) => featureRuntime.clearCurrentAnswerResult(...args);
  const saveReportVersion = (...args) => featureRuntime.saveReportVersion(...args);
  const openRestoreVersionModal = (...args) => featureRuntime.openRestoreVersionModal(...args);
  const restoreReportVersion = (...args) => featureRuntime.restoreReportVersion(...args);
  const downloadDraft = (...args) => featureRuntime.downloadDraft(...args);
  const openDraftDownloadConfirm = (...args) => featureRuntime.openDraftDownloadConfirm(...args);
  const getCompareSimilarSources = (...args) => featureRuntime.getCompareSimilarSources(...args);
  const getCompareVersionNumbers = (...args) => featureRuntime.getCompareVersionNumbers(...args);
  const getCompareSourceContent = (...args) => featureRuntime.getCompareSourceContent(...args);
  const buildCompareSourcePages = (...args) => featureRuntime.buildCompareSourcePages(...args);
  const buildCompareDraftPages = (...args) => featureRuntime.buildCompareDraftPages(...args);
  const loadCompareReportVersion = (...args) => featureRuntime.loadCompareReportVersion(...args);
  const syncCompareViewportHeight = (...args) => featureRuntime.syncCompareViewportHeight(...args);
  const syncCompareScroll = (...args) => featureRuntime.syncCompareScroll(...args);
  const renderCompareWorkspace = (...args) => featureRuntime.renderCompareWorkspace(...args);
  const ensureDraftVersionCompareUi = (...args) => featureRuntime.ensureDraftVersionCompareUi(...args);
  const updateDraftVersionCompareToggle = (...args) => featureRuntime.updateDraftVersionCompareToggle(...args);
  const getDraftSingleContentElements = (...args) => featureRuntime.getDraftSingleContentElements(...args);
  const applyDraftDisplayMode = (...args) => featureRuntime.applyDraftDisplayMode(...args);
  const exitDraftVersionCompare = (...args) => featureRuntime.exitDraftVersionCompare(...args);
  const getDraftVersionLabel = (...args) => featureRuntime.getDraftVersionLabel(...args);
  const getDraftVersionNote = (...args) => featureRuntime.getDraftVersionNote(...args);
  const renderDraftVersionCompareWorkspace = (...args) => featureRuntime.renderDraftVersionCompareWorkspace(...args);
  const bindDraftVersionCompareEvents = (...args) => featureRuntime.bindDraftVersionCompareEvents(...args);
  const applyDraftCompareZoom = (...args) => featureRuntime.applyDraftCompareZoom(...args);
  const showToast = (...args) => featureRuntime.showToast(...args);
  const isConversationPending = (...args) => featureRuntime.isConversationPending(...args);
  const syncBusyForActiveConversation = (...args) => featureRuntime.syncBusyForActiveConversation(...args);
  const isWorkspaceSelectionActive = (...args) => featureRuntime.isWorkspaceSelectionActive(...args);
  const getScaledAnswerDefaultPanelLayout = (...args) => featureRuntime.getScaledAnswerDefaultPanelLayout(...args);
  const applyAnswerPanelLayout = (...args) => featureRuntime.applyAnswerPanelLayout(...args);
  const resetAnswerPanelLayout = (...args) => featureRuntime.resetAnswerPanelLayout(...args);
  const initAnswerPanelDragDrop = (...args) => featureRuntime.initAnswerPanelDragDrop(...args);
  const initAnswerAccessoryTools = (...args) => featureRuntime.initAnswerAccessoryTools(...args);
  const syncComparePanelOrder = (...args) => featureRuntime.syncComparePanelOrder(...args);
  const applyRecommendZoom = (...args) => featureRuntime.applyRecommendZoom(...args);
  const applyZoom = (...args) => featureRuntime.applyZoom(...args);


  Object.defineProperties(featureRuntime, {
    ANSWER_NOTICE_HIDE_UNTIL_KEY: { get: () => ANSWER_NOTICE_HIDE_UNTIL_KEY, set: (value) => { ANSWER_NOTICE_HIDE_UNTIL_KEY = value; }, configurable: true },
    ANSWER_PANEL_LAYOUT_COOKIE: { get: () => ANSWER_PANEL_LAYOUT_COOKIE, set: (value) => { ANSWER_PANEL_LAYOUT_COOKIE = value; }, configurable: true },
    ANSWER_SOURCE_PANEL_WIDTH_SCALE: { get: () => ANSWER_SOURCE_PANEL_WIDTH_SCALE, set: (value) => { ANSWER_SOURCE_PANEL_WIDTH_SCALE = value; }, configurable: true },
    ANSWER_UI_COOKIE_MAX_AGE: { get: () => ANSWER_UI_COOKIE_MAX_AGE, set: (value) => { ANSWER_UI_COOKIE_MAX_AGE = value; }, configurable: true },
    ANSWER_UI_FONT_COOKIE: { get: () => ANSWER_UI_FONT_COOKIE, set: (value) => { ANSWER_UI_FONT_COOKIE = value; }, configurable: true },
    PAGE_SIZE: { get: () => PAGE_SIZE, set: (value) => { PAGE_SIZE = value; }, configurable: true },
    answerDefaultPanelLayout: { get: () => answerDefaultPanelLayout, set: (value) => { answerDefaultPanelLayout = value; }, configurable: true },
    answerPanelLayoutController: { get: () => answerPanelLayoutController, set: (value) => { answerPanelLayoutController = value; }, configurable: true },
    compareScrollLock: { get: () => compareScrollLock, set: (value) => { compareScrollLock = value; }, configurable: true },
    completedConversationIds: { get: () => completedConversationIds, set: (value) => { completedConversationIds = value; }, configurable: true },
    customConfirm: { get: () => customConfirm, set: (value) => { customConfirm = value; }, configurable: true },
    el: { get: () => el, set: (value) => { el = value; }, configurable: true },
    entryParams: { get: () => entryParams, set: (value) => { entryParams = value; }, configurable: true },
    escapeHtml: { get: () => escapeHtml, set: (value) => { escapeHtml = value; }, configurable: true },
    featureInstallers: { get: () => featureInstallers, set: (value) => { featureInstallers = value; }, configurable: true },
    featureRuntime: { get: () => featureRuntime, set: (value) => { featureRuntime = value; }, configurable: true },
    historyConversationId: { get: () => historyConversationId, set: (value) => { historyConversationId = value; }, configurable: true },
    isNewChatEntry: { get: () => isNewChatEntry, set: (value) => { isNewChatEntry = value; }, configurable: true },
    listResponse: { get: () => listResponse, set: (value) => { listResponse = value; }, configurable: true },
    nestedValue: { get: () => nestedValue, set: (value) => { nestedValue = value; }, configurable: true },
    parseMarkdown: { get: () => parseMarkdown, set: (value) => { parseMarkdown = value; }, configurable: true },
    pendingConversationIds: { get: () => pendingConversationIds, set: (value) => { pendingConversationIds = value; }, configurable: true },
    pendingDownloadFormat: { get: () => pendingDownloadFormat, set: (value) => { pendingDownloadFormat = value; }, configurable: true },
    pendingDownloadVersion: { get: () => pendingDownloadVersion, set: (value) => { pendingDownloadVersion = value; }, configurable: true },
    pendingNewWorkspaceEpochs: { get: () => pendingNewWorkspaceEpochs, set: (value) => { pendingNewWorkspaceEpochs = value; }, configurable: true },
    reportDetailRequestSeq: { get: () => reportDetailRequestSeq, set: (value) => { reportDetailRequestSeq = value; }, configurable: true },
    selectedSourcesSaveTimer: { get: () => selectedSourcesSaveTimer, set: (value) => { selectedSourcesSaveTimer = value; }, configurable: true },
    singleResponse: { get: () => singleResponse, set: (value) => { singleResponse = value; }, configurable: true },
    sleep: { get: () => sleep, set: (value) => { sleep = value; }, configurable: true },
    state: { get: () => state, set: (value) => { state = value; }, configurable: true },
    workspaceCommon: { get: () => workspaceCommon, set: (value) => { workspaceCommon = value; }, configurable: true },
    workspaceEpoch: { get: () => workspaceEpoch, set: (value) => { workspaceEpoch = value; }, configurable: true }
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
    isNewChatNoticeHiddenForToday,
    hideNewChatNoticeForOneDay,
    closeNewChatNoticeModal,
    showNewChatNoticeModal,
    getAnswerWelcomeHtml,
    resetWorkspace,
    syncDrawerPositionButton,
    toggleDrawerPosition,
    openDrawer,
    closeDrawer,
    openEditModal,
    closeEditModal,
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
    createFallbackRecommendationCard,
    createRecommendationCardFromPublicPrototype,
    createRecommendationTagFromPublicPrototype,
    syncRecommendationCardPublic,
    bindDynamicRecommendationCard,
    normalizeRecommendations,
    setRecommendations,
    getVisibleRecommendationItems,
    createPublicRecommendationCardPrototype,
    clonePublicRecommendationCard,
    createPublicRecommendationTag,
    syncPublicRecommendationTags,
    syncPublicRecommendationCard,
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
    reportItems,
    loadConversationReports,
    getVersionList,
    selectedDocIdsFromUi,
    applySavedDocIdsToSelection,
    loadReportSelectedSources,
    saveReportSelectedSources,
    scheduleSelectedSourcesSave,
    loadReportVersionContext,
    loadLatestReportRecommendationContext,
    loadReportDetail,
    clearReport,
    clearReportContentOnly,
    normalizeVersionNumbers,
    getVersionTime,
    renderVersionChips,
    cleanEvidenceSentenceText,
    getEvidenceSentenceText,
    getReferenceByMarker,
    renderDraftEvidence,
    createDraftEvidenceSplitHandle,
    openDraftEvidence,
    closeDraftEvidence,
    decorateDraftReferenceMarkers,
    getDraftPlainText,
    getDraftPageMetrics,
    updateDraftDocumentStats,
    wrapReportTables,
    renderReport,
    extractReportMarkers,
    getEditableReportHtml,
    clearCurrentAnswerResult,
    saveReportVersion,
    openRestoreVersionModal,
    restoreReportVersion,
    downloadDraft,
    openDraftDownloadConfirm,
    getCompareSimilarSources,
    getCompareVersionNumbers,
    getCompareSourceContent,
    buildCompareSourcePages,
    buildCompareDraftPages,
    loadCompareReportVersion,
    syncCompareViewportHeight,
    syncCompareScroll,
    renderCompareWorkspace,
    ensureDraftVersionCompareUi,
    updateDraftVersionCompareToggle,
    getDraftSingleContentElements,
    applyDraftDisplayMode,
    exitDraftVersionCompare,
    getDraftVersionLabel,
    getDraftVersionNote,
    renderDraftVersionCompareWorkspace,
    bindDraftVersionCompareEvents,
    applyDraftCompareZoom,
    showToast,
    isConversationPending,
    syncBusyForActiveConversation,
    isWorkspaceSelectionActive,
    getScaledAnswerDefaultPanelLayout,
    applyAnswerPanelLayout,
    resetAnswerPanelLayout,
    initAnswerPanelDragDrop,
    initAnswerAccessoryTools,
    syncComparePanelOrder,
    applyRecommendZoom,
    applyZoom
  });

  Object.values(featureInstallers).forEach((install) => {
    if (typeof install === "function") install(featureRuntime);
  });

  const ANSWER_NOTICE_HIDE_UNTIL_KEY = "ai_one_answer_notice_hide_until";











  el.compareReferenceSelect?.addEventListener("change", () => {
    state.compareSelectedSourceKey = el.compareReferenceSelect.value || "";
    renderCompareWorkspace().catch((error) => {
      console.error("[답변서 비교] 유사답변서 변경 실패", error);
    });
  });
  el.compareDraftVersionSelect?.addEventListener("change", () => {
    state.compareSelectedVersion = Number(el.compareDraftVersionSelect.value || 0);
    renderCompareWorkspace().catch((error) => {
      console.error("[답변서 비교] 답변서 버전 변경 실패", error);
    });
  });
  el.compareDocumentSwap?.addEventListener("click", () => {
    state.comparePanelsSwapped = !state.comparePanelsSwapped;
    syncComparePanelOrder();
  });
  el.compareScrollSync?.addEventListener("change", () => {
    state.compareScrollSync = !!el.compareScrollSync.checked;
  });
  window.addEventListener("resize", () => {
    if (!el.comparePanel?.hidden) {
      syncCompareViewportHeight();
    }
  });
  el.compareBaseBody?.addEventListener("scroll", () => {
    syncCompareScroll(el.compareBaseBody, el.compareDraftBody);
  });
  el.compareDraftBody?.addEventListener("scroll", () => {
    syncCompareScroll(el.compareDraftBody, el.compareBaseBody);
  });
  document.querySelectorAll("[data-answer-tab]").forEach((button) => {
    button.addEventListener("click", () => setTab(button.dataset.answerTab));
  });
  document.querySelectorAll("[data-reference-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-reference-filter]").forEach((item) =>
        item.classList.toggle("active", item === button)
      );
      renderRecommendations();
    });
  });
  el.recommendList.addEventListener("click", (event) => {
    const card = event.target.closest(".rec-card[data-reference-key]");
    if (!card) return;
    const key = card.dataset.referenceKey;
    if (event.target.matches('input[type="checkbox"]')) {
      if (event.target.checked) addSelectedReferenceKey(key);
      else state.selectedReferenceKeys.delete(key);
      renderSelectedReferences();
      renderRecommendations();
      scheduleSelectedSourcesSave();
      return;
    }
    state.activeReferenceKey = key;
    renderRecommendations();
    renderPreview();
  });
  el.selectAllReferences.addEventListener("change", () => {
    getVisibleRecommendationItems().forEach((item) => {
      if (el.selectAllReferences.checked) addSelectedReferenceKey(item.key);
      else state.selectedReferenceKeys.delete(item.key);
    });
    renderRecommendations();
    renderSelectedReferences();
    scheduleSelectedSourcesSave();
  });
  el.selectedReferenceList.addEventListener("click", (event) => {
    const selectedFileUnselect = event.target.closest("[data-selected-file-unselect]");
    if (selectedFileUnselect) {
      event.preventDefault();
      event.stopPropagation();
      const index = Number(selectedFileUnselect.dataset.selectedFileUnselect);
      const file = Number.isInteger(index) ? state.uploadedFiles[index] : null;
      if (!file) return;
      const identity = getUploadedFileIdentity(file);
      state.uploadedFiles = state.uploadedFiles.filter(
        (item) => getUploadedFileIdentity(item) !== identity
      );
      renderUploadedFiles();
      showToast("이번 질문의 첨부 선택을 해제했습니다.");
      return;
    }
    const button = event.target.closest("[data-selected-remove]");
    if (!button) return;
    state.selectedReferenceKeys.delete(button.dataset.selectedRemove);
    renderSelectedReferences();
    renderRecommendations();
    scheduleSelectedSourcesSave();
  });
  el.applyReferencesBtn.addEventListener("click", async () => {
    const selected = state.recommendationItems.filter((item) => state.selectedReferenceKeys.has(item.key));
    const uploadedFileCount = Array.isArray(state.uploadedFiles) ? state.uploadedFiles.length : 0;
    if (!selected.length && !uploadedFileCount) {
      showToast("답변서에 반영할 관련자료를 선택해 주세요.");
      return;
    }
    const selectedDocIds = Array.from(new Set(
      selected
        .map((item) => String(item.doc_id || "").trim())
        .filter(Boolean)
    ));
    if (selected.length && !selectedDocIds.length) {
      showToast("선택한 자료에서 문서 ID를 확인할 수 없습니다.");
      return;
    }
    const docIds = selectedDocIds;
try {
      // v1.5 No.17: 선택 상태 자체는 전체 선택 doc_id 기준으로 저장한다.
      // 실제 초안 생성 요청에는 아래의 신규 docIds만 보낸다.
      if (selectedDocIds.length) {
        await saveReportSelectedSources(selectedDocIds, { silent: true });
      }
      /*
       * v1.5 No.6 공식 방식:
       * 선택자료는 content가 아니라 metadata.doc_ids에 싣는다.
       * doc_ids가 존재하는 턴은 서버가 이 문서들로 새 보고서 버전을 생성한다.
       */
      await sendChat(
        docIds.length
          ? "선택한 관련자료를 반영하여 답변서를 생성해 주세요."
          : "업로드한 파일을 반영하여 답변서를 생성해 주세요.",
        {
          preserveWorkspace: true,
          docIds: docIds
        }
      );
    } catch (error) {
      console.error("선택 자료 답변서 반영 실패", error);
    }
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
    const signature = incoming.map((file) =>
      [file.name, file.size, file.lastModified].join(":")
    ).join("|");
    const now = Date.now();
    if (
      el.fileButton.dataset.lastUploadSignature === signature &&
      now - Number(el.fileButton.dataset.lastUploadAt || 0) < 800
    ) {
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
  document.getElementById("answerSourceFileDeleteModal")?.addEventListener("click", (event) => {
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
  document.getElementById("sourceCollapseBtn")?.addEventListener("click", (event) => {
    event.preventDefault();
    const panel = document.querySelector('.three-panel [data-panel="folder"], [data-panel="folder"]');
    if (!panel) return;
    const layout = panel.closest(".three-panel");
    const button = event.currentTarget;
    const collapsing = !panel.classList.contains("panel-collapsed");
    panel.classList.toggle("panel-collapsed", collapsing);
    panel.querySelector(".answer-source-file-section, .file-list-section")
      ?.classList.toggle("is-collapsed", collapsing);
    layout?.classList.toggle("is-source-collapsed", collapsing);
    if (layout) {
      if (collapsing) {
        // 펼쳐진 상태의 실제 grid 폭을 저장한다.
        if (!layout.dataset.sourceExpandedGrid) {
          layout.dataset.sourceExpandedGrid =
            layout.style.gridTemplateColumns ||
            window.getComputedStyle(layout).gridTemplateColumns ||
            "";
        }
        const directPanels = Array.from(layout.children)
          .filter((child) => child.matches?.(".panel[data-panel], .panel[data-slot]"));
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
              const width = Math.max(
                180,
                Math.round(child.getBoundingClientRect().width || 320)
              );
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
    const label = collapsing
      ? "참조소스 패널 펼치기"
      : "참조소스 패널 접기";
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
  el.fileReset.addEventListener("click", (event) => {
    event.preventDefault();
    // 초기화 버튼은 "업로드한 파일"만 비운다.
    state.uploadedFiles = [];
    if (el.fileInput) el.fileInput.value = "";
    renderUploadedFiles();
    showToast("업로드 파일을 초기화했습니다.");
  });
  el.chatInput.addEventListener("input", () => {
    syncChatInputHeight();
    syncSendButton();
  });
  el.chatInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      sendChat();
    }
  });
  el.sendBtn.addEventListener("click", () => sendChat());
  el.newChatBtn.addEventListener("click", () => {
    resetWorkspace();
    showNewChatNoticeModal();
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
  el.historyDrawer?.addEventListener("sidepop:chat-action", async (event) => {
    const detail = event.detail || {};
    if (!detail.completed) return;
    const item = detail.item;
    const conversationId = String(item?.dataset?.conversationId || "");
    const action = String(detail.action || "");
    if (!conversationId || !action) return;
    if (action === "rename") {
      const title = String(detail.title || "").trim();
      if (!title) return;
      const saved = await renameConversation(conversationId, title);
      if (!saved) {
        await loadConversationList({
          title: state.conversationSearchTitle,
          page: state.conversationPage
        });
      }
      return;
    }
    if (action === "delete") {
      const deleted = await deleteConversation(conversationId);
      if (!deleted) {
        await loadConversationList({
          title: state.conversationSearchTitle,
          page: state.conversationPage
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
          favoriteOnly: state.conversationFavoriteOnly
        });
        return;
      }
      showToast(favorite ? "대화를 즐겨찾기에 등록했습니다." : "대화 즐겨찾기를 해제했습니다.");
      if (state.conversationFavoriteOnly && !favorite) {
        await loadConversationList({
          title: state.conversationSearchTitle,
          page: 1,
          favoriteOnly: true
        });
      }
      return;
    }
    if (action === "share") {
      const shareUrl =
        window.location.origin +
        window.location.pathname +
        "?conversationId=" +
        encodeURIComponent(conversationId);
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
        favoriteOnly: state.conversationFavoriteOnly
      });
    },
    onClear: () => {
      state.conversationSearchTitle = "";
      state.conversationPage = 1;
      loadConversationList({
        title: "",
        page: 1,
        favoriteOnly: state.conversationFavoriteOnly
      });
    },
    onSort: () => {
      loadConversationList({
        title: state.conversationSearchTitle,
        page: 1,
        favoriteOnly: false
      });
    }
  });
  el.reportVersionSelect.addEventListener("change", () => {
    const version = Number(el.reportVersionSelect.value);
    if (version > 0) {
      // 상단 칩에서 X로 숨겼던 버전을 selectbox에서 다시 선택하면
      // 해당 버전 칩을 다시 표시한다.
      state.dismissedVersions.delete(version);
      loadReportDetail(state.reportId, version);
    }
  });
  el.versionChips?.addEventListener("click", (event) => {
    const closeButton = event.target.closest("[data-answer-version-close]");
    if (closeButton) {
      event.stopPropagation();
      const chip = closeButton.closest("[data-answer-version-label]");
      if (!chip) return;
      const allChips = Array.from(el.versionChips.querySelectorAll("[data-answer-version-label]"));
      if (allChips.length <= 1) {
        showToast("최소 1개의 버전 레이블은 유지해야 합니다.");
        return;
      }
      const version = Number(closeButton.dataset.reportVersionChip);
      // X 버튼은 상단 "버전 칩"만 닫는다.
      // 실제 보고서 버전 목록 / selectbox / 현재 선택 버전은 건드리지 않는다.
      if (version > 0) state.dismissedVersions.add(version);
      chip.remove();
      return;
    }
    const openButton = event.target.closest("[data-answer-version-open]");
    if (!openButton) return;
    const version = Number(openButton.dataset.reportVersionChip);
    if (version > 0 && state.reportId) {
      loadReportDetail(state.reportId, version);
    }
  });
  el.draftPaper?.addEventListener("click", (event) => {
    const marker = event.target.closest("[data-reference-marker]");
    if (!marker) return;
    event.preventDefault();
    openDraftEvidence(
      marker.dataset.referenceMarker || marker.textContent,
      getEvidenceSentenceText(marker)
    );
  });
  el.evidenceClose?.addEventListener("click", closeDraftEvidence);
  el.evidenceBody?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-evidence-original]");
    if (!button) return;
    const docId = button.dataset.evidenceOriginal;
    if (!docId) {
      showToast("원문 식별자가 없어 열 수 없습니다.");
      return;
    }
    downloadOriginalFile(docId);
  });
  el.reportRestoreBtn.addEventListener("click", openRestoreVersionModal);
  el.reportEditBtn.addEventListener("click", openEditModal);
  el.editClose.addEventListener("click", closeEditModal);
  el.editCancel.addEventListener("click", closeEditModal);
  el.editSave.addEventListener("click", saveReportVersion);
  el.draftDownloadBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    if (el.draftDownloadBtn.disabled) return;
    const open = el.reportDownloadMenu.classList.contains("hidden");
    el.reportDownloadMenu.classList.toggle("hidden", !open);
    el.draftDownloadBtn.setAttribute("aria-expanded", String(open));
  });
  let pendingDownloadFormat = "";
  let pendingDownloadVersion;
  el.reportDownloadMenu.addEventListener("click", (event) => {
    const button = event.target.closest("[data-format]");
    if (!button) return;
    el.reportDownloadMenu.classList.add("hidden");
    el.draftDownloadBtn.setAttribute("aria-expanded", "false");
    openDraftDownloadConfirm(button.dataset.format, undefined);
  });
  el.draftDownloadConfirmBtn?.addEventListener("click", () => {
    if (window.AIOneModal?.close) {
      window.AIOneModal.close(el.draftDownloadConfirmModal);
    } else {
      el.draftDownloadConfirmModal.classList.add("hidden");
    }
    downloadDraft(pendingDownloadFormat, pendingDownloadVersion);
  });

  document.addEventListener("click", (event) => {
    if (!el.reportDownloadWrap.contains(event.target)) {
      el.reportDownloadMenu.classList.add("hidden");
      el.draftDownloadBtn.setAttribute("aria-expanded", "false");
    }
    if (!event.target.closest("[data-compare-download-wrap]")) {
      document.querySelectorAll("[data-compare-download-menu]").forEach((menu) => {
        menu.classList.add("hidden");
      });
      document.querySelectorAll("[data-compare-download-trigger]").forEach((trigger) => {
        trigger.setAttribute("aria-expanded", "false");
      });
    }
  });
  el.recommendZoomOut?.addEventListener("click", () => {
    state.recommendZoom = Math.max(50, state.recommendZoom - 10);
    applyRecommendZoom();
  });
  el.recommendZoomIn?.addEventListener("click", () => {
    state.recommendZoom = Math.min(200, state.recommendZoom + 10);
    applyRecommendZoom();
  });
  el.recommendFullscreenBtn?.addEventListener("click", async () => {
    const panel = document.querySelector(".recommend-view-wrapper");
    if (!panel) return;
    try {
      if (document.fullscreenElement === panel) {
        await document.exitFullscreen();
      } else if (panel.requestFullscreen) {
        await panel.requestFullscreen();
      }
    } catch (error) {
      console.error("[관련자료 전체보기 오류]", error);
    }
  });
  el.sourcePreview?.closest(".doc-viewer-body")?.addEventListener("scroll", updateRecommendDocumentStats);
  el.zoomOut.addEventListener("click", () => {
    state.zoom = Math.max(50, state.zoom - 10);
    applyZoom();
  });
  el.zoomIn.addEventListener("click", () => {
    state.zoom = Math.min(200, state.zoom + 10);
    applyZoom();
  });
  el.fitBtn.addEventListener("click", async () => {
    const panel = document.querySelector(".answer-draft-panel");
    if (!panel) return;
    try {
      if (document.fullscreenElement === panel) {
        await document.exitFullscreen();
      } else if (panel.requestFullscreen) {
        await panel.requestFullscreen();
      }
    } catch (error) {
      console.error("[답변서 전체보기 오류]", error);
    }
  });
  document.addEventListener("fullscreenchange", () => {
    const draftPanel = document.querySelector(".answer-draft-panel");
    const recommendPanel = document.querySelector(".recommend-view-wrapper");
    const draftActive = document.fullscreenElement === draftPanel;
    const recommendActive = document.fullscreenElement === recommendPanel;
    el.fitBtn?.setAttribute("aria-pressed", String(draftActive));
    el.recommendFullscreenBtn?.setAttribute("aria-pressed", String(recommendActive));
    draftPanel?.classList.toggle("is-document-fullscreen", draftActive);
    recommendPanel?.classList.toggle("is-document-fullscreen", recommendActive);
  });
  el.draftScroll.addEventListener("scroll", updateDraftDocumentStats);
  el.draftScroll.addEventListener("wheel", (event) => {
    if (!event.ctrlKey) return;
    event.preventDefault();
    state.zoom = Math.max(50, Math.min(200, state.zoom + (event.deltaY < 0 ? 10 : -10)));
    applyZoom();
  }, { passive: false });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!el.editBackdrop.classList.contains("hidden")) closeEditModal();
    if (el.historyDrawer.getAttribute("aria-hidden") === "false") closeDrawer();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    closeFileDeleteModal();
    closeNewChatNoticeModal();
  });
  // 초기화
  window.AIOneIcons?.hydrate(document);
  initAnswerPanelDragDrop();
  initAnswerAccessoryTools();
  renderUploadedFiles();
  renderRecommendations();
  renderSelectedReferences();
  renderPreview();
  applyRecommendZoom();
  updateRecommendDocumentStats();
  renderReport();
  syncChatInputHeight();
  syncSendButton();
  setTab("recommend");
  appendMessage("ai", getAnswerWelcomeHtml(), undefined, undefined, { rawHtml: true });
  const entryParams = new URLSearchParams(window.location.search);
  const historyConversationId = String(entryParams.get("conversationId") || "").trim();
  const isNewChatEntry = entryParams.get("newChat") === "Y";
  // 답변서(보고서) 화면에 들어오면 진입 경로와 관계없이 안내 모달을 표시한다.
  // '하루 다시 안 보기'가 활성화되어 있으면 showNewChatNoticeModal 내부에서 차단된다.
  showNewChatNoticeModal();
  if (historyConversationId) {
    // 최근 사용 이력에서 들어온 경우에만 지정된 기존 대화방을 연다.
    loadConversationList({ openLatest: false, page: 1, title: "" })
      .then(() => selectConversation(historyConversationId))
      .catch((error) => console.error("[최근 사용 이력] 답변서 대화 이동 실패", error));
  } else if (isNewChatEntry) {
    // 홈 서비스 카드/사이드바 진입: 최신 대화를 자동 선택하지 않고 빈 새 채팅을 유지한다.
    resetWorkspace();
    loadConversationList({ openLatest: false, page: 1, title: "" });
  } else {
    loadConversationList({ openLatest: true, page: 1, title: "" });
  }
  bindAnswerWorkspaceTitleEdit();
})(document, window.AIOneCommon || {});
