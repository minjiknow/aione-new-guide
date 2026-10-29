/**
 * 261028 누적 변경 요약 (현재 구현 기준)
 * - 답변서 상태·DOM과 관련자료 필터·미리보기·전체선택 이벤트를 연결합니다. 전체선택은 현재 필터에만 적용하고 업로드와 문서 선택 상태를 구분합니다.
 *
 * AI-ONE 답변서 상태·화면 연결
 * 적용 화면: ai-answer.html
 * 역할: 답변서 전용 상태·DOM, 관련자료 필터와 문서 확대·편집 이벤트
 * 연결: 공통 패널 상태는 panel.js. 문서 전체보기는 공통 컨트롤러 재사용
 * - 261022 변경 - 공통 패널 배치는 panel-workspace.js에 두고 답변서 DOM·필터·본문 도구만 연결합니다.
 *
 * 기본 구간 형식: Start: 기능명 / End: 기능명
 * 변경 구간 형식: Start: YYMMDD 추가/수정 - 기능명 / End: YYMMDD 추가/수정 - 기능명
 * 주석 정리 내역
 * - 261023 주석 정리 - 구간 표시와 변경 내용 표기를 통일합니다. 기존 작업 날짜와 기능 설명은 유지합니다.
 */

window.AIOneDraftWorkspace = {
    configure(runtime) {
        Object.assign(runtime.state, {
        reportSelectedDocIds: new Set(),
        reportId: "",
        reportTitle: "",
        reportVersion: 0,
        reportContent: "",
        reportVersions: [],
        dismissedVersions: new Set(),
        editPreservedMarkers: "",
        zoom: 100,
        compareSelectedSourceKey: "",
        compareSelectedVersion: 0,
        comparePanelsSwapped: false,
        compareScrollSync: true,
        compareRenderSeq: 0,
        draftDisplayMode: "single",
        draftCompareLeftVersion: 0,
        draftCompareRightVersion: 0,
        draftCompareScrollSync: true,
        draftCompareRenderSeq: 0,
        draftCompareZoom: 100,
        });
        Object.assign(runtime.el, {
        recommendList: document.getElementById("recommendationList"),
        recommendEmpty: document.getElementById("recommendationEmpty"),
        recommendCount: document.getElementById("recommendTabCount"),
        recommendFooterCount: document.getElementById("recommendFooterCount"),
        filterAllCount: document.getElementById("filterAllCount"),
        filterHistoryCount: document.getElementById("filterHistoryCount"),
        filterEvidenceCount: document.getElementById("filterEvidenceCount"),
        selectAllReferences: document.getElementById("selectAllReferences"),
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
        editBackdrop: document.getElementById("reportEditModalBackdrop"),
        editContent: document.getElementById("reportEditContent"),
        editClose: document.getElementById("reportEditModalClose"),
        editCancel: document.getElementById("reportEditCancel"),
        editSave: document.getElementById("reportEditSave"),
        });
        Object.assign(runtime, {
            compareScrollLock: false,
            selectedSourcesSaveTimer: 0,
            reportDetailRequestSeq: 0,
            pendingDownloadFormat: "",
            pendingDownloadVersion: undefined,
        });
    },
    bind(runtime) {
        const { addSelectedReferenceKey, applyZoom, closeEditModal, el, getUploadedFileIdentity, getVisibleRecommendationItems, referenceKey, renderPreview, renderRecommendations, renderSelectedReferences, renderUploadedFiles, state, updateDraftDocumentStats } = runtime;
        // Start: 261015 수정 - 관련자료 필터·미리보기·전체선택 이벤트
        // 필터를 바꾸면 카드·안내 배너·건수를 갱신한다. 검색·업로드 카드 클릭은 미리보기 대상만 바꾼다.
        // 전체선택은 현재 필터의 자료만 처리하며, 업로드 자료는 uploadedFiles, 문서는 selectedReferenceKeys에 반영한다.
        document.querySelectorAll(".answer-reference-filters").forEach((filters) => {
            window.AIOneReferenceFilters.init(filters, () => renderRecommendations());
        });
        // 261020: work-support.html은 관련자료 영역을 생략하므로, 해당 요소가 있을 때만
        // 이벤트를 연결한다. 영역 부재로 채팅목록과 참조소스 초기화가 중단되지 않게 한다.
        el.recommendList?.addEventListener("click", (event) => {
            const card = event.target.closest(".rec-card[data-reference-key]");
            if (!card) return;
            const key = card.dataset.referenceKey;
            if (event.target.matches('input[type="checkbox"]')) {
                if (event.target.checked) addSelectedReferenceKey(key);
                else state.selectedReferenceKeys.delete(key);
                renderSelectedReferences();
                renderRecommendations();
                runtime.page.onSelectionChanged?.();
                return;
            }
            // label의 기본 input 클릭이 발생하기 전에 관련자료 DOM이 교체되지 않도록 한다.
            if (event.target.closest(".rec-checkbox")) return;
            state.activeReferenceKey = key;
            renderRecommendations();
            renderPreview();
        });
        el.selectAllReferences?.addEventListener("change", () => {
            const selected = el.selectAllReferences.checked;
            let includesUploads = false;
            getVisibleRecommendationItems().forEach((item) => {
                if (item.category === "upload") {
                    includesUploads = true;
                    const identity = getUploadedFileIdentity(item.raw);
                    state.uploadedFiles = state.uploadedFiles.filter((file) => getUploadedFileIdentity(file) !== identity);
                    if (selected) state.uploadedFiles.push(item.raw);
                } else if (selected) addSelectedReferenceKey(item.key);
                else state.selectedReferenceKeys.delete(item.key);
            });
            if (includesUploads) renderUploadedFiles();
            else {
                renderRecommendations();
                renderSelectedReferences();
            }
            runtime.page.onSelectionChanged?.();
        });
        // End: 261015 수정 - 관련자료 필터·미리보기·전체선택 이벤트

        el.zoomOut?.addEventListener("click", () => {
            state.zoom = Math.max(50, state.zoom - 10);
            applyZoom();
        });
        el.zoomIn?.addEventListener("click", () => {
            state.zoom = Math.min(200, state.zoom + 10);
            applyZoom();
        });
        el.draftScroll?.addEventListener("scroll", updateDraftDocumentStats);
        el.draftScroll?.addEventListener(
            "wheel",
            (event) => {
                if (!event.ctrlKey) return;
                event.preventDefault();
                state.zoom = Math.max(50, Math.min(200, state.zoom + (event.deltaY < 0 ? 10 : -10)));
                applyZoom();
            },
            { passive: false },
        );
        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && !el.editBackdrop.classList.contains("hidden")) closeEditModal();
        });

    },
};
