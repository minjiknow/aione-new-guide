/**
 * AI-ONE 내부 자료 검색 · 작성 지원 (MD_search.jsp)
 *
 * 화면 흐름
 *   ① 왼쪽에서 검색 → 결과 목록
 *   ② 결과를 누르면 가운데에 문서 미리보기
 *   ③ 체크한 문서를 '반영' → 오른쪽 AI 참조 소스로 이동
 *   ④ 오른쪽에서 빠른 작업(요약/검토/변경사항) 또는 자유 요청 → SSE 스트리밍 답변
 *
 * 구조
 *   - draft.js 처럼 여러 모듈로 쪼개지 않고, 이 파일 하나(IIFE) 안에서
 *     [설정] → [상태] → [API] → [렌더링] → [이벤트] → [초기화] 순서로 정리했다.
 *   - 서버 호출은 모두 api 객체에만 모아 두었다. 외부 API 명세가 바뀌면
 *     SearchController 와 api/normalize* 함수만 고치면 된다.
 *   - 목업 모드: URL 에 ?mock=Y 를 붙이면 서버 없이 화면과 흐름을 확인할 수 있다.
 *   - URL 에 ?query=검색어 를 붙이면 진입하자마자 검색한다.
 *
 * 외부 API: DocuRAG API 명세서 v1.6
 *   - 대화 생성(No.2) → 보고서 초안 생성(No.6, SSE) 순서. 같은 대화방에 여러 번 보낼 수 있다.
 *   - AI 참조 소스가 있으면 metadata.doc_ids 로 보내며, 이 턴은 답변서 초안(새 보고서 버전)을 만든다.
 *     명세상 doc_ids 턴은 content 의 다른 지시어를 읽지 않으므로 빠른 작업도 초안 생성으로 처리된다.
 *   - 마지막 청크의 metadata.action(kind·sources) · report(report_id·version)를 말풍선 아래에 표시한다.
 *   - 문서 미리보기: 목업 문서는 본문(markdown), 그 외는 No.23 PDF 미리보기(iframe).
 *
 * 디버그 (전송 버튼 / Enter / 빠른 작업)
 *   - 켜기: URL 에 ?debug=Y  또는  콘솔에서 AIOneSearchDebug.on()  (새로고침 후에도 유지)
 *   - 끄기: 콘솔에서 AIOneSearchDebug.off()
 *   - 콘솔 표시: [AI전송 #번호 +경과ms] 단계  (조각별 수신 로그는 콘솔 'Verbose' 레벨)
 *   - 마지막 전송 기록: AIOneSearchDebug.last  /  최근 20건: AIOneSearchDebug.history
 *   - 서버 로그와 맞춰 보기: 콘솔의 requestId 값 = 서버 로그의 [AI-SEARCH requestId]
 *
 * 기본 구간 형식: Start: 기능명 / End: 기능명
 * 변경 구간 형식: Start: YYMMDD 추가/수정 - 기능명 / End: YYMMDD 추가/수정 - 기능명
 * 주석 정리 내역
 * - 261023 주석 정리 - 구간 표시와 변경 내용 표기를 통일합니다. 기존 작업 날짜와 기능 설명은 유지합니다.
  * 261026 변경 요약
 * - 수정 - 패널 순환·레이아웃 초기화를 common.js로 통합하고 검색 화면 저장소·접힘 상태 후처리만 연결
 */
