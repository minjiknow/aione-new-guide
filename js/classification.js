/**
 * AI-ONE 질의분류 진입점
 *
 * 역할
 * - 페이지 공용 상태와 DOM 참조를 관리한다.
 * - 질의분류 기능 모듈을 조립하고 초기화 순서를 제어한다.
 * - 공통 이벤트를 연결하고 최초 화면 데이터를 로드한다.
 *
 * 기능별 상세 로직은 classification-*.js 모듈에서 담당한다.
 *
 * 기본 구간 형식: Start: 기능명 / End: 기능명
 * 변경 구간 형식: Start: YYMMDD 추가/수정 - 기능명 / End: YYMMDD 추가/수정 - 기능명
 * 주석 정리 내역
 * - 261023 주석 정리 - 구간 표시와 변경 내용 표기를 통일합니다. 기존 작업 날짜와 기능 설명은 유지합니다.
 */
// [개발 연동 안내] HTML 예시/연결 위치는 html/classifcation.html의 [API 연결 위치] 참조.
// 실행 이력: classification-conversation.js / 문서·질의 조회: classification-file.js.
// 질의 편집: classification-query.js / 부서·재분류: classification-department.js.
// 실제 HTTP 요청은 각 파일의 [API 연동], 공통 응답 처리는 이 파일의 fetchJson() 참조.
(function () {
  'use strict';
  const featureRuntime = Object.create(null);
  const featureInstallers = window.AIOneClassificationFeatureModules || {};
  const workspaceCommon = window.AIOneWorkspaceCommon;
  if (!workspaceCommon) {
    throw new Error('common.js의 AIOneWorkspaceCommon이 먼저 로드되어야 합니다.');
  }

  // ─── Runtime Data ───
  // 실제 API 응답으로 채워지는 화면 상태. 화면 데이터는 실제 API 응답으로만 채운다.
  const questions = [];
  /*
   * 수정 화면은 question_text,
   * 원본 화면은 API의 question_original_text만 사용한다.
   */
  const documentMetaMap = Object.create(null);

  function getQuestionStableKey(query) {
    return String(
      query?.questionId ??
      query?.question_id ??
      query?.id ??
      ''
    ).trim();
  }

  function getActiveDisplayNumber(query) {
    if (!query) return null;
    const originalOrder = Number(
      query?.raw?.question_order ??
      query?.question_order
    );
    if (Number.isInteger(originalOrder) && originalOrder > 0) {
      return originalOrder;
    }
    const key = getQuestionStableKey(query);
    const index = questions.findIndex(item =>
      key
        ? getQuestionStableKey(item) === key
        : item === query
    );
    return index >= 0 ? index + 1 : null;
  }

  // 원본 보기 문서를 질의요지서 형태로 렌더링

  // 문서별 API 조회 결과 캐시
  const fileDataMap = Object.create(null);
  let activeFileIndex = 0;
  // 실행 목록은 conversation API 응답으로 관리한다.
  const sessions = [];
  let activeSessionId = null;
  let runListSearchTerm = '';
  let runListSortOrder = 'latest';
  // 파일별 확정/알림 상태는 이 페이지의 비즈니스 상태다.
  const fileConfirmState = {};
  const confirmedQuerySnapshots = {};
  // 실국별 알림 설정도 부서 API 응답을 기준으로 구성한다.
  // 담당자 정보가 부서 API에 없다면 staff는 빈 배열로 유지한다.
  let notificationOrganizationOrder = [];
  let notificationDepartmentDirectory = [];
  let notificationDepartmentAssignments = {};







  // ─── DOM References ───
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
  const uploadZone = $('#uploadZone');
  const fileInput = $('#fileInput');
  const fileList = $('#fileList');
  const fileCount = $('#fileCount');
  const docContent = $('#docContent');
  const queryList = $('#queryList');
  const toast = $('#toast');
  // Drawer
  const runDrawerBtn = $('#runDrawerBtn');
  const runDrawer = $('#runDrawer');
  const drawerBackdrop = $('#drawerBackdrop');
  const drawerClose = $('#drawerClose');
  // Modal
  const editModal = $('#editModal');
  const editModalClose = $('#editModalClose');
  const editCancel = $('#editCancel');
  const editApply = $('#editApply');
  // Sidebar toggle
  const sidebarToggle = $('#sidebarToggle');
  const sidebar = $('#sidebar');
  const sidebarCollapseBtn = $('#sidebarCollapseBtn');
  const mainWrap = $('#classificationApp');

  // ─── State ───
  let uploadedFiles = [];
  let currentFilter = 'all';
  let recentJobs = [];
  let editingQuery = null;
  let activeQueryIndex = 0; // 질의 추출 결과 패널에서 현재 선택된 문장 인덱스
  let lastDocText = ''; // 현재 표시 중인 원문 텍스트 (통계 표시용)

  // 기능 모듈 설치 전에는 getDefaultWorkspaceTitle()을 호출할 수 없다.
  // 실제 기본 제목은 init() -> hydrateWorkspaceMeta()에서 모듈 설치 후 설정한다.
  let workspaceTitle = '';
  let workspaceMemberCount = 0;
  const UI_FONT_COOKIE = 'ai_one_classification_font_percent';
  const UI_FULLSCREEN_COOKIE = 'ai_one_classification_fullscreen';
  const UI_PANEL_LAYOUT_COOKIE = 'ai_one_classification_panel_layout';
  const UI_DOC_SPLIT_WIDTH_COOKIE = 'ai_one_classification_doc_split_width';
  const UI_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
  const classificationPanelLayoutController = window.AIOneWorkspaceUi.createPanelLayoutController({
    cookieKey: UI_PANEL_LAYOUT_COOKIE,
    cookieMaxAge: UI_COOKIE_MAX_AGE,
    includeSlot: false,
    getState: (container) => window.AIOneWorkspaceUi.getLayoutState(container, { includeSlot: false }),
    applyState: (container, state) => applyPanelLayoutState(container, state)
  });

  // 파일 처리 파이프라인 단계 정의: 파싱 → SLM 자연어화 → 청킹 (국회 답변서 초안 생성과 동일)
  // 업로드/분류 진행 상태는 실제 job API polling 결과만 사용한다.

  // ─── Shared UI / session helpers ───



  // ─── Init ───

  function init() {
    if (document.body) document.body.setAttribute('data-page', 'intake');
    if (window.AIOneIcons && typeof window.AIOneIcons.hydrate === 'function') {
      window.AIOneIcons.hydrate(document);
    }
    hydrateWorkspaceMeta();
    const runListSearch = $('#runListSearch');
    const runListSearchClear = $('#runListSearchClear');
    const runListSort = $('#runListSort');
    const runList = $('#runList');

    window.AIOneConversationDrawer.bindControls({
      search: runListSearch,
      searchClear: runListSearchClear,
      sort: runListSort,
      list: runList,
      sortValue: runListSortOrder,
      scrollThreshold: window.AIOneConversationDrawer.SCROLL_THRESHOLD,
      onSearch: nextTitle => {
        runListSearchTerm = nextTitle;
        if (actualConversationSearchTimer) {
          clearTimeout(actualConversationSearchTimer);
          actualConversationSearchTimer = null;
        }
        loadActualConversations(true, nextTitle);
      },
      onSearchInput: () => {},
      onClear: () => {
        runListSearchTerm = '';
        if (actualConversationSearchTimer) {
          clearTimeout(actualConversationSearchTimer);
          actualConversationSearchTimer = null;
        }
        loadActualConversations(true, '');
      },
      onSort: nextSort => {
        runListSortOrder = nextSort;
        loadActualConversations(true, runListSearchTerm);
      },
      isLoading: () => actualConversationLoading,
      hasNext: () =>
        isLatestConversationSort()
          ? actualConversationPage >= 1
          : actualConversationPage <= actualConversationPages,
      onLoadMore: () => {
        loadActualConversations(false, runListSearchTerm);
      }
    });
    runDrawer?.addEventListener('sidepop:close', () => {
      // 닫을 때 불필요한 전체 재조회는 하지 않는다. 다시 열 때 공통 페이지 크기만큼 조회한다.
      actualConversationRequestSeq += 1;
      actualConversationLoading = false;
      window.AIOneDrawerLoading.hide(runList);
    });

    window.AIOneConversationDrawer.bindActions({ drawer: runDrawer, type: 'run', onAction: async detail => {
      const { conversationId } = detail;
      if (detail.action === 'rename') {
        try {
          await updateActualConversationTitle(conversationId, detail.title);
          applyConversationTitleLocal(conversationId, detail.title);
          showToast('실행 건 제목이 변경되었습니다.');
        } catch (error) {
          console.error('실행 건 제목 변경 실패', error);
          await loadActualConversations(true, runListSearchTerm);
          showToast(error.message || '실행 건 제목 변경에 실패했습니다.');
        }
        return;
      }
      if (detail.action === 'delete') {
        try {
          await deleteActualConversation(conversationId);
          await syncAfterConversationDelete(conversationId);
          showToast('대화방이 삭제되었습니다.');
        } catch (error) {
          console.error('대화방 삭제 실패', error);
          await loadActualConversations(true, runListSearchTerm);
          showToast(error.message || '대화방 삭제에 실패했습니다.');
        }
        return;
      }
      if (detail.action === 'pin') {
        const item = actualConversationItems.find(item =>
          String(item.id ?? item.conversation_id ?? '') === conversationId
        );
        const previousFavorite = Boolean(item?.is_favorite);
        const nextFavorite = Boolean(detail.pinned);
        if (item) item.is_favorite = nextFavorite;
        renderDrawer();
        try {
          const updated = await setActualConversationFavorite(conversationId, nextFavorite);
          if (item && updated && typeof updated === 'object') {
            Object.assign(item, updated);
            item.is_favorite = Boolean(updated.is_favorite ?? nextFavorite);
          }
          renderDrawer();
          showToast(nextFavorite ? '목록 상단에 고정되었습니다.' : '고정이 해제되었습니다.');
        } catch (error) {
          console.error('대화 즐겨찾기 변경 실패', error);
          if (item) item.is_favorite = previousFavorite;
          renderDrawer();
          showToast(error.message || '즐겨찾기 변경에 실패했습니다.');
        }
        return;
      }
    } });
    loadNotificationAssignees();
    window.AIOneModal?.init(document);
    window.AIOneSidePop?.init(document);
    resetRunDrawerVisibility();
    window.AIOneDocumentStatusBar?.init(document);
    window.AIOneFilterButtons?.init(document);
    initClassificationAccessoryTools();
    bindEvents();
    bindWorkspaceMetaControls();
    updateNotificationAssigneeButton();
    loadActualEmptyState();
    loadActualDepartments();
    ensureOriginalViewToggleButton();
    ensureV15DrawerLayoutStyles();
    initPanelResize();
    initPanelDragDrop();
    initRuleManagement();
    // 최초 진입 화면도 비어 보이지 않도록 현재 상태를 즉시 렌더한다.
    renderFileList();
    renderQueryList();
    // 홈 최근 사용 이력에서 conversationId가 전달되면 그 대화를 최우선으로 연다.
    const historyConversationId = String(
      new URLSearchParams(window.location.search).get('conversationId') || ''
    ).trim();
    if (historyConversationId) {
      loadActualConversations(true)
        .then(() => loadSession(historyConversationId))
        .catch(error => console.error('최근 사용 이력 질의분류 대화 조회 실패', error));
    } else {
      Promise.all([loadActualConversations(true), getLatestWorkedConversationId()])
        .then(([, conversationId]) => {
          if (conversationId && !actualConversationId) return loadSession(conversationId);
        })
        .catch(error => console.error('초기 질의이력 조회 실패', error));
    }
  }

  // bindEvents: 이벤트 연결.
  function bindEvents() {
    // Upload
    // click / change / drag&drop 자체 처리는 common.js의 AIOneFileUpload가 담당한다.
    window.AIOneFileUpload?.init(document);
    uploadZone.addEventListener('app:file-upload', event => {
      validateFilesBeforeUpload(event.detail?.files || [], addFiles);
    });
    document.querySelector('[data-source-file-add]')?.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      if (!uploadZone) return;
      uploadZone.click();
    });
    // Tabs (removed - using checkbox now)
    $('.query-filter-bar')?.addEventListener('filter-btn:change', event => {
      handleFilterChange(event.detail?.filter);
    });
    queryList?.addEventListener('scroll', hideQueryModifiedTooltip, { passive: true });
    document.addEventListener('click', event => {
      if (!event.target.closest('.file-action-wrap')) closeFileActionMenus();
    });
    // Drawer
    runDrawer?.addEventListener('sidepop:open', () => {
      runDrawer.classList.remove('hidden');
      runDrawer.hidden = false;
      runDrawer.setAttribute('aria-hidden', 'false');
      if (drawerBackdrop) {
        drawerBackdrop.classList.remove('hidden');
        drawerBackdrop.hidden = false;
      }
      openDrawer();
    });
    runDrawerBtn?.addEventListener('click', () => {
      openDrawer();
    });
    const notificationAssigneeBtn = $('#notificationAssigneeBtn');
    if (notificationAssigneeBtn) {
      notificationAssigneeBtn.addEventListener('click', openNotificationAssigneeModal);
    }
    // Modal
    editApply.addEventListener('click', applyEdit);
    editModal?.addEventListener('modal:close', () => { editingQuery = null; });
    $('#editType')?.addEventListener('change', handleEditTypeManualChange);
    // Sidebar는 common.js AIOneSidebar가 담당한다.
    // Reset
    const resetBtn = $('#resetBtn');
    if (resetBtn) {
      resetBtn.addEventListener('pointerdown', stopResetInteraction);
      resetBtn.addEventListener('click', (event) => {
        stopResetInteraction(event);
        resetAll({ full: true, resetWorkspaceMeta: true });
      });
    }
    // Excel (query panel)
    const queryExcelBtn = $('#queryExcelBtn');
    if (queryExcelBtn) queryExcelBtn.addEventListener('click', () => downloadExcel());
    // AI Reclassify
    const aiReclassifyBtn = $('#aiReclassifyBtn');
    if (aiReclassifyBtn) aiReclassifyBtn.addEventListener('click', requestAiReclassification);
    // 예쁜 화면 / v1.5 원본 PDF 미리보기 전환
    const originalViewToggleBtn = $('#originalViewToggleBtn');
    if (originalViewToggleBtn) {
      originalViewToggleBtn.addEventListener('click', async () => {
        const activeFile = uploadedFiles[activeFileIndex];
        if (!activeFile) {
          showToast('먼저 문서를 선택해 주세요.');
          return;
        }
        const isPdf =
          String(activeFile.name || '')
            .toLowerCase()
            .endsWith('.pdf');
        if (!isPdf) {
          showToast('PDF 파일에서만 원본 PDF 미리보기를 사용할 수 있습니다.');
          return;
        }
        actualDocumentViewMode =
          actualDocumentViewMode === 'pdf'
            ? 'html'
            : 'pdf';
        updateOriginalViewToggleButton(activeFile);
        const data =
          fileDataMap[activeFile.name] ||
          { docText: '' };
        await renderActualDocument(
          activeFile,
          data.docText || ''
        );
      });
    }
    // New Classify: 화면만 새 채팅 상태로 초기화한다.
    // 실제 conversation은 첫 파일 업로드 시 ensureActualConversation()에서 생성한다.
    const newClassifyBtn = $('#newClassifyBtn');
    if (newClassifyBtn) newClassifyBtn.addEventListener('click', () => {
      resetActualWorkspaceView(true);
      activeSessionId = null;
      workspaceTitle = getDefaultWorkspaceTitle();
      workspaceMemberCount = 0;
      renderWorkspaceMeta();
      renderDrawer();
      window.AIOneSidePop?.close('#runDrawer');
      showToast('새 작업공간을 열었습니다. 파일을 업로드하면 대화방이 생성됩니다.');
    });
    // Confirm - state managed per file
    const confirmBtn = $('#confirmBtn');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', handleConfirmBtn);
    }
    const confirmCancelBtn = $('#confirmCancelBtn');
    if (confirmCancelBtn) {
      confirmCancelBtn.addEventListener('click', handleConfirmCancel);
    }
