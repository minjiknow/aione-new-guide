/**
 * AI-ONE 질의분류 - 대화/실행목록 모듈
 *
 * 역할
 * - 실행목록 Drawer를 조회하고 렌더링한다.
 * - conversation 생성/조회/수정/삭제 및 즐겨찾기를 처리한다.
 * - 대화별 설정, 최근 작업 이력, 세션 전환 상태를 관리한다.
 *
 * 261026 변경 요약
 * - 수정 - 미리보기 실행 목록 최초 조회에도 공통 로딩 표시
 *
 * 기본 구간 형식: Start: 기능명 / End: 기능명
 * 변경 구간 형식: Start: YYMMDD 추가/수정 - 기능명 / End: YYMMDD 추가/수정 - 기능명
 * 주석 정리 내역
 * - 261023 주석 정리 - 구간 표시와 변경 내용 표기를 통일합니다. 기존 작업 날짜와 기능 설명은 유지합니다.
 */
(function registerclassification_conversationModule(window) {
    window.AIOneClassificationFeatureModules = window.AIOneClassificationFeatureModules || {};
    window.AIOneClassificationFeatureModules["classification-conversation.js"] = function install(runtime) {
        with (runtime) {
            // loadConversationSettingsV15: 조회/로딩.
            async function loadConversationSettingsV15(conversationId) {
              if (!conversationId) return null;
              try {
                // [API 연동] GET ND_conversationSettings.do: 선택한 대화의 의원 수 설정 조회.
                const data = await fetchJson(
                  `ND_conversationSettings.do?conversationId=${encodeURIComponent(conversationId)}`
                );
                if (data && Number.isFinite(Number(data.member_count))) {
                  workspaceMemberCount = Math.max(0, Number(data.member_count));
                  renderWorkspaceMeta();
                  renderFileList();
                }
                return data;
              } catch (error) {
                // 대화 자체 로딩은 계속 진행하되 서버 설정 조회 실패만 알린다.
                console.warn('v1.5 의원수 설정 조회 실패 - 기존 화면 값 유지', error);
                return null;
              }
            }

            // loadConversationSettingsBatchV18: 조회/로딩.
            async function loadConversationSettingsBatchV18(conversationIds) {
              const ids = [...new Set(
                (Array.isArray(conversationIds) ? conversationIds : [])
                  .map(value => String(value || '').trim())
                  .filter(Boolean)
              )].slice(0, 100);
              if (!ids.length) return new Map();
              try {
                const params = new URLSearchParams();
                params.append('conversationIds', ids.join(','));
                // [API 연동] GET ND_conversationSettingsBatch.do: 대화 목록의 의원 수 설정 일괄 조회.
                const data = await fetchJson(`ND_conversationSettingsBatch.do?${params.toString()}`);
                const rows = Array.isArray(data)
                  ? data
                  : Array.isArray(data?.items)
                    ? data.items
                    : Array.isArray(data?.data)
                      ? data.data
                      : [];
                return new Map(
                  rows.map(row => [
                    String(row?.conversation_id ?? row?.conversationId ?? '').trim(),
                    row
                  ]).filter(([id]) => Boolean(id))
                );
              } catch (error) {
                console.warn('v1.8 대화 설정 배치 조회 실패 - 단건 조회 fallback', error);
                const pairs = await Promise.all(ids.map(async id => {
                  try {
                    // [API 연동] GET ND_conversationSettings.do: 일괄 조회 실패 시 대화별 설정 재조회.
                    const row = await fetchJson(
                      `ND_conversationSettings.do?conversationId=${encodeURIComponent(id)}`
                    );
                    return [id, row];
                  } catch (fallbackError) {
                    console.warn('대화 설정 단건 fallback 실패', id, fallbackError);
                    return [id, null];
                  }
                }));
                return new Map(pairs);
              }
            }

            // saveConversationSettingsV15: 저장.
            async function saveConversationSettingsV15(conversationId, memberCount) {
              if (!conversationId) return null;
              const body = new URLSearchParams();
              body.append('conversationId', conversationId);
              body.append('memberCount', String(Math.max(0, Number(memberCount || 0))));
              // [API 연동] POST ND_updateConversationSettings.do: 대화의 의원 수 설정 저장.
              return fetchJson('ND_updateConversationSettings.do', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: body.toString()
              });
            }

            // setActualConversationFavorite: 상태 설정.
            async function setActualConversationFavorite(conversationId, favorite) {
              if (!conversationId) return null;
              const body = new URLSearchParams();
              body.append('conversationId', conversationId);
              // [API 연동] POST ND_addConversationFavorite.do / ND_removeConversationFavorite.do: 대화 즐겨찾기 추가/해제.
              return fetchJson(
                favorite ? 'ND_addConversationFavorite.do' : 'ND_removeConversationFavorite.do',
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                  body: body.toString()
                }
              );
            }

            // ensureV15DrawerLayoutStyles: 필요 요소/상태 보장.
            function ensureV15DrawerLayoutStyles() {
              // 퍼블리싱 통합 후 런타임 style 주입을 사용하지 않는다.
              // 필요한 호환 스타일은 classification-publisher-bridge.css에서 관리한다.
            }

            // loadRecentJobs: 조회/로딩.
            async function loadRecentJobs() {
              try {
                // [API 연동] GET ND_jobs.do: 최근 질의분류 작업 목록 조회.
                const data = await fetchJson('ND_jobs.do?page=1&size=20');
                const baseJobs = Array.isArray(data)
                  ? data
                  : Array.isArray(data?.items)
                    ? data.items
                    : Array.isArray(data?.jobs)
                      ? data.jobs
                      : [];
                const sorted = [...baseJobs].sort((a, b) =>
                  String(b?.updated_at || b?.created_at || '')
                    .localeCompare(String(a?.updated_at || a?.created_at || ''))
                );
                const topJobs = sorted.slice(0, 10);
                const documentNameCache = new Map();
                recentJobs = await Promise.all(
                  topJobs.map(async job => {
                    const jobId = String(job?.job_id || job?.id || '');
                    let detail = job;
                    // GET /jobs 목록에는 파일명이 없으므로 job 상세에서 document_id를 얻는다.
                    if (jobId) {
                      try {
                        // [API 연동] GET ND_jobStatus.do: 최근 작업의 상세 상태 조회.
                        detail = await fetchJson(
                          `ND_jobStatus.do?jobId=${encodeURIComponent(jobId)}`
                        );
                      } catch (error) {
                        console.warn('최근 작업 상세 조회 실패', jobId, error);
                      }
                    }
                    const documentRows = Array.isArray(detail?.documents)
                      ? detail.documents
                      : [];
                    const documentNames = [];
                    for (const row of documentRows) {
                      const documentId = String(row?.document_id || '');
                      if (!documentId) continue;
                      if (documentNameCache.has(documentId)) {
                        const cached = documentNameCache.get(documentId);
                        if (cached) documentNames.push(cached);
                        continue;
                      }
                      try {
                        // [API 연동] GET ND_documents.do: 최근 작업에 연결된 문서 정보 조회.
                        const doc = await fetchJson(
                          `ND_documents.do?documentId=${encodeURIComponent(documentId)}`
                        );
                        const fileName = String(
                          doc?.file_name ??
                          doc?.name ??
                          doc?.original_file_name ??
                          ''
                        ).trim();
                        documentNameCache.set(documentId, fileName);
                        if (fileName) documentNames.push(fileName);
                      } catch (error) {
                        documentNameCache.set(documentId, '');
                        console.warn('최근 작업 문서명 조회 실패', documentId, error);
                      }
                    }
                    return {
                      ...job,
                      ...detail,
                      _documentNames: documentNames
                    };
                  })
                );
                renderWorkLog();
              } catch (error) {
                console.warn('최근 작업 로그 조회 실패', error);
                recentJobs = [];
                renderWorkLog('최근 작업 로그를 불러오지 못했습니다.');
              }
            }

            // renderWorkLog: 화면 렌더링.
            function renderWorkLog(errorMessage = '') {
              const list = $('#workLog');
              if (!list) return;
              if (errorMessage && !recentJobs.length) {
                list.innerHTML = `<li class="work-log-empty">${escapeHtml(errorMessage)}</li>`;
                return;
              }
              const jobs = recentJobs.slice(0, 20);
              if (!jobs.length) {
                list.innerHTML = '<li class="work-log-empty">최근 분류 작업이 없습니다.</li>';
                return;
              }
              list.innerHTML = jobs.map(job => {
                const status = normalizeActualStatus(job?.status);
                const statusLabel =
                  status === 'completed' ? '분류 완료' :
                  status === 'failed' ? '분류 실패' :
                  '분류 진행중';
                const created = String(job?.updated_at || job?.created_at || '')
                  .replace('T', ' ')
                  .slice(0, 16);
                const count = Number(job?.question_count || 0);
                const documentCount = Number(job?.document_count || 0);
                const names = Array.isArray(job?._documentNames)
                  ? job._documentNames.filter(Boolean)
                  : [];
                const documentLabel = names.length === 0
                  ? `문서 ${documentCount}개`
                  : names.length === 1
                    ? names[0]
                    : `${names[0]} 외 ${names.length - 1}개`;
                return `
                  <li class="work-log-item">
                    <span class="work-log-dot ${status}"></span>
                    <div class="work-log-info">
                      <div class="work-log-head">
                        <strong>${escapeHtml(statusLabel)} · 질의 ${count}건</strong>
                        <span>${escapeHtml(created)}</span>
                      </div>
                      <div class="work-log-file" title="${escapeHtml(names.join(', ') || documentLabel)}">
                        ${escapeHtml(documentLabel)}
                      </div>
                    </div>
                  </li>`;
              }).join('');
            }

            // resetRunDrawerVisibility: 초기 상태 복원.
            function resetRunDrawerVisibility() {
              if (!runDrawer) return;
              runDrawer.classList.add('hidden');
              runDrawer.hidden = true;
              runDrawer.setAttribute('aria-hidden', 'true');

              if (drawerBackdrop) {
                  drawerBackdrop.classList.add('hidden');
                  drawerBackdrop.hidden = true;
              }
            }

            // openDrawer: 화면/팝업 열기.
            async function openDrawer() {
              ensureV15DrawerLayoutStyles();
              // 이전에 닫았을 때 남은 목록 스크롤 위치 초기화.
              const runList = $('#runList');
              if (runList) runList.scrollTop = 0;
              await loadActualConversations(true);
            }

            // refreshActualConversationStatus: 대화방 상태는 작업 진행 여부만 표시한다.
            async function refreshActualConversationStatus(conversationId) {
                const conversationKey = String(conversationId || '').trim();
                if (!conversationKey) return 'completed';

                const hadLocalPendingJobs = hasActualPendingJobs(conversationKey);

                try {
                    // [API 연동] GET ND_conversationDocuments.do: 대화의 진행 상태 갱신에 필요한 문서 목록 조회.
                    const data = await fetchJson(
                        `ND_conversationDocuments.do?conversationId=${encodeURIComponent(conversationKey)}`
                    );
                    const documents = normalizeActualDocuments(data);
                    const jobIds = [
                        ...new Set(
                            documents
                                .map(document => String(document?.last_job_id ?? document?.job_id ?? '').trim())
                                .filter(Boolean)
                        )
                    ];

                    let hasServerProcessingJob = false;

                    if (jobIds.length) {
                        const statuses = await Promise.all(
                            jobIds.map(async jobId => {
                                try {
                                    // [API 연동] GET ND_jobStatus.do: 문서별 작업 상태를 조회하여 대화 상태 계산.
                                    const job = await fetchJson(
                                        `ND_jobStatus.do?jobId=${encodeURIComponent(jobId)}`
                                    );
                                    return normalizeActualStatus(job?.status);
                                } catch (error) {
                                    console.error('[질의이력 job 상태 조회 실패]', jobId, error);
                                    return null;
                                }
                            })
                        );

                        hasServerProcessingJob = statuses.some(
                            status => status === 'processing'
                        );
                    }

                    const conversationStatus =
                        hadLocalPendingJobs || hasServerProcessingJob
                            ? 'processing'
                            : 'completed';

                    if (conversationStatus === 'completed') {
                        actualPendingJobsByConversation.delete(conversationKey);
                    }

                    actualConversationStatusMap.set(
                        conversationKey,
                        conversationStatus
                    );

                    const storedConversation = actualConversationItems.find(
                        item =>
                            String(item.id ?? item.conversation_id ?? '') ===
                            conversationKey
                    );
                    if (storedConversation) {
                        storedConversation._actualStatus = conversationStatus;
                    }

                    if (String(actualConversationId || '') === conversationKey) {
                        syncActiveIntakeSkeleton();
                    }

                    return conversationStatus;
                } catch (error) {
                    console.error(
                        '[질의이력 대화 상태 조회 실패]',
                        conversationKey,
                        error
                    );

                    const fallbackStatus = hadLocalPendingJobs
                        ? 'processing'
                        : 'completed';

                    actualConversationStatusMap.set(
                        conversationKey,
                        fallbackStatus
                    );
                    return fallbackStatus;
                }
            }

            // updateActualConversationTitle: 상태/데이터 수정.
            async function updateActualConversationTitle(
              conversationId,
              title
            ) {
              if (!conversationId) {
                throw new Error('수정할 대화 ID가 없습니다.');
              }
              const nextTitle =
                String(title || '').trim();
              if (!nextTitle) {
                throw new Error('변경할 제목을 입력해 주세요.');
              }
              const body = new URLSearchParams();
              body.append(
                'conversationId',
                String(conversationId)
              );
              body.append(
                'title',
                nextTitle
              );
              // [API 연동] POST ND_updateConversationTitle.do: 실행 이력의 대화 제목 변경.
              const response = await fetch(
                'ND_updateConversationTitle.do',
                {
                  method: 'POST',
                  headers: {
                    'Content-Type':
                      'application/x-www-form-urlencoded;charset=UTF-8'
                  },
                  body: body.toString()
                }
              );
              if (!response.ok) {
                throw new Error(
                  `대화 제목 수정 실패 (${response.status})`
                );
              }
              try {
                return apiData(await response.json());
              } catch (error) {
                return null;
              }
            }

            // deleteActualConversation: 삭제.
            async function deleteActualConversation(
              conversationId
            ) {
              if (!conversationId) {
                throw new Error('삭제할 대화 ID가 없습니다.');
              }
              const body = new URLSearchParams();
              body.append(
                'conversationId',
                String(conversationId)
              );
              // [API 연동] POST ND_deleteConversation.do: 실행 이력의 대화 삭제.
              const response = await fetch(
                'ND_deleteConversation.do',
                {
                  method: 'POST',
                  headers: {
                    'Content-Type':
                      'application/x-www-form-urlencoded;charset=UTF-8'
                  },
                  body: body.toString()
                }
              );
              if (!response.ok) {
                throw new Error(
                  `대화 삭제 실패 (${response.status})`
                );
              }
              return true;
            }

            // syncAfterConversationDelete: 상태 동기화.
            async function syncAfterConversationDelete(conversationId) {
              const deletedId = String(conversationId || '').trim();
              const deletingCurrent = String(actualConversationId || '') === deletedId;
              const index = actualConversationItems.findIndex(
                item => String(item.id ?? item.conversation_id ?? '') === deletedId
              );
              if (index >= 0) actualConversationItems.splice(index, 1);
              actualConversationStatusMap.delete(deletedId);
              if (!deletingCurrent) {
                renderDrawer();
                return;
              }
              actualConversationId = null;
              activeSessionId = null;
              // 홈 최근 사용 이력에서 들어온 삭제된 conversationId가 URL에 남지 않게 정리한다.
              const url = new URL(window.location.href);
              url.searchParams.delete('conversationId');
              url.searchParams.delete('historyAgentId');
              url.searchParams.delete('fromHistory');
              window.history.replaceState({}, '', url.pathname + url.search);
              // 삭제 후 남아 있는 대화 중 updated_at 기준 최신 대화를 조회한다.
              const params = new URLSearchParams({
                page: '1',
                size: '1',
                sort: '-updated_at'
              });
              // [API 연동] GET ND_conversationList.do: 대화 삭제 후 다음에 표시할 대화 조회.
              const data = await fetchJson(`ND_conversationList.do?${params.toString()}`);
              const nextConversation = Array.isArray(data?.items)
                ? data.items[0]
                : Array.isArray(data)
                  ? data[0]
                  : null;
              const nextConversationId = String(
                nextConversation?.id ?? nextConversation?.conversation_id ?? ''
              ).trim();
              if (nextConversationId) {
                const exists = actualConversationItems.some(
                  item => String(item.id ?? item.conversation_id ?? '') === nextConversationId
                );
                if (!exists && nextConversation) {
                  actualConversationItems.unshift(nextConversation);
                }
                renderDrawer();
                await loadSession(nextConversationId);
                return;
              }
              resetActualWorkspaceView(true);
              workspaceTitle = '제목없는 국회질의';
              workspaceMemberCount = 0;
              renderWorkspaceMeta();
              renderDrawer();
            }

            // applyConversationTitleLocal: 상태 반영.
            function applyConversationTitleLocal(
              conversationId,
              title
            ) {
              const target =
                actualConversationItems.find(
                  item =>
                    String(
                      item.id ??
                      item.conversation_id ??
                      ''
                    ) === String(conversationId)
                );
              if (target) {
                target.title = title;
                target.display_title = title;
                target.updated_at =
                  new Date().toISOString();
              }
              const session =
                sessions.find(
                  item =>
                    String(item.id) ===
                    String(conversationId)
                );
              if (session) {
                session.title = title;
              }
              if (
                String(actualConversationId || '') ===
                String(conversationId)
              ) {
                workspaceTitle = title;
                renderWorkspaceMeta();
              }
              renderDrawer();
            }

            // requestConversationRename: API 요청.
            function requestConversationRename(
              conversationId,
              oldTitle
            ) {
              const modal = getCommonActionModal();
              const currentTitle = String(oldTitle || '').trim() || '제목없는 국회질의';
              modal.innerHTML = `
                <div class="modal-bg" aria-hidden="true"></div>
                <section class="modal-contents modal-medium" data-modal-variant="rename" role="dialog" aria-modal="true" aria-label="실행 건 제목 변경">
                  <div class="modal-variant-panel" data-modal-panel="content">
                    <div class="modal-icon rename" data-modal-icon="rename" aria-hidden="true"><img alt="" data-icon="edit-compact"></div>
                    <h3 class="modal-title">실행 건 제목 변경</h3>
                    <p class="modal-rename-helper">목록에서 구분하기 쉬운 제목으로 변경할 수 있습니다.</p>
                    <label class="modal-rename-field">
                      <span class="modal-rename-label">실행 건 제목</span>
                      <input id="conversationRenameInput" class="form-input" type="text" maxlength="100" value="${escapeHtml(currentTitle)}" aria-label="실행 건 제목" draggable="false">
                    </label>
                    <div class="modal-actions">
                      <button type="button" class="btn-cancel" data-modal-close>취소</button>
                      <button type="button" class="btn-confirm" id="conversationRenameConfirm">저장</button>
                    </div>
                  </div>
                </section>`;
              window.AIOneIcons?.hydrate(modal);
              window.AIOneModal?.init(modal);
              window.AIOneModal?.open(modal);
              const input = $('#conversationRenameInput');
              const confirmBtn = $('#conversationRenameConfirm');
              ['pointerdown', 'mousedown', 'click'].forEach(type => input?.addEventListener(type, event => event.stopPropagation()));
              input?.addEventListener('dragstart', event => event.preventDefault());
              requestAnimationFrame(() => { input?.focus(); input?.select(); });
              const submit = async () => {
                const normalized = String(input?.value || '').trim();
                if (!normalized) { showToast('변경할 제목을 입력해 주세요.'); input?.focus(); return; }
                if (normalized === String(currentTitle).trim()) { window.AIOneModal?.close(modal); return; }
                if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = '저장중...'; }
                try {
                  await updateActualConversationTitle(conversationId, normalized);
                  applyConversationTitleLocal(conversationId, normalized);
                  window.AIOneModal?.close(modal);
                  showToast('실행 건 제목이 변경되었습니다.');
                } catch (error) {
                  console.error('실행 건 제목 변경 실패', error);
                  showToast(error.message || '실행 건 제목 변경에 실패했습니다.');
                  if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = '저장'; }
                }
              };
              confirmBtn?.addEventListener('click', submit, { once: true });
              input?.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); submit(); } });
            }

            // requestConversationDelete: 공통 SidePop에서 삭제 확인이 끝난 뒤 실제 삭제만 수행한다.
            // 여기서 다시 confirm을 띄우면 삭제 확인창이 두 번 표시되므로 재확인하지 않는다.
            async function requestConversationDelete(
              conversationId,
              title
            ) {
              try {
                await deleteActualConversation(conversationId);
                await syncAfterConversationDelete(conversationId);
                showToast('대화방이 삭제되었습니다.');
              } catch (error) {
                console.error('대화방 삭제 실패', error);
                showToast(
                  error.message ||
                  '대화방 삭제에 실패했습니다.'
                );
              }
            }

            // getConversationServerSort: 값 조회.
            function getConversationServerSort() {
              // 즐겨찾기(is_favorite)는 항상 최상단으로 유지한다.
              switch (runListSortOrder) {
                case 'oldest':
                  return '-is_favorite,created_at';
                case 'modified':
                  return '-is_favorite,-updated_at';
                case 'title':
                  return '-is_favorite,display_title,title';
                case 'latest':
                default:
                  return '-is_favorite,-created_at';
              }
            }

            // getConversationVisibleTitle: 값 조회.
            function getConversationVisibleTitle(item) {
              return String(
                item?.display_title ||
                item?.title ||
                ''
              ).trim();
            }

            // hydrateConversationListCounts: 실행목록의 파일/의원/질의 건수를 실제 대화 데이터로 보강한다.
            async function hydrateConversationListCounts(items) {
              const rows = Array.isArray(items) ? items : [];
              if (!rows.length) return;

              const conversationIds = rows
                .map(item => String(item?.id ?? item?.conversation_id ?? '').trim())
                .filter(Boolean);
              const settingsMap = await loadConversationSettingsBatchV18(conversationIds);
              const documentMap = new Map();

              await Promise.all(
                conversationIds.map(async conversationId => {
                  try {
                    // [API 연동] GET ND_conversationDocuments.do: 실행 목록의 파일/질의 건수 보강용 문서 조회.
                    const data = await fetchJson(
                      `ND_conversationDocuments.do?conversationId=${encodeURIComponent(conversationId)}`
                    );
                    documentMap.set(
                      conversationId,
                      normalizeActualDocuments(data)
                        .filter(document => !Boolean(document?.is_deleted))
                    );
                  } catch (error) {
                    console.warn('실행목록 문서 집계 조회 실패', conversationId, error);
                    documentMap.set(conversationId, null);
                  }
                })
              );

              rows.forEach(item => {
                const conversationId = String(
                  item?.id ?? item?.conversation_id ?? ''
                ).trim();
                if (!conversationId) return;

                const documents = documentMap.get(conversationId);
                const hasDocuments = Array.isArray(documents);
                const fileCount = hasDocuments
                  ? documents.length
                  : Math.max(
                      0,
                      Number(
                        item?.document_count ??
                        item?.documents_count ??
                        item?.file_count ??
                        item?.files_count ??
                        (Array.isArray(item?.documents) ? item.documents.length : 0)
                      ) || 0
                    );
                const questionCount = hasDocuments
                  ? documents.reduce(
                      (sum, document) => sum + Math.max(0, Number(document?.question_count ?? 0) || 0),
                      0
                    )
                  : Math.max(
                      0,
                      Number(
                        item?.question_count ??
                        item?.questions_count ??
                        item?.query_count ??
                        item?.queries_count ??
                        0
                      ) || 0
                    );
                const settings = settingsMap.get(conversationId);
                const memberCount = settings && Number.isFinite(Number(settings.member_count))
                  ? Math.max(0, Number(settings.member_count))
                  : Math.max(
                      0,
                      Number(item?.member_count ?? item?.memberCount ?? 0) || 0
                    );

                item._fileCount = fileCount;
                item._questionCount = questionCount;
                item._memberCount = memberCount;

                const storedItem = actualConversationItems.find(
                  row => String(row?.id ?? row?.conversation_id ?? '') === conversationId
                );
                if (storedItem) {
                  storedItem._fileCount = fileCount;
                  storedItem._questionCount = questionCount;
                  storedItem._memberCount = memberCount;
                }
              });
            }

            // sortConversationItemsByVisibleTitle: 기능 처리.
            function sortConversationItemsByVisibleTitle(items) {
              return window.AIOneConversationDrawer.sortItems(items, 'title', {
                pinnedFirst: false, getTitle: getConversationVisibleTitle,
              });
            }

            // isLatestConversationSort: 기능 처리.
            function isLatestConversationSort() {
              return false;
            }

            // sortConversationPageItems: 기능 처리.
            function sortConversationPageItems(items) {
              return window.AIOneConversationDrawer.sortItems(items, runListSortOrder, {
                pinnedFirst: false, getTitle: getConversationVisibleTitle,
              });
            }

            // formatConversationCreatedAt: 표시 형식 변환.
            function formatConversationCreatedAt(value) {
              return window.AIOneConversationDrawer.formatDateTime(value, {
                dateSeparator: '-'
              }).combined;
            }

            // syncRunListSortWidth: 상태 동기화.
            function syncRunListSortWidth() {
              window.AIOneConversationDrawer.syncSortWidth($('#runListSort'));
            }

            // getLatestWorkedConversationId: 값 조회.
            async function getLatestWorkedConversationId() {
              const params = new URLSearchParams({ page: '1', size: '1', sort: '-updated_at' });
              // [API 연동] GET ND_conversationList.do: 가장 최근 작업한 대화 ID 조회.
              const data = await fetchJson(`ND_conversationList.do?${params.toString()}`);
              const item = Array.isArray(data?.items) ? data.items[0] : Array.isArray(data) ? data[0] : null;
              return String(item?.id ?? item?.conversation_id ?? '').trim();
            }

            // loadActualConversations: 조회/로딩.
            async function loadActualConversations(
              reset,
              searchTitle = runListSearchTerm
            ) {
              const normalizedTitle =
                String(searchTitle || '').trim();
              if (!reset && actualConversationLoading) return;
              if (reset) {
                actualConversationRequestSeq += 1;
                actualConversationTotal = 0;
                actualConversationPages = 1;
                actualConversationItems.length = 0;
                runListSearchTerm = normalizedTitle;
                actualConversationPage =
                  isLatestConversationSort()
                    ? 0
                    : 1;
              }
              const requestSeq =
                actualConversationRequestSeq;
              actualConversationLoading = true;
              // Start: 261026 수정 - 실행 목록 최초 로딩 표시
              showConversationListSkeleton(!reset);
              if (window.AIOnePreview?.enabled) await new Promise(resolve => setTimeout(resolve, 400));
              if (requestSeq !== actualConversationRequestSeq) return;
              // End: 261026 수정 - 실행 목록 최초 로딩 표시
              const buildParams = page => {
                const params =
                  new URLSearchParams();
                params.append(
                  'page',
                  String(page)
                );
                params.append(
                  'size',
                  String(ACTUAL_CONVERSATION_PAGE_SIZE)
                );
                params.append(
                  'sort',
                  getConversationServerSort()
                );
                if (normalizedTitle) params.append('title', normalizedTitle);
                return params;
              };
              const fetchPage = page =>
                // [API 연동] GET ND_conversationList.do: #runList 실행 목록의 검색/정렬/페이지별 데이터 조회.
                fetchJson(
                  `ND_conversationList.do?${buildParams(page).toString()}`
                );
              try {
                // 검색·제목순도 공통 페이지 크기로 서버 목록을 조회한다.
                // 전체 페이지를 Promise.all로 선조회하면 무한 스크롤이 무의미해진다.
                let data;
                let pageToLoad;
                if (
                  reset &&
                  isLatestConversationSort()
                ) {
                  const meta =
                    await fetchPage(1);
                  if (
                    requestSeq !==
                    actualConversationRequestSeq
                  ) {
                    return;
                  }
                  actualConversationTotal =
                    Number(meta?.total || 0);
                  actualConversationPages =
                    Number(
                      meta?.pages ||
                      Math.max(
                        1,
                        Math.ceil(
                          actualConversationTotal /
                          ACTUAL_CONVERSATION_PAGE_SIZE
                        )
                      )
                    );
                  pageToLoad =
                    Math.max(
                      1,
                      actualConversationPages
                    );
                  data =
                    pageToLoad === 1
                      ? meta
                      : await fetchPage(pageToLoad);
                } else {
                  pageToLoad =
                    actualConversationPage;
                  if (
                    pageToLoad < 1 ||
                    pageToLoad > actualConversationPages
                  ) {
                    return;
                  }
                  data =
                    await fetchPage(pageToLoad);
                }
                if (
                  requestSeq !==
                  actualConversationRequestSeq
                ) {
                  return;
                }
                const rawItems =
                  Array.isArray(data?.items)
                    ? data.items
                    : Array.isArray(data)
                      ? data
                      : [];
                const items =
                  sortConversationPageItems(
                    rawItems
                  );
                actualConversationTotal =
                  Number(
                    data?.total ??
                    actualConversationTotal ??
                    0
                  );
                const responseSize =
                  Number(
                    data?.size ||
                    ACTUAL_CONVERSATION_PAGE_SIZE
                  );
                actualConversationPages =
                  Number(
                    data?.pages ||
                    actualConversationPages ||
                    Math.max(
                      1,
                      Math.ceil(
                        actualConversationTotal /
                        Math.max(
                          1,
                          responseSize
                        )
                      )
                    )
                  );
                const responsePage =
                  Number(
                    data?.page ||
                    pageToLoad
                  );
                const known =
                  new Set(
                    actualConversationItems.map(
                      item =>
                        String(
                          item.id ??
                          item.conversation_id ??
                          ''
                        )
                    )
                  );
                items.forEach(item => {
                  const id =
                    String(
                      item.id ??
                      item.conversation_id ??
                      ''
                    );
                  if (
                    id &&
                    !known.has(id)
                  ) {
                    actualConversationItems.push({
                      ...item,
                      __conversationPage: responsePage
                    });
                    known.add(id);
                  }
                });
                actualConversationPage =
                  isLatestConversationSort()
                    ? responsePage - 1
                    : responsePage + 1;
                await hydrateConversationListCounts(items);
                hideConversationListSkeleton();
                if (!isDrawerActionModalOpen()) renderDrawer();
                const activeConversation =
                  items.find(
                    item =>
                      String(
                        item.id ??
                        item.conversation_id ??
                        ''
                      ) ===
                      String(
                        actualConversationId ||
                        ''
                      )
                  );
                if (activeConversation) {
                  const serverTitle =
                    getConversationVisibleTitle(
                      activeConversation
                    );
                  if (serverTitle) {
                    workspaceTitle =
                      serverTitle;
                    renderWorkspaceMeta();
                  }
                }
                Promise.all(
                  items.map(item =>
                    refreshActualConversationStatus(
                      String(
                        item.id ??
                        item.conversation_id ??
                        ''
                      )
                    )
                  )
                )
                  .then(() => {
                    if (
                      requestSeq ===
                      actualConversationRequestSeq
                    ) {
                      if (!isDrawerActionModalOpen()) renderDrawer();
                    }
                  })
                  .catch(error => {
                    console.warn(
                      '대화 상태 후속 갱신 실패',
                      error
                    );
                  });
              } catch (error) {
                if (
                  requestSeq !==
                  actualConversationRequestSeq
                ) {
                  return;
                }
                hideConversationListSkeleton();
                renderDrawer();
                console.error(
                  '질의이력 조회 실패',
                  error
                );
                showToast(
                  error.message ||
                  '질의이력 조회에 실패했습니다.'
                );
              } finally {
                if (
                  requestSeq ===
                  actualConversationRequestSeq
                ) {
                  actualConversationLoading = false;
                  hideConversationListSkeleton();
                  requestAnimationFrame(() => {
                    const list =
                      $('#runList');
                    const hasNextPage =
                      runListSortOrder === 'title'
                        ? false
                        : isLatestConversationSort()
                          ? actualConversationPage >= 1
                          : actualConversationPage <=
                              actualConversationPages;
                    if (
                      list &&
                      hasNextPage &&
                      list.scrollHeight <=
                        list.clientHeight + 8
                    ) {
                      loadActualConversations(
                        false,
                        runListSearchTerm
                      );
                    }
                  });
                }
              }
            }

            // 작업 메뉴/확인 모달이 열린 동안 목록 DOM을 교체하지 않는다.
            function isDrawerActionModalOpen() {
              return Boolean(
                runDrawer?.classList.contains('has-child-modal') ||
                document.querySelector(
                  '.modal.modal-over-drawer:not(.hidden):not([hidden])'
                )
              );
            }

            // renderDrawer: 화면 렌더링.
            function renderDrawer() {
              const items =
                actualConversationItems.slice().sort((a, b) => {
                  const favoriteDiff =
                    Number(Boolean(b?.is_favorite)) -
                    Number(Boolean(a?.is_favorite));
                  if (favoriteDiff !== 0) return favoriteDiff;
                  return 0;
                });
              const list =
                $('#runList');
              const loadedCount =
                items.length;
              const serverTotal =
                Number.isFinite(
                  Number(actualConversationTotal)
                )
                  ? Number(actualConversationTotal)
                  : loadedCount;
            const total =
                $('#runListTotal');
              if (total) {
                total.textContent =
                  String(serverTotal);
              }
              if (!list) return;
              const loading = list.querySelector(':scope > .drawer-list-loading-more');
              const scrollTop = list.scrollTop;
              list.innerHTML =
                items.length
                  ? items
                      .map(item => {
                        const id =
                          String(
                            item.id ??
                            item.conversation_id ??
                            ''
                          );
                        const status =
                          actualConversationStatusMap.get(id) ||
                          (hasActualPendingJobs(id) ? 'processing' : 'completed');
                        const created =
                          formatConversationCreatedAt(
                            item.created_at
                          );
                        const completedNotice = completedConversationIds.has(id);
                        const statusLabel =
                          status === 'completed'
                            ? '완료'
                            : status === 'failed'
                              ? '실패'
                              : '진행중';
                        const title =
                          item.display_title ||
                          item.title ||
                          '국회질의 분류';
                        const fileCount = Math.max(
                          0,
                          Number(
                            item._fileCount ??
                            item.document_count ??
                            item.documents_count ??
                            item.file_count ??
                            item.files_count ??
                            (Array.isArray(item.documents) ? item.documents.length : 0)
                          ) || 0
                        );
                        const memberCount = Math.max(
                          0,
                          Number(
                            item._memberCount ??
                            item.member_count ??
                            item.memberCount ??
                            0
                          ) || 0
                        );
                        const questionCount = Math.max(
                          0,
                          Number(
                            item._questionCount ??
                            item.question_count ??
                            item.questions_count ??
                            item.query_count ??
                            item.queries_count ??
                            0
                          ) || 0
                        );
                        return `
                          <li
                            class="drawer-run-item run-item${id === String(actualConversationId || '') ? ' is-active' : ''}${Boolean(item.is_favorite) ? ' is-pinned' : ''}"
                            data-conversation-id="${escapeHtml(id)}"
                            data-pinned="${Boolean(item.is_favorite) ? 'true' : 'false'}"
                          >
                            <span
                              class="drawer-run-state${status === 'completed' ? '' : status === 'failed' ? ' failed' : ' pending'}"
                              aria-label="${escapeHtml(statusLabel)}"
                            ></span>
                            ${completedNotice ? '<span class="nav-complete-dot" aria-hidden="true"></span>' : ''}
                            <div class="drawer-run-main">
                              <strong class="drawer-run-title">${escapeHtml(title)}</strong>
                              <div class="drawer-run-meta">
                                <span>${escapeHtml(created)}</span>
                                <span class="drawer-run-status${status === 'completed' ? '' : status === 'failed' ? ' failed' : ' pending'}">
                                  ${escapeHtml(statusLabel)}
                                </span>
                              </div>
                              ${window.AIOneConversationDrawer.createBadges([
                                { text: `파일 ${fileCount}건` },
                                { text: `의원 ${memberCount}명`, variant: 'member' },
                                { text: `질의 ${questionCount}건`, variant: 'query' },
                              ]).outerHTML}
                            </div>
                            <button
                              type="button"
                              class="btn-more"
                              aria-label="더보기"
                              title="더보기"
                              aria-haspopup="menu"
                              aria-expanded="false"
                            >
                              <svg viewBox="0 0 24 24" aria-hidden="true">
                                <circle cx="12" cy="5" r="1.7"></circle>
                                <circle cx="12" cy="12" r="1.7"></circle>
                                <circle cx="12" cy="19" r="1.7"></circle>
                              </svg>
                            </button>
                          </li>
                        `;
                      })
                      .join('')
                  : `
                    <li class="run-empty drawer-list-empty"><p class="empty-title">
                      ${
                        runListSearchTerm
                          ? '검색 결과가 없습니다.'
                          : '등록된 질의이력이 없습니다.'
                      }
                    </p></li>
                  `;
              if (loading) list.append(loading);
              list.scrollTop = scrollTop;
              $$('.drawer-run-item[data-conversation-id]', list).forEach(row => {
                const conversationId = String(row.dataset.conversationId || '');
                row.querySelector('.drawer-run-main')?.addEventListener(
                  'click',
                  () => {
                    // 명시적으로 대화방을 선택했을 때만 Drawer를 닫는다.
                    window.AIOneSidePop?.close('#runDrawer');
                    loadSession(conversationId);
                  }
                );
              });
              // 더보기/고정/이름변경/삭제 UI는 퍼블 공통 컴포넌트가 생성·제어한다.
              window.AIOneIcons?.hydrate(list);
              window.AIOneSidePop?.initRunActionMenus(list);
            }

            // loadSession: 조회/로딩.
            async function loadSession(conversationId) {
              if (!conversationId) return;
              const targetConversationId = String(conversationId);
              actualConversationId = targetConversationId;
              activeSessionId = actualConversationId;
              // 해당 대화방을 열면 최근 작업 완료 표시를 읽음 처리한다.
              completedConversationIds.delete(targetConversationId);
              // 실행목록에서 대화방에 들어올 때는 항상 정리된 질의분류 화면부터 표시한다.
              actualDocumentViewMode = 'html';
              const selectedConversation = actualConversationItems.find(
                item => String(item.id ?? item.conversation_id ?? '') === actualConversationId
              );
              if (selectedConversation) {
                workspaceTitle = String(
                  selectedConversation.display_title ||
                  selectedConversation.title ||
                  '제목없는 국회질의'
                ).trim() || '제목없는 국회질의';
                renderWorkspaceMeta();
              }
              resetActualWorkspaceView(false);
              const selectionEpoch = classificationWorkspaceEpoch;
              actualConversationId = targetConversationId;
              activeSessionId = actualConversationId;
              actualDocumentViewMode = 'html';
              try {
                const knownConversationStatus = actualConversationStatusMap.get(targetConversationId);
                const roomCompletedSnapshot =
                  knownConversationStatus === 'completed' &&
                  !hasActualPendingJobs(targetConversationId);
                // 방 재진입 시에는 서버 문서/job 상태를 확인하기 전까지
                // '진행중' 스켈레톤을 선제적으로 띄우지 않는다.
                // 실제 processing 파일이 확인된 뒤 syncActiveIntakeSkeleton()이 표시한다.
                hideIntakeSkeleton();
                // v1.5 대화 설정(member_count) 복원.
                // 신규 Java mapping이 아직 반영되지 않은 환경에서는 내부적으로 fallback한다.
                await loadConversationSettingsV15(targetConversationId);
                if (!isClassificationWorkspaceActive(targetConversationId, selectionEpoch)) return;
                // [API 연동] GET ND_conversationDocuments.do: 선택한 대화의 문서를 조회하여 #fileList 및 작업 상태 구성.
                const data = await fetchJson(
                  `ND_conversationDocuments.do?conversationId=${encodeURIComponent(targetConversationId)}`
                );
                if (!isClassificationWorkspaceActive(targetConversationId, selectionEpoch)) return;
                const docs = normalizeActualDocuments(data);
                docs.forEach(doc => {
                  const serverQuestionCount = Number(doc.question_count ?? 0);
                  const serverJobId = String(doc.last_job_id ?? doc.job_id ?? '').trim();
                  const explicitServerStatus =
                    doc.last_job_status ??
                    doc.job_status ??
                    doc.status ??
                    doc.processing_status ??
                    doc.classification_status;
                  /*
                   * 재진입 상태 복원 규칙
                   *
                   * 1. 서버가 명시한 상태가 있으면 그대로 사용한다.
                   * 2. 질의가 이미 존재하면 완료다.
                   * 3. jobId가 있으면 아래에서 ND_jobStatus.do로 실제 상태를 확인하므로
                   *    일단 processing으로 둔다.
                   * 4. jobId도 없고 질의도 없고 상태도 없으면 "진행중"일 근거가 없다.
                   *    ND_classify.do 생성 단계에서 실패한 문서가 정확히 이 상태로 남으므로
                   *    failed로 복원한다.
                   *
                   * 이전 코드는 4번까지 무조건 processing으로 만들어서,
                   * 새로고침할 때 실패 문서가 영구 진행중 + skeleton으로 부활했다.
                   */
                  const restoredDocumentStatus =
                    explicitServerStatus != null &&
                    String(explicitServerStatus).trim()
                      ? normalizeActualStatus(explicitServerStatus)
                      : serverQuestionCount > 0
                        ? 'completed'
                        : serverJobId
                          ? 'processing'
                          : 'failed';

                  uploadedFiles.push({
                    name: String(doc.file_name || ''),
                    displayName: String(doc.file_name || ''),
                    type: actualFileType(doc.file_name),
                    size: formatActualFileSize(doc.file_size),
                    sizeBytes: Number(doc.file_size || 0),
                    status: restoredDocumentStatus,
                    documentId: String(doc.document_id || ''),
                    jobId: serverJobId,
                    serverDoc: doc,
                    file: null,
                    isFavorite: Boolean(doc.is_favorite),
                    pinned: false,
                    queryCount:
                      Number.isFinite(serverQuestionCount) && serverQuestionCount >= 0
                        ? serverQuestionCount
                        : undefined,
                    conversationId: targetConversationId
                  });
                  fileDataMap[String(doc.file_name || '')] = {
                    docText: '',
                    queries: []
                  };
                });
                await Promise.all(
                  uploadedFiles.map(async (fileObj, index) => {
                    if (!fileObj.jobId) {
                      /*
                       * 일부 conversationDocuments 응답은 last_job_id/job_id 없이
                       * 문서 상태와 question_count만 내려올 수 있다.
                       * 완료 문서는 jobId 없이도 documentId 기준으로 질의를 복원한다.
                       * 실패 문서는 terminal 상태를 그대로 유지하며 polling하지 않는다.
                       */
                      const documentStatus = normalizeActualStatus(fileObj.status);
                      if (documentStatus === 'completed') {
                        await loadActualQuestions(
                          fileObj.documentId,
                          '',
                          index,
                          Number(fileObj.queryCount || 0),
                          targetConversationId,
                          selectionEpoch
                        ).catch(error => {
                          console.warn('jobId 없는 완료 문서 질의 복원 실패', fileObj.name, error);
                        });
                      }
                      if (documentStatus === 'failed') {
                        unregisterActualPendingJob(targetConversationId, fileObj.jobId);
                      }
                      return;
                    }

                    let job = null;
                    let jobStatusResolved = false;
                    try {
                      // [API 연동] GET ND_jobStatus.do: 대화를 다시 열 때 각 문서의 최신 분류 상태 조회.
                      job = await fetchJson(
                        `ND_jobStatus.do?jobId=${encodeURIComponent(fileObj.jobId)}`
                      );
                      if (job?.status != null && String(job.status).trim()) {
                        fileObj.status = normalizeActualStatus(job.status);
                        jobStatusResolved = true;
                      }
                    } catch (error) {
                      console.warn('과거 job 상태 복원 실패', fileObj.jobId, error);
                    }

                    /*
                     * 서버 job 조회에 실패했을 때는 문서 API가 준 terminal 상태를 보존한다.
                     * 특히 failed를 processing으로 바꾸거나 polling에 다시 등록하지 않는다.
                     */
                    const restoredStatus = normalizeActualStatus(fileObj.status);
                    const isTerminalStatus =
                      restoredStatus === 'completed' ||
                      restoredStatus === 'failed';

                    const wasAlreadyPolling = Boolean(
                      actualPendingJobsByConversation
                        .get(String(targetConversationId || '').trim())
                        ?.has(String(fileObj.jobId || '').trim())
                    );

                    if (isTerminalStatus) {
                      unregisterActualPendingJob(targetConversationId, fileObj.jobId);
                    } else if (roomCompletedSnapshot) {
                      // 목록이 완료여도 파일 자체 상태를 억지로 completed로 바꾸지는 않는다.
                      unregisterActualPendingJob(targetConversationId, fileObj.jobId);
                    } else if (restoredStatus === 'processing') {
                      registerActualPendingJob(targetConversationId, fileObj.jobId);
                    }

                    if (restoredStatus === 'completed') {
                      try {
                        const expectedFromJob = Array.isArray(job?.documents)
                          ? Number(
                              job.documents.find(d => String(d.document_id) === String(fileObj.documentId))?.question_count ||
                              job?.question_count ||
                              fileObj.queryCount ||
                              0
                            )
                          : Number(job?.question_count || fileObj.queryCount || 0);
                        await loadActualQuestions(
                          fileObj.documentId,
                          fileObj.jobId,
                          index,
                          expectedFromJob,
                          targetConversationId,
                          selectionEpoch
                        );
                      } catch (error) {
                        console.warn('완료 문서 질의 복원 실패', fileObj.name, error);
                      }
                    } else if (
                      restoredStatus === 'processing' &&
                      !roomCompletedSnapshot &&
                      !wasAlreadyPolling
                    ) {
                      pollActualJob(
                        fileObj.documentId,
                        fileObj.jobId,
                        index,
                        targetConversationId,
                        selectionEpoch
                      );
                    }
                  })
                );
                if (!isClassificationWorkspaceActive(targetConversationId, selectionEpoch)) return;
                // 파일별 복원 뒤 서버 상태를 다시 확인해 stale pending을 정리한다.
                await refreshActualConversationStatus(targetConversationId).catch(error => {
                  console.warn('대화방 최종 상태 확인 실패', targetConversationId, error);
                });
                if (!isClassificationWorkspaceActive(targetConversationId, selectionEpoch)) return;
                renderFileList();
                if (uploadedFiles.length) {
                  await loadFileData(0);
                } else {
                  questions.length = 0;
                  if (queryList) {
                    queryList.innerHTML = `<div class="report-empty-state query-empty-state">
            <div class="no-file-icon" aria-hidden="true"><img src="../assets/icons/no-file.svg" alt=""></div>
            <strong>등록된 질의가 없습니다</strong>
            <span>이 대화방에 등록된 질의가 없습니다.</span>
            <span>질의 파일을 추가하면 분류 결과를 확인할 수 있습니다.</span>
            </div>`;
                  }
                  renderQueryDetailPanel([]);
                }
                syncActiveIntakeSkeleton();
                // 자동 복원 완료는 사용자가 열어 둔 Drawer를 닫으면 안 된다.
              } catch (error) {
                if (!isClassificationWorkspaceActive(targetConversationId, selectionEpoch)) return;
                hideIntakeSkeleton();
                console.error('대화 문서 복원 실패', error);
                showToast(error.message || '대화 문서를 불러오지 못했습니다.');
              }
            }

            Object.assign(runtime, {
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
                loadSession
            });
        }
    };
})(window);
