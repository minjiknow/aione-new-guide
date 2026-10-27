/**
 * AI-ONE 내부자료 검색·업무지원
 * 적용 화면: work-support.html
 * 역할: 페이지 초기화, 구조화 답변·자료 연결·미리보기, 생성결과 조회·생성·다운로드
 * 연결: 공통 UI·전송은 panel.js/panel-*.js. 생성·목록 provider와 외부 전역 API 유지
 * - 261022 정리 - 공통 패널과 화면 전용 기능의 관리 범위를 분리합니다.
 *
 * 261026 변경 요약
 * - 수정 - 레이아웃 초기화 후 미리보기 내용은 유지하고 닫기 시 복원할 너비·최소 너비·접힘 상태 갱신
 * - 주석 보완 - 접힌 참조소스의 파일 미리보기 차단, 미리보기 패널 폭·최소 너비 확장 및 닫기 시 복원 처리 기록
 *
 * 기본 구간 형식: Start: 기능명 / End: 기능명
 * 변경 구간 형식: Start: YYMMDD 추가/수정 - 기능명 / End: YYMMDD 추가/수정 - 기능명
 * 주석 정리 내역
 * - 261023 주석 정리 - 구간 표시와 변경 내용 표기를 통일합니다. 기존 작업 날짜와 기능 설명은 유지합니다.
 */

// API 계약: Generate({ type }) → 결과 항목, LoadResults({ cursor, limit }) → { items, nextCursor }.
// AIOneWorkSupportGenerate / AIOneWorkSupportLoadResults는 이 파일보다 먼저 연결합니다.
// 구조화 답변: { kind: "work-support", title, description, sections, documents, suggestions }.