// Left panel collapse
    const leftCollapseBtn = $('#leftPanelCollapseBtn');
    if (leftCollapseBtn) {
      leftCollapseBtn.addEventListener('click', () => {
        const panel = leftCollapseBtn.closest('.panel');
        const container = $('.three-panel');
        if (!panel || !container) return;
        setPanelCollapsed(panel, !panel.classList.contains('panel-collapsed'));
      });
    }
  }











  // ─── File Upload ───












  // ─── Query Detail ───
  // 우측 "질의 추출 결과" 패널: 선택된 문장의 OCR 원문 · AI 요약 · 분류 결과 · 추천 실국 · 근거 · 신뢰도





  // ─── Query List ───





  // 레이아웃 재배치로 iframe/canvas가 DOM에서 분리된 경우 현재 원본을 같은 보기모드로 복원한다.
  let originalLayoutRestoreToken = 0;


  // ─── Panel Layout / Reorder / Resize ───
  const DEFAULT_PANEL_ORDER = ['left', 'center', 'right'];
  const DEFAULT_PANEL_WIDTHS = { left: 300, right: 420 };
  const PANEL_MIN_WIDTHS = { left: 200, center: 340, right: 300 };
  // 기본 폭을 코드에서 바꾸면 기존 브라우저 저장값이 새 기본값을 덮어쓰지 않도록
  // 기본 폭 자체를 storage key에 포함한다.
  const LAYOUT_KEY =
    `panel-layout-intake-v7-${DEFAULT_PANEL_WIDTHS.left}-${DEFAULT_PANEL_WIDTHS.right}`;

  // ─── Panel Drag & Drop ───

  // ─── Panel Resize ───
  // 드래그/키보드 리사이즈는 common.js의 AIOneSplitHandler가 전담한다.

  // ─── Stepper ───


  // ─── Drawer ───

  // ─── Edit Modal ───
  
  // ─── 실국별 알림 담당자 설정 ───

  // ─── Reset ───

  // ─── Rule Management ───
  const classifyRules = [];

  // ─── Excel Download ───

  // ─── Custom Modal ───

  // ─── Toast ───
  // 표시/숨김/타이머는 common.js의 AIOneToast가 전담한다.

  function showToast(msg) {
    workspaceCommon.showToast(msg);
  }
  // ─── Preparing Menu (준비중 메뉴 안내) ───
  $$('.nav-link[data-soon]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      customAlert('준비중', '이 화면은 프로토타입에 아직 포함되어 있지 않습니다.');
    });
  });
  // ========================================================================
  // 실제 질의분류 API 런타임 상태
  // 공통 UI 컴포넌트와 무관한 페이지 비즈니스 상태이므로 classification.js에 유지한다.
  // ========================================================================

  let actualConversationId = null;
  let actualDepartments = [];
  let actualConversationPage = 1;
  let actualConversationPages = 1;
  let actualConversationTotal = 0;
  let actualConversationLoading = false;
  let actualConversationRequestSeq = 0;
  let actualSessionLoadSeq = 0;
  let actualConversationSearchTimer = null;
  const ACTUAL_CONVERSATION_PAGE_SIZE = window.AIOneConversationDrawer.PAGE_SIZE;
  const actualConversationItems = [];
  const actualConversationStatusMap = new Map();
  // 실제 분류 작업이 끝난 뒤 아직 열어보지 않은 대화방의 완료점을 관리한다.
  const completedConversationIds = new Set();
  const actualFileMap = new Map();
  const actualQuestionRawMap = new Map();
  const actualJobTimers = new Map();
  // 대화별 실행 중 job을 화면 전환과 독립적으로 추적한다.
  const actualPendingJobsByConversation = new Map();
  const ACTUAL_JOB_POLL_INTERVAL = 1500;
  let actualDocumentViewMode = 'html';
  // 비동기 업로드/분류 결과가 다른 대화방 화면을 덮어쓰지 않도록 선택 세대를 관리한다.
  let classificationWorkspaceEpoch = 0;

  // apiData: 기능 처리.
  function apiData(result) {
    if (result && result.success === false) throw new Error(result.message || '요청 처리에 실패했습니다.');
    return result && Object.prototype.hasOwnProperty.call(result, 'data') ? result.data : result;
  }

  // fetchJson: 조회.
  async function fetchJson(url, options) {
    // [API 공통] classification-*.js의 fetchJson 호출을 실제 HTTP 요청으로 처리하고 응답 반환.
    const response = await fetch(url, options);
    if (!response.ok) throw new Error(`요청 실패 (${response.status})`);
    return apiData(await response.json());
  }


  function clearFileDataMap() {
    Object.keys(fileDataMap).forEach(key => delete fileDataMap[key]);
  }

  function isClassificationWorkspaceActive(conversationId, epoch) {
    return String(actualConversationId || '') === String(conversationId || '') &&
      (epoch == null || classificationWorkspaceEpoch === epoch);
  }

  function registerActualPendingJob(conversationId, jobId) {
    const conversationKey = String(conversationId || '').trim();
    const jobKey = String(jobId || '').trim();
    if (!conversationKey || !jobKey) return;
    let jobs = actualPendingJobsByConversation.get(conversationKey);
    if (!jobs) {
      jobs = new Set();
      actualPendingJobsByConversation.set(conversationKey, jobs);
    }
    jobs.add(jobKey);
    actualConversationStatusMap.set(conversationKey, 'processing');
  }

  function unregisterActualPendingJob(conversationId, jobId) {
    const conversationKey = String(conversationId || '').trim();
    const jobKey = String(jobId || '').trim();
    const jobs = actualPendingJobsByConversation.get(conversationKey);
    if (!jobs) return;
    jobs.delete(jobKey);
    if (!jobs.size) actualPendingJobsByConversation.delete(conversationKey);
  }

  function hasActualPendingJobs(conversationId) {
    const jobs = actualPendingJobsByConversation.get(String(conversationId || '').trim());
    return Boolean(jobs && jobs.size > 0);
  }

  function syncActiveIntakeSkeleton() {
    const activeFile = uploadedFiles[activeFileIndex];
    const activeFileStatus = activeFile
      ? normalizeActualStatus(activeFile.status)
      : '';
    if (activeFile && activeFileStatus === 'processing') {
      showIntakeSkeleton('문서를 분석하고 질의를 분류하고 있습니다...');
    } else {
      hideIntakeSkeleton();
    }
  }

  function findUploadedFileByDocumentId(documentId) {
    return uploadedFiles.find(
      file => String(file?.documentId || '') === String(documentId || '')
    ) || null;
  }

  // v1.8: 대화 설정 배치 조회. 백엔드 매핑이 없으면 기존 단건 조회로 fallback한다.

  // v1.7: 대화 즐겨찾기 등록/해제

  // normalizeActualStatus: API 데이터 정규화.
  function normalizeActualStatus(status) {
    const value = String(status || '').trim().toLowerCase();
    if (['completed','complete','done','success','succeeded','finished','ready','classified'].includes(value)) return 'completed';
    if (['failed','failure','error','errored','cancelled','canceled'].includes(value)) return 'failed';
    return 'processing';
  }

  // actualStatusLabel: 기능 처리.
  function actualStatusLabel(status) {
    const normalized = normalizeActualStatus(status);
    return normalized === 'completed' ? '완료' : normalized === 'failed' ? '실패' : '진행중';
  }

  // 한 번에 업로드한 파일 묶음별 완료 알림을 1회만 띄우기 위한 배치 식별자.
  let classificationCompletionBatchSeq = 0;

  // maybeNotifyClassificationBatchComplete: 기능 처리.
  function maybeNotifyClassificationBatchComplete(fileObj) {
    const batchId = String(fileObj?.completionBatchId || '');
    if (!batchId) return;
    const batchFiles = uploadedFiles.filter(
      file => String(file?.completionBatchId || '') === batchId
    );
    if (!batchFiles.length) return;
    // 하나라도 처리중/대기/실패 상태면 "전부 완료"가 아니므로 알리지 않는다.
    const allCompleted = batchFiles.every(
      file => normalizeActualStatus(file?.status) === 'completed'
    );
    if (!allCompleted) return;
    // 같은 배치의 어느 파일에서 먼저 검사하더라도 토스트는 정확히 한 번만 표시한다.
    if (batchFiles.some(file => file?.completionBatchNotified === true)) return;
    batchFiles.forEach(file => {
      file.completionBatchNotified = true;
    });
    // 공통 Manage 완료점 대신 실제 분류 작업이 끝난 대화방에 완료점을 표시한다.
    const completedConversationId = String(actualConversationId || '');
    if (completedConversationId) {
      completedConversationIds.add(completedConversationId);
      renderDrawer();
    }
  }

  const loadConversationSettingsV15 = (...args) => featureRuntime.loadConversationSettingsV15(...args);
  const loadConversationSettingsBatchV18 = (...args) => featureRuntime.loadConversationSettingsBatchV18(...args);
  const saveConversationSettingsV15 = (...args) => featureRuntime.saveConversationSettingsV15(...args);
  const setActualConversationFavorite = (...args) => featureRuntime.setActualConversationFavorite(...args);
  const ensureV15DrawerLayoutStyles = (...args) => featureRuntime.ensureV15DrawerLayoutStyles(...args);
  const loadRecentJobs = (...args) => featureRuntime.loadRecentJobs(...args);
  const renderWorkLog = (...args) => featureRuntime.renderWorkLog(...args);
  const resetRunDrawerVisibility = (...args) => featureRuntime.resetRunDrawerVisibility(...args);
  const openDrawer = (...args) => featureRuntime.openDrawer(...args);
  const refreshActualConversationStatus = (...args) => featureRuntime.refreshActualConversationStatus(...args);
  const updateActualConversationTitle = (...args) => featureRuntime.updateActualConversationTitle(...args);
  const deleteActualConversation = (...args) => featureRuntime.deleteActualConversation(...args);
  const syncAfterConversationDelete = (...args) => featureRuntime.syncAfterConversationDelete(...args);
  const applyConversationTitleLocal = (...args) => featureRuntime.applyConversationTitleLocal(...args);
  const requestConversationRename = (...args) => featureRuntime.requestConversationRename(...args);
  const requestConversationDelete = (...args) => featureRuntime.requestConversationDelete(...args);
  const getConversationServerSort = (...args) => featureRuntime.getConversationServerSort(...args);
  const getConversationVisibleTitle = (...args) => featureRuntime.getConversationVisibleTitle(...args);
  const hydrateConversationListCounts = (...args) => featureRuntime.hydrateConversationListCounts(...args);
  const sortConversationItemsByVisibleTitle = (...args) => featureRuntime.sortConversationItemsByVisibleTitle(...args);
  const isLatestConversationSort = (...args) => featureRuntime.isLatestConversationSort(...args);
  const sortConversationPageItems = (...args) => featureRuntime.sortConversationPageItems(...args);
  const formatConversationCreatedAt = (...args) => featureRuntime.formatConversationCreatedAt(...args);
  const syncRunListSortWidth = (...args) => featureRuntime.syncRunListSortWidth(...args);
  const getLatestWorkedConversationId = (...args) => featureRuntime.getLatestWorkedConversationId(...args);
  const loadActualConversations = (...args) => featureRuntime.loadActualConversations(...args);
  const renderDrawer = (...args) => featureRuntime.renderDrawer(...args);
  const loadSession = (...args) => featureRuntime.loadSession(...args);
  const getOriginalQuestionForView = (...args) => featureRuntime.getOriginalQuestionForView(...args);
  const buildOriginalPages = (...args) => featureRuntime.buildOriginalPages(...args);
  const getDocOriginalWidthBounds = (...args) => featureRuntime.getDocOriginalWidthBounds(...args);
  const resetDocOriginalWidth = (...args) => featureRuntime.resetDocOriginalWidth(...args);
  const applyDocOriginalWidth = (...args) => featureRuntime.applyDocOriginalWidth(...args);
  const renderDocContentForFile = (...args) => featureRuntime.renderDocContentForFile(...args);
  const updateDocStatusBar = (...args) => featureRuntime.updateDocStatusBar(...args);
  const getSecurityModal = (...args) => featureRuntime.getSecurityModal(...args);
  const renderSecurityFileRows = (...args) => featureRuntime.renderSecurityFileRows(...args);
  const showSensitiveFileBlocked = (...args) => featureRuntime.showSensitiveFileBlocked(...args);
  const showConfidentialFileConfirm = (...args) => featureRuntime.showConfidentialFileConfirm(...args);
  const validateFilesBeforeUpload = (...args) => featureRuntime.validateFilesBeforeUpload(...args);
  const getFileQueryCount = (...args) => featureRuntime.getFileQueryCount(...args);
  const renderFileList = (...args) => featureRuntime.renderFileList(...args);
  const closeFileActionMenus = (...args) => featureRuntime.closeFileActionMenus(...args);
  const toggleActualFavorite = (...args) => featureRuntime.toggleActualFavorite(...args);
  const requestFileDelete = (...args) => featureRuntime.requestFileDelete(...args);
  const deleteUploadedFile = (...args) => featureRuntime.deleteUploadedFile(...args);
  const applyReclassificationToOriginalQuestion = (...args) => featureRuntime.applyReclassificationToOriginalQuestion(...args);
  const submitActualDocument = (...args) => featureRuntime.submitActualDocument(...args);
  const cancelActualDocumentSubmit = (...args) => featureRuntime.cancelActualDocumentSubmit(...args);
  const setActualDocumentFavorite = (...args) => featureRuntime.setActualDocumentFavorite(...args);
  const formatActualFileSize = (...args) => featureRuntime.formatActualFileSize(...args);
  const actualFileType = (...args) => featureRuntime.actualFileType(...args);
  const normalizeActualDocuments = (...args) => featureRuntime.normalizeActualDocuments(...args);
  const addFiles = (...args) => featureRuntime.addFiles(...args);
  const classifyActualDocument = (...args) => featureRuntime.classifyActualDocument(...args);
  const pollActualJob = (...args) => featureRuntime.pollActualJob(...args);
  const loadActualQuestions = (...args) => featureRuntime.loadActualQuestions(...args);
  const renderFileStatusBadge = (...args) => featureRuntime.renderFileStatusBadge(...args);
  const loadFileData = (...args) => featureRuntime.loadFileData(...args);
  const ensureOriginalViewToggleButton = (...args) => featureRuntime.ensureOriginalViewToggleButton(...args);
  const updateOriginalViewToggleButton = (...args) => featureRuntime.updateOriginalViewToggleButton(...args);
  const normalizeOriginalMetaValue = (...args) => featureRuntime.normalizeOriginalMetaValue(...args);
  const extractOriginalDocumentMetaFromHtml = (...args) => featureRuntime.extractOriginalDocumentMetaFromHtml(...args);
  const extractOriginalDocumentMetaFromObject = (...args) => featureRuntime.extractOriginalDocumentMetaFromObject(...args);
  const buildActualDocumentMeta = (...args) => featureRuntime.buildActualDocumentMeta(...args);
  const renderActualPdfPreview = (...args) => featureRuntime.renderActualPdfPreview(...args);
  const renderActualDocument = (...args) => featureRuntime.renderActualDocument(...args);
  const getQuerySummary = (...args) => featureRuntime.getQuerySummary(...args);
  const getRecommendOffice = (...args) => featureRuntime.getRecommendOffice(...args);
  const getAIReason = (...args) => featureRuntime.getAIReason(...args);
  const ensureQueryModifiedTooltip = (...args) => featureRuntime.ensureQueryModifiedTooltip(...args);
  const showQueryModifiedTooltip = (...args) => featureRuntime.showQueryModifiedTooltip(...args);
  const hideQueryModifiedTooltip = (...args) => featureRuntime.hideQueryModifiedTooltip(...args);
  const renderQueryList = (...args) => featureRuntime.renderQueryList(...args);
  const handleFilterChange = (...args) => featureRuntime.handleFilterChange(...args);
  const updateStepper = (...args) => featureRuntime.updateStepper(...args);
  const escapeHtml = (...args) => featureRuntime.escapeHtml(...args);
  const closeEditModal = (...args) => featureRuntime.closeEditModal(...args);
  const stopResetInteraction = (...args) => featureRuntime.stopResetInteraction(...args);
  const resetAll = (...args) => featureRuntime.resetAll(...args);
  const getActiveConfirmKey = (...args) => featureRuntime.getActiveConfirmKey(...args);
  const createConfirmedQuerySnapshot = (...args) => featureRuntime.createConfirmedQuerySnapshot(...args);
  const syncActiveSubmittedConfirmState = (...args) => featureRuntime.syncActiveSubmittedConfirmState(...args);
  const handleConfirmBtn = (...args) => featureRuntime.handleConfirmBtn(...args);
  const handleConfirmCancel = (...args) => featureRuntime.handleConfirmCancel(...args);
  const updateConfirmBtnUI = (...args) => featureRuntime.updateConfirmBtnUI(...args);
  const initRuleManagement = (...args) => featureRuntime.initRuleManagement(...args);
  const renderRuleList = (...args) => featureRuntime.renderRuleList(...args);
  const downloadExcel = (...args) => featureRuntime.downloadExcel(...args);
  const getCommonActionModal = (...args) => featureRuntime.getCommonActionModal(...args);
  const customConfirm = (...args) => featureRuntime.customConfirm(...args);
  const customAlert = (...args) => featureRuntime.customAlert(...args);
  const deleteActualQuestion = (...args) => featureRuntime.deleteActualQuestion(...args);
  const restoreActualQuestion = (...args) => featureRuntime.restoreActualQuestion(...args);
  const normalizeActualQuestions = (...args) => featureRuntime.normalizeActualQuestions(...args);
  const syncEditTypeControls = (...args) => featureRuntime.syncEditTypeControls(...args);
  const handleEditTypeManualChange = (...args) => featureRuntime.handleEditTypeManualChange(...args);
  const openEditModal = (...args) => featureRuntime.openEditModal(...args);
  const applyEdit = (...args) => featureRuntime.applyEdit(...args);
  const normalizeNotificationStaff = (...args) => featureRuntime.normalizeNotificationStaff(...args);
  const normalizeNotificationSubunits = (...args) => featureRuntime.normalizeNotificationSubunits(...args);
  const notificationOrganizationName = (...args) => featureRuntime.notificationOrganizationName(...args);
  const syncNotificationDirectoryFromDepartments = (...args) => featureRuntime.syncNotificationDirectoryFromDepartments(...args);
  const resolveNotificationDepartmentName = (...args) => featureRuntime.resolveNotificationDepartmentName(...args);
  const splitNotificationDepartments = (...args) => featureRuntime.splitNotificationDepartments(...args);
  const questionTextWasModified = (...args) => featureRuntime.questionTextWasModified(...args);
  const sortedDepartmentIds = (...args) => featureRuntime.sortedDepartmentIds(...args);
  const sameDepartmentIds = (...args) => featureRuntime.sameDepartmentIds(...args);
  const resolveReclassificationDepartments = (...args) => featureRuntime.resolveReclassificationDepartments(...args);
  const validateReclassificationDepartments = (...args) => featureRuntime.validateReclassificationDepartments(...args);
  const waitForReclassificationJob = (...args) => featureRuntime.waitForReclassificationJob(...args);
  const fetchTextReclassificationResult = (...args) => featureRuntime.fetchTextReclassificationResult(...args);
  const requestTextReclassification = (...args) => featureRuntime.requestTextReclassification(...args);
  const mergeReclassifiedQuestion = (...args) => featureRuntime.mergeReclassifiedQuestion(...args);
  const requestAiReclassification = (...args) => featureRuntime.requestAiReclassification(...args);
  const executeAiReclassification = (...args) => featureRuntime.executeAiReclassification(...args);
  const buildDefaultNotificationAssignments = (...args) => featureRuntime.buildDefaultNotificationAssignments(...args);
  const loadNotificationAssignees = (...args) => featureRuntime.loadNotificationAssignees(...args);
  const saveNotificationAssignees = (...args) => featureRuntime.saveNotificationAssignees(...args);
  const getNotificationDepartmentGroup = (...args) => featureRuntime.getNotificationDepartmentGroup(...args);
  const getNotificationDepartmentsForQueries = (...args) => featureRuntime.getNotificationDepartmentsForQueries(...args);
  const getNotificationRoutingForQueries = (...args) => featureRuntime.getNotificationRoutingForQueries(...args);
  const updateNotificationAssigneeButton = (...args) => featureRuntime.updateNotificationAssigneeButton(...args);
  const openNotificationAssigneeModal = (...args) => featureRuntime.openNotificationAssigneeModal(...args);
  const actualDepartmentId = (...args) => featureRuntime.actualDepartmentId(...args);
  const actualDepartmentCode = (...args) => featureRuntime.actualDepartmentCode(...args);
  const findActualDepartmentByNameOrCode = (...args) => featureRuntime.findActualDepartmentByNameOrCode(...args);
  const actualDepartmentName = (...args) => featureRuntime.actualDepartmentName(...args);
  const resolveActualDepartmentName = (...args) => featureRuntime.resolveActualDepartmentName(...args);
  const mapActualQuestion = (...args) => featureRuntime.mapActualQuestion(...args);
  const loadActualEmptyState = (...args) => featureRuntime.loadActualEmptyState(...args);
  const createActualConversation = (...args) => featureRuntime.createActualConversation(...args);
  const ensureActualConversation = (...args) => featureRuntime.ensureActualConversation(...args);
  const ensureEditDepartmentMultiUi = (...args) => featureRuntime.ensureEditDepartmentMultiUi(...args);
  const setSecondDepartmentRow = (...args) => featureRuntime.setSecondDepartmentRow(...args);
  const rawSelectedDepartmentCodes = (...args) => featureRuntime.rawSelectedDepartmentCodes(...args);
  const validateEditDepartmentDuplicate = (...args) => featureRuntime.validateEditDepartmentDuplicate(...args);
  const selectedDepartmentCodes = (...args) => featureRuntime.selectedDepartmentCodes(...args);
  const populateEditDepartmentSelects = (...args) => featureRuntime.populateEditDepartmentSelects(...args);
  const loadActualDepartments = (...args) => featureRuntime.loadActualDepartments(...args);
  const getDefaultWorkspaceTitle = (...args) => featureRuntime.getDefaultWorkspaceTitle(...args);
  const showIntakeSkeleton = (...args) => featureRuntime.showIntakeSkeleton(...args);
  const hideIntakeSkeleton = (...args) => featureRuntime.hideIntakeSkeleton(...args);
  const syncWorkspaceMetaToActiveSession = (...args) => featureRuntime.syncWorkspaceMetaToActiveSession(...args);
  const renderWorkspaceMeta = (...args) => featureRuntime.renderWorkspaceMeta(...args);
  const saveWorkspaceMeta = (...args) => featureRuntime.saveWorkspaceMeta(...args);
  const hydrateWorkspaceMeta = (...args) => featureRuntime.hydrateWorkspaceMeta(...args);
  const bindWorkspaceMetaControls = (...args) => featureRuntime.bindWorkspaceMetaControls(...args);
  const renderQueryDetailPanel = (...args) => featureRuntime.renderQueryDetailPanel(...args);
  const restoreCurrentOriginalAfterLayout = (...args) => featureRuntime.restoreCurrentOriginalAfterLayout(...args);
  const isResponsivePanelMode = (...args) => featureRuntime.isResponsivePanelMode(...args);
  const getPanelMinWidth = (...args) => featureRuntime.getPanelMinWidth(...args);
  const applyPanelLayoutState = (...args) => featureRuntime.applyPanelLayoutState(...args);
  const getDefaultPanelLayoutState = (...args) => featureRuntime.getDefaultPanelLayoutState(...args);
  const setPanelCollapsed = (...args) => featureRuntime.setPanelCollapsed(...args);
  const initPanelDragDrop = (...args) => featureRuntime.initPanelDragDrop(...args);
  const initPanelResize = (...args) => featureRuntime.initPanelResize(...args);
  const clearPanelInteractionState = (...args) => featureRuntime.clearPanelInteractionState(...args);
  const resetWorkspaceMetaToDefault = (...args) => featureRuntime.resetWorkspaceMetaToDefault(...args);
  const initClassificationAccessoryTools = (...args) => featureRuntime.initClassificationAccessoryTools(...args);
  const resetActualWorkspaceView = (...args) => featureRuntime.resetActualWorkspaceView(...args);
  const showConversationListSkeleton = (...args) => featureRuntime.showConversationListSkeleton(...args);
  const hideConversationListSkeleton = (...args) => featureRuntime.hideConversationListSkeleton(...args);


  Object.defineProperties(featureRuntime, {
    $: { get: () => $, set: (value) => { $ = value; }, configurable: true },
    $$: { get: () => $$, set: (value) => { $$ = value; }, configurable: true },
    ACTUAL_CONVERSATION_PAGE_SIZE: { get: () => ACTUAL_CONVERSATION_PAGE_SIZE, set: (value) => { ACTUAL_CONVERSATION_PAGE_SIZE = value; }, configurable: true },
    ACTUAL_JOB_POLL_INTERVAL: { get: () => ACTUAL_JOB_POLL_INTERVAL, set: (value) => { ACTUAL_JOB_POLL_INTERVAL = value; }, configurable: true },
    DEFAULT_PANEL_ORDER: { get: () => DEFAULT_PANEL_ORDER, set: (value) => { DEFAULT_PANEL_ORDER = value; }, configurable: true },
    DEFAULT_PANEL_WIDTHS: { get: () => DEFAULT_PANEL_WIDTHS, set: (value) => { DEFAULT_PANEL_WIDTHS = value; }, configurable: true },
    LAYOUT_KEY: { get: () => LAYOUT_KEY, set: (value) => { LAYOUT_KEY = value; }, configurable: true },
    PANEL_MIN_WIDTHS: { get: () => PANEL_MIN_WIDTHS, set: (value) => { PANEL_MIN_WIDTHS = value; }, configurable: true },
    UI_COOKIE_MAX_AGE: { get: () => UI_COOKIE_MAX_AGE, set: (value) => { UI_COOKIE_MAX_AGE = value; }, configurable: true },
    UI_FONT_COOKIE: { get: () => UI_FONT_COOKIE, set: (value) => { UI_FONT_COOKIE = value; }, configurable: true },
    UI_FULLSCREEN_COOKIE: { get: () => UI_FULLSCREEN_COOKIE, set: (value) => { UI_FULLSCREEN_COOKIE = value; }, configurable: true },
    UI_PANEL_LAYOUT_COOKIE: { get: () => UI_PANEL_LAYOUT_COOKIE, set: (value) => { UI_PANEL_LAYOUT_COOKIE = value; }, configurable: true },
    UI_DOC_SPLIT_WIDTH_COOKIE: { get: () => UI_DOC_SPLIT_WIDTH_COOKIE, set: (value) => { UI_DOC_SPLIT_WIDTH_COOKIE = value; }, configurable: true },
    activeFileIndex: { get: () => activeFileIndex, set: (value) => { activeFileIndex = value; }, configurable: true },
    activeQueryIndex: { get: () => activeQueryIndex, set: (value) => { activeQueryIndex = value; }, configurable: true },
    activeSessionId: { get: () => activeSessionId, set: (value) => { activeSessionId = value; }, configurable: true },
    actualConversationId: { get: () => actualConversationId, set: (value) => { actualConversationId = value; }, configurable: true },
    actualConversationItems: { get: () => actualConversationItems, set: (value) => { actualConversationItems = value; }, configurable: true },
    actualConversationLoading: { get: () => actualConversationLoading, set: (value) => { actualConversationLoading = value; }, configurable: true },
    actualConversationPage: { get: () => actualConversationPage, set: (value) => { actualConversationPage = value; }, configurable: true },
    actualConversationPages: { get: () => actualConversationPages, set: (value) => { actualConversationPages = value; }, configurable: true },
    actualConversationRequestSeq: { get: () => actualConversationRequestSeq, set: (value) => { actualConversationRequestSeq = value; }, configurable: true },
    actualSessionLoadSeq: { get: () => actualSessionLoadSeq, set: (value) => { actualSessionLoadSeq = value; }, configurable: true },
    actualConversationSearchTimer: { get: () => actualConversationSearchTimer, set: (value) => { actualConversationSearchTimer = value; }, configurable: true },
    actualConversationStatusMap: { get: () => actualConversationStatusMap, set: (value) => { actualConversationStatusMap = value; }, configurable: true },
    completedConversationIds: { get: () => completedConversationIds, configurable: true },
    actualConversationTotal: { get: () => actualConversationTotal, set: (value) => { actualConversationTotal = value; }, configurable: true },
    actualDepartments: { get: () => actualDepartments, set: (value) => { actualDepartments = value; }, configurable: true },
    actualDocumentViewMode: { get: () => actualDocumentViewMode, set: (value) => { actualDocumentViewMode = value; }, configurable: true },
    actualFileMap: { get: () => actualFileMap, set: (value) => { actualFileMap = value; }, configurable: true },
    actualJobTimers: { get: () => actualJobTimers, set: (value) => { actualJobTimers = value; }, configurable: true },
    actualPendingJobsByConversation: { get: () => actualPendingJobsByConversation, configurable: true },
    classificationWorkspaceEpoch: { get: () => classificationWorkspaceEpoch, set: (value) => { classificationWorkspaceEpoch = value; }, configurable: true },
    actualQuestionRawMap: { get: () => actualQuestionRawMap, set: (value) => { actualQuestionRawMap = value; }, configurable: true },
    actualStatusLabel: { get: () => actualStatusLabel, set: (value) => { actualStatusLabel = value; }, configurable: true },
    apiData: { get: () => apiData, set: (value) => { apiData = value; }, configurable: true },
    bindEvents: { get: () => bindEvents, set: (value) => { bindEvents = value; }, configurable: true },
    classificationCompletionBatchSeq: { get: () => classificationCompletionBatchSeq, set: (value) => { classificationCompletionBatchSeq = value; }, configurable: true },
    classificationPanelLayoutController: { get: () => classificationPanelLayoutController, set: (value) => { classificationPanelLayoutController = value; }, configurable: true },
    classifyRules: { get: () => classifyRules, set: (value) => { classifyRules = value; }, configurable: true },
    confirmedQuerySnapshots: { get: () => confirmedQuerySnapshots, set: (value) => { confirmedQuerySnapshots = value; }, configurable: true },
    currentFilter: { get: () => currentFilter, set: (value) => { currentFilter = value; }, configurable: true },
    docContent: { get: () => docContent, set: (value) => { docContent = value; }, configurable: true },
    documentMetaMap: { get: () => documentMetaMap, set: (value) => { documentMetaMap = value; }, configurable: true },
    drawerBackdrop: { get: () => drawerBackdrop, set: (value) => { drawerBackdrop = value; }, configurable: true },
    drawerClose: { get: () => drawerClose, set: (value) => { drawerClose = value; }, configurable: true },
    editApply: { get: () => editApply, set: (value) => { editApply = value; }, configurable: true },
    editCancel: { get: () => editCancel, set: (value) => { editCancel = value; }, configurable: true },
    editModal: { get: () => editModal, set: (value) => { editModal = value; }, configurable: true },
    editModalClose: { get: () => editModalClose, set: (value) => { editModalClose = value; }, configurable: true },
    editingQuery: { get: () => editingQuery, set: (value) => { editingQuery = value; }, configurable: true },
    featureInstallers: { get: () => featureInstallers, set: (value) => { featureInstallers = value; }, configurable: true },
    featureRuntime: { get: () => featureRuntime, set: (value) => { featureRuntime = value; }, configurable: true },
    fetchJson: { get: () => fetchJson, set: (value) => { fetchJson = value; }, configurable: true },
    fileConfirmState: { get: () => fileConfirmState, set: (value) => { fileConfirmState = value; }, configurable: true },
    fileCount: { get: () => fileCount, set: (value) => { fileCount = value; }, configurable: true },
    fileDataMap: { get: () => fileDataMap, set: (value) => { fileDataMap = value; }, configurable: true },
    fileInput: { get: () => fileInput, set: (value) => { fileInput = value; }, configurable: true },
    fileList: { get: () => fileList, set: (value) => { fileList = value; }, configurable: true },
    init: { get: () => init, set: (value) => { init = value; }, configurable: true },
    lastDocText: { get: () => lastDocText, set: (value) => { lastDocText = value; }, configurable: true },
    logoutBtn: { get: () => logoutBtn, set: (value) => { logoutBtn = value; }, configurable: true },
    mainWrap: { get: () => mainWrap, set: (value) => { mainWrap = value; }, configurable: true },
    maybeNotifyClassificationBatchComplete: { get: () => maybeNotifyClassificationBatchComplete, set: (value) => { maybeNotifyClassificationBatchComplete = value; }, configurable: true },
    normalizeActualStatus: { get: () => normalizeActualStatus, set: (value) => { normalizeActualStatus = value; }, configurable: true },
    notificationDepartmentAssignments: { get: () => notificationDepartmentAssignments, set: (value) => { notificationDepartmentAssignments = value; }, configurable: true },
    notificationDepartmentDirectory: { get: () => notificationDepartmentDirectory, set: (value) => { notificationDepartmentDirectory = value; }, configurable: true },
    notificationOrganizationOrder: { get: () => notificationOrganizationOrder, set: (value) => { notificationOrganizationOrder = value; }, configurable: true },
    originalLayoutRestoreToken: { get: () => originalLayoutRestoreToken, set: (value) => { originalLayoutRestoreToken = value; }, configurable: true },
    queryList: { get: () => queryList, set: (value) => { queryList = value; }, configurable: true },
    questions: { get: () => questions, set: (value) => { questions = value; }, configurable: true },
    recentJobs: { get: () => recentJobs, set: (value) => { recentJobs = value; }, configurable: true },
    runDrawer: { get: () => runDrawer, set: (value) => { runDrawer = value; }, configurable: true },
    runDrawerBtn: { get: () => runDrawerBtn, set: (value) => { runDrawerBtn = value; }, configurable: true },
    runListSearchTerm: { get: () => runListSearchTerm, set: (value) => { runListSearchTerm = value; }, configurable: true },
    runListSortOrder: { get: () => runListSortOrder, set: (value) => { runListSortOrder = value; }, configurable: true },
    sessions: { get: () => sessions, set: (value) => { sessions = value; }, configurable: true },
    showToast: { get: () => showToast, set: (value) => { showToast = value; }, configurable: true },
    sidebar: { get: () => sidebar, set: (value) => { sidebar = value; }, configurable: true },
    sidebarCollapseBtn: { get: () => sidebarCollapseBtn, set: (value) => { sidebarCollapseBtn = value; }, configurable: true },
    sidebarToggle: { get: () => sidebarToggle, set: (value) => { sidebarToggle = value; }, configurable: true },
    toast: { get: () => toast, set: (value) => { toast = value; }, configurable: true },
    uploadZone: { get: () => uploadZone, set: (value) => { uploadZone = value; }, configurable: true },
    uploadedFiles: { get: () => uploadedFiles, set: (value) => { uploadedFiles = value; }, configurable: true },
    workspaceCommon: { get: () => workspaceCommon, set: (value) => { workspaceCommon = value; }, configurable: true },
    workspaceMemberCount: { get: () => workspaceMemberCount, set: (value) => { workspaceMemberCount = value; }, configurable: true },
    workspaceTitle: { get: () => workspaceTitle, set: (value) => { workspaceTitle = value; }, configurable: true }
  });
  Object.assign(featureRuntime, {
    getQuestionStableKey,
    getActiveDisplayNumber,
    clearFileDataMap,
    isClassificationWorkspaceActive,
    registerActualPendingJob,
    unregisterActualPendingJob,
    hasActualPendingJobs,
    syncActiveIntakeSkeleton,
    findUploadedFileByDocumentId,
    loadConversationSettingsV15,
    loadConversationSettingsBatchV18,
    saveConversationSettingsV15,
    setActualConversationFavorite,
    ensureV15DrawerLayoutStyles,
    loadRecentJobs,
    renderWorkLog,
    resetRunDrawerVisibility,
    openDrawer,
    refreshActualConversationStatus,
    updateActualConversationTitle,
    deleteActualConversation,
    syncAfterConversationDelete,
    applyConversationTitleLocal,
    requestConversationRename,
    requestConversationDelete,
    getConversationServerSort,
    getConversationVisibleTitle,
    hydrateConversationListCounts,
    sortConversationItemsByVisibleTitle,
    isLatestConversationSort,
    sortConversationPageItems,
    formatConversationCreatedAt,
    syncRunListSortWidth,
    getLatestWorkedConversationId,
    loadActualConversations,
    renderDrawer,
    loadSession,
    getOriginalQuestionForView,
    buildOriginalPages,
    getDocOriginalWidthBounds,
    resetDocOriginalWidth,
    applyDocOriginalWidth,
    renderDocContentForFile,
    updateDocStatusBar,
    getSecurityModal,
    renderSecurityFileRows,
    showSensitiveFileBlocked,
    showConfidentialFileConfirm,
    validateFilesBeforeUpload,
    getFileQueryCount,
    renderFileList,
    closeFileActionMenus,
    toggleActualFavorite,
    requestFileDelete,
    deleteUploadedFile,
    applyReclassificationToOriginalQuestion,
    submitActualDocument,
    cancelActualDocumentSubmit,
    setActualDocumentFavorite,
    formatActualFileSize,
    actualFileType,
    normalizeActualDocuments,
    addFiles,
    classifyActualDocument,
    pollActualJob,
    loadActualQuestions,
    renderFileStatusBadge,
    loadFileData,
    ensureOriginalViewToggleButton,
    updateOriginalViewToggleButton,
    normalizeOriginalMetaValue,
    extractOriginalDocumentMetaFromHtml,
    extractOriginalDocumentMetaFromObject,
    buildActualDocumentMeta,
    renderActualPdfPreview,
    renderActualDocument,
    getQuerySummary,
    getRecommendOffice,
    getAIReason,
    ensureQueryModifiedTooltip,
    showQueryModifiedTooltip,
    hideQueryModifiedTooltip,
    renderQueryList,
    handleFilterChange,
    updateStepper,
    escapeHtml,
    closeEditModal,
    stopResetInteraction,
    resetAll,
    getActiveConfirmKey,
    createConfirmedQuerySnapshot,
    syncActiveSubmittedConfirmState,
    handleConfirmBtn,
    handleConfirmCancel,
    updateConfirmBtnUI,
    initRuleManagement,
    renderRuleList,
    downloadExcel,
    getCommonActionModal,
    customConfirm,
    customAlert,
    deleteActualQuestion,
    restoreActualQuestion,
    normalizeActualQuestions,
    syncEditTypeControls,
    handleEditTypeManualChange,
    openEditModal,
    applyEdit,
    normalizeNotificationStaff,
    normalizeNotificationSubunits,
    notificationOrganizationName,
    syncNotificationDirectoryFromDepartments,
    resolveNotificationDepartmentName,
    splitNotificationDepartments,
    questionTextWasModified,
    sortedDepartmentIds,
    sameDepartmentIds,
    resolveReclassificationDepartments,
    validateReclassificationDepartments,
    waitForReclassificationJob,
    fetchTextReclassificationResult,
    requestTextReclassification,
    mergeReclassifiedQuestion,
    requestAiReclassification,
    executeAiReclassification,
    buildDefaultNotificationAssignments,
    loadNotificationAssignees,
    saveNotificationAssignees,
    getNotificationDepartmentGroup,
    getNotificationDepartmentsForQueries,
    getNotificationRoutingForQueries,
    updateNotificationAssigneeButton,
    openNotificationAssigneeModal,
    actualDepartmentId,
    actualDepartmentCode,
    findActualDepartmentByNameOrCode,
    actualDepartmentName,
    resolveActualDepartmentName,
    mapActualQuestion,
    loadActualEmptyState,
    createActualConversation,
    ensureActualConversation,
    ensureEditDepartmentMultiUi,
    setSecondDepartmentRow,
    rawSelectedDepartmentCodes,
    validateEditDepartmentDuplicate,
    selectedDepartmentCodes,
    populateEditDepartmentSelects,
    loadActualDepartments,
    getDefaultWorkspaceTitle,
    showIntakeSkeleton,
    hideIntakeSkeleton,
    syncWorkspaceMetaToActiveSession,
    renderWorkspaceMeta,
    saveWorkspaceMeta,
    hydrateWorkspaceMeta,
    bindWorkspaceMetaControls,
    renderQueryDetailPanel,
    restoreCurrentOriginalAfterLayout,
    isResponsivePanelMode,
    getPanelMinWidth,
    applyPanelLayoutState,
    getDefaultPanelLayoutState,
    setPanelCollapsed,
    initPanelDragDrop,
    initPanelResize,
    clearPanelInteractionState,
    resetWorkspaceMetaToDefault,
    initClassificationAccessoryTools,
    resetActualWorkspaceView,
    showConversationListSkeleton,
    hideConversationListSkeleton
  });

  Object.values(featureInstallers).forEach((install) => {
    if (typeof install === "function") install(featureRuntime);
  });


  // ─── Start ───
  // Logout
  const logoutBtn = $('.logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      customConfirm('로그아웃', '로그아웃 하시겠습니까?', () => {
        window.location.href = 'login.html';
      });
    });
  }
  init();
})();
