/**
 * AI-ONE 정책변경보고서 검증 워크스페이스
 *
 * 화면 구성
 *   왼쪽   : 보고서 업로드 · 업로드 목록
 *   가운데 : 원본 미리보기(PDF) · 정책과제 목록
 *   오른쪽 : 선택한 정책과제의 체크리스트 검증 결과
 *
 * 처리 흐름
 *   업로드(ND_uploadDocuments) → 분석 요청(ND_analyze) → 작업 폴링(ND_jobStatus)
 *   → 정책과제(ND_tasks) → 체크리스트(ND_taskChecklist)
 *
 * 공통 UI(모달·토스트·SidePop·업로드존·분할 핸들러·보조도구)는 common.js 의 AIOne* 컴포넌트를 사용한다.
 * 서버 응답 필드명은 normalize* 함수에서만 해석하므로, API 명세 확정 시 이 함수들만 맞추면 된다.
 *
 * 기본 구간 형식: Start: 기능명 / End: 기능명
 * 변경 구간 형식: Start: YYMMDD 추가/수정 - 기능명 / End: YYMMDD 추가/수정 - 기능명
 * 주석 정리 내역
 * - 261023 주석 정리 - 구간 표시와 변경 내용 표기를 통일합니다. 기존 작업 날짜와 기능 설명은 유지합니다.
 */