(() => {
    if (!document.querySelector('.three-panel [data-panel="result"]')) return;
    const create = (tag, className, text) => {
        const element = document.createElement(tag);
        element.className = className;
        if (text != null) element.textContent = text;
        return element;
    };
    function button(label, action, value) {
        const element = create("button", "work-" + action, label);
        element.type = "button";
        element.dataset.workAction = action;
        element.dataset.workValue = JSON.stringify(value);
        return element;
    }
    function render(target, text) {
        let data;
        try {
            data = JSON.parse(text);
        } catch {
            return false;
        }
        if (data?.kind !== "work-support") return false;
        const fragment = document.createDocumentFragment();
        const header = create("div", "work-answer-heading");
        header.append(create("strong", "", data.title), create("p", "", data.description));
        fragment.append(header);
        for (const section of data.sections || []) {
            const block = create("section", "work-answer-section");
            const paragraph = create("p", "", section.text);
            paragraph.append(button(`[출처 p.${section.page}]`, "source", section.document));
            block.append(create("strong", "", section.title), paragraph);
            fragment.append(block);
        }
        if (data.documents) {
            fragment.append(create("strong", "work-search-count", `검색된 자료 ${data.documents.length}건`));
            for (const doc of data.documents) {
                const row = create("div", "work-search-file");
                const icon = create("span", "file-icon " + (/\.pdf$/i.test(doc.document_name) ? "pdf" : "hwp"));
                icon.setAttribute("aria-hidden", "true");
                const documentIcon = document.querySelector('.service-card[data-service-tone="red"] svg');
                if (documentIcon) icon.append(documentIcon.cloneNode(true));
                const info = button("", "source", doc);
                info.append(create("strong", "", doc.document_name), create("span", "", [doc.meta?.answerer_org, doc.meta?.answer_date].filter(Boolean).join(" · ")), create("span", "", doc.content));
                row.append(icon, info, button("가져오기", "import", doc));
                fragment.append(row);
            }
        }
        const suggestions = create("div", "work-suggestions");
        for (const suggestion of data.suggestions || []) suggestions.append(button("↳　" + suggestion, "suggestion", suggestion));
        fragment.append(suggestions);
        target.replaceChildren(fragment);
        return true;
    }
/* Start: 261026 수정 - 참조소스 미리보기 차단 및 패널 너비 확장·복원 */
    const PREVIEW_PANEL_WIDTH = 700;
    const previewWidths = new Map();
    const previewMinimums = new Map();
    const previewContents = new Map();
    let restoreResultCollapsed = false;
    // 미리보기 내용은 유지하되 닫을 때 돌아갈 폭은 초기화된 배치를 기준으로 갱신합니다.
    document.querySelector(".three-panel")?.addEventListener("workspace:layout-reset", (event) => {
        const layout = window.AIOneWorkspaceUi.getLayoutState(event.currentTarget);
        previewWidths.forEach((_, key) => {
            previewWidths.set(key, layout.widthsByPanel[key]);
            const panel = event.currentTarget.querySelector(`[data-panel="${key}"]`);
            previewMinimums.set(key, panel?.getAttribute("data-panel-min") ?? null);
        });
        restoreResultCollapsed = false;
    });
    const resultLayout = document.querySelector('[data-panel="result"]').closest('.three-panel');
    window.AIOneWorkspaceUi.initPanelCollapse({ container: resultLayout, flexibleKey: "chat" });
    function setResultCollapsed(collapsed) {
        window.AIOneWorkspaceUi.setPanelCollapsed(document.querySelector('[data-panel="result"]'), collapsed, { flexibleKey: "chat" });
    }
    function setPreviewPanel(panelName, open) {
        const layout = document.querySelector(".three-panel");
        const panel = document.querySelector(`[data-panel="${panelName}"]`);
        const common = window.AIOneWorkspaceCommon;
        if (panelName === "result" && open && !previewWidths.has(panelName)) {
            restoreResultCollapsed = panel.classList.contains("panel-collapsed");
            if (restoreResultCollapsed) setResultCollapsed(false);
        }
        const panels = common.getPanels(layout);
        const state = window.AIOneWorkspaceUi.getLayoutState(layout);
        if (open) {
            if (!previewWidths.has(panelName)) previewWidths.set(panelName, state.widthsByPanel[panelName]);
            // 공통 리사이즈에서도 미리보기 너비를 유지하고, 닫을 때 원래 최소 너비를 복원한다.
            if (!previewMinimums.has(panelName)) previewMinimums.set(panelName, panel.getAttribute("data-panel-min"));
            panel.dataset.panelMin = String(PREVIEW_PANEL_WIDTH);
            state.widthsByPanel[panelName] = PREVIEW_PANEL_WIDTH;
        } else {
            if (previewMinimums.has(panelName)) {
                const minimum = previewMinimums.get(panelName);
                if (minimum === null) panel.removeAttribute("data-panel-min");
                else panel.setAttribute("data-panel-min", minimum);
                previewMinimums.delete(panelName);
            }
            state.widthsByPanel[panelName] = previewWidths.get(panelName) || state.widthsByPanel[panelName];
            previewWidths.delete(panelName);
        }
        // DOM의 현재 순서와 패널 ID로 계산한다. data-slot은 드래그 후에도 원래 값이므로 사용하지 않는다.
        const widths = common.fitPanelWidths({
            ...state,
            flexibleKey: "chat",
            getMinimum: (key) => {
                const target = panels.find((item) => item.dataset.panel === key);
                return target?.classList.contains("panel-collapsed") ? 44 : Number(target?.dataset.panelMin) || 180;
            },
            getAvailableWidth: () => common.getAvailablePanelWidth(layout, common.getPanelHandles(layout)),
        });
        window.AIOneSplitHandler?.reset?.(layout);
        window.AIOneWorkspaceUi.applyPanelWidths(layout, widths);
        window.AIOneSplitHandler?.init?.(layout);
        if (open && !previewContents.has(panelName)) {
            const elements = [...Array.from(panel.children).filter((element) => !element.matches(".panel-head, .work-document-preview")), ...panel.querySelectorAll(":scope > .panel-head .panel-actions > :not([data-work-preview-close])")];
            previewContents.set(panelName, {
                hidden: new Map(elements.map((element) => [element, element.hidden])),
                upload: panel.classList.contains("upload-panel-area"),
            });
            elements.forEach((element) => {
                element.hidden = true;
            });
            // 업로드 하단 반영 버튼을 숨기는 동안 해당 영역의 여백도 해제한다.
            panel.classList.remove("upload-panel-area");
        } else if (!open && previewContents.has(panelName)) {
            const previous = previewContents.get(panelName);
            previous.hidden.forEach((hidden, element) => {
                element.hidden = hidden;
            });
            panel.classList.toggle("upload-panel-area", previous.upload);
            previewContents.delete(panelName);
        }
        panel.querySelector(".work-document-preview").hidden = !open;
        panel.querySelector("[data-work-preview-close]").hidden = !open;
        if (panelName === "result" && !open && restoreResultCollapsed) {
            restoreResultCollapsed = false;
            setResultCollapsed(true);
        }
    }
    function closeSourcePreview() {
        if (previewContents.has("folder")) setPreviewPanel("folder", false);
    }
    function openPreview(title) {
        // 접힌 참조소스에서는 문서 선택으로 패널 너비나 내용을 전환하지 않는다.
        if (document.querySelector('[data-panel="folder"]').classList.contains("panel-collapsed")) return false;
        setPreviewPanel("folder", true);
        document.querySelector("[data-work-preview-title]").textContent = title;
        return true;
    }
/* End: 261026 수정 - 참조소스 미리보기 차단 및 패널 너비 확장·복원 */
    function openResultPreview(item, label) {
        const preview = document.querySelector('[data-panel="result"] .work-document-preview');
        preview.querySelector(".file-name").textContent = item.title;
        preview.querySelector(".sub-badge").textContent = label;
        preview.querySelector(".doc-pages-track").replaceChildren(document.getElementById("answerDocumentPreviewTemplate").content.cloneNode(true));
        setPreviewPanel("result", true);
        preview.dataset.resultId = String(item.id);
    }
    document.addEventListener("click", (event) => {
        if (event.target.closest('[data-work-download="source"]')) {
            document.dispatchEvent(new CustomEvent("worksupport:download", { detail: { source: true } }));
            return;
        }
        const close = event.target.closest("[data-work-preview-close]");
        if (close) {
            setPreviewPanel(close.closest("[data-panel]").dataset.panel, false);
            return;
        }
        const control = event.target.closest("[data-work-action]");
        if (!control) return;
        const value = JSON.parse(control.dataset.workValue);
        if (control.dataset.workAction === "suggestion") {
            const input = document.getElementById("chatInput");
            input.value = value;
            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.focus();
            return;
        }
        const importSource = control.dataset.workAction === "import";
        document.dispatchEvent(new CustomEvent("worksupport:source", { detail: { document: value, importSource } }));
        if (importSource) {
            document.querySelectorAll('[data-work-action="import"]').forEach((item) => {
                if (JSON.parse(item.dataset.workValue).document_id === value.document_id) {
                    item.textContent = "추가됨";
                    item.disabled = true;
                }
            });
        }
    });
    function closeResultPreview() {
        const preview = document.querySelector('[data-panel="result"] .work-document-preview');
        if (!preview.hidden) setPreviewPanel("result", false);
        delete preview.dataset.resultId;
        preview.querySelector(".file-name").textContent = "";
        preview.querySelector(".sub-badge").textContent = "";
        preview.querySelector(".doc-pages-track").replaceChildren();
    }
    window.AIOneWorkSupportChat = Object.freeze({ render, openPreview, closeSourcePreview, openResultPreview, closeResultPreview });
})();

