/**
 * AI-ONE 답변서 버전 비교
 * 적용 화면: ai-answer.html
 * 역할: 비교 문서 구성, 버전 선택·스크롤 동기화·확대
 * 연결: draft.js가 설치하며 보고서 조회는 draft-report.js
 * - 261022 변경 - 답변서 버전·유사답변서 비교만 담당하며 공통 문서 틀과 표 처리는 panel을 사용합니다.
 *
 * 기본 구간 형식: Start: 기능명 / End: 기능명
 * 변경 구간 형식: Start: YYMMDD 추가/수정 - 기능명 / End: YYMMDD 추가/수정 - 기능명
 * 주석 정리 내역
 * - 261023 주석 정리 - 구간 표시와 변경 내용 표기를 통일합니다. 기존 작업 날짜와 기능 설명은 유지합니다.
 */

(function registerdraft_compareModule(window) {
    window.AIOneDraftFeatureModules = window.AIOneDraftFeatureModules || {};
    window.AIOneDraftFeatureModules["draft-compare.js"] = function install(runtime) {
        with (runtime) {
            // getCompareSimilarSources: 필요한 값을 조회.
            function getCompareSimilarSources() {
              return state.recommendationItems.filter((item) => item.category === "history");
            }

            // getCompareVersionNumbers: 필요한 값을 조회.
            function getCompareVersionNumbers() {
              return normalizeVersionNumbers().slice().sort((a, b) => b - a);
            }

            // getCompareSourceContent: 필요한 값을 조회.
            function getCompareSourceContent(item) {
              if (!item) return "";
              const raw = item.raw || {};
              return String(
                raw.content ||
                raw.answer_content ||
                raw.body ||
                raw.text ||
                item.snippet ||
                raw.snippet ||
                raw.summary ||
                raw.description ||
                ""
              ).trim();
            }

            // buildCompareSourcePages: 표시할 데이터 또는 마크업을 구성.
            function buildCompareSourcePages(item) {
              if (!item) return "";
              const content = getCompareSourceContent(item);
              const metaItems = [
                { label: "문서구분", value: "과거답변서" },
                { label: "유사도", value: Number.isFinite(Number(item.score)) ? item.score + "%" : "-" },
                { label: "질의자", value: item.member_name || "-" },
                { label: "답변기관", value: item.answerer_org || item.answerer || "-" }
              ];
              const sectionItems = content
                ? content.split(/\n+/).map((line) => line.trim()).filter(Boolean).slice(0, 30)
                : [item.desc || "유사답변서의 상세 본문이 제공되지 않아 문서 요약 정보를 표시합니다."];
              return buildPublicDocPage({
                pageIdx: 0,
                totalPages: 1,
                org: item.meta || "과거답변서",
                title: item.title || "유사답변서",
                metaItems: metaItems,
                sections: [{
                  title: "답변 내용",
                  desc: content
                    ? "선택한 유사답변서에서 제공된 내용을 표시합니다."
                    : "선택한 유사답변서의 주요 정보를 표시합니다.",
                  items: sectionItems,
                  note: content
                    ? "선택한 유사답변서와 답변서 버전을 나란히 비교할 수 있습니다."
                    : "원문 전체 내용이 제공되지 않아 문서명, 질의자, 답변기관, 요약 정보를 기준으로 비교합니다."
                }]
              });
            }

            // buildCompareDraftPages: 표시할 데이터 또는 마크업을 구성.
            function buildCompareDraftPages(content, version) {
              const page = document.createElement("div");
              page.className = "web-doc-page";
              const header = document.createElement("div");
              header.className = "web-doc-header";
              header.innerHTML =
                '<span class="web-doc-org">답변서 · v' + escapeHtml(version) + '</span>' +
                '<h3 class="web-doc-title">' + escapeHtml(state.reportTitle || "답변서") + '</h3>';
              const body = document.createElement("div");
              body.className = "web-doc-body";
              const contentBox = document.createElement("div");
              contentBox.className = "answer-draft-content";
              const raw = String(content || "");
              contentBox.innerHTML = window.DOMPurify ? window.DOMPurify.sanitize(raw) : raw;
              body.appendChild(contentBox);
              const footer = document.createElement("div");
              footer.className = "web-doc-page-footer";
              footer.innerHTML = "<span>- 1 / 1 -</span>";
              page.appendChild(header);
              page.appendChild(body);
              page.appendChild(footer);
              const holder = document.createElement("div");
              holder.appendChild(page);
              return holder.innerHTML;
            }

            // loadCompareReportVersion: 서버/상태 데이터를 조회하고 화면 상태에 반영.
            async function loadCompareReportVersion(version) {
              const target = Number(version) || 0;
              if (!state.reportId || target <= 0) return "";
              if (target === Number(state.reportVersion) && state.reportContent) {
                return state.reportContent;
              }
              // [API 연동] GET ND_reportVersionDetail.do: 버전 비교 화면에 표시할 답변서 내용 조회.
              const data = await requestJson(
                "ND_reportVersionDetail.do?reportId=" + encodeURIComponent(state.reportId) +
                "&version=" + encodeURIComponent(target)
              );
              const report = singleResponse(data);
              return String(report?.content || report?.markdown || "");
            }

            // syncCompareViewportHeight: 관련 상태와 화면을 동기화.
            function syncCompareViewportHeight() {
              if (!el.compareGrid) return;
              const rect = el.compareGrid.getBoundingClientRect();
              const availableHeight = Math.max(360, Math.floor(window.innerHeight - rect.top - 8));
              /*
               * 기존 퍼블 CSS가 이미
               * .compare-three-col { display:flex; min-height:0; overflow:hidden }
               * .cmp-col { display:flex; flex-direction:column; min-height:0; overflow:hidden }
               * .cmp-col-body { flex:1; overflow-y:auto }
               * 구조를 가지고 있으므로 body 높이를 0으로 만들면 안 된다.
               * 비교 그리드 높이만 실제 뷰포트에 고정하고 기존 flex 스크롤 구조를 그대로 사용한다.
               */
              el.compareGrid.style.height = availableHeight + "px";
              el.compareGrid.style.maxHeight = availableHeight + "px";
              el.compareGrid.style.minHeight = "0";
              el.compareGrid.style.flex = "0 0 " + availableHeight + "px";
              el.compareGrid.style.overflow = "hidden";
              [el.compareBasePanel, el.compareDraftPanel].forEach((panel) => {
                if (!panel) return;
                panel.style.removeProperty("height");
                panel.style.removeProperty("max-height");
                panel.style.minHeight = "0";
                panel.style.overflow = "hidden";
              });
              [el.compareBaseBody, el.compareDraftBody].forEach((body) => {
                if (!body) return;
                // 이전 강제수정에서 넣었던 height:0 등을 반드시 제거한다.
                body.style.removeProperty("height");
                body.style.removeProperty("max-height");
                body.style.removeProperty("flex");
                body.style.minHeight = "0";
                body.style.overflowY = "auto";
                body.style.overflowX = "hidden";
                body.style.overscrollBehavior = "contain";
              });
            }

            // syncCompareScroll: 관련 상태와 화면을 동기화.
            function syncCompareScroll(source, target) {
              if (!state.compareScrollSync || compareScrollLock || !source || !target) return;
              const sourceMax = Math.max(1, source.scrollHeight - source.clientHeight);
              const targetMax = Math.max(0, target.scrollHeight - target.clientHeight);
              compareScrollLock = true;
              target.scrollTop = (source.scrollTop / sourceMax) * targetMax;
              window.requestAnimationFrame(() => {
                compareScrollLock = false;
              });
            }

            // renderCompareWorkspace: 현재 상태를 기준으로 화면을 렌더링.
            async function renderCompareWorkspace() {
              if (!el.comparePanel) return;
              const sources = getCompareSimilarSources();
              const versions = getCompareVersionNumbers();
              // 비교는 별도 비교결과 API가 필요한 기능이 아니다.
              // 현재 대화에 유사답변서(source) + report/버전이 있으면 바로 비교 가능하다.
              const available = !!(state.reportId && sources.length > 0 && versions.length > 0);
              if (el.compareTabCount) el.compareTabCount.textContent = available ? "1" : "0";
              if (el.compareEmpty) el.compareEmpty.hidden = available;
              if (el.compareView) el.compareView.hidden = !available;
              if (!available) return;
              const sourceKeys = new Set(sources.map((item) => item.key));
              if (!state.compareSelectedSourceKey || !sourceKeys.has(state.compareSelectedSourceKey)) {
                state.compareSelectedSourceKey = sources[0].key;
              }
              if (!state.compareSelectedVersion || !versions.includes(Number(state.compareSelectedVersion))) {
                state.compareSelectedVersion = Number(state.reportVersion) || versions[0];
              }
              if (el.compareReferenceSelect) {
                el.compareReferenceSelect.innerHTML = sources.map((item) =>
                  '<option value="' + escapeHtml(item.key) + '"' +
                  (item.key === state.compareSelectedSourceKey ? ' selected' : '') + '>' +
                  escapeHtml(item.title || "유사답변서") +
                  (Number.isFinite(Number(item.score)) ? " · " + escapeHtml(item.score) + "%" : "") +
                  '</option>'
                ).join("");
              }
              if (el.compareDraftVersionSelect) {
                el.compareDraftVersionSelect.innerHTML = versions.map((version) =>
                  '<option value="' + version + '"' +
                  (Number(version) === Number(state.compareSelectedVersion) ? ' selected' : '') + '>' +
                  'v' + version +
                  (getVersionTime(version) ? " (" + escapeHtml(getVersionTime(version)) + ")" : "") +
                  '</option>'
                ).join("");
              }
              syncComparePanelOrder();
              const selectedSource =
                sources.find((item) => item.key === state.compareSelectedSourceKey) || sources[0];
              const selectedVersion = Number(state.compareSelectedVersion) || versions[0];
              const seq = ++state.compareRenderSeq;
              if (el.compareBaseBody) {
                el.compareBaseBody.innerHTML =
                  '<div class="compare-doc-loading" role="status"><strong>유사답변서를 불러오고 있습니다.</strong></div>';
              }
              if (el.compareDraftBody) {
                el.compareDraftBody.innerHTML =
                  '<div class="compare-doc-loading" role="status"><strong>답변서 버전을 불러오고 있습니다.</strong></div>';
              }
              const draftContent = await loadCompareReportVersion(selectedVersion);
              if (seq !== state.compareRenderSeq) return;
              if (el.compareBaseBody) {
                el.compareBaseBody.innerHTML =
                  '<div class="doc-pages-track">' + buildCompareSourcePages(selectedSource) + '</div>';
              }
              if (el.compareDraftBody) {
                el.compareDraftBody.innerHTML =
                  '<div class="doc-pages-track">' + buildCompareDraftPages(draftContent, selectedVersion) + '</div>';
                wrapDocumentTables(el.compareDraftBody);
              }
              if (el.compareBaseTitle) el.compareBaseTitle.textContent = selectedSource?.title || "유사답변서";
              if (el.compareBaseBadge) {
                el.compareBaseBadge.textContent = Number.isFinite(Number(selectedSource?.score))
                  ? "유사답변서 · " + selectedSource.score + "%"
                  : "유사답변서";
              }
              if (el.compareDraftTitle) el.compareDraftTitle.textContent = "답변서 v" + selectedVersion;
              if (el.compareDraftBadge) {
                el.compareDraftBadge.textContent = getVersionTime(selectedVersion) || "선택 답변서 버전";
              }
              if (el.compareSelectionNote) {
                el.compareSelectionNote.innerHTML =
                  '<strong>현재 비교:</strong> ' +
                  escapeHtml(selectedSource?.title || "유사답변서") +
                  " ↔ v" + escapeHtml(selectedVersion);
              }
              syncCompareViewportHeight();
              if (el.compareBaseBody) el.compareBaseBody.scrollTop = 0;
              if (el.compareDraftBody) el.compareDraftBody.scrollTop = 0;
            }

            // 기존 비교 버튼을 우선 사용하고, 버튼이나 비교 호스트가 없을 때만 생성한다.
            function ensureDraftVersionCompareUi() {
              const draftPanel = document.getElementById("answerPanelDraft");
              const versionBar = document.getElementById("reportDownloadWrap");
              if (!draftPanel || !versionBar) return null;
              let toggle = document.getElementById("draftCompareBtn");
              if (!toggle) {
                toggle = document.createElement("button");
                toggle.type = "button";
                toggle.id = "draftCompareBtn";
                toggle.className = "draft-compare-toggle";
                toggle.title = "답변서 버전 2개를 나란히 비교";
                toggle.innerHTML =
                  '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">' +
                  '<path d="M3 5h8v14H3zM13 5h8v14h-8z"></path>' +
                  '<path d="M7 9h1M7 13h1M17 9h1M17 13h1"></path>' +
                  '</svg><span>버전 비교</span>';
                // 퍼블과 동일하게 버전 선택기 바로 뒤에 비교 전환 버튼을 둔다.
                const versionControl = versionBar.querySelector(".answer-version-control");
                if (versionControl?.nextSibling) {
                  versionBar.insertBefore(toggle, versionControl.nextSibling);
                } else {
                  versionBar.appendChild(toggle);
                }
              }
              // HTML에 미리 있는 버튼에도 이벤트를 연결하되, 재렌더링 시 중복 등록하지 않는다.
              if (toggle.dataset.compareBound !== "true") {
                toggle.dataset.compareBound = "true";
                toggle.addEventListener("click", () => {
                  const versions = normalizeVersionNumbers();
                  if (state.draftDisplayMode === "compare") {
                    exitDraftVersionCompare();
                    return;
                  }
                  if (versions.length < 2) {
                    showToast("비교할 답변서 버전이 2개 이상 필요합니다.");
                    return;
                  }
                  const active = versions.includes(Number(state.reportVersion))
                    ? Number(state.reportVersion)
                    : versions[0];
                  const other = versions.find((version) => Number(version) !== Number(active));
                  state.draftCompareLeftVersion = active;
                  state.draftCompareRightVersion = Number(other || versions[1]);
                  state.draftDisplayMode = "compare";
                  applyDraftDisplayMode();
                });
              }
              let host = document.getElementById("draftVersionCompareHost");
              if (!host) {
                host = document.createElement("div");
                host.id = "draftVersionCompareHost";
                host.className = "draft-version-compare-host";
                host.hidden = true;
                versionBar.insertAdjacentElement("afterend", host);
              }
              return host;
            }

            // updateDraftVersionCompareToggle: 기존 상태 또는 데이터를 갱신.
            function updateDraftVersionCompareToggle() {
              const toggle = document.getElementById("draftCompareBtn");
              if (!toggle) return;
              const versions = normalizeVersionNumbers();
              const comparing = state.draftDisplayMode === "compare";
              toggle.disabled = versions.length < 2;
              toggle.classList.toggle("active", comparing);
              toggle.title = comparing ? "단일 답변서 보기로 돌아가기" : "답변서 버전 2개를 나란히 비교";
              const label = toggle.querySelector("span");
              if (label) label.textContent = comparing ? "단일 보기" : "버전 비교";
            }

            // getDraftSingleContentElements: 필요한 값을 조회.
            function getDraftSingleContentElements() {
              const draftPanel = document.getElementById("answerPanelDraft");
              if (!draftPanel) return [];
              return Array.from(draftPanel.querySelectorAll("[data-answer-draft-content]"));
            }

            // applyDraftDisplayMode: 계산/저장된 상태를 화면에 반영.
            function applyDraftDisplayMode() {
              const host = ensureDraftVersionCompareUi();
              if (!host) return;
              const comparing = state.draftDisplayMode === "compare" && normalizeVersionNumbers().length >= 2;
              if (!comparing) state.draftDisplayMode = "single";
              getDraftSingleContentElements().forEach((element) => {
                element.hidden = comparing || !state.reportId || state.reportVersion <= 0;
              });
              host.hidden = !comparing;
              updateDraftVersionCompareToggle();
              if (comparing) {
                renderDraftVersionCompareWorkspace().catch((error) => {
                  console.error("[답변서] 버전 비교 렌더링 실패", error);
                  showToast("답변서 버전 비교 화면을 불러오지 못했습니다.");
                });
              }
            }

            // 오른쪽 비교 버전으로 단일 보기에 복귀하며, 현재 버전과 다르면 상세를 다시 조회한다.
            async function exitDraftVersionCompare() {
              const targetVersion = Number(state.draftCompareRightVersion) || Number(state.reportVersion) || 0;
              state.draftDisplayMode = "single";
              updateDraftVersionCompareToggle();
              if (targetVersion > 0 && targetVersion !== Number(state.reportVersion)) {
                await loadReportDetail(state.reportId, targetVersion);
                return;
              }
              applyDraftDisplayMode();
            }

            // getDraftVersionLabel: 필요한 값을 조회.
            function getDraftVersionLabel(version) {
              const time = getVersionTime(Number(version));
              return "v" + Number(version) + (time ? " (" + time + ")" : "");
            }

            // getDraftVersionNote: 필요한 값을 조회.
            function getDraftVersionNote(version) {
              const target = Number(version);
              const item = state.reportVersions.find((entry) => {
                const value = Number(entry?.version || entry?.version_no || entry?.number || entry);
                return value === target;
              });
              if (!item) return "버전 메모 없음";
              // API 명세 No.10 기준:
              // note      : 편집 메모 / 복원 메모
              // source    : agent(생성·재생성) / user(편집)
              // based_on  : 편집·복원의 기반 버전
              const note = String(item.note || "").trim();
              const source = String(item.source || "").trim().toLowerCase();
              const basedOn = Number(item.based_on);
              // 서버가 명시적인 메모를 내려주면 그대로 사용한다.
              // 예: No.13 복원 응답의 "버전 1 복원"
              if (note) return note;
              // 사용자 편집으로 생성된 버전
              if (source === "user") {
                return basedOn > 0
                  ? "버전 " + basedOn + " 수정"
                  : "사용자 수정";
              }
              // AI가 생성/재생성한 버전
              if (source === "agent") {
                return basedOn > 0
                  ? "버전 " + basedOn + " 기반 생성"
                  : "AI 답변서 생성";
              }
              return "버전 메모 없음";
            }

            // 두 버전의 본문과 도구 모음을 다시 구성한다. 스크롤 동기화는 공통 체크박스 스타일을 재사용한다.
            async function renderDraftVersionCompareWorkspace() {
              const host = ensureDraftVersionCompareUi();
              if (!host || state.draftDisplayMode !== "compare") return;
              const versions = normalizeVersionNumbers();
              if (versions.length < 2) {
                state.draftDisplayMode = "single";
                applyDraftDisplayMode();
                return;
              }
              if (!versions.includes(Number(state.draftCompareLeftVersion))) {
                state.draftCompareLeftVersion = versions.includes(Number(state.reportVersion)) ? Number(state.reportVersion) : versions[0];
              }
              if (!versions.includes(Number(state.draftCompareRightVersion)) || Number(state.draftCompareRightVersion) === Number(state.draftCompareLeftVersion)) {
                state.draftCompareRightVersion = versions.find((version) => Number(version) !== Number(state.draftCompareLeftVersion)) || versions[1];
              }
              const leftVersion = Number(state.draftCompareLeftVersion);
              const rightVersion = Number(state.draftCompareRightVersion);
              const seq = ++state.draftCompareRenderSeq;
              const optionHtml = (selected) => versions.map((version) =>
                '<option value="' + version + '"' + (Number(version) === Number(selected) ? ' selected' : '') + '>' +
                escapeHtml(getDraftVersionLabel(version)) + '</option>'
              ).join("");
              host.innerHTML = `<div class="draft-version-compare" id="draftVersionCompare">
                <div class="draft-compare-toolbar">
                  <div class="draft-compare-toolbar-title">
                    <strong>답변서 버전 비교</strong>
                    <span class="draft-compare-help">비교할 답변서 버전을 각각 선택하면 두 버전의 내용을 나란히 확인할 수 있습니다.</span>
                    <span class="api-direct-chip ready" id="draftCompareApiStatus">AI 분석완료</span>
                  </div>
                  <div class="draft-compare-controls">
                    <div class="draft-compare-select-wrap"><span class="draft-compare-select-label">기준</span><select class="draft-compare-select" id="draftCompareLeftSelect" aria-label="기준 답변서 버전 선택">${optionHtml(leftVersion)}</select></div>
                    <button class="draft-compare-swap" id="draftCompareSwap" type="button" aria-label="기준 버전과 비교 버전 좌우 바꾸기" title="기준/비교 버전 좌우 바꾸기"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M7 7h11"/><path d="m15 4 3 3-3 3"/><path d="M17 17H6"/><path d="m9 14-3 3 3 3"/></svg></button>
                    <div class="draft-compare-select-wrap"><span class="draft-compare-select-label">비교</span><select class="draft-compare-select" id="draftCompareRightSelect" aria-label="비교 답변서 버전 선택">${optionHtml(rightVersion)}</select></div>
                    <label class="draft-compare-sync" title="한쪽 문서를 스크롤하면 다른 문서도 같은 비율로 이동합니다."><input type="checkbox" class="checkbox-control checkbox-control-xs" id="draftCompareSync" ${state.draftCompareScrollSync ? "checked" : ""} /><span class="file-select-check-ui" aria-hidden="true"></span><span>스크롤 동기화</span></label>
                    <button class="draft-compare-toggle active" id="draftCompareClose" type="button">단일 보기</button>
                  </div>
                </div>
                <div class="draft-compare-grid">
                  <section class="draft-compare-pane" data-compare-side="left">
                    <div class="draft-compare-pane-head"><div class="draft-compare-pane-meta"><span class="draft-compare-pane-kicker">기준 버전</span><div class="draft-compare-pane-title">${escapeHtml(getDraftVersionLabel(leftVersion))}</div><div class="draft-compare-pane-note">${escapeHtml(getDraftVersionNote(leftVersion))}</div></div><div class="draft-compare-pane-actions"><span class="draft-compare-badge">기준</span><div class="report-download-anchor" data-compare-download-wrap data-compare-download-side="left"><button aria-expanded="false" aria-haspopup="true" aria-label="기준 버전 다운로드" class="icon-button icon-button-ghost icon-button-sm" data-compare-download-trigger type="button" data-tooltip="기준 버전 다운로드"><img class="icon icon-small" src="../assets/icons/download.svg" alt="" aria-hidden="true"></button><div class="report-download-menu hidden draft-compare-download-menu" data-compare-download-menu role="menu"><button data-format="hwpx" role="menuitem" type="button">HWPX 다운로드</button><button data-format="pdf" role="menuitem" type="button">PDF 다운로드</button><button data-format="md" role="menuitem" type="button">MD 다운로드</button></div></div></div></div>
                    <div class="answer-draft-document draft-editor draft-compare-editor" id="draftCompareLeftEditor" contenteditable="false"><div class="compare-doc-loading" role="status" aria-live="polite"><div class="compare-doc-loading-spinner"></div><strong>기준 버전을 불러오고 있습니다.</strong><span>선택한 답변서 내용을 준비하고 있습니다.</span></div></div>
                  </section>
                  <section class="draft-compare-pane" data-compare-side="right">
                    <div class="draft-compare-pane-head"><div class="draft-compare-pane-meta"><span class="draft-compare-pane-kicker">비교 버전</span><div class="draft-compare-pane-title">${escapeHtml(getDraftVersionLabel(rightVersion))}</div><div class="draft-compare-pane-note">${escapeHtml(getDraftVersionNote(rightVersion))}</div></div><div class="draft-compare-pane-actions"><span class="draft-compare-badge">비교</span><div class="report-download-anchor" data-compare-download-wrap data-compare-download-side="right"><button aria-expanded="false" aria-haspopup="true" aria-label="비교 버전 다운로드" class="icon-button icon-button-ghost icon-button-sm" data-compare-download-trigger type="button" data-tooltip="비교 버전 다운로드"><img class="icon icon-small" src="../assets/icons/download.svg" alt="" aria-hidden="true"></button><div class="report-download-menu hidden draft-compare-download-menu" data-compare-download-menu role="menu"><button data-format="hwpx" role="menuitem" type="button">HWPX 다운로드</button><button data-format="pdf" role="menuitem" type="button">PDF 다운로드</button><button data-format="md" role="menuitem" type="button">MD 다운로드</button></div></div></div></div>
                    <div class="answer-draft-document draft-editor draft-compare-editor" id="draftCompareRightEditor" contenteditable="false"><div class="compare-doc-loading" role="status" aria-live="polite"><div class="compare-doc-loading-spinner"></div><strong>비교 버전을 불러오고 있습니다.</strong><span>선택한 답변서 내용을 준비하고 있습니다.</span></div></div>
                  </section>
                </div>
                <div class="draft-compare-status">
                  <div class="draft-compare-status-left"><span>기준 <strong>${escapeHtml(getDraftVersionLabel(leftVersion))}</strong></span><span class="draft-compare-divider">|</span><span>비교 <strong>${escapeHtml(getDraftVersionLabel(rightVersion))}</strong></span><span class="draft-compare-divider">|</span><span>버전 메모를 함께 확인할 수 있습니다.</span></div>
                  <div class="draft-compare-status-right">
                    <button class="icon-button icon-button-sm document-statusbar-button" id="draftCompareZoomOut" type="button" aria-label="비교 화면 축소">−</button><strong class="document-statusbar-zoom" id="draftCompareZoomVal">${state.draftCompareZoom}%</strong><button class="icon-button icon-button-sm document-statusbar-button" id="draftCompareZoomIn" type="button" aria-label="비교 화면 확대">＋</button>
                    <button class="icon-button icon-button-sm document-statusbar-button" id="draftCompareFullscreen" type="button" aria-label="버전 비교 전체보기" title="버전 비교 전체보기"><svg viewBox="0 0 24 24" width="14" height="14"><path d="M3 3h5v2H5v3H3V3z M16 3h5v5h-2V5h-3V3z M3 16h2v3h3v2H3v-5z M19 19h-3v2h5v-5h-2v3z"/></svg></button>
                  </div>
                </div>
              </div>`;
              bindDraftVersionCompareEvents();
              try {
                const [leftContent, rightContent] = await Promise.all([
                  loadCompareReportVersion(leftVersion),
                  loadCompareReportVersion(rightVersion)
                ]);
                if (seq !== state.draftCompareRenderSeq || state.draftDisplayMode !== "compare") return;
                const leftEditor = document.getElementById("draftCompareLeftEditor");
                const rightEditor = document.getElementById("draftCompareRightEditor");
                if (leftEditor) {
                  leftEditor.innerHTML = parseMarkdown(leftContent || "");
                  wrapDocumentTables(leftEditor);
                }
                if (rightEditor) {
                  rightEditor.innerHTML = parseMarkdown(rightContent || "");
                  wrapDocumentTables(rightEditor);
                }
                applyDraftCompareZoom();
              } catch (error) {
                if (seq !== state.draftCompareRenderSeq) return;
                throw error;
              }
            }

            // bindDraftVersionCompareEvents: 관련 이벤트 핸들러를 연결.
            function bindDraftVersionCompareEvents() {
              const leftSelect = document.getElementById("draftCompareLeftSelect");
              const rightSelect = document.getElementById("draftCompareRightSelect");
              const leftEditor = document.getElementById("draftCompareLeftEditor");
              const rightEditor = document.getElementById("draftCompareRightEditor");
              const syncCheck = document.getElementById("draftCompareSync");
              const root = document.getElementById("draftVersionCompare");
              if (!leftSelect || !rightSelect || !leftEditor || !rightEditor || !root) return;
              leftSelect.addEventListener("change", () => {
                const next = Number(leftSelect.value || 0);
                if (!next) return;
                state.draftCompareLeftVersion = next;
                if (next === Number(state.draftCompareRightVersion)) {
                  state.draftCompareRightVersion = normalizeVersionNumbers().find((version) => Number(version) !== next) || 0;
                }
                renderDraftVersionCompareWorkspace();
              });
              rightSelect.addEventListener("change", () => {
                const next = Number(rightSelect.value || 0);
                if (!next) return;
                state.draftCompareRightVersion = next;
                if (next === Number(state.draftCompareLeftVersion)) {
                  state.draftCompareLeftVersion = normalizeVersionNumbers().find((version) => Number(version) !== next) || 0;
                }
                renderDraftVersionCompareWorkspace();
              });
              document.getElementById("draftCompareSwap")?.addEventListener("click", () => {
                const left = state.draftCompareLeftVersion;
                state.draftCompareLeftVersion = state.draftCompareRightVersion;
                state.draftCompareRightVersion = left;
                renderDraftVersionCompareWorkspace();
              });
              document.getElementById("draftCompareClose")?.addEventListener("click", () => {
                exitDraftVersionCompare();
              });
              const compareDownloadWraps = Array.from(root.querySelectorAll("[data-compare-download-wrap]"));
              const closeCompareDownloadMenus = (exceptWrap) => {
                compareDownloadWraps.forEach((wrap) => {
                  if (wrap === exceptWrap) return;
                  wrap.querySelector("[data-compare-download-menu]")?.classList.add("hidden");
                  wrap.querySelector("[data-compare-download-trigger]")?.setAttribute("aria-expanded", "false");
                });
              };
              compareDownloadWraps.forEach((wrap) => {
                const trigger = wrap.querySelector("[data-compare-download-trigger]");
                const menu = wrap.querySelector("[data-compare-download-menu]");
                trigger?.addEventListener("click", (event) => {
                  event.stopPropagation();
                  if (trigger.disabled || !menu) return;
                  const open = menu.classList.contains("hidden");
                  closeCompareDownloadMenus(open ? wrap : null);
                  menu.classList.toggle("hidden", !open);
                  trigger.setAttribute("aria-expanded", String(open));
                });
                menu?.addEventListener("click", (event) => {
                  event.stopPropagation();
                  const button = event.target.closest("[data-format]");
                  if (!button || button.disabled) return;
                  menu.classList.add("hidden");
                  trigger?.setAttribute("aria-expanded", "false");
                  const version = wrap.dataset.compareDownloadSide === "left"
                    ? Number(state.draftCompareLeftVersion)
                    : Number(state.draftCompareRightVersion);
                  openDraftDownloadConfirm(button.dataset.format, version);
                });
              });
              root.addEventListener("click", (event) => {
                if (!event.target.closest("[data-compare-download-wrap]")) {
                  closeCompareDownloadMenus(null);
                }
              });
              syncCheck?.addEventListener("change", () => {
                state.draftCompareScrollSync = !!syncCheck.checked;
              });
              let scrollLock = false;
              const syncScroll = (source, target) => {
                if (!state.draftCompareScrollSync || scrollLock) return;
                const sourceMax = Math.max(1, source.scrollHeight - source.clientHeight);
                const targetMax = Math.max(0, target.scrollHeight - target.clientHeight);
                scrollLock = true;
                target.scrollTop = (source.scrollTop / sourceMax) * targetMax;
                requestAnimationFrame(() => { scrollLock = false; });
              };
              leftEditor.addEventListener("scroll", () => syncScroll(leftEditor, rightEditor), { passive: true });
              rightEditor.addEventListener("scroll", () => syncScroll(rightEditor, leftEditor), { passive: true });
              document.getElementById("draftCompareZoomOut")?.addEventListener("click", () => {
                state.draftCompareZoom = Math.max(80, state.draftCompareZoom - 10);
                applyDraftCompareZoom();
              });
              document.getElementById("draftCompareZoomIn")?.addEventListener("click", () => {
                state.draftCompareZoom = Math.min(150, state.draftCompareZoom + 10);
                applyDraftCompareZoom();
              });
              document.getElementById("draftCompareFullscreen")?.addEventListener("click", () => {
                root.classList.toggle("is-fullscreen");
                showToast(root.classList.contains("is-fullscreen") ? "전체보기 모드입니다. ESC 키를 누르면 종료됩니다." : "전체보기를 종료했습니다.");
              });
              root.addEventListener("keydown", (event) => {
                if (event.key === "Escape" && root.classList.contains("is-fullscreen")) {
                  root.classList.remove("is-fullscreen");
                  showToast("전체보기를 종료했습니다.");
                }
              });
            }

            // applyDraftCompareZoom: 계산/저장된 상태를 화면에 반영.
            function applyDraftCompareZoom() {
              const zoom = Math.max(80, Math.min(150, Number(state.draftCompareZoom) || 100));
              state.draftCompareZoom = zoom;
              document.querySelectorAll("#draftVersionCompare .draft-compare-editor").forEach((editor) => {
                editor.style.fontSize = (14 * zoom / 100) + "px";
              });
              const label = document.getElementById("draftCompareZoomVal");
              if (label) label.textContent = zoom + "%";
            }

            function syncComparePanelOrder() {
              if (!el.compareGrid || !el.compareBasePanel || !el.compareDraftPanel) return;
              const resize = el.compareGrid.querySelector('[data-cmp-resize="0"]');
              if (!resize) return;
              if (state.comparePanelsSwapped) {
                el.compareGrid.insertBefore(el.compareDraftPanel, resize);
                el.compareGrid.insertBefore(el.compareBasePanel, resize.nextSibling);
              } else {
                el.compareGrid.insertBefore(el.compareBasePanel, resize);
                el.compareGrid.insertBefore(el.compareDraftPanel, resize.nextSibling);
              }
              el.compareDocumentSwap?.classList.toggle("active", state.comparePanelsSwapped);
              el.compareDocumentSwap?.setAttribute("aria-pressed", String(state.comparePanelsSwapped));
            }

            Object.assign(runtime, {
                syncComparePanelOrder,
                getCompareSimilarSources,
                getCompareVersionNumbers,
                getCompareSourceContent,
                buildCompareSourcePages,
                buildCompareDraftPages,
                loadCompareReportVersion,
                syncCompareViewportHeight,
                syncCompareScroll,
                renderCompareWorkspace,
                ensureDraftVersionCompareUi,
                updateDraftVersionCompareToggle,
                getDraftSingleContentElements,
                applyDraftDisplayMode,
                exitDraftVersionCompare,
                getDraftVersionLabel,
                getDraftVersionNote,
                renderDraftVersionCompareWorkspace,
                bindDraftVersionCompareEvents,
                applyDraftCompareZoom
            });
        }
    };
})(window);
