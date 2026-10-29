
/*
 * 261028 누적 변경 요약 (현재 구현 기준)
 * - 정책 검증 예시의 업로드 안내·과제 필터·체크리스트·분석 이력·CSV 다운로드를 처리합니다. 제목 편집·목록 제어·레이아웃 초기화는 공통 UI를 사용하며 실제 분석 API는 미연결입니다.
 */
/** 정책 퍼블리싱 예시. 검증 결과는 샘플이며 실제 업로드·분석 API는 연결하지 않습니다.
 * 변경 내용
 * - 신규: 체크리스트 예시 데이터·결과 렌더링 및 정책과제 검색·필터
 * - 신규: 업로드 안내·새 분석·CSV 다운로드
 * - 신규: 실행 목록·빈 화면 전환 및 공통 목록 검색·정렬·고정·이름 변경·삭제 연결
 * - 신규: 공통 보조도구의 패널 위치 변경·레이아웃 초기화 연결
 *
 * 261026 변경 요약
 * - 수정 - 레이아웃 초기화의 개별 DOM 복원 처리를 제거하고 공통 기본 동작 사용
 * - 수정 - 분석 이력 Drawer 최초 표시 시 공통 목록 로딩 제공
 * - 수정 - 제목 표시·편집 이벤트를 공통 탑바로 이관하고 정책 분석 제목 조회·이력 갱신만 연결
 *
 * 구간 형식: Start: 신규 - 기능명 / End: 신규 - 기능명
 * API 연결 시 checklist 데이터를 교체하고 renderChecklist()로 동일한 DOM 템플릿을 사용합니다.
 * - 261023 수정 - 정책과제 필터 0건에 공통 아이콘·제목·설명 표시
 */
