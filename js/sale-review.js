/**
 * AI-ONE 매각 검증 전용 기능
 * 적용 화면: sale-review.html
 * 역할: 검토서·증빙 업로드 데이터, 원본 표시, 검증결과·필터·예시 다운로드
 * 연결: panel.css·panel.js 공통 패널을 사용하며 채팅은 panel-conversation.js의 공통 API/SSE 흐름을 사용합니다. 실제 검증 API는 별도 연결이 필요합니다.
 * - 261022 변경 - 패널 헤더·문서 틀·접기·보조도구·채팅 입력은 panel에 위임합니다.
 *
 * 261026 변경 요약
 * - 수정 - 분석 이력 Drawer 최초 표시 시 공통 목록 로딩 제공
 * - 수정 - 분석 제목 편집·내역 동기화 및 새 분석 제목 초기화
 * - 수정 - 검증 전·진행·완료 문구, 공통 로딩 UI, 재검증 버튼 비활성화 및 파일 변경·분석 전환 시 상태 초기화
 *
 * 기본 구간 형식: Start: 기능명 / End: 기능명
 * 변경 구간 형식: Start: YYMMDD 추가/수정 - 기능명 / End: YYMMDD 추가/수정 - 기능명
 * 주석 정리 내역
 * - 261023 주석 정리 - 구간 표시와 변경 내용 표기를 통일합니다. 기존 작업 날짜와 기능 설명은 유지합니다.
 * - 261023 수정 - 검증결과 필터 0건을 공통 빈 화면으로 표시
 */
