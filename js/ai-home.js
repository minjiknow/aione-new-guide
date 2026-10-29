/**
 * 261028 누적 변경 요약 (현재 구현 기준)
 * - 서비스 카드 순환과 질의분류·답변서 사용 이력의 조회·통합·이동을 처리합니다. 이력 표는 더보기 버튼 없이 서비스·유형·제목·날짜·상태를 표시합니다.
 *
 * AI-ONE 홈 - 서비스 카드 및 사용 이력 모듈
 * 적용 페이지: html/home.html / 전용 스타일: css/ai-home.css
 *
 * 데이터 관리: dummy-data.js의 home.history, 응답 대체는 dummy-api.js.
 * UI 관리: home.html의 기존 구조와 이력 렌더러를 사용합니다.
 * - 261021 - 챗봇 일반 홈 메뉴에서 전달한 사이드바 접힘 상태를 최초 진입에 반영합니다.
 * 변경 내용 · 관련 함수
 * [261020 변경 내용 · 관련 함수]
 * [서비스 카드] initServiceCardsSwiper, syncVisibleCards, onServiceKeydown: PC 4칸(1181px 이상), 태블릿 2칸(601~1180px), 모바일 1칸 너비를 유지합니다.
 * - 카드 복제 없이 원본 5개 이상일 때만 순환하며 가시성·방향키 처리는 유지합니다.
 * - 261022 주석 보완 - 기존 날짜별 구현 구간을 상단 내역에 보충했다.
 * - 261014 - 서비스 카드 스와이퍼. 261015: 홈 이력 데이터 연결·표시. 261016: 전체 사용 이력 검색·모달.
 *
 * 기본 구간 형식: Start: 기능명 / End: 기능명
 * 변경 구간 형식: Start: YYMMDD 추가/수정 - 기능명 / End: YYMMDD 추가/수정 - 기능명
 * 주석 정리 내역
 * - 261023 주석 정리 - 구간 표시와 변경 내용 표기를 통일합니다. 기존 작업 날짜와 기능 설명은 유지합니다.
 */
