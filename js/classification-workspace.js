/**
 * 261028 누적 변경 요약 (현재 구현 기준)
 * - 질의분류 패널 배치·너비·보조도구와 의원수 설정을 관리합니다. 공통 제목 편집·레이아웃 초기화 및 영역별 로딩을 연결합니다.
 *
 * AI-ONE 질의분류 - 워크스페이스 모듈
 *
 * 역할
 * - 패널 레이아웃, resize, drag/drop 상태를 관리한다.
 * - 글자 크기, 전체화면 등 보조도구를 연결한다.
 * - 제목 데이터는 공통 탑바에 연결하고 의원수 입력·설정과 로딩 화면을 관리한다.
 *
 * 261026 변경 요약
 * - 수정 - 레이아웃 초기화를 common.js로 이관하고 기본 너비·저장소·원본 문서 복원 후처리만 연결
 * - 수정 - 원본·추출결과·질의목록별 공통 로딩 및 실행 목록 스켈레톤 연결
 * - 수정 - 제목 편집을 공통 탑바에 연결하고 공통 30글자 말줄임·빈 제목 기본값 적용
 * - 수정 - 의원수 표시·입력 범위 제한·설정 저장은 질의 분류 전용 모듈에서 계속 관리
 *
 * 기본 구간 형식: Start: 기능명 / End: 기능명
 * 변경 구간 형식: Start: YYMMDD 추가/수정 - 기능명 / End: YYMMDD 추가/수정 - 기능명
 * 주석 정리 내역
 * - 261023 주석 정리 - 구간 표시와 변경 내용 표기를 통일합니다. 기존 작업 날짜와 기능 설명은 유지합니다.
 */
