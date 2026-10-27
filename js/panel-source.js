/**
 * AI-ONE 공통 참조소스·문서 미리보기
 * 적용 화면: ai-answer.html, work-support.html
 * 역할: 소스 검색·업로드·선택, 확장 취소, PDF/canvas 미리보기와 원본 다운로드
 * 연결: panel.js 런타임. 추천 카드·필터는 draft-source.js
 * - 261022 정리 - 공통 패널과 화면 전용 기능의 관리 범위를 분리합니다.
 *
 * 261026 변경 요약
 * - 수정 - 공통 레이아웃 초기화 후 참조소스 확장 이전 폭 캐시와 버튼 상태 동기화
 * - 주석 보완 - 참조소스 확장·복원 시 패널 순서 유지, 공통 폭 재계산 및 리사이즈 핸들 재초기화 처리 기록
 *
 * 기본 구간 형식: Start: 기능명 / End: 기능명
 * 변경 구간 형식: Start: YYMMDD 추가/수정 - 기능명 / End: YYMMDD 추가/수정 - 기능명
 * 주석 정리 내역
 * - 261023 주석 정리 - 구간 표시와 변경 내용 표기를 통일합니다. 기존 작업 날짜와 기능 설명은 유지합니다.
 */

(function registerpanel_sourceModule(window) {
    window.AIOnePanelFeatureModules = window.AIOnePanelFeatureModules || {};
    window.AIOnePanelFeatureModules["panel-source.js"] = function install(runtime) {
        with (runtime) {
            function renderRecommendations() {
                return runtime.page.renderSources?.();
            }

            // Start: 261012 추가 - 참조소스 목록의 요소와 아코디언 상태
            const sourceGroup = el.fileList.closest(".answer-source-group");
            const sourceAccordion = sourceGroup?.querySelector(".source-accordion");
            const sourceSelectAll = sourceGroup?.querySelector("[data-source-select-all]");
            const expandedSourceCategories = new Set();
            const sourceFileTypes = new Set(["pdf", "hwp", "docx", "txt", "xls", "ppt", "img", "file"]);
            let sourceFilesCollapsed = false;
            // End: 261012 추가 - 참조소스 목록의 요소와 아코디언 상태

            // Start: 261014 추가 - 소스 검색·결과 목록·팝업·가져오기
            // 검색 결과는 가져오기 전까지 업로드 파일/선택자료와 별도로 관리한다.
            const sourceSearch = {
                form: document.getElementById("sourceSearchForm"),
                input: document.getElementById("sourceSearchInput"),
                button: document.getElementById("sourceSearchButton"),
                banner: document.getElementById("sourceSearchBanner"),
                status: document.getElementById("sourceSearchStatus"),
                results: document.getElementById("sourceSearchResults"),
                list: document.getElementById("sourceSearchResultList"),
                count: document.getElementById("sourceSearchResultCount"),
                more: document.getElementById("sourceSearchMore"),
                moreLabel: document.getElementById("sourceSearchMoreLabel"),
                toggle: document.getElementById("sourceSearchListToggle"),
                clear: document.getElementById("sourceSearchClear"),
                importButton: document.getElementById("sourceSearchImport"),
                importCount: document.getElementById("sourceSearchImportCount"),
                selection: document.getElementById("sourceSearchSelection"),
                selectAll: document.getElementById("sourceSearchSelectAll"),
                selectedBadge: document.getElementById("sourceSearchSelectedBadge"),
                selectedCount: document.getElementById("sourceSearchSelectedCount"),
                selectionCount: document.getElementById("sourceSearchSelectionCount"),
                totalCount: document.getElementById("sourceSearchTotalCount"),
                allModal: document.getElementById("sourceSearchAllModal"),
                allList: document.getElementById("sourceSearchAllList"),
                allCount: document.getElementById("sourceSearchAllCount"),
                allSelectAll: document.getElementById("sourceSearchAllSelectAll"),
                allImport: document.getElementById("sourceSearchAllImport"),
            };
            const importedSourceReferences = new Map();
            const pendingSourceImports = new Map();
            const selectedSourceSearchKeys = new Set();
            let sourceSearchItems = [];
            let sourceSearchExpanded = false;
            let sourceSearchController = null;
            let sourceSearchSequence = 0;
            let sourceImportController = null;
            let sourceSearchInputEdited = false;

            function initializeSourceSearch() {
                if (!sourceSearch.form || sourceSearchInputEdited) return;
                // 최초 대화 로딩에서 비워진 검색어를 HTML 초기값으로 복원한다.
                sourceSearch.input.value = window.AIOnePreview?.enabled ? sourceSearch.input.defaultValue : "";
                syncSourceSearchButton();
                if (window.AIOnePreview?.enabled) return searchSources();
            }

            function setSourceSearchLoading(loading) {
                sourceSearch.status.textContent = loading ? "지능형 AI 검색중" : "";
                sourceSearch.banner.classList.toggle("is-loading", loading);
                sourceSearch.banner.hidden = !loading;
            }

            function syncSourceSearchButton() {
                resizeSourceSearchInput();
                sourceSearch.input.disabled = !!sourceImportController;
                sourceSearch.button.disabled = !sourceSearch.input.value.trim() || !!sourceSearchController || !!sourceImportController;
                sourceSearch.form.setAttribute("aria-busy", String(!!sourceSearchController || !!sourceImportController));
            }

            // textarea의 auto 높이는 내용 길이를 따르지 않으므로 실제 내용 높이를 측정한다.
            function resizeSourceSearchInput() {
                const input = sourceSearch.input;
                if (!input) return;
                input.style.height = "34px";
                const height = Math.min(96, Math.max(34, input.scrollHeight));
                input.style.height = `${height}px`;
                input.style.overflowY = input.scrollHeight > height ? "auto" : "hidden";
            }

            function syncSourceSearchSelection() {
                const count = sourceSearchItems.filter((item) => selectedSourceSearchKeys.has(item.key)).length;
                sourceSearch.selectedCount.textContent = String(count);
                sourceSearch.selectionCount.textContent = String(count);
                sourceSearch.importCount.textContent = String(count);
                sourceSearch.importButton.disabled = !count || !!sourceImportController;
                sourceSearch.selectAll.checked = !!count && count === sourceSearchItems.length;
                sourceSearch.selectAll.indeterminate = count > 0 && count < sourceSearchItems.length;
                sourceSearch.allCount.textContent = String(count);
                sourceSearch.allSelectAll.checked = sourceSearch.selectAll.checked;
                sourceSearch.allSelectAll.indeterminate = sourceSearch.selectAll.indeterminate;
                sourceSearch.allImport.disabled = !count || !!sourceImportController;
                sourceSearch.list.querySelectorAll("[data-source-search-check]").forEach((checkbox) => {
                    checkbox.checked = selectedSourceSearchKeys.has(checkbox.dataset.sourceSearchCheck);
                    checkbox.closest("li").classList.toggle("is-selected", sourceSearchExpanded && checkbox.checked);
                });
                sourceSearch.allList.querySelectorAll("[data-source-search-all-check]").forEach((checkbox) => {
                    checkbox.checked = selectedSourceSearchKeys.has(checkbox.dataset.sourceSearchAllCheck);
                });
            }

            function renderSourceSearchResults() {
                const total = sourceSearchItems.length;
                const visible = sourceSearchExpanded ? sourceSearchItems : sourceSearchItems.slice(0, 3);
                sourceSearch.list.replaceChildren(
                    ...visible.map((item) => {
                        const row = document.createElement("li");
                        row.className = "file-item-simple source-search-result";
                        row.innerHTML =
                            '<label class="file-select-check"' +
                            (sourceSearchExpanded ? "" : " hidden") +
                            ">" +
                            '<input type="checkbox" class="checkbox-control checkbox-control-md" data-source-search-check="' +
                            escapeHtml(item.key) +
                            '" aria-label="' +
                            escapeHtml(item.title) +
                            ' 선택">' +
                            '<span class="file-select-check-ui" aria-hidden="true"></span></label>' +
                            '<span class="source-search-result-name">' +
                            escapeHtml(item.title) +
                            "</span>";
                        row.title = item.title;
                        return row;
                    }),
                );
                sourceSearch.count.textContent = String(total);
                sourceSearch.totalCount.textContent = String(total);
                sourceSearch.selectedBadge.hidden = !sourceSearchExpanded;
                sourceSearch.selection.hidden = !sourceSearchExpanded;
                sourceSearch.more.hidden = total <= 3 || sourceSearchExpanded;
                sourceSearch.moreLabel.textContent = `그 외 소스 ${Math.max(0, total - 3)}개`;
                sourceSearch.results.classList.toggle("is-expanded", sourceSearchExpanded);
                sourceSearch.form.hidden = sourceSearchExpanded;
                const uploadZone = document.getElementById("referenceFileButton");
                if (uploadZone) uploadZone.hidden = sourceSearchExpanded;
                sourceSearch.more.setAttribute("aria-expanded", String(sourceSearchExpanded));
                sourceSearch.toggle.disabled = !total;
                syncSourceSearchSelection();
            }

            // Start: 검색결과 전체 팝업 모달 기능 관련
            function openSourceSearchAllModal() {
                if (!sourceSearchItems.length || sourceImportController) return;
                sourceSearch.allList.replaceChildren(
                    ...sourceSearchItems.map((item) => {
                        const row = document.createElement("li");
                        row.className = "file-item-simple source-search-all-item";
                        const extension = String(item.raw?.file_type || "").replace(/^\./, "");
                        const fileType = getUploadedFileType(extension ? "source." + extension : item.title);
                        row.innerHTML =
                            '<label class="checkbox-label source-search-all-row">' +
                            '<input type="checkbox" class="checkbox-control checkbox-control-md" data-source-search-all-check="' +
                            escapeHtml(item.key) +
                            '">' +
                            '<span class="file-select-check-ui" aria-hidden="true"></span>' +
                            '<span class="file-icon file-collapsed-ext-icon file-type-' +
                            fileType.type +
                            '" aria-hidden="true"><span>' +
                            escapeHtml(fileType.label) +
                            "</span></span>" +
                            '<span class="source-search-all-name" title="' +
                            escapeHtml(item.title) +
                            '">' +
                            escapeHtml(item.title) +
                            "</span></label>";
                        return row;
                    }),
                );
                syncSourceSearchSelection();
                window.AIOneModal.open(sourceSearch.allModal, sourceSearch.toggle);
                sourceSearch.allModal.setAttribute("aria-hidden", "false");
                sourceSearch.toggle.setAttribute("aria-expanded", "true");
                sourceSearch.allList.scrollTop = 0;
                sourceSearch.allSelectAll.focus({ preventScroll: true });
            }

            function closeSourceSearchAllModal() {
                if (sourceSearch.allModal && !sourceSearch.allModal.hidden && !sourceSearch.allModal.classList.contains("hidden")) {
                    window.AIOneModal.close(sourceSearch.allModal);
                }
            }
            // End: 검색결과 전체 팝업 모달 기능 관련

/* Start: 261026 수정 - 참조소스 패널 확장·복원 및 리사이징 */
            // 패널 순서를 유지하면서 기존 공통 폭 계산으로 확장/복원한다.
            const sourcePanel = sourceGroup?.closest('.panel[data-panel="folder"]');
            const sourceExpandButton = sourcePanel?.querySelector("[data-source-collapse]");
            let sourcePanelOriginalWidth = null;
            // 공통 초기화 뒤 확장 이전 폭을 폐기하고 버튼 표시만 동기화합니다.
            sourcePanel?.closest(".three-panel")?.addEventListener("workspace:layout-reset", () => {
                sourcePanelOriginalWidth = null;
                syncSourceExpandButton();
            });

            function setSourcePanelExpanded(expanded) {
                const layout = sourcePanel?.closest(".three-panel");
                const ui = window.AIOneWorkspaceUi;
                const common = window.AIOneWorkspaceCommon;
                if (!layout || !ui || !common) return;
                const current = ui.getLayoutState(layout);
                if (expanded && sourcePanelOriginalWidth === null) {
                    sourcePanelOriginalWidth = current.widthsByPanel.folder;
                }
                current.widthsByPanel.folder = expanded ? 700 : (sourcePanelOriginalWidth ?? current.widthsByPanel.folder);
                const panels = common.getPanels(layout);
                const widths = common.fitPanelWidths({
                    ...current,
                    flexibleKey: current.order.includes("center") ? "center" : "chat",
                    getMinimum: (key) => {
                        const panel = panels.find((item) => item.dataset.panel === key);
                        if (panel?.classList.contains("panel-collapsed")) return 44;
                        return key === "folder" && expanded ? 700 : Number(panel?.dataset.panelMin) || 180;
                    },
                    getAvailableWidth: () => common.getAvailablePanelWidth(layout, common.getPanelHandles(layout)),
                });
                window.AIOneSplitHandler?.reset?.(layout);
                ui.applyPanelWidths(layout, widths);
                window.AIOneSplitHandler?.init?.(layout);
                sourcePanel.classList.toggle("is-source-expanded", expanded);
                syncSourceExpandButton();
                if (!expanded) sourcePanelOriginalWidth = null;
            }

            // 참조소스 검색과 업무지원 채팅 검색의 가져오기가 같은 패널 상태를 사용한다.
            function enableSourcePanelExpansion() {
                if (!sourcePanel || !sourceExpandButton) return;
                // 업무지원 미리보기가 숨긴 버튼과 저장한 폭을 먼저 복원한다.
                runtime.page.closeSourcePreview?.();
                if (sourcePanel.classList.contains("panel-collapsed")) {
                    const layout = sourcePanel.closest(".three-panel");
                    const hasCenterPanel = layout?.querySelector('[data-panel="center"]');
                    window.AIOneWorkspaceUi?.setPanelCollapsed(sourcePanel, false, {
                        flexibleKey: hasCenterPanel ? "center" : "chat",
                    });
                }
                sourceExpandButton.classList.add("source-expand");
                setSourcePanelExpanded(false);
                syncSourceExpandButton();
            }

            function syncSourceExpandButton() {
                if (!sourceExpandButton?.classList.contains("source-expand")) return;
                const expanded = sourcePanel.classList.contains("is-source-expanded");
                const label = expanded ? "참조소스 패널 원래 크기로" : "참조소스 패널 확장";
                sourceExpandButton?.setAttribute("aria-expanded", String(expanded));
                sourceExpandButton?.setAttribute("aria-label", label);
                sourceExpandButton?.setAttribute("data-tooltip", label);
                sourceExpandButton?.setAttribute("title", label);
                const icon = sourceExpandButton.querySelector("[data-icon]");
                if (icon) {
                    icon.dataset.icon = "panel-expand";
                    icon.src = "../assets/icons/panel-expand.svg";
                }
            }

            function restoreSourcePanel() {
                if (!sourcePanel || !sourceExpandButton) return;
                runtime.page.closeSourcePreview?.();
                setSourcePanelExpanded(false);
                sourceExpandButton.classList.remove("source-expand");
                sourceExpandButton.setAttribute("aria-label", "참조소스 패널 접기");
                sourceExpandButton.setAttribute("data-tooltip", "참조소스 패널 접기");
                sourceExpandButton.removeAttribute("title");
                sourceExpandButton.setAttribute("aria-expanded", "true");
                const icon = sourceExpandButton.querySelector("[data-icon]");
                if (icon) {
                    icon.dataset.icon = "panel-collapse";
                    icon.src = "../assets/icons/panel-collapse.svg";
                }
                window.AIOneWorkspaceUi?.syncPanelCollapseButton(sourcePanel, sourcePanel.classList.contains("panel-collapsed"));
            }

/* End: 261026 수정 - 참조소스 패널 확장·복원 및 리사이징 */
            function cancelSourceSearchExpansion() {
                sourceSearchExpanded = false;
                restoreSourcePanel();
                renderSourceSearchResults();
                window.AIOneTooltip?.hide();
            }

            sourceExpandButton?.addEventListener("click", (event) => {
                if (!sourceExpandButton.classList.contains("source-expand")) return;
                // 아이콘을 접기 버튼으로 복원한 뒤 같은 클릭이 패널 접기로 이어지지 않게 한다.
                event.preventDefault();
                event.stopImmediatePropagation();
                cancelSourceSearchExpansion();
            });

            function expandSourceSearchResults() {
                if (!sourceSearchItems.length) return;
                enableSourcePanelExpansion();
                sourceSearchExpanded = true;
                setSourcePanelExpanded(true);
                window.AIOneSplitHandler?.reset?.(sourceSearch.results.closest('[data-component="split-handler"]'));
                renderSourceSearchResults();
                alignExpandedSourceSearch();
                sourceSearch.selectAll.focus({ preventScroll: true });
            }

            function alignExpandedSourceSearch() {
                if (!sourceSearchExpanded || sourceSearch.results.hidden) return;
                // 같은 결과 박스를 펼치고 참조소스 패널 안에서만 스크롤 위치를 맞춘다.
                const pane = sourceSearch.results.closest(".answer-source-file-section");
                if (pane) pane.scrollTop = 0;
            }

            function resetSourceSearch(clearImported = true) {
                if (state.pendingFileDeleteSource === "search") closeFileDeleteModal();
                closeSourceSearchAllModal();
                sourceSearchSequence += 1;
                sourceSearchController?.abort();
                sourceSearchController = null;
                sourceSearchItems = [];
                sourceSearch.allList?.replaceChildren();
                selectedSourceSearchKeys.clear();
                sourceSearchExpanded = false;
                restoreSourcePanel();
                if (clearImported) {
                    sourceImportController?.abort();
                    sourceImportController = null;
                    pendingSourceImports.clear();
                    importedSourceReferences.clear();
                }
                if (!sourceSearch.form) return;
                sourceSearch.input.value = "";
                sourceSearch.results.hidden = true;
                setSourceSearchLoading(false);
                renderSourceSearchResults();
                syncSourceSearchButton();
            }

            async function searchSources() {
                const keyword = sourceSearch.input.value.trim();
                if (!keyword || sourceSearchController || sourceImportController) return;
                const sequence = ++sourceSearchSequence;
                const searchEpoch = workspaceEpoch;
                const controller = new AbortController();
                sourceSearchController = controller;
                sourceSearch.results.hidden = true;
                syncSourceSearchButton();
                setSourceSearchLoading(true);
                try {
                    // 운영 검색 계약을 그대로 사용합니다. 미리보기 응답은 dummy-api.js가 제공합니다.
                    const contextPath = typeof window.CTX_PATH === "string" ? window.CTX_PATH.replace(/\/$/, "") : "";
                    const searchPath = contextPath + "/intra/ai/search/ND_documentSearch.do";
                    const params = new URLSearchParams({
                        query: keyword,
                        type: "all",
                        sort: "score",
                        page: "1",
                        size: "100",
                    });
                    const response = await requestJson(searchPath + "?" + params, { signal: controller.signal });
                    if (sequence !== sourceSearchSequence || searchEpoch !== workspaceEpoch) return;
                    const payload = response?.data ?? response;
                    const items = Array.isArray(payload) ? payload : payload?.items || payload?.results;
                    if (response?.status === "error" || response?.success === false || !Array.isArray(items)) {
                        throw new Error(response?.message || response?.notice || "Invalid source search response");
                    }
                    sourceSearchItems = normalizeRecommendations(
                        [],
                        items
                            .filter((item) => item && (item.file_id || item.doc_id || item.document_id))
                            .map((item) => ({
                                ...item,
                                doc_id: String(item.doc_id || item.document_id || item.file_id),
                                document_id: String(item.document_id || item.doc_id || item.file_id),
                                document_name: item.document_name || item.title || item.file_name || item.filename || item.name,
                                title: item.title || item.document_name || item.file_name || item.filename || item.name,
                                snippet: item.snippet || item.content || "",
                                source_kind: "search",
                            })),
                    );
                    selectedSourceSearchKeys.clear();
                    sourceSearchItems.forEach((item) => selectedSourceSearchKeys.add(item.key));
                    sourceSearchExpanded = false;
                    renderSourceSearchResults();
                    sourceSearch.results.hidden = !sourceSearchItems.length;
                    if (!sourceSearchItems.length) showToast("검색 결과가 없습니다. 다른 검색어를 입력해 주세요.");
                } catch (error) {
                    if (error.name === "AbortError" || sequence !== sourceSearchSequence || searchEpoch !== workspaceEpoch) return;
                    console.error("[소스 검색 실패]", error);
                    showToast("소스를 검색하지 못했습니다. 다시 시도해 주세요.");
                } finally {
                    if (sequence === sourceSearchSequence) {
                        sourceSearchController = null;
                        setSourceSearchLoading(false);
                        syncSourceSearchButton();
                    }
                }
            }

            function selectImportedSource(item) {
                const existing = state.recommendationItems.find((candidate) => String(candidate.doc_id) === String(item.doc_id));
                const target = existing || item;
                if (!existing) {
                    state.recommendationItems.push(item);
                    state.references.push(...item.references);
                }
                const docId = String(item.doc_id);
                const sourceImportedAt = importedSourceReferences.get(docId)?.sourceImportedAt || pendingSourceImports.get(docId)?.sourceImportedAt || Date.now();
                importedSourceReferences.set(docId, { ...item, sourceImportedAt });
                addSelectedReferenceKey(target.key);
            }

            async function importSourceSearchResults() {
                const selected = sourceSearchItems.filter((item) => selectedSourceSearchKeys.has(item.key));
                if (!selected.length || sourceImportController) return;
                const searchSnapshot = sourceSearchItems.slice();
                const searchKeyword = sourceSearch.input.value;
                const selectionSnapshot = new Set(selectedSourceSearchKeys);
                const importEpoch = workspaceEpoch;
                const controller = new AbortController();
                sourceImportController = controller;
                const newItems = selected.filter((item) => !importedSourceReferences.has(String(item.doc_id)));
                newItems.forEach((item) => pendingSourceImports.set(String(item.doc_id), { ...item, sourceImportedAt: Date.now() }));
                resetSourceSearch(false);
                sourceFilesCollapsed = false;
                renderUploadedFiles();
                try {
                    if (newItems.length) {
                        // [개발 연동 예정] 선택 문서 가져오기/청킹 완료 응답. 처리 지연은 더미 공급자에만 둔다.
                        const response = await requestJson("ND_sourceImport.do", {
                            method: "POST",
                            headers: { "Content-Type": "application/json;charset=UTF-8" },
                            body: JSON.stringify({ documentIds: newItems.map((item) => item.doc_id) }),
                            signal: controller.signal,
                        });
                        if (sourceImportController !== controller || workspaceEpoch !== importEpoch) return;
                        const payload = response?.data ?? response;
                        if (response?.success === false || !Array.isArray(payload?.items)) throw new Error("Invalid source import response");
                        const imported = normalizeRecommendations([], payload.items);
                        if (newItems.some((item) => !imported.some((entry) => String(entry.doc_id) === String(item.doc_id)))) {
                            throw new Error("Incomplete source import response");
                        }
                        imported.filter((item) => pendingSourceImports.has(String(item.doc_id))).forEach(selectImportedSource);
                    }
                    selected.filter((item) => !pendingSourceImports.has(String(item.doc_id))).forEach(selectImportedSource);
                    renderRecommendations();
                    runtime.page.onSelectionChanged?.();
                } catch (error) {
                    if (error.name === "AbortError" || sourceImportController !== controller || workspaceEpoch !== importEpoch) return;
                    console.error("[소스 가져오기 실패]", error);
                    sourceSearchItems = searchSnapshot;
                    sourceSearch.input.value = searchKeyword;
                    selectedSourceSearchKeys.clear();
                    selectionSnapshot.forEach((key) => selectedSourceSearchKeys.add(key));
                    sourceSearch.results.hidden = false;
                    renderSourceSearchResults();
                    showToast("소스를 가져오지 못했습니다. 다시 시도해 주세요.");
                } finally {
                    if (sourceImportController === controller) {
                        sourceImportController = null;
                        pendingSourceImports.clear();
                        syncSourceSearchButton();
                        syncSourceSearchSelection();
                        renderUploadedFiles();
                        sourceSearch.input.focus({ preventScroll: true });
                    }
                }
            }

            function getImportedSourceSelection(docId) {
                return state.recommendationItems.find((item) => String(item.doc_id) === docId && state.selectedReferenceKeys.has(item.key));
            }

            function renderImportedSourceFiles() {
                // 검색 문서는 파일 전송 배열에 넣지 않고, 기존 업로드 목록의 행/분류 UI를 재사용한다.
                const sources = new Map([...importedSourceReferences, ...pendingSourceImports]);
                sources.forEach((reference, docId) => {
                    const processing = pendingSourceImports.has(docId);
                    const raw = reference.raw || reference.reference || {};
                    const metadata = raw.metadata || {};
                    const fileName = raw.file_name || raw.filename || raw.original_filename || metadata.file_name || metadata.filename || reference.title;
                    const fileType = getUploadedFileType(fileName, raw.file_type || metadata.file_type);
                    const row = document.createElement("li");
                    row.className = "file-item-simple" + (processing ? " is-source-processing" : "");
                    row.dataset.sourceReferenceId = docId;
                    row.setAttribute("aria-busy", String(processing));
                    const status = processing
                        ? '<span class="status-badge type1 purple source-chunking-badge" role="status"><span class="source-chunking-spinner" aria-hidden="true"></span>청킹 중</span>'
                        : '<label class="file-select-check"><input type="checkbox" data-source-reference-check="' +
                          escapeHtml(docId) +
                          '" aria-label="' +
                          escapeHtml(reference.title) +
                          ' 선택"><span class="file-select-check-ui" aria-hidden="true"></span></label>';
                    row.innerHTML = status +
                        '<span class="file-icon file-icon-collapsed ' + escapeHtml(fileType.type) + '" aria-hidden="true">' + escapeHtml(fileType.label) + '</span>' +
                        '<span class="file-name-simple" title="' + escapeHtml(reference.title) + '">' + escapeHtml(reference.title) + "</span>";
                    appendSourceFileDot(row, { name: fileName, dot: fileType.type });
                    el.fileList.appendChild(row);
                });
            }

            function syncImportedSourceSelection() {
                el.fileList.querySelectorAll("[data-source-reference-check]").forEach((checkbox) => {
                    checkbox.checked = !!getImportedSourceSelection(checkbox.dataset.sourceReferenceCheck);
                });
                if (sourceGroup) {
                    syncSourceSelectAll();
                }
            }

            el.fileList.addEventListener("change", (event) => {
                const checkbox = event.target.closest("[data-source-reference-check]");
                if (!checkbox) return;
                const docId = checkbox.dataset.sourceReferenceCheck;
                const item = state.recommendationItems.find((entry) => String(entry.doc_id) === docId);
                if (!item) return;
                if (checkbox.checked) addSelectedReferenceKey(item.key);
                else state.recommendationItems.filter((entry) => String(entry.doc_id) === docId).forEach((entry) => state.selectedReferenceKeys.delete(entry.key));
                renderRecommendations();
                renderSelectedReferences();
                runtime.page.onSelectionChanged?.();
            });
            el.fileList.addEventListener("click", (event) => {
                const remove = event.target.closest("[data-source-reference-remove]");
                if (remove) {
                    event.preventDefault();
                    openFileDeleteModal(remove.dataset.sourceReferenceRemove, "imported");
                    return;
                }
                if (event.target.closest("input, label, button")) return;
                if (runtime.config.sourceRowPreview === true) return;
                event.target.closest("[data-source-reference-id]")?.querySelector("[data-source-reference-check]")?.click();
            });

            if (sourceSearch.form) {
                let previousWidth = 0;
                new ResizeObserver(() => {
                    const width = sourceSearch.input.clientWidth;
                    if (width === previousWidth) return;
                    previousWidth = width;
                    resizeSourceSearchInput();
                }).observe(sourceSearch.input);
                sourceSearch.form.addEventListener("submit", (event) => {
                    event.preventDefault();
                    searchSources();
                });
                sourceSearch.input.addEventListener("input", () => {
                    sourceSearchInputEdited = true;
                    // 입력이 바뀌면 이전 검색 응답이 새 검색어의 결과처럼 표시되지 않게 취소한다.
                    sourceSearchSequence += 1;
                    sourceSearchController?.abort();
                    sourceSearchController = null;
                    sourceSearchItems = [];
                    sourceSearchExpanded = false;
                    selectedSourceSearchKeys.clear();
                    sourceSearch.results.hidden = true;
                    setSourceSearchLoading(false);
                    syncSourceSearchButton();
                });
                sourceSearch.input.addEventListener("keydown", (event) => {
                    // 한글 조합 확정 Enter는 검색을 실행하지 않는다.
                    if (event.key !== "Enter" || event.shiftKey || event.isComposing || event.keyCode === 229) return;
                    event.preventDefault();
                    sourceSearch.form.requestSubmit();
                });
                sourceSearch.more.addEventListener("click", expandSourceSearchResults);
                sourceSearch.toggle.addEventListener("click", openSourceSearchAllModal);
                sourceSearch.allModal.addEventListener("modal:close", () => {
                    sourceSearch.allModal.setAttribute("aria-hidden", "true");
                    sourceSearch.toggle.setAttribute("aria-expanded", "false");
                    // 검색어와 선택 결과를 보존하고 검색창 → 업로드 → 결과 목록으로 돌아간다.
                    cancelSourceSearchExpansion();
                });
                // 팝업에서 돌아오거나 패널 크기가 바뀌어도 펼친 결과의 하단 버튼을 볼 수 있게 한다.
                const sourcePane = sourceSearch.results.closest(".answer-source-file-section");
                if (sourcePane) new ResizeObserver(alignExpandedSourceSearch).observe(sourcePane);
                [sourceSearch.selectAll, sourceSearch.allSelectAll].forEach((checkbox) => {
                    checkbox.addEventListener("change", () => {
                        selectedSourceSearchKeys.clear();
                        if (checkbox.checked) sourceSearchItems.forEach((item) => selectedSourceSearchKeys.add(item.key));
                        syncSourceSearchSelection();
                    });
                });
                [sourceSearch.list, sourceSearch.allList].forEach((list) => {
                    list.addEventListener("change", (event) => {
                        const checkbox = event.target.closest("[data-source-search-check], [data-source-search-all-check]");
                        if (!checkbox) return;
                        const key = checkbox.dataset.sourceSearchCheck || checkbox.dataset.sourceSearchAllCheck;
                        if (checkbox.checked) selectedSourceSearchKeys.add(key);
                        else selectedSourceSearchKeys.delete(key);
                        syncSourceSearchSelection();
                    });
                });
                sourceSearch.list.addEventListener("click", (event) => {
                    if (!sourceSearchExpanded || event.target.closest("input, label")) return;
                    event.target.closest("li")?.querySelector("[data-source-search-check]")?.click();
                });
                sourceSearch.clear.addEventListener("click", () => {
                    openFileDeleteModal(-1, "search");
                });
                sourceSearch.importButton.addEventListener("click", importSourceSearchResults);
                sourceSearch.allImport.addEventListener("click", importSourceSearchResults);
                syncSourceSearchButton();
            }
            // End: 261014 추가 - 소스 검색·결과 목록·팝업·가져오기

            // getFileFromResponse: 필요한 값을 조회.
            function getFileFromResponse(data, fallbackFile) {
                if (!data) return null;
                if (Array.isArray(data)) {
                    for (const item of data) {
                        const found = getFileFromResponse(item, fallbackFile);
                        if (found) return found;
                    }
                    return null;
                }
                if (typeof data !== "object") return null;

                const fileId = data.id || data.file_id || data.fileId;
                if (fileId) {
                    return {
                        ...data,
                        id: data.id || fileId,
                        file_id: data.file_id || fileId,
                        name: data.name || data.filename || data.file_name || data.fileName || data.original_filename || data.originalFilename || fallbackFile?.name || "첨부파일",
                        size: data.size || data.file_size || data.fileSize || fallbackFile?.size || 0,
                        lastModified: data.lastModified || data.last_modified || fallbackFile?.lastModified || 0,
                    };
                }

                for (const value of Object.values(data)) {
                    const found = getFileFromResponse(value, fallbackFile);
                    if (found) return found;
                }
                return null;
            }

            // getUploadedFileChunkCount: 필요한 값을 조회.
            function getUploadedFileChunkCount(file) {
                const candidates = [file?.chunks, file?.chunk_count, file?.chunkCount, file?.chunk_cnt, file?.chunkCnt, file?.metadata?.chunks, file?.metadata?.chunk_count, file?.metadata?.chunkCount];
                for (const value of candidates) {
                    const number = Number(value);
                    if (Number.isFinite(number) && number > 0) return Math.floor(number);
                }
                return 0;
            }

            // getUploadedFileExtension: 필요한 값을 조회.
            function getUploadedFileExtension(name) {
                const match = String(name || "").match(/\.([^.]+)$/);
                return match ? match[1].toUpperCase() : "FILE";
            }

            // getUploadedFileType: 필요한 값을 조회.
            function getUploadedFileType(name, extensionHint = "") {
                const nameExtension = getUploadedFileExtension(name).toLowerCase();
                const extension = nameExtension === "file" ? String(extensionHint || "file").replace(/^\./, "").toLowerCase() : nameExtension;
                if (extension === "pdf") return { type: "pdf", label: "PDF" };
                if (extension === "doc" || extension === "docx") return { type: "docx", label: extension.toUpperCase() };
                if (extension === "hwp" || extension === "hwpx") return { type: "hwp", label: "HWP" };
                if (extension === "xls" || extension === "xlsx") return { type: "xls", label: extension.toUpperCase() };
                if (extension === "ppt" || extension === "pptx") return { type: "ppt", label: extension.toUpperCase() };
                if (["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "avif"].includes(extension)) return { type: "img", label: extension.toUpperCase() };
                if (extension === "txt") return { type: "txt", label: "TXT" };
                return { type: "txt", label: getUploadedFileExtension(name) || "FILE" };
            }

            // getUploadedFileIdentity: 필요한 값을 조회.
            function getUploadedFileIdentity(file) {
                const fileId = String(file?.id || file?.file_id || "").trim();
                if (fileId) return "id:" + fileId;
                return ["file", String(file?.name || file?.filename || ""), String(file?.size || file?.file_size || ""), String(file?.lastModified || file?.last_modified || "")].join(":");
            }

            // isUploadedFileSelected: 조건 충족 여부를 판별.
            function isUploadedFileSelected(file) {
                const identity = getUploadedFileIdentity(file);
                return state.uploadedFiles.some((selected) => getUploadedFileIdentity(selected) === identity);
            }

            // Start: 261012 추가 - 공통 파일 아이콘을 사용한 색상 점 표시
            // 색상과 크기는 common.css의 file-icon 타입과 file-dot을 조합해 사용한다.
            function appendSourceFileDot(item, file) {
                const fileName = file.name || file.filename || file.file_name || "";
                const type = getUploadedFileType(fileName).type;
                const dotType = String(file.dot || file.metadata?.dot || type).toLowerCase();
                const dot = document.createElement("span");
                dot.className = "file-icon file-dot " + (sourceFileTypes.has(dotType) ? dotType : type);
                dot.setAttribute("aria-hidden", "true");
                item.insertBefore(dot, item.querySelector(".file-name-simple"));
            }
            // End: 261012 추가 - 공통 파일 아이콘을 사용한 색상 점 표시

            // Start: 261014 추가 - 참조소스 파일 정보 수집
            // 기존 파일행의 data-* 인덱스로 원본 파일을 찾는다. 정렬과 분류는 같은 행을 재사용한다.
            function getSourceFileRows() {
                return Array.from(el.fileList.querySelectorAll(".file-item-simple"))
                    .map((item, rowIndex) => {
                        const docId = item.dataset.sourceReferenceId;
                        if (docId) {
                            const reference = importedSourceReferences.get(docId) || pendingSourceImports.get(docId);
                            if (!reference) return null;
                            return {
                                item,
                                file: { name: reference.title, source_kind: "search", category: "검색 자료", lastModified: reference.sourceImportedAt },
                                index: rowIndex,
                                selected: !pendingSourceImports.has(docId) && !!getImportedSourceSelection(docId),
                            };
                        }
                        const isHistory = item.hasAttribute("data-file-history-index");
                        const index = Number(isHistory ? item.dataset.fileHistoryIndex : item.dataset.fileIndex);
                        const file = (isHistory ? state.conversationFiles : state.uploadedFiles)[index];
                        return {
                            item,
                            file,
                            index: isHistory ? index : state.conversationFiles.length + index,
                            selected: isUploadedFileSelected(file),
                        };
                    })
                    .filter(Boolean);
            }
            // End: 261014 추가 - 참조소스 파일 정보 수집

            // Start: 261012 추가 - 기존 파일 목록을 재사용한 분류별 아코디언 표시
            function syncSourceSelectAll() {
                if (!sourceSelectAll) return;
                const rows = getSourceFileRows().filter((row) => !row.item.classList.contains("is-source-processing"));
                const count = rows.filter((row) => row.selected).length;
                sourceSelectAll.checked = rows.length > 0 && count === rows.length;
                sourceSelectAll.indeterminate = count > 0 && count < rows.length;
                sourceSelectAll.disabled = !rows.length || state.uploading || isConversationPending(state.conversationId);
            }

            function renderSourceFileGroups() {
                if (!sourceGroup) return;
                const rows = getSourceFileRows();
                const files = rows.map((row) => row.file);
                // 새 작업 또는 자료 삭제 후 목록이 비면 숨기고, 자료가 추가되면 다시 표시한다.
                sourceGroup.hidden = files.length === 0;
                if (!files.length) {
                    sourceFilesCollapsed = false;
                    expandedSourceCategories.clear();
                }
                sourceGroup.classList.toggle("is-collapsed", sourceFilesCollapsed);
                sourceAccordion?.setAttribute("aria-expanded", String(!sourceFilesCollapsed));
                const label = sourceFilesCollapsed ? "참조소스 파일목록 펼치기" : "참조소스 파일목록 접기";
                sourceAccordion?.setAttribute("aria-label", label);
                if (sourceAccordion) {
                    sourceAccordion.title = label;
                    sourceAccordion.setAttribute("data-tooltip", label);
                }
                const searchCount = files.filter((file) => file.source_kind === "search").length;
                sourceGroup.querySelector("[data-source-search-count]").textContent = String(searchCount);
                sourceGroup.querySelector("[data-source-upload-count]").textContent = String(files.length - searchCount);
                // Start: 261014 추가 - 참조소스 선택 개수 반영
                syncSourceSelectAll();
                if (el.fileCount) el.fileCount.textContent = String(files.length);
                // End: 261014 추가 - 참조소스 선택 개수 반영

                if (!sourceFilesCollapsed) {
                    el.fileList.replaceChildren(...rows.map((row) => row.item));
                    return;
                }

                const groups = new Map();
                rows.forEach((row) => {
                    const category = String(row.file.category || row.file.metadata?.category || "업로드 파일");
                    if (!groups.has(category)) groups.set(category, []);
                    groups.get(category).push(row.item);
                });
                const fragment = document.createDocumentFragment();
                for (const [category, items] of groups) {
                    const group = document.createElement("li");
                    group.className = "answer-source-category";
                    const listId = "referenceSourceCategory" + fragment.childElementCount;
                    const expanded = expandedSourceCategories.has(category);
                    const button = document.createElement("button");
                    button.type = "button";
                    button.className = "answer-source-category-toggle";
                    button.dataset.sourceCategoryToggle = category;
                    button.setAttribute("aria-expanded", String(expanded));
                    button.setAttribute("aria-controls", listId);
                    button.innerHTML =
                        '<img class="icon icon-small" src="../assets/icons/chevron-down.svg" alt="" aria-hidden="true">' +
                        '<span class="answer-source-category-title">' +
                        escapeHtml(category) +
                        "</span>" +
                        '<span class="sub-badge blue">' +
                        items.length +
                        "건</span>";
                    const list = document.createElement("ul");
                    list.id = listId;
                    // 분류는 래퍼만 추가한다. 공통 스타일과 이벤트는 .file-list > li 구조를 그대로 사용한다.
                    list.className = "file-list simple answer-source-category-files";
                    list.hidden = !expanded;
                    list.append(...items);
                    group.append(button, list);
                    fragment.appendChild(group);
                }
                el.fileList.replaceChildren(fragment);
            }
            // End: 261012 추가 - 기존 파일 목록을 재사용한 분류별 아코디언 표시

            // 업로드/이력/검색 소스 모두 같은 목록 행과 닫기 버튼을 사용한다.
            function renderSourceRemoveButtons() {
                el.fileList.querySelectorAll(".file-item-simple").forEach((row) => {
                    if (row.querySelector(".file-remove-simple")) return;
                    const button = document.createElement("button");
                    button.type = "button";
                    button.className = "file-remove-simple";
                    const name = row.querySelector(".file-name-simple")?.textContent || "첨부파일";
                    button.setAttribute("aria-label", name + " 삭제");
                    button.setAttribute("data-tooltip", "삭제");
                    if (row.hasAttribute("data-source-reference-id")) {
                        button.dataset.sourceReferenceRemove = row.dataset.sourceReferenceId;
                        button.disabled = row.classList.contains("is-source-processing");
                    } else if (row.hasAttribute("data-file-history-index")) {
                        button.dataset.fileHistoryRemove = row.dataset.fileHistoryIndex;
                    } else if (row.hasAttribute("data-file-index")) {
                        button.dataset.fileRemove = row.dataset.fileIndex;
                    } else return;
                    button.innerHTML = '<img src="../assets/icons/preview-close.svg" alt="" aria-hidden="true">';
                    row.appendChild(button);
                });
            }

            // renderUploadedFiles: 현재 상태를 기준으로 화면을 렌더링.
            function renderUploadedFiles() {
                el.fileList.innerHTML = "";
                el.chatFileChips.innerHTML = "";
                const historicalFiles = Array.isArray(state.conversationFiles) ? state.conversationFiles : [];
                const pendingFiles = Array.isArray(state.uploadedFiles) ? state.uploadedFiles : [];
                const historicalIdentities = new Set(historicalFiles.map(getUploadedFileIdentity));
                // 파일은 항상 위 목록에 유지하고 체크박스로 이번 질문의 첨부 여부를 표시한다.
                const visibleHistoricalFiles = historicalFiles;
                const visibleNewFiles = pendingFiles.filter((file) => !historicalIdentities.has(getUploadedFileIdentity(file)));
                // Start: 261014 추가 - 검색 문서와 업로드 목록 연결
                // 개수 표시를 생략한 HTML에서도 기존 업로드 목록을 렌더링한다.
                if (el.fileCount) el.fileCount.textContent = String(visibleHistoricalFiles.length + visibleNewFiles.length);
                // End: 261014 추가 - 검색 문서와 업로드 목록 연결
                visibleHistoricalFiles.forEach((file) => {
                    const fileName = String(file.name || file.filename || file.file_name || "첨부파일");
                    const fileType = getUploadedFileType(fileName);
                    const historyIndex = historicalFiles.indexOf(file);
                    const selected = isUploadedFileSelected(file);
                    const item = document.createElement("li");
                    item.className = "file-item-simple is-history-file";
                    item.dataset.fileHistory = "true";
                    item.dataset.fileHistoryIndex = String(historicalFiles.indexOf(file));
                    item.setAttribute("aria-checked", String(selected));
                    item.setAttribute("role", "button");
                    item.setAttribute("tabindex", "0");
                    item.setAttribute("aria-label", fileName + " 다시 첨부");
                    item.title = "클릭하면 이번 질문에 다시 첨부합니다.";
                    // 서버에 저장된 파일도 평상시 상태로 유지한다.
                    // 클릭하면 재업로드 없이 이번 질문의 전송 대상으로 다시 선택된다.
                    item.style.cursor = "pointer";
                    item.innerHTML =
                        '<label class="file-select-check" title="이번 질문에 첨부">' +
                        '<input type="checkbox" data-file-history-check="' +
                        historyIndex +
                        '"' +
                        (selected ? " checked" : "") +
                        ' aria-label="' +
                        escapeHtml(fileName) +
                        ' 선택" />' +
                        '<span class="file-select-check-ui" aria-hidden="true"></span>' +
                        "</label>" +
                        '<span class="file-icon file-icon-collapsed ' +
                        escapeHtml(fileType.type) +
                        '" aria-hidden="true">' +
                        escapeHtml(fileType.label) +
                        "</span>" +
                        '<span class="file-name-simple" title="' +
                        escapeHtml(fileName) +
                        '">' +
                        escapeHtml(fileName) +
                        "</span>";
                    // Start: 261012 추가 - 기존 첨부 파일행에 색상 점 연결
                    appendSourceFileDot(item, file);
                    // End: 261012 추가 - 기존 첨부 파일행에 색상 점 연결
                    el.fileList.appendChild(item);
                });
                pendingFiles.forEach((file, index) => {
                    if (historicalIdentities.has(getUploadedFileIdentity(file))) return;
                    const fileName = String(file.name || file.filename || file.file_name || "첨부파일");
                    const fileType = getUploadedFileType(fileName);
                    const chunkCount = getUploadedFileChunkCount(file);
                    const statusText = chunkCount > 0 ? "청킹 완료 " + chunkCount + "청크" : "청킹 완료";
                    const item = document.createElement("li");
                    item.className = "file-item-simple is-file-selected";
                    item.dataset.fileIndex = String(index);
                    item.innerHTML =
                        '<label class="file-select-check" title="이번 질문에 첨부">' +
                        '<input type="checkbox" checked data-file-pending-check="' +
                        index +
                        '" aria-label="' +
                        escapeHtml(fileName) +
                        ' 선택" />' +
                        '<span class="file-select-check-ui" aria-hidden="true"></span>' +
                        "</label>" +
                        '<span class="file-icon file-icon-collapsed ' +
                        escapeHtml(fileType.type) +
                        '" aria-hidden="true">' +
                        escapeHtml(fileType.label) +
                        "</span>" +
                        '<span class="file-name-simple" title="' +
                        escapeHtml(fileName) +
                        '">' +
                        escapeHtml(fileName) +
                        "</span>" +
                        '<span class="status-badge type1 blue" data-file-status="done">' +
                        escapeHtml(statusText) +
                        "</span>";
                    // Start: 261012 추가 - 새 첨부 파일행에 색상 점 연결
                    appendSourceFileDot(item, file);
                    // End: 261012 추가 - 새 첨부 파일행에 색상 점 연결
                    el.fileList.appendChild(item);
                });
                // Start: 261014 추가 - 검색 문서와 업로드 목록 연결
                renderImportedSourceFiles();
                renderSourceRemoveButtons();
                // End: 261014 추가 - 검색 문서와 업로드 목록 연결
                // Start: 261012 추가 - 기존 파일 목록 렌더링에 아코디언 연결
                renderSourceFileGroups();
                // End: 261012 추가 - 기존 파일 목록 렌더링에 아코디언 연결
                // 업로드 파일이 추가/삭제될 때 하단 초안 반영 안내문구도 즉시 갱신한다.
                renderSelectedReferences();
                renderRecommendations();
                // 미리보던 업로드 자료가 삭제되면 해당 자료의 미리보기 상태도 비운다.
                if (state.activeReferenceKey.startsWith("upload:") && !getActiveReferenceItem()) {
                    state.activeReferenceKey = "";
                    renderPreview();
                }
            }

            // uploadFile: 해당 기능의 세부 처리를 담당.
            async function uploadFile(file) {
                if (!file || state.uploading) return;
                const uploadWorkspaceEpoch = workspaceEpoch;
                const uploadConversationId = String(state.conversationId || "");
                state.uploading = true;
                el.fileButton.disabled = true;
                syncSendButton();
                showToast("관련자료 업로드 중입니다.");

                try {
                    const formData = new FormData();
                    formData.append("file", file, file.name);

                    // [API 연동] POST ND_fileUpload.do: 답변서 작업에 첨부할 파일 업로드.
                    const response = await fetch("ND_fileUpload.do", {
                        method: "POST",
                        body: formData,
                        credentials: "same-origin",
                    });
                    const responseText = await response.text();

                    if (!response.ok) {
                        throw new Error("업로드 실패: " + response.status + (responseText ? " " + responseText : ""));
                    }

                    let data = null;
                    try {
                        data = responseText ? JSON.parse(responseText) : null;
                    } catch (parseError) {
                        console.error("[파일 업로드] JSON 응답 파싱 실패", {
                            responseText,
                            parseError,
                        });
                        throw new Error("업로드 응답 형식이 올바르지 않습니다.");
                    }

                    console.log("[파일 업로드 응답]", data);
                    const uploaded = getFileFromResponse(data, file);
                    if (!uploaded) {
                        console.error("[파일 업로드] 파일 ID를 찾지 못한 응답", data);
                        throw new Error("업로드 응답에서 파일 ID를 찾지 못했습니다.");
                    }

                    // 업로드 도중 새 채팅/다른 채팅으로 이동했다면 현재 화면에 이 파일을 붙이지 않는다.
                    if (workspaceEpoch !== uploadWorkspaceEpoch || String(state.conversationId || "") !== uploadConversationId) {
                        console.log("[파일 업로드] 화면 이동으로 현재 대화 반영 생략", {
                            uploadConversationId,
                            currentConversationId: state.conversationId,
                        });
                        return;
                    }

                    const uploadedIdentity = getUploadedFileIdentity(uploaded);
                    if (!state.uploadedFiles.some((item) => getUploadedFileIdentity(item) === uploadedIdentity)) {
                        state.uploadedFiles.push(uploaded);
                    }

                    // 최초 업로드 파일도 즉시 선택된 자료로 취급한다.
                    // 체크 해제 후에도 다시 선택할 수 있도록 파일 목록 원본에도 함께 보관한다.
                    if (!state.conversationFiles.some((item) => getUploadedFileIdentity(item) === uploadedIdentity)) {
                        state.conversationFiles.push(uploaded);
                    }

                    renderUploadedFiles();
                    showToast("관련자료가 업로드되었습니다.");
                } catch (error) {
                    console.error("[파일 업로드 실패]", error);
                    showToast(error.message || "관련자료 업로드에 실패했습니다.");
                } finally {
                    state.uploading = false;
                    el.fileButton.disabled = state.sending;
                    el.fileInput.value = "";
                    syncSendButton();
                }
            }

            // uploadFiles: 해당 기능의 세부 처리를 담당.
            async function uploadFiles(files) {
                const fileList = Array.from(files || []).filter(Boolean);
                for (const file of fileList) {
                    await uploadFile(file);
                }
            }

            // referenceKey: 해당 기능의 세부 처리를 담당.
            function referenceKey(item) {
                return String(item.doc_id || item.document_id || item.id || item.title || item.document_name || "");
            }

            // addSelectedReferenceKey: 해당 기능의 세부 처리를 담당.
            function addSelectedReferenceKey(key) {
                const target = state.recommendationItems.find((item) => item.key === key);
                if (!target) return;
                const docId = String(target.doc_id || "").trim();
                if (docId) {
                    state.recommendationItems.forEach((item) => {
                        if (item.key === key) return;
                        if (String(item.doc_id || "").trim() === docId) {
                            state.selectedReferenceKeys.delete(item.key);
                        }
                    });
                }
                state.selectedReferenceKeys.add(key);
                // DEBUG: 사용자가 화면에서 실제 선택한 값 확인
                console.log("[선택자료 DEBUG 1] 화면에서 선택한 ID", {
                    key: key,
                    doc_id: docId,
                    selectedReferenceKeys: Array.from(state.selectedReferenceKeys),
                    selectedDocIds: selectedDocIdsFromUi(),
                });
            }

            // clonePrototypeElement: 해당 기능의 세부 처리를 담당.
            function clonePrototypeElement(prototypeId) {
                const prototype = document.getElementById(prototypeId);
                if (!prototype) return null;
                if (prototype.tagName === "TEMPLATE") {
                    const source = prototype.content.firstElementChild;
                    if (!source) return null;
                    const clone = source.cloneNode(true);
                    clone.removeAttribute("hidden");
                    clone.removeAttribute("id");
                    return clone;
                }
                const clone = prototype.cloneNode(true);
                clone.id = prototype.dataset.instanceId || "";
                clone.removeAttribute("hidden");
                clone.removeAttribute("data-dom-prototype");
                clone.removeAttribute("data-instance-id");
                return clone;
            }

            // createFallbackRecommendationCard: 새 데이터 또는 UI 요소를 생성.

            // createRecommendationCardFromPublicPrototype: 새 데이터 또는 UI 요소를 생성.

            // createRecommendationTagFromPublicPrototype: 새 데이터 또는 UI 요소를 생성.
            function createRecommendationTagFromPublicPrototype(text) {
                const tag = clonePrototypeElement("recommendationTagPrototype") || clonePrototypeElement("answerRecommendationTagPrototype") || document.createElement("span");
                if (!tag.classList.contains("rec-tag")) tag.classList.add("rec-tag");
                tag.textContent = text;
                return tag;
            }

            // syncRecommendationCardPublic: 관련 상태와 화면을 동기화.

            // bindDynamicRecommendationCard: 관련 이벤트 핸들러를 연결.

            // normalizeRecommendations: 입력/API 데이터를 화면에서 사용할 형태로 정규화.
            function normalizeRecommendations(actionSources, references) {
                const normalized = [];
                (Array.isArray(actionSources) ? actionSources : []).forEach((source, index) => {
                    const rawScore = source.score != null ? Number(source.score) : Number(source.similarity || 0) * 100;
                    const score = Math.round((Number.isFinite(rawScore) ? rawScore : 0) * 10) / 10;
                    const year = String(source.question_date || source.answer_date || "").slice(0, 4);
                    normalized.push({
                        key: "history:" + (referenceKey(source) || index),
                        category: "history",
                        title: source.title || source.document_name || "문서명 없음",
                        score: score,
                        meta: ["과거답변서", /^\d{4}$/.test(year) ? year + "년" : "", source.answerer_org || source.member_name || ""].filter(Boolean).join(" · "),
                        desc:
                            source.summary ||
                            source.description ||
                            source.snippet ||
                            [source.member_name && "질의자 " + source.member_name, source.answerer && "답변자 " + source.answerer].filter(Boolean).join(" · ") ||
                            "현재 질의와 관련된 과거 답변 자료입니다.",
                        tags: ["과거답변서", source.answerer_org || source.answerer || ""].filter(Boolean),
                        member_name: source.member_name || "",
                        party: source.party || "",
                        question_date: source.question_date || "",
                        answer_date: source.answer_date || "",
                        answerer: source.answerer || "",
                        answerer_org: source.answerer_org || "",
                        doc_id: source.doc_id || source.document_id || "",
                        file_id: source.file_id || source.fileId || "",
                        snippet: source.snippet || source.summary || source.description || "",
                        raw: source,
                    });
                });
                const grouped = new Map();
                (Array.isArray(references) ? references : []).forEach((ref, index) => {
                    const docId = String(ref.document_id || ref.doc_id || ref.document_name || ref.title || "ref-" + index);
                    if (!grouped.has(docId)) {
                        grouped.set(docId, {
                            first: ref,
                            chunks: [],
                            maxSimilarity: 0,
                        });
                    }
                    const group = grouped.get(docId);
                    group.chunks.push(ref);
                    const similarity = Number(ref.similarity || 0);
                    if (similarity > group.maxSimilarity) group.maxSimilarity = similarity;
                });
                Array.from(grouped.entries()).forEach(([docId, group], index) => {
                    const ref = group.first || {};
                    const metaObj = ref.meta || {};
                    const score = Math.round(group.maxSimilarity * 1000) / 10;
                    const year = String(metaObj.question_date || metaObj.answer_date || "").slice(0, 4);
                    const mergedContent = group.chunks
                        .map((item) => String(item.content || "").trim())
                        .filter(Boolean)
                        .join("\n")
                        .replace(/\n{3,}/g, "\n\n");
                    normalized.push({
                        key: "evidence:" + docId,
                        category: "evidence",
                        title: ref.document_name || ref.title || "참조소스",
                        score: score,
                        meta: ["참조소스", /^\d{4}$/.test(year) ? year + "년" : "", metaObj.answerer_org || metaObj.member_name || ""].filter(Boolean).join(" · "),
                        desc: mergedContent.replace(/\s+/g, " ").trim() || "답변서 작성에 활용할 수 있는 참조 근거입니다.",
                        tags: ["참조소스", metaObj.answerer || ""].filter(Boolean),
                        snippet: mergedContent,
                        doc_id: ref.document_id || ref.doc_id || docId,
                        file_id: ref.file_id || ref.fileId || "",
                        member_name: metaObj.member_name || "",
                        party: metaObj.party || "",
                        question_date: metaObj.question_date || "",
                        answer_date: metaObj.answer_date || "",
                        answerer: metaObj.answerer || "",
                        answerer_org: metaObj.answerer_org || "",
                        reference: ref,
                        references: group.chunks,
                        raw: ref,
                    });
                });
                return normalized;
            }

            // setRecommendations: 상태 또는 표시 값을 설정.
            function setRecommendations(actionSources, references) {
                // Start: 261014 추가 - 가져온 검색 문서와 추천 목록 동기화
                const selectedImportedDocIds = new Set(state.recommendationItems.filter((item) => state.selectedReferenceKeys.has(item.key) && importedSourceReferences.has(String(item.doc_id))).map((item) => String(item.doc_id)));
                // End: 261014 추가 - 가져온 검색 문서와 추천 목록 동기화
                state.references = Array.isArray(references) ? references.slice() : [];
                state.recommendationItems = normalizeRecommendations(actionSources, state.references);
                // Start: 261014 추가 - 가져온 검색 문서와 추천 목록 동기화
                // 같은 대화에서 가져온 검색 자료는 이후 추천 응답에도 유지한다.
                importedSourceReferences.forEach((item, docId) => {
                    if (state.recommendationItems.some((candidate) => String(candidate.doc_id) === docId)) return;
                    state.recommendationItems.push(item);
                    state.references.push(...item.references);
                });
                // End: 261014 추가 - 가져온 검색 문서와 추천 목록 동기화
                const existingKeys = new Set(state.recommendationItems.map((item) => item.key));
                state.selectedReferenceKeys = new Set(Array.from(state.selectedReferenceKeys).filter((key) => existingKeys.has(key)));
                // Start: 261014 추가 - 가져온 검색 문서와 추천 목록 동기화
                state.recommendationItems.forEach((item) => {
                    if (selectedImportedDocIds.has(String(item.doc_id))) addSelectedReferenceKey(item.key);
                });
                // End: 261014 추가 - 가져온 검색 문서와 추천 목록 동기화
                if (!existingKeys.has(state.activeReferenceKey)) {
                    state.activeReferenceKey = state.recommendationItems[0]?.key || "";
                }
                renderRecommendations();
                renderSelectedReferences();
                renderPreview();
                runtime.page.onSourceListChanged?.();
            }

            // 공통 자료 목록: 업로드 식별자와 검색으로 가져온 자료를 구분한다.
            // 자료 값은 API 응답을 사용한다. 미리보기 예시는 dummy/dummy-data.js에서 관리한다.
            // history: 유사답변서, search: 검색자료, upload: 업로드자료. HTML의 data-reference-filter 값과 연결된다.

            // 대화의 기존 파일과 이번 질문의 첨부 파일을 식별자로 합치고, source_kind가 search인 파일은 제외한다.
            // 업로드 카드의 반영 선택은 state.uploadedFiles로 관리하며 추천 문서의 selectedReferenceKeys와 구분한다.
            function getUploadedRecommendationItems() {
                const files = new Map();
                [...state.conversationFiles, ...state.uploadedFiles].forEach((file) => {
                    if (file.source_kind !== "search") files.set(getUploadedFileIdentity(file), file);
                });
                return Array.from(files, ([identity, file]) => ({
                    key: "upload:" + identity,
                    category: "upload",
                    title: file.name || file.filename || file.file_name || "첨부파일",
                    doc_id: file.document_id || file.doc_id || "",
                    file_id: file.file_id || file.id || "",
                    raw: file,
                }));
            }

            // 미리보기 키를 추천 문서에서 먼저 찾고, 없으면 대화 이력과 이번 첨부를 합친 업로드 목록에서 찾는다.
            function getActiveReferenceItem() {
                return state.recommendationItems.find((item) => item.key === state.activeReferenceKey) || getUploadedRecommendationItems().find((item) => item.key === state.activeReferenceKey);
            }

            function getSearchRecommendationItems() {
                const historyIds = new Set(state.recommendationItems.filter((item) => item.category === "history").map((item) => String(item.doc_id)));
                // 유사답변서와 doc_id가 겹치지 않는 evidence 및 검색으로 가져온 근거를 표시한다.
                // 같은 doc_id의 유사답변서가 있어도 source_kind가 search이거나 가져오기 이력이 있으면 함께 표시한다.
                return state.recommendationItems.filter((item) => item.category === "evidence" && (!historyIds.has(String(item.doc_id)) || item.raw?.source_kind === "search" || importedSourceReferences.has(String(item.doc_id))));
            }

            // buildPublicDocMetaBox: 표시할 데이터 또는 마크업을 구성.
            function buildPublicDocMetaBox(items) {
                if (!items || !items.length) return "";
                return (
                    '<div class="web-doc-meta-box">' +
                    items.map((item) => '<div class="web-doc-meta-item">' + '<span class="web-doc-meta-label">' + escapeHtml(item.label) + "</span>" + "<span>" + escapeHtml(item.value) + "</span>" + "</div>").join("") +
                    "</div>"
                );
            }

            // buildPublicDocSection: 표시할 데이터 또는 마크업을 구성.
            function buildPublicDocSection(section, contextTitle) {
                const sectionTitle = section.title || "주요 내용";
                const desc = section.desc || contextTitle + "와 관련하여 " + sectionTitle + "에 대한 검토 내용을 정리한 문단입니다.";
                const note = section.note || sectionTitle + " 관련 내용은 선택된 소스의 근거로 활용됩니다.";
                return (
                    '<div class="web-doc-section">' +
                    '<h4 class="web-doc-section-title">' +
                    escapeHtml(sectionTitle) +
                    "</h4>" +
                    '<p class="web-doc-section-desc">' +
                    escapeHtml(desc) +
                    "</p>" +
                    '<ul class="web-doc-list">' +
                    (section.items || []).map((item) => "<li>" + escapeHtml(item) + "</li>").join("") +
                    "</ul>" +
                    '<div class="web-doc-note">' +
                    escapeHtml(note) +
                    "</div>" +
                    "</div>"
                );
            }

            // buildPublicDocPage: 표시할 데이터 또는 마크업을 구성.
            function buildPublicDocPage(options) {
                const pageIdx = Number(options.pageIdx) || 0;
                const totalPages = Number(options.totalPages) || 1;
                const title = options.title || "";
                const header =
                    pageIdx === 0
                        ? '<span class="web-doc-org">' + escapeHtml(options.org || "") + "</span>" + '<h3 class="web-doc-title">' + escapeHtml(title) + "</h3>"
                        : '<span class="web-doc-org">' + escapeHtml(options.continueTitle || title + " · (계속)") + "</span>";
                return (
                    '<div class="web-doc-page">' +
                    '<div class="web-doc-header' +
                    (pageIdx > 0 ? " web-doc-header-sub" : "") +
                    '">' +
                    header +
                    "</div>" +
                    '<div class="web-doc-body">' +
                    (pageIdx === 0 ? buildPublicDocMetaBox(options.metaItems || []) : "") +
                    (options.lead ? '<p class="web-doc-lead">' + escapeHtml(options.lead) + "</p>" : "") +
                    (options.sections || []).map((section) => buildPublicDocSection(section, title)).join("") +
                    "</div>" +
                    '<div class="web-doc-page-footer">' +
                    "<span>- " +
                    (pageIdx + 1) +
                    " / " +
                    totalPages +
                    " -</span>" +
                    "</div>" +
                    "</div>"
                );
            }

            // Start: 261015 수정 - 관련자료 목록·건수·전체선택 상태 갱신
            // 유사답변서는 기존 추천 카드, 검색·업로드 자료는 공통 소스 카드 템플릿으로 표시한다.
            // 상단·하단 전체 건수는 세 필터의 합계이며, 각 필터 건수와 현재 목록의 전체선택 상태를 함께 갱신한다.
            // 전체 자료가 없으면 패널 빈 화면, 현재 필터만 비었으면 목록 빈 화면을 표시한다.

            // End: 261015 수정 - 관련자료 목록·건수·전체선택 상태 갱신

            // renderSelectedReferences: 선택 문서는 doc_id 중복을 제거하고, 이번 질문의 업로드 파일을 함께 표시한다.
            function renderSelectedReferences() {
                const selected = [];
                const seenDocIds = new Set();
                state.recommendationItems.forEach((item) => {
                    if (!state.selectedReferenceKeys.has(item.key)) return;
                    const docId = String(item.doc_id || "").trim();
                    if (docId && seenDocIds.has(docId)) return;
                    if (docId) seenDocIds.add(docId);
                    selected.push(item);
                });
                const uploadedFileCount = Array.isArray(state.uploadedFiles) ? state.uploadedFiles.length : 0;
                const selectedUploadedFiles = Array.isArray(state.uploadedFiles) ? state.uploadedFiles : [];
                const selectedCount = selected.length + selectedUploadedFiles.length;
                el.selectedReferenceList.innerHTML = "";
                el.selectedReferenceCount.textContent = String(selectedCount);
                el.selectedReferenceEmpty.hidden = selected.length > 0 || uploadedFileCount > 0;
                const hasSelection = selected.length > 0;
                const hasUploadedFiles = uploadedFileCount > 0;
                const hasApplyTarget = hasSelection || hasUploadedFiles;
                el.selectedReferenceFooter.hidden = false;
                // 반영 버튼은 항상 활성화하며, 자료 미선택 안내는 클릭 이벤트에서 처리한다.
                el.selectedReferenceFooter.classList.toggle("has-selection", hasApplyTarget);
                if (el.applyReferencesMessage) {
                    el.applyReferencesMessage.textContent = el.applyReferencesMessage.dataset.referenceMessage || `선택한 관련자료 ${selectedCount}건을 답변서에 반영할 수 있습니다.`;
                }
                // Start: 261014 추가 - 가져온 검색 문서의 선택자료 표시
                // 기존 추천 자료는 점수를 유지하고, 직접 가져온 검색 자료만 검색 태그를 표시한다.
                selected.forEach((item) => {
                    const row = document.createElement("li");
                    row.innerHTML =
                        '<span class="ref-name" title="' +
                        escapeHtml(item.title) +
                        '">' +
                        escapeHtml(item.title) +
                        "</span>" +
                        '<button type="button" class="ref-remove" data-selected-remove="' +
                        escapeHtml(item.key) +
                        '" aria-label="선택 해제">×</button>';
                    if (importedSourceReferences.has(String(item.doc_id))) {
                        const tag = createRecommendationTagFromPublicPrototype("검색");
                        tag.classList.add("search");
                        row.prepend(tag);
                    } else {
                        const score = document.createElement("span");
                        score.className = "ref-score";
                        score.textContent = Math.round(item.score * 10) / 10 + "%";
                        row.prepend(score);
                    }
                    el.selectedReferenceList.appendChild(row);
                });
                selectedUploadedFiles.forEach((file) => {
                    const pendingIndex = state.uploadedFiles.findIndex((uploadedFile) => getUploadedFileIdentity(uploadedFile) === getUploadedFileIdentity(file));
                    if (pendingIndex < 0) return;
                    const fileName = String(file.name || file.filename || file.file_name || "첨부파일");
                    const row = document.createElement("li");
                    row.className = "selected-ref-upload-file";
                    row.title = "× 버튼을 누르면 이번 질문의 첨부 선택이 해제됩니다.";
                    row.innerHTML =
                        '<span class="ref-name" title="' +
                        escapeHtml(fileName) +
                        '">' +
                        escapeHtml(fileName) +
                        "</span>" +
                        '<button type="button" class="ref-remove" data-selected-file-unselect="' +
                        pendingIndex +
                        '" aria-label="' +
                        escapeHtml(fileName) +
                        ' 선택 해제" title="선택 해제">×</button>';
                    const isSearch = file.source_kind === "search";
                    const tag = createRecommendationTagFromPublicPrototype(isSearch ? "검색" : "업로드");
                    tag.classList.add(isSearch ? "search" : "upload");
                    row.prepend(tag);
                    el.selectedReferenceList.appendChild(row);
                });
                syncImportedSourceSelection();
                scheduleSelectedReferencesLayout();
                // End: 261014 추가 - 가져온 검색 문서의 선택자료 표시
            }

            // getCurrentVisiblePage: 필요한 값을 조회.
            function getCurrentVisiblePage(pages, scrollElement) {
                if (!pages.length) return 0;
                const scrollTop = scrollElement?.scrollTop || 0;
                const viewportMid = scrollTop + (scrollElement?.clientHeight || 0) / 2;
                let current = 1;
                pages.forEach((page, index) => {
                    const top = page.offsetTop;
                    const bottom = top + page.offsetHeight;
                    if (viewportMid >= top && viewportMid <= bottom) {
                        current = index + 1;
                    }
                });
                return current;
            }

            // updateRecommendDocumentStats: 기존 상태 또는 데이터를 갱신.
            async function updateRecommendDocumentStats() {
                if (!el.sourcePreview) return;
                const pages = Array.from(el.sourcePreview.querySelectorAll(".answer-pdf-page"));
                if (el.recommendCharCount) {
                    let charCount = 0;
                    try {
                        for (let pageNumber = 1; pageNumber <= (state.recommendPdf?.numPages || 0); pageNumber += 1) {
                            const page = await state.recommendPdf.getPage(pageNumber);
                            const textContent = await page.getTextContent();
                            const pageText = textContent.items.map((item) => String(item?.str || "")).join("");
                            charCount += pageText.replace(/\s/g, "").length;
                        }
                        el.recommendCharCount.textContent = charCount.toLocaleString();
                    } catch (error) {
                        console.warn("[관련자료 PDF 글자수 계산 실패]", error);
                        el.recommendCharCount.textContent = "-";
                    }
                }
                if (el.recommendPageTotal) el.recommendPageTotal.textContent = String(state.recommendPdf?.numPages || pages.length || 0);
                if (el.recommendPageCurrent) {
                    const scroller = el.sourcePreview.closest(".doc-viewer-body");
                    el.recommendPageCurrent.textContent = String(pages.length ? getCurrentVisiblePage(pages, scroller) : 0);
                }
            }

            // 페이지 여백·테두리를 제외한 뷰어 폭에 PDF를 맞추고 사용자 확대율을 적용한다.
            // 페이지 렌더링 중 다른 자료가 선택되면 recommendPdfRenderSeq로 이전 작업을 중단한다.
            async function renderRecommendPdfPages(pdf) {
                if (!pdf || !el.sourcePreview) return;
                const renderSeq = ++state.recommendPdfRenderSeq;
                const zoom = Math.max(50, Math.min(200, Number(state.recommendZoom) || 100)) / 100;
                el.sourcePreview.classList.add("answer-pdfjs-preview");
                el.sourcePreview.style.removeProperty("transform");
                el.sourcePreview.style.removeProperty("transform-origin");
                el.sourcePreview.innerHTML = '<div class="answer-pdf-pages"></div>';
                const pagesWrap = el.sourcePreview.querySelector(".answer-pdf-pages");
                const pixels = (value) => Number.parseFloat(value) || 0;
                const wrapperStyle = getComputedStyle(pagesWrap);
                const horizontalGutter = pixels(wrapperStyle.paddingLeft) + pixels(wrapperStyle.paddingRight);
                for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
                    if (renderSeq !== state.recommendPdfRenderSeq) return;
                    const page = await pdf.getPage(pageNumber);
                    if (renderSeq !== state.recommendPdfRenderSeq) return;
                    const baseViewport = page.getViewport({ scale: 1 });
                    const scroller = el.sourcePreview.closest(".doc-viewer-body");
                    const pageEl = document.createElement("div");
                    pageEl.className = "answer-pdf-page";
                    pagesWrap.appendChild(pageEl);
                    const pageStyle = getComputedStyle(pageEl);
                    const horizontalFrame = pixels(pageStyle.paddingLeft) + pixels(pageStyle.paddingRight) + pixels(pageStyle.borderLeftWidth) + pixels(pageStyle.borderRightWidth);
                    const verticalFrame = pixels(pageStyle.paddingTop) + pixels(pageStyle.paddingBottom) + pixels(pageStyle.borderTopWidth) + pixels(pageStyle.borderBottomWidth);
                    const availableWidth = Math.max(1, (scroller?.clientWidth || el.sourcePreview.clientWidth || 800) - horizontalGutter - horizontalFrame);
                    const fitScale = Math.min(1.5, availableWidth / baseViewport.width);
                    const viewport = page.getViewport({ scale: fitScale * zoom });
                    const outputScale = Math.min(window.devicePixelRatio || 1, 2);
                    pageEl.style.width = Math.ceil(viewport.width) + horizontalFrame + "px";
                    pageEl.style.height = Math.ceil(viewport.height) + verticalFrame + "px";
                    const canvas = document.createElement("canvas");
                    canvas.width = Math.floor(viewport.width * outputScale);
                    canvas.height = Math.floor(viewport.height * outputScale);
                    canvas.style.width = Math.ceil(viewport.width) + "px";
                    canvas.style.height = Math.ceil(viewport.height) + "px";
                    pageEl.appendChild(canvas);
                    const context = canvas.getContext("2d", { alpha: false });
                    await page.render({
                        canvasContext: context,
                        viewport,
                        transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null,
                    }).promise;
                }
                if (renderSeq !== state.recommendPdfRenderSeq) return;
                updateRecommendDocumentStats();
            }

            // downloadOriginalFile: 보고서/파일 다운로드를 처리.
            async function downloadOriginalFile(fileId) {
                const normalizedFileId = String(fileId || "").trim();
                if (!normalizedFileId) {
                    showToast("원본 파일 식별자가 없습니다.");
                    return;
                }
                try {
                    // [API 연동] GET ND_fileDownload.do: 첨부/참고 파일의 원본 다운로드.
                    const response = await fetch("ND_fileDownload.do?fileId=" + encodeURIComponent(normalizedFileId), { method: "GET", credentials: "same-origin" });
                    if (!response.ok) throw new Error("파일 다운로드 실패: " + response.status);
                    const blob = await response.blob();
                    if (!blob.size) throw new Error("빈 파일입니다.");
                    const disposition = response.headers.get("Content-Disposition") || "";
                    const utf8 = disposition.match(/filename\*=UTF-8''([^;]+)/i);
                    const normal = disposition.match(/filename="?([^";]+)"?/i);
                    let fileName = "관련자료_원본";
                    if (utf8?.[1]) {
                        try {
                            fileName = decodeURIComponent(utf8[1]);
                        } catch (_) {
                            fileName = utf8[1];
                        }
                    } else if (normal?.[1]) {
                        fileName = normal[1];
                    }
                    const objectUrl = URL.createObjectURL(blob);
                    const downloadLink = document.createElement("a");
                    downloadLink.href = objectUrl;
                    downloadLink.download = fileName;
                    downloadLink.style.display = "none";
                    document.body.appendChild(downloadLink);
                    downloadLink.click();
                    downloadLink.remove();
                    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
                } catch (error) {
                    console.error("[관련자료 원본 다운로드 실패]", normalizedFileId, error);
                    showToast("원본 파일 다운로드에 실패했습니다.");
                }
            }

            // ensurePreviewHwpDownloadControl: 필요한 요소나 상태가 존재하도록 보장.
            function ensurePreviewHwpDownloadControl() {
                if (!el.previewScore) return null;
                let wrap = document.getElementById("recommendPreviewDownloadWrap");
                if (!wrap) {
                    const template = document.getElementById("recommendPreviewDownloadTemplate");
                    wrap = template?.content.firstElementChild?.cloneNode(true);
                    if (!wrap) return null;
                    const header = el.previewScore.parentElement;
                    const actionGroup = document.createElement("div");
                    actionGroup.id = "recommendPreviewHeaderActions";
                    actionGroup.className = "recommend-preview-header-actions";
                    header?.insertBefore(actionGroup, el.previewScore);
                    actionGroup.appendChild(el.previewScore);
                    actionGroup.appendChild(wrap);
                }

                // JSP에 다운로드 버튼이 이미 존재하더라도 이벤트는 반드시 등록한다.
                // 기존 코드는 wrap이 있으면 여기서 바로 return하여 버튼이 무반응이었다.
                if (wrap.dataset.originalDownloadBound === "true") return wrap;
                wrap.dataset.originalDownloadBound = "true";

                const trigger = wrap.querySelector("#recommendPreviewDownloadBtn");
                const menu = wrap.querySelector("#recommendPreviewDownloadMenu");
                trigger?.addEventListener("click", (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (trigger.disabled || !menu) return;
                    const shouldOpen = menu.classList.contains("hidden");
                    menu.classList.toggle("hidden", !shouldOpen);
                    trigger.setAttribute("aria-expanded", String(shouldOpen));
                });
                menu?.addEventListener("click", (event) => {
                    const button = event.target.closest("[data-preview-hwp-download]");
                    if (!button) return;
                    event.preventDefault();
                    event.stopPropagation();
                    menu.classList.add("hidden");
                    trigger?.setAttribute("aria-expanded", "false");
                    const item = getActiveReferenceItem();
                    // 추천·검색자료는 doc_id, 사용자가 업로드한 자료는 file_id.
                    const fileId =
                        item?.category === "upload"
                            ? String(item?.file_id || item?.raw?.file_id || item?.raw?.fileId || item?.raw?.id || "").trim()
                            : String(item?.doc_id || item?.raw?.doc_id || item?.raw?.document_id || item?.file_id || "").trim();
                    if (!fileId) {
                        showToast("원본 파일 식별자가 없습니다.");
                        console.warn("[관련자료 다운로드] ID 누락", item);
                        return;
                    }
                    downloadOriginalFile(fileId);
                });
                document.addEventListener("click", (event) => {
                    if (wrap.contains(event.target)) return;
                    menu?.classList.add("hidden");
                    trigger?.setAttribute("aria-expanded", "false");
                });
                return wrap;
            }

            // 문서 ID/PDF.js 부재, PDF 응답 204·404 또는 빈 본문이면 기존 HTML의 빈 canvas를 사용한다.
            // 템플릿이 없으면 false를 반환하여 호출부의 오류 안내로 이어진다.
            function renderEmptyDocumentPreview() {
                const template = document.getElementById("answerDocumentPreviewTemplate");
                if (!(template instanceof HTMLTemplateElement)) return false;
                el.sourcePreview.classList.add("answer-pdfjs-preview");
                el.sourcePreview.replaceChildren(template.content.cloneNode(true));
                window.AIOneDocumentStatusBar?.init();
                requestAnimationFrame(updateRecommendDocumentStats);
                return true;
            }

            // renderPreview: 추천 문서와 업로드 파일에서 현재 미리보기 대상을 찾고 배지·PDF를 갱신한다.
            // 유사답변서는 유사도, 검색·업로드 자료는 출처 배지를 표시한다. 카드 활성화는 반영 선택과 별개다.
            // 문서 ID/PDF.js가 없거나 204·404·빈 응답이면 HTML의 빈 canvas 템플릿을 표시한다.
            async function renderPreview() {
                // 261020: 관련자료 미리보기가 없는 페이지에서도 대화와 참조소스 갱신을 유지한다.
                if (!el.sourcePreview) return;
                const item = getActiveReferenceItem();
                const previewDownloadWrap = ensurePreviewHwpDownloadControl();
                // Start: 261015 수정 - 미리보기 자료 유무에 따른 배지·파일명 표시
                const previewHeaderActions = document.getElementById("recommendPreviewHeaderActions");
                const previewFileName = previewHeaderActions?.querySelector(".file-name");
                el.previewScore.hidden = false;
                if (previewHeaderActions) previewHeaderActions.hidden = false;
                if (previewFileName) {
                    previewFileName.classList.toggle("hidden", !item);
                    previewFileName.textContent = item?.title || "선택된 문서 없음";
                    previewFileName.title = item?.title || "";
                }
                // End: 261015 수정 - 미리보기 자료 유무에 따른 배지·파일명 표시
                state.recommendPdfRenderSeq += 1;
                state.recommendPdf = null;
                if (!item) {
                    el.previewScore.textContent = "미리보기 대기";
                    previewDownloadWrap?.classList.add("hidden");
                    el.sourcePreview.classList.remove("answer-pdfjs-preview");
                    el.sourcePreview.innerHTML =
                        '<div class="answer-recommend-empty preview-empty answer-recommend-empty-offset"><div class="no-file-icon" aria-hidden="true"><img src="' +
                        '../assets/icons/no-file.svg" alt="" /></div><strong>미리 볼 관련자료가 없습니다</strong><span>AI 채팅에 국회 질의를 입력하면 추천 자료의 원문과 주요 내용을 여기에서 확인할 수 있습니다.</span></div>';
                    requestAnimationFrame(updateRecommendDocumentStats);
                    return;
                }
                const score = Math.round(Number(item.score || 0) * 10) / 10;
                if (runtime.config.sourceRowPreview === true) {
                    el.previewScore.textContent = item.category === "upload" ? "업로드자료" : "검색자료";
                    el.previewScore.classList.add("blue");
                } else {
                    el.previewScore.textContent = item.category === "history" ? "유사도 " + score + "%" : item.category === "upload" ? "업로드자료" : "검색소스";
                }
                previewDownloadWrap?.classList.remove("hidden");
                const isUploadPreview = item.category === "upload";
                const documentId = String(item.doc_id || item.raw?.document_id || item.raw?.doc_id || "").trim();
                const uploadFileId = String(item.file_id || item.raw?.file_id || item.raw?.fileId || item.raw?.id || "").trim();
                const previewId = isUploadPreview ? uploadFileId : documentId;
                if (!previewId) {
                    if (window.AIOnePreview?.enabled && renderEmptyDocumentPreview()) return;
                    el.sourcePreview.innerHTML =
                        '<div class="answer-pdf-error"><strong>원문을 불러올 수 없습니다.</strong><span>' + (isUploadPreview ? "업로드 파일 ID가 없습니다." : "선택한 관련자료의 document_id가 없습니다.") + "</span></div>";
                    updateRecommendDocumentStats();
                    return;
                }
                // 원본 다운로드 API는 PDF 이외의 형식도 반환하므로 PDF.js 지원 여부를 먼저 확인한다.
                if (isUploadPreview && !/\.pdf$/i.test(String(item.title || "").trim())) {
                    if (runtime.config.sourceRowPreview === true && window.AIOnePreview?.enabled && renderEmptyDocumentPreview()) return;
                    el.sourcePreview.innerHTML = '<div class="answer-pdf-error"><strong>이 파일 형식은 미리보기를 지원하지 않습니다.</strong><span>PDF 파일만 미리볼 수 있습니다. 원본 다운로드를 이용해 주세요.</span></div>';
                    updateRecommendDocumentStats();
                    return;
                }
                if (!window.pdfjsLib?.getDocument) {
                    if (renderEmptyDocumentPreview()) return;
                    el.sourcePreview.innerHTML = '<div class="answer-pdf-error"><strong>PDF.js가 로드되지 않았습니다.</strong><span>pdf.min.js를 JSP에서 먼저 로드해 주세요.</span></div>';
                    updateRecommendDocumentStats();
                    return;
                }
                const requestSeq = state.recommendPdfRenderSeq;
                el.sourcePreview.classList.add("answer-pdfjs-preview");
                el.sourcePreview.innerHTML = '<div class="answer-pdf-loading"><strong>원문을 불러오는 중입니다.</strong></div>';
                try {
                    // 업로드 PDF는 파일 원본 API, 추천·검색 문서는 참고자료 PDF API로 분기한다.
                    const previewUrl = isUploadPreview ? "ND_fileDownload.do?fileId=" + encodeURIComponent(uploadFileId) : "ND_reportSourcePreview.do?documentId=" + encodeURIComponent(documentId);
                    const response = await fetch(previewUrl, { credentials: "same-origin" });
                    if (requestSeq !== state.recommendPdfRenderSeq) return;
                    if ((response.status === 204 || response.status === 404) && renderEmptyDocumentPreview()) return;
                    if (!response.ok) throw new Error(response.status + " " + response.statusText);
                    const bytes = new Uint8Array(await response.arrayBuffer());
                    if (requestSeq !== state.recommendPdfRenderSeq) return;
                    if (!bytes.length && renderEmptyDocumentPreview()) return;
                    // 파일명뿐 아니라 실제 응답의 PDF 시그니처도 확인한다.
                    if (isUploadPreview && String.fromCharCode(...bytes.slice(0, 5)) !== "%PDF-") {
                        throw new Error("서버에서 PDF 파일이 아닌 데이터를 반환했습니다.");
                    }
                    const loadingTask = window.pdfjsLib.getDocument({ data: bytes });
                    const pdf = await loadingTask.promise;
                    if (requestSeq !== state.recommendPdfRenderSeq) {
                        pdf.destroy?.();
                        return;
                    }
                    state.recommendPdf = pdf;
                    if (el.recommendPageTotal) el.recommendPageTotal.textContent = String(pdf.numPages);
                    if (el.recommendPageCurrent) el.recommendPageCurrent.textContent = pdf.numPages ? "1" : "0";
                    if (el.recommendCharCount) el.recommendCharCount.textContent = "-";
                    await renderRecommendPdfPages(pdf);
                } catch (error) {
                    if (requestSeq !== state.recommendPdfRenderSeq) return;
                    console.error("[관련자료 PDF.js 미리보기 오류]", error);
                    el.sourcePreview.innerHTML = '<div class="answer-pdf-error"><strong>원문 미리보기를 불러오지 못했습니다.</strong><span>' + escapeHtml(error.message || "PDF 로드 실패") + "</span></div>";
                    updateRecommendDocumentStats();
                }
            }

            // getFileDeleteTarget: 필요한 값을 조회.
            function getFileDeleteTarget(index, source) {
                if (source === "imported") {
                    const reference = importedSourceReferences.get(String(index));
                    return reference ? { name: reference.title } : null;
                }
                const files = source === "history" ? state.conversationFiles : state.uploadedFiles;
                return Array.isArray(files) ? files[index] : null;
            }

            // openFileDeleteModal: 대상 화면/팝업을 열고 필요한 데이터를 준비.
            function openFileDeleteModal(index, source = "pending") {
                // Start: 261014 추가 - 검색결과 삭제 모달
                const isSearch = source === "search";
                const modal = document.getElementById(isSearch ? "answerSourceSearchDeleteModal" : "answerSourceFileDeleteModal");
                const file = isSearch ? (sourceSearchItems.length ? { name: `검색 결과 ${sourceSearchItems.length}건 전체` } : null) : getFileDeleteTarget(index, source);
                // End: 261014 추가 - 검색결과 삭제 모달
                if (!modal || !file) return;
                state.pendingFileDeleteIndex = index;
                state.pendingFileDeleteSource = source;
                const name = modal.querySelector("[data-file-delete-name]");
                if (name) {
                    name.textContent = String(file.name || file.filename || file.file_name || "첨부파일");
                }
                modal.classList.remove("hidden");
                modal.removeAttribute("hidden");
                modal.setAttribute("aria-hidden", "false");
                // Start: 261014 추가 - 검색결과 삭제 모달
                if (isSearch) modal.querySelector(".btn-cancel")?.focus({ preventScroll: true });
                // End: 261014 추가 - 검색결과 삭제 모달
            }

            // closeFileDeleteModal: 대상 화면/팝업을 닫고 상태를 정리.
            function closeFileDeleteModal() {
                // Start: 261014 추가 - 검색결과 삭제 모달
                const isSearch = state.pendingFileDeleteSource === "search";
                const modal = document.getElementById(isSearch ? "answerSourceSearchDeleteModal" : "answerSourceFileDeleteModal");
                // End: 261014 추가 - 검색결과 삭제 모달
                if (!modal) return;
                modal.classList.add("hidden");
                modal.setAttribute("hidden", "");
                modal.setAttribute("aria-hidden", "true");
                state.pendingFileDeleteIndex = -1;
                state.pendingFileDeleteSource = "";
                // Start: 261014 추가 - 검색결과 삭제 모달
                if (isSearch) sourceSearch.clear.focus({ preventScroll: true });
                // End: 261014 추가 - 검색결과 삭제 모달
            }

            // confirmFileDelete: 해당 기능의 세부 처리를 담당.
            async function confirmFileDelete() {
                const index = state.pendingFileDeleteIndex;
                const source = state.pendingFileDeleteSource || "pending";
                // Start: 261014 추가 - 검색결과 삭제 모달
                // 검색 결과 삭제는 파일 삭제 API를 호출하지 않고 대기 중인 검색 목록만 비운다.
                if (source === "search") {
                    closeFileDeleteModal();
                    resetSourceSearch(false);
                    sourceSearch.input.focus({ preventScroll: true });
                    return;
                }
                // End: 261014 추가 - 검색결과 삭제 모달
                const file = getFileDeleteTarget(index, source);
                if (!file) {
                    closeFileDeleteModal();
                    return;
                }
                if (source === "imported") {
                    const docId = String(index);
                    importedSourceReferences.delete(docId);
                    state.recommendationItems.filter((item) => String(item.doc_id) === docId).forEach((item) => state.selectedReferenceKeys.delete(item.key));
                    closeFileDeleteModal();
                    renderUploadedFiles();
                    runtime.page.onSelectionChanged?.();
                    showToast("참조소스 목록에서 제외했습니다.");
                    return;
                }
                const fileId = String(file.id || file.file_id || "").trim();
                if (!fileId) {
                    showToast("삭제할 파일 ID를 찾지 못했습니다.");
                    return;
                }
                try {
                    const body = new URLSearchParams();
                    body.append("fileId", fileId);
                    // [API 연동] POST ND_fileDelete.do: 업로드한 첨부파일 삭제.
                    const response = await fetch("ND_fileDelete.do", {
                        method: "POST",
                        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
                        body: body.toString(),
                        credentials: "same-origin",
                    });
                    if (!response.ok) {
                        throw new Error("파일 삭제 실패: " + response.status + " " + (await response.text()));
                    }
                    state.uploadedFiles = state.uploadedFiles.filter((item) => String(item?.id || item?.file_id || "").trim() !== fileId);
                    state.conversationFiles = state.conversationFiles.filter((item) => String(item?.id || item?.file_id || "").trim() !== fileId);
                    renderUploadedFiles();
                    closeFileDeleteModal();
                    showToast("파일을 삭제했습니다.");
                } catch (error) {
                    console.error("파일 삭제 실패", error);
                    showToast(error.message || "파일 삭제에 실패했습니다.");
                }
            }

            // openReferenceFilePicker: 대상 화면/팝업을 열고 필요한 데이터를 준비.
            function openReferenceFilePicker(event) {
                if (state.uploading || state.sending || state.openingFilePicker) return;
                if (event?.target === el.fileInput) return;
                event?.preventDefault();
                event?.stopPropagation();
                state.openingFilePicker = true;
                try {
                    // 동일 파일을 다시 골라도 change가 발생하도록 미리 초기화한다.
                    el.fileInput.value = "";
                    el.fileInput.click();
                } finally {
                    window.setTimeout(() => {
                        state.openingFilePicker = false;
                    }, 0);
                }
            }

            // activateHistoricalFile: 해당 기능의 세부 처리를 담당.
            function activateHistoricalFile(item) {
                if (!item || state.uploading || isConversationPending(state.conversationId)) return;
                const index = Number(item.dataset.fileHistoryIndex);
                const file = Number.isInteger(index) ? state.conversationFiles[index] : null;
                if (!file) return;
                const fileIdentity = getUploadedFileIdentity(file);
                const alreadySelected = state.uploadedFiles.some((selected) => getUploadedFileIdentity(selected) === fileIdentity);
                if (alreadySelected) {
                    state.uploadedFiles = state.uploadedFiles.filter((selected) => getUploadedFileIdentity(selected) !== fileIdentity);
                    renderUploadedFiles();
                    showToast("이번 질문의 첨부 대상에서 제외했습니다.");
                    return;
                }
                // 기존 서버 파일 객체를 그대로 이번 턴 전송 목록에 넣는다.
                // ND_fileUpload.do를 다시 호출하지 않고 sendMessageStream의 files에 동일하게 전달된다.
                state.uploadedFiles.push(file);
                renderUploadedFiles();
                showToast("기존 파일을 이번 질문에 다시 첨부했습니다.");
            }

            // Start: 261015 추가 - 소스 추가 도움말
            // 고정 문구와 마크업은 HTML에서 관리하고 JS는 상태와 위치만 제어한다.
            const sourceHelpButton = document.querySelector(".source-help-btn");
            const sourceHelp = document.getElementById("sourceHelpPopover");
            if (sourceHelpButton && sourceHelp) {
                // auto popover가 바깥 클릭과 Escape 닫기를 처리하며 패널 overflow에 잘리지 않는다.

                function positionSourceHelp() {
                    const rect = sourceHelpButton.getBoundingClientRect();
                    const width = sourceHelp.offsetWidth;
                    const height = sourceHelp.offsetHeight;
                    // 기본 위치는 버튼 오른쪽이며, 화면이 좁으면 화면 안으로 보정한다.
                    const left = Math.max(12, Math.min(rect.right + 12, window.innerWidth - width - 12));
                    const top = Math.max(12, Math.min(rect.top - 8, window.innerHeight - height - 12));
                    sourceHelp.style.left = `${left}px`;
                    sourceHelp.style.top = `${top}px`;
                    sourceHelp.classList.toggle("has-side-arrow", left > rect.right);
                }

                sourceHelp.addEventListener("toggle", () => {
                    const open = sourceHelp.matches(":popover-open");
                    sourceHelpButton.setAttribute("aria-expanded", String(open));
                    if (open) positionSourceHelp();
                });
                // 안내창 내부를 눌러도 닫고, ? 버튼 재클릭은 기본 popover 토글을 사용한다.
                sourceHelp.addEventListener("click", () => sourceHelp.hidePopover());
                window.addEventListener("resize", () => {
                    if (sourceHelp.matches(":popover-open")) positionSourceHelp();
                });
                // 스크롤로 버튼 위치가 바뀌면 안내창이 떨어져 남지 않도록 닫는다.
                document.addEventListener(
                    "scroll",
                    () => {
                        if (sourceHelp.matches(":popover-open")) sourceHelp.hidePopover();
                    },
                    true,
                );
            }
            // End: 261015 추가 - 소스 추가 도움말

            // Start: 261015 추가 - 선택된 소스 목록 펼침과 접힘 이벤트
            const selectedReferencesToggle = document.getElementById("selectedReferencesToggle");
            const selectedRefsSection = selectedReferencesToggle?.closest(".selected-refs");
            const selectedRefsPanel = selectedRefsSection?.parentElement;
            let selectedRefsLayoutFrame = 0;

            // 실제 행 높이(글자 크기 포함)를 사용하고, 검색창 아래까지만 위로 확장한다.
            function scheduleSelectedReferencesLayout() {
                if (selectedRefsLayoutFrame) return;
                selectedRefsLayoutFrame = requestAnimationFrame(() => {
                    selectedRefsLayoutFrame = 0;
                    if (!selectedRefsSection?.classList.contains("is-expanded") || !selectedRefsPanel?.clientHeight) return;
                    const sourcePane = sourceSearch.form?.closest(".folder-upload-section");
                    if (!sourcePane) return;
                    const px = (value) => parseFloat(value) || 0;
                    const panelStyle = getComputedStyle(selectedRefsPanel);
                    const sectionStyle = getComputedStyle(selectedRefsSection);
                    const sourceStyle = getComputedStyle(sourcePane);
                    const handle = selectedRefsPanel.querySelector(".left-panel-resize-handle");
                    const handleStyle = handle && getComputedStyle(handle);
                    const handleHeight = handle ? handle.getBoundingClientRect().height + px(handleStyle.marginTop) + px(handleStyle.marginBottom) : 0;
                    const bottom = selectedRefsPanel.getBoundingClientRect().top + selectedRefsPanel.clientTop + selectedRefsPanel.clientHeight - px(panelStyle.paddingBottom);
                    // 소스 목록을 스크롤한 상태에서도 검색창의 원래 위치를 기준으로 한다.
                    const searchBottom = sourceSearch.form.getBoundingClientRect().bottom + sourcePane.scrollTop;
                    const maxHeight = Math.max(0, bottom - searchBottom - px(sourceStyle.paddingBottom) - handleHeight);
                    let contentHeight = px(sectionStyle.paddingTop) + px(sectionStyle.paddingBottom) + px(sectionStyle.borderTopWidth) + px(sectionStyle.borderBottomWidth);
                    Array.from(selectedRefsSection.children).forEach((child) => {
                        const style = getComputedStyle(child);
                        if (style.display === "none" || style.position === "absolute" || style.position === "fixed") return;
                        const height = child === el.selectedReferenceList ? child.scrollHeight : child.getBoundingClientRect().height;
                        contentHeight += height + px(style.marginTop) + px(style.marginBottom);
                    });
                    selectedRefsSection.style.setProperty("--selected-refs-max-height", `${maxHeight}px`);
                    selectedRefsSection.style.setProperty("--selected-refs-height", `${Math.min(Math.ceil(contentHeight), maxHeight)}px`);
                });
            }

            if (selectedRefsPanel) {
                const selectedRefsResizeObserver = new ResizeObserver(scheduleSelectedReferencesLayout);
                [selectedRefsPanel, sourceSearch.form, el.selectedReferenceList, el.selectedReferenceEmpty, selectedRefsSection.querySelector(".selected-refs-head")]
                    .filter(Boolean)
                    .forEach((element) => selectedRefsResizeObserver.observe(element));
            }
            selectedReferencesToggle?.addEventListener("click", () => {
                const section = selectedReferencesToggle.closest(".selected-refs");
                if (!section) return;
                const expanded = section.classList.toggle("is-expanded");
                selectedReferencesToggle.setAttribute("aria-expanded", String(expanded));
                selectedReferencesToggle.setAttribute("aria-label", `선택된 소스 목록 ${expanded ? "접기" : "펼치기"}`);
                selectedReferencesToggle.dataset.tooltip = `선택된 소스 목록 ${expanded ? "접기" : "펼치기"}`;
                // 수동 드래그 높이를 지우고 선택 건수에 맞는 자동 높이로 복원한다.
                window.AIOneSplitHandler?.reset?.(section.closest('[data-component="split-handler"]'));
                scheduleSelectedReferencesLayout();
            });
            // End: 261015 추가 - 선택된 소스 목록 펼침과 접힘 이벤트

            // Start: 261012 추가 - 참조소스 일반 목록과 분류별 목록 전환 이벤트
            sourceAccordion?.addEventListener("click", async () => {
                if (sourceAccordion.disabled) return;
                const collapsing = !sourceFilesCollapsed;
                const spinner = document.createElement("span");
                spinner.className = "source-chunking-spinner";
                spinner.setAttribute("aria-hidden", "true");
                try {
                    sourceAccordion.disabled = true;
                    sourceAccordion.classList.add("is-loading");
                    sourceAccordion.setAttribute("aria-busy", "true");
                    sourceAccordion.setAttribute("aria-label", collapsing ? "참조소스 파일목록 정리 중" : "참조소스 파일목록 펼치는 중");
                    sourceAccordion.appendChild(spinner);
                    // 스피너가 한 바퀴 회전한 뒤 접기와 펼치기를 완료한다.
                    await new Promise((resolve) => window.setTimeout(resolve, 700));
                    sourceFilesCollapsed = collapsing;
                    expandedSourceCategories.clear();
                    renderSourceFileGroups();
                } finally {
                    spinner.remove();
                    sourceAccordion.classList.remove("is-loading");
                    sourceAccordion.removeAttribute("aria-busy");
                    sourceAccordion.disabled = false;
                }
            });
            // End: 261012 추가 - 참조소스 일반 목록과 분류별 목록 전환 이벤트

            // Start: 261012 추가 - 참조소스 파일 정렬 이벤트
            sourceSelectAll?.addEventListener("change", () => {
                if (state.uploading || isConversationPending(state.conversationId)) return;
                const selected = sourceSelectAll.checked;
                const rows = getSourceFileRows().filter((row) => !row.item.classList.contains("is-source-processing"));
                const files = new Map(state.uploadedFiles.map((file) => [getUploadedFileIdentity(file), file]));
                rows.forEach((row) => {
                    const docId = row.item.dataset.sourceReferenceId;
                    if (docId) {
                        state.recommendationItems
                            .filter((item) => String(item.doc_id) === docId)
                            .forEach((item) => {
                                if (selected) addSelectedReferenceKey(item.key);
                                else state.selectedReferenceKeys.delete(item.key);
                            });
                    } else if (selected) files.set(getUploadedFileIdentity(row.file), row.file);
                    else files.delete(getUploadedFileIdentity(row.file));
                });
                state.uploadedFiles = [...files.values()];
                renderUploadedFiles();
                runtime.page.onSelectionChanged?.();
            });
            // End: 261012 추가 - 참조소스 파일 정렬 이벤트

            // Start: 261012 추가 - 분류별 파일 목록 펼침과 접힘 이벤트
            el.fileList.addEventListener("click", (event) => {
                const button = event.target.closest("[data-source-category-toggle]");
                if (!button) return;
                const list = document.getElementById(button.getAttribute("aria-controls"));
                if (!list) return;
                const category = button.dataset.sourceCategoryToggle;
                const expanded = button.getAttribute("aria-expanded") !== "true";
                if (expanded) expandedSourceCategories.add(category);
                else expandedSourceCategories.delete(category);
                button.setAttribute("aria-expanded", String(expanded));
                list.hidden = !expanded;
            });
            // End: 261012 추가 - 분류별 파일 목록 펼침과 접힘 이벤트

            // selectedDocIdsFromUi: 해당 기능의 세부 처리를 담당.
            function selectedDocIdsFromUi() {
                return Array.from(
                    new Set(
                        state.recommendationItems
                            .filter((item) => state.selectedReferenceKeys.has(item.key))
                            .map((item) => String(item.doc_id || "").trim())
                            .filter(Boolean),
                    ),
                ).slice(0, 50);
            }

            // 검색 결과를 참조소스로 가져오는 공통 진입점. 화면별 이벤트는 페이지에서 연결한다.
            function importSourceReference(item) {
                enableSourcePanelExpansion();
                restoreSourcePanel();
                selectImportedSource(item);
                sourceFilesCollapsed = false;
                renderUploadedFiles();
                renderSelectedReferences();
                runtime.page.onSelectionChanged?.();
            }
            Object.assign(runtime, {
                renderRecommendations,
                getSearchRecommendationItems,
                selectedDocIdsFromUi,
                importSourceReference,
                getActiveReferenceItem,
                getUploadedRecommendationItems,
                // Start: 261014 추가 - 검색 초기화 함수 연결
                resetSourceSearch,
                initializeSourceSearch,
                // End: 261014 추가 - 검색 초기화 함수 연결
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
            });
        }
    };
})(window);
