/**
 * AI-ONE 질의분류 - 부서/담당자 모듈
 *
 * 역할
 * - 부서 API 응답을 화면에서 사용할 형태로 정규화한다.
 * - AI 재분류와 담당/협조 실국 반영 로직을 처리한다.
 * - 담당자 및 알림 대상 설정을 관리한다.
 *
 * 261026 변경 요약
 * - 수정 - 직접 실행과 수정 후 AI 재분류에 동일한 영역별 로딩 적용
 *
 * 기본 구간 형식: Start: 기능명 / End: 기능명
 * 변경 구간 형식: Start: YYMMDD 추가/수정 - 기능명 / End: YYMMDD 추가/수정 - 기능명
 * 주석 정리 내역
 * - 261023 주석 정리 - 구간 표시와 변경 내용 표기를 통일합니다. 기존 작업 날짜와 기능 설명은 유지합니다.
 */
(function registerclassification_departmentModule(window) {
    window.AIOneClassificationFeatureModules = window.AIOneClassificationFeatureModules || {};
    window.AIOneClassificationFeatureModules["classification-department.js"] = function install(runtime) {
        with (runtime) {
            // normalizeNotificationStaff: API 데이터 정규화.
            function normalizeNotificationStaff(dept) {
                const candidates = dept?.staff ?? dept?.users ?? dept?.members ?? dept?.assignees ?? dept?.employees ?? [];
                const list = Array.isArray(candidates) ? candidates : candidates ? [candidates] : [];
                return list
                    .map((person, index) => {
                        if (person == null) return null;
                        if (typeof person === "string") {
                            return { id: person, name: person, position: "" };
                        }
                        const id = String(person?.id ?? person?.user_id ?? person?.userId ?? person?.emp_no ?? person?.empNo ?? person?.login_id ?? person?.loginId ?? "").trim();
                        const name = String(person?.name ?? person?.user_name ?? person?.userName ?? person?.emp_nm ?? person?.empNm ?? "").trim();
                        const position = String(person?.position ?? person?.position_name ?? person?.positionName ?? person?.rank_nm ?? person?.rankNm ?? "").trim();
                        if (!id && !name) return null;
                        return {
                            id: id || `${actualDepartmentCode(dept)}-${index}`,
                            name: name || id,
                            position,
                        };
                    })
                    .filter(Boolean);
            }

            // normalizeNotificationSubunits: API 데이터 정규화.
            function normalizeNotificationSubunits(dept) {
                const candidates = dept?.subunits ?? dept?.children ?? dept?.child_departments ?? dept?.childDepartments ?? [];
                const list = Array.isArray(candidates) ? candidates : candidates ? [candidates] : [];
                return list
                    .map((item) => {
                        if (typeof item === "string") return item.trim();
                        return String(item?.name ?? item?.dept_nm ?? item?.deptNm ?? item?.department_name ?? item?.departmentName ?? "").trim();
                    })
                    .filter(Boolean);
            }

            // notificationOrganizationName: 기능 처리.
            function notificationOrganizationName(dept) {
                return (
                    String(
                        dept?.organization ?? dept?.organization_name ?? dept?.organizationName ?? dept?.group_name ?? dept?.groupName ?? dept?.parent_name ?? dept?.parentName ?? dept?.upper_dept_nm ?? dept?.upperDeptNm ?? "부서 목록",
                    ).trim() || "부서 목록"
                );
            }

            // syncNotificationDirectoryFromDepartments: 상태 동기화.
            function syncNotificationDirectoryFromDepartments() {
                notificationDepartmentDirectory = actualDepartments
                    .map((dept) => {
                        const deptName = actualDepartmentName(dept);
                        const deptCode = actualDepartmentCode(dept);
                        if (!deptName || !deptCode) return null;
                        return {
                            organization: notificationOrganizationName(dept),
                            dept: deptName,
                            deptCode,
                            subunits: normalizeNotificationSubunits(dept),
                            staff: normalizeNotificationStaff(dept),
                            raw: dept,
                        };
                    })
                    .filter(Boolean);
                notificationOrganizationOrder = [...new Set(notificationDepartmentDirectory.map((item) => item.organization).filter(Boolean))];
                const nextAssignments = {};
                notificationDepartmentDirectory.forEach((group) => {
                    const savedIds = Array.isArray(notificationDepartmentAssignments[group.dept]) ? notificationDepartmentAssignments[group.dept] : [];
                    const validIds = new Set(group.staff.map((person) => person.id));
                    nextAssignments[group.dept] = savedIds.filter((id) => validIds.has(id));
                });
                notificationDepartmentAssignments = nextAssignments;
            }

            // resolveNotificationDepartmentName: 표시/매핑 값 결정.
            function resolveNotificationDepartmentName(value) {
                const target = String(value || "").trim();
                if (!target || target === "해당없음" || target === "AI 추천 대기") return "";
                const matched = findActualDepartmentByNameOrCode(target);
                return matched ? actualDepartmentName(matched) : target;
            }

            // splitNotificationDepartments: 기능 처리.
            function splitNotificationDepartments(value) {
                return [
                    ...new Set(
                        String(value || "")
                            .split(",")
                            .map(resolveNotificationDepartmentName)
                            .filter(Boolean),
                    ),
                ];
            }

            // questionTextWasModified: 기능 처리.
            function questionTextWasModified(query) {
                const fields = Array.isArray(query?.modifiedFields) ? query.modifiedFields : Array.isArray(query?.raw?.modified_fields) ? query.raw.modified_fields : [];
                return fields.map((value) => String(value)).includes("question_text");
            }

            // sortedDepartmentIds: 기능 처리.
            function sortedDepartmentIds(items) {
                return [
                    ...new Set(
                        (Array.isArray(items) ? items : [])
                            .map(actualDepartmentId)
                            .map((value) => String(value || "").trim())
                            .filter(Boolean),
                    ),
                ].sort();
            }

            // sameDepartmentIds: 기능 처리.
            function sameDepartmentIds(a, b) {
                return JSON.stringify(sortedDepartmentIds(a)) === JSON.stringify(sortedDepartmentIds(b));
            }

            // resolveReclassificationDepartments: 표시/매핑 값 결정.
            function resolveReclassificationDepartments(rawResult) {
                const mapped = mapActualQuestion(rawResult || {}, 0);
                /*
                 * 신규 text 분류 결과는 primary_departments가 비어 있고
                 * predicted_department(top-1)만 내려올 수도 있으므로
                 * mapActualQuestion의 displayPrimaryDepartments를 사용한다.
                 */
                const primaryDepartments = (Array.isArray(mapped.displayPrimaryDepartments) ? mapped.displayPrimaryDepartments : []).map((item) => findActualDepartmentByNameOrCode(item)).filter(Boolean);
                const supportDepartments = (Array.isArray(mapped.supportDepartments) ? mapped.supportDepartments : []).map((item) => findActualDepartmentByNameOrCode(item)).filter(Boolean);
                return {
                    mapped,
                    primaryDepartments,
                    supportDepartments,
                };
            }

            // validateReclassificationDepartments: 유효성 검증.
            function validateReclassificationDepartments(primaryDepartments, supportDepartments) {
                if (!primaryDepartments.length) {
                    return "AI 재분류 결과에 유효한 담당실국이 없습니다.";
                }
                const primaryIds = sortedDepartmentIds(primaryDepartments);
                const supportIds = sortedDepartmentIds(supportDepartments);
                if (primaryIds.length !== primaryDepartments.length || supportIds.length !== supportDepartments.length) {
                    return "AI 재분류 결과에 부서 마스터와 매칭되지 않는 값이 있습니다.";
                }
                const primarySet = new Set(primaryIds);
                if (supportIds.some((id) => primarySet.has(id))) {
                    return "AI 재분류 결과의 담당실국과 협조실국이 중복되어 적용할 수 없습니다.";
                }
                return "";
            }

            // waitForReclassificationJob: 비동기 처리 완료 대기.
            async function waitForReclassificationJob(jobId) {
                const id = String(jobId || "").trim();
                if (!id) {
                    throw new Error("AI 재분류 작업 ID가 없습니다.");
                }
                const maxAttempts = 40;
                for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
                    // [API 연동] GET ND_jobStatus.do: 재분류 작업 완료 여부를 반복 조회.
                    const job = await fetchJson(`ND_jobStatus.do?jobId=${encodeURIComponent(id)}`);
                    const status = normalizeActualStatus(job?.status);
                    if (status === "completed") {
                        return job;
                    }
                    if (status === "failed") {
                        throw new Error("AI 재분류 작업이 실패했습니다.");
                    }
                    await new Promise((resolve) => setTimeout(resolve, 750));
                }
                throw new Error("AI 재분류 응답 대기 시간이 초과되었습니다.");
            }

            // fetchTextReclassificationResult: 조회.
            async function fetchTextReclassificationResult(jobId) {
                const queryParams = new URLSearchParams();
                queryParams.append("jobId", String(jobId));
                queryParams.append("deleted", "false");
                queryParams.append("page", "1");
                queryParams.append("size", "50");
                /*
                 * text 직접 분류는 document_id가 없으므로 job_id만으로 조회한다.
                 */
                // [API 연동] GET ND_questions.do: 텍스트 재분류 결과 조회.
                const data = await fetchJson(`ND_questions.do?${queryParams.toString()}`);
                const rows = normalizeActualQuestions(data).filter(Boolean);
                if (!rows.length) {
                    throw new Error("AI 재분류 결과가 없습니다.");
                }
                if (rows.length !== 1) {
                    throw new Error(`AI 재분류 결과가 ${rows.length}건 반환되어 원 질의와 안전하게 매칭할 수 없습니다.`);
                }
                return rows[0];
            }

            // requestTextReclassification: API 요청.
            async function requestTextReclassification(questionText) {
                const textValue = String(questionText || "").trim();
                if (!textValue) {
                    throw new Error("재분류할 질의 내용이 비어 있습니다.");
                }
                const body = new URLSearchParams();
                /*
                 * API §3 /classify의 text 입력을 사용.
                 * documentIds와 text는 동시에 보내면 안 되므로 text만 보낸다.
                 */
                body.append("text", textValue);
                // [API 연동] POST ND_classify.do: 질의 텍스트의 AI 재분류 요청.
                const job = await fetchJson("ND_classify.do", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                    },
                    body: body.toString(),
                });
                const jobId = String(job?.job_id || "").trim();
                if (!jobId) {
                    throw new Error("AI 재분류 작업이 생성되지 않았습니다.");
                }
                await waitForReclassificationJob(jobId);
                return {
                    jobId,
                    rawResult: await fetchTextReclassificationResult(jobId),
                };
            }

            // mergeReclassifiedQuestion: 변경 결과 병합.
            function mergeReclassifiedQuestion(previous, updated, reclassifiedRaw, primaryDepartments, supportDepartments) {
                const responseQuestion = updated?.question ?? updated?.item ?? updated ?? {};
                const previousModifiedFields = Array.isArray(previous?.raw?.modified_fields) ? previous.raw.modified_fields : Array.isArray(previous?.modifiedFields) ? previous.modifiedFields : [];
                const responseModifiedFields = Array.isArray(responseQuestion?.modified_fields) ? responseQuestion.modified_fields : [];
                const mergedRaw = {
                    ...(previous.raw || {}),
                    ...(responseQuestion && typeof responseQuestion === "object" ? responseQuestion : {}),
                    question_id: previous.questionId,
                    question_text: previous.text,
                    primary_departments: primaryDepartments,
                    support_departments: supportDepartments,
                    modified_fields: [...new Set([...previousModifiedFields, ...responseModifiedFields, "question_text", "primary_department_ids", "support_department_ids"])],
                };
                /*
                 * §7 수정 API의 AI 추론 필드는 불변이므로 서버 원본을 억지로
                 * 덮어쓰지 않는다. 재분류 결과는 담당/협조실국 적용 판단에만 사용한다.
                 */
                const mapped = mapActualQuestion(mergedRaw, Math.max(0, Number(previous.id || 1) - 1));
                mapped.id = previous.id;
                mapped.questionId = previous.questionId;
                mapped.raw = mergedRaw;
                return mapped;
            }

            // requestAiReclassification: API 요청.
            function requestAiReclassification() {
                let modal = document.getElementById("aiReclassificationModal");
                if (!modal) {
                    const template = document.getElementById("aiReclassificationModalTemplate");
                    if (!template) return;
                    document.body.appendChild(template.content.cloneNode(true));
                    modal = document.getElementById("aiReclassificationModal");
                    window.AIOneModal?.init(modal);
                    modal.querySelector("[data-ai-reclassification-confirm]").addEventListener("click", () => {
                        window.AIOneModal?.close(modal);
                        confirmAiReclassification();
                    });
                }
                window.AIOneModal?.open(modal, document.activeElement);
            }

            // 확인 이후에만 기존 API 대상 조건을 검사한다.
            function confirmAiReclassification() {
                if (!uploadedFiles.length || !questions.length) {
                    showToast("재분류할 질의가 없습니다.");
                    return;
                }
                // Start: 261026 수정 - 직접 AI 재분류는 수정 여부와 무관하게 현재 대상 질의 처리
                const candidates = questions.filter((query) => !query.isDeleted && !query.isSubmitted && String(query.text || "").trim());
                if (!candidates.length) {
                    showToast("재분류할 수 있는 질의가 없습니다.");
                    return;
                }
                executeAiReclassification(candidates);
                // End: 261026 수정 - 직접 AI 재분류는 수정 여부와 무관하게 현재 대상 질의 처리
            }

            // executeAiReclassification: 기능 처리.
            async function executeAiReclassification(targetQueries = []) {
                const activeFile = uploadedFiles[activeFileIndex];
                if (!activeFile) {
                    showToast("재분류할 문서를 찾을 수 없습니다.");
                    return;
                }
                const candidates = Array.isArray(targetQueries) ? targetQueries.filter(Boolean) : [];
                if (!candidates.length) {
                    showToast("재분류 대상 질의가 없습니다.");
                    return;
                }
                // Start: 261026 수정 - 모든 AI 재분류 진입점의 공통 로딩
                showIntakeSkeleton("변경된 질의 내용으로 AI 실국을 다시 추천하고 있습니다...");
                // End: 261026 수정 - 모든 AI 재분류 진입점의 공통 로딩
                let appliedCount = 0;
                let sameCount = 0;
                let blockedCount = 0;
                const errors = [];
                try {
                    if (window.AIOnePreview?.enabled) await new Promise((resolve) => setTimeout(resolve, 700));
                    for (const originalQuery of candidates) {
                        /*
                         * 1. 사용자가 PATCH로 저장한 현재 question_text를 그대로 사용.
                         * 2. API §3 text 직접 분류 호출.
                         */
                        const questionText = String(originalQuery.text || "").trim();
                        if (!questionText) {
                            blockedCount += 1;
                            errors.push(`Q${originalQuery.id}: 질의 내용이 비어 있음`);
                            continue;
                        }
                        let classifyResult;
                        try {
                            classifyResult = await requestTextReclassification(questionText);
                        } catch (error) {
                            blockedCount += 1;
                            errors.push(`Q${originalQuery.id}: ${error.message || "분류 결과 조회 실패"}`);
                            continue;
                        }
                        console.groupCollapsed(`[AI 재분류 디버그] Q${originalQuery.id} / job_id=${classifyResult.jobId}`);
                        console.log("1) /questions rawResult", classifyResult.rawResult);
                        const resolvedReclassification = resolveReclassificationDepartments(classifyResult.rawResult);
                        const { mapped: reclassifiedMappedForDebug, primaryDepartments, supportDepartments } = resolvedReclassification;
                        console.log("2) mapActualQuestion 결과", reclassifiedMappedForDebug);
                        console.log("3) AI 원본 부서값", {
                            primary_departments: classifyResult.rawResult?.primary_departments,
                            predicted_department: classifyResult.rawResult?.predicted_department,
                            support_departments: classifyResult.rawResult?.support_departments,
                        });
                        console.log("4) 부서 마스터 매핑 결과", {
                            primaryDepartments,
                            supportDepartments,
                            actualDepartmentCount: Array.isArray(actualDepartments) ? actualDepartments.length : 0,
                        });
                        console.groupEnd();
                        /*
                         * 3. 값 없음 / 마스터 미매칭 / 담당·협조 중복 validation.
                         */
                        const validationMessage = validateReclassificationDepartments(primaryDepartments, supportDepartments);
                        if (validationMessage) {
                            blockedCount += 1;
                            errors.push(`Q${originalQuery.id}: ${validationMessage}`);
                            continue;
                        }
                        const currentPrimary = Array.isArray(originalQuery.displayPrimaryDepartments) ? originalQuery.displayPrimaryDepartments : [];
                        const currentSupport = Array.isArray(originalQuery.supportDepartments) ? originalQuery.supportDepartments : [];
                        /*
                         * 4. 이전 화면 적용값과 AI 재분류 결과가 완전히 같으면
                         * PATCH를 호출하지 않는다.
                         */
                        const primarySame = sameDepartmentIds(currentPrimary, primaryDepartments);
                        const supportSame = sameDepartmentIds(currentSupport, supportDepartments);
                        if (primarySame && supportSame) {
                            sameCount += 1;
                            continue;
                        }
                        /*
                         * 5. 실제 값이 달라졌을 때만 기존 질의 수정 API를 호출한다.
                         */
                        let updated;
                        try {
                            updated = await applyReclassificationToOriginalQuestion(originalQuery, primaryDepartments, supportDepartments);
                        } catch (error) {
                            blockedCount += 1;
                            errors.push(`Q${originalQuery.id}: ${error.message || "질의 수정 실패"}`);
                            continue;
                        }
                        const mapped = mergeReclassifiedQuestion(originalQuery, updated, classifyResult.rawResult, primaryDepartments, supportDepartments);
                        const currentIndex = questions.findIndex((query) => String(query.questionId) === String(originalQuery.questionId) || Number(query.id) === Number(originalQuery.id));
                        if (currentIndex >= 0) {
                            questions[currentIndex] = mapped;
                        }
                        const fileQueries = fileDataMap[activeFile.name]?.queries;
                        if (Array.isArray(fileQueries)) {
                            const fileIndex = fileQueries.findIndex((query) => String(query.questionId) === String(originalQuery.questionId) || Number(query.id) === Number(originalQuery.id));
                            if (fileIndex >= 0) {
                                fileQueries[fileIndex] = mapped;
                            }
                        }
                        appliedCount += 1;
                    }
                    renderQueryList();
                    renderQueryDetailPanel(questions.filter((query) => !query.isDeleted));
                    const fileKey = getActiveConfirmKey();
                    fileConfirmState[fileKey] = "confirm";
                    delete confirmedQuerySnapshots[fileKey];
                    updateConfirmBtnUI();
                    if (appliedCount > 0) {
                        showToast(`AI 재분류 완료: ${appliedCount}건 변경 적용 · ${sameCount}건 동일 · ${blockedCount}건 미적용`);
                    } else if (sameCount > 0 && blockedCount === 0) {
                        showToast("AI 재분류 결과가 기존 담당/협조실국과 동일하여 변경하지 않았습니다.");
                    } else {
                        showToast(`AI 재분류 결과를 적용하지 않았습니다. 동일 ${sameCount}건 · 검증 실패 ${blockedCount}건`);
                    }
                    if (errors.length) {
                        console.warn("AI 재분류 미적용 상세", errors);
                    }
                    if (appliedCount > 0 && window.AIOneNotifications) {
                        window.AIOneNotifications.notifyLongTask("질의 재분류 완료", `AI 재분류 결과 ${appliedCount}건의 담당/협조실국이 갱신되었습니다.`, "intake");
                    }
                } finally {
                    hideIntakeSkeleton();
                }
            }

            // buildDefaultNotificationAssignments: 화면/데이터 구성.
            function buildDefaultNotificationAssignments() {
                return notificationDepartmentDirectory.reduce((result, group) => {
                    result[group.dept] = group.staff.slice(0, 2).map((person) => person.id);
                    return result;
                }, {});
            }

            // loadNotificationAssignees: 조회/로딩.
            function loadNotificationAssignees() {
                notificationDepartmentAssignments = buildDefaultNotificationAssignments();
            }

            // saveNotificationAssignees: 저장.
            function saveNotificationAssignees() {
                updateNotificationAssigneeButton();
            }

            // getNotificationDepartmentGroup: 값 조회.
            function getNotificationDepartmentGroup(dept) {
                return notificationDepartmentDirectory.find((group) => group.dept === dept) || null;
            }

            // getNotificationDepartmentsForQueries: 값 조회.
            function getNotificationDepartmentsForQueries(queries = questions) {
                const departments = [];
                (queries || []).forEach((query) => {
                    [...splitNotificationDepartments(query.mainDept), ...splitNotificationDepartments(query.coopDept)].forEach((dept) => {
                        if (!departments.includes(dept)) departments.push(dept);
                    });
                });
                return departments;
            }

            // getNotificationRoutingForQueries: 값 조회.
            function getNotificationRoutingForQueries(queries = questions) {
                const sourceQueries = Array.isArray(queries) ? queries : [];
                const departments = getNotificationDepartmentsForQueries(sourceQueries).map((dept) => {
                    const group = getNotificationDepartmentGroup(dept);
                    const selectedIds = Array.isArray(notificationDepartmentAssignments[dept]) ? notificationDepartmentAssignments[dept] : [];
                    const recipients = group ? group.staff.filter((person) => selectedIds.includes(person.id)).map((person) => ({ ...person, dept })) : [];
                    const matchedQueries = sourceQueries.flatMap((query, index) => {
                        const roles = [];
                        if (splitNotificationDepartments(query.mainDept).includes(dept)) roles.push("담당");
                        if (splitNotificationDepartments(query.coopDept).includes(dept)) roles.push("협조");
                        if (!roles.length) return [];
                        return [
                            {
                                id: query.id,
                                number: query.number || index + 1,
                                title: query.summary || query.text || `질의 ${index + 1}`,
                                role: roles.join("·"),
                            },
                        ];
                    });
                    return { dept, recipients, queries: matchedQueries, configured: recipients.length > 0 };
                });
                const uniqueRecipients = [];
                const recipientKeys = new Set();
                departments.forEach((route) => {
                    route.recipients.forEach((person) => {
                        const key = `${route.dept}:${person.id}`;
                        if (recipientKeys.has(key)) return;
                        recipientKeys.add(key);
                        uniqueRecipients.push(person);
                    });
                });
                return { departments, recipients: uniqueRecipients };
            }

            // updateNotificationAssigneeButton: 상태/데이터 수정.
            function updateNotificationAssigneeButton() {
                const button = $("#notificationAssigneeBtn");
                if (!button) return;
                const configuredDepartmentCount = notificationDepartmentDirectory.filter((group) => {
                    const selected = notificationDepartmentAssignments[group.dept] || [];
                    return selected.length > 0;
                }).length;
                button.classList.toggle("has-assignee", configuredDepartmentCount > 0);
                button.title = "실국별 알림 담당자 설정";
            }

            // openNotificationAssigneeModal: 화면/팝업 열기.
            function openNotificationAssigneeModal() {
                const appRoot = $("#classificationApp");
                let modal = $("#notificationAssigneeDrawer");
                if (!modal) {
                    modal = document.createElement("div");
                    modal.id = "notificationAssigneeDrawer";
                    modal.className = "drawer notification-assignee-drawer hidden";
                    modal.setAttribute("data-sidepop", "");
                }
                modal.setAttribute("data-sidepop", "");
                if (appRoot && modal.parentElement !== appRoot) {
                    appRoot.appendChild(modal);
                } else if (!modal.parentElement) {
                    document.body.appendChild(modal);
                }
                // 룰 설정과 같은 종류의 우측 drawer이므로 동시에 열리지 않게 정리
                window.AIOneSidePop?.close("#workspaceRuleSettingsSidepop");
                const workingAssignments = notificationDepartmentDirectory.reduce((result, group) => {
                    const saved = notificationDepartmentAssignments[group.dept];
                    result[group.dept] = Array.isArray(saved) ? [...saved] : group.staff.slice(0, 2).map((person) => person.id);
                    return result;
                }, {});
                modal.innerHTML = `
                <button
                  aria-label="실국별 알림 담당자 설정 닫기"
                  class="drawer-backdrop"
                  id="notificationDrawerBackdrop"
                  data-sidepop-close
                  type="button"
                ></button>
                <aside
                  aria-label="실국별 알림 담당자 설정"
                  aria-modal="true"
                  class="drawer-contents drawer-xlarge drawer-variant-content"
                  data-sidepop-size="xlarge"
                  data-sidepop-variant="content"
                  role="dialog"
                >
                  <section class="drawer-content-panel" data-sidepop-panel="content">
                    <header class="drawer-header">
                      <div class="drawer-heading">
                        <h2 class="drawer-title">실국별 알림 담당자 설정</h2>
                        <p class="drawer-description">
                          재정경제부 조직도 기준으로 알림을 받을 실국담당자를 지정합니다.
                          주관국·협조국 확정 후 지정된 담당자에게 알림이 전송됩니다.
                        </p>
                      </div>
                      <button
                        class="icon-button icon-button-ghost"
                        id="notificationModalClose"
                        data-sidepop-close
                        type="button"
                        aria-label="닫기"
                      >×</button>
                    </header>
                    <div class="drawer-body notification-assignee-drawer-body" data-slot="body">
                      <div class="notification-process-note">
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M3 12h18"/><circle cx="12" cy="12" r="9"/></svg>
                      <span>재정경제부 조직도에서 부총리·차관 소관 조직을 선택한 후 실국별 알림 담당자를 지정합니다. 질의 확정 시 주관국·협조국을 기준으로 수신자가 자동 설정됩니다.</span>
                      </div>
                      <div class="notification-org-layout">
                      <aside class="notification-org-panel" aria-label="조직 선택">
                      <div class="notification-org-panel-title">조직 선택</div>
                      <div class="notification-org-list" id="notificationOrgList"></div>
                      </aside>
                      <section class="notification-dept-panel">
                      <div class="notification-dept-toolbar">
                      <label class="notification-dept-search" for="notificationDeptSearch">
                      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/></svg>
                      <input id="notificationDeptSearch" type="search" placeholder="실국명 또는 담당자 검색" autocomplete="off">
                      <button id="notificationDeptSearchClear" class="notification-dept-search-clear hidden" type="button" aria-label="검색어 지우기">×</button>
                      </label>
                      <div class="notification-dept-result" id="notificationDeptResult"></div>
                      </div>
                      <div class="notification-dept-grid" id="notificationDeptGrid"></div>
                      </section>
                      </div>
                      <div class="notification-dept-feedback" id="notificationDeptFeedback" aria-live="polite"></div>
                    </div>
                    <footer class="drawer-footer notification-assignee-drawer-footer" data-slot="footer">
                      <button class="button button-outline" id="notificationModalCancel" data-sidepop-close type="button">취소</button>
                      <button class="button button-primary" id="notificationModalSave" type="button">설정 저장</button>
                    </footer>
                  </section>
                </aside>
              `;
                window.AIOneSidePop?.init(modal);
                window.AIOneSidePop?.open(modal, $("#notificationAssigneeBtn"));
                const grid = $("#notificationDeptGrid");
                const orgList = $("#notificationOrgList");
                const deptSearch = $("#notificationDeptSearch");
                const deptSearchClear = $("#notificationDeptSearchClear");
                const deptResult = $("#notificationDeptResult");
                const feedback = $("#notificationDeptFeedback");
                let selectedOrganization = "all";
                let departmentSearchTerm = "";
                const setFeedback = (message = "", type = "") => {
                    if (!feedback) return;
                    feedback.textContent = message;
                    feedback.className = `notification-dept-feedback${type ? ` ${type}` : ""}`;
                };
                const getVisibleDepartments = () => {
                    const normalizedTerm = departmentSearchTerm.trim().toLowerCase();
                    return notificationDepartmentDirectory.filter((group) => {
                        const organizationMatched =
                            selectedOrganization === "all" ||
                            (selectedOrganization.startsWith("org:") && group.organization === selectedOrganization.slice(4)) ||
                            (selectedOrganization.startsWith("dept:") && group.dept === selectedOrganization.slice(5));
                        if (!organizationMatched) return false;
                        if (!normalizedTerm) return true;
                        const searchable = [group.organization, group.dept, ...(group.subunits || []), ...group.staff.flatMap((person) => [person.name, person.position])].join(" ").toLowerCase();
                        return searchable.includes(normalizedTerm);
                    });
                };
                const expandedOrganizations = new Set(notificationOrganizationOrder);
                const renderOrganizationList = () => {
                    if (!orgList) return;
                    const specialItems = [{ key: "all", label: "전체 조직", count: notificationDepartmentDirectory.length }];
                    const specialHtml = specialItems
                        .map((item) => {
                            const selected = selectedOrganization === item.key;
                            return `<button class="notification-org-item notification-tree-special${selected ? " selected" : ""}" type="button" data-organization="${escapeHtml(item.key)}" aria-pressed="${selected}">
                    <span>${escapeHtml(item.label)}</span><strong>${item.count}</strong>
                  </button>`;
                        })
                        .join("");
                    const treeHtml = notificationOrganizationOrder
                        .map((organization) => {
                            const groups = notificationDepartmentDirectory.filter((group) => group.organization === organization);
                            const expanded = expandedOrganizations.has(organization);
                            const orgKey = `org:${organization}`;
                            const orgSelected = selectedOrganization === orgKey;
                            return `<div class="notification-tree-group${expanded ? " expanded" : ""}">
                    <button class="notification-tree-parent${orgSelected ? " selected" : ""}" type="button" data-tree-org="${escapeHtml(organization)}" aria-expanded="${expanded}" aria-pressed="${orgSelected}">
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>
                      <span>${escapeHtml(organization)}</span><strong>${groups.length}</strong>
                    </button>
                    <div class="notification-tree-children${expanded ? "" : " hidden"}">
                      ${groups
                          .map((group) => {
                              const deptKey = `dept:${group.dept}`;
                              const selected = selectedOrganization === deptKey;
                              return `<button class="notification-tree-leaf${selected ? " selected" : ""}" type="button" data-tree-dept="${escapeHtml(group.dept)}" aria-pressed="${selected}">
                          <span>${escapeHtml(group.dept)}</span>
                        </button>`;
                          })
                          .join("")}
                    </div>
                  </div>`;
                        })
                        .join("");
                    orgList.innerHTML = specialHtml + treeHtml;
                    $$(".notification-tree-special", orgList).forEach((button) => {
                        button.addEventListener("click", () => {
                            selectedOrganization = button.dataset.organization || "all";
                            setFeedback("");
                            renderDepartmentSettings();
                        });
                    });
                    $$(".notification-tree-parent", orgList).forEach((button) => {
                        button.addEventListener("click", () => {
                            const organization = button.dataset.treeOrg || "";
                            if (!organization) return;
                            if (expandedOrganizations.has(organization)) expandedOrganizations.delete(organization);
                            else expandedOrganizations.add(organization);
                            selectedOrganization = `org:${organization}`;
                            setFeedback("");
                            renderDepartmentSettings();
                        });
                    });
                    $$(".notification-tree-leaf", orgList).forEach((button) => {
                        button.addEventListener("click", (event) => {
                            event.stopPropagation();
                            selectedOrganization = `dept:${button.dataset.treeDept || ""}`;
                            setFeedback("");
                            renderDepartmentSettings();
                        });
                    });
                };
                const renderDepartmentSettings = () => {
                    renderOrganizationList();
                    const visibleDepartments = getVisibleDepartments();
                    if (deptResult) {
                        const organizationLabel =
                            selectedOrganization === "all"
                                ? "전체 조직"
                                : selectedOrganization.startsWith("org:")
                                  ? selectedOrganization.slice(4)
                                  : selectedOrganization.startsWith("dept:")
                                    ? selectedOrganization.slice(5)
                                    : selectedOrganization;
                        deptResult.textContent = `${organizationLabel} · ${visibleDepartments.length}개 조직`;
                    }
                    if (deptSearchClear) deptSearchClear.classList.toggle("hidden", !departmentSearchTerm);
                    if (!visibleDepartments.length) {
                        grid.innerHTML = `<div class="notification-dept-empty">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/></svg>
                    <strong class="empty-title">조건에 맞는 실국이 없습니다.</strong>
                    <span class="empty-desc">다른 조직을 선택하거나 검색어를 변경해 주세요.</span>
                  </div>`;
                        return;
                    }
                    grid.innerHTML = visibleDepartments
                        .map((group) => {
                            const groupIndex = notificationDepartmentDirectory.indexOf(group);
                            const selectedIds = workingAssignments[group.dept] || [];
                            return `<section class="notification-dept-card" data-dept-index="${groupIndex}">
                    <div class="notification-dept-card-head">
                      <div class="notification-dept-heading">
                        <span class="notification-dept-org">${escapeHtml(group.organization)}</span>
                        <div class="notification-dept-name">${escapeHtml(group.dept)}</div>
                      </div>
                      <span class="notification-dept-count">${selectedIds.length}명</span>
                    </div>
                    ${(group.subunits || []).length ? `<div class="notification-dept-subunits" title="${escapeHtml((group.subunits || []).join(" · "))}">${(group.subunits || []).map((unit) => `<span>${escapeHtml(unit)}</span>`).join("")}</div>` : ""}
                    <div class="notification-dept-staff-list">
                      ${group.staff
                          .map((person) => {
                              const selected = selectedIds.includes(person.id);
                              return `<button class="notification-dept-staff${selected ? " selected" : ""}" type="button" data-dept-index="${groupIndex}" data-person-id="${person.id}" aria-pressed="${selected}">
                          <span class="notification-assignee-avatar">${escapeHtml(person.name.slice(0, 1))}</span>
                          <span class="notification-assignee-info">
                            <span class="notification-assignee-name">${escapeHtml(person.name)} ${escapeHtml(person.position)}</span>
                            <span class="notification-assignee-meta">${escapeHtml(group.dept)}${selected ? " · 실국담당자" : ""}</span>
                          </span>
                          <span class="notification-check" aria-hidden="true">${selected ? "✓" : ""}</span>
                        </button>`;
                          })
                          .join("")}
                    </div>
                  </section>`;
                        })
                        .join("");
                    $$(".notification-dept-staff", grid).forEach((button) => {
                        button.addEventListener("click", () => {
                            const group = notificationDepartmentDirectory[Number(button.dataset.deptIndex)];
                            if (!group) return;
                            const personId = button.dataset.personId;
                            const selectedIds = workingAssignments[group.dept] || [];
                            const isSelected = selectedIds.includes(personId);
                            workingAssignments[group.dept] = isSelected ? selectedIds.filter((id) => id !== personId) : [...selectedIds, personId];
                            setFeedback(`${group.dept} 담당자 ${workingAssignments[group.dept].length}명이 지정되었습니다.`, "success");
                            renderDepartmentSettings();
                        });
                    });
                };
                deptSearch?.addEventListener("input", () => {
                    departmentSearchTerm = deptSearch.value || "";
                    renderDepartmentSettings();
                });
                deptSearchClear?.addEventListener("click", () => {
                    departmentSearchTerm = "";
                    if (deptSearch) {
                        deptSearch.value = "";
                        deptSearch.focus();
                    }
                    renderDepartmentSettings();
                });
                const close = () => window.AIOneSidePop?.close(modal);
                $("#notificationModalSave")?.addEventListener("click", () => {
                    notificationDepartmentAssignments = Object.fromEntries(Object.entries(workingAssignments).map(([dept, ids]) => [dept, [...ids]]));
                    saveNotificationAssignees();
                    close();
                    showToast(`조직 ${notificationDepartmentDirectory.length}개의 알림 담당자 설정을 저장했습니다.`);
                });
                renderDepartmentSettings();
            }

            // actualDepartmentId: 기능 처리.
            function actualDepartmentId(dept) {
                if (dept == null) return "";
                if (typeof dept === "string" || typeof dept === "number") return String(dept);
                return String(dept?.id ?? dept?.department_id ?? dept?.departmentId ?? dept?.code ?? dept?.dept_cd ?? dept?.deptCd ?? "");
            }

            // actualDepartmentCode: 기능 처리.
            function actualDepartmentCode(dept) {
                if (dept == null) return "";
                if (typeof dept === "string" || typeof dept === "number") {
                    const value = String(dept).trim();
                    const matched = actualDepartments.find((item) => {
                        const code = String(item?.dept_cd ?? item?.deptCd ?? item?.code ?? "").trim();
                        const name = String(item?.dept_nm ?? item?.deptNm ?? item?.name ?? item?.department_name ?? item?.departmentName ?? "").trim();
                        return code === value || name === value;
                    });
                    return matched ? String(matched?.dept_cd ?? matched?.deptCd ?? matched?.code ?? actualDepartmentId(matched) ?? "") : value;
                }
                return String(dept?.dept_cd ?? dept?.deptCd ?? dept?.code ?? dept?.id ?? dept?.department_id ?? dept?.departmentId ?? "");
            }

            // findActualDepartmentByNameOrCode: 대상 검색.
            function findActualDepartmentByNameOrCode(value) {
                if (value == null) return null;
                /*
                 * AI 분류 결과의 primary_departments / predicted_department는
                 * { id: 'D04', name: '경제정책국' } 같은 객체로 내려온다.
                 *
                 * 기존 코드는 String(value) => '[object Object]' 로 만들어
                 * 부서 마스터 매칭이 전부 실패했다.
                 */
                const targetId = actualDepartmentId(value).trim();
                const targetCode = actualDepartmentCode(value).trim();
                const targetName = actualDepartmentName(value).trim();
                if (!targetId && !targetCode && !targetName) {
                    return null;
                }
                return (
                    actualDepartments.find((item) => {
                        const itemId = actualDepartmentId(item).trim();
                        const itemCode = actualDepartmentCode(item).trim();
                        const itemName = actualDepartmentName(item).trim();
                        return (targetId && (itemId === targetId || itemCode === targetId)) || (targetCode && (itemId === targetCode || itemCode === targetCode)) || (targetName && itemName === targetName);
                    }) || null
                );
            }

            // actualDepartmentName: 기능 처리.
            function actualDepartmentName(dept) {
                if (dept == null) return "";
                // 문자열/숫자라면 dept_cd일 수 있으므로 실제 부서목록에서 명칭을 먼저 찾는다.
                if (typeof dept === "string" || typeof dept === "number") {
                    const code = String(dept);
                    const matched = actualDepartments.find((item) => actualDepartmentId(item) === code);
                    if (matched) {
                        return String(matched?.name ?? matched?.department_name ?? matched?.departmentName ?? matched?.label ?? matched?.dept_name ?? matched?.deptName ?? matched?.dept_nm ?? matched?.deptNm ?? code);
                    }
                    return code;
                }
                return String(dept?.name ?? dept?.department_name ?? dept?.departmentName ?? dept?.label ?? dept?.dept_name ?? dept?.deptName ?? dept?.dept_nm ?? dept?.deptNm ?? "");
            }

            // resolveActualDepartmentName: 표시/매핑 값 결정.
            function resolveActualDepartmentName(dept) {
                const name = actualDepartmentName(dept);
                const id = actualDepartmentId(dept);
                if ((!name || name === id) && id) {
                    const matched = actualDepartments.find((item) => actualDepartmentId(item) === id);
                    if (matched) return actualDepartmentName(matched) || id;
                }
                return name || id;
            }

            // mapActualQuestion: API 데이터를 화면 모델로 변환.
            function mapActualQuestion(question, index) {
                const primaryCandidates = question?.primary_departments ?? question?.primaryDepartments ?? [];
                const primaries = Array.isArray(primaryCandidates) ? primaryCandidates.filter(Boolean) : primaryCandidates ? [primaryCandidates] : [];
                const supportCandidates = question?.support_departments ?? question?.supportDepartments ?? [];
                const support = Array.isArray(supportCandidates) ? supportCandidates.filter(Boolean) : supportCandidates ? [supportCandidates] : [];
                const modifiedFields = Array.isArray(question?.modified_fields) ? question.modified_fields.map((value) => String(value)) : [];
                /*
                 * v1.4+ API에서 사용자가 담당실국을 수정하면 modified_fields에
                 * primary_department_ids 가 누적된다.
                 *
                 * - 미수정 + primary_departments=[]:
                 *   아직 확정 전이므로 predicted_department를 화면 추천값으로 사용
                 * - 수정됨 + primary_departments=[]:
                 *   사용자가 명시적으로 담당실국을 비운 것 = 비소관
                 *   predicted_department로 절대 되돌리면 안 됨
                 */
                const primaryWasModified = modifiedFields.includes("primary_department_ids") || modifiedFields.includes("primary_departments") || modifiedFields.includes("primary_department_id");
                const supportWasModified = modifiedFields.includes("support_department_ids") || modifiedFields.includes("support_departments") || modifiedFields.includes("support_department_id");
                const predicted = question?.predicted_department ?? question?.predictedDepartment ?? null;
                const displayPrimaries = primaries.length ? primaries : !primaryWasModified && predicted ? [predicted] : [];
                const primaryNames = displayPrimaries.map(resolveActualDepartmentName).filter(Boolean);
                const primaryIds = displayPrimaries.map(actualDepartmentId).filter(Boolean);
                const hasPrimary = primaryNames.length > 0 || primaryIds.length > 0;
                const type = !hasPrimary ? "none" : displayPrimaries.length > 1 || support.length > 0 ? "multi" : "single";
                const typeLabel = type === "multi" ? "복수소관" : type === "none" ? "비소관" : "단일소관";
                const questionId = String(question?.question_id ?? question?.id ?? "");
                if (questionId) actualQuestionRawMap.set(questionId, question);
                const explicitOrg = String(question?.organization_name ?? question?.organizationName ?? question?.organization ?? question?.agency_name ?? question?.agencyName ?? "").trim();
                const organization = explicitOrg || (hasPrimary ? "재정경제부" : "");
                const mappedQuestion = {
                    id: Number.isInteger(Number(question?.question_order)) && Number(question?.question_order) > 0 ? Number(question.question_order) : index + 1,
                    questionOrder: Number.isInteger(Number(question?.question_order)) && Number(question?.question_order) > 0 ? Number(question.question_order) : null,
                    questionId,
                    documentId: String(question?.document_id ?? ""),
                    jobId: String(question?.job_id ?? ""),
                    text: String(question?.question_text ?? question?.text ?? ""),
                    summary: String(question?.question_summary ?? question?.summary ?? question?.question_text ?? ""),
                    type,
                    typeLabel,
                    mainDept: hasPrimary ? primaryNames.join(", ") : "해당없음",
                    mainDeptId: primaryIds.join(","),
                    primaryDepartments: primaries,
                    displayPrimaryDepartments: displayPrimaries,
                    coopDept: support.map(resolveActualDepartmentName).filter(Boolean).join(", "),
                    supportDepartments: support,
                    org: organization,
                    confidence: Number(question?.confidence ?? question?.similarity ?? question?.score ?? 0),
                    predictedDepartment: predicted,
                    primaryWasModified,
                    supportWasModified,
                    isSubmitted: Boolean(question?.is_submitted),
                    submittedAt: question?.submitted_at || null,
                    isDeleted: Boolean(question?.is_deleted),
                    deletedAt: question?.deleted_at || null,
                    modifiedFields,
                    modifiedBy: String(question?.modified_by ?? question?.modifiedBy ?? ""),
                    questioner: String(question?.questioner ?? question?.member_name ?? question?.memberName ?? question?.assembly_member_name ?? "").trim(),
                    party: String(
                        question?.party ??
                            question?.party_name ??
                            question?.partyName ??
                            question?.negotiation_group_name ??
                            question?.affiliation ??
                            question?.affiliation_name ??
                            question?.affiliationName ??
                            question?.belong ??
                            question?.belong_name ??
                            question?.belongName ??
                            question?.organization_name ??
                            "",
                    ).trim(),
                    questionDate: String(question?.question_date ?? question?.questionDate ?? "").trim(),
                    committee: String(question?.committee_name ?? question?.committeeName ?? question?.committee ?? "").trim(),
                    raw: question,
                };
                return mappedQuestion;
            }

            // loadActualEmptyState: 조회/로딩.
            function loadActualEmptyState() {
                uploadedFiles.length = 0;
                questions.length = 0;
                activeFileIndex = -1;
                actualConversationId = null;
                actualFileMap.clear();
                actualQuestionRawMap.clear();
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
            <strong>원본 문서가 없습니다</strong>
            <span>질의 파일을 업로드하면 원본 문서가 표시됩니다.</span>
            <span>업로드한 문서를 선택하면 상세 내용을 확인할 수 있습니다.</span>
            </div>`;
                if (docContent)
                    docContent.innerHTML = `<div class="report-empty-state">
            <div class="no-file-icon" aria-hidden="true"><img src="../assets/icons/no-file.svg" alt=""></div>
            <strong>질의 추출 결과가 없습니다</strong>
            <span>질의 파일을 업로드하면 추출된 질의가 표시됩니다.</span>
            <span>분석이 완료되면 질의별 상세 내용을 확인할 수 있습니다.</span>
            </div>`;
                updateDocStatusBar("");
            }

            // createActualConversation: 생성.
            async function createActualConversation(title) {
                const body = new URLSearchParams();
                body.append("title", title || "국회질의 분류");
                // [API 연동] POST ND_createConversation.do: 질의분류용 새 대화 생성.
                const conversation = await fetchJson("ND_createConversation.do", {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    body: body.toString(),
                });
                const id = conversation?.id ?? conversation?.conversation_id;
                if (!id) throw new Error("대화 생성 응답에 conversation id가 없습니다.");
                actualConversationId = String(id);
                activeSessionId = actualConversationId;
                workspaceTitle = String(conversation?.title || title || "제목없는 국회질의").trim() || "제목없는 국회질의";
                renderWorkspaceMeta();
                try {
                    await loadConversationSettingsV15(actualConversationId);
                } catch (error) {
                    console.warn("신규 대화 설정 초기 조회 실패", error);
                }
                return actualConversationId;
            }

            // ensureActualConversation: 필요 요소/상태 보장.
            async function ensureActualConversation() {
                if (actualConversationId) return actualConversationId;
                return createActualConversation(workspaceTitle || "국회질의 분류");
            }

            // ensureEditDepartmentMultiUi: 필요 요소/상태 보장.
            function ensureEditDepartmentMultiUi() {
                const main = $("#editMainDept");
                const coop = $("#editCoopDept");
                const setup = (baseSelect, kind) => {
                    if (!baseSelect) return;
                    const group = baseSelect.closest(".form-group");
                    if (!group) return;
                    const isPrimary = kind === "primary";
                    const secondId = isPrimary ? "editMainDept2" : "editCoopDept2";
                    const rowClass = isPrimary ? "edit-primary-dept-row" : "edit-support-dept-row";
                    if (group.querySelector(`.${rowClass}`)) {
                        return;
                    }
                    const firstRow = document.createElement("div");
                    firstRow.className = `${rowClass} edit-dept-row edit-dept-row-first`;
                    baseSelect.parentNode.insertBefore(firstRow, baseSelect);
                    firstRow.appendChild(baseSelect);
                    const addBtn = document.createElement("button");
                    addBtn.type = "button";
                    addBtn.className = "edit-dept-row-btn edit-dept-add-btn";
                    addBtn.setAttribute("aria-label", isPrimary ? "담당실국 추가" : "협조실국 추가");
                    addBtn.title = isPrimary ? "담당실국 추가" : "협조실국 추가";
                    addBtn.textContent = "+";
                    firstRow.appendChild(addBtn);
                    const secondRow = document.createElement("div");
                    secondRow.className = `${rowClass} edit-dept-row edit-dept-row-second`;
                    const secondSelect = document.createElement("select");
                    secondSelect.id = secondId;
                    secondSelect.className = "form-select";
                    const removeBtn = document.createElement("button");
                    removeBtn.type = "button";
                    removeBtn.className = "edit-dept-row-btn edit-dept-remove-btn";
                    removeBtn.setAttribute("aria-label", isPrimary ? "두 번째 담당실국 삭제" : "두 번째 협조실국 삭제");
                    removeBtn.title = isPrimary ? "두 번째 담당실국 삭제" : "두 번째 협조실국 삭제";
                    removeBtn.textContent = "−";
                    secondRow.appendChild(secondSelect);
                    secondRow.appendChild(removeBtn);
                    firstRow.insertAdjacentElement("afterend", secondRow);
                    addBtn.addEventListener("click", () => {
                        if (addBtn.disabled) {
                            return;
                        }
                        secondRow.style.removeProperty("display");
                        secondRow.classList.add("is-visible");
                        secondSelect.disabled = false;
                        secondSelect.focus();
                        addBtn.disabled = true;
                    });
                    removeBtn.addEventListener("click", () => {
                        secondSelect.value = "";
                        secondRow.classList.remove("is-visible");
                        secondRow.style.removeProperty("display");
                        secondSelect.disabled = true;
                        addBtn.disabled = false;
                        syncEditTypeFromDepartments();
                    });
                    baseSelect.addEventListener("change", () => {
                        const valid = validateEditDepartmentDuplicate(baseSelect);
                        if (valid) syncEditTypeFromDepartments();
                    });
                    secondSelect.addEventListener("change", () => {
                        const valid = validateEditDepartmentDuplicate(secondSelect);
                        if (valid) syncEditTypeFromDepartments();
                    });
                };
                setup(main, "primary");
                setup(coop, "support");
            }

            // setSecondDepartmentRow: 상태 설정.
            function setSecondDepartmentRow(kind, value = "") {
                const isPrimary = kind === "primary";
                const secondId = isPrimary ? "editMainDept2" : "editCoopDept2";
                const rowClass = isPrimary ? "edit-primary-dept-row" : "edit-support-dept-row";
                const secondSelect = $(`#${secondId}`);
                const rows = $$(`.${rowClass}`);
                const firstRow = rows.find((row) => row.classList.contains("edit-dept-row-first"));
                const secondRow = rows.find((row) => row.classList.contains("edit-dept-row-second"));
                const addBtn = firstRow?.querySelector(".edit-dept-add-btn");
                if (!secondSelect || !secondRow || !addBtn) {
                    return;
                }
                const hasValue = Boolean(String(value || "").trim());
                secondSelect.value = String(value || "");
                secondRow.style.removeProperty("display");
                secondRow.classList.toggle("is-visible", hasValue);
                secondSelect.disabled = !hasValue;
                addBtn.disabled = hasValue;
            }

            // rawSelectedDepartmentCodes: 기능 처리.
            function rawSelectedDepartmentCodes(kind) {
                const ids = kind === "primary" ? ["editMainDept", "editMainDept2"] : ["editCoopDept", "editCoopDept2"];
                return ids.map((id) => String($(`#${id}`)?.value || "").trim()).filter(Boolean);
            }

            function syncEditTypeFromDepartments() {
                const typeSelect = $("#editType");
                if (!typeSelect) return;
                const primaryCount = rawSelectedDepartmentCodes("primary").length;
                const supportCount = rawSelectedDepartmentCodes("support").length;
                const nextType = primaryCount === 0 ? "none" : primaryCount > 1 || supportCount > 0 ? "multi" : "single";
                if (typeSelect.value === nextType) return;
                typeSelect.value = nextType;
                syncEditTypeControls();
            }

            // validateEditDepartmentDuplicate: 유효성 검증.
            function validateEditDepartmentDuplicate(changedSelect = null) {
                const primary = rawSelectedDepartmentCodes("primary");
                const support = rawSelectedDepartmentCodes("support");
                const hasDuplicate = (values) => new Set(values).size !== values.length;
                let message = "";
                if (hasDuplicate(primary)) {
                    message = "같은 담당실국은 중복 선택할 수 없습니다.";
                } else if (hasDuplicate(support)) {
                    message = "같은 협조실국은 중복 선택할 수 없습니다.";
                } else {
                    const primarySet = new Set(primary);
                    if (support.some((code) => primarySet.has(code))) {
                        message = "담당실국과 협조실국에 같은 실국을 중복 선택할 수 없습니다.";
                    }
                }
                if (!message) return true;
                showToast(message);
                if (changedSelect) {
                    changedSelect.value = "";
                }
                return false;
            }

            // selectedDepartmentCodes: 기능 처리.
            function selectedDepartmentCodes(kind) {
                const ids = kind === "primary" ? ["editMainDept", "editMainDept2"] : ["editCoopDept", "editCoopDept2"];
                return [...new Set(ids.map((id) => String($(`#${id}`)?.value || "").trim()).filter(Boolean))];
            }

            // populateEditDepartmentSelects: 기능 처리.
            function populateEditDepartmentSelects(primaryValue = "", supportValue = "") {
                ensureEditDepartmentMultiUi();
                const main1 = $("#editMainDept");
                const main2 = $("#editMainDept2");
                const coop1 = $("#editCoopDept");
                const coop2 = $("#editCoopDept2");
                const departmentOptions = actualDepartments
                    .map((dept) => {
                        const code = actualDepartmentCode(dept);
                        const name = actualDepartmentName(dept) || code;
                        if (!code || !name) return "";
                        return `<option value="${escapeHtml(code)}">${escapeHtml(name)}</option>`;
                    })
                    .join("");
                const primaryList = Array.isArray(primaryValue) ? primaryValue : primaryValue ? [primaryValue] : [];
                const supportList = Array.isArray(supportValue) ? supportValue : supportValue ? [supportValue] : [];
                const toCode = (value) => {
                    const matched = findActualDepartmentByNameOrCode(value);
                    return matched ? actualDepartmentCode(matched) : actualDepartmentCode(value || "");
                };
                const primaryCodes = [...new Set(primaryList.map(toCode).filter(Boolean))].slice(0, 2);
                const supportCodes = [...new Set(supportList.map(toCode).filter(Boolean))].slice(0, 2);
                if (main1) {
                    main1.innerHTML = '<option value="">해당없음</option>' + departmentOptions;
                    main1.value = primaryCodes[0] || "";
                }
                if (main2) {
                    main2.innerHTML = '<option value="">실국 선택</option>' + departmentOptions;
                    main2.value = primaryCodes[1] || "";
                }
                if (coop1) {
                    coop1.innerHTML = '<option value="">협조실국 없음</option>' + departmentOptions;
                    coop1.value = supportCodes[0] || "";
                }
                if (coop2) {
                    coop2.innerHTML = '<option value="">실국 선택</option>' + departmentOptions;
                    coop2.value = supportCodes[1] || "";
                }
                setSecondDepartmentRow("primary", primaryCodes[1] || "");
                setSecondDepartmentRow("support", supportCodes[1] || "");
            }

            // loadActualDepartments: 조회/로딩.
            async function loadActualDepartments() {
                try {
                    // [API 연동] GET ND_departments.do: 부서 선택/분류에 사용할 실제 부서 목록 조회.
                    const data = await fetchJson("ND_departments.do");
                    actualDepartments = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : Array.isArray(data?.departments) ? data.departments : [];
                    syncNotificationDirectoryFromDepartments();
                    loadNotificationAssignees();
                    updateNotificationAssigneeButton();
                    const currentMainIds = selectedDepartmentCodes("primary");
                    const currentCoopIds = selectedDepartmentCodes("support");
                    populateEditDepartmentSelects(currentMainIds, currentCoopIds);
                    // 퍼블리싱 룰 설정 select도 API 부서목록으로만 구성한다.
                    const ruleDeptSelect = $("#ruleDept");
                    if (ruleDeptSelect) {
                        const selectedRuleDept = String(ruleDeptSelect.value || "");
                        ruleDeptSelect.innerHTML =
                            '<option value="">실국 선택</option>' +
                            actualDepartments
                                .map((dept) => {
                                    const id = actualDepartmentId(dept);
                                    const name = actualDepartmentName(dept);
                                    if (!id || !name) return "";
                                    return `<option value="${escapeHtml(name)}" data-dept-id="${escapeHtml(id)}">${escapeHtml(name)}</option>`;
                                })
                                .join("");
                        if (selectedRuleDept && [...ruleDeptSelect.options].some((option) => option.value === selectedRuleDept)) {
                            ruleDeptSelect.value = selectedRuleDept;
                        }
                    }
                    // 부서목록보다 질의결과가 먼저 로드된 경우, dept_cd가 화면에 남지 않도록 재매핑한다.
                    let remapped = false;
                    uploadedFiles.forEach((fileObj) => {
                        const data = fileDataMap[fileObj.name];
                        if (!Array.isArray(data?.queries) || !data.queries.length) return;
                        data.queries = data.queries.map((query, index) => {
                            if (!query?.raw) return query;
                            remapped = true;
                            return mapActualQuestion(query.raw, index);
                        });
                    });
                    if (remapped && activeFileIndex >= 0) {
                        loadFileData(activeFileIndex);
                    }
                } catch (error) {
                    console.error("부서 목록 조회 실패", error);
                }
            }

            Object.assign(runtime, {
                normalizeNotificationStaff,
                normalizeNotificationSubunits,
                notificationOrganizationName,
                syncNotificationDirectoryFromDepartments,
                resolveNotificationDepartmentName,
                splitNotificationDepartments,
                questionTextWasModified,
                sortedDepartmentIds,
                sameDepartmentIds,
                resolveReclassificationDepartments,
                validateReclassificationDepartments,
                waitForReclassificationJob,
                fetchTextReclassificationResult,
                requestTextReclassification,
                mergeReclassifiedQuestion,
                requestAiReclassification,
                executeAiReclassification,
                buildDefaultNotificationAssignments,
                loadNotificationAssignees,
                saveNotificationAssignees,
                getNotificationDepartmentGroup,
                getNotificationDepartmentsForQueries,
                getNotificationRoutingForQueries,
                updateNotificationAssigneeButton,
                openNotificationAssigneeModal,
                actualDepartmentId,
                actualDepartmentCode,
                findActualDepartmentByNameOrCode,
                actualDepartmentName,
                resolveActualDepartmentName,
                mapActualQuestion,
                loadActualEmptyState,
                createActualConversation,
                ensureActualConversation,
                ensureEditDepartmentMultiUi,
                setSecondDepartmentRow,
                rawSelectedDepartmentCodes,
                syncEditTypeFromDepartments,
                validateEditDepartmentDuplicate,
                selectedDepartmentCodes,
                populateEditDepartmentSelects,
                loadActualDepartments,
            });
        }
    };
})(window);
