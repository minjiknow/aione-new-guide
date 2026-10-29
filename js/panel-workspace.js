/**
 * 261028 누적 변경 요약 (현재 구현 기준)
 * - 패널 순서·너비 저장/복원과 글자 크기·미리보기 확대를 연결합니다. 공통 초기화에 페이지별 저장소를 전달하고 업무지원의 가변 패널을 구분합니다.
 *
 * AI-ONE 공통 패널 배치·보조도구
 * 적용 화면: ai-answer.html, work-support.html
 * 역할: 패널 이동·너비 복원, 글자 크기, 미리보기 확대
 * 연결: common.js의 레이아웃 컨트롤러. 화면별 배치 저장 키는 진입점에서 전달
 * - 261022 정리 - 공통 패널과 화면 전용 기능의 관리 범위를 분리합니다.
 *
 * 261026 변경 요약
 * - 수정 - 레이아웃 초기화 버튼의 개별 이벤트·복원 구현을 제거하고 공통 처리에 기본 배치·저장소만 연결
 * - 주석 보완 - 화면별 가변 패널 선택, 패널 배치·너비 저장 및 초기화 시 접힘 상태 해제 처리 기록
 *
 * 기본 구간 형식: Start: 기능명 / End: 기능명
 * 변경 구간 형식: Start: YYMMDD 추가/수정 - 기능명 / End: YYMMDD 추가/수정 - 기능명
 * 주석 정리 내역
 * - 261023 주석 정리 - 구간 표시와 변경 내용 표기를 통일합니다. 기존 작업 날짜와 기능 설명은 유지합니다.
 */