/**
 * 업무지원 생성 결과 목록. 공통 file-list 행과 생성 도구의 아이콘을 재사용합니다.
 * API 연동: AIOneWorkSupportResults.render(items), 항목: { id, type, title, time, file_id }.
 * file_id는 원본 다운로드 API의 식별자이며, 결과 ID와 구분합니다.
 * 결과 선택 시 generatedresult:select의 detail.id/type으로 상세 화면을 연결합니다.
 */
(() => {
    "use strict";
    const list = document.querySelector("[data-generated-result-list]");
    if (!list) return;
    const count = document.querySelector("[data-generated-result-count]");
    const empty = document.querySelector("[data-generated-result-empty]");
    const emptyTitle = empty.querySelector("[data-generated-result-empty-title]");
    const types = {
        report: { label: "보고서", tone: "red" },
        table: { label: "데이터표", tone: "blue" },
        quiz: { label: "퀴즈", tone: "cyan" },
        chart: { label: "차트", tone: "purple" },
    };
    let results = [];
    const loading = document.querySelector("[data-generated-result-loading]");
    let loadingResults = false;
    let nextCursor = null;
    let resultsEpoch = 0;
    const pageSize = 12;
    const previewItems = window.AIOneDummyData?.workSupport?.results || [];
    const fetchResults =
        window.AIOneWorkSupportLoadResults ||
        (window.AIOneDummyData
            ? async ({ cursor = 0, limit }) => {
                  await new Promise((resolve) => setTimeout(resolve, window.AIOneDummyData.workSupport.resultsDelay || 0));
                  const end = Number(cursor) + limit;
                  return { items: previewItems.slice(Number(cursor), end), nextCursor: end < previewItems.length ? end : null };
              }
            : null);

    // 조회 응답: { items, nextCursor }. 마지막 페이지는 nextCursor: null.
    async function load(loader, { append = false } = {}) {
        if (loadingResults) return;
        const requestEpoch = resultsEpoch;
        loadingResults = true;
        const existingIds = new Set(results.map((item) => String(item.id)));
        loading.hidden = !append;
        const previousScrollTop = list.scrollTop;
        if (append) list.scrollTop = list.scrollHeight;
        empty.hidden = true;
        list.setAttribute("aria-busy", "true");
        try {
            const response = await loader();
            if (requestEpoch !== resultsEpoch) return;
            const items = Array.isArray(response) ? response : response.items;
            if (!Array.isArray(items)) throw new TypeError("생성 결과 목록은 배열이어야 합니다.");
            const cursor = Array.isArray(response) ? null : (response.nextCursor ?? null);
            nextCursor = append && cursor === nextCursor ? null : cursor;
            const createdDuringLoad = results.filter((item) => !existingIds.has(String(item.id)));
            const merged = append ? [...results, ...items] : [...createdDuringLoad, ...items];
            render([...new Map(merged.map((item) => [String(item.id), item])).values()]);
            if (append) list.scrollTop = previousScrollTop;
        } catch (error) {
            if (requestEpoch !== resultsEpoch) return;
            console.error("[이전 생성결과 조회 실패]", error);
            emptyTitle.textContent = "이전 생성결과를 불러오지 못했습니다. 다시 시도해 주세요.";
            empty.hidden = false;
        } finally {
            if (requestEpoch === resultsEpoch) {
                loadingResults = false;
                loading.hidden = true;
                list.setAttribute("aria-busy", "false");
            }
        }
    }
    list.addEventListener(
        "scroll",
        () => {
            if (loadingResults || nextCursor == null || !fetchResults) return;
            if (list.scrollHeight <= list.clientHeight || list.scrollTop + list.clientHeight < list.scrollHeight - 18) return;
            load(() => fetchResults({ cursor: nextCursor, limit: pageSize }), { append: true });
        },
        { passive: true },
    );
    document.querySelector('[data-work-download="result"]')?.addEventListener("click", (event) => {
        const id = event.currentTarget.closest(".work-document-preview").dataset.resultId;
        const item = results.find((entry) => String(entry.id) === id);
        document.dispatchEvent(new CustomEvent("worksupport:download", { detail: { fileId: item?.file_id } }));
    });

    function render(items = []) {
        const scrollTop = list.scrollTop;
        emptyTitle.textContent = "생성된 결과가 없습니다.";
        results = items.slice();
        const fragment = document.createDocumentFragment();
        items.forEach((item) => {
            const type = types[item.type];
            if (!type) return;
            const row = document.createElement("li");
            row.dataset.resultId = String(item.id);
            row.dataset.resultType = item.type;
            row.classList.toggle("is-generating", item.status === "generating");
            const button = document.createElement("button");
            button.type = "button";
            button.className = "file-item-main";
            button.setAttribute("aria-pressed", "false");
            button.setAttribute("aria-label", item.title);
            button.setAttribute("title", item.title);
            button.disabled = item.status === "generating";
            const icon = document.createElement("span");
            icon.className = "service-icon";
            icon.setAttribute("aria-hidden", "true");
            const source = document.querySelector(`.service-card[data-service-tone="${type.tone}"] .service-icon svg`);
            if (source) icon.append(source.cloneNode(true));
            const info = document.createElement("span");
            info.className = "file-info";
            const name = document.createElement("span");
            name.className = "file-name";
            name.textContent = item.title;
            const meta = document.createElement("span");
            meta.className = "file-meta";
            meta.textContent = item.status === "generating" ? "생성 중" : [type.label, item.time].filter(Boolean).join(" · ");
            info.append(name, meta);
            button.append(icon, info);
            row.append(button);
            fragment.append(row);
        });
        list.replaceChildren(fragment, loading);
        list.scrollTop = scrollTop;
        const total = list.querySelectorAll("[data-result-id]").length;
        count.textContent = String(total);
        empty.hidden = total > 0;
        list.hidden = total === 0;
    }

    list.addEventListener("click", (event) => {
        const button = event.target.closest(".file-item-main");
        if (!button || !list.contains(button)) return;
        const selected = button.closest("li");
        const item = results.find((entry) => String(entry.id) === selected.dataset.resultId);
        if (!item || item.status === "generating") return;
        window.AIOneWorkSupportChat.openResultPreview(item, types[item.type].label);
        for (const row of list.querySelectorAll("[data-result-id]")) {
            const active = row === selected;
            row.classList.toggle("active", active);
            row.querySelector("button").setAttribute("aria-pressed", String(active));
        }
        list.dispatchEvent(
            new CustomEvent("generatedresult:select", {
                bubbles: true,
                detail: { id: selected.dataset.resultId, type: selected.dataset.resultType },
            }),
        );
    });

    document.querySelectorAll(".service-card").forEach((card) => {
        card.addEventListener("click", async (event) => {
            event.preventDefault();
            if (card.getAttribute("aria-busy") === "true") return;
            const type = Object.keys(types).find((key) => types[key].tone === card.dataset.serviceTone);
            const provider = window.AIOneWorkSupportGenerate;
            const preview = window.AIOneDummyData?.workSupport?.generation;
            if (!provider && !preview) return;
            const requestEpoch = resultsEpoch;
            const id = "generated-" + crypto.randomUUID();
            const title = [preview?.title, types[type].label].filter(Boolean).join(" ");
            card.classList.add("is-generating");
            card.setAttribute("aria-busy", "true");
            render([{ id, type, title, status: "generating" }, ...results]);
            try {
                const generated = provider ? await provider({ type }) : await new Promise((resolve) => setTimeout(() => resolve({ title }), preview.delay));
                if (requestEpoch !== resultsEpoch) return;
                render(results.map((item) => (item.id === id ? { ...item, ...generated, status: "complete", time: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false }) } : item)));
            } catch (error) {
                if (requestEpoch !== resultsEpoch) return;
                render(results.filter((item) => item.id !== id));
                console.error("[업무지원 생성 실패]", error);
                window.alert("생성에 실패했습니다. 다시 시도해 주세요.");
            } finally {
                if (requestEpoch === resultsEpoch) {
                    card.classList.remove("is-generating");
                    card.setAttribute("aria-busy", "false");
                }
            }
        });
    });

    // Start: 261021 수정 - 새 작업 생성결과 및 진행 상태 초기화
    function reset() {
        resultsEpoch += 1;
        nextCursor = null;
        loadingResults = false;
        loading.hidden = true;
        list.setAttribute("aria-busy", "false");
        document.querySelectorAll(".service-card.is-generating").forEach((card) => {
            card.classList.remove("is-generating");
            card.setAttribute("aria-busy", "false");
        });
        window.AIOneWorkSupportChat.closeResultPreview();
        render([]);
        list.scrollTop = 0;
    }
    // End: 261021 수정 - 새 작업 생성결과 및 진행 상태 초기화
    window.AIOneWorkSupportResults = Object.freeze({ render, load, reset });
    render();
    if (window.AIOneWorkSupportLoadResults) {
        load(() => fetchResults({ cursor: null, limit: pageSize }));
    } else if (window.AIOneDummyData) {
        render(previewItems.slice(0, pageSize));
        nextCursor = previewItems.length > pageSize ? pageSize : null;
    }
})();

