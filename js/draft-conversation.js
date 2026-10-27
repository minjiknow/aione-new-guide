/**
 * AI-ONE 답변서 대화 후처리
 * 적용 화면: ai-answer.html
 * 역할: 생성 진행 탭, 이용 안내, 보고서 메타데이터와 응답 후 버전 조회
 * 연결: 공통 전송은 panel-conversation.js, 보고서 조회는 draft-report.js
 * - 261022 변경 - 공통 전송은 panel-conversation.js에 두고 답변서 상태·탭·생성 후처리만 관리합니다.
 *
 * 기본 구간 형식: Start: 기능명 / End: 기능명
 * 변경 구간 형식: Start: YYMMDD 추가/수정 - 기능명 / End: YYMMDD 추가/수정 - 기능명
 * 주석 정리 내역
 * - 261023 주석 정리 - 구간 표시와 변경 내용 표기를 통일합니다. 기존 작업 날짜와 기능 설명은 유지합니다.
 */

window.AIOneDraftConversation = function (runtime) {
    const { clearCurrentAnswerResult, clearReport, el, isWorkspaceSelectionActive, loadConversationReports, loadReportDetail, loadReportSelectedSources, recommendationLoadingMessage, renderCompareWorkspace, renderRecommendations, renderReport, renderSelectedReferences, scheduleSelectedSourcesSave, showLoading, state } = runtime;
    function setTab(name) {
        document.querySelectorAll("[data-answer-tab]").forEach((tab) => {
            const active = tab.dataset.answerTab === name;
            tab.classList.toggle("active", active);
            tab.classList.toggle("is-active", active);
            tab.setAttribute("aria-selected", String(active));
            tab.tabIndex = active ? 0 : -1;
        });
        document.querySelectorAll("[data-answer-panel]").forEach((panel) => {
            panel.hidden = panel.dataset.answerPanel !== name;
        });
        const switchButton = document.querySelector('[data-panel="center"] .panel-switch-btn');
        if (switchButton) switchButton.hidden = name === "draft";
        if (name === "compare") {
            renderCompareWorkspace().catch((error) => {
                console.error("[답변서 비교] 렌더링 실패", error);
            });
        }
    }

    function getSearchSkeletonTarget(text, preserveWorkspace) {
        if (preserveWorkspace) return "draft";
        // 추천 문구는 명시된 작업 영역을 우선해 전송 직후 해당 탭에서 로딩한다.
        const prompt = Array.from(document.querySelectorAll(".chat-tag[data-answer-loading-target]"))
            .find((button) => (button.dataset.chipValue ?? button.textContent).trim() === text.trim());
        const target = prompt?.dataset.answerLoadingTarget;
        if (target === "draft" || target === "recommend") return target;
        if (/관련\s*자료|유사\s*답변서/.test(text)) return "recommend";
        if (/답변서/.test(text)) return "draft";
        return "all";
    }

    function showSearchSkeleton(message = "AI 응답 데이터를 불러오고 있습니다...", target = "all") {
        hideSearchSkeleton();
        const template = document.getElementById("answerSearchSkeletonTemplate");
        const mount = (container, preview = false) => {
            const overlay = template?.content.firstElementChild?.cloneNode(true);
            if (!container || !overlay) return;
            overlay.classList.add(preview ? "answer-loading-preview" : "answer-loading-list");
            const label = overlay.querySelector(".skeleton-loading-label");
            if (label) label.textContent = preview ? message : recommendationLoadingMessage;
            if (preview) {
                overlay.querySelector(".answer-skeleton-columns")?.remove();
                const title = document.createElement("strong");
                title.textContent = "문서 미리보기를 불러오는 중입니다";
                overlay.prepend(title);
            } else {
                overlay.querySelector(".answer-skeleton-preview")?.remove();
            }
            window.AIOneLoadingOverlay?.mount({ container, overlay });
        };
        if (target === "recommend" || target === "all") {
            mount(el.recommendList);
            mount(el.sourcePreview?.closest(".doc-viewer-body"), true);
        }
        if (target === "draft" || target === "all") {
            mount(document.querySelector('[data-answer-panel="draft"]'), true);
        }
    }

    function hideSearchSkeleton() {
        window.AIOneLoadingOverlay?.remove(".answer-api-skeleton", {
            resolveContainer: (item) => item.parentElement,
        });
    }

    function isNewChatNoticeHiddenForToday() {
        try {
            const hideUntil = Number(window.localStorage.getItem(ANSWER_NOTICE_HIDE_UNTIL_KEY) || 0);
            return Number.isFinite(hideUntil) && hideUntil > Date.now();
        } catch (error) {
            console.warn("[새 채팅 이용 안내] 하루 다시 안 보기 상태 조회 실패", error);
            return false;
        }
    }

    function hideNewChatNoticeForOneDay() {
        try {
            window.localStorage.setItem(ANSWER_NOTICE_HIDE_UNTIL_KEY, String(Date.now() + 24 * 60 * 60 * 1000));
        } catch (error) {
            console.warn("[새 채팅 이용 안내] 하루 다시 안 보기 상태 저장 실패", error);
        }
    }

    function closeNewChatNoticeModal() {
        const modal = document.getElementById("answerNewChatNoticeModal");
        if (!modal) return;
        modal.classList.add("hidden");
        modal.setAttribute("aria-hidden", "true");
    }

    function showNewChatNoticeModal() {
        // 보고서 화면 진입/새 채팅 모두 동일한 안내를 사용하되,
        // 사용자가 '하루 다시 안 보기'를 선택한 경우 24시간 동안 표시하지 않는다.
        if (isNewChatNoticeHiddenForToday()) return;
        const backdrop = document.getElementById("answerNewChatNoticeModal");
        if (!backdrop) {
            console.warn("[새 채팅 이용 안내] JSP 모달 마크업을 찾지 못했습니다.");
            return;
        }
        if (backdrop.dataset.noticeReady !== "true") {
            backdrop.addEventListener("click", (event) => {
                const confirmButton = event.target.closest(".answer-new-chat-notice-confirm");
                const closeButton = event.target.closest(".answer-new-chat-notice-close");
                if (confirmButton) {
                    const hideDay = backdrop.querySelector(".answer-new-chat-notice-hide-day-input");
                    if (hideDay?.checked) hideNewChatNoticeForOneDay();
                    closeNewChatNoticeModal();
                    return;
                }
                if (event.target === backdrop || closeButton) {
                    closeNewChatNoticeModal();
                }
            });
            backdrop.dataset.noticeReady = "true";
        }
        backdrop.classList.remove("hidden");
        backdrop.setAttribute("aria-hidden", "false");
        backdrop.querySelector(".answer-new-chat-notice-confirm")?.focus();
    }

    const ANSWER_NOTICE_HIDE_UNTIL_KEY = "ai_one_answer_notice_hide_until";
    Object.assign(runtime.page, {
        getAssistantText(content, metadata) {
            const kind = String(metadata?.action?.kind || "").trim().toLowerCase();
            if (kind === "report" || kind === "report_edited") {
                return String(metadata.action.notice || "").trim() || (kind === "report_edited" ? "답변서가 수정되었습니다." : "답변서가 생성되었습니다.");
            }
        },
        activateView: setTab,
        getLoadingTarget: getSearchSkeletonTarget,
        showLoading: showSearchSkeleton,
        hideLoading: hideSearchSkeleton,
        updateLoading(text) {
            document.querySelectorAll(".answer-api-skeleton .skeleton-loading-label").forEach((label) => {
                label.textContent = label.closest(".answer-loading-list") ? recommendationLoadingMessage : text;
            });
        },
        showNotice: showNewChatNoticeModal,
        closeNotice: closeNewChatNoticeModal,
        render: renderReport,
        clearResult: clearCurrentAnswerResult,
        onSelectionChanged: scheduleSelectedSourcesSave,
        shouldReplaceSources: (target) => target !== "draft",
        beforeSend: (target) => setTab(target === "draft" ? "draft" : "recommend"),
        getLoadingMessage: (target) => target === "recommend" ? recommendationLoadingMessage : target === "draft" ? "답변서를 작성하고 있습니다..." : "관련자료를 검색하고 답변서를 생성하고 있습니다...",
        reset() {
            state.reportSelectedDocIds.clear();
            state.compareSelectedSourceKey = "";
            state.compareSelectedVersion = 0;
            state.comparePanelsSwapped = false;
            state.compareScrollSync = true;
            clearReport();
        },
        async loadConversation(conversationId, selectionEpoch) {
            await loadConversationReports(conversationId, undefined, undefined, selectionEpoch);
            if (!isWorkspaceSelectionActive(conversationId, selectionEpoch)) return;
            // 이 대화의 최신 응답에 보고서가 없어도 이전 응답에서 복원한
            // 가장 최근 관련자료/유사답변서는 그대로 유지한다.
            await renderCompareWorkspace();
            if (!isWorkspaceSelectionActive(conversationId, selectionEpoch)) return;
            if (state.reportId) {
                const selectedReportId = state.reportId;
                await loadReportSelectedSources(selectedReportId);
                if (!isWorkspaceSelectionActive(conversationId, selectionEpoch)) return;
            }
        },
        receiveMetadata(reportInfo, pageRequest, isRequestActive) {
            console.log("[답변서 SSE report chunk]:", reportInfo);
            const key = String(reportInfo.report_id) + ":" + String(reportInfo.version || "");
            if (key === pageRequest.key) return;
            pageRequest.key = key;
            pageRequest.received = true;
            // 다른 채팅방을 보고 있으면 그 화면의 report 상태를 절대 덮어쓰지 않는다.
            if (isRequestActive()) {
                state.reportId = String(reportInfo.report_id);
                pageRequest.version = Math.max(pageRequest.version || 0, Number(reportInfo.version || 0));
            }

        },
        async completeResponse({ result, conversationId, requestDocIds, skeletonTarget, pageRequest, isRequestActive }) {
            if (!isRequestActive()) return;
            if (result.metadata?.report?.report_id) {
                pageRequest.received = true;
                state.reportId = String(result.metadata.report.report_id);
                await loadReportDetail(state.reportId, Number(result.metadata.report.version || 0) || pageRequest.version);
            } else {
                // SSE report 이벤트로 report_id/version만 받은 경우에는
                // 스트림이 모두 끝난 지금 확정 버전을 정확히 한 번 조회한다.
                if (pageRequest.received && state.reportId) {
                    await loadReportDetail(state.reportId, pageRequest.version);
                } else {
                    // 이번 응답에 새 보고서가 없어도 기존 대화의 최신 보고서를 유지/복원한다.
                    if (!state.reportId) {
                        await loadConversationReports(conversationId);
                    } else if (!state.reportContent) {
                        await loadReportDetail(state.reportId, 0);
                    }
                }
            }
            if (!isRequestActive()) return;
            if (pageRequest.received) {
                if (requestDocIds.length) {
                    // 초안 반영 후에도 선택한 관련자료 상태를 그대로 유지한다.
                    // selectedReferenceKeys / reportSelectedDocIds를 비우지 않는다.
                    renderRecommendations();
                    renderSelectedReferences();
                }
            }
            // 관련자료 요청은 보고서가 함께 반환되어도 추천 탭을 유지한다.
            if (skeletonTarget === "recommend") {
                setTab("recommend");
            } else if (pageRequest.received) {
                setTab("draft");
            } else if (state.recommendationItems.length) {
                setTab("recommend");
            }

        },
    });

};