(() => {
    "use strict";

    /* 파일 구성: 홈 정적 화면 보강 -> 최근 사용 이력 -> 기록 모달 -> 이동 및 서비스 동작.
     * 미리보기: dummy/dummy-data.js의 home.history를 dummy/dummy-api.js가 응답합니다.
     * 개발 연동: loadHomeHistoryData()가 질의분류·답변서 목록을 합치고 동일한 렌더러를 사용합니다.
     */
    const isComponentCatalog = new URLSearchParams(window.location.search).get("view") === "component-catalog";
    if (isComponentCatalog) document.documentElement.classList.add("component-catalog-preview");
    const homeHistorySkeletonDuration = 1200;
    const HOME_HISTORY_LIMIT = 6;
    const HOME_HISTORY_FETCH_SIZE = 50;
    const CLASSIFICATION_BASE = "/intra/ai/clsf/";
    const ANSWER_BASE = "/intra/ai/answer/";
    let historyModalReturnFocus = null;
    let homeHistoryLoadingStartedAt = 0;

    function tryOpenPreparingModal(trigger) {
        const modal = document.getElementById("preparingServiceModal");
        if (modal && window.AIOneModal) {
            window.AIOneModal.open(modal, trigger);
            return true;
        }
        return false;
    }

    function openPreparingModal(trigger) {
        tryOpenPreparingModal(trigger);
    }

    function buildNewChatUrl(target) {
        const url = new URL(target, window.location.href);
        url.searchParams.set("newChat", "Y");
        return url.href;
    }

    function getHistoryPage(isClassification) {
        if (window.AIOnePreview?.enabled) return isClassification ? "classifcation.html" : "ai-answer.html";
        const contextPath = typeof window.CTX_PATH === "string" ? window.CTX_PATH.replace(/\/$/, "") : "";
        return contextPath + (isClassification ? "/intra/ai/clsf/MD_classification.do" : "/intra/ai/answer/MD_answer.do");
    }

    function initNewChatNavigation() {
        const selectors = ['a[href="classifcation.html"]', 'a[href="ai-answer.html"]', 'a[href$="/intra/ai/clsf/MD_classification.do"]', 'a[href$="/intra/ai/answer/MD_answer.do"]'];
        document.querySelectorAll(selectors.join(",")).forEach((link) => {
            if (link.closest("[data-home-datatable], [data-home-history-modal]")) return;
            link.addEventListener("click", (event) => {
                if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
                event.preventDefault();
                window.location.href = buildNewChatUrl(link.getAttribute("href"));
            });
        });
    }

    function openHistoryConversation(row) {
        if (!row) return;
        if (row.dataset.historyTarget === "#") {
            closeFullHistory();
            openPreparingModal(row);
            return;
        }
        const conversationId = String(row.dataset.conversationId || "").trim();
        const agentId = String(row.dataset.agentId || "").trim();
        const target = row.dataset.historyTarget || getHistoryPage(agentId === "inquiry");
        if (!conversationId) {
            window.location.href = target;
            return;
        }
        const url = new URL(target, window.location.href);
        url.searchParams.set("conversationId", conversationId);
        url.searchParams.set("historyAgentId", agentId);
        url.searchParams.set("fromHistory", "Y");
        window.location.href = url.href;
    }

    function openHistoryRow(row) {
        openHistoryConversation(row);
    }

    function openFullHistoryRow(row) {
        openHistoryConversation(row);
    }

    // Start: 261016 수정 - 전체 사용 이력 검색 및 모달
    // 최근 이력과 같은 조회 결과를 사용하며 검색어 필터는 모달 안에서 적용한다.
    function filterFullHistory() {
        const modal = document.querySelector("[data-home-history-modal]");
        const search = modal?.querySelector("[data-home-history-search]");
        const clear = modal?.querySelector("[data-home-history-clear]");
        const result = modal?.querySelector("[data-home-history-result]");
        const table = modal?.querySelector(".history-table.full");
        const empty = modal?.querySelector("[data-home-history-empty]");
        if (!modal || !search) return;
        const keyword = search.value.trim().toLocaleLowerCase("ko-KR");
        let visibleCount = 0;
        const rows = Array.from(modal.querySelectorAll("[data-full-history-row]"));
        rows.forEach((row) => {
            const isVisible = !keyword || row.textContent.toLocaleLowerCase("ko-KR").includes(keyword);
            row.hidden = !isVisible;
            if (isVisible) visibleCount += 1;
        });
        if (clear) clear.hidden = !keyword;
        if (result) result.textContent = keyword ? `검색 결과 ${visibleCount}건` : `총 ${rows.length}건`;
        if (table) table.hidden = visibleCount === 0;
        if (empty) empty.hidden = visibleCount !== 0;
    }

    function closeFullHistory() {
        const modal = document.querySelector("[data-home-history-modal]");
        if (!modal || modal.classList.contains("hidden")) return;
        modal.classList.add("hidden");
        modal.setAttribute("aria-hidden", "true");
        historyModalReturnFocus?.focus();
        historyModalReturnFocus = null;
    }

    function openFullHistory(trigger) {
        const modal = document.querySelector("[data-home-history-modal]");
        const search = modal?.querySelector("[data-home-history-search]");
        if (!modal) return;
        historyModalReturnFocus = trigger || document.activeElement;
        modal.classList.remove("hidden");
        modal.setAttribute("aria-hidden", "false");
        if (search) search.value = "";
        filterFullHistory();
        window.requestAnimationFrame(() => search?.focus());
    }

    function initFullHistoryModal() {
        const modal = document.querySelector("[data-home-history-modal]");
        if (!modal || modal.dataset.ready === "true") return;
        modal.dataset.ready = "true";
        modal.querySelector("[data-home-history-close]")?.addEventListener("click", closeFullHistory);
        modal.querySelector("[data-home-history-search]")?.addEventListener("input", filterFullHistory);
        modal.querySelector("[data-home-history-clear]")?.addEventListener("click", () => {
            const search = modal.querySelector("[data-home-history-search]");
            search.value = "";
            filterFullHistory();
            search.focus();
        });
        modal.addEventListener("click", (event) => {
            if (event.target.classList.contains("modal-bg")) {
                closeFullHistory();
                return;
            }
            const row = event.target.closest("[data-full-history-row]");
            if (row) openFullHistoryRow(row);
        });
        modal.addEventListener("keydown", (event) => {
            const row = event.target.closest("[data-full-history-row]");
            if (row && ["Enter", " "].includes(event.key)) {
                event.preventDefault();
                openFullHistoryRow(row);
                return;
            }
            if (event.key === "Escape") {
                event.preventDefault();
                closeFullHistory();
                return;
            }
            if (event.key !== "Tab") return;
            const focusable = Array.from(modal.querySelectorAll('button:not(:disabled), input:not(:disabled), [href], [tabindex]:not([tabindex="-1"])')).filter((element) => !element.hidden && element.getClientRects().length > 0);
            if (!focusable.length) return;
            const first = focusable[0];
            const last = focusable.at(-1);
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        });
    }

    // End: 261016 수정 - 전체 사용 이력 검색 및 모달

    function enhanceSidebar(host) {
        const sidebar = host.querySelector(".sidebar");
        if (!sidebar || sidebar.dataset.homeReady === "true") return;
        sidebar.dataset.homeReady = "true";
        // Start: 261021 수정 - 챗봇 일반 홈 메뉴의 접힘 상태 인계
        let initialCollapsed = false;
        try {
            initialCollapsed = window.sessionStorage.getItem("aiOneHomeSidebarHandoff") === "collapsed";
            window.sessionStorage.removeItem("aiOneHomeSidebarHandoff");
        } catch (error) {
            // 저장소를 사용할 수 없으면 홈의 기본 펼침 상태를 사용합니다.
        }
        window.AIOneSidebar?.configure(sidebar, { activePage: "home", initialCollapsed });
        // End: 261021 수정 - 챗봇 일반 홈 메뉴의 접힘 상태 인계
        sidebar.querySelectorAll(".nav-link").forEach((link) => {
            if (link.getAttribute("aria-disabled") === "true")
                link.addEventListener("click", (event) => {
                    event.preventDefault();
                    openPreparingModal(link);
                });
        });
    }

    function enhanceDataTable(host) {
        const table = host?.querySelector("[data-home-datatable]");
        if (!table || table.dataset.homeReady === "true") return;
        table.dataset.homeReady = "true";
        prepareHistoryRows(table.querySelectorAll("tbody tr[data-history-title]"));
        const moreLink = host.querySelector(".table-more");
        moreLink?.addEventListener("click", (event) => {
            event.preventDefault();
            openFullHistory(moreLink);
        });
    }

    function prepareHistoryRows(rows) {
        rows.forEach((row) => {
            row.tabIndex = 0;
            row.setAttribute("role", "link");
            row.setAttribute("aria-label", `${row.dataset.historyTitle || "사용 이력"} 열기`);
        });
    }

    function clearStaticHistoryRows() {
        document.querySelector("[data-home-datatable] tbody")?.replaceChildren();
        document.querySelector("[data-home-history-rows]")?.replaceChildren();
    }

    function initHomeHistorySkeleton() {
        const table = document.querySelector("[data-home-datatable]");
        if (!table || !window.AIOneDataTable?.setLoading) return;
        homeHistoryLoadingStartedAt = Date.now();
        window.AIOneDataTable.setLoading(table, true, { rowCount: HOME_HISTORY_LIMIT });
    }

    async function fetchJson(url, options) {
        // [API 공통] 홈의 실제 HTTP 요청과 JSON 응답 처리. 호출 대상은 아래 fetchJson 호출부 참조.
        const response = await fetch(url, { credentials: "same-origin", ...(options || {}) });
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        const json = await response.json();
        if (json && json.success === false) throw new Error(json.message || json.code || "API 요청 실패");
        return json?.data ?? json;
    }

    function getConversationItems(data) {
        if (!data) return [];
        if (Array.isArray(data)) {
            if (data.length === 1 && Array.isArray(data[0]?.items)) return data[0].items;
            if (data.length === 1 && data[0]?.data) return getConversationItems(data[0].data);
            return data;
        }
        if (Array.isArray(data.items)) return data.items;
        if (data.data) return getConversationItems(data.data);
        return [];
    }

    function normalizeDateValue(value) {
        const time = Date.parse(value || "");
        return Number.isFinite(time) ? time : 0;
    }

    function formatDateTime(value) {
        if (!value) return "-";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "-";
        const p = (n) => String(n).padStart(2, "0");
        return `${date.getFullYear()}.${p(date.getMonth() + 1)}.${p(date.getDate())} ${p(date.getHours())}:${p(date.getMinutes())}`;
    }

    function formatDate(value) {
        if (!value) return "-";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "-";
        const p = (n) => String(n).padStart(2, "0");
        return `${date.getFullYear()}.${p(date.getMonth() + 1)}.${p(date.getDate())}`;
    }

    function escapeHtml(value) {
        return String(value ?? "").replace(/[&<>'"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[ch]);
    }

    function normalizeClassificationStatus(status) {
        const value = String(status || "").toLowerCase();
        if (value === "completed") return { text: "완료", css: "done" };
        if (value === "failed") return { text: "실패", css: "progress" };
        if (value === "processing") return { text: "진행 중", css: "progress" };
        if (value === "pending") return { text: "대기", css: "progress" };
        return { text: "진행 중", css: "progress" };
    }

    async function getClassificationConversationStatus(conversationId) {
        try {
            // [API 연동] GET ND_conversationDocuments.do: 사용 이력의 질의분류 상태 계산에 필요한 문서 목록 조회.
            const documentsData = await fetchJson(`${CLASSIFICATION_BASE}ND_conversationDocuments.do?conversationId=${encodeURIComponent(conversationId)}`);
            const documents = Array.isArray(documentsData) ? documentsData : Array.isArray(documentsData?.items) ? documentsData.items : [];
            const jobIds = [...new Set(documents.map((doc) => String(doc?.last_job_id ?? doc?.lastJobId ?? doc?.job_id ?? "").trim()).filter(Boolean))];
            if (!jobIds.length) return { text: "완료", css: "done" };
            // [API 연동] GET ND_jobStatus.do: 문서별 작업 상태를 조회하여 홈 이력의 진행 상태 계산.
            const jobs = await Promise.all(jobIds.map((jobId) => fetchJson(`${CLASSIFICATION_BASE}ND_jobStatus.do?jobId=${encodeURIComponent(jobId)}`).catch(() => null)));
            const statuses = jobs.filter(Boolean).map((job) => String(job?.status || "").toLowerCase());
            if (!statuses.length) return { text: "완료", css: "done" };
            if (statuses.includes("failed")) return normalizeClassificationStatus("failed");
            if (statuses.some((status) => status === "processing" || status === "pending")) return normalizeClassificationStatus(statuses.includes("processing") ? "processing" : "pending");
            return normalizeClassificationStatus("completed");
        } catch (error) {
            console.warn("질의분류 상태 조회 실패", conversationId, error);
            return { text: "완료", css: "done" };
        }
    }

    // Start: 261015 수정 - 홈 이력 데이터 연결 및 표시
    function mapConversation(item, fallbackAgentId = "") {
        const responseAgentId = String(item?.agent_id || item?.agentId || "").trim();
        const agentId = responseAgentId === "inquiry" || responseAgentId === "report_generator" ? responseAgentId : fallbackAgentId;
        const isClassification = agentId === "inquiry";
        const isReport = agentId === "report_generator";
        return {
            id: String(item?.id ?? item?.conversation_id ?? ""),
            agentId,
            title: String(item?.display_title || item?.title || (isClassification ? "국회 질의 분류" : isReport ? "국회 답변서 초안" : "AI 대화")),
            updatedAt: item?.updated_at || item?.created_at || "",
            createdAt: item?.created_at || "",
            serviceName: isClassification ? "국회 질의 분류" : isReport ? "국회 답변서 초안 작성" : "AI 서비스",
            typeText: isClassification ? "질의분류" : isReport ? "답변서" : "AI",
            badgeClass: isClassification ? "search" : "ai",
            // 사이드바 메뉴의 기본 아이콘을 재사용합니다(호버 아이콘 제외).
            icon: isClassification ? "nav-classification" : "nav-answer",
            target: getHistoryPage(isClassification),
            status: isClassification ? { text: "진행 중", css: "progress" } : { text: "완료", css: "done" },
        };
    }

    async function loadHomeHistoryData() {
        // 메뉴별 화면 확인용 더미 API입니다. 실제 서버의 API 계약과는 별개입니다.
        if (window.AIOnePreview?.enabled) {
            return fetchJson("/intra/ai/home/ND_recentHistory.do");
        }
        const params = new URLSearchParams({
            page: "1",
            size: String(HOME_HISTORY_FETCH_SIZE),
            sort: "-updated_at",
        });
        const [classificationResult, answerResult] = await Promise.allSettled([
            // [API 연동] GET CLASSIFICATION_BASE + ND_conversationList.do: 질의분류 이력 조회.
            window.AIOneHomeAuth?.clsf ? fetchJson(`${CLASSIFICATION_BASE}ND_conversationList.do?${params.toString()}`) : Promise.resolve([]),
            // [API 연동] GET ANSWER_BASE + ND_conversationList.do: 답변서 이력 조회. 두 결과를 합쳐 renderHomeHistory()에 전달.
            window.AIOneHomeAuth?.answer ? fetchJson(`${ANSWER_BASE}ND_conversationList.do?${params.toString()}`) : Promise.resolve([]),
        ]);
        const classificationItems = classificationResult.status === "fulfilled" ? getConversationItems(classificationResult.value) : [];
        const answerItems = answerResult.status === "fulfilled" ? getConversationItems(answerResult.value) : [];
        if (classificationResult.status === "rejected") {
            console.error("질의분류 대화 목록 조회 실패", classificationResult.reason);
        }
        if (answerResult.status === "rejected") {
            console.error("답변서 대화 목록 조회 실패", answerResult.reason);
        }
        const conversationMap = new Map();
        classificationItems.forEach((item) => {
            const mapped = mapConversation(item, "inquiry");
            if (mapped.id) conversationMap.set(mapped.id, mapped);
        });
        answerItems.forEach((item) => {
            const mapped = mapConversation(item, "report_generator");
            if (!mapped.id) return;
            const existing = conversationMap.get(mapped.id);
            const responseAgentId = String(item?.agent_id || item?.agentId || "").trim();
            if (!existing || responseAgentId === "report_generator") {
                conversationMap.set(mapped.id, mapped);
            }
        });
        const merged = Array.from(conversationMap.values())
            .filter((item) => item.agentId === "inquiry" || item.agentId === "report_generator")
            .sort((a, b) => normalizeDateValue(b.updatedAt) - normalizeDateValue(a.updatedAt));
        await Promise.all(
            merged
                .filter((item) => item.agentId === "inquiry")
                .map(async (item) => {
                    item.status = await getClassificationConversationStatus(item.id);
                }),
        );
        return merged;
    }

    function historyRowHtml(item, full) {
        const title = escapeHtml(item.title);
        const rowAttrs = full ? ' class="history-row-link" data-full-history-row' : ' class="history-row-link" data-home-history-row';
        // 1028 더보기 버튼 삭제
        // const actionCell = full ? "" : `<td class="table-actions"><button type="button" class="table-action-trigger" aria-label="${escapeHtml(item.serviceName)} 더보기">⋮</button></td>`;
        return `<tr${rowAttrs} data-history-target="${item.target}" data-history-title="${title}" data-conversation-id="${escapeHtml(item.id)}" data-agent-id="${item.agentId}">
            <td><span class="table-service"><img class="icon" data-icon="${item.icon}" alt="" aria-hidden="true" /><span class="table-service-name">${escapeHtml(item.serviceName)}</span></span></td>
            <td><span class="status-badge ${item.badgeClass}">${item.typeText}</span></td>
            <td>${title}</td>
            <td>${formatDateTime(item.updatedAt)}</td>
            <td><span class="status-dot ${item.status.css}">${item.status.text}</span></td>
            <td>${formatDate(item.createdAt)}</td>
        </tr>`;
    }

    function renderHomeHistory(items) {
        const mainBody = document.querySelector("[data-home-datatable] tbody");
        const fullBody = document.querySelector("[data-home-history-rows]");
        if (mainBody) {
            mainBody.innerHTML = items
                .slice(0, HOME_HISTORY_LIMIT)
                .map((item) => historyRowHtml(item, false))
                .join("");
            prepareHistoryRows(mainBody.querySelectorAll("tr[data-history-title]"));
        }
        if (fullBody) {
            fullBody.innerHTML = items.map((item) => historyRowHtml(item, true)).join("");
            prepareHistoryRows(fullBody.querySelectorAll("tr[data-history-title]"));
        }
        window.AIOneIcons?.hydrate();
        filterFullHistory();
    }

    async function initRealHomeHistory() {
        const table = document.querySelector("[data-home-datatable]");
        try {
            const items = await loadHomeHistoryData();
            renderHomeHistory(items);
        } catch (error) {
            console.error("최근 사용 이력 조회 실패", error);
        } finally {
            const elapsed = Date.now() - homeHistoryLoadingStartedAt;
            const delay = Math.max(0, homeHistorySkeletonDuration - elapsed);
            window.setTimeout(() => window.AIOneDataTable?.setLoading?.(table, false), delay);
        }
    }

    // End: 261015 수정 - 홈 이력 데이터 연결 및 표시

    function initPromptComposer() {
        const host = document.querySelector("[data-home-prompt-composer]");
        if (!host || host.dataset.homePromptComposerReady === "true") return;
        host.dataset.homePromptComposerReady = "true";
        host.addEventListener("promptcomposer:submit", (event) => {
            if (!host.contains(event.target)) return;
            openPreparingModal(host.querySelector("[data-prompt-submit]"));
        });
    }

    function initHistoryEvents() {
        document.addEventListener("click", (event) => {
            if (event.target.closest(".data-table-actions, .table-actions")) return;
            const row = event.target.closest("[data-home-datatable] tbody tr[data-history-title]");
            if (row) openHistoryRow(row);
        });
        document.addEventListener("keydown", (event) => {
            if (!["Enter", " "].includes(event.key)) return;
            if (event.target.closest(".data-table-actions, .table-actions")) return;
            const row = event.target.closest("[data-home-datatable] tbody tr[data-history-title]");
            if (!row) return;
            event.preventDefault();
            openHistoryRow(row);
        });
    }

    function initPreparingCards() {
        document.addEventListener("click", (event) => {
            const card = event.target.closest(".service-card[data-soon], .service-card[data-modal-open]");
            if (!card) return;
            event.preventDefault();
            if (card.dataset.modalOpen) {
                if (!document.getElementById(card.dataset.modalOpen) || !window.AIOneModal) openPreparingModal(card);
                return;
            }
            openPreparingModal(card);
        });
    }
    // Start: 261014 추가 - 서비스 카드 스와이퍼
    // Start: 261020 수정 - 서비스 카드 개수와 무관한 반응형 너비 및 순환 조건
    function initServiceCardsSwiper() {
        let container = document.querySelector(".home-services .service-swiper");
        if (!container || typeof window.Swiper !== "function" || (container.swiper && !container.swiper.destroyed)) return;
        let wrapper = container.querySelector(".service-cards");
        if (!wrapper) return;

        // 재초기화 시 이전 복제본을 제거하고 실제 서비스 카드만 다시 계산합니다.
        wrapper.querySelectorAll("[data-service-clone]").forEach((slide) => slide.remove());
        let cards = Array.from(wrapper.children).filter((slide) => slide.classList.contains("service-item"));
        let cardCount = cards.length;
        if (!cardCount) return;
        let desktopCount = 4;
        let canLoop = cardCount > desktopCount;
        cards.forEach((slide, index) => {
            slide.dataset.serviceIndex = String(index);
        });

        function syncVisibleCards(swiper) {
            swiper.slides.forEach((slide) => {
                let visible = slide.classList.contains("swiper-slide-visible");
                if (!visible && slide.contains(document.activeElement)) container.focus({ preventScroll: true });
                slide.inert = !visible;
                slide.setAttribute("aria-hidden", String(!visible));
                slide.setAttribute("aria-label", `${Number(slide.dataset.serviceIndex) + 1} / ${cardCount}`);
            });
        }

        let swiper = new window.Swiper(container, {
            slidesPerView: 1,
            slidesPerGroup: 1,
            spaceBetween: 10,
            loop: canLoop,
            autoplay: {
                delay: 4000,
                disableOnInteraction: false,
            },
            speed: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 350,
            watchOverflow: true,
            watchSlidesProgress: true,
            grabCursor: cardCount > 1,
            breakpoints: {
                561: { slidesPerView: 1, spaceBetween: 12 },
                601: { slidesPerView: 2, spaceBetween: 12 },
                1181: { slidesPerView: desktopCount, spaceBetween: 10 },
            },
            a11y: {
                slideLabelMessage: null,
                slideRole: "listitem",
                containerRoleDescriptionMessage: "서비스 슬라이더",
                itemRoleDescriptionMessage: "서비스",
            },
            on: {
                init: syncVisibleCards,
                slideChange: syncVisibleCards,
                loopFix: syncVisibleCards,
                setTranslate: syncVisibleCards,
                transitionEnd: syncVisibleCards,
                resize: syncVisibleCards,
            },
        });

        // 방향키는 이 카드 영역에 초점이 있을 때만 처리합니다. 프롬프트 입력에는 영향이 없습니다.
        function onServiceKeydown(event) {
            if (event.target !== container || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
            event.preventDefault();
            if (event.key === "ArrowRight") swiper.slideNext();
            else swiper.slidePrev();
        }
        container.addEventListener("keydown", onServiceKeydown);
        swiper.on("destroy", () => {
            container.removeEventListener("keydown", onServiceKeydown);
            wrapper.querySelectorAll("[data-service-clone]").forEach((slide) => slide.remove());
            cards.forEach((slide) => {
                slide.inert = false;
                slide.removeAttribute("aria-hidden");
                slide.removeAttribute("aria-label");
                slide.removeAttribute("data-service-index");
            });
        });
    }
    // End: 261020 수정 - 서비스 카드 개수와 무관한 반응형 너비 및 순환 조건
    // End: 261014 추가 - 서비스 카드 스와이퍼

    // 홈과 공통 가이드가 같은 이력 렌더러·검색 로직을 사용합니다.
    window.AIOneHomeHistory = Object.freeze({ render: renderHomeHistory, filter: filterFullHistory });

    document.addEventListener("DOMContentLoaded", () => {
        // 가이드는 전달된 더미 데이터만 렌더링하며 홈 초기화/API 조회를 실행하지 않습니다.
        if (document.body.dataset.page === "common-ui-guide") return;
        window.AIOneIcons?.hydrate();
        clearStaticHistoryRows();
        enhanceSidebar(document);
        enhanceDataTable(document.querySelector(".home-history"));
        initHomeHistorySkeleton();
        initPromptComposer();
        initFullHistoryModal();
        initHistoryEvents();
        initNewChatNavigation();
        initPreparingCards();
        initServiceCardsSwiper();
        initRealHomeHistory();
    });
})();