// 내부자료 검색 진입점: 위의 전용 기능을 공통 패널에 연결합니다.
window.AIOnePanel.init({
    config: { labels: { renameSuccess: "작업이름을 변경했습니다.", renameFailure: "작업 이름 변경에 실패했습니다.", workspace: "업무지원", untitled: "제목 없는 작업", history: "작업 목록" },
        previewDataKey: "workSupport", showHistoryIcon: false, kind: "work-support", layoutCookie: "ai_one_work_support_panel_layout_v1", promptType: "report_generator",
        newWorkspaceInPreview: true, previewConversation: true, sourceRowPreview: true },
    installPage(runtime) {
        Object.assign(runtime.page, {
            renderMessage: window.AIOneWorkSupportChat.render,
            closeSourcePreview: window.AIOneWorkSupportChat.closeSourcePreview,
            onNewWorkspace: window.AIOneWorkSupportResults.reset,
        });
    },
    bindPage({ el, state, sendChat, showToast, getActiveReferenceItem, downloadOriginalFile,
        normalizeRecommendations, importSourceReference, renderPreview, getUploadedRecommendationItems, getUploadedFileIdentity }) {
        document.addEventListener("worksupport:download", (event) => {
            const item = getActiveReferenceItem();
            const fileId = event.detail.source ? (item?.category === "upload" ? item.file_id : item?.doc_id) : event.detail.fileId;
            if (!fileId) {
                showToast("다운로드할 원본 파일이 없습니다.");
                return;
            }
            downloadOriginalFile(fileId);
        });
        document.addEventListener("worksupport:source", (event) => {
            const { document: source, importSource } = event.detail;
            const item = normalizeRecommendations([], [source])[0];
            if (!item) return;
            if (importSource) {
                importSourceReference(item);
                return;
            } else if (!state.recommendationItems.some((entry) => entry.key === item.key)) {
                state.recommendationItems.push(item);
            }
            state.activeReferenceKey = item.key;
            if (!window.AIOneWorkSupportChat.openPreview(item.title)) return;
            renderPreview();
        });
        el.fileList.addEventListener("click", (event) => {
            if (event.target.closest("input, label, button")) return;
            const id = event.target.closest("[data-source-reference-id]")?.dataset.sourceReferenceId;
            const row = event.target.closest("[data-file-history-index], [data-file-index]");
            const file = row?.hasAttribute("data-file-history-index") ? state.conversationFiles[Number(row.dataset.fileHistoryIndex)] : row ? state.uploadedFiles[Number(row.dataset.fileIndex)] : null;
            const item = id ? state.recommendationItems.find((entry) => String(entry.doc_id) === id) : file ? getUploadedRecommendationItems().find((entry) => entry.key === "upload:" + getUploadedFileIdentity(file)) : null;
            if (!item) return;
            event.stopImmediatePropagation();
            state.activeReferenceKey = item.key;
            if (!window.AIOneWorkSupportChat.openPreview(item.title)) return;
            renderPreview();
        });

        el.applyReferencesBtn?.addEventListener("click", async () => {
            const docIds = [...new Set(state.recommendationItems
                .filter((item) => state.selectedReferenceKeys.has(item.key))
                .map((item) => String(item.doc_id || "").trim())
                .filter(Boolean))];
            if (!docIds.length && !state.uploadedFiles.length) {
                showToast("참조할 자료를 선택해 주세요.");
                return;
            }
            await sendChat("선택한 참조자료를 바탕으로 주요 내용을 정리해 주세요.", {
                preserveWorkspace: true,
                docIds,
            });
        });
    },
});