(function registerpanel_workspaceModule(window) {
    window.AIOnePanelFeatureModules = window.AIOnePanelFeatureModules || {};
    window.AIOnePanelFeatureModules["panel-workspace.js"] = function install(runtime) {
        with (runtime) {
            /* Start: 261026 수정 - 화면별 리사이징 가변 패널 선택 */
            // 업무지원만 chat을 유연한 패널로 사용한다. 답변서 초안은 center를 유지한다.
            const flexiblePanelKey = document.querySelector('.three-panel [data-panel="result"]') ? "chat" : "center";
            /* End: 261026 수정 - 화면별 리사이징 가변 패널 선택 */
            // showToast: 대상 UI를 표시.
            function showToast(msg) {
                workspaceCommon.showToast(msg, {
                    fallback: typeof window.AIOneCommon?.showToast === "function" ? (message) => window.AIOneCommon.showToast(message) : null,
                });
            }

            // isConversationPending: 조건 충족 여부를 판별.
            function isConversationPending(conversationId) {
                return conversationId ? pendingConversationIds.has(String(conversationId)) : pendingNewWorkspaceEpochs.has(workspaceEpoch);
            }

            // syncBusyForActiveConversation: 관련 상태와 화면을 동기화.
            function syncBusyForActiveConversation() {
                setBusy(isConversationPending(state.conversationId));
            }

            // 대화 ID와 선택 시점이 여전히 같을 때만 비동기 조회 결과를 현재 화면에 반영한다.
            function isWorkspaceSelectionActive(conversationId, selectionEpoch) {
                return String(state.conversationId || "") === String(conversationId || "") && (selectionEpoch == null || workspaceEpoch === selectionEpoch);
            }

            /* Start: 261026 수정 - 패널 배치·너비 복원 및 리사이징 상태 저장 */
            // 참조소스 폭에 설정 배율을 적용하고 차이는 중앙 패널에서 조정한다. 배율 1이면 확대하지 않는다.
            function getScaledAnswerDefaultPanelLayout(state) {
                if (!state?.widthsByPanel || !Array.isArray(state.order)) return state;
                const scaledState = {
                    order: [...state.order],
                    widthsByPanel: { ...state.widthsByPanel },
                };
                const sourceWidth = Number(scaledState.widthsByPanel.folder);
                if (!Number.isFinite(sourceWidth) || sourceWidth <= 0) return scaledState;
                const scaledSourceWidth = Math.round(sourceWidth * ANSWER_SOURCE_PANEL_WIDTH_SCALE);
                const increasedWidth = scaledSourceWidth - sourceWidth;
                scaledState.widthsByPanel.folder = scaledSourceWidth;
                // 전체 화면 폭은 그대로 두고 늘어난 만큼 중앙 패널에서 차감한다.
                if (Number.isFinite(Number(scaledState.widthsByPanel[flexiblePanelKey]))) {
                    scaledState.widthsByPanel[flexiblePanelKey] = Math.max(180, Math.round(Number(scaledState.widthsByPanel[flexiblePanelKey]) - increasedWidth));
                }
                return scaledState;
            }

            // 패널 DOM 순서와 패널별 폭을 복원하고, 접힌 참조소스의 펼침용 그리드 순서도 맞춘다.
            function applyAnswerPanelLayout(container, state) {
                window.AIOneWorkspaceUi.applyPanelLayout(container, state, { flexibleKey: flexiblePanelKey });
            }

            // resetAnswerPanelLayout: 상태 또는 화면을 기본값으로 초기화.
            function resetAnswerPanelLayout(container) {
                window.AIOneWorkspaceUi.resetPanelLayout(container);
            }

            // initAnswerPanelDragDrop: 기능을 초기화하고 필요한 이벤트를 연결.
            function initAnswerPanelDragDrop() {
                const container = document.querySelector(".three-panel");
                if (!container || container.dataset.answerPanelDragReady === "true") return;

                answerDefaultPanelLayout = getScaledAnswerDefaultPanelLayout(answerPanelLayoutController.getState(container));
                window.AIOneWorkspaceUi.configurePanelLayout(container, {
                    getDefaultState: () => answerDefaultPanelLayout,
                    flexibleKey: flexiblePanelKey,
                    clearSaved: () => answerPanelLayoutController.clear(),
                });
                applyAnswerPanelLayout(container, answerDefaultPanelLayout);
                answerPanelLayoutController.restore(container);

                window.AIOneWorkspaceUi.initPanelDragDrop({
                    container,
                    readyKey: "answerPanelDragReady",
                    includeSlot: true,
                    getState: () => answerPanelLayoutController.getState(container),
                    applyState: (state) => applyAnswerPanelLayout(container, state),
                    saveState: () => answerPanelLayoutController.save(container),
                    onChanged: () => showToast("패널 위치가 변경되었습니다."),
                });

                container.addEventListener("split-handler:resize", () => {
                    answerPanelLayoutController.scheduleSave(container, 120);
                });
                ["pointerup", "mouseup", "touchend"].forEach((eventName) => {
                    container.addEventListener(
                        eventName,
                        () => {
                            answerPanelLayoutController.scheduleSave(container, 120);
                        },
                        true,
                    );
                });

                const panelOrderObserver = new MutationObserver((mutations) => {
                    if (mutations.some((mutation) => mutation.type === "childList")) {
                        answerPanelLayoutController.scheduleSave(container, 120);
                    }
                });
                panelOrderObserver.observe(container, { childList: true });

                window.addEventListener("pagehide", () => answerPanelLayoutController.save(container));
                document.addEventListener("visibilitychange", () => {
                    if (document.visibilityState === "hidden") answerPanelLayoutController.save(container);
                });
            }

            /* End: 261026 수정 - 패널 배치·너비 복원 및 리사이징 상태 저장 */
            // initAnswerAccessoryTools: 기능을 초기화하고 필요한 이벤트를 연결.
            function initAnswerAccessoryTools() {
                window.AIOneWorkspaceUi.initAccessoryController({
                    readyKey: "answerAccessoryReady",
                    font: {
                        cookieKey: ANSWER_UI_FONT_COOKIE,
                        cookieMaxAge: ANSWER_UI_COOKIE_MAX_AGE,
                        min: 100,
                        max: 150,
                        step: 10,
                        defaultValue: 100,
                    },
                    container: () => document.querySelector(".three-panel"),
                    focusFirstHandle: false,
                    onPanelResizeModeChange: (enabled) => {
                        showToast(enabled ? "패널 경계선을 드래그해 크기를 조절하세요." : "패널 크기 조절 모드를 종료했습니다.");
                    },
                    onFullscreenError: () => {
                        showToast("브라우저에서 전체화면을 허용하지 않았습니다.");
                    },
                });
            }

            // applyRecommendZoom: 계산/저장된 상태를 화면에 반영.
            function applyRecommendZoom() {
                if (el.recommendZoomPercent) el.recommendZoomPercent.textContent = state.recommendZoom + "%";
                if (state.recommendPdf) renderRecommendPdfPages(state.recommendPdf);
            }

            Object.assign(runtime, {
                showToast,
                isConversationPending,
                syncBusyForActiveConversation,
                isWorkspaceSelectionActive,
                getScaledAnswerDefaultPanelLayout,
                applyAnswerPanelLayout,
                resetAnswerPanelLayout,
                initAnswerPanelDragDrop,
                initAnswerAccessoryTools,
                applyRecommendZoom,
            });
        }
    };
})(window);
