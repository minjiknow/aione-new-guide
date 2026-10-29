/**
 * 261028 누적 변경 요약 (현재 구현 기준)
 * - 질의 목록·상세·수동 룰 근거와 제외/복원을 처리합니다. 편집 검증·변경 여부 판단 및 저장/AI 재분류 확인을 연결합니다.
 *
 * AI-ONE 질의분류 질의 편집
 * 최근 변경 내용
 * - 261023 추가 - 질의별 수동 룰 매칭 근거
 * - 261023 추가 - 수동 룰 매칭 근거 펼침·접힘
 * - 261023 수정 - 상세·목록 공통 질의 제외 및 복구
 *
 * 261026 변경 요약
 * - 수정 - 변경 없음은 수정 팝업을 닫고 토스트만 표시하며 소관·실국 변경 때만 확인 팝업 추가 안내 표시
 * - 수정 - 복수소관 선택 검증 및 수정 저장·AI 재분류 확인 분기
 * - 수정 - 질의 카드의 수정됨 배지·수정자 툴팁 생성 및 배지 이벤트 제거 (수정 이력 데이터 유지)
 *
 * 기본 구간 형식: Start: 기능명 / End: 기능명
 * 변경 구간 형식: Start: YYMMDD 추가/수정 - 기능명 / End: YYMMDD 추가/수정 - 기능명
 * 주석 정리 내역
 * - 261023 주석 정리 - 파일 안내와 구간·변경 내용 작성 형식을 통일합니다.
 * - 261023 수정 - 질의 필터 결과·초기 빈 화면을 공통 형식으로 표시
 */