(() => {
    "use strict";
    const $ = (id) => document.getElementById(id);

    const sampleDocument = $("saleDocumentPages").firstElementChild.cloneNode(true);
    const sampleChat = $("saleChatMessages").firstElementChild.cloneNode(true);
    const sampleName = "[붙임1] 매각표준검토서(복룡리 2필지).pdf";
    const files = new Map([
        [1, [{ name: sampleName, sample: true }]],
        [2, ["국내산커피_압해읍_스마트팜_육성지구.pdf", "2026년_토지보상비_예산서.pdf", "복룡리_1886_등기사항전부증명서.pdf", "토지이용계획확인서_복룡리_1886.pdf"].map((name) => ({ name, sample: true }))],
    ]);
    const results = [
        ["기본정보", "review", "대상 재산 · 면적 · 가격 · 이용현황", "소재지 인천광역시 옹진군 북도면 신도리 856-2, 면적 3,429.00m² 중 매각 990.00m², 가격 1,049,959,800원 정보를 확인했습니다.", "검토서 1쪽"],
        ["기준별 검토사항", "pass", "지자체 직접 공용·공공용 사용 · 사업계획 · 예산", "신안군의 직접 공용·공공용 사용 목적과 사업 시행자료를 점검했습니다.", "기준별검토서식"],
        ["매각 제한사항", "review", "처분 제한 및 특이사항", "매각제한 저촉사항 없음. 등기사항의 말소 완료 여부는 추가 확인이 필요합니다.", "검토의견"],
        ["승인·심의 기준", "pass", "승인권한 · 재승인 · 분할확정 · 심의여부", "검토서에 기재된 승인·처분 경로를 확인했습니다.", "검토의견"],
        ["첨부자료 및 증빙", "pass", "등기사항 · 토지이용계획 · 예산서", "검토서에 필요한 첨부자료와 증빙 목록을 확인했습니다.", "첨부자료"],
        ["매각 가격 검토", "review", "감정평가 · 예정가격", "매각 예정가격 확정 시 감정평가 결과와 유효기간을 확인해야 합니다.", "가격 검토"],
        ["대상 재산 현황", "pass", "소재지 · 면적 · 지목", "검토서와 첨부자료의 대상 재산 표시를 확인했습니다.", "대상 재산"],
        ["계약 및 사후관리", "pass", "계약조건 · 사용목적", "계약조건 및 목적 외 사용 제한 관련 기재사항을 확인했습니다.", "관리 처분 기준"],
        ["기본정보", "pass", "대상 재산 · 면적 · 가격 · 이용현황", "소재지 전라남도 신안군 압해읍 복룡리 1886 외 1필지, 면적 4,076.90m², 가격 60,057,410원 정보를 확인했습니다.", "검토서 1쪽"],
    ];
    let example = window.AIOnePreview?.enabled === true;
    if (!example) {
        files.set(1, []);
        files.set(2, []);
    }
    /* Start: 261026 수정 - 검증 상태 및 미리보기 타이머 */
    let verificationState = "ready";
    let verificationTimer = null;
    /* End: 261026 수정 - 검증 상태 및 미리보기 타이머 */
    let filter = "all";
    const expandedResults = new Set([results[0], results[8]]);
    let previewUrl = null;
    let activeFile = files.get(1)[0];
    // Start: 261026 수정 - 현재 분석 제목 관리
    let analysisTitle = example ? sampleName : window.AIOneWorkspaceUi.createDefaultWorkspaceTitle("매각 검토");
    let titleRuntime = null;
    function setAnalysisTitle(title) {
        analysisTitle = title;
        titleRuntime?.renderAnswerWorkspaceTitle();
    }
    // End: 261026 수정 - 현재 분석 제목 관리
    const notify = (message) => window.AIOneWorkspaceCommon.showToast(message);

    function renderFiles(group) {
        const list = $(`saleFileList${group}`);
        list.replaceChildren(
            ...files.get(group).map((file) => {
                const row = $("saleFileTemplate").content.firstElementChild.cloneNode(true);
                const icon = row.querySelector("[data-sale-file-icon]");
                const extension = file.name.split(".").pop().toLowerCase();
                const type = ["pdf", "hwp", "hwpx", "docx", "txt", "xls", "xlsx", "ppt", "pptx"].includes(extension) ? extension : "file";
                icon.className = `file-icon file-icon-collapsed ${type}`;
                icon.textContent = type.toUpperCase();
                row.querySelector("[data-sale-file-dot]").className = `file-icon file-dot ${type}`;
                const open = row.querySelector("[data-sale-file-open]");
                open.textContent = file.name;
                open.title = file.name;
                open.addEventListener("click", () => preview(file));
                const status = row.querySelector("[data-sale-file-status]");
                status.textContent = file.sample ? "업로드 완료" : "업로드 대기";
                status.classList.toggle("blue", file.sample === true);
                const remove = row.querySelector("[data-sale-file-remove]");
                remove.setAttribute("aria-label", `${file.name} 삭제`);
                remove.addEventListener("click", () => {
                    window.AIOneFileActions.confirmDelete({
                        title: () => file.name,
                        listName: group === 1 ? "검토서 파일 목록" : "검증자료 목록",
                        onDelete: () => {
                            files.set(group, files.get(group).filter((item) => item !== file));
                            invalidateResults();
                            renderFiles(group);
                            if (activeFile === file) preview(files.get(1)[0]);
                        },
                    }, remove);
                });
                return row;
            }),
        );
        if (!files.get(group).length) {
            const label = group === 1 ? "검토서 파일" : "검증자료";
            const empty = createContentEmpty(
                `등록된 ${label}이 없습니다`,
                group === 1 ? "검토서 파일 1건을 업로드해 주세요." : "검증에 필요한 자료를 업로드해 주세요.",
                "li",
                false,
            );
            empty.classList.add("generate-result-empty");
            list.append(empty);
        }
        $(`saleFileCount${group}`).textContent = String(files.get(group).length);
        $("saleFooterCount").textContent = `${files.get(2).length}건`;
    }

    /* Start: 261026 수정 - 검증 상태 전환 및 공통 로딩 UI */
    function invalidateResults() {
        example = false;
        resetVerification();
        syncVerification();
        renderResults();
    }

    // 검증 API 연결 전에는 미리보기 모드에서만 완료 결과를 표시한다.
    function syncVerification() {
        const count = `검토서 ${files.get(1).length}건과 검증자료 ${files.get(2).length}건`;
        const completed = verificationState === "completed";
        const loading = verificationState === "loading";
        $("saleVerify").textContent = completed ? "재검증" : "검증";
        $("saleVerify").disabled = completed || loading || !files.get(1).length;
        $("saleUploadStatus").textContent = !files.get(1).length
            ? "검토서 1건과 검증자료를 등록해 주세요."
            : loading ? `${count}의 검증을 수행하고 있습니다.`
            : completed ? `${count}의 검증을 완료하였습니다.`
            : `${count}의 검증을 수행할 수 있습니다.`;
    }

    function resetVerification() {
        clearTimeout(verificationTimer);
        verificationTimer = null;
        verificationState = "ready";
        window.AIOneLoadingOverlay.remove(".sale-verification-loading");
    }

    function showVerificationLoading() {
        const mount = (container, isPreview) => {
            const overlay = $("saleVerificationSkeletonTemplate").content.firstElementChild.cloneNode(true);
            overlay.classList.add(isPreview ? "answer-loading-preview" : "answer-loading-list");
            overlay.querySelector(".skeleton-loading-label").textContent = isPreview
                ? "검증을 수행하며 원본 미리보기와 근거 위치를 준비하고 있습니다."
                : "검증결과를 생성하고 있습니다";
            if (isPreview) {
                overlay.querySelector(".answer-skeleton-columns").remove();
                const title = document.createElement("strong");
                title.textContent = "검토서 원본을 불러오고 있습니다.";
                overlay.prepend(title);
            } else {
                overlay.querySelector(".answer-skeleton-preview").remove();
            }
            window.AIOneLoadingOverlay.mount({ container, overlay });
        };
        mount($("saleDocumentPages").closest(".doc-viewer-body"), true);
        mount($("saleResults"), false);
    }

    function startVerification() {
        if (verificationState !== "ready" || !files.get(1).length) return;
        if (!window.AIOnePreview?.enabled) {
            notify("파일은 등록되었습니다. 실제 검증은 API 연결 후 이용할 수 있습니다.");
            return;
        }
        verificationState = "loading";
        example = false;
        filter = "all";
        $("saleResultSearch").value = "";
        renderResults();
        syncVerification();
        showVerificationLoading();
        verificationTimer = setTimeout(() => {
            resetVerification();
            verificationState = "completed";
            example = true;
            preview(files.get(1)[0]);
            renderResults();
            syncVerification();
        }, 2400);
    }
    /* End: 261026 수정 - 검증 상태 전환 및 공통 로딩 UI */

    function createContentEmpty(title, description, tagName = "div", showIcon = true) {
        const empty = document.createElement(tagName);
        empty.className = "empty-state answer-recommend-empty sale-content-empty";
        if (showIcon) {
            const iconWrap = document.createElement("div");
            iconWrap.className = "no-file-icon";
            iconWrap.setAttribute("aria-hidden", "true");
            const icon = document.createElement("img");
            icon.src = "../assets/icons/no-file.svg";
            icon.alt = "";
            icon.setAttribute("aria-hidden", "true");
            iconWrap.append(icon);
            empty.append(iconWrap);
        }
        const heading = document.createElement("strong");
        if (tagName === "li") heading.classList.add("small", "gray");
        heading.textContent = title;
        const detail = document.createElement("span");
        detail.textContent = description;
        empty.append(heading, detail);
        return empty;
    }

    function preview(file) {
        /* Start: 261026 수정 - 검증 중 원본 미리보기 유지 */
        if (verificationState === "loading") return;
        /* End: 261026 수정 - 검증 중 원본 미리보기 유지 */
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        previewUrl = null;
        activeFile = file;
        const pages = $("saleDocumentPages");
        pages.replaceChildren();
        pages.classList.toggle("answer-pdfjs-preview", Boolean(file));
        $("salePreviewName").textContent = file?.name || "선택된 문서 없음";
        $("salePreviewName").classList.toggle("hidden", !file);
        // 분석 제목은 원본 미리보기 문서 선택과 별도로 유지한다.
        $("salePreviewStatus").textContent = file?.sample ? "예시 문서" : file ? "업로드 문서" : "문서 없음";

        if (file?.sample && file.name === sampleName) {
            pages.append(sampleDocument.cloneNode(true));
        } else if (file?.blob && (/\.pdf$/i.test(file.name) || /^image\//.test(file.blob.type))) {
            previewUrl = URL.createObjectURL(file.blob);
            const isImage = /^image\//.test(file.blob.type);
            const viewer = document.createElement(isImage ? "img" : "object");
            viewer.className = "sale-file-preview";
            if (isImage) {
                viewer.src = previewUrl;
                viewer.alt = file.name;
            } else {
                viewer.type = "application/pdf";
                viewer.data = previewUrl;
                viewer.setAttribute("aria-label", file.name);
                viewer.textContent = "이 브라우저에서는 PDF 미리보기를 지원하지 않습니다.";
            }
            pages.append(viewer);
        } else if (!file) {
            pages.append(createContentEmpty(
                "미리 볼 문서가 없습니다",
                "검토서와 검증자료를 업로드하면 선택한 문서를 여기에서 확인할 수 있습니다.",
            ));
            $("salePreviewStatus").textContent = "미리보기 대기";
        } else {
            pages.append(sampleDocument.cloneNode(true));
            $("salePreviewStatus").textContent = file.sample ? "원본 미첨부 · 미리보기 영역" : "미리보기 변환 API 연결 필요";
        }
        // PDF·이미지의 텍스트와 전체 페이지 수는 문서 변환 API 연결 후 제공한다.
        const pageCount = file?.sample && file.name === sampleName ? 1 : 0;
        $("salePageCurrent").textContent = String(pageCount);
        $("salePageTotal").textContent = String(pageCount);
        $("saleCharCount").textContent = "0";
    }

    function renderResults() {
        /* Start: 261026 수정 - 검증 중 결과 스켈레톤 유지 */
        if (verificationState === "loading" && verificationTimer !== null) return;
        /* End: 261026 수정 - 검증 중 결과 스켈레톤 유지 */
        const syncResultStates = [];
        const query = $("saleResultSearch").value.trim().toLowerCase();
        const source = example ? results : [];
        document.querySelectorAll("[data-sale-filter]").forEach((button) => {
            const key = button.dataset.saleFilter;
            button.classList.toggle("active", key === filter);
            button.setAttribute("aria-pressed", String(key === filter));
            button.querySelector("span").textContent = source.filter((item) => key === "all" || item[1] === key).length;
        });
        $("saleResultTotal").textContent = String(source.length);
        $("saleDownload").disabled = !source.length;
        const visible = source.filter((item) => (filter === "all" || item[1] === filter) && item.join(" ").toLowerCase().includes(query));
        $("saleResults").replaceChildren(
            ...visible.map((item) => {
                const card = $("saleResultTemplate").content.firstElementChild.cloneNode(true);
                const set = (key, value) => {
                    card.querySelector(`[data-sale-${key}]`).textContent = value;
                };
                set("number", String(results.indexOf(item) + 1).padStart(2, "0"));
                set("title", item[0]);
                set("criteria", item[2]);
                set("summary", item[3]);
                set("basis", item[4]);
                set("status", item[1] === "pass" ? "적합" : "확인 필요");
                set("count", item[1] === "pass" ? "적합 1 · 확인 0" : "적합 1 · 확인 1");
                card.querySelector("[data-sale-status]").classList.add(item[1] === "pass" ? "green" : "red");
                {
                    const isBasicInfo = item[0] === "기본정보";
                    const detail = $("saleBasicInfoDetailTemplate").content.firstElementChild.cloneNode(true);
                    detail.id = `saleBasicInfoDetail${results.indexOf(item) + 1}`;
                    detail.querySelector("[data-sale-detail-summary]").textContent = item[3];
                    detail.setAttribute("aria-label", `${item[0]} 상세 검증결과 · 예시`);
                    detail.querySelector("[data-sale-detail-title]").textContent = `${item[0]} 상세 검증결과`;
                    detail.querySelector("[data-sale-detail-basis]").textContent = `${item[4]} · 예시 데이터`;
                    set("count", item[1] === "pass" ? "적합 2 · 확인 0" : "적합 1 · 확인 1");
                    if (!isBasicInfo) {
                        const checks = detail.querySelectorAll(".sale-detail-check");
                        checks[0].querySelector("[data-sale-check-title]").textContent = "검토 항목";
                        checks[1].querySelector("[data-sale-check-title]").textContent = "검증 결과";
                        detail.querySelector("[data-sale-detail-property]").textContent = item[2];
                        detail.querySelector("[data-sale-detail-price]").textContent = item[3];
                        detail.querySelector("[data-sale-property-opinion]").textContent = "검토서에 기재된 해당 항목을 확인했습니다.";
                        detail.querySelector("[data-sale-detail-opinion]").textContent = item[3];
                        detail.querySelectorAll("[data-sale-check-basis]").forEach((basis) => {
                            basis.textContent = `근거 · ${item[4]}`;
                        });
                        detail.querySelector(".sale-detail-advice p").textContent = item[3];
                    }
                    detail.querySelector("[data-sale-source]").addEventListener("click", () => {
                        preview(files.get(1)[0]);
                        $("saleDocumentPages").firstElementChild?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                    });
                    if (item[1] === "pass") {
                        card.classList.add("sale-result-pass");
                        detail.classList.add("sale-detail-pass");
                        detail.querySelectorAll(".sale-result-check-icon").forEach((icon) => {
                            icon.dataset.status = "pass";
                            icon.textContent = "✓";
                        });
                        set("count", "적합 2 · 확인 0");
                        detail.querySelectorAll(".status-badge.red").forEach((badge) => {
                            badge.classList.replace("red", "green");
                            badge.textContent = badge.closest(".sale-detail-check") ? "충족" : "적합";
                        });
                        if (isBasicInfo) {
                            detail.querySelector("[data-sale-detail-property]").textContent = "전라남도 신안군 압해읍 복룡리 1886 외 1필지 / 4,076.90m²";
                            detail.querySelector("[data-sale-detail-price]").textContent = "60,057,410원";
                            detail.querySelector("[data-sale-detail-opinion]").textContent = "기재값 기준으로 특이사항이 없습니다.";
                        }
                        detail.querySelector(".sale-detail-advice").remove();
                    }
                    const trigger = card.querySelector(".rec-card-head");
                    trigger.setAttribute("role", "button");
                    trigger.tabIndex = 0;
                    trigger.setAttribute("aria-controls", detail.id);
                    const syncExpanded = () => {
                        const expanded = expandedResults.has(item);
                        card.classList.toggle("active", expanded);
                        trigger.setAttribute("aria-expanded", String(expanded));
                        detail.hidden = !expanded;
                    };
                    const toggle = () => {
                        const wasExpanded = expandedResults.has(item);
                        expandedResults.clear();
                        if (!wasExpanded) expandedResults.add(item);
                        syncResultStates.forEach((sync) => sync());
                    };
                    syncResultStates.push(syncExpanded);
                    card.addEventListener("click", (event) => {
                        if (!detail.contains(event.target)) toggle();
                    });
                    trigger.addEventListener("keydown", (event) => {
                        if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            toggle();
                        }
                    });
                    card.append(detail);
                    syncExpanded();
                }
                return card;
            }),
        );
        if (!visible.length) {
            // 261023 수정: 필터 0건은 공통 아이콘·제목·설명을 사용합니다.
            $("saleResults").append(window.AIOneWorkspaceCommon.createFilterEmpty(
                example ? "검색 조건에 맞는 검증결과가 없습니다" : "검증결과가 없습니다",
                example ? "검색어나 필터를 변경해 주세요." : "검토서와 검증자료를 업로드하고 검증을 실행하면 결과를 여기에서 확인할 수 있습니다.",
            ));
        }
    }

    [1, 2].forEach((group) => {
        renderFiles(group);
        $(`upload-zone-${group}`).addEventListener("app:file-upload", (event) => {
            const selected = event.detail.files;
            const accepted = selected.filter((file) => /\.(pdf|hwpx?|docx?|xlsx?|png|jpe?g)$/i.test(file.name));
            if (accepted.length !== selected.length) notify("지원하지 않는 파일 형식은 제외했습니다.");
            if (!accepted.length) return;
            if (group === 1 && accepted.length > 1) notify("검토서는 1건만 등록할 수 있어 첫 번째 파일을 등록했습니다.");
            const incoming = (group === 1 ? accepted.slice(0, 1) : accepted).map((blob) => ({ name: blob.name, blob }));
            files.set(group, group === 1 ? incoming : [...files.get(group), ...incoming]);
            invalidateResults();
            renderFiles(group);
            // Start: 261026 수정 - 검토서 업로드 시 분석 기본 제목 반영
            if (group === 1) {
                setAnalysisTitle(incoming[0].name);
                preview(incoming[0]);
            }
            // End: 261026 수정 - 검토서 업로드 시 분석 기본 제목 반영
        });
    });
    document.querySelectorAll("[data-sale-filter]").forEach((button) =>
        button.addEventListener("click", () => {
            filter = button.dataset.saleFilter;
            renderResults();
        }),
    );
    $("saleResultSearch").addEventListener("input", renderResults);
    /* Start: 261026 수정 - 검증 실행 이벤트 */
    $("saleVerify").addEventListener("click", startVerification);
    /* End: 261026 수정 - 검증 실행 이벤트 */
    // 분석 내역은 공통 drawer UI를 사용한다. 저장 API 연결 전에는 미리보기 자료만 제공한다.
    const historyFiles = new Map([...files].map(([group, items]) => [group, items.slice()]));
    let historyItems = example ? [
        { id: "sale-preview-1", title: sampleName, created_at: "2026-10-22T09:00:00+09:00", reviewCount: 3, status: "completed" },
        { id: "sale-preview-2", title: "매각표준검토서(신도리 856-2).pdf", created_at: "2026-10-21T16:55:00+09:00", reviewCount: 3, status: "completed" },
        { id: "sale-preview-3", title: "매각표준검토서(하만리 산195).pdf", created_at: "2026-10-21T15:20:00+09:00", reviewCount: null, status: "pending" },
    ] : [];
    let activeHistoryId = historyItems[0]?.id || "";
    const historyDrawer = $("saleHistoryDrawer");
    const historyList = $("saleHistoryItems");
    const historyPagination = window.AIOneConversationDrawer.bindLocalPagination({ list: historyList, drawer: historyDrawer });

    function renderHistory() {
        const query = $("saleHistoryListSearch").value.trim().toLowerCase();
        const visible = window.AIOneConversationDrawer.filterItems(historyItems, query);
        window.AIOneConversationDrawer.renderChatItems({
            list: historyList,
            items: visible,
            activeId: activeHistoryId,
            sortMode: $("saleHistoryListSort").value,
            totalElement: $("saleHistoryListTotal"),
            total: historyItems.length,
            showIcon: false,
            titleMax: 120,
            isPending: (item) => item.status === "pending",
            getBadges: (item) => [
                { text: "검토서 1건" },
                { text: item.reviewCount == null ? "확인 필요 집계 중" : `확인 필요 ${item.reviewCount}건`, variant: "query" },
            ],
            onSelect(item) {
                /* Start: 261026 수정 - 분석 내역 전환 시 진행 중 검증 취소 */
                resetVerification();
                /* End: 261026 수정 - 분석 내역 전환 시 진행 중 검증 취소 */
                activeHistoryId = item.id;
                historyFiles.forEach((items, group) => files.set(group, items.slice()));
                example = item.status === "completed";
                filter = "all";
                $("saleResultSearch").value = "";
                renderFiles(1);
                renderFiles(2);
                preview(files.get(1)[0]);
                /* Start: 261026 수정 - 선택한 분석 제목 반영 */
                setAnalysisTitle(item.title);
                /* End: 261026 수정 - 선택한 분석 제목 반영 */
                /* Start: 261026 수정 - 분석 내역의 검증 완료 상태 반영 */
                verificationState = example ? "completed" : "ready";
                syncVerification();
                /* End: 261026 수정 - 분석 내역의 검증 완료 상태 반영 */
                renderResults();
                renderHistory();
                window.AIOneSidePop.close(historyDrawer);
            },
        });
        historyList.querySelectorAll(".drawer-chat-select").forEach((button) => {
            const id = button.closest("[data-conversation-id]").dataset.conversationId;
            const item = visible.find((entry) => entry.id === id);
            button.setAttribute("aria-label", `${item.title} 분석 열기`);
        });
        historyPagination.paginate(JSON.stringify([query, $("saleHistoryListSort").value]));
        if (!visible.length) {
            const empty = document.createElement("p");
            empty.className = "empty-state";
            empty.textContent = query ? "검색 조건에 맞는 분석 내역이 없습니다." : "분석 내역이 없습니다.";
            historyList.append(empty);
        }
    }

    window.AIOneConversationDrawer.bindControls({
        search: $("saleHistoryListSearch"),
        searchButton: $("saleHistoryListSearchBtn"),
        searchClear: $("saleHistoryListSearchClear"),
        sort: $("saleHistoryListSort"),
        onSearch: renderHistory,
        onSearchInput: renderHistory,
        onClear: renderHistory,
        onSort: renderHistory,
    });
    /* Start: 261026 수정 - Drawer 목록 최초 로딩 */
    historyDrawer.addEventListener("sidepop:open", () => window.AIOneDrawerLoading.run(historyList, "분석 목록", renderHistory));
    /* End: 261026 수정 - Drawer 목록 최초 로딩 */
    window.AIOneConversationDrawer.bindActions({ drawer: historyDrawer, onAction(detail) {
        const { items, item } = window.AIOneConversationDrawer.applyLocalAction(historyItems, detail);
        if (!item) return;
        historyItems = items;
        if (item.id === activeHistoryId) {
            /* Start: 261026 수정 - 내역 이름 변경 동기화 */
            if (detail.action === "rename") setAnalysisTitle(detail.title);
            /* End: 261026 수정 - 내역 이름 변경 동기화 */
            if (detail.action === "delete") activeHistoryId = "";
        }
        queueMicrotask(renderHistory);
    } });
    renderHistory();
    $("newChatBtn").addEventListener("click", () => {
        activeHistoryId = "";
        // Start: 261026 수정 - 새 분석 제목 초기화
        setAnalysisTitle(window.AIOneWorkspaceUi.createDefaultWorkspaceTitle("매각 검토"));
        // End: 261026 수정 - 새 분석 제목 초기화
        files.set(1, []);
        files.set(2, []);
        filter = "all";
        $("saleResultSearch").value = "";
        invalidateResults();
        renderFiles(1);
        renderFiles(2);
        preview(null);
        $("saleUploadStatus").textContent = "검토서 1건과 검증자료를 등록해 주세요.";
        // 대화 취소·메시지·입력 상태 초기화는 공통 패널에서 처리한다.
        delete $("chatInput").parentElement.dataset.inputSize;
        window.AIOneChatInput.resize($("chatInput"));
    });
    $("saleDownload").addEventListener("click", () => {
        const text = "검증결과 예시 — 실제 검증 결과가 아닙니다.\n\n" + results.map((item) => `${item[0]}: ${item[1] === "pass" ? "적합" : "확인 필요"}\n${item[3]}`).join("\n\n");
        const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
        const link = document.createElement("a");
        link.href = url;
        link.download = "매각표준검토서_검증결과_예시.txt";
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    window.AIOnePanel.init({
        config: {
            chatOnly: true,
            chatBodyId: "saleChatMessages",
            kind: "sale-review",
            promptType: "chat",
            layoutCookie: "ai_one_sale_review_panel_layout_v1",
            labels: { untitled: "제목 없는 대화", workspace: "매각 검토", history: "대화 목록" },
        },
        installPage(runtime) {
            // Start: 261026 수정 - 공통 제목 편집기에 분석 내역 연결
            titleRuntime = runtime;
            runtime.page.workspaceTitle = {
                editLabel: "분석 제목 수정",
                get: () => analysisTitle,
                set(title) {
                    const item = historyItems.find((entry) => entry.id === activeHistoryId);
                    if (item) item.title = title;
                    setAnalysisTitle(title);
                    renderHistory();
                },
            };
            // End: 261026 수정 - 공통 제목 편집기에 분석 내역 연결
            runtime.page.getWelcomeHtml = () => sampleChat.querySelector(".msg-text").innerHTML;
        },
    });
    /* Start: 261026 수정 - 페이지 종료 정리 및 최초 검증 상태 반영 */
    window.addEventListener("pagehide", () => {
        resetVerification();
        if (previewUrl) URL.revokeObjectURL(previewUrl);
    });
    syncVerification();
    /* End: 261026 수정 - 페이지 종료 정리 및 최초 검증 상태 반영 */
    renderResults();
    if (!example) {
        preview(null);
        $("saleUploadStatus").textContent = "검토서 1건과 검증자료를 등록해 주세요.";
    }
})();