(function initInternalSearchWorkspace(window, document) {
  "use strict";

  /* =====================================================================
   * 1. 설정
   * ===================================================================== */
  const root = document.getElementById("dsApp");
  if (!root) return;

  /** 배포 확인용 빌드 번호 — MD_search.jsp 의 ?v= 값과 맞춘다 */
  const BUILD = "20261001_0005";

  const params = new URLSearchParams(window.location.search);
  const CONFIG = {
    apiBase: root.dataset.apiBase || "./",
    /** AI-ONE 공통 아이콘 경로 (ai-workspace 퍼블과 동일) */
    iconBase: (root.dataset.contextPath || "") + "/resources/intra/ai/assets/icons/",
    mock: false,
    pageSize: 20,
    debugStorageKey: "ai_one_search_debug"
  };

  const TYPE_LABEL = { hwp: "HWP", pdf: "PDF", xlsx: "XLS", etc: "DOC" };
  /** common.css 의 .file-icon 색상 클래스 (hwp · pdf · xls · txt) */
  const FILE_ICON_CLASS = { hwp: "hwp", pdf: "pdf", xlsx: "xls", etc: "txt" };

  function fileIcon(fileType) {
    return '<span class="file-icon ' + (FILE_ICON_CLASS[fileType] || "txt") + '" aria-hidden="true">' +
      (TYPE_LABEL[fileType] || "DOC") + '</span>';
  }

  /** 명세 No.6 metadata.action.kind 표시 문구 */
  const ACTION_KIND_LABEL = {
    report: "답변서 초안 생성",
    report_edited: "답변서 수정본",
    sources: "추천 자료 재검색",
    download: "파일 링크",
    message: "안내",
    error: "오류"
  };

  /**
  * 빠른 작업 문구 (명세상 doc_ids 가 있는 턴에서는 이 문구가 초안 내용에 반영되지 않는다)
  */
  const QUICK_ACTIONS = {
    summary: "선택한 자료의 핵심 내용을 요약해 주세요.",
    review: "선택한 자료를 바탕으로 검토 의견을 작성해 주세요.",
    changes: "선택한 자료를 비교해 주요 변경사항을 정리해 주세요."
  };

  /* =====================================================================
   * 2. 상태 · 화면 요소
   * ===================================================================== */
  const state = {
    query: "",
    type: "all",
    results: [],
    total: 0,
    searching: false,
    searchSeq: 0,
    checkedIds: new Set(),      // 왼쪽 목록에서 체크한 문서
    sources: new Map(),         // 오른쪽 AI 참조 소스 (doc_id → item)
    activeDocId: "",
    previewSeq: 0,
    previewCache: new Map(),
    conversationId: "",
    streaming: false,
    abortController: null
    /* 글자크기는 AI-ONE 공통 보조도구(accessory-tool)가 --ui-font-scale 로 처리한다. */
  };

  const $ = (id) => document.getElementById(id);
  const el = {
    resetBtn: $("dsResetBtn"),
    resetModal: $("dsResetModal"),
    resetConfirmBtn: $("dsResetConfirmBtn"),

    searchForm: $("dsSearchForm"),
    searchInput: $("dsSearchInput"),
    searchBtn: $("dsSearchBtn"),
    resultCount: $("dsResultCount"),
    resultList: $("dsResultList"),
    resultEmpty: $("dsResultEmpty"),
    selectedCount: $("dsSelectedCount"),
    applyBtn: $("dsApplyBtn"),

    previewPath: $("dsPreviewPath"),
    openOriginalBtn: $("dsOpenOriginalBtn"),
    previewMeta: $("dsPreviewMeta"),
    previewType: $("dsPreviewType"),
    previewDate: $("dsPreviewDate"),
    previewPage: $("dsPreviewPage"),
    previewScroll: $("dsPreviewScroll"),
    previewEmpty: $("dsPreviewEmpty"),
    previewPages: $("dsPreviewPages"),

    sourceCount: $("dsSourceCount"),
    sourceList: $("dsSourceList"),
    sourceGuide: $("dsSourceGuide"),
    chat: $("dsChat"),
    chatEmpty: $("dsChatEmpty"),
    composer: $("dsComposer"),
    chatInput: $("dsChatInput"),
    composerSourceCount: $("dsComposerSourceCount"),
    sendBtn: $("dsSendBtn"),
    toast: $("dsToast"),
    searchCollapseBtn: $("dsSearchCollapseBtn"),
    topbarSourceCount: $("dsTopbarSourceCount")
  };

  /* =====================================================================
   * 3. 공통 도구
   * ===================================================================== */
  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /** 마크다운 → 안전한 HTML. DOMPurify 가 없으면 marked 결과를 쓰지 않는다. */
  function renderMarkdown(markdown) {
    const value = String(markdown || "");
    if (window.marked && typeof window.marked.parse === "function" && window.DOMPurify) {
      return window.DOMPurify.sanitize(window.marked.parse(value, { breaks: true, gfm: true }));
    }
    return escapeHtml(value).replace(/\n/g, "<br>");
  }

  function normalizeFileType(value) {
    const ext = String(value || "").toLowerCase().replace(/^.*\./, "");
    if (ext === "hwp" || ext === "hwpx") return "hwp";
    if (ext === "pdf") return "pdf";
    if (ext === "xls" || ext === "xlsx" || ext === "csv") return "xlsx";
    return "etc";
  }

  function stripExtension(name) {
    return String(name || "").replace(/\.(hwpx?|pdf|xlsx?|csv|docx?|txt|md)$/i, "");
  }

  function formatDate(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.getFullYear() + "." +
      String(date.getMonth() + 1).padStart(2, "0") + "." +
      String(date.getDate()).padStart(2, "0");
  }

  /** 응답이 배열/래핑 객체 어느 쪽이든 key 값을 찾아낸다. */
  function findValue(source, key, depth) {
    const level = depth || 0;
    if (source == null || level > 5) return null;
    if (Array.isArray(source)) {
      for (const item of source) {
        const found = findValue(item, key, level + 1);
        if (found != null && found !== "") return found;
      }
      return null;
    }
    if (typeof source !== "object") return null;
    if (source[key] != null && source[key] !== "") return source[key];
    for (const value of Object.values(source)) {
      const found = findValue(value, key, level + 1);
      if (found != null && found !== "") return found;
    }
    return null;
  }

  function findList(data) {
    if (Array.isArray(data)) {
      if (data.length === 1 && data[0] && Array.isArray(data[0].items)) return data[0].items;
      return data;
    }
    if (data && typeof data === "object") {
      for (const key of ["items", "results", "documents", "data", "list"]) {
        if (Array.isArray(data[key])) return data[key];
        if (data[key] && typeof data[key] === "object") {
          const nested = findList(data[key]);
          if (nested.length) return nested;
        }
      }
    }
    return [];
  }

  let toastTimer = 0;
  function showToast(message) {
    el.toast.textContent = message;
    el.toast.hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => { el.toast.hidden = true; }, 2400);
  }

  function sleep(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  /* ---------------------------------------------------------------------
   * 디버그 로거 (전송 1건 = trace 1개)
   * --------------------------------------------------------------------- */
  const debug = createDebugger();

  function createDebugger() {
    let enabled = params.get("debug") === "Y";
    try {
      if (window.localStorage.getItem(CONFIG.debugStorageKey) === "Y") enabled = true;
    } catch (error) { /* 저장 불가 환경 */ }
    let seq = 0;
    const history = [];
    const noop = { step() {}, verbose() {}, end() {}, record: null };

    const api = {
      get enabled() { return enabled; },
      history: history,
      last: null,
      on() {
        enabled = true;
        try { window.localStorage.setItem(CONFIG.debugStorageKey, "Y"); } catch (error) { /* 무시 */ }
        console.info("[AI전송] 디버그 로그를 켰습니다.");
      },
      off() {
        enabled = false;
        try { window.localStorage.removeItem(CONFIG.debugStorageKey); } catch (error) { /* 무시 */ }
        console.info("[AI전송] 디버그 로그를 껐습니다.");
      },
      /** 전송 1건의 추적을 시작한다. 꺼져 있으면 아무것도 하지 않는 객체를 돌려준다. */
      begin(info) {
        if (!enabled) return noop;
        const id = ++seq;
        const startedAt = performance.now();
        const record = {
          no: id,
          startedAt: new Date().toISOString(),
          trigger: info.trigger,
          request: info,
          requestId: "",
          steps: [],
          events: [],
          text: "",
          result: "진행 중",
          elapsedMs: 0
        };
        history.push(record);
        if (history.length > 20) history.shift();
        api.last = record;
        const prefix = () => "[AI전송 #" + id + " +" + Math.round(performance.now() - startedAt) + "ms]";

        console.log(prefix(), "▶ 시작 (" + info.trigger + ")", info);
        return {
          record: record,
          /** 주요 단계: 콘솔 기본 레벨 */
          step(name, data) {
            record.steps.push({ ms: Math.round(performance.now() - startedAt), step: name, data: data });
            if (data === undefined) console.log(prefix(), name);
            else console.log(prefix(), name, data);
          },
          /** 조각 단위 로그: 콘솔 'Verbose' 레벨 (많아서 기본 숨김) */
          verbose(name, data) {
            record.events.push({ ms: Math.round(performance.now() - startedAt), type: name, data: data });
            console.debug(prefix(), name, data);
          },
          end(result, extra) {
            record.result = result;
            record.elapsedMs = Math.round(performance.now() - startedAt);
            console.groupCollapsed(prefix() + " ■ 종료: " + result + " (" + record.elapsedMs + "ms)");
            console.log("요청", record.request);
            if (record.requestId) console.log("서버 requestId", record.requestId);
            console.table(record.steps.map((item) => ({ ms: item.ms, 단계: item.step })));
            if (record.events.length) {
              console.log("수신 이벤트 " + record.events.length + "건 (AIOneSearchDebug.last.events)");
            }
            console.log("최종 답변 (" + record.text.length + "자)\n" + record.text);
            if (extra) console.log("추가 정보", extra);
            console.groupEnd();
          }
        };
      }
    };
    window.AIOneSearchDebug = api;
    return api;
  }

  /* =====================================================================
   * 4. 응답 정규화 (외부 API 명세가 바뀌면 여기만 고친다)
   * ===================================================================== */
  function normalizeSearchItem(raw) {
    const fileName = raw.name || raw.file_name || raw.fileName || raw.title || "";
    return {
      docId: String(raw.file_id || raw.doc_id || raw.docId || raw.document_id || raw.id || ""),
      title: raw.name || raw.title || fileName || "제목 없음",
      fileType: normalizeFileType(raw.file_type || raw.fileType || raw.extension || fileName),
      summary: raw.summary || raw.snippet || raw.description || "",
      dept: raw.dept || raw.department || raw.org || "",
      updatedAt: raw.modified_at || raw.updated_at || raw.updatedAt || raw.created_at || "",
      path: raw.path || "",
      score: raw.score
    };
  }

  function normalizeDocument(raw, fallback) {
    const doc = Array.isArray(raw) ? raw[0] || {} : (raw && (raw.data || raw.document)) || raw || {};
    const base = fallback || {};
    const path = Array.isArray(doc.path) ? doc.path.join(" / ") : (doc.path || base.path || "");
    const pages = Array.isArray(doc.pages) && doc.pages.length
      ? doc.pages.map((page) => (typeof page === "string" ? page : page.content || ""))
      : [doc.content || doc.body || doc.text || ""];
    return {
      docId: String(doc.doc_id || doc.id || base.docId || ""),
      title: doc.title || base.title || "",
      org: doc.org || doc.subtitle || doc.organization || "",
      fileType: normalizeFileType(doc.file_type || doc.file_name || base.fileType),
      updatedAt: doc.updated_at || doc.updatedAt || base.updatedAt || "",
      path: path,
      pageCount: Number(doc.page_count || doc.pageCount || pages.length) || pages.length,
      pages: pages,
      highlights: Array.isArray(doc.highlights) ? doc.highlights : [],
      // No.23 PDF 미리보기 (목업이 아닌 실제 문서)
      previewUrl: doc.preview_type === "pdf" && doc.preview_url ? String(doc.preview_url) : ""
    };
  }

  /* =====================================================================
   * 5. API (실서버 / 목업)
   * ===================================================================== */
  async function requestJson(url, options) {
    const response = await fetch(CONFIG.apiBase + url, Object.assign({ credentials: "same-origin" }, options || {}));
    const text = await response.text();
    if (!response.ok) {
      // 서버가 { message, detail, hint } JSON 으로 원인을 보내면 그대로 보여준다.
      let body = null;
      try { body = text ? JSON.parse(text) : null; } catch (error) { body = null; }
      const message = (body && body.message) || ("요청 실패 (" + response.status + ")");
      console.error("[서버 오류] " + response.status + " " + url, body || text.slice(0, 500));
      if (body && body.hint) console.warn("[해결 방법] " + body.hint);
      const error = new Error(message);
      error.status = response.status;
      error.body = body;
      throw error;
    }
    try {
      return text ? JSON.parse(text) : null;
    } catch (error) {
      throw new Error("응답 형식이 올바르지 않습니다.");
    }
  }

  const serverApi = {
    async search(query, type) {
      const qs = new URLSearchParams({ query: query, type: type, sort: "score", page: "1", size: String(CONFIG.pageSize) });
      const data = await requestJson("ND_documentSearch.do?" + qs.toString());
      const items = findList(data).map(normalizeSearchItem).filter((item) => item.docId);
      const total = Number(findValue(data, "total") || findValue(data, "total_count")) || items.length;
      return { items: items, total: total };
    },
    async getDocument(docId, fallback) {
      const access = await requestJson("ND_documentAccess.do?docId=" + encodeURIComponent(docId));
      const permission = (access && access.items || [])[0];
      if (!permission || Number(permission.can_read) !== 1) throw new Error("이 문서에 대한 조회 권한이 없습니다.");
      const data = await requestJson("ND_documentPreview.do?docId=" + encodeURIComponent(docId));
      return normalizeDocument(data, fallback);
    },
    async createConversation(title) {
      const data = await requestJson("ND_conversation.do?title=" + encodeURIComponent(title), { method: "POST" });
      const id = findValue(data, "conversation_id") || findValue(data, "id");
      if (!id) throw new Error("대화를 생성하지 못했습니다.");
      return String(id);
    },
    async stream(payload, handlers, signal) {
      const trace = handlers.trace;
      const url = CONFIG.apiBase + "ND_sendConversation.do";
      trace.step("③ SSE 요청 전송 POST " + url, payload);
      const response = await fetch(url, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json;charset=UTF-8", "Accept": "text/event-stream" },
        body: JSON.stringify(payload),
        signal: signal
      });
      const requestId = response.headers.get("X-AI-Request-Id") || "";
      trace.record && (trace.record.requestId = requestId);
      trace.step("④ 응답 헤더 수신", {
        status: response.status,
        contentType: response.headers.get("Content-Type"),
        requestId: requestId || "(헤더 없음)",
        redirected: response.redirected,
        finalUrl: response.url
      });
      if (!response.ok || !response.body) {
        throw new Error("AI 요청 실패 (" + response.status + ")");
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let firstChunk = true;
      for (;;) {
        const result = await reader.read();
        if (firstChunk && result.value) {
          firstChunk = false;
          trace.step("⑤ 첫 데이터 수신 (" + result.value.length + " bytes)");
        }
        buffer += decoder.decode(result.value || new Uint8Array(), { stream: !result.done });
        buffer = buffer.replace(/\r\n/g, "\n");
        let index;
        while ((index = buffer.indexOf("\n\n")) !== -1) {
          const rawEvent = buffer.slice(0, index);
          buffer = buffer.slice(index + 2);
          if (dispatchSseEvent(rawEvent, handlers)) return;
        }
        if (result.done) {
          if (buffer.trim()) {
            trace.step("스트림 종료 후 남은 데이터 처리", buffer);
            dispatchSseEvent(buffer, handlers);
          }
          trace.step("⑥ 스트림 종료 (서버 연결 닫힘)");
          return;
        }
      }
    }
  };

  /** @return true 이면 스트림 종료 */
  function dispatchSseEvent(rawEvent, handlers) {
    let eventName = "message";
    const dataLines = [];
    rawEvent.split("\n").forEach((line) => {
      if (line.startsWith("event:")) eventName = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).replace(/^ /, ""));
    });
    const dataText = dataLines.join("\n");
    const trace = handlers.trace;
    trace.verbose("SSE event:" + eventName, dataText);
    if (eventName === "done") {
      trace.step("⑥ done 이벤트 수신");
      return true;
    }
    let data = null;
    try {
      data = dataText ? JSON.parse(dataText) : null;
    } catch (error) {
      trace.step("⚠ JSON 파싱 실패 (원문 그대로 사용)", dataText);
      data = dataText;
    }
    if (eventName === "error") {
      trace.step("✖ error 이벤트 수신", data);
      throw new Error((data && data.message) || "AI 응답 처리 중 오류가 발생했습니다.");
    }
    if (!data || typeof data !== "object") return false;
    if (data.type === "stage") {
      handlers.onStage(data.label || "");
      return false;
    }
    if (data.type === "trace") {
      // 명세: 지나온 단계 전부 {label, ms}. 본문 뒤에 1장 온다.
      const steps = Array.isArray(data.steps) ? data.steps : [];
      trace.step("진행 단계 요약(trace) " + steps.length + "단계", steps);
      // trace 는 디버그 모드와 관계없이 항상 콘솔에 남긴다.
      console.info("[AI전송] trace 수신 " + steps.length + "단계", steps);
      if (steps.length && typeof console.table === "function") {
        console.table(steps.map((item) => ({ 단계: item.label, 소요ms: item.ms })));
      }
      if (handlers.onTrace) handlers.onTrace(steps);
      return false;
    }
    if (data.type) {
      trace.step("명세에 없는 프레임 무시: " + data.type);
      return false;
    }
    if (data.content) handlers.onDelta(String(data.content), data.replace_content === true);
    if (data.metadata) handlers.onMeta(data.metadata);
    return false;
  }

  const api = serverApi;

  /* =====================================================================
   * 6. 렌더링
   * ===================================================================== */
  function renderSkeleton() {
    el.resultEmpty.hidden = true;
    el.resultList.innerHTML = Array.from({ length: 4 }, () =>
      '<li class="ds-skeleton" aria-hidden="true"><span class="sk-badge"></span>' +
      '<div class="sk-lines"><span class="sk-line"></span><span class="sk-line"></span><span class="sk-line"></span></div></li>'
    ).join("");
  }

  function renderResults() {
    el.resultCount.textContent = String(state.total);
    if (!state.results.length) {
      el.resultList.innerHTML = "";
      el.resultEmpty.hidden = false;
      el.resultEmpty.querySelector("strong").textContent = state.query
        ? "검색 결과가 없습니다"
        : "검색어를 입력해 주세요";
      el.resultEmpty.querySelector("span").textContent = state.query
        ? "다른 검색어나 파일 유형으로 다시 검색해 보세요."
        : "문서명, 부서, 내용으로 내부 자료를 찾을 수 있습니다.";
      renderSelectionFooter();
      return;
    }
    el.resultEmpty.hidden = true;
    el.resultList.innerHTML = state.results.map((item) => {
      const checked = state.checkedIds.has(item.docId);
      const active = state.activeDocId === item.docId;
      const applied = state.sources.has(item.docId);
      return (
        '<li class="ds-result-item' + (active ? " is-active" : "") + '" tabindex="0" role="button"' +
        ' data-doc-id="' + escapeHtml(item.docId) + '" aria-current="' + (active ? "true" : "false") + '">' +
          '<input type="checkbox" data-doc-check aria-label="' + escapeHtml(item.title) + ' 선택"' + (checked ? " checked" : "") + ' />' +
          fileIcon(item.fileType) +
          '<div class="ds-result-body">' +
            '<p class="ds-result-title">' + escapeHtml(item.title) + '</p>' +
            (item.summary ? '<p class="ds-result-summary-text">' + escapeHtml(item.summary) + '</p>' : "") +
            '<div class="ds-result-meta">' +
              (item.dept ? '<span>' + escapeHtml(item.dept) + '</span>' : "") +
              (item.updatedAt ? '<span>' + escapeHtml(formatDate(item.updatedAt)) + '</span>' : "") +
              (applied ? '<span class="ds-applied-badge">반영됨</span>' : "") +
            '</div>' +
          '</div>' +
        '</li>'
      );
    }).join("");
    renderSelectionFooter();
  }

  function renderSelectionFooter() {
    const count = state.checkedIds.size;
    el.selectedCount.textContent = String(count);
    el.applyBtn.disabled = count === 0;
  }

  function renderPreviewEmpty() {
    el.previewEmpty.hidden = false;
    el.previewPages.innerHTML = "";
    el.previewMeta.hidden = true;
    el.previewPath.textContent = "문서를 선택하면 경로가 표시됩니다.";
    el.openOriginalBtn.disabled = true;
  }

  function renderPreviewLoading(item) {
    el.previewEmpty.hidden = true;
    el.previewPath.textContent = item.path || item.title;
    el.previewMeta.hidden = false;
    el.previewType.textContent = TYPE_LABEL[item.fileType];
    el.previewType.dataset.type = item.fileType;
    el.previewDate.textContent = item.updatedAt ? "최근 수정 " + formatDate(item.updatedAt) : "";
    el.previewPage.textContent = "";
    el.previewPages.innerHTML =
      '<div class="ds-page ds-page-state"><div class="ds-empty"><span class="ds-dots"><i></i><i></i><i></i></span>' +
      '<span>문서를 불러오고 있습니다.</span></div></div>';
  }

  function renderPreview(doc) {
    el.previewEmpty.hidden = true;
    el.previewPath.textContent = doc.path || doc.title;
    el.previewPath.title = doc.path || doc.title;
    el.previewMeta.hidden = false;
    el.previewType.textContent = TYPE_LABEL[doc.fileType];
    el.previewType.dataset.type = doc.fileType;
    el.previewDate.textContent = doc.updatedAt ? "최근 수정 " + formatDate(doc.updatedAt) : "";
    el.openOriginalBtn.disabled = true;

    if (doc.previewUrl) {
      // 명세 No.23: application/pdf 를 브라우저 PDF 뷰어로 띄운다. (첫 호출은 변환 때문에 수 초 걸릴 수 있음)
      el.previewPage.textContent = "PDF";
      el.previewPages.innerHTML =
        '<iframe class="ds-pdf-frame" title="' + escapeHtml(doc.title || "문서 미리보기") + '" src="' +
        escapeHtml(CONFIG.apiBase + doc.previewUrl) + '"></iframe>';
      return;
    }

    if (!doc.pages.some((page) => String(page).trim())) {
      el.previewPages.innerHTML = '<div class="ds-page ds-page-state"><div class="ds-empty"><strong>파일 정보 조회 완료</strong><span>지능화검색 API v1.1은 본문 미리보기와 원본 다운로드를 제공하지 않습니다.</span></div></div>';
      el.previewPage.textContent = "-";
      return;
    }
    el.previewPages.innerHTML = doc.pages.map((content, index) =>
      '<article class="web-doc-page ds-page" data-page-index="' + (index + 1) + '">' +
        (index === 0
          ? '<header class="web-doc-header">' +
              '<h3 class="ds-page-title">' + escapeHtml(stripExtension(doc.title)) + '</h3>' +
              (doc.org ? '<p class="ds-page-org">' + escapeHtml(doc.org) + '</p>' : "") +
            '</header>'
          : "") +
        '<div class="web-doc-body ds-page-body">' + renderMarkdown(content) + '</div>' +
        '<footer class="web-doc-page-footer ds-page-foot">- ' + (index + 1) + ' -</footer>' +
      '</article>'
    ).join("");
    doc.highlights.forEach((phrase) => highlightText(el.previewPages, phrase));
    el.previewScroll.scrollTop = 0;
    updatePageIndicator(doc);
  }

  /** 렌더링된 DOM 의 텍스트 노드에서 phrase 를 찾아 <mark> 로 감싼다. (HTML 문자열 치환 X) */
  function highlightText(container, phrase) {
    const needle = String(phrase || "").trim();
    if (!needle) return;
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    const targets = [];
    while (walker.nextNode()) {
      if (walker.currentNode.nodeValue.includes(needle)) targets.push(walker.currentNode);
    }
    targets.forEach((node) => {
      const parts = node.nodeValue.split(needle);
      const fragment = document.createDocumentFragment();
      parts.forEach((part, index) => {
        if (part) fragment.appendChild(document.createTextNode(part));
        if (index < parts.length - 1) {
          const mark = document.createElement("mark");
          mark.textContent = needle;
          fragment.appendChild(mark);
        }
      });
      node.parentNode.replaceChild(fragment, node);
    });
  }

  let currentPreviewDoc = null;
  function updatePageIndicator(doc) {
    const target = doc || currentPreviewDoc;
    if (!target) return;
    const pages = el.previewPages.querySelectorAll(".web-doc-page");
    let current = 1;
    const top = el.previewScroll.getBoundingClientRect().top;
    pages.forEach((page, index) => {
      if (page.getBoundingClientRect().top - top < el.previewScroll.clientHeight / 2) current = index + 1;
    });
    el.previewPage.textContent = current + " / " + Math.max(target.pageCount, pages.length);
  }

  function renderSources() {
    const items = Array.from(state.sources.values());
    el.sourceCount.textContent = String(items.length);
    el.composerSourceCount.textContent = String(items.length);
    if (el.topbarSourceCount) el.topbarSourceCount.textContent = String(items.length);
    el.sourceGuide.hidden = items.length > 0;
    el.sourceList.innerHTML = items.map((item) =>
      // common.css .selected-refs-list li (ref-name · ref-remove) 구조
      '<li class="ds-source-item">' +
        fileIcon(item.fileType) +
        '<span class="ref-name" title="' + escapeHtml(item.title) + '">' + escapeHtml(item.title) + '</span>' +
        '<button type="button" class="ref-remove" data-source-remove="' + escapeHtml(item.docId) + '"' +
        ' aria-label="' + escapeHtml(item.title) + ' 참조 해제" title="참조 해제">×</button>' +
      '</li>'
    ).join("");
  }

  function syncSendButton() {
    if (state.streaming) {
      el.sendBtn.disabled = false;
      el.sendBtn.classList.add("is-stop");
      el.sendBtn.setAttribute("aria-label", "응답 중지");
      el.sendBtn.title = "응답 중지";
      el.sendBtn.innerHTML = '<svg class="icon icon-text" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor"/></svg>';
    } else {
      el.sendBtn.disabled = !el.chatInput.value.trim();
      el.sendBtn.classList.remove("is-stop");
      el.sendBtn.setAttribute("aria-label", "전송");
      el.sendBtn.title = "전송";
      el.sendBtn.innerHTML = '<img class="icon icon-text" src="' + CONFIG.iconBase + 'send.svg" alt="" aria-hidden="true" data-icon="send" />';
    }
    document.querySelectorAll("[data-quick-action]").forEach((button) => {
      button.disabled = state.streaming;
    });
  }

  function syncChatInputHeight() {
    el.chatInput.style.height = "auto";
    el.chatInput.style.height = Math.min(160, Math.max(40, el.chatInput.scrollHeight)) + "px";
  }

  function scrollChatToBottom() {
    el.chat.scrollTop = el.chat.scrollHeight;
  }

  /** 말풍선 하단 시각 (AI-ONE 공통 chat-msg 의 msg-time 과 동일 형식 HH:mm) */
  function nowTime() {
    const d = new Date();
    return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }

  function appendTime(node) {
    const time = document.createElement("span");
    time.className = "msg-time";
    time.textContent = nowTime();
    node.appendChild(time);
  }

  function appendUserMessage(text) {
    el.chatEmpty.hidden = true;
    const node = document.createElement("div");
    node.className = "chat-msg user ds-msg ds-msg-user";
    const body = document.createElement("div");
    body.className = "msg-text";
    body.textContent = text;
    node.appendChild(body);
    appendTime(node);
    el.chat.appendChild(node);
    scrollChatToBottom();
  }

  function createAssistantMessage(sourceTitles) {
    const node = document.createElement("div");
    node.className = "chat-msg ai ds-msg ds-msg-ai";
    node.innerHTML =
      '<div class="msg-text">' +
        '<div class="ds-msg-status"><span class="ds-dots"><i></i><i></i><i></i></span>' +
        '<span data-status-text>' + (sourceTitles.length ? "선택자료를 분석하고 있습니다." : "답변을 준비하고 있습니다.") + '</span></div>' +
        '<div class="ds-msg-content" hidden></div>' +
      '</div>';
    el.chat.appendChild(node);
    scrollChatToBottom();

    let text = "";
    let renderQueued = false;
    const status = node.querySelector(".ds-msg-status");
    const statusText = node.querySelector("[data-status-text]");
    const content = node.querySelector(".ds-msg-content");

    function flush() {
      renderQueued = false;
      content.innerHTML = renderMarkdown(text);
      window.AIOneChatBlocks?.decorate(content);
      scrollChatToBottom();
    }

    return {
      stage(label) {
        if (label) statusText.textContent = label;
      },
      delta(chunk, replace) {
        text = replace ? chunk : text + chunk;
        status.hidden = true;
        content.hidden = false;
        // 청크마다 마크다운을 다시 그리면 무거우므로 프레임 단위로 묶는다.
        if (!renderQueued) {
          renderQueued = true;
          window.requestAnimationFrame(flush);
        }
      },
      finish(meta, traceSteps) {
        if (renderQueued) flush();
        status.hidden = true;
        content.hidden = false;
        if (!text.trim()) {
          content.innerHTML = '<p>응답 내용이 없습니다.</p>';
        }
        if (sourceTitles.length) {
          const metaBox = document.createElement("div");
          metaBox.className = "ds-msg-meta";
          metaBox.innerHTML = sourceTitles.map((title) => '<span>' + escapeHtml(title) + '</span>').join("");
          node.appendChild(metaBox);
        }
        renderTurnResult(node, meta);
        renderTraceSteps(node, traceSteps);
        appendTime(node);
        if (text.trim()) {
          // AI-ONE 공통 채팅 복사 버튼과 동일 마크업
          const actions = document.createElement("div");
          actions.className = "msg-actions chat-copy-actions";
          actions.innerHTML =
            '<button type="button" class="msg-action-btn chat-copy-btn" data-copy aria-label="메시지 복사" title="복사">' +
              '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>' +
              '<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>' +
            '</button>';
          actions.querySelector("[data-copy]").addEventListener("click", () => copyText(text));
          node.appendChild(actions);
        }
        scrollChatToBottom();
      },
      stopped() {
        if (renderQueued) flush();
        status.hidden = true;
        content.hidden = false;
        content.insertAdjacentHTML("beforeend", '<p class="ds-msg-stopped">(응답을 중지했습니다)</p>');
      },
      fail(message) {
        node.className = "chat-msg ai ds-msg ds-msg-error";
        node.innerHTML = "";
        const body = document.createElement("div");
        body.className = "msg-text";
        body.textContent = message;
        node.appendChild(body);
        appendTime(node);
      }
    };
  }

  /**
  * 명세 No.6 마지막 청크의 metadata 를 말풍선 아래에 표시한다.
  *  - action.kind   : 턴 종류 (report · sources · message · error …)
  *  - action.notice : 단계별 안내 문면
  *  - action.sources: 유사답변서 추천 목록 (doc_id · title · score)
  *  - report        : { report_id, version, title } → 답변서 화면에서 이어서 편집
  */
  function renderTurnResult(node, meta) {
    if (!meta || typeof meta !== "object") return;
    const action = meta.action && typeof meta.action === "object" ? meta.action : null;
    const report = meta.report && meta.report.report_id ? meta.report : null;
    if (!action && !report) return;

    const box = document.createElement("div");
    box.className = "ds-turn-result";
    const parts = [];
    if (action && action.kind) {
      parts.push('<span class="ds-turn-kind" data-kind="' + escapeHtml(action.kind) + '">' +
        escapeHtml(ACTION_KIND_LABEL[action.kind] || action.kind) + '</span>');
    }
    if (report) {
      parts.push('<span class="ds-turn-report">보고서 v' + escapeHtml(report.version || 1) +
        (report.title ? ' · ' + escapeHtml(report.title) : "") + '</span>');
    }
    if (action && action.notice) {
      parts.push('<p class="ds-turn-notice">' + escapeHtml(action.notice) + '</p>');
    }
    if (action && Array.isArray(action.sources) && action.sources.length) {
      parts.push('<div class="ds-turn-sources"><strong>추천 유사답변서 ' + action.sources.length + '건</strong><ul>' +
        action.sources.slice(0, 5).map((src) =>
          '<li>' + escapeHtml(src.title || src.doc_id) +
          (src.score != null ? ' <em>' + escapeHtml(Number(src.score).toFixed(1)) + '%</em>' : "") + '</li>'
        ).join("") + '</ul></div>');
    }
    if (action && action.download && action.download.url) {
      parts.push('<a class="ds-turn-link" href="' + escapeHtml(action.download.url) + '" target="_blank" rel="noopener">' +
        escapeHtml(action.download.file_name || "파일 받기") + '</a>');
    }
    if (report && state.conversationId && !CONFIG.mock) {
      // 같은 대화를 답변서 화면에서 열어 편집 · 버전 관리 · 다운로드를 이어간다.
      const answerUrl = (root.dataset.contextPath || "") + "/intra/ai/answer/MD_answer.do?conversationId=" +
        encodeURIComponent(state.conversationId);
      parts.push('<a class="ds-turn-link" href="' + escapeHtml(answerUrl) + '">답변서 화면에서 열기</a>');
    }
    box.innerHTML = parts.join("");
    node.appendChild(box);
    if (action && action.kind === "error") {
      node.classList.add("ds-msg-warn");
    }
  }

  /**
  * 명세 No.6 trace 프레임 (지나온 단계 전부 {label, ms}) 을 접힌 목록으로 보여준다.
  */
  function renderTraceSteps(node, steps) {
    if (!Array.isArray(steps) || !steps.length) return;
    const totalMs = steps.reduce((sum, item) => sum + (Number(item.ms) || 0), 0);
    const details = document.createElement("details");
    details.className = "ds-trace";
    details.innerHTML =
      '<summary>처리 과정 ' + steps.length + '단계 · 총 ' + (totalMs / 1000).toFixed(1) + '초</summary>' +
      '<ol>' + steps.map((item) =>
        '<li><span>' + escapeHtml(item.label || "-") + '</span><em>' +
        ((Number(item.ms) || 0) / 1000).toFixed(1) + '초</em></li>'
      ).join("") + '</ol>';
    node.appendChild(details);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      showToast("답변을 복사했습니다.");
    } catch (error) {
      showToast("이 환경에서는 복사를 사용할 수 없습니다.");
    }
  }

  /* =====================================================================
   * 7. 동작
   * ===================================================================== */
  async function runSearch(query) {
    const keyword = String(query || "").trim();
    if (!keyword) {
      showToast("검색어를 입력해 주세요.");
      el.searchInput.focus();
      return;
    }
    const seq = ++state.searchSeq;
    state.query = keyword;
    state.searching = true;
    el.searchBtn.disabled = true;
    renderSkeleton();
    try {
      const result = await api.search(keyword, state.type);
      if (seq !== state.searchSeq) return; // 늦게 도착한 이전 검색 결과는 버린다.
      state.results = result.items;
      state.total = result.total;
      // 새 결과에 없는 문서는 체크 해제
      const ids = new Set(result.items.map((item) => item.docId));
      state.checkedIds.forEach((id) => { if (!ids.has(id)) state.checkedIds.delete(id); });
      renderResults();
      if (result.items.length && (!state.activeDocId || !ids.has(state.activeDocId))) {
        openPreview(result.items[0].docId);
      }
    } catch (error) {
      if (seq !== state.searchSeq) return;
      console.error("[내부 자료 검색] 실패", error);
      state.results = [];
      state.total = 0;
      renderResults();
      showToast("검색 중 오류가 발생했습니다. " + error.message);
    } finally {
      if (seq === state.searchSeq) {
        state.searching = false;
        el.searchBtn.disabled = false;
      }
    }
  }

  function findResult(docId) {
    return state.results.find((item) => item.docId === docId) || state.sources.get(docId) || null;
  }

  async function openPreview(docId) {
    const item = findResult(docId);
    if (!item) return;
    state.activeDocId = docId;
    renderResults();
    const seq = ++state.previewSeq;
    if (state.previewCache.has(docId)) {
      currentPreviewDoc = state.previewCache.get(docId);
      renderPreview(currentPreviewDoc);
      return;
    }
    renderPreviewLoading(item);
    try {
      const doc = await api.getDocument(docId, item);
      state.previewCache.set(docId, doc);
      if (seq !== state.previewSeq) return;
      currentPreviewDoc = doc;
      renderPreview(doc);
    } catch (error) {
      if (seq !== state.previewSeq) return;
      console.error("[문서 미리보기] 실패", error);
      el.previewPages.innerHTML =
        '<div class="ds-page ds-page-state"><div class="ds-empty"><strong>문서를 불러오지 못했습니다</strong>' +
        '<span>' + escapeHtml(error.message) + '</span></div></div>';
    }
  }

  function toggleChecked(docId, checked) {
    if (checked) state.checkedIds.add(docId);
    else state.checkedIds.delete(docId);
    renderSelectionFooter();
  }

  function applySelected() {
    let added = 0;
    state.checkedIds.forEach((docId) => {
      const item = findResult(docId);
      if (item && !state.sources.has(docId)) {
        state.sources.set(docId, item);
        added += 1;
      }
    });
    state.checkedIds.clear();
    renderSources();
    renderResults();
    showToast(added ? added + "건을 AI 참조 소스에 반영했습니다." : "이미 반영된 자료입니다.");
  }

  function removeSource(docId) {
    state.sources.delete(docId);
    renderSources();
    renderResults();
  }

  async function ensureConversation(firstText, trace) {
    if (state.conversationId) {
      trace.step("② 기존 대화방 사용", state.conversationId);
      return state.conversationId;
    }
    const title = firstText.length > 30 ? firstText.slice(0, 30) + "…" : firstText;
    trace.step("② 대화방 생성 요청 POST ND_conversation.do", { title: title });
    state.conversationId = await api.createConversation(title);
    trace.step("② 대화방 생성 완료", state.conversationId);
    return state.conversationId;
  }

  async function sendRequest(text, action, trigger) {
    const content = String(text || "").trim();
    const sources = Array.from(state.sources.values());
    const skip = !content ? "입력값 없음"
      : state.streaming ? "이미 응답 수신 중"
      : (action && !sources.length) ? "빠른 작업인데 AI 참조 소스 없음"
      : "";
    if (skip) {
      if (debug.enabled) console.warn("[AI전송] 전송하지 않음:", skip, { trigger: trigger, content: content, action: action });
      if (skip === "빠른 작업인데 AI 참조 소스 없음") {
        showToast("먼저 왼쪽에서 문서를 선택하고 ‘선택자료 반영’을 눌러주세요.");
      }
      return;
    }
    const trace = debug.begin({
      trigger: trigger || "알 수 없음",
      content: content,
      action: action || null,
      conversationId: state.conversationId || "(없음 → 새로 생성)",
      sources: sources.map((item) => ({ docId: item.docId, title: item.title, type: item.fileType })),
      mock: CONFIG.mock
    });
    if (sources.length && debug.enabled) {
      console.table(sources.map((item) => ({ docId: item.docId, 제목: item.title })));
    }
    appendUserMessage(content);
    el.chatInput.value = "";
    syncChatInputHeight();

    const message = createAssistantMessage(sources.map((item) => item.title));
    const controller = new AbortController();
    state.streaming = true;
    state.abortController = controller;
    syncSendButton();
    trace.step("① 화면 준비 완료 (사용자 말풍선 추가, 버튼 → 중지)");
    let lastMeta = null;
    let traceSteps = [];
    let deltaCount = 0;
    let stageCount = 0;
    let fullText = "";
    try {
      const conversationId = await ensureConversation(content, trace);
      await api.stream(
        {
          conversation_id: conversationId,
          content: content,
          // 명세 No.6: 확정 문서는 metadata.doc_ids 로 (서버가 변환). "action" 필드는 명세에 없어 보내지 않는다.
          doc_ids: sources.map((item) => item.docId)
        },
        {
          trace: trace,
          onTrace: (steps) => { traceSteps = steps; },
          onStage: (label) => {
            stageCount += 1;
            trace.step("진행 단계: " + label);
            message.stage(label);
          },
          onDelta: (chunk, replace) => {
            deltaCount += 1;
            fullText = replace ? chunk : fullText + chunk;
            if (deltaCount === 1) trace.step("첫 답변 조각 수신");
            if (replace) trace.step("답변 전체 교체 (replace_content=true)", chunk.length + "자");
            trace.verbose("답변 조각 #" + deltaCount, chunk);
            message.delta(chunk, replace);
          },
          onMeta: (meta) => {
            // 명세: action · references · report 는 마지막 청크에만 실린다. 앞 청크의 tokens 등은 덮어쓰지 않게 합친다.
            lastMeta = Object.assign({}, lastMeta || {}, meta);
            if (meta && meta.report) trace.step("보고서 생성 report", meta.report);
            if (meta && meta.action) trace.step("턴 결과 action.kind=" + meta.action.kind, meta.action);
            if (!meta.report && !meta.action) trace.verbose("metadata", meta);
          }
        },
        controller.signal
      );
      message.finish(lastMeta, traceSteps);
      // 이번 턴의 수신 요약 (항상 출력) — trace 가 안 보일 때 원인 확인용
      console.info("[AI전송] 턴 요약", {
        stage: stageCount,
        답변조각: deltaCount,
        report: lastMeta && lastMeta.report ? lastMeta.report : "없음",
        actionKind: lastMeta && lastMeta.action ? lastMeta.action.kind : "없음",
        trace: traceSteps.length ? traceSteps.length + "단계" : "없음 (서버가 이번 턴에 trace 를 보내지 않음)"
      });
      if (trace.record) trace.record.text = fullText;
      trace.end("성공", { 진행단계: stageCount, 답변조각: deltaCount, 글자수: fullText.length, metadata: lastMeta, trace: traceSteps });
    } catch (error) {
      if (trace.record) trace.record.text = fullText;
      if (error && error.name === "AbortError") {
        message.stopped();
        trace.end("사용자 중지", { 답변조각: deltaCount, 글자수: fullText.length });
      } else {
        console.error("[AI 작성 지원] 실패", error);
        message.fail(error.message || "AI 응답 처리 중 오류가 발생했습니다.");
        trace.end("실패: " + (error && error.message), { error: error, 답변조각: deltaCount });
      }
    } finally {
      state.streaming = false;
      state.abortController = null;
      syncSendButton();
    }
  }

  function resetWorkspace() {
    if (state.abortController) state.abortController.abort();
    state.searchSeq += 1;
    state.previewSeq += 1;
    state.query = "";
    state.type = "all";
    state.results = [];
    state.total = 0;
    state.checkedIds.clear();
    state.sources.clear();
    state.activeDocId = "";
    state.conversationId = "";
    currentPreviewDoc = null;
    el.searchInput.value = "";
    el.chatInput.value = "";
    el.searchBtn.disabled = false;
    document.querySelectorAll("[data-type-filter]").forEach((chip) => {
      const active = chip.dataset.typeFilter === "all";
      chip.classList.toggle("active", active);
      chip.classList.toggle("is-active", active);
      chip.setAttribute("aria-pressed", String(active));
    });
    Array.from(el.chat.querySelectorAll(".ds-msg")).forEach((node) => node.remove());
    el.chatEmpty.hidden = false;
    renderResults();
    renderPreviewEmpty();
    renderSources();
    syncChatInputHeight();
    syncSendButton();
    showToast("화면을 초기화했습니다.");
  }

  function openModal(modal) {
    modal.hidden = false;
    const focusTarget = modal.querySelector(".btn-confirm");
    if (focusTarget) focusTarget.focus();
  }
  function closeModal(modal) {
    modal.hidden = true;
  }

  /* =====================================================================
   * 8. 이벤트 연결
   * ===================================================================== */
  el.searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    runSearch(el.searchInput.value);
  });

  document.querySelectorAll("[data-type-filter]").forEach((chip) => {
    chip.addEventListener("click", () => {
      state.type = chip.dataset.typeFilter;
      document.querySelectorAll("[data-type-filter]").forEach((item) => {
        const active = item === chip;
        item.classList.toggle("active", active);
        item.classList.toggle("is-active", active);
        item.setAttribute("aria-pressed", String(active));
      });
      const keyword = el.searchInput.value.trim() || state.query;
      if (keyword) runSearch(keyword);
    });
  });

  el.resultList.addEventListener("click", (event) => {
    const item = event.target.closest("[data-doc-id]");
    if (!item) return;
    if (event.target.matches("[data-doc-check]")) {
      toggleChecked(item.dataset.docId, event.target.checked);
      return;
    }
    openPreview(item.dataset.docId);
  });

  el.resultList.addEventListener("keydown", (event) => {
    const item = event.target.closest("[data-doc-id]");
    if (!item || event.target.matches("[data-doc-check]")) return;
    if (event.key === "Enter") {
      event.preventDefault();
      openPreview(item.dataset.docId);
    } else if (event.key === " ") {
      event.preventDefault();
      const checkbox = item.querySelector("[data-doc-check]");
      checkbox.checked = !checkbox.checked;
      toggleChecked(item.dataset.docId, checkbox.checked);
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const next = event.key === "ArrowDown" ? item.nextElementSibling : item.previousElementSibling;
      if (next) next.focus();
    }
  });

  el.applyBtn.addEventListener("click", applySelected);

  el.sourceList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-source-remove]");
    if (button) removeSource(button.dataset.sourceRemove);
  });

  el.openOriginalBtn.addEventListener("click", () => {
    showToast("원문 다운로드 API가 제공되지 않았습니다.");
  });

  el.previewScroll.addEventListener("scroll", () => updatePageIndicator(), { passive: true });

  document.querySelectorAll("[data-quick-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.quickAction;
      sendRequest(QUICK_ACTIONS[action], action, "빠른 작업: " + button.textContent.trim());
    });
  });

  el.composer.addEventListener("submit", (event) => {
    event.preventDefault();
    if (state.streaming) {
      if (debug.enabled) console.log("[AI전송] ■ 중지 버튼 클릭 → 요청 취소(abort)");
      if (state.abortController) state.abortController.abort();
      return;
    }
    sendRequest(el.chatInput.value, undefined, "전송 버튼");
  });

  el.chatInput.addEventListener("input", () => {
    syncChatInputHeight();
    syncSendButton();
  });

  el.chatInput.addEventListener("keydown", (event) => {
    // 한글 조합 중 Enter 는 전송하지 않는다. (마지막 글자 중복 전송 방지)
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing && event.keyCode !== 229) {
      event.preventDefault();
      if (!state.streaming) sendRequest(el.chatInput.value, undefined, "Enter 키");
    }
  });

  el.resetBtn.addEventListener("click", () => openModal(el.resetModal));
  el.resetConfirmBtn.addEventListener("click", () => {
    closeModal(el.resetModal);
    resetWorkspace();
  });
  el.resetModal.addEventListener("click", (event) => {
    if (event.target.closest("[data-modal-close]")) closeModal(el.resetModal);
  });

  /* ---------------------------------------------------------------------
   * 왼쪽 검색 패널 접기 / 펼치기
   *  - common.css: .panel.panel-collapsed → 44px 폭, 제목 숨김, 접기 아이콘 180° 회전
   *  - common.js : AIOneSplitHandler.setPanelToMinimum(panel) → 3단 그리드 열 폭을 44px 로 줄임
   *  - 펼칠 때는 접기 직전의 그리드 열 폭을 되돌린다. (없으면 AIOneSplitHandler.reset 으로 기본 폭)
   * --------------------------------------------------------------------- */
  const searchPanel = el.searchCollapseBtn ? el.searchCollapseBtn.closest(".panel") : null;
  const threePanel = searchPanel ? searchPanel.closest(".three-panel") : null;
  let savedGridColumns = "";

  function syncSearchCollapseButton(collapsed) {
    const label = collapsed ? "검색 패널 펼치기" : "검색 패널 접기";
    el.searchCollapseBtn.setAttribute("aria-label", label);
    el.searchCollapseBtn.setAttribute("aria-expanded", String(!collapsed));
    el.searchCollapseBtn.title = label;
  }

  function setSearchPanelCollapsed(collapsed) {
    if (!searchPanel || !threePanel) return;
    if (collapsed === searchPanel.classList.contains("panel-collapsed")) return;
    const splitHandler = window.AIOneSplitHandler;

    if (collapsed) {
      savedGridColumns = threePanel.style.gridTemplateColumns || "";
      searchPanel.classList.add("panel-collapsed");
      const applied = splitHandler && typeof splitHandler.setPanelToMinimum === "function"
        ? splitHandler.setPanelToMinimum(searchPanel)
        : false;
      if (!applied && getComputedStyle(threePanel).display === "grid") {
        // common.js 가 없거나 처리하지 못한 경우: 왼쪽 열만 44px 로 직접 줄인다.
        const tracks = getComputedStyle(threePanel).gridTemplateColumns.split(" ");
        if (tracks.length === 5) {
          tracks[0] = "44px";
          tracks[2] = "minmax(0, 1fr)";
          threePanel.style.gridTemplateColumns = tracks.join(" ");
        }
      }
    } else {
      searchPanel.classList.remove("panel-collapsed");
      if (savedGridColumns) {
        threePanel.style.gridTemplateColumns = savedGridColumns;
      } else if (splitHandler && typeof splitHandler.reset === "function") {
        splitHandler.reset(threePanel);
      } else {
        threePanel.style.removeProperty("grid-template-columns");
      }
      savedGridColumns = "";
    }
    syncSearchCollapseButton(collapsed);
  }

  if (el.searchCollapseBtn && searchPanel) {
    syncSearchCollapseButton(false);
    el.searchCollapseBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      setSearchPanelCollapsed(!searchPanel.classList.contains("panel-collapsed"));
    });

  }

  /* ---------------------------------------------------------------------
   * 3단 패널 좌우 너비 조절
   *  - 드래그 · 키보드(←/→, Shift 는 32px) 조절은 common.js 의 AIOneSplitHandler 가 처리한다.
   *    (.three-panel > .panel-resize-handle 와 각 패널의 data-slot · data-panel-min 만 있으면 자동 동작)
   *  - 이 화면에서는 아래만 연결한다.
   *    ① 조절한 너비를 쿠키에 저장하고 다음 접속 때 복원
   *    ② 보조도구 '패널 크기 조절' → 조절 핸들 강조 (AIOneWorkspaceUi.togglePanelResizeMode)
   *    ③ 보조도구 '레이아웃 초기화' → 기본 너비로 되돌리고 저장값 삭제 (AIOneSplitHandler.reset)
   * --------------------------------------------------------------------- */
  const PANEL_LAYOUT_COOKIE = "ai_one_search_panel_widths";
  const PANEL_HANDLE_WIDTH = 2;
  const aiPanel = threePanel ? threePanel.querySelector(":scope > .search-ai-panel") : null;
  const previewPanel = threePanel ? threePanel.querySelector(":scope > .search-preview-area") : null;

  function workspaceCommon() {
    return window.AIOneWorkspaceCommon || null;
  }

  function readLayoutValue() {
    const common = workspaceCommon();
    if (common && typeof common.getCookie === "function") return common.getCookie(PANEL_LAYOUT_COOKIE);
    try { return window.localStorage.getItem(PANEL_LAYOUT_COOKIE) || ""; } catch (error) { return ""; }
  }

  function writeLayoutValue(value) {
    const common = workspaceCommon();
    if (common && typeof common.setCookie === "function") {
      common.setCookie(PANEL_LAYOUT_COOKIE, value, { maxAge: 60 * 60 * 24 * 365 });
      return;
    }
    try { window.localStorage.setItem(PANEL_LAYOUT_COOKIE, value); } catch (error) { /* 저장 불가 환경 */ }
  }

  function clearLayoutValue() {
    const common = workspaceCommon();
    if (common && typeof common.deleteCookie === "function") common.deleteCookie(PANEL_LAYOUT_COOKIE);
    try { window.localStorage.removeItem(PANEL_LAYOUT_COOKIE); } catch (error) { /* 저장 불가 환경 */ }
  }

  /** 반응형(1024px 이하, 세로 쌓기)에서는 너비 조절 · 저장을 하지 않는다. */
  function isPanelGridLayout() {
    return Boolean(threePanel) &&
      !window.matchMedia("(max-width: 1024px)").matches &&
      getComputedStyle(threePanel).display === "grid";
  }

  function panelMinimum(panel, fallback) {
    const value = Number.parseFloat(panel && panel.dataset.panelMin);
    return Number.isFinite(value) ? value : fallback;
  }

  function savePanelWidths() {
    if (!isPanelGridLayout() || !searchPanel || !aiPanel) return;
    if (searchPanel.classList.contains("panel-collapsed")) return; // 접힘(44px)은 저장하지 않는다.
    if (!threePanel.style.gridTemplateColumns) return;              // 기본 너비 상태
    writeLayoutValue(JSON.stringify({
      left: Math.round(searchPanel.getBoundingClientRect().width),
      right: Math.round(aiPanel.getBoundingClientRect().width)
    }));
  }

  function restorePanelWidths() {
    if (!isPanelGridLayout() || !searchPanel || !aiPanel || !previewPanel) return;
    const raw = readLayoutValue();
    if (!raw) return;
    try {
      const saved = JSON.parse(raw);
      const style = getComputedStyle(threePanel);
      const available = threePanel.clientWidth -
        Number.parseFloat(style.paddingLeft) - Number.parseFloat(style.paddingRight) - PANEL_HANDLE_WIDTH * 2;
      const leftMin = panelMinimum(searchPanel, 220);
      const rightMin = panelMinimum(aiPanel, 220);
      const centerMin = panelMinimum(previewPanel, 220);
      let left = Math.max(leftMin, Math.round(Number(saved.left)));
      let right = Math.max(rightMin, Math.round(Number(saved.right)));
      if (!Number.isFinite(left) || !Number.isFinite(right)) throw new Error("invalid widths");
      // 저장 당시보다 화면이 좁으면 가운데 최소 폭을 지키도록 양쪽을 줄인다.
      const overflow = left + right + centerMin - available;
      if (overflow > 0) {
        const shrinkRight = Math.min(overflow, right - rightMin);
        right -= shrinkRight;
        left = Math.max(leftMin, left - (overflow - shrinkRight));
      }
      threePanel.style.gridTemplateColumns =
        left + "px " + PANEL_HANDLE_WIDTH + "px minmax(0, 1fr) " + PANEL_HANDLE_WIDTH + "px " + right + "px";
    } catch (error) {
      clearLayoutValue();
    }
  }

  if (threePanel) {
    window.AIOneWorkspaceUi.configurePanelLayout(threePanel, {
      clearSaved: clearLayoutValue,
      afterReset: () => {
        savedGridColumns = "";
        if (el.searchCollapseBtn) syncSearchCollapseButton(false);
      },
    });
    restorePanelWidths();

    // 드래그가 끝나면 저장 (드래그 자체는 common.js 가 처리)
    threePanel.addEventListener("pointerdown", (event) => {
      const handle = event.target.closest(".panel-resize-handle");
      if (!handle || handle.parentElement !== threePanel || event.button !== 0) return;
      const onEnd = () => {
        document.removeEventListener("pointerup", onEnd);
        document.removeEventListener("pointercancel", onEnd);
        window.setTimeout(savePanelWidths, 0);
      };
      document.addEventListener("pointerup", onEnd);
      document.addEventListener("pointercancel", onEnd);
    });

    // 키보드(←/→)로 조절한 경우도 저장
    threePanel.addEventListener("keyup", (event) => {
      const handle = event.target.closest(".panel-resize-handle");
      if (!handle || handle.parentElement !== threePanel) return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") savePanelWidths();
    });


  }

  /*
   * 보조도구의 글자크기 · 전체화면은 common.js(AIOneTopbar)가 처리한다.
   * 패널 순환·레이아웃 초기화도 common.js가 처리하며, 이 화면은 저장소와 검색 패널 후처리만 연결한다.
   */

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!el.resetModal.hidden) closeModal(el.resetModal);
  });

  /* =====================================================================
   * 9. 초기화
   * ===================================================================== */
  console.info("[내부자료검색] search.js build " + BUILD + " 로드" +
    " (debug=" + debug.enabled + ", mock=" + CONFIG.mock + ")");

  renderResults();
  renderPreviewEmpty();
  renderSources();
  syncChatInputHeight();
  syncSendButton();

  const initialQuery = params.get("query") || "";
  if (initialQuery) {
    el.searchInput.value = initialQuery;
    runSearch(initialQuery);
  } else {
    el.searchInput.focus();
  }

})(window, document);