(function registerclassification_workspaceModule(window) {
    window.AIOneClassificationFeatureModules = window.AIOneClassificationFeatureModules || {};
    window.AIOneClassificationFeatureModules["classification-workspace.js"] = function install(runtime) {
        with (runtime) {
            // getDefaultWorkspaceTitle: 값 조회.
            function getDefaultWorkspaceTitle() {
                return "제목없는 국회질의분류";
            }

            // Start: 261026 수정 - 원본·추출결과·질의목록 공통 로딩
            function showIntakeSkeleton(message = "문서를 분석하고 있습니다...") {
                hideIntakeSkeleton();
                const targets = [
                    { container: $(".doc-split-left"), preview: true, title: "원본 문서를 불러오는 중입니다", message },
                    { container: $(".doc-split-right"), message: "해당 결과를 불러오고 있습니다" },
                    { container: $(".panel-right"), message: "질의 목록을 불러오고 있습니다" },
                ];
                targets.forEach(({ container, ...options }) => {
                    if (!container) return;
                    const overlay = window.AIOneLoadingOverlay.create(options);
                    overlay.classList.add("intake-api-skeleton");
                    window.AIOneLoadingOverlay.mount({ container, overlay });
                });
            }
            function hideIntakeSkeleton() {
                window.AIOneLoadingOverlay.remove(".intake-api-skeleton");
            }
            // End: 261026 수정 - 원본·추출결과·질의목록 공통 로딩

            // syncWorkspaceMetaToActiveSession: 상태 동기화.
            function syncWorkspaceMetaToActiveSession() {
                const session = sessions.find((item) => item.id === activeSessionId);
                if (session) {
                    session.title = workspaceTitle;
                    session.memberCount = workspaceMemberCount;
                    session.files = uploadedFiles.map((file) => file.name);
                    session.queryCount = uploadedFiles.reduce((sum, file) => sum + getFileQueryCount(file), 0);
                }
            }

            // renderWorkspaceMeta: 화면 렌더링.
            function renderWorkspaceMeta() {
                getWorkspaceTitleEditor()?.render();
                const memberInput = $("#memberCountInput");
                if (memberInput) memberInput.value = String(workspaceMemberCount ?? 0);
                const ratio = $("#fileMemberRatio");
                if (ratio) ratio.textContent = uploadedFiles.length + "/" + (workspaceMemberCount ?? 0);
                document.title = "국회질의분류 AI 워크스페이스 — AI-ONE";
            }

            // saveWorkspaceMeta: 저장.
            function saveWorkspaceMeta() {
                syncWorkspaceMetaToActiveSession();
                renderWorkspaceMeta();
            }

            // hydrateWorkspaceMeta: 기능 처리.
            function hydrateWorkspaceMeta() {
                workspaceTitle = getDefaultWorkspaceTitle();
                workspaceMemberCount = 0;
                renderWorkspaceMeta();
            }

            let workspaceTitleEditor;
            function getWorkspaceTitleEditor() {
                if (workspaceTitleEditor) return workspaceTitleEditor;
                workspaceTitleEditor = window.AIOneTopbar.createTitleEditor({
                    button: $("#workspaceTitleBtn"),
                    text: $("#workspaceTitleText"),
                    input: $("#workspaceTitleInput"),
                    getTitle: () => workspaceTitle || getDefaultWorkspaceTitle(),
                    emptyTitle: getDefaultWorkspaceTitle(),
                    saveTitle: async (title) => {
                        // 생성된 대화는 서버 저장 성공 후 로컬 상태에 반영합니다.
                        if (actualConversationId) {
                            await updateActualConversationTitle(actualConversationId, title);
                            applyConversationTitleLocal(actualConversationId, title);
                            showToast("대화 제목이 수정되었습니다.");
                        } else {
                            workspaceTitle = title;
                        }
                        saveWorkspaceMeta();
                        renderDrawer();
                    },
                    onError: (error) => {
                        console.error("상단 대화 제목 수정 실패", error);
                        showToast(error.message || "대화 제목 수정에 실패했습니다.");
                    },
                });
                return workspaceTitleEditor;
            }

            // 제목 편집은 공통 탑바에 연결하고 의원수는 화면에서 관리합니다.
            function bindWorkspaceMetaControls() {
                getWorkspaceTitleEditor();
                const memberInput = $("#memberCountInput");
                memberInput?.addEventListener("input", () => {
                    const raw = String(memberInput.value || "").trim();
                    workspaceMemberCount = raw === "" ? 0 : Math.max(0, Math.min(999, Number(raw)));
                    renderWorkspaceMeta();
                    renderFileList();
                });
                memberInput?.addEventListener("change", async () => {
                    saveWorkspaceMeta();
                    renderDrawer();
                    if (!actualConversationId) return;
                    try {
                        await saveConversationSettingsV15(actualConversationId, workspaceMemberCount);
                        showToast("의원수가 저장되었습니다.");
                    } catch (error) {
                        console.error("v1.5 의원수 저장 실패", error);
                        showToast(error.message || "의원수 저장에 실패했습니다.");
                    }
                });
                memberInput?.addEventListener("wheel", (event) => event.currentTarget.blur(), { passive: true });
            }

            // renderQueryDetailPanel: 화면 렌더링.
            function renderQueryDetailPanel(queries) {
                const counter = $("#queryDetailCounter");
                if (counter) counter.textContent = queries.length ? `문장 ${activeQueryIndex + 1} / ${queries.length} 선택됨` : "";
                if (!queries.length) {
                    docContent.innerHTML = `<div class="report-empty-state">
            <div class="no-file-icon" aria-hidden="true"><img src="../assets/icons/no-file.svg" alt=""></div>
            <strong class="empty-title">질의 추출 결과가 없습니다</strong>
            <span class="empty-desc">질의 파일을 업로드하면 추출된 질의가 표시됩니다.</span>
            <span class="empty-desc">분석이 완료되면 질의별 상세 내용을 확인할 수 있습니다.</span>
            </div>`;
                    return;
                }
                const currentQuery = queries[activeQueryIndex];
                /*
                 * 중앙 "질의 추출 결과"는 수정본이 아니라 최초 원본 상태를 표시한다.
                 * 오른쪽 질의목록만 현재 수정본을 표시한다.
                 */
                const q = getOriginalQuestionForView(currentQuery, activeQueryIndex);
                const reason = getAIReason(q);
                const summary = getQuerySummary(q);
                const office = getRecommendOffice(q);
                const confidence = Math.max(0, Math.min(100, Number(q.confidence || 0)));
                const confidenceClass = confidence >= 90 ? "is-high" : confidence >= 75 ? "is-medium" : "is-low";
                const sourcePage = 1;
                const sourceParagraph = activeQueryIndex + 1;
                docContent.innerHTML = `
                <div class="query-detail">
		
				<div class="qd-state-row">
											<div class="qd-state-copy">
												<span class="qd-state-chip" data-result-state-chip>분류
													대상</span>
												<span class="qd-state-text" data-result-state-text>필요 없는 질의는
													제외할 수 있습니다.</span>
											</div>
											<button type="button" class="qd-exclude-btn" data-detail-exclude>제외</button>
										</div>
			
                  <button class="source-link-card" id="sourceLinkCard" type="button" aria-label="원본 문서의 연결 위치로 이동">
                    <div class="source-link-head">
                      <div class="source-link-title-wrap">
                        <span class="source-link-icon" aria-hidden="true">
                          <svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.07.07l2-2a5 5 0 0 0-7.07-7.07l-1.15 1.15"/><path d="M14 11a5 5 0 0 0-7.07-.07l-2 2A5 5 0 0 0 12 20l1.15-1.15"/></svg>
                        </span>
                        <strong class="source-link-title">원문 연결 위치</strong>
                      </div>
                      <span class="source-link-location">${sourcePage}페이지 · 문단 ${sourceParagraph}</span>
                    </div>
                    <p class="source-link-text">“${q.text}”</p>
                  </button>
                  <div class="qd-section">
                    <span class="qd-label">선택한 문장 (OCR 원문)</span>
                    <div class="qd-box qd-box-ocr">
                      <span class="qd-box-text">${escapeHtml(q.text)}</span>
                      <button type="button" class="qd-copy-btn" data-copy="${encodeURIComponent(q.text)}" title="OCR 원문 복사"><img class="icon icon-small" data-icon="copy" alt="" aria-hidden="true"><span>복사</span></button>
                    </div>
                  </div>
                  <div class="qd-section">
                    <span class="qd-label">AI 질의 요약(질의 요지)</span>
                    <div class="qd-box qd-box-summary">
                      <span class="qd-box-text">${summary}</span>
                      <button type="button" class="qd-copy-btn" data-copy="${encodeURIComponent(summary)}" title="AI 질의 요약 복사"><img class="icon icon-small" data-icon="copy" alt="" aria-hidden="true"><span>복사</span></button>
                    </div>
                  </div>
                  <div class="qd-section">
                    <span class="qd-label">분류 결과</span>
                    <div class="qd-result-row">
                      <span class="qd-type-badge ${q.type}">${q.typeLabel}</span>
                      <span class="qd-org-text qd-org-main">주관: ${q.mainDept}</span>
                      ${q.type === "multi" && q.coopDept ? `<span class="qd-org-text qd-org-coop">협조: ${q.coopDept}</span>` : ""}
                    </div>
                  </div>
                  <div class="qd-section">
                    <span class="qd-label">추천 실국</span>
                    <div class="qd-office-box">${office}</div>
                  </div>
                  <div class="qd-section">
                    <span class="qd-label">AI 분류 근거</span>
                    <p class="qd-reason-text">${reason}</p>
                  </div>
                  <div class="qd-confidence-section inspector-confidence progressbar-area">
                    <div class="progressbar-row" data-component="progressbar">
                      <span class="progressbar-label">신뢰도</span>
                      <div
                        class="progressbar ${confidenceClass}"
                        data-progressbar
                        data-value="${confidence}"
                        role="progressbar"
                        aria-label="신뢰도 ${confidence}%"
                        aria-valuemin="0"
                        aria-valuemax="100"
                        aria-valuenow="${confidence}"
                        style="--progressbar-value:${confidence}%;"
                      >
                        <div class="progressbar-fill"></div>
                      </div>
                      <span class="progressbar-value">${confidence}%</span>
                    </div>
                  </div>
                </div>
              `;
                $("[data-detail-exclude]", docContent)?.addEventListener("click", () => {
                    runtime.excludeQuestion(currentQuery);
                });
                // 원문 연결 위치 클릭 → 원본 문서의 해당 문장으로 이동
                const sourceLinkCard = $("#sourceLinkCard");
                if (sourceLinkCard) {
                    sourceLinkCard.addEventListener("click", () => {
                        const originalBox = $(`.orig-query-box[data-qidx="${activeQueryIndex}"]`, $("#docOriginal"));
                        if (!originalBox) return;
                        originalBox.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
                        originalBox.classList.remove("source-link-focus");
                        void originalBox.offsetWidth;
                        originalBox.classList.add("source-link-focus");
                        window.setTimeout(() => originalBox.classList.remove("source-link-focus"), 1400);
                        showToast("원본 문장의 연결 위치로 이동했습니다.");
                    });
                }
                window.AIOneIcons?.hydrate(docContent);
                // 복사 버튼
                $$(".qd-copy-btn", docContent).forEach((btn) => {
                    btn.addEventListener("click", () => {
                        const val = decodeURIComponent(btn.dataset.copy);
                        navigator.clipboard &&
                            navigator.clipboard
                                .writeText(val)
                                .then(() => showToast("복사되었습니다."))
                                .catch(() => showToast("복사되었습니다."));
                    });
                });
                // 대응하는 질의목록 카드도 함께 강조
                const card = $(`.query-card[data-qid="${q.id}"]`, queryList);
                if (card) {
                    $$(".query-card", queryList).forEach((c) => c.classList.remove("mapped"));
                    card.classList.add("mapped");
                }
            }

            // restoreCurrentOriginalAfterLayout: 기능 처리.
            function restoreCurrentOriginalAfterLayout() {
                const file = uploadedFiles[activeFileIndex];
                if (!file) return;
                const token = ++originalLayoutRestoreToken;
                const expectedFileKey = String(file.documentId || file.name || "");
                const data = fileDataMap[file.name] || { docText: "" };
                window.requestAnimationFrame(() => {
                    const currentFile = uploadedFiles[activeFileIndex];
                    const currentFileKey = currentFile ? String(currentFile.documentId || currentFile.name || "") : "";
                    if (token !== originalLayoutRestoreToken || currentFileKey !== expectedFileKey) return;
                    renderActualDocument(currentFile, data.docText || "").catch((error) => {
                        console.error("레이아웃 변경 후 원본 복원 실패", error);
                    });
                });
            }

            // isResponsivePanelMode: 기능 처리.
            function isResponsivePanelMode() {
                return window.matchMedia("(max-width: 1024px)").matches;
            }

            function saveClassificationPanelLayout(container = $(".three-panel")) {
                if (isResponsivePanelMode()) return;
                classificationPanelLayoutController.save(container);
            }

            // getPanelMinWidth: 값 조회.
            function getPanelMinWidth(panel, key) {
                if (panel?.classList.contains("panel-collapsed")) return 44;
                return PANEL_MIN_WIDTHS[key] || 140;
            }

            // applyPanelLayoutState: 상태 반영.
            function applyPanelLayoutState(container, state) {
                if (!container || !state || !Array.isArray(state.order) || state.order.length !== 3) return;
                const handles = workspaceCommon.getPanelHandles(container);
                const currentPanels = workspaceCommon.getPanels(container);
                const currentOrder = currentPanels.map((panel, index) => workspaceCommon.getPanelKey(panel, index, { includeSlot: false }));
                const panelMap = new Map();
                currentPanels.forEach((panel, index) => panelMap.set(workspaceCommon.getPanelKey(panel, index, { includeSlot: false }), panel));
                const orderedPanels = state.order.map((key) => panelMap.get(key)).filter(Boolean);
                if (orderedPanels.length !== panelMap.size) return;
                const orderChanged = currentOrder.some((key, index) => key !== state.order[index]);
                // 순서가 같은 단순 리사이즈에서는 패널 DOM을 떼지 않는다.
                // iframe 원본이 about:blank로 초기화되는 문제를 방지한다.
                if (orderChanged) {
                    const fragment = document.createDocumentFragment();
                    orderedPanels.forEach((panel, index) => {
                        fragment.appendChild(panel);
                        if (index < orderedPanels.length - 1 && handles[index]) {
                            fragment.appendChild(handles[index]);
                        }
                    });
                    container.replaceChildren(fragment);
                }
                const widths = workspaceCommon.fitPanelWidths({
                    order: state.order,
                    widthsByPanel: state.widthsByPanel || {},
                    flexibleKey: "center",
                    getMinimum: (key) => {
                        const panel = panelMap.get(key);
                        return panel?.classList.contains("panel-collapsed") ? 44 : PANEL_MIN_WIDTHS[key] || 140;
                    },
                    getAvailableWidth: () => workspaceCommon.getAvailablePanelWidth(container, workspaceCommon.getPanelHandles(container)),
                });
                window.AIOneWorkspaceUi.applyPanelWidths(container, widths, {
                    fixedHandleWidth: 2,
                });
                // 실제 순서 변경으로 iframe/canvas가 재부착됐을 때만 현재 선택 파일의 원본을 복원한다.
                if (orderChanged) restoreCurrentOriginalAfterLayout();
            }

            // getDefaultPanelLayoutState: 값 조회.
            function getDefaultPanelLayoutState(container = $(".three-panel")) {
                const available = workspaceCommon.getAvailablePanelWidth(container, workspaceCommon.getPanelHandles(container));
                const centerWidth = Math.max(PANEL_MIN_WIDTHS.center, available - DEFAULT_PANEL_WIDTHS.left - DEFAULT_PANEL_WIDTHS.right);
                return {
                    order: [...DEFAULT_PANEL_ORDER],
                    widthsByPanel: { left: DEFAULT_PANEL_WIDTHS.left, center: centerWidth, right: DEFAULT_PANEL_WIDTHS.right },
                };
            }

            function syncLeftPanelCollapsedUi(panel, collapsed) {
                if (!panel || workspaceCommon.getPanelKey(panel, 0, { includeSlot: false }) !== "left") {
                    return;
                }

                const container = $(".three-panel");
                panel.querySelector(".workspace-file-section.file-list-section")?.classList.toggle("is-collapsed", collapsed);
                container?.classList.toggle("is-source-collapsed", collapsed);

                const button = $("#leftPanelCollapseBtn");
                if (button) {
                    const label = collapsed ? "업로드 패널 펼치기" : "업로드 패널 접기";
                    button.setAttribute("aria-expanded", String(!collapsed));
                    button.setAttribute("aria-label", label);
                    button.title = label;
                }
            }

            // setPanelCollapsed: 상태 설정.
            function setPanelCollapsed(panel, shouldCollapse) {
                const container = $(".three-panel");
                if (!panel || !container) return;
                const state = classificationPanelLayoutController.getState(container);
                if (!state) return;
                const key = workspaceCommon.getPanelKey(panel, 0, { includeSlot: false });
                if (shouldCollapse) {
                    if (!panel.classList.contains("panel-collapsed")) {
                        panel.dataset.expandedPanelWidth = String(state.widthsByPanel[key] || DEFAULT_PANEL_WIDTHS[key] || 220);
                        panel.classList.add("panel-collapsed");
                    }
                    state.widthsByPanel[key] = 44;
                } else {
                    panel.classList.remove("panel-collapsed");
                    state.widthsByPanel[key] = Math.max(PANEL_MIN_WIDTHS[key] || 140, Number(panel.dataset.expandedPanelWidth) || DEFAULT_PANEL_WIDTHS[key] || 220);
                }
                syncLeftPanelCollapsedUi(panel, shouldCollapse);
                applyPanelLayoutState(container, state);
                saveClassificationPanelLayout(container);
            }

            // initPanelDragDrop: 초기화.
            function initPanelDragDrop() {
                const container = $(".three-panel");
                if (!container) return;

                window.AIOneWorkspaceUi.initPanelDragDrop({
                    container,
                    readyKey: "classificationPanelDragReady",
                    includeSlot: false,
                    getState: () => classificationPanelLayoutController.getState(container),
                    applyState: (state) => applyPanelLayoutState(container, state),
                    saveState: () => classificationPanelLayoutController.save(container),
                    onChanged: () => showToast("패널 위치가 변경되었습니다."),
                });
            }

            // initPanelResize: 초기화.
            function initPanelResize() {
                const container = $(".three-panel");
                if (!container) return;
                window.AIOneSplitHandler?.init(container);
                classificationPanelLayoutController.restore(container);
                container.addEventListener("split-handler:resize", () => classificationPanelLayoutController.save(container));

                if (container.dataset.classificationPanelPersistenceReady !== "true") {
                    container.dataset.classificationPanelPersistenceReady = "true";

                    let isPanelResizeDragging = false;
                    workspaceCommon.getPanelHandles(container).forEach((handle) => {
                        handle.addEventListener("pointerdown", () => {
                            isPanelResizeDragging = true;
                        });
                        handle.addEventListener("keyup", (event) => {
                            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
                            window.requestAnimationFrame(() => saveClassificationPanelLayout(container));
                        });
                    });

                    const saveDraggedPanelWidths = () => {
                        if (!isPanelResizeDragging) return;
                        isPanelResizeDragging = false;
                        window.requestAnimationFrame(() => saveClassificationPanelLayout(container));
                    };

                    window.addEventListener("pointerup", saveDraggedPanelWidths);
                    window.addEventListener("pointercancel", saveDraggedPanelWidths);
                }

                window.AIOneWorkspaceUi.configurePanelLayout(container, {
                    getDefaultState: () => getDefaultPanelLayoutState(container),
                    minimumWidths: PANEL_MIN_WIDTHS,
                    clearSaved: () => classificationPanelLayoutController.clear(),
                    afterReset: ({ orderChanged }) => {
                        if (orderChanged) restoreCurrentOriginalAfterLayout();
                        saveClassificationPanelLayout(container);
                    },
                });
            }

            // clearPanelInteractionState: 기능 처리.
            function clearPanelInteractionState() {
                $$(".panel").forEach((panel) => {
                    panel.classList.remove("drag-over", "panel-selected", "selected");
                    panel.style.opacity = "";
                });
                $$(".panel-resize-handle.active, .doc-split-handle.active").forEach((handle) => handle.classList.remove("active"));
                document.body.style.userSelect = "";
                document.body.style.cursor = "";
                if (window.getSelection) {
                    const selection = window.getSelection();
                    if (selection && selection.removeAllRanges) selection.removeAllRanges();
                }
                const activeElement = document.activeElement;
                if (activeElement && typeof activeElement.blur === "function") activeElement.blur();
            }

            // resetWorkspaceMetaToDefault: 초기 상태 복원.
            function resetWorkspaceMetaToDefault() {
                workspaceTitle = getDefaultWorkspaceTitle();
                workspaceMemberCount = 0;
                saveWorkspaceMeta();
                renderWorkspaceMeta();
            }

            // initClassificationAccessoryTools: 초기화.
            function initClassificationAccessoryTools() {
                window.AIOneWorkspaceUi.initAccessoryController({
                    readyKey: "classificationAccessoryReady",
                    font: {
                        cookieKey: UI_FONT_COOKIE,
                        cookieMaxAge: UI_COOKIE_MAX_AGE,
                        min: 100,
                        max: 150,
                        step: 10,
                        defaultValue: 100,
                    },
                    container: () => $(".three-panel"),
                    focusFirstHandle: true,
                    onPanelResizeModeChange: (enabled) => {
                        showToast(enabled ? "패널 경계선을 드래그해 크기를 조절하세요." : "패널 크기 조절 모드를 종료했습니다.");
                    },
                    onFullscreenChange: (enabled) => {
                        workspaceCommon.setCookie(UI_FULLSCREEN_COOKIE, enabled ? "1" : "0", { maxAge: UI_COOKIE_MAX_AGE });
                    },
                    onFullscreenError: () => {
                        showToast("브라우저에서 전체화면을 허용하지 않았습니다.");
                    },
                });
            }

            // resetActualWorkspaceView: 초기 상태 복원.
            function resetActualWorkspaceView(clearConversation = false) {
                // 화면을 바꿔도 기존 대화의 서버 분류 polling은 중단하지 않는다.
                // poll 콜백은 conversationId와 선택 세대를 기준으로 현재 화면만 안전하게 갱신한다.
                classificationWorkspaceEpoch += 1;
                uploadedFiles.length = 0;
                questions.length = 0;
                actualFileMap.clear();
                actualQuestionRawMap.clear();
                clearFileDataMap();
                activeFileIndex = -1;
                if (clearConversation) actualConversationId = null;
                renderFileList();
                renderQueryList();
                const activeFileName = $("#activeFileName");
                if (activeFileName) activeFileName.textContent = "선택된 파일 없음";
                const stat = $("#statExtracted");
                if (stat) stat.textContent = "0";
                const original = $("#docOriginal");
                if (original)
                    original.innerHTML = `<div class="report-empty-state">
            <div class="no-file-icon" aria-hidden="true"><img src="../assets/icons/no-file.svg" alt=""></div>
            <strong class="empty-title">원본 문서가 없습니다</strong>
            <span class="empty-desc">질의 파일을 업로드하면 원본 문서가 표시됩니다.</span>
            <span class="empty-desc">업로드한 문서를 선택하면 상세 내용을 확인할 수 있습니다.</span>
            </div>`;
                if (docContent)
                    docContent.innerHTML = `<div class="report-empty-state">
            <div class="no-file-icon" aria-hidden="true"><img src="../assets/icons/no-file.svg" alt=""></div>
            <strong class="empty-title">질의 추출 결과가 없습니다</strong>
            <span class="empty-desc">질의 파일을 업로드하면 추출된 질의가 표시됩니다.</span>
            <span class="empty-desc">분석이 완료되면 질의별 상세 내용을 확인할 수 있습니다.</span>
            </div>`;
                hideIntakeSkeleton();
            }

            // Start: 261026 수정 - 실행 목록 조회 중 공통 스켈레톤
            function showConversationListSkeleton(append = false) {
                window.AIOneDrawerLoading.show($("#runList"), "질의분류 목록", { append });
            }
            function hideConversationListSkeleton() {
                window.AIOneDrawerLoading.hide($("#runList"));
            }
            // End: 261026 수정 - 실행 목록 조회 중 공통 스켈레톤

            Object.assign(runtime, {
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
                syncLeftPanelCollapsedUi,
                setPanelCollapsed,
                initPanelDragDrop,
                initPanelResize,
                clearPanelInteractionState,
                resetWorkspaceMetaToDefault,
                initClassificationAccessoryTools,
                resetActualWorkspaceView,
                showConversationListSkeleton,
                hideConversationListSkeleton,
            });
        }
    };
})(window);
