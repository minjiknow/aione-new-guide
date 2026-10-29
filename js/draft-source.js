/**
 * 261028 누적 변경 요약 (현재 구현 기준)
 * - 유사답변서·검색자료·업로드자료의 필터·카드·선택 상태를 표시합니다. 자료가 없을 때도 필터와 미리보기의 대기 상태를 유지합니다.
 *
 * AI-ONE 답변서 관련자료 목록
 * 적용 화면: ai-answer.html
 * 역할: 유사답변서 추천·점수·필터·선택 카드 렌더링
 * 연결: 공통 검색·자료 선택·미리보기는 panel-source.js
 * - 261022 변경 - 공통 검색·업로드는 panel-source.js에 두고 추천 카드·자료 필터만 관리합니다.
 *
 * 기본 구간 형식: Start: 기능명 / End: 기능명
 * 변경 구간 형식: Start: YYMMDD 추가/수정 - 기능명 / End: YYMMDD 추가/수정 - 기능명
 * 주석 정리 내역
 * - 261023 주석 정리 - 구간 표시와 변경 내용 표기를 통일합니다. 기존 작업 날짜와 기능 설명은 유지합니다.
 */

window.AIOneDraftSource = function (runtime) {
    const {
        addSelectedReferenceKey,
        clonePrototypeElement,
        createRecommendationTagFromPublicPrototype,
        el,
        getCompareSimilarSources,
        getCompareVersionNumbers,
        getSearchRecommendationItems,
        getUploadedRecommendationItems,
        isUploadedFileSelected,
        referenceKey,
        renderCompareWorkspace,
        renderPreview,
        renderSelectedReferences,
        state,
    } = runtime;
    function createFallbackRecommendationCard() {
        const article = document.createElement("article");
        article.className = "rec-card";
        article.setAttribute("data-reference-card", "");
        article.innerHTML =
            '<div class="rec-card-head">' +
            '<span class="rec-top-badge hidden">TOP</span>' +
            '<label class="rec-checkbox">' +
            '<input type="checkbox" aria-label="관련자료 선택" />' +
            '<span class="file-select-check-ui" aria-hidden="true"></span>' +
            "</label>" +
            '<strong class="rec-title"></strong>' +
            '<span class="rec-score"></span>' +
            "</div>" +
            '<p class="rec-meta"></p>' +
            '<p class="rec-desc"></p>' +
            '<div class="rec-tags"></div>';
        return article;
    }

    function createRecommendationCardFromPublicPrototype() {
        return clonePrototypeElement("recommendationCardPrototype") || clonePrototypeElement("answerRecommendationCardPrototype") || createFallbackRecommendationCard();
    }

    function syncRecommendationCardPublic(card, item, displayIndex) {
        const selected = state.selectedReferenceKeys.has(item.key);
        const rank = displayIndex + 1;
        card.setAttribute("data-reference-card", "");
        card.dataset.referenceKey = item.key;
        card.dataset.category = item.category === "history" ? "similar" : "reference";
        card.dataset.score = String(item.score || 0);
        card.dataset.title = item.title || "";
        card.classList.toggle("active", item.key === state.activeReferenceKey);
        card.hidden = false;
        const checkbox = card.querySelector('input[type="checkbox"]');
        if (checkbox) {
            checkbox.classList.add("checkbox-control", "checkbox-control-md");
            checkbox.checked = selected;
            checkbox.setAttribute("aria-label", (item.title || "관련자료") + " 선택");
        }
        const title = card.querySelector(".rec-title");
        if (title) title.textContent = item.title || "";
        const score = card.querySelector(".rec-score");
        if (score) score.textContent = Number(item.score || 0) + "%";
        const top = card.querySelector(".rec-top-badge");
        if (top) {
            const visible = rank <= 3;
            top.classList.toggle("hidden", !visible);
            top.textContent = visible ? "TOP " + rank : "";
        }
        // TOP 배지와 점수가 함께 표시될 때만 색상용 클래스를 적용한다.
        if (score) score.classList.toggle("rec-score--top", Boolean(top && !top.matches(".hidden, [hidden]") && !score.matches(".hidden, [hidden]")));
        const meta = card.querySelector(".rec-meta");
        if (meta) meta.textContent = item.meta || "";
        const desc = card.querySelector(".rec-desc");
        if (desc) {
            const value = String(item.desc || "")
                .replace(/\s+/g, " ")
                .trim();
            desc.textContent = value.length > 105 ? value.slice(0, 105).trim() + "..." : value;
        }
        const tags = card.querySelector(".rec-tags");
        if (tags) {
            const nodes = (item.tags || []).filter(Boolean).slice(0, 2).map(createRecommendationTagFromPublicPrototype);
            tags.replaceChildren(...nodes);
            tags.classList.toggle("hidden", nodes.length === 0);
        }
    }

    function bindDynamicRecommendationCard(card) {
        card.addEventListener("click", function (event) {
            if (event.target.closest("input, label")) return;
            document.querySelectorAll("[data-reference-card]").forEach((item) => {
                item.classList.toggle("active", item === card);
            });
            state.activeReferenceKey = card.dataset.referenceKey || "";
            renderPreview();
        });
        const checkbox = card.querySelector('input[type="checkbox"]');
        checkbox?.addEventListener("change", function () {
            const key = card.dataset.referenceKey || "";
            if (!key) return;
            if (checkbox.checked) {
                addSelectedReferenceKey(key);
                state.activeReferenceKey = key;
            } else {
                state.selectedReferenceKeys.delete(key);
            }
            renderRecommendations();
            renderSelectedReferences();
            renderPreview();
        });
    }

    function getReferenceFilter() {
        return document.querySelector(".reference-filter.active")?.dataset.referenceFilter || "history";
    }

    function renderReferenceFilterBanner() {
        const banner = document.querySelector(".filter-bar-banner");
        if (!banner) return;
        switch (getReferenceFilter()) {
            case "search":
                banner.innerHTML = '<p class="filter-banner-desc">AI 참조소스에서 검색 후 가져온 자료를 표시합니다.</p>';
                break;
            case "upload":
                banner.innerHTML = '<p class="filter-banner-desc">AI 참조소스에 직접 업로드한 자료를 표시합니다.</p>';
                break;
            case "history":
            default:
                banner.innerHTML = '<p class="filter-banner-desc">과거 답변서와 마스터답변 중 현재 질의와 유사도가 높은 자료를 추천합니다.</p>';
                break;
        }
    }

    function createReferenceSourceCard(item) {
        const card = clonePrototypeElement("referenceSourceCardTemplate");
        const isUpload = item.category === "upload";
        card.classList.toggle("active", item.key === state.activeReferenceKey);
        card.classList.toggle("is-selected", isUpload ? isUploadedFileSelected(item.raw) : state.selectedReferenceKeys.has(item.key));
        card.dataset.referenceKey = item.key;
        card.setAttribute("aria-pressed", String(item.key === state.activeReferenceKey));
        card.setAttribute("aria-label", item.title + " 미리보기");
        card.querySelector(".reference-source-title").textContent = item.title;
        const badge = card.querySelector(".sub-badge");
        badge.classList.toggle("blue", !isUpload);
        badge.classList.toggle("green", isUpload);
        badge.textContent = isUpload ? "업로드소스" : "검색소스";
        return card;
    }

    function getVisibleRecommendationItems() {
        switch (getReferenceFilter()) {
            case "search":
                return getSearchRecommendationItems();
            case "upload":
                return getUploadedRecommendationItems();
            case "history":
            default:
                return state.recommendationItems.filter((item) => item.category === "history");
        }
    }

    function createPublicRecommendationCardPrototype() {
        const card = document.createElement("article");
        card.className = "rec-card";
        card.setAttribute("data-reference-card", "");
        card.innerHTML =
            '<div class="rec-card-head">' +
            '<span class="rec-top-badge">TOP</span>' +
            '<label class="rec-checkbox">' +
            '<input type="checkbox" aria-label="관련자료 선택" />' +
            '<span class="file-select-check-ui" aria-hidden="true"></span>' +
            "</label>" +
            '<strong class="rec-title"></strong>' +
            '<span class="rec-score"></span>' +
            "</div>" +
            '<p class="rec-meta"></p>' +
            '<p class="rec-desc"></p>' +
            '<div class="rec-tags"></div>';
        return card;
    }

    function clonePublicRecommendationCard() {
        const prototype = document.getElementById("recommendationCardPrototype");
        if (prototype) {
            const source = prototype.tagName === "TEMPLATE" ? prototype.content.firstElementChild : prototype.hasAttribute("data-prototype-wrapper") ? prototype.firstElementChild : prototype;
            if (source) {
                const clone = source.cloneNode(true);
                clone.removeAttribute("hidden");
                clone.removeAttribute("id");
                return clone;
            }
        }
        return createPublicRecommendationCardPrototype();
    }

    function createPublicRecommendationTag(text) {
        const prototype = document.getElementById("recommendationTagPrototype");
        let tag = null;
        if (prototype) {
            const source = prototype.tagName === "TEMPLATE" ? prototype.content.firstElementChild : prototype.hasAttribute("data-prototype-wrapper") ? prototype.firstElementChild : prototype;
            if (source) {
                tag = source.cloneNode(true);
                tag.removeAttribute("hidden");
                tag.removeAttribute("id");
            }
        }
        if (!tag) {
            tag = document.createElement("span");
            tag.className = "rec-tag";
        }
        tag.textContent = text;
        return tag;
    }

    function syncPublicRecommendationTags(card, tags) {
        const tagList = card.querySelector(".rec-tags");
        if (!tagList) return;
        const nodes = (tags || []).filter(Boolean).map(createPublicRecommendationTag);
        tagList.replaceChildren(...nodes);
        tagList.classList.toggle("hidden", nodes.length === 0);
    }

    function syncPublicRecommendationCard(card, item, displayIndex) {
        const isSelected = state.selectedReferenceKeys.has(item.key);
        const rank = displayIndex + 1;
        card.dataset.referenceKey = item.key;
        card.dataset.category = item.publicCategory || (item.category === "history" ? "similar" : "reference");
        card.dataset.score = String(item.score || 0);
        card.dataset.title = item.title || "";
        card.classList.remove("hidden");
        card.classList.toggle("active", isSelected);
        const checkbox = card.querySelector('.rec-checkbox input[type="checkbox"]');
        if (checkbox) {
            checkbox.classList.add("checkbox-control", "checkbox-control-md");
            checkbox.checked = isSelected;
            checkbox.setAttribute("aria-label", (item.title || "관련자료") + " 선택");
        }
        const title = card.querySelector(".rec-title");
        if (title) title.textContent = item.title || "";
        const score = card.querySelector(".rec-score");
        if (score) {
            const hasScore = Number.isFinite(Number(item.score));
            score.classList.toggle("hidden", !hasScore);
            score.textContent = hasScore ? item.score + "%" : "";
        }
        const topBadge = card.querySelector(".rec-top-badge");
        if (topBadge) {
            const hasTopBadge = rank > 0 && rank <= 3;
            topBadge.classList.toggle("hidden", !hasTopBadge);
            topBadge.textContent = hasTopBadge ? "TOP " + rank : "TOP";
        }
        // TOP 배지와 점수가 함께 표시될 때만 색상용 클래스를 적용한다.
        if (score) score.classList.toggle("rec-score--top", Boolean(topBadge && !topBadge.matches(".hidden, [hidden]") && !score.matches(".hidden, [hidden]")));
        const meta = card.querySelector(".rec-meta");
        if (meta) meta.textContent = item.meta || "";
        const desc = card.querySelector(".rec-desc");
        if (desc) desc.textContent = item.desc || "";
        syncPublicRecommendationTags(card, item.tags || []);
    }

    function renderRecommendations() {
        // 261020: 관련자료 영역이 없는 업무지원 페이지는 목록 렌더링만 생략한다.
        // 참조소스 검색·가져오기·선택 상태는 기존 공용 상태에서 계속 관리한다.
        if (!el.recommendList) return;
        const items = getVisibleRecommendationItems();
        const uploadCount = getUploadedRecommendationItems().length;
        const historyCount = state.recommendationItems.filter((item) => item.category === "history").length;
        const searchCount = getSearchRecommendationItems().length;
        const totalCount = historyCount + searchCount + uploadCount;
        const recommendPanel = document.getElementById("answerPanelRecommend");
        const recommendResults = recommendPanel?.querySelector("[data-answer-recommend-results]");
        const recommendStatus = recommendPanel?.querySelector("[data-answer-recommend-status]");
        const emptyMessages = {
            history: ["추천된 관련자료가 없습니다", "우측 AI 채팅에 국회질의나 검색 키워드를 입력하면 \n 유사답변서와 참고자료를 추천합니다."],
            search: ["검색자료가 없습니다", "AI 참조소스에서 검색 후 자료를 가져오면 여기에 표시됩니다."],
            upload: ["업로드자료가 없습니다", "AI 참조소스에서 파일을 업로드하면 여기에 표시됩니다."],
        };
        const [emptyTitle, emptyDescription] = emptyMessages[getReferenceFilter()] || emptyMessages.history;
        renderReferenceFilterBanner();
        el.recommendEmpty.querySelector(".empty-title").textContent = emptyTitle;
        el.recommendEmpty.querySelector(".empty-desc").textContent = emptyDescription;
        // 자료가 없어도 필터와 문서 미리보기의 대기 상태를 표시한다.
        if (recommendResults) recommendResults.hidden = false;
        if (recommendStatus) recommendStatus.hidden = false;
        el.recommendList.replaceChildren(el.recommendEmpty);
        el.recommendEmpty.hidden = items.length > 0;
        items.forEach((item, displayIndex) => {
            const card = item.category === "history" ? createRecommendationCardFromPublicPrototype() : createReferenceSourceCard(item);
            if (item.category === "history") {
                syncRecommendationCardPublic(card, item, displayIndex);
                bindDynamicRecommendationCard(card);
            }
            el.recommendList.appendChild(card);
        });
        el.recommendCount.textContent = String(totalCount);
        el.recommendFooterCount.textContent = totalCount + "건";
        el.filterAllCount.textContent = String(historyCount);
        el.filterHistoryCount.textContent = String(searchCount);
        el.filterEvidenceCount.textContent = String(uploadCount);
        const selectedVisible = items.filter((item) => (item.category === "upload" ? isUploadedFileSelected(item.raw) : state.selectedReferenceKeys.has(item.key)));
        el.selectAllReferences.disabled = !items.length;
        el.selectAllReferences.checked = !!items.length && selectedVisible.length === items.length;
        el.selectAllReferences.indeterminate = selectedVisible.length > 0 && selectedVisible.length < items.length;
    }

    function onSourceListChanged() {
        if (el.compareTabCount) {
            const hasCompare = !!(state.reportId && getCompareSimilarSources().length && getCompareVersionNumbers().length);
            el.compareTabCount.textContent = hasCompare ? "1" : "0";
        }
        if (!el.comparePanel?.hidden) {
            renderCompareWorkspace().catch((error) => {
                console.error("[답변서 비교] 추천자료 갱신 실패", error);
            });
        }
    }
    Object.assign(runtime.page, { renderSources: renderRecommendations, onSourceListChanged });

    Object.assign(runtime, {
        createFallbackRecommendationCard,
        createRecommendationCardFromPublicPrototype,
        syncRecommendationCardPublic,
        bindDynamicRecommendationCard,
        getReferenceFilter,
        renderReferenceFilterBanner,
        createReferenceSourceCard,
        getVisibleRecommendationItems,
        createPublicRecommendationCardPrototype,
        clonePublicRecommendationCard,
        createPublicRecommendationTag,
        syncPublicRecommendationTags,
        syncPublicRecommendationCard,
        renderRecommendations,
    });
};