(() => {
  'use strict';
  /* Start: 신규 - 체크리스트 예시 데이터 */
  const checklist = [
    ['헤드라인', true, '원문 헤드라인 “회사가 도산하여도 근로자의 체불임금이 최대 6개월분까지 지원됩니다.”에서 정책 대상과 핵심 변화를 직접 제시하고 있습니다.', '수혜자와 핵심 혜택을 한눈에 알 수 있도록 작성하고, 가능한 경우 핵심 수치를 포함합니다.'],
    ['분류 태그', true, '원문에 #체불임금, #도산, #대지급금 태그가 기재되어 있습니다.', '해시태그 1~3개와 대상·생애주기 등 검색·분류에 필요한 태그를 작성합니다.'],
    ['정책 요약표', true, '원문 정책 요약 영역에서 주요내용·기대효과·시행 시점이 확인됩니다. 시행 시점은 “2026년 8월 20일”입니다.', '정책제목, 추진배경, 주요내용, 기대효과, 시행일 등 핵심 정보를 표 형태로 제공합니다.'],
    ['Q&A 5개 구성', false, '예시 원문에는 질문 3개가 작성되어 있어 필수 질문 5개 구성을 충족하지 못합니다.', '지원 대상, 혜택, 변경사항, 신청 방법, 문의처를 질문과 답변으로 구성합니다.'],
    ['지원 대상', true, '도산 사업장에서 임금 등을 받지 못한 퇴직 근로자로 대상을 명시했습니다.', '지원받을 수 있는 대상과 자격 조건을 설명합니다.'],
    ['지원 내용', true, '체불임금 지원 범위를 최종 6개월분으로 안내합니다.', '지원 범위와 금액 등 구체적인 혜택을 설명합니다.'],
    ['변경 전·후 비교', true, '체불임금 지원 기간을 시행 전 3개월분, 시행 후 6개월분으로 비교합니다.', '변경 전후의 차이를 동일한 기준으로 비교합니다.'],
    ['시행일', true, '시행일이 2026년 8월 20일로 기재되어 있습니다.', '정확한 시행 날짜를 명시합니다.'],
    ['신청 방법', false, '예시 원문에서 신청 절차와 접수 방법을 확인할 수 없습니다.', '신청 경로와 단계별 절차를 안내합니다.'],
    ['신청 서류', false, '신청에 필요한 구비서류 안내가 없습니다.', '필수 서류와 발급 경로를 안내합니다.'],
    ['담당 부서', true, '담당 부서를 고용노동부 퇴직연금복지과로 명시했습니다.', '정책 소관 기관과 담당 부서를 작성합니다.'],
    ['문의처', false, '예시 원문에 문의 전화번호 또는 온라인 문의 경로가 없습니다.', '문의 가능한 연락처를 기재합니다.'],
    ['수치 일관성', true, '본문과 비교표의 지원 기간이 6개월분으로 일치합니다.', '본문·요약·표의 수치가 일치하는지 확인합니다.'],
    ['쉬운 표현', true, '질문과 답변을 사용해 정책 대상과 혜택을 설명합니다.', '독자가 이해하기 쉬운 문장과 표현을 사용합니다.', 'recommended']
  ];
  /* End: 신규 - 체크리스트 예시 데이터 */
  /* Start: 신규 - 공통 알림 및 체크리스트 렌더링 */
  const $ = selector => document.querySelector(selector);
  const announce = message => {
    $('#policyAnnouncement').textContent = message;
    window.AIOneWorkspaceCommon?.showToast?.(message);
  };
  function renderChecklist() {
    const fragment = document.createDocumentFragment();
    checklist.forEach(([title, passed, opinion, guide, level = 'required'], index) => {
      const item = $('#policyCheckTemplate').content.cloneNode(true);
      item.querySelector('[data-check-number]').textContent = String(index + 1).padStart(2, '0');
      item.querySelector('[data-check-title]').textContent = title;
      const levelBadge = item.querySelector('[data-check-level]');
      const isRecommended = level === 'recommended';
      levelBadge.dataset.checkLevel = level;
      levelBadge.textContent = isRecommended ? '권장' : '필수';
      levelBadge.classList.add(isRecommended ? 'purple' : 'red');
      const status = item.querySelector('[data-check-status]');
      status.textContent = passed ? '✓ 충족' : '! 미흡';
      status.classList.add(passed ? 'green' : 'red');
      item.querySelector('[data-check-opinion]').textContent = opinion;
      item.querySelector('[data-check-guide]').textContent = guide;
      fragment.append(item);
    });
    $('#policyChecklist').replaceChildren(fragment);
    const passed = checklist.filter(item => item[1]).length;
    $('#policyTotal').textContent = checklist.length;
    $('#policyPassed').textContent = passed;
    $('#policyFailed').textContent = checklist.length - passed;
  }
  /* End: 신규 - 공통 알림 및 체크리스트 렌더링 */
  /* Start: 신규 - 정책과제 검색·필터 */
  let filter = 'all';
  function filterTasks() {
    const keyword = $('#policySearch').value.trim().toLocaleLowerCase();
    const visible = activeHistoryId === 'policy-example-1' && filter !== 'pass' && $('#policyTask').textContent.toLocaleLowerCase().includes(keyword);
    $('#policyTask').hidden = !visible;
    $('#policyTaskEmpty').hidden = visible;
    /* Start: 261023 수정 - 필터 0건에도 공통 빈 화면 표시 */
    if (!visible) {
      const hasSample = activeHistoryId === 'policy-example-1' && Boolean(sampleFiles);
      $('#policyTaskEmpty').replaceChildren(window.AIOneWorkspaceCommon.createFilterEmpty(
        hasSample ? '검색 조건에 맞는 정책과제가 없습니다' : '정책과제가 없습니다',
        hasSample ? '검색어나 필터를 변경해 주세요.' : '보고서 분석 후 정책과제가 표시됩니다.'
      ));
    }
    /* End: 261023 수정 - 필터 0건에도 공통 빈 화면 표시 */
  }
  document.querySelectorAll('[data-policy-filter]').forEach(button => button.addEventListener('click', () => {
    filter = button.dataset.policyFilter;
    document.querySelectorAll('[data-policy-filter]').forEach(item => {
      item.classList.toggle('active', item === button);
      item.setAttribute('aria-pressed', String(item === button));
    });
    filterTasks();
  }));
  $('#policySearch').addEventListener('input', filterTasks);
  /* End: 신규 - 정책과제 검색·필터 */
  /* Start: 신규 - 업로드 안내 및 새 분석 연결 */
  const input = $('#policyFileInput');
  const upload = $('#policyUpload');
  upload.addEventListener('click', event => { if (event.target !== input) input.click(); });
  upload.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); input.click(); }
  });
  upload.addEventListener('dragover', event => event.preventDefault());
  upload.addEventListener('drop', event => { event.preventDefault(); announce('예시 화면입니다. 실제 보고서 업로드·분석은 API 연결 후 사용할 수 있습니다.'); });
  input.addEventListener('change', () => { if (input.files.length) announce('예시 화면입니다. 실제 보고서 업로드·분석은 API 연결 후 사용할 수 있습니다.'); input.value = ''; });
  $('#policyReset').addEventListener('click', () => selectWorkspace(null));
  /* End: 신규 - 업로드 안내 및 새 분석 연결 */
  /* Start: 신규 - 예시 체크리스트 CSV 다운로드 */
  $('#policyExport').addEventListener('click', () => {
    const rows = [['번호', '항목', '검증 결과', 'AI 검증 의견', '작성 기준'], ...checklist.map((item, index) => [index + 1, item[0], item[1] ? '충족' : '미흡', item[2], item[3]])];
    const csv = '\uFEFF' + rows.map(row => row.map(value => '"' + String(value).replaceAll('"', '""') + '"').join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url; link.download = '정책변경보고서_체크리스트_예시.csv';
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  /* End: 신규 - 예시 체크리스트 CSV 다운로드 */
  /* Start: 신규 - 실행 목록 예시 데이터 및 선택 상태 */
  // 화면 확인용 목록. 실제 이력 API 연결 시 이 배열과 상세 조회를 교체합니다.
  let historyItems = [
    { id: 'policy-example-1', title: '2026년 하반기_이렇게 달라집니다.', created_at: '2026-09-18T15:10:00+09:00', counts: [9, 9, 283, 218] },
    { id: 'policy-example-2', title: '2027년 상반기_이렇게 달라집니다.', created_at: '2026-09-16T11:05:00+09:00', counts: [1, 2, 0, 0], pending: true },
    { id: 'policy-example-3', title: '2026년 상반기_이렇게 달라집니다.', created_at: '2026-01-08T10:20:00+09:00', counts: [4, 4, 12, 12] },
    { id: 'policy-example-4', title: '2025년 하반기_이렇게 달라집니다.', created_at: '2025-07-01T09:30:00+09:00', counts: [3, 3, 6, 6] },
    { id: 'policy-example-5', title: '2025년 상반기_이렇게 달라집니다.', created_at: '2025-01-06T14:20:00+09:00', counts: [3, 3, 9, 9] }
  ];
  let activeHistoryId = historyItems[0].id;
  /* Start: 261026 수정 - 공통 탑바에 정책 분석 제목 데이터 연결 */
  let pendingWorkspaceTitle = '';
  function getWorkspaceTitle() {
    return historyItems.find(item => item.id === activeHistoryId)?.title
      || pendingWorkspaceTitle || '제목없는 정책변경보고서 검증';
  }
  const workspaceTitleEditor = window.AIOneTopbar.createTitleEditor({
    button: $('#policyWorkspaceTitleBtn'),
    text: $('#policyWorkspaceTitle'),
    input: $('#policyWorkspaceTitleInput'),
    getTitle: getWorkspaceTitle,
    saveTitle: (title) => {
      const item = historyItems.find(entry => entry.id === activeHistoryId);
      if (item) item.title = title;
      else pendingWorkspaceTitle = title;
      renderHistory();
    },
  });
  function renderWorkspaceTitle() {
    workspaceTitleEditor?.render();
  }
  /* End: 261026 수정 - 공통 탑바에 정책 분석 제목 데이터 연결 */
  let sampleFiles = $('#policyFiles').innerHTML;
  bindFileActions();
  function bindFileActions() {
    $('#policyFiles').querySelectorAll('li:has(.file-item-main)').forEach(row => {
      window.AIOneFileActions.attach(row, {
        title: () => row.querySelector('.file-name').textContent.replace(/\s+/g, ' ').trim(),
        pinned: () => row.classList.contains('pinned'),
        onPin: () => {
          row.classList.toggle('pinned');
          bindFileActions();
          sampleFiles = $('#policyFiles').innerHTML;
        },
        onRename: title => {
          const name = row.querySelector('.file-name');
          name.textContent = title;
          name.title = title;
          row.querySelector('.file-item-main').setAttribute('aria-label', title + ' 파일 보기');
          $('.policy-document-pane .sub-badge').textContent = title;
          sampleFiles = $('#policyFiles').innerHTML;
        },
        onDelete: () => {
          sampleFiles = '';
          selectWorkspace(historyItems.find(item => item.id === activeHistoryId));
        }
      });
    });
  }
  /* End: 신규 - 실행 목록 예시 데이터 및 선택 상태 */
  /* Start: 신규 - 문서·검증 결과 빈 화면 생성 */
  function createContentEmpty(title, description = '', compact = false) {
    const empty = document.createElement('div');
    empty.className = 'empty-state answer-recommend-empty policy-content-empty';
    const iconWrap = document.createElement('div');
    iconWrap.className = compact ? 'no-file-icon type1' : 'no-file-icon';
    iconWrap.setAttribute('aria-hidden', 'true');
    const icon = document.createElement('img');
    icon.src = '../assets/icons/no-file.svg'; icon.alt = ''; icon.setAttribute('aria-hidden', 'true');
    const heading = document.createElement('strong'); heading.textContent = title;
    heading.className = compact ? 'empty-title type1' : 'empty-title';
    const detail = document.createElement('span'); detail.textContent = description;
    detail.className = compact ? 'empty-desc type1' : 'empty-desc';
    iconWrap.append(icon);
    empty.append(iconWrap, heading, detail);
    return empty;
  }
  const resultEmpty = createContentEmpty('검증결과가 없습니다', '보고서를 업로드하고 분석하면 검증 결과를 여기에서 확인할 수 있습니다.', true);
  resultEmpty.hidden = true;
  $('#resultBody').after(resultEmpty);
  const documentEmpty = createContentEmpty('미리 볼 문서가 없습니다', '보고서를 업로드하고 목록에서 문서를 선택해 주세요.');
  documentEmpty.hidden = true;
  $('#policyDocument').after(documentEmpty);

  /* End: 신규 - 문서·검증 결과 빈 화면 생성 */
  /* Start: 신규 - 선택 이력 및 새 분석 화면 전환 */
  function syncDocumentStatusbar(hasSample) {
    $('#policyFooterCount').textContent = hasSample ? '1건' : '0건';
    $('#policyCharCount').textContent = hasSample
      ? $('#policyDocument').textContent.replace(/\s+/g, ' ').trim().length.toLocaleString('ko-KR')
      : '0';
    $('#policyPageCurrent').textContent = hasSample ? '1' : '0';
    $('#policyPageTotal').textContent = hasSample ? '1' : '0';
    window.AIOneDocumentStatusBar.setZoom('#policyDocumentViewer [data-document-statusbar]', 100);
  }

  function selectWorkspace(item) {
    activeHistoryId = item?.id || '';
    const hasSample = activeHistoryId === 'policy-example-1';
    pendingWorkspaceTitle = '';
    renderWorkspaceTitle();
    $('#policyFiles').innerHTML = hasSample ? sampleFiles : '';
    bindFileActions();
    if (!hasSample) {
      const row = document.createElement('li');
      row.append(createContentEmpty('보고서 업로드 목록이 없습니다.', '보고서를 업로드하면 이 영역에 목록이 표시됩니다', true));
      $('#policyFiles').append(row);
    }
    $('#policyFileCount').textContent = hasSample ? '1건' : '0건';
    $('#policyDocument').hidden = !hasSample;
    window.AIOneLoadingOverlay.preview(
      $('#policyDocument'),
      hasSample ? $('#policyFiles .file-name')?.textContent.trim() : '',
      () => {}
    );
    $('.policy-document-pane .sub-badge').hidden = !hasSample;
    $('#resultBody').hidden = !hasSample;
    documentEmpty.hidden = hasSample;
    resultEmpty.hidden = hasSample;
    documentEmpty.querySelector('span').textContent = item ? '목록 화면용 예시입니다. 이 항목의 원본은 연결되어 있지 않습니다.' : '보고서를 업로드하면 원본을 여기에서 확인할 수 있습니다.';
    resultEmpty.querySelector('span').textContent = item ? '이 항목의 상세 검증 결과는 연결되어 있지 않습니다.' : '보고서를 업로드하고 분석하면 검증 결과가 표시됩니다.';
    $('#policyExport').disabled = !hasSample;
    $('#policySearch').value = '';
    $('#policyFileInput').value = '';
    filter = 'all';
    document.querySelectorAll('[data-policy-filter]').forEach(button => {
      const selected = button.dataset.policyFilter === filter;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-pressed', String(selected));
      const labels = { all: '전체', review: '확인 필요', pass: '충족' };
      button.textContent = `${labels[button.dataset.policyFilter]} ${hasSample && button.dataset.policyFilter !== 'pass' ? 1 : 0}`;
    });
    $('#taskTitle').nextElementSibling.textContent = hasSample ? '1건' : '0건';
    syncDocumentStatusbar(hasSample);
    filterTasks();
    renderHistory();
    window.AIOneSidePop.close('#runDrawer');
    if (!item) { announce('새 작업공간을 열었습니다. 보고서를 업로드해 주세요.'); $('#policyUpload').focus(); }
  }

  /* End: 신규 - 선택 이력 및 새 분석 화면 전환 */
  /* Start: 신규 - 공통 실행 목록 렌더링 및 건수 배지 */
  const historyPagination = window.AIOneConversationDrawer.bindLocalPagination({ list: $('#policyRunList'), drawer: $('#runDrawer') });
  function renderHistory() {
    const keyword = $('#runListSearch').value.trim().toLocaleLowerCase();
    const visible = window.AIOneConversationDrawer.filterItems(historyItems, keyword);
    window.AIOneConversationDrawer.renderChatItems({
      list: $('#policyRunList'), items: visible, activeId: activeHistoryId,
      sortMode: $('#runListSort').value, totalElement: $('#runListTotal'), total: visible.length,
      showIcon: false, titleMax: 120, isPending: item => item.pending, onSelect: selectWorkspace,
      getBadges: item => ['부처', '보고서', '정책과제', '확인 필요']
        .map((label, index) => ({ text: `${label} ${item.counts[index]}건`, variant: ['member', '', 'query', 'review'][index] }))
        .filter((_, index) => index !== 3 || item.counts[index] > 0)
    });
    $('#policyRunList').querySelectorAll('[data-conversation-id]').forEach(row => {
      const item = historyItems.find(entry => entry.id === row.dataset.conversationId);
      row.querySelector('.drawer-chat-select').setAttribute('aria-label', `${item.title} 보고서 검증 열기`);
    });
    historyPagination.paginate(JSON.stringify([keyword, $('#runListSort').value]));
    if (!visible.length) {
      const empty = window.AIOneConversationDrawer.createEmpty(keyword ? '검색 조건에 맞는 보고서 검증 목록이 없습니다.' : '보고서 검증 목록이 없습니다.');
      $('#policyRunList').append(empty);
    }
  }
  /* End: 신규 - 공통 실행 목록 렌더링 및 건수 배지 */
  /* Start: 신규 - 실행 목록 검색·정렬·고정·타이틀 변경·삭제 */
  window.AIOneConversationDrawer.bindControls({
    search: $('#runListSearch'), searchClear: $('#runListSearchClear'), sort: $('#runListSort'),
    onSearch: renderHistory, onSearchInput: renderHistory, onClear: renderHistory, onSort: renderHistory
  });
    /* Start: 261026 수정 - Drawer 목록 최초 로딩 */
  $('#runDrawer').addEventListener('sidepop:open', () => window.AIOneDrawerLoading.run($('#policyRunList'), '보고서 검증 목록', renderHistory));
    /* End: 261026 수정 - Drawer 목록 최초 로딩 */
  window.AIOneConversationDrawer.bindActions({ drawer: $('#runDrawer'), onAction(detail) {
    const { items, item } = window.AIOneConversationDrawer.applyLocalAction(historyItems, detail);
    if (!item) return;
    historyItems = items;
    if (item.id === activeHistoryId) {
      if (detail.action === 'rename') renderWorkspaceTitle();
      if (detail.action === 'delete') selectWorkspace(null);
    }
    queueMicrotask(renderHistory);
  } });
  renderHistory();

  /* End: 신규 - 실행 목록 검색·정렬·고정·타이틀 변경·삭제 */
  /* Start: 신규 - 공통 보조도구 및 체크리스트 초기화 */
  // 패널 순환과 레이아웃 초기화는 common.js가 처리합니다.
  const panels = $('.three-panel');
  window.AIOnePanel.initShell({ container: panels, collapse: false, accessory: false });
  window.AIOneWorkspaceUi.initPanelCollapse({ container: panels });
  window.AIOneWorkspaceCommon.initAccessoryTools({
    readyKey: 'policyAccessoryReady',
    onTogglePanelResize: button => {
      const changed = window.AIOneWorkspaceUi.togglePanelResizeMode({ container: panels, button });
      announce(changed ? '패널 위치를 변경했습니다.' : '패널 위치 변경은 넓은 화면에서 사용할 수 있습니다.');
    },

  });
  document.addEventListener('topbar:fullscreen-unavailable', () => announce('현재 브라우저에서 전체화면을 사용할 수 없습니다.'));
  renderChecklist();
  syncDocumentStatusbar(activeHistoryId === 'policy-example-1');
  /* End: 신규 - 공통 보조도구 및 체크리스트 초기화 */
})();