(function registerclassification_queryModule(window) {
    window.AIOneClassificationFeatureModules = window.AIOneClassificationFeatureModules || {};
    window.AIOneClassificationFeatureModules["classification-query.js"] = function install(runtime) {
        with (runtime) {
            // 질의 목록의 빈 화면은 아이콘과 제목, 설명에 작은 크기 스타일을 적용한다.
            function createQueryListEmpty(title, description) {
                const empty = window.AIOneWorkspaceCommon.createFilterEmpty(title, description);
                empty.querySelector(".no-file-icon").classList.add("type1");
                empty.querySelector(".empty-title").classList.add("type1");
                empty.querySelector(".empty-desc").classList.add("type1");
                return empty;
            }

            function setMappedQueryCard(targetCard) {
                if (!targetCard || !queryList) return;
                $$(".query-card", queryList).forEach((card) => {
                    card.classList.remove("mapped");
                    card.style.removeProperty("border-color");
                    card.style.removeProperty("box-shadow");
                });
                targetCard.classList.add("mapped");
                targetCard.style.setProperty("border-color", "var(--primary, #156edd)", "important");
                targetCard.style.setProperty("box-shadow", "0 0 0 2px rgba(var(--primary-rgb, 21, 110, 221), 0.14)", "important");
            }

            function getQuerySummary(query) {
                return String(query?.summary || query?.text || "");
            }

            function getRecommendOffice(query) {
                const predicted = query?.predictedDepartment ?? query?.raw?.predicted_department ?? query?.raw?.predictedDepartment ?? null;
                const predictedName = predicted ? resolveActualDepartmentName(predicted) : "";
                return predictedName || query?.mainDept || "해당없음";
            }

            function getAIReason(query) {
                return String(query?.reason ?? query?.raw?.prediction_reason ?? query?.raw?.predictionReason ?? query?.raw?.classification_reason ?? query?.raw?.classificationReason ?? query?.raw?.reason ?? "");
            }

            // 수정 이력도 공통 data-tooltip 표시기를 사용한다.
            function ensureQueryModifiedTooltip() {
                window.AIOneTooltip?.init();
                return document.getElementById("aiOneTooltip");
            }

            function showQueryModifiedTooltip(target) {
                window.AIOneTooltip?.show(target, { placement: "bottom" });
            }

            function hideQueryModifiedTooltip() {
                window.AIOneTooltip?.hide();
            }

            // Start: 261023 추가 - 질의별 수동 룰 매칭 근거
            function renderQueryRuleMatches(query) {
                const matches = query.raw?.rule_matches;
                if (!Array.isArray(matches) || !matches.length) return "";
                const aiDepartment = getRecommendOffice(query);
                const hasConflict = matches.some((rule) => rule.department?.name !== aiDepartment);
                const representative = matches.find((rule) => rule.is_representative);
                const panelId = `query-rule-matches-${query.id}`;
                return `
                    <section class="query-rule-summary" aria-label="수동 룰 매칭 근거">
                      <div class="query-rule-heading">
                        <strong>수동 룰 ${matches.length}건 매칭</strong>
                        ${hasConflict ? '<span class="query-rule-review">추천 결과 확인 필요</span>' : ""}
                      </div>
                      <p class="query-rule-description">${
                          hasConflict ? `AI 추천 ${escapeHtml(aiDepartment)}과 다른 룰 결과 국·실이 함께 매칭되었습니다. 모든 근거를 확인해 주세요.` : `AI 추천 ${escapeHtml(aiDepartment)}과 수동 룰 결과가 동일합니다.`
                      }</p>
                      ${representative ? `<p class="query-rule-meta">대표 근거: ${escapeHtml(representative.name)} · 매칭 키워드: ${escapeHtml((representative.matched_keywords || []).join(", "))}</p>` : ""}
                      <div class="query-rule-disclosure">
                        <button type="button" class="query-rule-toggle" aria-expanded="false" aria-controls="${panelId}">
                          <span class="query-rule-chevron" aria-hidden="true">›</span>
                          <span data-rule-toggle-label>매칭 룰 ${matches.length}건 보기</span>
                        </button>
                        <span class="query-rule-meta">대표 표시는 적용 우선순위가 아닙니다.</span>
                      </div>
                      <ol class="query-rule-matches" id="${panelId}" hidden>
                        ${matches
                            .map((rule, index) => {
                                const sameDepartment = rule.department?.name === aiDepartment;
                                return `<li class="query-rule-match${rule.is_representative ? " is-representative" : ""}">
                              <span class="query-rule-number">${index + 1}</span>
                              <div class="query-rule-content">
                                <div class="query-rule-match-heading">
                                  <strong>${escapeHtml(rule.name)}</strong>
                                  <span class="query-rule-badge is-department">${escapeHtml(rule.department?.name || "미지정")}</span>
                                  <span class="query-rule-badge ${sameDepartment ? "is-same" : "is-different"}">${sameDepartment ? "AI 추천과 동일" : "다른 실국"}</span>
                                  ${rule.is_representative ? '<span class="query-rule-representative">대표 표시</span>' : ""}
                                </div>
                                <p class="query-rule-meta"><span class="query-rule-badge">${rule.match_mode === "all" ? "모두 포함" : "일부 포함"}</span> ${escapeHtml(rule.description || "")}</p>
                                <p class="query-rule-meta">매칭 키워드: ${escapeHtml((rule.matched_keywords || []).join(", "))}${rule.exclude_keywords?.length ? ` · 제외 키워드: ${escapeHtml(rule.exclude_keywords.join(", "))}` : ""}</p>
                              </div>
                            </li>`;
                            })
                            .join("")}
                      </ol>
                    </section>`;
            }
            // End: 261023 추가 - 질의별 수동 룰 매칭 근거

            // 두 제외 버튼은 같은 API와 화면 갱신 흐름을 사용한다.
            const excludingQuestionIds = new Set();
            async function excludeQuestion(q) {
                if (!q?.questionId) {
                    showToast("제외할 question_id가 없습니다.");
                    return;
                }
                const key = String(q.questionId);
                if (q.isDeleted || excludingQuestionIds.has(key)) return;
                excludingQuestionIds.add(key);
                try {
                    await deleteActualQuestion(q.questionId);
                    q.isDeleted = true;
                    q.deletedAt = new Date().toISOString();
                    const activeFile = uploadedFiles[activeFileIndex];
                    if (activeFile) {
                        const data = fileDataMap[activeFile.name];
                        if (Array.isArray(data?.queries)) {
                            const cached = data.queries.find((item) => String(item.questionId) === String(q.questionId));
                            if (cached) {
                                cached.isDeleted = true;
                                cached.deletedAt = q.deletedAt;
                            }
                        }
                    }
                    const activeQueries = questions.filter((item) => !item.isDeleted);
                    if (activeFile) {
                        activeFile.queryCount = activeQueries.length;
                    }
                    activeQueryIndex = activeQueries.length ? Math.min(activeQueryIndex, activeQueries.length - 1) : 0;
                    renderQueryList();
                    renderQueryDetailPanel(activeQueries);
                    renderFileList();
                    if (activeFile) {
                        const data = fileDataMap[activeFile.name] || {};
                        await renderActualDocument(activeFile, data.docText || lastDocText || "");
                    }
                    showToast("질의가 제외되었습니다.");
                } catch (error) {
                    console.error("질의 제외 실패", error);
                    showToast(error.message || "질의 제외에 실패했습니다.");
                } finally {
                    excludingQuestionIds.delete(key);
                }
            }

            function renderQueryList() {
                let deletedFilterBtn = $('.filter-btn[data-filter="deleted"]');
                if (!deletedFilterBtn) {
                    const filterBar = $(".query-filter-bar");
                    if (filterBar) {
                        filterBar.insertAdjacentHTML(
                            "beforeend",
                            `
                      <button
                        type="button"
                        class="filter-btn filter-btn-excluded"
                        data-filter="deleted"
                        aria-pressed="false"
                      >
                        복구
                        <span
                          class="badge filter-count"
                          id="filterCountDeleted"
                        >0</span>
                      </button>
                    `,
                        );
                        deletedFilterBtn = $('.filter-btn[data-filter="deleted"]');
                    }
                }
                const activeQuestions = questions.filter((q) => !q.isDeleted);
                const deletedQuestions = questions.filter((q) => q.isDeleted);
                let filtered = currentFilter === "deleted" ? deletedQuestions : currentFilter === "all" ? questions.slice() : activeQuestions.filter((q) => q.type === currentFilter);
                const countAll = $("#filterCountAll");
                const countSingle = $("#filterCountSingle");
                const countMulti = $("#filterCountMulti");
                const countNone = $("#filterCountNone");
                const countDeleted = $("#filterCountDeleted");
                if (countAll) {
                    // "전체"는 제외된 질의까지 포함한 전체 건수.
                    countAll.textContent = questions.length;
                }
                if (countSingle) {
                    countSingle.textContent = activeQuestions.filter((q) => q.type === "single").length;
                }
                if (countMulti) {
                    countMulti.textContent = activeQuestions.filter((q) => q.type === "multi").length;
                }
                if (countNone) {
                    countNone.textContent = activeQuestions.filter((q) => q.type === "none").length;
                }
                if (countDeleted) {
                    countDeleted.textContent = deletedQuestions.length;
                }
                queryList.innerHTML = filtered
                    .map((q) => {
                        const reason = getAIReason(q);
                        const needsReview = q.confidence < 80;
                        // Start: 261026 수정 - 수정 이력은 데이터로만 유지
                        // 수정됨 배지와 수정자 툴팁용 표시 문자열은 생성하지 않는다.
                        // End: 261026 수정 - 수정 이력은 데이터로만 유지
                        const confidence = Math.max(0, Math.min(100, Number(q.confidence || 0)));
                        const confidenceClass = confidence >= 90 ? "is-high" : confidence >= 75 ? "is-medium" : "is-low";
                        const statusBadge = q.isDeleted
                            ? ""
                            : q.isSubmitted
                              ? `
                            <span
                              class="status-badge green"
                   
                            >
                            ✓ 제출완료
                            </span>
                          `
                              : needsReview
                                ? `
                              <span
                                class="status-badge red"
                      
                              >
                                ! 검토필요
                              </span>
                            `
                                : "";
                        const typeClass = q.isDeleted ? "excluded" : q.type;
                        const typeLabel = q.isDeleted ? "제외됨" : q.typeLabel;
                        return `
                      <article
                        class="query-card${needsReview && !q.isDeleted ? " needs-review" : ""}${q.isDeleted ? " excluded is-deleted" : ""}"
                        tabindex="0"
                        data-qid="${q.id}"
                      data-question-key="${escapeHtml(getQuestionStableKey(q))}"
                        data-type="${escapeHtml(q.type)}"
                        data-scope="${escapeHtml(q.type)}"
                        data-excluded="${q.isDeleted ? "true" : "false"}"
                        aria-label="질의 Q${q.questionOrder ?? q.id}: ${escapeHtml(q.text)}"
                      >
                        <div class="query-card-head">
                          <span class="query-num ${escapeHtml(q.type)}">
                            Q${q.questionOrder ?? q.id}
                          </span>
                          ${statusBadge}
                          <span
                            class="status-badge type1 ${escapeHtml(typeClass)}"
                            data-query-type
                          >
                            ${escapeHtml(typeLabel)}
                          </span>
                        </div>
                        <p class="query-text">
                          ${escapeHtml(q.text)}
                        </p>
                        <div class="query-dept">
                          <span class="rec-tag dept-tag main">
                            주관: ${escapeHtml(q.mainDept)}
                          </span>
                          ${
                              q.coopDept
                                  ? `
                                <span class="rec-tag dept-tag">
                                  협조: ${escapeHtml(q.coopDept)}
                                </span>
                              `
                                  : ""
                          }
                          ${
                              q.type === "none" && q.org
                                  ? `
                                <span class="rec-tag dept-tag">
                                  비소관: ${escapeHtml(q.org)}
                                </span>
                              `
                                  : ""
                          }
                        </div>
                        <div class="query-ai-reason">
                          <div class="ai-reason-head">
                            <span
                              class="ai-reason-icon"
                              aria-hidden="true"
                            >
                              <svg viewBox="0 0 24 24">
                                <path d="M12 3l1.35 4.15L17.5 8.5l-4.15 1.35L12 14l-1.35-4.15L6.5 8.5l4.15-1.35L12 3z"></path>
                                <path d="M18.5 13.5l.75 2.25 2.25.75-2.25.75-.75 2.25-.75-2.25-2.25-.75 2.25-.75.75-2.25z"></path>
                              </svg>
                            </span>
                            <strong class="ai-reason-label">
                              AI 분류 근거
                            </strong>
                          </div>
                          <p class="ai-reason-text">
                            ${escapeHtml(reason)}
                          </p>
                        </div>
                        ${renderQueryRuleMatches(q)}
                        <div class="progressbar-row query-confidence-bar">
                          <span class="progressbar-label confidence-label">
                            신뢰도
                          </span>
                          <div
                            class="progressbar confidence-bar-wrap ${confidenceClass}"
                            role="progressbar"
                            aria-label="신뢰도 ${confidence}%"
                            aria-valuemin="0"
                            aria-valuemax="100"
                            aria-valuenow="${confidence}"
                            style="--progressbar-value:${confidence}%;"
                          >
                            <div class="progressbar-fill confidence-bar-fill"></div>
                          </div>
                          <span class="progressbar-value confidence-value">
                            ${confidence}%
                          </span>
                        </div>
                        <div class="query-card-foot">
                          <!-- Start: 261026 수정 - 수정됨 배지 미생성 -->
                          <div class="query-card-foot-left"></div>
                          <!-- End: 261026 수정 - 수정됨 배지 미생성 -->
                          <div class="query-card-foot-actions">
                            ${
                                q.isDeleted
                                    ? `
                                  <button
                                    type="button"
                                    class="button button-outline button-sm query-edit-btn query-restore-action"
                                    data-qid="${q.id}"
                      data-question-key="${escapeHtml(getQuestionStableKey(q))}"
                                  >
                                    복구
                                  </button>
                                `
                                    : q.isSubmitted
                                      ? ""
                                      : `
                                    <button
                                      type="button"
                                      class="query-exclude-btn query-delete-action"
                                      data-qid="${q.id}"
                      data-question-key="${escapeHtml(getQuestionStableKey(q))}"
                                    >
                                      제외
                                    </button>
                                    <button
                                      type="button"
                                      class="button button-outline button-sm query-edit-btn query-edit-action"
                                      data-qid="${q.id}"
                      data-question-key="${escapeHtml(getQuestionStableKey(q))}"
                                    >
                                      수정
                                    </button>
                                  `
                            }
                          </div>
                        </div>
                      </article>
                    `;
                    })
                    .join("");
                if (!filtered.length) {
                    /* Start: 261023 수정 - 필터 빈 화면 공통 형식 */
                    queryList.replaceChildren(createQueryListEmpty("검색된 질의가 없습니다", "현재 필터 조건에 맞는 질의가 없습니다. \n 필터 조건을 변경하여 다시 확인해 보세요."));
                    /* End: 261023 수정 - 필터 빈 화면 공통 형식 */
                }
                /* Start: 261023 추가 - 수동 룰 매칭 근거 펼침·접힘 */
                $$(".query-rule-toggle", queryList).forEach((button) => {
                    button.addEventListener("click", () => {
                        const panel = document.getElementById(button.getAttribute("aria-controls"));
                        const expanded = button.getAttribute("aria-expanded") !== "true";
                        button.setAttribute("aria-expanded", String(expanded));
                        panel.hidden = !expanded;
                        button.querySelector("[data-rule-toggle-label]").textContent = `매칭 룰 ${panel.children.length}건 ${expanded ? "접기" : "보기"}`;
                    });
                });
                /* End: 261023 추가 - 수동 룰 매칭 근거 펼침·접힘 */
                $$(".query-edit-action", queryList).forEach((btn) => {
                    btn.addEventListener("click", (event) => {
                        event.stopPropagation();
                        openEditModal(btn.dataset.qid);
                    });
                });
                $$(".query-delete-action", queryList).forEach((btn) => {
                    btn.addEventListener("click", (event) => {
                        event.stopPropagation();
                        const q = questions.find((item) => String(item.id) === btn.dataset.qid);
                        excludeQuestion(q);
                    });
                });
                $$(".query-restore-action", queryList).forEach((btn) => {
                    btn.addEventListener("click", async (event) => {
                        event.stopPropagation();
                        const q = questions.find((item) => Number(item.id) === Number(btn.dataset.qid));
                        if (!q?.questionId) return;
                        try {
                            const questionId = String(q.questionId);
                            await restoreActualQuestion(questionId);
                            const activeFile = uploadedFiles[activeFileIndex];
                            if (activeFile?.documentId) {
                                await loadActualQuestions(activeFile.documentId, activeFile.jobId, activeFileIndex, Number(activeFile.queryCount || 0));
                            } else {
                                q.isDeleted = false;
                                q.deletedAt = null;
                                const cached = fileDataMap[activeFile?.name]?.queries?.find((item) => String(item.questionId) === questionId);
                                if (cached) {
                                    cached.isDeleted = false;
                                    cached.deletedAt = null;
                                }
                            }
                            const activeQueries = questions.filter((item) => !item.isDeleted);
                            const restoredIndex = activeQueries.findIndex((item) => String(item.questionId) === questionId);
                            activeQueryIndex = restoredIndex >= 0 ? restoredIndex : Math.min(Math.max(0, Number(activeQueryIndex || 0)), Math.max(0, activeQueries.length - 1));
                            currentFilter = "all";
                            $$(".filter-btn").forEach((item) => item.classList.toggle("active", item.dataset.filter === "all"));
                            if (activeFile) {
                                activeFile.queryCount = activeQueries.length;
                            }
                            renderQueryList();
                            renderQueryDetailPanel(activeQueries);
                            renderFileList();
                            if (activeFile) {
                                const data = fileDataMap[activeFile.name] || {};
                                await renderActualDocument(activeFile, data.docText || lastDocText || "");
                            }
                            const restoredBox = $(`.orig-query-box[data-qidx="${activeQueryIndex}"]`, $("#docOriginal"));
                            if (restoredBox) {
                                restoredBox.scrollIntoView({
                                    behavior: "smooth",
                                    block: "center",
                                    inline: "nearest",
                                });
                            }
                            showToast(`Q${getActiveDisplayNumber(q) ?? q.id} 질의가 원래 위치에 복구되었습니다.`);
                        } catch (error) {
                            console.error("질의 복구 실패", error);
                            showToast(error.message || "질의 복구에 실패했습니다.");
                        }
                    });
                });
                // Start: 261026 수정 - 수정됨 배지 전용 이벤트 제거
                // 배지를 생성하지 않으므로 hover·focus 툴팁 이벤트도 연결하지 않는다.
                // End: 261026 수정 - 수정됨 배지 전용 이벤트 제거
                $$(".query-card", queryList).forEach((card) => {
                    card.addEventListener("click", (event) => {
                        if (event.target.closest("button")) return;
                        const targetKey = String(card.dataset.questionKey || "");
                        const targetId = Number(card.dataset.qid);
                        const idx = questions.findIndex((q) => (targetKey ? getQuestionStableKey(q) === targetKey : Number(q.id) === targetId));
                        if (idx < 0) return;
                        activeQueryIndex = idx;
                        setMappedQueryCard(card);
                        renderQueryDetailPanel(questions);
                        /*
                         * 질의목록 → 질의요지서 양방향 동기화.
                         * data-qidx는 buildOriginalPages()에 전달되는 questions 전체 기준이다.
                         * 따라서 제외 질의가 중간에 있어도 원래 위치와 연결된다.
                         */
                        const selectedQuery = questions[idx];
                        if (typeof focusActualQuestionInOriginal === "function" && focusActualQuestionInOriginal(selectedQuery)) {
                            return;
                        }

                        const original = $("#docOriginal");
                        const box = $(`.orig-query-box[data-qidx="${idx}"]`, original);
                        if (box) {
                            $$(".orig-query-box", original).forEach((item) => item.classList.toggle("active", item === box));
                            box.scrollIntoView({
                                behavior: "smooth",
                                block: "center",
                                inline: "nearest",
                            });
                            box.classList.remove("source-link-focus");
                            void box.offsetWidth;
                            box.classList.add("source-link-focus");
                            window.setTimeout(() => box.classList.remove("source-link-focus"), 1400);
                        }
                    });
                });
            }

            function handleFilterChange(filter) {
                currentFilter = String(filter || "all");
                renderQueryList();
            }

            function updateStepper(activeStep) {
                $$(".step").forEach((step) => {
                    const s = parseInt(step.dataset.step);
                    step.classList.remove("active", "done");
                    if (s < activeStep) step.classList.add("done");
                    else if (s === activeStep) step.classList.add("active");
                });
            }

            function escapeHtml(value) {
                return workspaceCommon.escapeHtml(value);
            }

            function closeEditModal() {
                window.AIOneModal?.close(editModal);
                editingQuery = null;
            }

            function stopResetInteraction(event) {
                if (event) {
                    event.preventDefault();
                    event.stopPropagation();
                }
                clearPanelInteractionState();
            }

            function resetAll(options = {}) {
                const { full = false, showMessage = true, resetWorkspaceMeta = false } = options;
                uploadedFiles = [];
                questions.length = 0;
                activeFileIndex = 0;
                activeQueryIndex = 0;
                currentFilter = "all";
                editingQuery = null;
                lastDocText = "";
                const fileInput = $("#fileInput");
                if (fileInput) fileInput.value = "";
                if (resetWorkspaceMeta) resetWorkspaceMetaToDefault();
                renderFileList();
                const docOriginal = $("#docOriginal");
                if (docOriginal) {
                    docOriginal.innerHTML = `<div class="report-empty-state">
            <div class="no-file-icon" aria-hidden="true"><img src="../assets/icons/no-file.svg" alt=""></div>
            <strong class="empty-title">원본 문서가 없습니다</strong>
            <span class="empty-desc">질의 파일을 업로드하면 원본 문서가 표시됩니다.</span>
            <span class="empty-desc">업로드한 문서를 선택하면 상세 내용을 확인할 수 있습니다.</span>
            </div>`;
                }
                docContent.innerHTML = `<div class="report-empty-state">
            <div class="no-file-icon" aria-hidden="true"><img src="../assets/icons/no-file.svg" alt=""></div>
            <strong class="empty-title">질의 추출 결과가 없습니다</strong>
            <span class="empty-desc">질의 파일을 업로드하면 추출된 질의가 표시됩니다.</span>
            <span class="empty-desc">분석이 완료되면 질의별 상세 내용을 확인할 수 있습니다.</span>
            </div>`;
                /* Start: 261023 수정 - 필터 빈 화면 공통 형식 */
                queryList.replaceChildren(createQueryListEmpty("분류된 질의가 없습니다", "질의 파일을 업로드하면 분류 결과가 표시됩니다. AI 추천 실국과 분류 상태를 확인할 수 있습니다."));
                /* End: 261023 수정 - 필터 빈 화면 공통 형식 */
                const statExtracted = $("#statExtracted");
                if (statExtracted) statExtracted.textContent = "0";
                ["filterCountAll", "filterCountSingle", "filterCountMulti", "filterCountNone"].forEach((id) => {
                    const el = $("#" + id);
                    if (el) el.textContent = "0";
                });
                $('.filter-btn[data-filter="all"]')?.click();
                const fileName = $("#activeFileName");
                if (fileName) fileName.textContent = "파일을 선택하세요";
                updateDocStatusBar("");
                if (full) {
                    window.AIOneDocumentStatusBar?.setZoom("#docPanelStatusBar", 100);
                    updateDocStatusBar("");
                    Object.keys(fileConfirmState).forEach((key) => delete fileConfirmState[key]);
                    updateConfirmBtnUI();
                    window.AIOneDocumentStatusBar?.toggleFullscreen("#docPanelStatusBar", false);
                    window.AIOneSidePop?.close("#runDrawer");
                    window.AIOneSidePop?.close("#workspaceRuleSettingsSidepop");
                    window.AIOneSidePop?.close("#notificationAssigneeDrawer");
                }
                clearPanelInteractionState();
                if (showMessage) {
                    showToast(full ? "전체 초기화되었습니다." : "질의 업로드 패널이 초기화되었습니다.");
                }
            }

            function getActiveConfirmKey() {
                const activeFile = uploadedFiles[activeFileIndex];
                return activeFile?.name || `session-${activeSessionId || "current"}`;
            }

            function createConfirmedQuerySnapshot() {
                return questions.map((query, index) => ({
                    id: query.id,
                    number: index + 1,
                    text: query.text,
                    summary: query.summary || query.text,
                    type: query.type,
                    typeLabel: query.typeLabel,
                    mainDept: splitNotificationDepartments(query.mainDept).join(", "),
                    coopDept: splitNotificationDepartments(query.coopDept).join(", "),
                }));
            }

            function syncActiveSubmittedConfirmState() {
                const activeFile = uploadedFiles[activeFileIndex];
                if (!activeFile) return "confirm";
                const fileKey = getActiveConfirmKey();
                const currentState = fileConfirmState[fileKey];
                /*
                 * 서버 질의 응답의 is_submitted가 모두 true이면
                 * 새로고침/과거 대화 재진입 후에도 "확정"으로 되돌아가지 않는다.
                 *
                 * 알림전송완료(done)는 현재 화면 세션 상태를 우선 유지하고,
                 * 그 외 제출완료 문서는 notify 상태로 복구한다.
                 */
                if (activeFile.isSubmitted) {
                    if (currentState !== "done") {
                        fileConfirmState[fileKey] = "notify";
                    }
                    if (!confirmedQuerySnapshots[fileKey]?.length) {
                        confirmedQuerySnapshots[fileKey] = createConfirmedQuerySnapshot();
                    }
                    return fileConfirmState[fileKey];
                }
                if (currentState === "notify") {
                    fileConfirmState[fileKey] = "confirm";
                    delete confirmedQuerySnapshots[fileKey];
                }
                return fileConfirmState[fileKey] || "confirm";
            }

            function handleConfirmBtn() {
                const btn = $("#confirmBtn");
                if (!btn) return;
                const fileKey = getActiveConfirmKey();
                const activeFile = uploadedFiles[activeFileIndex];
                const state = syncActiveSubmittedConfirmState();
                if (!activeFile?.documentId) {
                    showToast("제출할 문서를 먼저 선택해 주세요.");
                    return;
                }
                if (state === "confirm") {
                    customConfirm("질의 확정", "현재 질의 및 담당/협조실국을 서버에 제출하시겠습니까?", async () => {
                        try {
                            btn.disabled = true;
                            btn.textContent = "제출중...";
                            // v1.4 §13 실제 제출 API
                            await submitActualDocument(activeFile.documentId);
                            const snapshot = createConfirmedQuerySnapshot();
                            confirmedQuerySnapshots[fileKey] = snapshot;
                            fileConfirmState[fileKey] = "notify";
                            activeFile.isSubmitted = true;
                            questions.forEach((q) => {
                                if (!q.isDeleted) q.isSubmitted = true;
                            });
                            updateConfirmBtnUI();
                            updateNotificationAssigneeButton();
                            renderQueryList();
                            const routing = getNotificationRoutingForQueries(snapshot);
                            showToast(`질의 ${snapshot.length}건이 서버에 제출되었습니다. 배정 실국 ${routing.departments.length}개입니다.`);
                        } catch (error) {
                            console.error("분류 결과 제출 실패", error);
                            fileConfirmState[fileKey] = "confirm";
                            btn.disabled = false;
                            updateConfirmBtnUI();
                            showToast(error.message || "분류 결과 제출에 실패했습니다.");
                        }
                    });
                    return;
                }
                if (state !== "notify") return;
                const confirmedQueries = confirmedQuerySnapshots[fileKey] || [];
                if (!confirmedQueries.length) {
                    showToast("확정된 질의 정보가 없습니다. 질의를 다시 확정해 주세요.");
                    fileConfirmState[fileKey] = "confirm";
                    updateConfirmBtnUI();
                    return;
                }
                const routing = getNotificationRoutingForQueries(confirmedQueries);
                const queryCards = confirmedQueries
                    .map((query, index) => {
                        const assignedDepartments = [];
                        splitNotificationDepartments(query.mainDept).forEach((dept) => assignedDepartments.push({ dept, role: "담당" }));
                        splitNotificationDepartments(query.coopDept).forEach((dept) => {
                            if (!assignedDepartments.some((item) => item.dept === dept && item.role === "협조")) {
                                assignedDepartments.push({ dept, role: "협조" });
                            }
                        });
                        const departmentRows = assignedDepartments
                            .map((item) => {
                                const route = routing.departments.find((entry) => entry.dept === item.dept);
                                const recipients = route?.recipients || [];
                                const recipientNames = recipients.length ? recipients.map((person) => `${person.name} ${person.position}`).join(", ") : "지정된 실국담당자 없음";
                                return `<div class="notification-query-dept-row">
                    <span class="notification-route-query-role">${escapeHtml(item.role)}</span>
                    <strong class="notification-query-dept-name">${escapeHtml(item.dept)}</strong>
                    <span class="notification-query-recipient-count">${recipients.length}명</span>
                    <span class="notification-query-recipient-names">${escapeHtml(recipientNames)}</span>
                  </div>`;
                            })
                            .join("");
                        return `<section class="notification-query-match-card">
                  <div class="notification-query-match-head">
                    <span class="notification-route-query-no">질의 ${query.number || index + 1}</span>
                    <strong>${escapeHtml(query.summary || query.text || `질의 ${index + 1}`)}</strong>
                  </div>
                  <div class="notification-query-dept-list">${departmentRows || '<div class="notification-query-dept-empty">배정된 실국이 없습니다.</div>'}</div>
                </section>`;
                    })
                    .join("");
                const queryCount = confirmedQueries.length;
                const departmentCount = routing.departments.length;
                const recipientCount = routing.recipients.length;
                customConfirm(
                    "확정 질의 · 실국알림 대상",
                    `<div class="notification-route-overview"><strong>확정 질의 ${queryCount}건</strong><span>배정 실국 ${departmentCount}개 · 알림 대상 ${recipientCount}명</span></div><div class="notification-route-summary notification-query-route-summary">${queryCards}</div>`,
                    () => {
                        customAlert("실국알림 전송 안내", `확정된 질의 ${queryCount}건의 배정 실국 담당자 ${recipientCount}명에게 알림을 전송합니다.`);
                        fileConfirmState[fileKey] = "done";
                        updateConfirmBtnUI();
                        showToast("실국알림 전송 처리가 완료되었습니다.");
                    },
                    "confirm",
                    "알림전송",
                );
            }

            function handleConfirmCancel() {
                const fileKey = getActiveConfirmKey();
                const activeFile = uploadedFiles[activeFileIndex];
                const state = syncActiveSubmittedConfirmState();
                if (state !== "notify" || !activeFile?.documentId) return;
                customConfirm("확정 취소", "서버에 제출된 분류 결과를 취소하시겠습니까?", async () => {
                    try {
                        await cancelActualDocumentSubmit(activeFile.documentId);
                        fileConfirmState[fileKey] = "confirm";
                        delete confirmedQuerySnapshots[fileKey];
                        activeFile.isSubmitted = false;
                        questions.forEach((q) => {
                            q.isSubmitted = false;
                        });
                        updateConfirmBtnUI();
                        updateNotificationAssigneeButton();
                        renderQueryList();
                        showToast("서버 제출이 취소되었습니다.");
                    } catch (error) {
                        console.error("제출 취소 실패", error);
                        showToast(error.message || "제출 취소에 실패했습니다.");
                    }
                });
            }

            function updateConfirmBtnUI() {
                const btn = $("#confirmBtn");
                if (!btn) return;
                const fileKey = getActiveConfirmKey();
                const state = syncActiveSubmittedConfirmState();
                btn.disabled = false;
                btn.style.opacity = "";
                btn.classList.remove("primary");
                btn.classList.add("primary");
                // Show/hide cancel button
                const cancelBtn = $("#confirmCancelBtn");
                if (state === "confirm") {
                    btn.textContent = "확정";
                    if (cancelBtn) cancelBtn.classList.add("hidden");
                    //   } else if (state === 'notify') {
                    //     btn.textContent = '알람보내기';
                    if (cancelBtn) {
                        cancelBtn.textContent = "확정취소";
                        cancelBtn.classList.add("hidden");
                    }
                } else if (state === "done") {
                    btn.textContent = "알림전송완료";
                    btn.disabled = true;
                    btn.style.opacity = "0.6";
                    if (cancelBtn) cancelBtn.classList.add("hidden");
                }
                updateNotificationAssigneeButton();
            }

            function downloadExcel() {
                const now = new Date();
                const today = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join(".");

                const fileDate = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");

                /*
                 * 엑셀은 화면 필터와 무관하게 전체 질의를 내보낸다.
                 * 제외 질의도 삭제하지 않고 "질의상태=제외"로 명확하게 표시한다.
                 * 질의순서는 API question_order를 우선하고, 없을 때 현재 배열 순서를 사용한다.
                 */
                const queries = questions
                    .map((q, index) => ({
                        query: q,
                        sourceIndex: index,
                        order: (() => {
                            const value = Number(q?.raw?.question_order ?? q?.question_order);
                            return Number.isInteger(value) && value > 0 ? value : index + 1;
                        })(),
                    }))
                    .sort((a, b) => a.order - b.order || a.sourceIndex - b.sourceIndex);

                const activeFile = uploadedFiles[activeFileIndex];
                const executionFileName = activeFile ? activeFile.name : $("#activeFileName")?.textContent || "";
                const meta = documentMetaMap[executionFileName] || {};

                const executor = document.querySelector("[data-account-profile-name]")?.textContent?.trim() || "사용자";

                const normalizeValue = (value) => {
                    if (value === null || value === undefined) return "";
                    const text = String(value).trim();
                    return /^(null|undefined)$/i.test(text) ? "" : text;
                };

                const normalizeMemberName = (value) =>
                    normalizeValue(value)
                        .replace(/\s*\(인\)\s*/g, "")
                        .replace(/\s+/g, " ")
                        .trim();

                const escapeExcelHtml = (value) => normalizeValue(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

                const requestDate = meta.date || "";
                const memberName = normalizeMemberName(meta.memberName);
                const partyName = meta.partyName || "";

                /*
                 * 질의순서를 첫 번째 열에 둔다.
                 * 이후에는 실제 검토할 때 자주 보는 질의내용/상태/소관부서를 앞쪽에 배치하고
                 * 실행 메타정보는 뒤쪽으로 정리한다.
                 */
                const columns = [
                    { key: "order", label: "질의순서", width: 70, align: "center" },
                    { key: "question", label: "질의내용", width: 520, align: "left" },
                    { key: "status", label: "질의상태", width: 90, align: "center" },
                    { key: "mainDept", label: "담당실국", width: 150, align: "left" },
                    { key: "coopDept", label: "협조실국", width: 180, align: "left" },
                    { key: "questionId", label: "질의ID", width: 145, align: "center" },
                    { key: "memberName", label: "질의의원명", width: 110, align: "center" },
                    { key: "partyName", label: "교섭단체명", width: 120, align: "center" },
                    { key: "requestDate", label: "요구일", width: 105, align: "center" },
                    { key: "executionFileName", label: "실행파일명", width: 260, align: "left" },
                    { key: "executor", label: "실행자", width: 100, align: "center" },
                    { key: "executionDate", label: "실행일", width: 105, align: "center" },
                ];

                const rows = queries.map(({ query: q, order }) => ({
                    order,
                    question: q.text || "",
                    status: q.isDeleted ? "제외" : q.isSubmitted ? "제출완료" : "포함",
                    mainDept: q.mainDept || "",
                    coopDept: q.coopDept || "",
                    questionId: "Q-" + now.getFullYear() + "-" + String(q.id ?? "").padStart(4, "0"),
                    memberName,
                    partyName,
                    requestDate,
                    executionFileName,
                    executor,
                    executionDate: today,
                }));

                /*
                 * CSV 대신 Excel이 직접 여는 .xls(HTML Workbook)로 생성한다.
                 * 이 방식은 열 너비/줄바꿈/고정된 헤더 스타일을 파일 안에 넣을 수 있어
                 * 긴 질의내용이나 파일명이 잘리지 않고 바로 확인하기 좋다.
                 */
                const colgroup = columns.map((column) => `<col style="width:${column.width}px">`).join("");

                const headerHtml = columns.map((column) => `<th>${escapeExcelHtml(column.label)}</th>`).join("");

                const bodyHtml = rows
                    .map(
                        (row) => `
                  <tr>
                    ${columns
                        .map((column) => {
                            const value = row[column.key];
                            return `<td class="${column.align === "center" ? "center" : ""}">${escapeExcelHtml(value)}</td>`;
                        })
                        .join("")}
                  </tr>
                `,
                    )
                    .join("");

                const workbookHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Type" content="application/vnd.ms-excel; charset=UTF-8">
<style>
            table {
              border-collapse: collapse;
              table-layout: fixed;
              font-family: "Malgun Gothic", Arial, sans-serif;
              font-size: 10pt;
            }
            th {
              border: 1px solid #9aa4b2;
              background: #eef2f6;
              font-weight: 700;
              text-align: center;
              vertical-align: middle;
              padding: 7px 6px;
              white-space: nowrap;
            }
            td {
              border: 1px solid #c9d1d9;
              vertical-align: top;
              padding: 6px;
              white-space: normal;
              word-break: break-all;
              mso-number-format:"\\@";
            }
            td.center {
              text-align: center;
              vertical-align: middle;
            }
</style>
</head>
<body>
<table>
            <colgroup>${colgroup}</colgroup>
            <thead><tr>${headerHtml}</tr></thead>
            <tbody>${bodyHtml}</tbody>
</table>
</body>
</html>`;

                const blob = new Blob(["\uFEFF", workbookHtml], { type: "application/vnd.ms-excel;charset=utf-8;" });

                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");

                a.href = url;
                a.download = "질의목록_추천실국_" + fileDate + ".xls";

                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);

                showToast("질의목록 엑셀 파일이 다운로드되었습니다.");
            }

            function getCommonActionModal() {
                let modal = $("#classificationActionModal");
                if (!modal) {
                    modal = document.createElement("div");
                    modal.id = "classificationActionModal";
                    modal.className = "modal hidden";
                    modal.setAttribute("data-modal", "");
                    document.body.appendChild(modal);
                    window.AIOneModal?.init(modal);
                }
                return modal;
            }

            function customConfirm(title, msg, onConfirm, type = "confirm", confirmLabel = "확인") {
                const modal = getCommonActionModal();
                const isDanger = type === "danger";
                modal.innerHTML = `
                <div class="modal-bg" aria-hidden="true"></div>
                <section class="modal-contents modal-medium" data-modal-variant="${isDanger ? "cancel" : "confirm"}" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
                  <div class="modal-variant-panel" data-modal-panel="content">
                    <div class="modal-icon ${isDanger ? "danger" : "confirm"}" data-modal-icon="default" aria-hidden="true">${isDanger ? "⚠" : "✓"}</div>
                    <h3 class="modal-title">${title}</h3>
                    <div class="modal-msg">${msg}</div>
                    <div class="modal-actions">
                      <button type="button" class="btn-cancel" data-modal-close>취소</button>
                      <button type="button" class="btn-confirm${isDanger ? " danger" : ""}" id="cmConfirm">${confirmLabel}</button>
                    </div>
                  </div>
                </section>`;
                window.AIOneModal?.init(modal);
                window.AIOneModal?.open(modal);
                $("#cmConfirm")?.addEventListener(
                    "click",
                    () => {
                        window.AIOneModal?.close(modal);
                        if (onConfirm) onConfirm();
                    },
                    { once: true },
                );
            }

            function customAlert(title, msg) {
                const modal = getCommonActionModal();
                modal.innerHTML = `
                <div class="modal-bg" aria-hidden="true"></div>
                <section class="modal-contents modal-medium" data-modal-variant="alert" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
                  <div class="modal-variant-panel" data-modal-panel="content">
                    <div class="modal-icon alert" data-modal-icon="alert" aria-hidden="true">!</div>
                    <div class="modal-title">${title}</div>
                    <div class="modal-msg">${msg}</div>
                    <div class="modal-actions"><button type="button" class="btn-confirm" data-modal-close>확인</button></div>
                  </div>
                </section>`;
                window.AIOneModal?.init(modal);
                window.AIOneModal?.open(modal);
            }

            async function deleteActualQuestion(questionId) {
                const body = new URLSearchParams();
                body.append("questionId", questionId);
                // [API 연동] POST ND_deleteQuestion.do: 질의 제외 처리.
                return fetchJson("ND_deleteQuestion.do", { method: "POST", body });
            }

            async function restoreActualQuestion(questionId) {
                const body = new URLSearchParams();
                body.append("questionId", questionId);
                // [API 연동] POST ND_restoreQuestion.do: 제외된 질의 복원.
                return fetchJson("ND_restoreQuestion.do", { method: "POST", body });
            }

            function normalizeActualQuestions(data) {
                if (Array.isArray(data)) return data;
                if (Array.isArray(data?.items)) return data.items;
                if (Array.isArray(data?.questions)) return data.questions;
                return data ? [data] : [];
            }

            // HTML 템플릿을 사용하고 기존 select를 저장 값의 기준으로 유지합니다.
            const editDepartmentKinds = ["primary", "support"];
            const editDepartmentSelects = (kind) => (kind === "primary" ? ["editMainDept", "editMainDept2"] : ["editCoopDept", "editCoopDept2"]).map((id) => document.getElementById(id));

            function closeEditDepartmentResults(picker) {
                picker.querySelector(".query-department-results").hidden = true;
                picker.querySelector(".query-department-search input").setAttribute("aria-expanded", "false");
            }

            function showEditDepartmentResults(picker) {
                const kind = picker.dataset.departmentPicker;
                const input = picker.querySelector(".query-department-search input");
                if (picker.hidden || input.disabled) return;
                editModal.querySelectorAll("[data-department-picker]").forEach((other) => {
                    if (other !== picker) closeEditDepartmentResults(other);
                });
                const results = picker.querySelector(".query-department-results");
                const list = results.querySelector("[data-department-options]");
                const values = rawSelectedDepartmentCodes(kind);
                const otherValues = rawSelectedDepartmentCodes(kind === "primary" ? "support" : "primary");
                const limit = $("#editType").value === "single" ? 1 : 2;
                const keyword = input.value.trim().toLocaleLowerCase();
                const options = [...editDepartmentSelects(kind)[0].options].filter((option) => option.value && option.textContent.toLocaleLowerCase().includes(keyword));
                list.replaceChildren();
                results.querySelector("[data-department-results-title]").textContent = keyword ? "검색 결과" : "전체 실국";
                results.querySelector("[data-department-results-count]").textContent = options.length + "개";
                const groups = new Map();
                options.forEach((option) => {
                    const department = actualDepartments.find((item) => actualDepartmentCode(item) === option.value);
                    const groupName = notificationOrganizationName(department);
                    if (!groups.has(groupName)) {
                        const group = $("#editDepartmentGroupTemplate").content.firstElementChild.cloneNode(true);
                        group.querySelector("h4").textContent = groupName;
                        list.append(group);
                        groups.set(groupName, group.querySelector("div"));
                    }
                    const row = $("#editDepartmentOptionTemplate").content.firstElementChild.cloneNode(true);
                    const checkbox = row.querySelector("input");
                    checkbox.value = option.value;
                    checkbox.checked = values.includes(option.value);
                    checkbox.disabled = otherValues.includes(option.value) || (!checkbox.checked && values.length >= limit);
                    row.querySelector("span").textContent = option.textContent;
                    checkbox.addEventListener("change", () => {
                        const current = rawSelectedDepartmentCodes(kind);
                        const next = checkbox.checked ? [...current, option.value] : current.filter((code) => code !== option.value);
                        if (next.length > limit || rawSelectedDepartmentCodes(kind === "primary" ? "support" : "primary").includes(option.value)) return;
                        editDepartmentSelects(kind).forEach((select, index) => {
                            select.value = next[index] || "";
                            select.disabled = index > 0 && !next[index];
                        });
                        renderEditDepartmentPickers();
                        showEditDepartmentResults(picker);
                        [...list.querySelectorAll("input")].find((item) => item.value === option.value)?.focus({ preventScroll: true });
                    });
                    groups.get(groupName).append(row);
                });
                if (!options.length) {
                    const title = document.createElement("strong");
                    title.className = "empty-title";
                    title.textContent = "검색 결과가 없습니다.";
                    list.replaceChildren(title);
                }
                // 본문이 스크롤된 경우에도 선택창이 본문 위쪽 경계를 넘지 않게 합니다.
                const searchTop = picker.querySelector(".query-department-search-wrap").getBoundingClientRect().top;
                const bodyTop = editModal.querySelector(".modal-msg").getBoundingClientRect().top;
                results.style.maxHeight = Math.max(0, Math.min(270, searchTop - bodyTop - 8)) + "px";
                results.hidden = false;
                input.setAttribute("aria-expanded", "true");
            }

            function initEditDepartmentPickers() {
                if (editModal.dataset.departmentPickersReady) return;
                editModal.dataset.departmentPickersReady = "true";
                editModal.querySelectorAll("[data-department-picker]").forEach((picker) => {
                    const input = picker.querySelector(".query-department-search input");
                    const search = () => showEditDepartmentResults(picker);
                    input.addEventListener("focus", search);
                    input.addEventListener("click", search);
                    input.addEventListener("input", search);
                    picker.querySelector(".query-department-search").addEventListener("click", (event) => {
                        if (event.target !== input) {
                            input.focus();
                            search();
                        }
                    });
                    picker.addEventListener("keydown", (event) => {
                        const results = picker.querySelector(".query-department-results");
                        if (event.key === "Escape" && !results.hidden) {
                            event.preventDefault();
                            event.stopPropagation();
                            input.focus();
                            closeEditDepartmentResults(picker);
                        } else if (event.target === input && (event.key === "Enter" || event.key === "ArrowDown")) {
                            event.preventDefault();
                            search();
                            if (event.key === "ArrowDown") results.querySelector("input:not(:disabled)")?.focus();
                        }
                    });
                    picker.addEventListener("focusout", () => {
                        requestAnimationFrame(() => {
                            if (!picker.contains(document.activeElement)) closeEditDepartmentResults(picker);
                        });
                    });
                });
                editModal.addEventListener("click", (event) => {
                    editModal.querySelectorAll("[data-department-picker]").forEach((picker) => {
                        if (!picker.contains(event.target)) closeEditDepartmentResults(picker);
                    });
                });
                editModal.addEventListener("modal:close", () => editModal.querySelectorAll("[data-department-picker]").forEach(closeEditDepartmentResults));
                editModal.querySelector(".modal-msg").addEventListener("scroll", () => {
                    editModal.querySelectorAll("[data-department-picker]").forEach(closeEditDepartmentResults);
                });
            }

            function renderEditDepartmentPickers() {
                initEditDepartmentPickers();
                const type = $("#editType").value;
                editModal.classList.toggle("is-multi-department", type === "multi");
                editModal.querySelector(".query-department-grid").hidden = type === "none";
                editModal.querySelector(".query-department-none").hidden = type !== "none";
                editDepartmentKinds.forEach((kind) => {
                    const selects = editDepartmentSelects(kind);
                    selects[0].closest(".form-group").hidden = true;
                    const picker = editModal.querySelector('[data-department-picker="' + kind + '"]');
                    picker.hidden = type === "none" || (kind === "support" && type !== "multi");
                    const values = rawSelectedDepartmentCodes(kind);
                    const limit = type === "single" ? 1 : 2;
                    const count = picker.querySelector(".query-department-count");
                    const strong = document.createElement("strong");
                    strong.textContent = values.length + "/" + limit;
                    count.replaceChildren(strong, document.createTextNode("개 선택"));
                    const tags = picker.querySelector(".query-department-tags");
                    tags.replaceChildren();
                    values.forEach((code) => {
                        const name = [...selects[0].options].find((option) => option.value === code)?.textContent || code;
                        const button = $("#editDepartmentTagTemplate").content.firstElementChild.cloneNode(true);
                        button.textContent = name + " ×";
                        button.setAttribute("aria-label", name + " 선택 해제");
                        button.addEventListener("click", () => {
                            const remaining = rawSelectedDepartmentCodes(kind).filter((value) => value !== code);
                            selects.forEach((select, index) => {
                                select.value = remaining[index] || "";
                            });
                            renderEditDepartmentPickers();
                            picker.querySelector(".query-department-search input").focus();
                        });
                        tags.append(button);
                    });
                    if (!values.length) tags.textContent = "선택된 실국이 없습니다.";
                    picker.querySelector(".query-department-search input").disabled = type === "none";
                    closeEditDepartmentResults(picker);
                });
                $("#editOrg").closest(".form-group").hidden = true;
            }

            function syncEditTypeControls() {
                ensureEditDepartmentMultiUi();
                const type = String($("#editType")?.value || "single");
                const primarySelects = [$("#editMainDept"), $("#editMainDept2")].filter(Boolean);
                const supportSelects = [$("#editCoopDept"), $("#editCoopDept2")].filter(Boolean);
                const mainAddBtn = $(".edit-primary-dept-row.edit-dept-row-first .edit-dept-add-btn");
                const coopAddBtn = $(".edit-support-dept-row.edit-dept-row-first .edit-dept-add-btn");
                const mainSecondRow = $(".edit-primary-dept-row.edit-dept-row-second");
                const coopSecondRow = $(".edit-support-dept-row.edit-dept-row-second");
                if (type === "none") {
                    primarySelects.forEach((select) => {
                        select.value = "";
                        select.disabled = true;
                    });
                    supportSelects.forEach((select) => {
                        select.value = "";
                        select.disabled = true;
                    });
                    mainSecondRow?.classList.remove("is-visible");
                    coopSecondRow?.classList.remove("is-visible");
                    mainSecondRow?.style.removeProperty("display");
                    coopSecondRow?.style.removeProperty("display");
                    if (mainAddBtn) mainAddBtn.disabled = true;
                    if (coopAddBtn) coopAddBtn.disabled = true;
                } else {
                    if (primarySelects[0]) primarySelects[0].disabled = false;
                    if (supportSelects[0]) supportSelects[0].disabled = false;
                    mainSecondRow?.style.removeProperty("display");
                    coopSecondRow?.style.removeProperty("display");
                    if (mainAddBtn) {
                        const hasSecondPrimary = Boolean(primarySelects[1]?.value);
                        mainAddBtn.disabled = hasSecondPrimary;
                    }
                    if (coopAddBtn) {
                        const hasSecondSupport = Boolean(supportSelects[1]?.value);
                        coopAddBtn.disabled = hasSecondSupport;
                    }
                }
                const org = $("#editOrg");
                if (org) {
                    org.value = type === "none" ? "" : "재정경제부";
                }
                renderEditDepartmentPickers();
            }

            function handleEditTypeManualChange() {
                ensureEditDepartmentMultiUi();
                const type = String($("#editType")?.value || "single");
                const main2 = $("#editMainDept2");
                const coop1 = $("#editCoopDept");
                const coop2 = $("#editCoopDept2");

                if (type === "single") {
                    if (main2) main2.value = "";
                    if (coop1) coop1.value = "";
                    if (coop2) coop2.value = "";
                    setSecondDepartmentRow("primary", "");
                    setSecondDepartmentRow("support", "");
                }

                syncEditTypeControls();
            }

            async function openEditModal(qid) {
                editingQuery = questions.find((q) => Number(q.id) === Number(qid));
                if (!editingQuery) return;
                $("#editQueryText").value = editingQuery.text || "";
                if (!actualDepartments.length) {
                    await loadActualDepartments();
                }
                const primaryList =
                    Array.isArray(editingQuery.raw?.primary_departments) && editingQuery.raw.primary_departments.length
                        ? editingQuery.raw.primary_departments
                        : Array.isArray(editingQuery.primaryDepartments) && editingQuery.primaryDepartments.length
                          ? editingQuery.primaryDepartments
                          : !editingQuery.primaryWasModified && editingQuery.predictedDepartment
                            ? [editingQuery.predictedDepartment]
                            : [];
                const supportList = Array.isArray(editingQuery.raw?.support_departments) ? editingQuery.raw.support_departments : Array.isArray(editingQuery.supportDepartments) ? editingQuery.supportDepartments : [];
                const currentType = editingQuery.userSelectedType || editingQuery.type;
                const savedType = ["single", "multi", "none"].includes(currentType) ? currentType : !primaryList.length ? "none" : primaryList.length > 1 || supportList.length > 0 ? "multi" : "single";
                $("#editType").value = savedType;
                const primaryCodes = primaryList
                    .map((item) => actualDepartmentCode(item))
                    .filter(Boolean)
                    .slice(0, 2);
                populateEditDepartmentSelects(primaryList, supportList);
                editModal.querySelectorAll(".query-department-search input").forEach((input) => {
                    input.value = "";
                });
                $("#editOrg").value = editingQuery.org || (primaryCodes.length ? "재정경제부" : "");
                syncEditTypeControls();
                // Start: 261026 수정 - 편집 시작값을 기준으로 실제 변경 여부 비교
                editInitialValues = readEditValues();
                // End: 261026 수정 - 편집 시작값을 기준으로 실제 변경 여부 비교
                window.AIOneModal?.open(editModal);
            }

            // Start: 261026 추가 - 수정 저장·AI 재분류 선택 확인
            let editSaving = false;
            // Start: 261026 수정 - 내용·소관 변경별 안내 분기
            let editInitialValues = null;
            function readEditValues() {
                const type = String($("#editType").value || "single");
                return {
                    text: $("#editQueryText").value || "",
                    type,
                    primary: type === "none" ? [] : [...rawSelectedDepartmentCodes("primary")].sort(),
                    support: type === "multi" ? [...rawSelectedDepartmentCodes("support")].sort() : [],
                };
            }
            function getEditChanges() {
                const current = readEditValues();
                return {
                    text: current.text !== editInitialValues?.text,
                    departments: current.type !== editInitialValues?.type || JSON.stringify(current.primary) !== JSON.stringify(editInitialValues?.primary) || JSON.stringify(current.support) !== JSON.stringify(editInitialValues?.support),
                };
            }
            function confirmQueryEdit(previous, changes) {
                const modal = $("#queryEditConfirmModal");
                $("#queryEditConfirmTitle").textContent = "질의 내용이 변경되었습니다";
                const note = modal.querySelector(".query-edit-confirm-note");
                note.hidden = !changes.departments;
                note.querySelector("strong").textContent = "실국 정보도 함께 수정되었습니다.";
                // End: 261026 수정 - 내용·소관 변경별 안내 분기
                return new Promise((resolve) => {
                    let choice = null;
                    const onClick = (event) => {
                        const button = event.target.closest("[data-query-edit-choice]");
                        if (!button) return;
                        choice = button.dataset.queryEditChoice;
                        window.AIOneModal.close(modal);
                    };
                    const onClose = () => {
                        modal.removeEventListener("click", onClick);
                        modal.removeEventListener("modal:close", onClose);
                        if (!choice) window.AIOneModal.open(editModal);
                        resolve(choice);
                    };
                    window.AIOneModal.close(editModal);
                    // 기존 modal:close가 비운 편집 대상을 확인·취소 동안 유지한다.
                    editingQuery = previous;
                    modal.addEventListener("click", onClick);
                    modal.addEventListener("modal:close", onClose);
                    window.AIOneModal.open(modal);
                });
            }
            // End: 261026 추가 - 수정 저장·AI 재분류 선택 확인

            async function applyEdit() {
                if (!editingQuery || editSaving) return;
                if (!editingQuery.questionId) {
                    showToast("서버 question_id가 없어 현재 항목은 수정할 수 없습니다.");
                    return;
                }
                editSaving = true;
                try {
                    const previous = editingQuery;
                    // Start: 261026 수정 - 변경 없는 수정 적용은 API·팝업 없이 안내
                    const changes = getEditChanges();
                    if (!changes.text && !changes.departments) {
                        closeEditModal();
                        showToast("분류정보는 실행되지 않았습니다. AI재분류는 실행되지 않았습니다.");
                        return;
                    }
                    // End: 261026 수정 - 변경 없는 수정 적용은 API·팝업 없이 안내
                    const questionId = String(previous.questionId);
                    const stableId = Number(previous.id);
                    const questionText = $("#editQueryText").value || "";
                    const selectedType = String($("#editType").value || "single");
                    const rawPrimaryCodes = selectedType === "none" ? [] : rawSelectedDepartmentCodes("primary");
                    const rawSupportCodes = selectedType === "multi" ? rawSelectedDepartmentCodes("support") : [];
                    if (new Set(rawPrimaryCodes).size !== rawPrimaryCodes.length) {
                        showToast("같은 담당실국은 중복 선택할 수 없습니다.");
                        return;
                    }
                    if (new Set(rawSupportCodes).size !== rawSupportCodes.length) {
                        showToast("같은 협조실국은 중복 선택할 수 없습니다.");
                        return;
                    }
                    const primaryCodes = [...new Set(rawPrimaryCodes)];
                    const supportCodes = [...new Set(rawSupportCodes)];
                    // Start: 261026 수정 - 복수소관 주관·협조 합계 검증
                    if (selectedType === "multi" && (!primaryCodes.length || new Set([...primaryCodes, ...supportCodes]).size < 2)) {
                        showToast("복수소관은 주관실국 2개 또는 주관실국과 협조실국을 합해 2개 이상 지정해 주세요.");
                        return;
                    }
                    if (selectedType === "single" && primaryCodes.length !== 1) {
                        showToast("단일소관은 주관실국 1개를 지정해 주세요.");
                        return;
                    }
                    if (primaryCodes.length > 2) {
                        showToast("담당실국은 최대 2개까지 선택할 수 있습니다.");
                        return;
                    }
                    // End: 261026 수정 - 복수소관 주관·협조 합계 검증
                    if (supportCodes.length > 2) {
                        showToast("협조실국은 최대 2개까지 선택할 수 있습니다.");
                        return;
                    }
                    let primaryDepartments = [];
                    let supportDepartments = [];
                    for (const code of primaryCodes) {
                        const dept = findActualDepartmentByNameOrCode(code);
                        if (!dept) {
                            showToast("선택한 담당실국 정보를 찾을 수 없습니다.");
                            return;
                        }
                        primaryDepartments.push(dept);
                    }
                    for (const code of supportCodes) {
                        const dept = findActualDepartmentByNameOrCode(code);
                        if (!dept) {
                            showToast("선택한 협조실국 정보를 찾을 수 없습니다.");
                            return;
                        }
                        supportDepartments.push(dept);
                    }
                    const primaryIds = new Set(primaryDepartments.map(actualDepartmentId));
                    if (supportDepartments.some((dept) => primaryIds.has(actualDepartmentId(dept)))) {
                        showToast("담당실국과 협조실국에는 같은 부서를 중복 선택할 수 없습니다.");
                        return;
                    }
                    // Start: 261026 수정 - 확인 후 저장 방식 선택
                    const choice = await confirmQueryEdit(previous, changes);
                    if (!choice) return;
                    // End: 261026 수정 - 확인 후 저장 방식 선택
                    const body = new URLSearchParams();
                    body.append("questionId", questionId);
                    body.append("questionText", questionText);
                    if (primaryDepartments.length) {
                        primaryDepartments.forEach((dept) => body.append("primaryDepartmentIds", actualDepartmentId(dept)));
                    } else {
                        body.append("clearPrimaryDepartments", "true");
                    }
                    if (supportDepartments.length) {
                        supportDepartments.forEach((dept) => body.append("supportDepartmentIds", actualDepartmentId(dept)));
                    } else {
                        body.append("clearSupportDepartments", "true");
                    }
                    // [API 연동] POST ND_updateQuestion.do: 편집한 질의 내용과 분류 정보 저장.
                    const updated = await fetchJson("ND_updateQuestion.do", {
                        method: "POST",
                        headers: { "Content-Type": "application/x-www-form-urlencoded" },
                        body: body.toString(),
                    });
                    const responseQuestion = updated?.question ?? updated?.item ?? updated ?? {};
                    const responseModifiedFields = Array.isArray(responseQuestion?.modified_fields) ? responseQuestion.modified_fields : Array.isArray(previous.raw?.modified_fields) ? previous.raw.modified_fields : [];
                    const previousText = String(previous.raw?.question_text ?? previous.text ?? "");
                    const previousPrimaryIds = (Array.isArray(previous.raw?.primary_departments) ? previous.raw.primary_departments : Array.isArray(previous.primaryDepartments) ? previous.primaryDepartments : [])
                        .map(actualDepartmentId)
                        .filter(Boolean)
                        .sort();
                    const previousSupportIds = (Array.isArray(previous.raw?.support_departments) ? previous.raw.support_departments : Array.isArray(previous.supportDepartments) ? previous.supportDepartments : [])
                        .map(actualDepartmentId)
                        .filter(Boolean)
                        .sort();
                    const nextPrimaryIds = primaryDepartments.map(actualDepartmentId).filter(Boolean).sort();
                    const nextSupportIds = supportDepartments.map(actualDepartmentId).filter(Boolean).sort();
                    const actuallyChangedFields = [];
                    if (questionText !== previousText) {
                        actuallyChangedFields.push("question_text");
                    }
                    if (JSON.stringify(previousPrimaryIds) !== JSON.stringify(nextPrimaryIds)) {
                        actuallyChangedFields.push("primary_department_ids");
                    }
                    if (JSON.stringify(previousSupportIds) !== JSON.stringify(nextSupportIds)) {
                        actuallyChangedFields.push("support_department_ids");
                    }
                    const mergedModifiedFields = [...new Set([...responseModifiedFields, ...actuallyChangedFields])];
                    const mergedRaw = {
                        ...(previous.raw || {}),
                        ...(responseQuestion && typeof responseQuestion === "object" ? responseQuestion : {}),
                        question_id: questionId,
                        question_text: questionText,
                        primary_departments: primaryDepartments,
                        support_departments: supportDepartments,
                        modified_fields: mergedModifiedFields,
                    };
                    delete mergedRaw.primary_department;
                    delete mergedRaw.primaryDepartment;
                    const mapped = mapActualQuestion(mergedRaw, Number.isFinite(stableId) ? stableId - 1 : 0);
                    mapped.id = Number.isFinite(stableId) ? stableId : previous.id;
                    mapped.questionId = questionId;
                    mapped.userSelectedType = selectedType;
                    mapped.raw = mergedRaw;
                    const index = questions.findIndex((q) => String(q.questionId) === questionId || Number(q.id) === stableId);
                    if (index >= 0) questions[index] = mapped;
                    const activeFile = uploadedFiles[activeFileIndex];
                    if (activeFile && fileDataMap[activeFile.name]) {
                        const list = fileDataMap[activeFile.name].queries || [];
                        const fileIndex = list.findIndex((q) => String(q.questionId) === questionId || Number(q.id) === stableId);
                        if (fileIndex >= 0) list[fileIndex] = mapped;
                    }
                    closeEditModal();
                    /*
                     * 수정 결과는 우측 "질의목록 · 추천실국"에만 반영한다.
                     *
                     * - 원본 질의요지서: 최초 원본 그대로 유지
                     * - 중앙 질의 추출 결과: 최초 추출/분류 결과 그대로 유지
                     * - 우측 질의목록 · 추천실국: PATCH된 현재 값 표시
                     *
                     * 따라서 여기서는 중앙/원본 영역을 다시 렌더링하지 않는다.
                     */
                    renderQueryList();
                    // Start: 261026 수정 - 저장만 수행하거나 같은 질의를 AI 재분류
                    if (choice === "reclassify") {
                        await executeAiReclassification([mapped]);
                    } else {
                        showToast("분류정보가 수행되었습니다. AI재분류는 실행되지 않았습니다.");
                    }
                    // End: 261026 수정 - 저장만 수행하거나 같은 질의를 AI 재분류
                } catch (error) {
                    console.error("질의 수정 실패", error);
                    showToast(error.message || "질의 수정에 실패했습니다.");
                    if (editingQuery) window.AIOneModal.open(editModal);
                } finally {
                    editSaving = false;
                }
            }

            Object.assign(runtime, {
                setMappedQueryCard,
                getQuerySummary,
                getRecommendOffice,
                getAIReason,
                ensureQueryModifiedTooltip,
                showQueryModifiedTooltip,
                hideQueryModifiedTooltip,
                renderQueryList,
                excludeQuestion,
                handleFilterChange,
                updateStepper,
                escapeHtml,
                closeEditModal,
                stopResetInteraction,
                resetAll,
                getActiveConfirmKey,
                createConfirmedQuerySnapshot,
                syncActiveSubmittedConfirmState,
                handleConfirmBtn,
                handleConfirmCancel,
                updateConfirmBtnUI,
                downloadExcel,
                getCommonActionModal,
                customConfirm,
                customAlert,
                deleteActualQuestion,
                restoreActualQuestion,
                normalizeActualQuestions,
                syncEditTypeControls,
                handleEditTypeManualChange,
                openEditModal,
                applyEdit,
            });
        }
    };
})(window);
