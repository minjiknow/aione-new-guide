/**
 * 261028 누적 변경 요약 (현재 구현 기준)
 * - 답변서 모듈을 조립하고 버전·근거·편집·다운로드 이벤트를 연결합니다. 공통 패널·채팅 초기화는 panel.js에 위임합니다.
 *
 * AI-ONE 답변서 초안 진입점
 * 적용 화면: ai-answer.html
 * 역할: 답변서 모듈 조립과 버전·근거·편집·다운로드 이벤트
 * 연결: panel.js 초기화에 draft-workspace/source/conversation/report/compare 연결
 * - 261022 변경 - 페이지 초기화·이벤트만 조립하며 공통 패널과 채팅 초기화는 panel.js로 위임합니다.
 *
 * 기본 구간 형식: Start: 기능명 / End: 기능명
 * 변경 구간 형식: Start: YYMMDD 추가/수정 - 기능명 / End: YYMMDD 추가/수정 - 기능명
 * 주석 정리 내역
 * - 261023 주석 정리 - 구간 표시와 변경 내용 표기를 통일합니다. 기존 작업 날짜와 기능 설명은 유지합니다.
 */

window.AIOnePanel.init({
  config: { labels: { renameSuccess: "대화 이름을 변경했습니다.", renameFailure: "대화 이름 변경에 실패했습니다.", workspace: "새 대화", untitled: "제목 없는 대화", history: "채팅 목록" },
        previewDataKey: "answer", showHistoryIcon: true, kind: "draft", layoutCookie: "ai_one_answer_panel_layout_v5", promptType: "report_generator" },
  configure: window.AIOneDraftWorkspace.configure,
  installPage(runtime) {
    Object.values(window.AIOneDraftFeatureModules).forEach((install) => install(runtime));
    window.AIOneDraftSource(runtime);
    window.AIOneDraftConversation(runtime);
  },
  bindPage(runtime) {
    window.AIOneDraftWorkspace.bind(runtime);
    const { closeDraftEvidence, closeEditModal, downloadDraft, downloadOriginalFile, el, getEvidenceSentenceText, loadReportDetail, openDraftDownloadConfirm, openDraftEvidence, openEditModal, openRestoreVersionModal, renderCompareWorkspace, saveReportSelectedSources, saveReportVersion, sendChat, setTab, showToast, state, syncComparePanelOrder, syncCompareScroll, syncCompareViewportHeight } = runtime;
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

    el.applyReferencesBtn.addEventListener("click", async () => {
        const selected = state.recommendationItems.filter((item) => state.selectedReferenceKeys.has(item.key));
        const uploadedFileCount = Array.isArray(state.uploadedFiles) ? state.uploadedFiles.length : 0;
        if (!selected.length && !uploadedFileCount) {
            showToast("답변서에 반영할 관련자료를 선택해 주세요.");
            return;
        }
        const selectedDocIds = Array.from(new Set(selected.map((item) => String(item.doc_id || "").trim()).filter(Boolean)));
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
            await sendChat(docIds.length ? "선택한 관련자료를 반영하여 답변서를 생성해 주세요." : "업로드한 파일을 반영하여 답변서를 생성해 주세요.", {
                preserveWorkspace: true,
                docIds: docIds,
            });
        } catch (error) {
            console.error("선택 자료 답변서 반영 실패", error);
        }
    });


    // 답변서 전용 본문·버전 도구의 이벤트를 연결한다.
    el.reportVersionSelect?.addEventListener("change", () => {
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
        openDraftEvidence(marker.dataset.referenceMarker || marker.textContent, getEvidenceSentenceText(marker));
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
    el.reportRestoreBtn?.addEventListener("click", openRestoreVersionModal);
    el.reportEditBtn?.addEventListener("click", openEditModal);
    el.editClose?.addEventListener("click", closeEditModal);
    el.editCancel?.addEventListener("click", closeEditModal);
    el.editSave?.addEventListener("click", saveReportVersion);
    el.draftDownloadBtn?.addEventListener("click", (event) => {
        event.stopPropagation();
        if (el.draftDownloadBtn.disabled) return;
        const open = el.reportDownloadMenu.classList.contains("hidden");
        el.reportDownloadMenu.classList.toggle("hidden", !open);
        el.draftDownloadBtn.setAttribute("aria-expanded", String(open));
    });

    el.reportDownloadMenu?.addEventListener("click", (event) => {
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
        const format = String(runtime.pendingDownloadFormat || "").toLowerCase();
        const version = runtime.pendingDownloadVersion;
        if (!format) {
            showToast("다운로드 형식을 선택해 주세요.");
            return;
        }
        downloadDraft(format, version);
    });

    document.addEventListener("click", (event) => {
        if (el.reportDownloadWrap && !el.reportDownloadWrap.contains(event.target)) {
            el.reportDownloadMenu?.classList.add("hidden");
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

  },
});