(function () {
  'use strict';

  const common = window.AIOneWorkspaceCommon;
  if (!common) throw new Error('common.js(AIOneWorkspaceCommon)가 먼저 로드되어야 합니다.');

  // ───────────────────────── 상수 ─────────────────────────
  const DEFAULT_TITLE = '제목없는 정책변경보고서';
  const JOB_POLL_INTERVAL = 2000;
  const JOB_POLL_RETRY = 4000;
  const ALLOWED_EXT = ['.pdf', '.hwp', '.hwpx'];
  const ZOOM = { min: 50, max: 200, step: 10 };
  const RESULT_LABEL = { satisfied: '충족', insufficient: '미흡', missing: '누락', na: '해당없음' };
  // 에이전트 목록에서 정책변경보고서 검증 에이전트를 찾을 때 쓰는 키워드 (value·title 에 포함되면 선택)
  // 응답 예: {"id":"<uuid>","title":"국회질의분류","value":"inquiry","description":"..."}
  const AGENT_KEYWORDS = ['policy_report', 'policy', '정책변경'];
  // 대화 API 의 agent_id 로 보낼 필드. AI 서버가 uuid 를 받으면 'id', 코드값을 받으면 'value'
  const AGENT_ID_FIELD = 'id';

  // ───────────────────────── 상태 ─────────────────────────
  const state = {
    conversationId: null,
    title: DEFAULT_TITLE,
    files: [],            // { documentId, name, size, status, jobId, taskCount, createdAt, file }
    activeFileIndex: -1,
    tasks: [],            // 현재 파일의 정책과제
    activeTaskId: null,
    taskFilter: 'all',
    taskKeyword: '',
    fileSort: 'upload',
    checklistCache: new Map(), // taskId → { items, summary }
    pollTimers: new Map(),     // jobId → timer
    epoch: 0,                  // 화면(대화) 전환 세대. 늦게 온 비동기 응답이 다른 화면을 덮지 않게 한다.
    zoom: 100,
    pdfDoc: null,
    pdfRenderToken: 0,
    conversations: [],
    runSearch: '',
    agents: [],           // ND_report.agent.do 로 불러온 에이전트 목록
    agentId: null         // 이 화면이 쓰는 에이전트 ID (못 찾으면 null → 서버 기본값 사용)
  };

  // ───────────────────────── DOM ─────────────────────────
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const el = {
    uploadZone: $('#uploadZone'),
    fileList: $('#fileList'),
    fileCount: $('#fileCount'),
    fileSort: $('#fileSort'),
    activeFileName: $('#activeFileName'),
    docOriginal: $('#docOriginal'),
    charCount: $('#docCharCount'),
    pageNum: $('#docPageNum'),
    pageTotal: $('#docPageTotal'),
    zoomVal: $('#docZoomVal'),
    taskList: $('#taskList'),
    taskTotalBadge: $('#taskTotalBadge'),
    taskSearch: $('#taskSearch'),
    resultBody: $('#resultBody'),
    resultReviewBadge: $('#resultReviewBadge'),
    titleBtn: $('#workspaceTitleBtn'),
    titleText: $('#workspaceTitleText'),
    titleInput: $('#workspaceTitleInput'),
    runDrawer: $('#runDrawer'),
    runList: $('#runList'),
    runListTotal: $('#runListTotal'),
    runListSearch: $('#runListSearch')
  };

  // ───────────────────────── 공통 유틸 ─────────────────────────
  const esc = value => common.escapeHtml(value == null ? '' : String(value));
  const toast = msg => common.showToast(msg);

  function apiData(result) {
    if (result && result.success === false) throw new Error(result.message || '요청 처리에 실패했습니다.');
    return result && Object.prototype.hasOwnProperty.call(result, 'data') ? result.data : result;
  }

  async function fetchJson(url, options) {
    const response = await fetch(url, Object.assign({ cache: 'no-store' }, options || {}));
    if (!response.ok) throw new Error(`요청 실패 (${response.status})`);
    const text = await response.text();
    return text ? apiData(JSON.parse(text)) : null;
  }

  function postForm(url, params) {
    const body = new URLSearchParams();
    Object.entries(params || {}).forEach(([key, value]) => {
      if (Array.isArray(value)) value.forEach(v => body.append(key, v));
      else if (value != null) body.append(key, value);
    });
    return fetchJson(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: body.toString()
    });
  }

  const toList = data =>
    Array.isArray(data) ? data
      : Array.isArray(data?.items) ? data.items
        : Array.isArray(data?.data) ? data.data
          : Array.isArray(data?.tasks) ? data.tasks
            : Array.isArray(data?.documents) ? data.documents
              : [];

  function normalizeStatus(status) {
    const v = String(status || '').trim().toLowerCase();
    if (['completed', 'complete', 'done', 'success', 'succeeded', 'finished', 'analyzed'].includes(v)) return 'completed';
    if (['failed', 'failure', 'error', 'cancelled', 'canceled'].includes(v)) return 'failed';
    return 'processing';
  }

  function formatDate(value) {
    const raw = String(value || '').trim();
    const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[1]}년 ${Number(m[2])}월 ${Number(m[3])}일` : raw;
  }

  function formatPages(pages) {
    if (!Array.isArray(pages) || !pages.length) return '';
    const nums = pages.map(Number).filter(n => n > 0).sort((a, b) => a - b);
    if (!nums.length) return '';
    return nums.length === 1 ? `${nums[0]}쪽` : `${nums[0]}~${nums[nums.length - 1]}쪽`;
  }

  const emptyState = (title, desc) =>
    `<div class="report-empty-state"><strong>${esc(title)}</strong>${desc ? `<span>${esc(desc)}</span>` : ''}</div>`;

  function confirmModal(title, message, onOk, okLabel = '확인') {
    const modal = $('#policyConfirmModal');
    if (!modal || !window.AIOneModal) {
      if (window.confirm(`${title}\n\n${message}`)) onOk();
      return;
    }
    $('#policyConfirmTitle').textContent = title;
    $('#policyConfirmMsg').textContent = message;
    const okBtn = $('#policyConfirmOk');
    okBtn.textContent = okLabel;
    const fresh = okBtn.cloneNode(true); // 이전 리스너 제거
    okBtn.replaceWith(fresh);
    fresh.addEventListener('click', () => {
      window.AIOneModal.close(modal);
      onOk();
    }, { once: true });
    window.AIOneModal.open(modal);
  }

  // ───────────────────────── 서버 응답 정규화 (API 명세 확정 시 이 부분만 수정) ─────────────────────────
  function normalizeDocument(doc) {
    const taskCount = Number(doc?.task_count ?? doc?.taskCount ?? doc?.question_count ?? 0);
    const jobId = String(doc?.last_job_id ?? doc?.job_id ?? '').trim();
    const explicit = doc?.status ?? doc?.last_job_status ?? doc?.analysis_status;
    return {
      documentId: String(doc?.document_id ?? doc?.id ?? ''),
      name: String(doc?.file_name ?? doc?.name ?? ''),
      size: Number(doc?.file_size ?? 0),
      taskCount: Number.isFinite(taskCount) ? taskCount : 0,
      jobId,
      status: explicit != null && String(explicit).trim()
        ? normalizeStatus(explicit)
        : taskCount > 0 ? 'completed' : jobId ? 'processing' : 'failed',
      createdAt: doc?.created_at || '',
      file: null
    };
  }

  function normalizeTask(raw, index) {
    const summary = raw?.checklist_summary || raw?.summary || {};
    const total = Number(summary.total ?? raw?.checklist_total ?? 0);
    const satisfied = Number(summary.satisfied ?? raw?.checklist_satisfied ?? 0);
    const failed = Number(summary.failed ?? summary.insufficient ?? (total ? total - satisfied : 0));
    const explicit = String(raw?.status ?? raw?.review_status ?? '').toLowerCase();
    const status = explicit === 'satisfied' || explicit === 'pass'
      ? 'satisfied'
      : explicit === 'review' || explicit === 'fail'
        ? 'review'
        : failed > 0 ? 'review' : 'satisfied';
    const department = raw?.department;
    return {
      id: String(raw?.task_id ?? raw?.id ?? `task-${index}`),
      order: Number(raw?.task_order ?? raw?.order ?? index + 1),
      title: String(raw?.title ?? raw?.task_title ?? ''),
      department: String(typeof department === 'object' && department ? department.name : department ?? ''),
      category: String(raw?.category ?? raw?.field ?? ''),
      effectiveDate: String(raw?.effective_date ?? raw?.enforcement_date ?? ''),
      pages: Array.isArray(raw?.source_pages) ? raw.source_pages : raw?.page ? [raw.page] : [],
      contact: String(raw?.contact ?? raw?.phone ?? ''),
      tags: Array.isArray(raw?.tags) ? raw.tags.map(String) : [],
      total,
      satisfied,
      failed,
      status,
      raw
    };
  }

  function normalizeChecklist(data) {
    const items = toList(data).map((item, index) => {
      const result = String(item?.result ?? item?.status ?? '').toLowerCase();
      return {
        order: Number(item?.item_order ?? item?.order ?? index + 1),
        name: String(item?.name ?? item?.item_name ?? ''),
        level: String(item?.level ?? item?.requirement ?? '').toLowerCase() === 'recommended' ? 'recommended' : 'required',
        result: ['satisfied', 'insufficient', 'missing', 'na'].includes(result)
          ? result
          : result === 'pass' ? 'satisfied' : result === 'fail' ? 'insufficient' : 'missing',
        opinion: String(item?.ai_opinion ?? item?.opinion ?? item?.reason ?? ''),
        guide: String(item?.guide ?? item?.criteria ?? item?.description ?? '')
      };
    });
    const satisfied = items.filter(i => i.result === 'satisfied' || i.result === 'na').length;
    return { items, summary: { total: items.length, satisfied, failed: items.length - satisfied } };
  }

  // ───────────────────────── 에이전트 ─────────────────────────
  /**
   * 현재 생성되어 있는 에이전트 목록을 불러와 이 화면이 쓸 에이전트를 고른다.
   * 실패하거나 맞는 에이전트가 없으면 agentId 를 비워 두고, 서버 기본값(AGENT_ID)으로 동작한다.
   */
  async function loadAgents() {
    try {
      const data = await fetchJson('ND_report.agent.do');
      state.agents = toList(data);
    } catch (error) {
      console.warn('에이전트 목록 조회 실패, 기본 에이전트 사용', error);
      state.agents = [];
    }
    const idOf = agent => String(agent?.[AGENT_ID_FIELD] ?? agent?.agent_id ?? agent?.id ?? '').trim();
    // description 은 "보고서" 같은 일반 단어가 섞여 오탐이 나므로 매칭에 쓰지 않는다.
    const textOf = agent => [agent?.value, agent?.code, agent?.title, agent?.name, agent?.agent_name]
      .filter(v => v != null).join(' ').toLowerCase();
    const picked = AGENT_KEYWORDS
      .map(keyword => state.agents.find(agent => idOf(agent) && textOf(agent).includes(keyword.toLowerCase())))
      .find(Boolean);
    state.agentId = picked ? idOf(picked) : null;
    console.info('[policy] 에이전트 목록 %d건, 사용 agentId=%s', state.agents.length, state.agentId || '(기본값)');
    if (!picked && state.agents.length) console.warn('정책변경보고서 에이전트를 찾지 못했습니다.', state.agents);
    return state.agents;
  }

  // ───────────────────────── 대화(실행 건) ─────────────────────────
  async function ensureConversation() {
    if (state.conversationId) return state.conversationId;
    const created = await postForm('ND_createConversation.do', { title: state.title || DEFAULT_TITLE, agentId: state.agentId });
    const id = String(created?.id ?? created?.conversation_id ?? '').trim();
    if (!id) throw new Error('실행 건을 생성하지 못했습니다.');
    state.conversationId = id;
    return id;
  }

  async function loadConversations() {
    const params = new URLSearchParams({ page: '1', size: '50', sort: '-is_favorite,-created_at' });
    if (state.runSearch) params.append('title', state.runSearch);
    if (state.agentId) params.append('agentId', state.agentId);
    try {
      const data = await fetchJson(`ND_conversationList.do?${params}`);
      state.conversations = toList(data);
      if (el.runListTotal) el.runListTotal.textContent = String(data?.total ?? state.conversations.length);
    } catch (error) {
      console.error('실행 목록 조회 실패', error);
      state.conversations = [];
      toast(error.message || '실행 목록을 불러오지 못했습니다.');
    }
    renderRunList();
    return state.conversations;
  }

  function renderRunList() {
    if (!el.runList) return;
    if (!state.conversations.length) {
      el.runList.innerHTML = `<li class="run-empty drawer-list-empty">${state.runSearch ? '검색 결과가 없습니다.' : '등록된 실행 건이 없습니다.'}</li>`;
      return;
    }
    el.runList.innerHTML = state.conversations.map(item => {
      const id = String(item.id ?? item.conversation_id ?? '');
      const title = item.display_title || item.title || '정책변경보고서 검증';
      const created = window.AIOneConversationDrawer?.formatDateTime(item.created_at, { dateSeparator: '-' })?.combined
        || String(item.created_at || '').replace('T', ' ').slice(0, 16);
      return `
        <li class="drawer-run-item run-item${id === state.conversationId ? ' is-active' : ''}${item.is_favorite ? ' is-pinned' : ''}"
            data-conversation-id="${esc(id)}" data-pinned="${item.is_favorite ? 'true' : 'false'}">
          <span class="drawer-run-state" aria-hidden="true"></span>
          <div class="drawer-run-main">
            <strong class="drawer-run-title">${esc(title)}</strong>
            <div class="drawer-run-meta"><span>${esc(created)}</span></div>
          </div>
          <button type="button" class="btn-more" aria-label="더보기" title="더보기" aria-haspopup="menu" aria-expanded="false">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="1.7"></circle><circle cx="12" cy="12" r="1.7"></circle><circle cx="12" cy="19" r="1.7"></circle></svg>
          </button>
        </li>`;
    }).join('');
    $$('.drawer-run-item', el.runList).forEach(row => {
      row.querySelector('.drawer-run-main')?.addEventListener('click', () => {
        window.AIOneSidePop?.close('#runDrawer');
        loadSession(row.dataset.conversationId);
      });
    });
    window.AIOneSidePop?.initRunActionMenus?.(el.runList);
  }

  async function handleRunAction(event) {
    const detail = event.detail || {};
    if (!detail.completed) return;
    const id = String(detail.item?.dataset?.conversationId || '');
    if (!id) return;
    try {
      if (detail.action === 'rename') {
        await postForm('ND_updateConversationTitle.do', { conversationId: id, title: detail.title });
        if (id === state.conversationId) setTitle(detail.title);
        toast('실행 건 제목이 변경되었습니다.');
      } else if (detail.action === 'delete') {
        await postForm('ND_deleteConversation.do', { conversationId: id });
        if (id === state.conversationId) resetWorkspace();
        toast('실행 건이 삭제되었습니다.');
      } else if (detail.action === 'pin') {
        await postForm('ND_conversationFavorite.do', { conversationId: id, favorite: String(Boolean(detail.pinned)) });
        toast(detail.pinned ? '목록 상단에 고정되었습니다.' : '고정이 해제되었습니다.');
      }
    } catch (error) {
      console.error('실행 건 작업 실패', error);
      toast(error.message || '요청 처리에 실패했습니다.');
    }
    loadConversations();
  }

  async function loadSession(conversationId) {
    if (!conversationId) return;
    resetWorkspace({ keepTitle: true });
    const epoch = state.epoch;
    state.conversationId = String(conversationId);
    const found = state.conversations.find(c => String(c.id ?? c.conversation_id) === state.conversationId);
    setTitle(found ? (found.display_title || found.title) : DEFAULT_TITLE);
    try {
      const data = await fetchJson(`ND_conversationDocuments.do?conversationId=${encodeURIComponent(state.conversationId)}`);
      if (epoch !== state.epoch) return;
      state.files = toList(data).filter(d => !d?.is_deleted).map(normalizeDocument);
      renderFileList();
      // 진행 중 문서는 job 상태를 다시 확인해 폴링을 재개한다.
      state.files.filter(f => f.status === 'processing' && f.jobId).forEach(f => pollJob(f.jobId, epoch));
      if (state.files.length) selectFile(0);
    } catch (error) {
      console.error('실행 건 보고서 조회 실패', error);
      toast(error.message || '보고서 목록을 불러오지 못했습니다.');
    }
  }

  // ───────────────────────── 제목 ─────────────────────────
  function setTitle(title) {
    state.title = String(title || '').trim() || DEFAULT_TITLE;
    if (el.titleText) el.titleText.textContent = state.title;
    if (el.titleInput) el.titleInput.value = state.title;
  }

  function bindTitleEditor() {
    if (!el.titleBtn || !el.titleInput) return;
    let saving = false;
    const close = () => {
      el.titleInput.classList.add('hidden');
      el.titleBtn.classList.remove('hidden');
    };
    el.titleBtn.addEventListener('click', () => {
      el.titleBtn.classList.add('hidden');
      el.titleInput.classList.remove('hidden');
      el.titleInput.value = state.title;
      el.titleInput.focus();
      el.titleInput.select();
    });
    el.titleInput.addEventListener('keydown', event => {
      if (event.key === 'Enter') { event.preventDefault(); el.titleInput.blur(); }
      if (event.key === 'Escape') { event.preventDefault(); el.titleInput.value = state.title; close(); }
    });
    el.titleInput.addEventListener('blur', async () => {
      if (saving) return;
      const next = el.titleInput.value.trim() || DEFAULT_TITLE;
      if (next === state.title) { close(); return; }
      if (!state.conversationId) { setTitle(next); close(); return; }
      saving = true;
      try {
        await postForm('ND_updateConversationTitle.do', { conversationId: state.conversationId, title: next });
        setTitle(next);
        toast('제목이 수정되었습니다.');
      } catch (error) {
        toast(error.message || '제목 수정에 실패했습니다.');
      } finally {
        saving = false;
        close();
      }
    });
  }

  // ───────────────────────── 업로드 · 분석 ─────────────────────────
  async function handleSelectedFiles(inputFiles) {
    const candidates = Array.from(inputFiles || []);
    const invalid = candidates.filter(f => !ALLOWED_EXT.some(ext => f.name.toLowerCase().endsWith(ext)));
    if (invalid.length) toast(`PDF · HWP · HWPX 파일만 업로드할 수 있습니다. (${invalid.map(f => f.name).join(', ')})`);
    let files = candidates.filter(f => !invalid.includes(f));
    if (!files.length) return;

    // 공통 보안 검사: 민감정보 파일은 제외, 대외비는 확인 후 진행
    if (window.AIOneUploadSecurity?.validate) {
      const security = await window.AIOneUploadSecurity.validate(files);
      if (security.blocked?.length) {
        toast(`개인정보·민감정보가 감지된 파일은 제외했습니다: ${security.blocked.map(r => r.file.name).join(', ')}`);
        files = files.filter(f => !security.blocked.some(r => r.file === f));
      }
      if (!files.length) return;
      if (security.confidential?.length) {
        confirmModal(
          '대외비 파일 업로드 확인',
          `대외비·비공개 정보가 감지된 파일이 있습니다. 열람·활용 권한을 확인한 뒤 업로드하시겠습니까?\n(${security.confidential.map(r => r.file.name).join(', ')})`,
          () => uploadAndAnalyze(files),
          '확인 후 업로드'
        );
        return;
      }
    }
    uploadAndAnalyze(files);
  }

  async function uploadAndAnalyze(files) {
    const epoch = state.epoch;
    let conversationId;
    try {
      conversationId = await ensureConversation();
    } catch (error) {
      toast(error.message || '실행 건 생성에 실패했습니다.');
      return;
    }

    // 업로드 중 표시용 임시 항목
    const placeholders = files.map(file => ({
      documentId: '', name: file.name, size: file.size, status: 'uploading',
      jobId: '', taskCount: 0, createdAt: new Date().toISOString(), file
    }));
    state.files.push(...placeholders);
    renderFileList();

    try {
      const form = new FormData();
      files.forEach(file => form.append('files', file));
      const uploaded = toList(await fetchJson('ND_uploadDocuments.do', { method: 'POST', body: form }));
      if (epoch !== state.epoch) return;

      placeholders.forEach((ph, i) => {
        const doc = uploaded.find(d => d?.file_name === ph.name) || uploaded[i];
        if (!doc) { ph.status = 'failed'; return; }
        ph.documentId = String(doc.document_id ?? doc.id ?? '');
        ph.status = 'processing';
      });
      renderFileList();

      const documentIds = placeholders.filter(p => p.documentId).map(p => p.documentId);
      if (!documentIds.length) throw new Error('업로드된 문서가 없습니다.');
      const job = await postForm('ND_analyze.do', { documentIds, conversationId });
      const jobId = String(job?.job_id ?? job?.id ?? '');
      placeholders.forEach(p => { if (p.documentId) p.jobId = jobId; });
      renderFileList();
      toast(`보고서 ${documentIds.length}건 분석을 시작했습니다.`);
      if (jobId) pollJob(jobId, epoch);
      if (state.activeFileIndex < 0) selectFile(state.files.indexOf(placeholders[0]));
      loadConversations();
    } catch (error) {
      console.error('보고서 업로드/분석 요청 실패', error);
      placeholders.forEach(p => { if (p.status !== 'processing' || !p.jobId) p.status = 'failed'; });
      renderFileList();
      toast(error.message || '보고서 업로드에 실패했습니다.');
    }
  }

  function pollJob(jobId, epoch) {
    if (!jobId || state.pollTimers.has(jobId)) return;
    const tick = async () => {
      if (epoch !== state.epoch) { state.pollTimers.delete(jobId); return; }
      let delay = JOB_POLL_INTERVAL;
      try {
        const job = await fetchJson(`ND_jobStatus.do?jobId=${encodeURIComponent(jobId)}`);
        if (epoch !== state.epoch) { state.pollTimers.delete(jobId); return; }
        const docs = Array.isArray(job?.documents) ? job.documents : [];
        state.files.filter(f => f.jobId === jobId).forEach(file => {
          const row = docs.find(d => String(d.document_id) === file.documentId);
          const prev = file.status;
          file.status = normalizeStatus(row?.status ?? job?.status);
          file.taskCount = Number(row?.task_count ?? row?.question_count ?? file.taskCount ?? 0);
          if (prev !== 'completed' && file.status === 'completed' && state.files[state.activeFileIndex] === file) {
            loadTasks(file);
          }
        });
        renderFileList();
        if (normalizeStatus(job?.status) !== 'processing') {
          state.pollTimers.delete(jobId);
          const failed = state.files.filter(f => f.jobId === jobId && f.status === 'failed').length;
          toast(failed ? `분석이 끝났습니다. 실패 ${failed}건이 있습니다.` : '보고서 분석이 완료되었습니다.');
          return;
        }
      } catch (error) {
        console.warn('분석 작업 상태 조회 실패, 재시도', jobId, error);
        delay = JOB_POLL_RETRY;
      }
      state.pollTimers.set(jobId, window.setTimeout(tick, delay));
    };
    state.pollTimers.set(jobId, window.setTimeout(tick, 300));
  }

  // ───────────────────────── 업로드 목록 ─────────────────────────
  function sortedFileEntries() {
    const entries = state.files.map((file, index) => ({ file, index }));
    if (state.fileSort === 'name') entries.sort((a, b) => a.file.name.localeCompare(b.file.name, 'ko-KR', { numeric: true }));
    if (state.fileSort === 'tasks') entries.sort((a, b) => b.file.taskCount - a.file.taskCount);
    return entries;
  }

  function fileStatusBadge(file) {
    if (file.status === 'uploading') return '<span class="policy-pill policy-pill-muted">업로드중</span>';
    if (file.status === 'processing') return '<span class="policy-pill policy-pill-info">분석중</span>';
    if (file.status === 'failed') return '<span class="policy-pill policy-pill-danger">실패</span>';
    return `<span class="policy-pill policy-pill-purple">과제${file.taskCount}건</span>`;
  }

  function renderFileList() {
    if (el.fileCount) el.fileCount.textContent = `${state.files.length}건`;
    if (!el.fileList) return;
    if (!state.files.length) {
      el.fileList.innerHTML = `<li class="policy-file-empty">${emptyState('업로드한 보고서가 없습니다', '보고서를 업로드하면 이 영역에 목록이 표시됩니다.')}</li>`;
      return;
    }
    el.fileList.innerHTML = sortedFileEntries().map(({ file, index }, displayIndex) => `
      <li class="policy-file-item${index === state.activeFileIndex ? ' is-active' : ''}" data-index="${index}" tabindex="0" title="${esc(file.name)}">
        <span class="policy-file-no">${displayIndex + 1}</span>
        <span class="policy-file-name">${esc(file.name)}</span>
        ${fileStatusBadge(file)}
        <div class="policy-file-action">
          <button type="button" class="policy-more-btn" data-file-menu="${index}" aria-label="파일 메뉴" aria-haspopup="menu">⋮</button>
          <div class="policy-file-menu" role="menu" hidden>
            <button type="button" role="menuitem" data-file-delete="${index}">삭제</button>
          </div>
        </div>
      </li>`).join('');
  }

  function bindFileListEvents() {
    el.fileList?.addEventListener('click', event => {
      const menuBtn = event.target.closest('[data-file-menu]');
      if (menuBtn) {
        event.stopPropagation();
        const menu = menuBtn.nextElementSibling;
        const willOpen = menu.hidden;
        $$('.policy-file-menu', el.fileList).forEach(m => { m.hidden = true; });
        menu.hidden = !willOpen;
        return;
      }
      const delBtn = event.target.closest('[data-file-delete]');
      if (delBtn) {
        event.stopPropagation();
        requestFileDelete(Number(delBtn.dataset.fileDelete));
        return;
      }
      const item = event.target.closest('.policy-file-item');
      if (item) selectFile(Number(item.dataset.index));
    });
    el.fileList?.addEventListener('keydown', event => {
      const item = event.target.closest('.policy-file-item');
      if (item && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        selectFile(Number(item.dataset.index));
      }
    });
    document.addEventListener('click', event => {
      if (!event.target.closest('.policy-file-action')) $$('.policy-file-menu').forEach(m => { m.hidden = true; });
    });
  }

  function requestFileDelete(index) {
    const file = state.files[index];
    if (!file) return;
    confirmModal('보고서 삭제', `"${file.name}" 보고서를 삭제하시겠습니까?`, async () => {
      try {
        if (file.documentId) await postForm('ND_deleteDocument.do', { documentId: file.documentId });
        state.files.splice(index, 1);
        if (state.activeFileIndex === index) {
          state.activeFileIndex = -1;
          clearCenterAndRight();
          if (state.files.length) selectFile(0);
        } else if (state.activeFileIndex > index) {
          state.activeFileIndex -= 1;
        }
        renderFileList();
        toast('보고서가 삭제되었습니다.');
      } catch (error) {
        toast(error.message || '보고서 삭제에 실패했습니다.');
      }
    }, '삭제');
  }

  // ───────────────────────── 파일 선택 · 원본 미리보기 ─────────────────────────
  async function selectFile(index) {
    const file = state.files[index];
    if (!file) return;
    state.activeFileIndex = index;
    state.tasks = [];
    state.activeTaskId = null;
    renderFileList();
    if (el.activeFileName) {
      el.activeFileName.textContent = file.name.replace(/\.(pdf|hwpx?|)$/i, '');
      el.activeFileName.title = file.name;
    }
    renderTaskList();
    renderResultEmpty();
    renderOriginal(file);
    if (file.status === 'completed') loadTasks(file);
    else if (file.status === 'failed') el.taskList.innerHTML = emptyState('분석에 실패한 보고서입니다', '파일을 확인한 뒤 다시 업로드해 주세요.');
    else el.taskList.innerHTML = emptyState('보고서를 분석하고 있습니다', '분석이 끝나면 정책과제 목록이 표시됩니다.');
  }

  async function renderOriginal(file) {
    const token = ++state.pdfRenderToken;
    state.pdfDoc = null;
    setPageInfo(0, 0);
    if (el.charCount) el.charCount.textContent = '0';
    el.docOriginal.innerHTML = emptyState('원본을 불러오는 중입니다', '');

    let detail = null;
    if (file.documentId) {
      try {
        detail = await fetchJson(`ND_document.do?documentId=${encodeURIComponent(file.documentId)}`);
      } catch (error) {
        console.warn('보고서 상세 조회 실패', error);
      }
    }
    if (token !== state.pdfRenderToken) return;
    const charCount = Number(detail?.char_count ?? detail?.text_length ?? 0);
    if (el.charCount) el.charCount.textContent = charCount ? charCount.toLocaleString('ko-KR') : '0';

    // 1) 서버 변환 PDF → 2) 브라우저가 가진 원본 PDF → 3) original_html 순으로 표시
    let blob = null;
    if (file.documentId && file.status !== 'uploading') {
      try {
        const res = await fetch(`ND_documentPreview.do?documentId=${encodeURIComponent(file.documentId)}`, { cache: 'no-store' });
        if (res.ok) blob = await res.blob();
      } catch (error) {
        console.warn('원본 PDF 미리보기 조회 실패', error);
      }
    }
    if (!blob?.size && file.file && file.name.toLowerCase().endsWith('.pdf')) blob = file.file;
    if (token !== state.pdfRenderToken) return;

    if (blob?.size && window.pdfjsLib) {
      try {
        await renderPdf(blob, token);
        return;
      } catch (error) {
        console.warn('PDF 렌더링 실패, HTML 대체', error);
      }
    }
    const html = String(detail?.original_html ?? '');
    if (html) {
      // 서버가 준 HTML 은 스크립트 실행을 막은 sandbox iframe 안에서만 보여 준다.
      el.docOriginal.innerHTML = '<iframe class="policy-html-frame" sandbox="" title="보고서 원문"></iframe>';
      $('.policy-html-frame', el.docOriginal).srcdoc = html;
      setPageInfo(1, 1);
      return;
    }
    el.docOriginal.innerHTML = emptyState(
      file.status === 'uploading' || file.status === 'processing' ? '원본을 준비하고 있습니다' : '원본 미리보기를 제공하지 않는 문서입니다',
      'HWP · HWPX 문서는 서버 변환이 끝나면 표시됩니다.'
    );
  }

  async function renderPdf(blob, token) {
    const data = new Uint8Array(await blob.arrayBuffer());
    const pdf = await window.pdfjsLib.getDocument({ data }).promise;
    if (token !== state.pdfRenderToken) return;
    state.pdfDoc = pdf;
    el.docOriginal.innerHTML = '<div class="policy-pdf-pages"></div>';
    const holder = $('.policy-pdf-pages', el.docOriginal);
    for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
      const wrap = document.createElement('div');
      wrap.className = 'policy-pdf-page';
      wrap.dataset.page = String(pageNo);
      holder.appendChild(wrap);
    }
    setPageInfo(1, pdf.numPages);
    await drawPdfPages(token);
  }

  async function drawPdfPages(token) {
    const pdf = state.pdfDoc;
    if (!pdf) return;
    const pages = $$('.policy-pdf-page', el.docOriginal);
    const ratio = window.devicePixelRatio || 1;
    for (const wrap of pages) {
      if (token !== state.pdfRenderToken) return;
      const page = await pdf.getPage(Number(wrap.dataset.page));
      const viewport = page.getViewport({ scale: (state.zoom / 100) * 1.25 });
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width * ratio);
      canvas.height = Math.floor(viewport.height * ratio);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      const ctx = canvas.getContext('2d');
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      await page.render({ canvasContext: ctx, viewport }).promise;
      wrap.replaceChildren(canvas);
    }
  }

  function setPageInfo(current, total) {
    if (el.pageNum) el.pageNum.textContent = String(current);
    if (el.pageTotal) el.pageTotal.textContent = String(total);
  }

  function syncCurrentPage() {
    const pages = $$('.policy-pdf-page', el.docOriginal);
    if (!pages.length) return;
    const top = el.docOriginal.getBoundingClientRect().top;
    let current = 1;
    pages.forEach(p => {
      if (p.getBoundingClientRect().top - top <= el.docOriginal.clientHeight / 3) current = Number(p.dataset.page);
    });
    setPageInfo(current, pages.length);
  }

  function scrollToPage(pageNo) {
    const target = $(`.policy-pdf-page[data-page="${Number(pageNo)}"]`, el.docOriginal);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    target.classList.remove('is-focus');
    void target.offsetWidth;
    target.classList.add('is-focus');
  }

  function setZoom(next) {
    state.zoom = Math.max(ZOOM.min, Math.min(ZOOM.max, next));
    if (el.zoomVal) el.zoomVal.textContent = `${state.zoom}%`;
    if (state.pdfDoc) drawPdfPages(state.pdfRenderToken);
  }

  // ───────────────────────── 정책과제 목록 ─────────────────────────
  async function loadTasks(file) {
    const epoch = state.epoch;
    el.taskList.innerHTML = emptyState('정책과제를 불러오는 중입니다', '');
    try {
      const data = await fetchJson(`ND_tasks.do?documentId=${encodeURIComponent(file.documentId)}`);
      if (epoch !== state.epoch || state.files[state.activeFileIndex] !== file) return;
      state.tasks = toList(data).map(normalizeTask).sort((a, b) => a.order - b.order);
      file.taskCount = state.tasks.length;
      renderFileList();
      renderTaskList();
      if (state.tasks.length) selectTask(state.tasks[0].id);
    } catch (error) {
      console.error('정책과제 조회 실패', error);
      el.taskList.innerHTML = emptyState('정책과제를 불러오지 못했습니다', error.message || '');
    }
  }

  function filteredTasks() {
    const keyword = state.taskKeyword.toLowerCase();
    return state.tasks.filter(task => {
      if (state.taskFilter !== 'all' && task.status !== state.taskFilter) return false;
      if (!keyword) return true;
      return `${task.title} ${task.department} ${task.category}`.toLowerCase().includes(keyword);
    });
  }

  function renderTaskList() {
    const reviewCount = state.tasks.filter(t => t.status === 'review').length;
    const satisfiedCount = state.tasks.filter(t => t.status === 'satisfied').length;
    $('#taskCountAll').textContent = String(state.tasks.length);
    $('#taskCountReview').textContent = String(reviewCount);
    $('#taskCountSatisfied').textContent = String(satisfiedCount);
    if (el.taskTotalBadge) el.taskTotalBadge.textContent = `${state.tasks.length}건`;

    if (!state.tasks.length) {
      el.taskList.innerHTML = emptyState('정책과제가 없습니다', '보고서를 선택하면 추출된 정책과제가 표시됩니다.');
      return;
    }
    const list = filteredTasks();
    if (!list.length) {
      el.taskList.innerHTML = emptyState('조건에 맞는 정책과제가 없습니다', '필터나 검색어를 바꿔 보세요.');
      return;
    }
    el.taskList.innerHTML = list.map(task => {
      const meta = [formatDate(task.effectiveDate), formatPages(task.pages)].filter(Boolean).join(' · ');
      return `
        <article class="policy-task-card${task.id === state.activeTaskId ? ' is-active' : ''}" data-task-id="${esc(task.id)}" tabindex="0"
                 aria-label="정책과제 ${task.order}: ${esc(task.title)}">
          <div class="policy-task-head">
            <span class="policy-task-no">${String(task.order).padStart(2, '0')}</span>
            <strong class="policy-task-title">${esc(task.title)}</strong>
            ${task.status === 'review'
              ? '<span class="policy-pill policy-pill-danger">확인 필요</span>'
              : '<span class="policy-pill policy-pill-success">충족</span>'}
          </div>
          <div class="policy-task-dept">${esc(task.department)}${task.department && task.category ? ' ·' : ''}</div>
          <div class="policy-task-cat">${esc(task.category)}</div>
          <div class="policy-task-foot">
            <span>${esc(meta)}</span>
            <span>체크리스트 ${task.satisfied}/${task.total}</span>
          </div>
        </article>`;
    }).join('');
  }

  function bindTaskListEvents() {
    const activate = card => card && selectTask(card.dataset.taskId);
    el.taskList?.addEventListener('click', event => activate(event.target.closest('.policy-task-card')));
    el.taskList?.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        activate(event.target.closest('.policy-task-card'));
      }
    });
    document.querySelector('.policy-task-filter')?.addEventListener('filter-btn:change', event => {
      state.taskFilter = String(event.detail?.filter || 'all');
      renderTaskList();
    });
    let timer = 0;
    el.taskSearch?.addEventListener('input', () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        state.taskKeyword = el.taskSearch.value.trim();
        renderTaskList();
      }, 200);
    });
  }

  // ───────────────────────── 체크리스트 검증 결과 ─────────────────────────
  async function selectTask(taskId) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;
    state.activeTaskId = taskId;
    $$('.policy-task-card', el.taskList).forEach(card => card.classList.toggle('is-active', card.dataset.taskId === taskId));
    if (task.pages.length) scrollToPage(task.pages[0]);

    el.resultBody.innerHTML = renderTaskSummary(task, null) + emptyState('체크리스트를 불러오는 중입니다', '');
    try {
      const checklist = await getChecklist(task);
      if (state.activeTaskId !== taskId) return;
      renderResult(task, checklist);
    } catch (error) {
      console.error('체크리스트 조회 실패', error);
      if (state.activeTaskId !== taskId) return;
      el.resultBody.innerHTML = renderTaskSummary(task, null) + emptyState('체크리스트를 불러오지 못했습니다', error.message || '');
    }
  }

  async function getChecklist(task) {
    if (state.checklistCache.has(task.id)) return state.checklistCache.get(task.id);
    const data = await fetchJson(`ND_taskChecklist.do?taskId=${encodeURIComponent(task.id)}`);
    const checklist = normalizeChecklist(data);
    state.checklistCache.set(task.id, checklist);
    return checklist;
  }

  function renderTaskSummary(task, checklist) {
    const summary = checklist?.summary || { total: task.total, satisfied: task.satisfied, failed: task.failed };
    const reviewNeeded = summary.failed > 0;
    const meta = [task.department, task.category, task.effectiveDate ? `시행 ${formatDate(task.effectiveDate)}` : '', formatPages(task.pages) ? `원문 ${formatPages(task.pages)}` : '']
      .filter(Boolean).map(esc).join(' · ');
    return `
      <section class="policy-summary-card">
        <div class="policy-summary-head">
          <h3>${esc(task.title)}</h3>
          ${reviewNeeded ? '<span class="policy-pill policy-pill-danger">확인 필요</span>' : '<span class="policy-pill policy-pill-success">충족</span>'}
        </div>
        <p class="policy-summary-meta">${meta}</p>
        <p class="policy-summary-sub">
          ${task.contact ? `<span><b>문의</b> ${esc(task.contact)}</span>` : ''}
          ${task.tags.length ? `<span><b>태그</b> ${task.tags.map(t => esc(t.startsWith('#') ? t : `#${t}`)).join(' ')}</span>` : ''}
        </p>
        <div class="policy-stat-row">
          <div class="policy-stat"><span>전체 항목</span><strong>${summary.total}</strong></div>
          <div class="policy-stat is-good"><span>충족</span><strong>${summary.satisfied}</strong></div>
          <div class="policy-stat is-bad"><span>미흡·누락</span><strong>${summary.failed}</strong></div>
        </div>
      </section>`;
  }

  function renderResult(task, checklist) {
    if (el.resultReviewBadge) {
      el.resultReviewBadge.textContent = `확인 필요 ${checklist.summary.failed}`;
      el.resultReviewBadge.classList.toggle('policy-pill-danger', checklist.summary.failed > 0);
      el.resultReviewBadge.classList.toggle('policy-pill-muted', checklist.summary.failed === 0);
    }
    const items = checklist.items.map(item => {
      const ok = item.result === 'satisfied' || item.result === 'na';
      return `
        <li class="policy-check-item${ok ? '' : ' is-fail'}">
          <div class="policy-check-head">
            <span class="policy-check-no">${String(item.order).padStart(2, '0')}</span>
            <strong>${esc(item.name)}</strong>
            <span class="policy-level ${item.level}">${item.level === 'required' ? '필수' : '권장'}</span>
            <span class="policy-result ${item.result}">${ok ? '✓' : '!'} ${esc(RESULT_LABEL[item.result])}</span>
          </div>
          ${item.opinion ? `
            <div class="policy-opinion">
              <span class="policy-opinion-label">AI 검증 의견</span>
              <p>${esc(item.opinion)}</p>
            </div>` : ''}
          ${item.guide ? `<p class="policy-guide">${esc(item.guide)}</p>` : ''}
        </li>`;
    }).join('');
    el.resultBody.innerHTML = `
      ${renderTaskSummary(task, checklist)}
      <section class="policy-checklist">
        <header class="policy-checklist-head">
          <h3>정책변경보고서 체크리스트</h3>
          <span>필수·권장 기준 자동 검증</span>
        </header>
        ${checklist.items.length ? `<ol class="policy-check-list">${items}</ol>` : emptyState('검증 항목이 없습니다', '')}
      </section>`;
  }

  function renderResultEmpty() {
    if (el.resultReviewBadge) {
      el.resultReviewBadge.textContent = '확인 필요 0';
      el.resultReviewBadge.classList.remove('policy-pill-danger');
      el.resultReviewBadge.classList.add('policy-pill-muted');
    }
    el.resultBody.innerHTML = emptyState('선택한 정책과제가 없습니다', '정책과제 목록에서 과제를 선택하면 체크리스트 검증 결과가 표시됩니다.');
  }

  // ───────────────────────── 결과 다운로드 (Excel이 여는 .xls) ─────────────────────────
  async function downloadResults() {
    const file = state.files[state.activeFileIndex];
    if (!file || !state.tasks.length) {
      toast('다운로드할 검증 결과가 없습니다.');
      return;
    }
    toast('검증 결과를 정리하고 있습니다...');
    const rows = [];
    for (const task of state.tasks) {
      let checklist = null;
      try { checklist = await getChecklist(task); } catch (error) { console.warn('체크리스트 조회 실패', task.id, error); }
      if (!checklist?.items.length) {
        rows.push([task.order, task.title, task.department, task.category, task.effectiveDate, '', '', '', '조회 실패 또는 항목 없음', '']);
        continue;
      }
      checklist.items.forEach(item => rows.push([
        task.order, task.title, task.department, task.category, task.effectiveDate,
        item.order, item.name, item.level === 'required' ? '필수' : '권장', RESULT_LABEL[item.result], item.opinion
      ]));
    }
    const header = ['과제순번', '정책과제', '담당부서', '분야', '시행일', '항목순번', '체크리스트 항목', '구분', '결과', 'AI 검증 의견'];
    const cell = v => `<td>${esc(v)}</td>`;
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
      <style>table{border-collapse:collapse;font-family:"Malgun Gothic",sans-serif;font-size:10pt}
      th{background:#eef2f6;border:1px solid #9aa4b2;padding:6px}td{border:1px solid #c9d1d9;padding:5px;vertical-align:top;mso-number-format:"\\@"}</style>
      </head><body><table><thead><tr>${header.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(r => `<tr>${r.map(cell).join('')}</tr>`).join('')}</tbody></table></body></html>`;
    const blob = new Blob(['\uFEFF', html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const today = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `정책변경보고서_검증결과_${file.name.replace(/\.[^.]+$/, '')}_${today}.xls`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // ───────────────────────── 초기화 ─────────────────────────
  function clearCenterAndRight() {
    state.tasks = [];
    state.activeTaskId = null;
    state.pdfDoc = null;
    state.pdfRenderToken += 1;
    if (el.activeFileName) el.activeFileName.textContent = '파일을 선택하세요';
    el.docOriginal.innerHTML = emptyState('원본 문서가 없습니다', '보고서를 업로드하면 원본이 표시됩니다.');
    setPageInfo(0, 0);
    if (el.charCount) el.charCount.textContent = '0';
    renderTaskList();
    renderResultEmpty();
  }

  function resetWorkspace(options = {}) {
    state.epoch += 1;
    state.pollTimers.forEach(timer => window.clearTimeout(timer));
    state.pollTimers.clear();
    state.checklistCache.clear();
    state.files = [];
    state.activeFileIndex = -1;
    state.conversationId = null;
    if (!options.keepTitle) setTitle(DEFAULT_TITLE);
    renderFileList();
    clearCenterAndRight();
  }

  function bindEvents() {
    // 업로드: 클릭/드래그 처리는 common.js AIOneFileUpload 가 app:file-upload 이벤트로 넘겨준다.
    window.AIOneFileUpload?.init(document);
    el.uploadZone?.addEventListener('app:file-upload', event => handleSelectedFiles(event.detail?.files));

    el.fileSort?.addEventListener('change', () => { state.fileSort = el.fileSort.value; renderFileList(); });
    bindFileListEvents();
    bindTaskListEvents();
    bindTitleEditor();

    $('#newAnalysisBtn')?.addEventListener('click', () => {
      resetWorkspace();
      window.AIOneSidePop?.close('#runDrawer');
      toast('새 분석을 시작합니다. 보고서를 업로드하면 실행 건이 생성됩니다.');
    });

    el.runDrawer?.addEventListener('sidepop:open', loadConversations);
    el.runDrawer?.addEventListener('sidepop:run-action', handleRunAction);
    el.runListSearch?.addEventListener('keydown', event => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      state.runSearch = el.runListSearch.value.trim();
      loadConversations();
    });

    $('#docZoomIn')?.addEventListener('click', () => setZoom(state.zoom + ZOOM.step));
    $('#docZoomOut')?.addEventListener('click', () => setZoom(state.zoom - ZOOM.step));
    $('#docFullscreenBtn')?.addEventListener('click', () => {
      const pane = $('.policy-preview-pane');
      if (!document.fullscreenElement) pane?.requestFullscreen?.().catch(() => toast('전체화면 전환을 허용하지 않았습니다.'));
      else document.exitFullscreen?.();
    });
    let scrollRaf = 0;
    el.docOriginal?.addEventListener('scroll', () => {
      window.cancelAnimationFrame(scrollRaf);
      scrollRaf = window.requestAnimationFrame(syncCurrentPage);
    }, { passive: true });

    $('#swapSplitBtn')?.addEventListener('click', () => $('#policySplit')?.classList.toggle('is-swapped'));
    $('#resultDownloadBtn')?.addEventListener('click', downloadResults);

    bindPanelLayout();
  }

  /* ───────────────────────── 3단 패널 레이아웃 (접기 · 너비 조절 · 위치 바꾸기) ─────────────────────────
   *  common.css · common.js 는 수정하지 않고 공통 컴포넌트만 연결한다.
   *
   *  [접기/펼치기]  #leftPanelCollapseBtn  (MD_search.jsp · search.js 와 같은 방식)
   *    - common.css .panel.panel-collapsed → 44px 폭 / 제목 숨김 / 아이콘 180° 회전
   *    - 접기: AIOneSplitHandler.setPanelToMinimum(panel) 로 해당 열만 44px
   *    - 펼치기: 접기 직전 너비로 열 폭을 다시 계산 (패널 순서가 바뀌어도 맞게 계산)
   *
   *  [너비 조절]  .panel-resize-handle  (드래그 · ←/→ 키는 AIOneSplitHandler 가 처리, 패널 data-slot 필요)
   *    - 보조도구 '패널 크기 조절' → 핸들 강조 (AIOneWorkspaceUi.togglePanelResizeMode)
   *
   *  [위치 바꾸기]  패널 헤더를 끌어 다른 패널 위에 놓으면 두 패널 자리를 맞바꾼다.
   *    - 드래그 처리: AIOneWorkspaceUi.initPanelDragDrop (헤더 안 버튼·입력은 드래그 제외)
   *    - 실제 배치: applyLayout() 이 DOM 순서(패널-핸들-패널-핸들-패널)를 바꾸고 그리드 열 폭을 다시 계산
   *    - 가운데(정책과제) 패널은 어느 자리에 있든 남는 폭(1fr)을 사용한다.
   *
   *  [저장]  순서 + 너비를 쿠키(ai_one_policy_panel_layout)에 저장하고 다음 접속 때 복원
   *          (AIOneWorkspaceUi.createPanelLayoutController). 접힘 상태는 저장하지 않는다.
   *  [초기화]  보조도구 '레이아웃 초기화' → 기본 순서 · 기본 너비 · 펼침 + 저장값 삭제
   *
   *  ※ 보조도구 버튼은 common.js 의 AIOneTopbar 가 자동 초기화하고 'topbar:accessory-action' 이벤트를 보낸다.
   *    여기서 initAccessoryController 를 또 호출하면 클릭 처리가 중복돼 메뉴가 열리지 않으므로 이벤트만 받는다.
   * ─────────────────────────────────────────────────────────────────────────── */
  function bindPanelLayout() {
    const threePanel = $('.three-panel');
    if (!threePanel) return;
    const ui = window.AIOneWorkspaceUi;
    const LAYOUT_COOKIE = 'ai_one_policy_panel_layout';
    const DEFAULT_ORDER = ['left', 'center', 'right'];   // data-panel 값
    const HANDLE_WIDTH = 2;
    const COLLAPSED_WIDTH = 44;
    const collapseBtn = $('#leftPanelCollapseBtn');
    const uploadPanel = $(':scope > [data-panel="left"]', threePanel);
    const panelSizeBtn = $('[data-accessory-action="panel-size"]');
    const expandedWidths = new Map();                    // 접힌 패널의 접기 직전 너비

    const getPanels = () => $$(':scope > .panel', threePanel);
    const getHandles = () => $$(':scope > .panel-resize-handle', threePanel);
    const panelKey = panel => panel.dataset.panel || panel.dataset.slot || panel.id;
    const isFlexible = panel => panel.dataset.slot === 'center' || panel.classList.contains('panel-center');
    const isCollapsed = panel => panel.classList.contains('panel-collapsed');
    const isGridLayout = () =>
      !window.matchMedia('(max-width: 1024px)').matches && getComputedStyle(threePanel).display === 'grid';
    const panelMinimum = panel => {
      const value = Number.parseFloat(panel?.dataset.panelMin);
      return Number.isFinite(value) ? value : 220;
    };
    const panelTitle = panel => ($('.panel-title', panel)?.textContent || '').replace(/\s+/g, ' ').trim();

    /** 현재 화면 기준 패널별 너비 (접힌 패널은 접기 직전 너비) */
    function measureWidths() {
      const widths = {};
      getPanels().forEach(panel => {
        widths[panelKey(panel)] = isCollapsed(panel)
          ? (expandedWidths.get(panel) || panelMinimum(panel))
          : Math.round(panel.getBoundingClientRect().width);
      });
      return widths;
    }

    /** DOM 순서대로 그리드 열 폭을 다시 계산한다. (가운데 패널 = 1fr, 접힌 패널 = 44px) */
    function applyTracks(widthsByPanel) {
      // split-handler 내부 기억값을 비워 이후 창 크기 변경 시 현재 폭 기준으로 다시 맞추게 한다.
      if (typeof window.AIOneSplitHandler?.reset === 'function') window.AIOneSplitHandler.reset(threePanel);
      else threePanel.style.removeProperty('grid-template-columns');
      if (!isGridLayout()) return;

      const panels = getPanels();
      const style = getComputedStyle(threePanel);
      const available = threePanel.clientWidth
        - Number.parseFloat(style.paddingLeft) - Number.parseFloat(style.paddingRight)
        - HANDLE_WIDTH * Math.max(0, panels.length - 1);
      const flexible = panels.find(isFlexible);
      const fixed = panels.filter(panel => panel !== flexible).map(panel => {
        if (isCollapsed(panel)) return { panel, width: COLLAPSED_WIDTH, min: COLLAPSED_WIDTH };
        const min = panelMinimum(panel);
        const saved = Math.round(Number(widthsByPanel?.[panelKey(panel)]));
        return { panel, width: Math.max(min, Number.isFinite(saved) && saved > 0 ? saved : min), min };
      });
      // 화면이 좁으면 가운데 최소 폭을 지키도록 고정 폭 패널을 줄인다.
      let overflow = fixed.reduce((sum, item) => sum + item.width, 0) + (flexible ? panelMinimum(flexible) : 0) - available;
      [...fixed].reverse().forEach(item => {
        if (overflow <= 0) return;
        const reduce = Math.min(overflow, item.width - item.min);
        item.width -= reduce;
        overflow -= reduce;
      });
      const widthOf = new Map(fixed.map(item => [item.panel, item.width]));
      threePanel.style.gridTemplateColumns = panels
        .flatMap((panel, index) => {
          const track = panel === flexible ? 'minmax(0, 1fr)' : `${widthOf.get(panel)}px`;
          return index < panels.length - 1 ? [track, `${HANDLE_WIDTH}px`] : [track];
        })
        .join(' ');
    }

    /** 핸들 안내 문구를 현재 순서에 맞춘다. */
    function syncHandleLabels() {
      const panels = getPanels();
      getHandles().forEach((handle, index) => {
        const before = panels[index];
        const after = panels[index + 1];
        if (!before || !after) return;
        handle.setAttribute('aria-label', `${panelTitle(before)} / ${panelTitle(after)} 너비 조절`);
      });
    }

    /** 패널 순서 변경: 패널-핸들-패널-핸들-패널 순으로 다시 배치 */
    function applyOrder(order) {
      const byKey = new Map(getPanels().map(panel => [panelKey(panel), panel]));
      if (!Array.isArray(order) || order.length !== byKey.size || !order.every(key => byKey.has(key))) return false;
      const handles = getHandles();
      order.forEach((key, index) => {
        threePanel.appendChild(byKey.get(key));
        if (handles[index]) threePanel.appendChild(handles[index]);
      });
      syncHandleLabels();
      return true;
    }

    function getState() {
      return { order: getPanels().map(panelKey), widthsByPanel: measureWidths() };
    }

    function applyLayout(state) {
      if (!state) return;
      const widths = Object.assign(measureWidths(), state.widthsByPanel || {});
      applyOrder(state.order);
      applyTracks(widths);
    }

    // 쿠키 저장/복원 (common.js 공통 컨트롤러)
    const layoutStore = typeof ui?.createPanelLayoutController === 'function'
      ? ui.createPanelLayoutController({
        cookieKey: LAYOUT_COOKIE,
        getState: () => getState(),
        applyState: (container, state) => applyLayout(state)
      })
      : null;
    const saveLayout = () => {
      if (!isGridLayout() && !layoutStore) return;
      layoutStore?.scheduleSave(threePanel);
    };

    // ── 접기 / 펼치기 ──
    function syncCollapseButton(collapsed) {
      if (!collapseBtn) return;
      const label = collapsed ? '업로드 패널 펼치기' : '업로드 패널 접기';
      collapseBtn.setAttribute('aria-label', label);
      collapseBtn.setAttribute('aria-expanded', String(!collapsed));
      collapseBtn.title = label;
    }

    function setUploadCollapsed(collapsed) {
      if (!uploadPanel || collapsed === isCollapsed(uploadPanel)) return;
      if (collapsed) {
        const widths = measureWidths();
        expandedWidths.set(uploadPanel, widths[panelKey(uploadPanel)]);
        uploadPanel.classList.add('panel-collapsed');
        const applied = typeof window.AIOneSplitHandler?.setPanelToMinimum === 'function'
          ? window.AIOneSplitHandler.setPanelToMinimum(uploadPanel)
          : false;
        if (!applied) applyTracks(widths);
      } else {
        const widths = measureWidths();          // 접기 직전 너비 포함
        uploadPanel.classList.remove('panel-collapsed');
        expandedWidths.delete(uploadPanel);
        applyTracks(widths);
      }
      syncCollapseButton(collapsed);
      window.AIOneTooltip?.hide?.();
    }

    // ── 패널 크기 조절 모드 ──
    function setResizeMode(enabled) {
      if (enabled === threePanel.classList.contains('panel-resize-mode')) return;
      if (typeof ui?.togglePanelResizeMode === 'function' && panelSizeBtn) {
        ui.togglePanelResizeMode({ container: threePanel, button: panelSizeBtn });
        return;
      }
      threePanel.classList.toggle('panel-resize-mode', enabled);
      getHandles().forEach(handle => handle.classList.toggle('active', enabled));
      panelSizeBtn?.classList.toggle('active', enabled);
      panelSizeBtn?.setAttribute('aria-pressed', String(enabled));
    }

    function resetLayout() {
      setResizeMode(false);
      layoutStore?.clear();
      common.deleteCookie(LAYOUT_COOKIE);
      if (uploadPanel && isCollapsed(uploadPanel)) {
        uploadPanel.classList.remove('panel-collapsed');
        expandedWidths.delete(uploadPanel);
        syncCollapseButton(false);
      }
      applyOrder(DEFAULT_ORDER);
      if (typeof window.AIOneSplitHandler?.reset === 'function') window.AIOneSplitHandler.reset(threePanel);
      else threePanel.style.removeProperty('grid-template-columns');
      toast('패널 레이아웃을 기본값으로 되돌렸습니다.');
    }

    // ── 이벤트 연결 ──
    syncCollapseButton(uploadPanel ? isCollapsed(uploadPanel) : false);
    collapseBtn?.addEventListener('click', event => {
      event.stopPropagation();
      setUploadCollapsed(!isCollapsed(uploadPanel));
    });

    // 위치 바꾸기: 헤더 드래그 → 놓은 패널과 자리 교환
    ui?.initPanelDragDrop?.({
      container: threePanel,
      readyKey: 'policyPanelDragReady',
      headSelector: '.panel-head',
      getState: () => getState(),
      applyState: state => applyLayout(state),
      saveState: () => layoutStore?.save(threePanel),
      onChanged: () => toast('패널 위치를 바꿨습니다.')
    });
    getPanels().forEach(panel => {
      const head = $('.panel-head', panel);
      if (head && !head.title) head.title = '헤더를 끌어 다른 패널 위에 놓으면 위치가 바뀝니다';
    });

    // 너비 조절(드래그 · 키보드)이 끝나면 저장
    threePanel.addEventListener('pointerdown', event => {
      const handle = event.target.closest('.panel-resize-handle');
      if (!handle || handle.parentElement !== threePanel || event.button !== 0) return;
      const onEnd = () => {
        document.removeEventListener('pointerup', onEnd);
        document.removeEventListener('pointercancel', onEnd);
        window.setTimeout(saveLayout, 0);
      };
      document.addEventListener('pointerup', onEnd);
      document.addEventListener('pointercancel', onEnd);
    });
    threePanel.addEventListener('keyup', event => {
      const handle = event.target.closest('.panel-resize-handle');
      if (!handle || handle.parentElement !== threePanel) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') saveLayout();
    });

    // 보조도구: 'topbar:accessory-action' (common.js AIOneTopbar)
    document.addEventListener('topbar:accessory-action', event => {
      const action = event.detail?.action;
      if (action === 'panel-size') setResizeMode(!threePanel.classList.contains('panel-resize-mode'));
      else if (action === 'layout') resetLayout();
    });
    // 핸들 밖을 누르면 '패널 크기 조절' 강조 모드를 끈다.
    document.addEventListener('pointerdown', event => {
      if (!threePanel.classList.contains('panel-resize-mode')) return;
      if (event.target.closest('.panel-resize-handle, .accessory-tool')) return;
      setResizeMode(false);
    });

    // 저장된 순서 · 너비 복원
    syncHandleLabels();
    layoutStore?.restore(threePanel);
  }

  async function init() {
    window.AIOneIcons?.hydrate?.(document);
    window.AIOneModal?.init?.(document);
    window.AIOneSidePop?.init?.(document);
    window.AIOneFilterButtons?.init?.(document);
    window.AIOneSplitHandler?.init?.(document);
    // 보조도구(글자크기·전체화면·패널 크기 조절·레이아웃 초기화)는 common.js 의 AIOneTopbar 가 자동 초기화한다.
    // 여기서 initAccessoryController 를 다시 호출하면 클릭 처리가 중복되므로 호출하지 않는다. (bindPanelLayoutTools 참고)
    window.AIOneTopbar?.init?.(document);

    setTitle(DEFAULT_TITLE);
    bindEvents();
    renderFileList();
    clearCenterAndRight();

    // 화면 시작 시 에이전트 목록을 먼저 불러온다. 실행 목록이 에이전트 기준으로 조회되므로 순서가 중요하다.
    await loadAgents();

    // 홈 최근 이력 등에서 conversationId 가 넘어오면 그 실행 건을, 아니면 가장 최근 실행 건을 연다.
    const fromUrl = new URLSearchParams(window.location.search).get('conversationId');
    const conversations = await loadConversations();
    const target = fromUrl || (conversations[0] && (conversations[0].id ?? conversations[0].conversation_id));
    if (target) loadSession(String(target));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();