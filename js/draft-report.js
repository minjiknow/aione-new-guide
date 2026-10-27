/**
 * AI-ONE 답변서 본문·버전 관리
 * 적용 화면: ai-answer.html
 * 역할: 보고서 조회·렌더링, 편집·복원·다운로드, 근거 표시와 선택자료 저장
 * 연결: draft.js가 설치하며 공통 자료·채팅 서비스는 panel 런타임 사용
 * - 261022 변경 - 본문·버전·편집·다운로드를 담당하며 공통 문서 표 처리는 panel.js를 사용합니다.
 *
 * 기본 구간 형식: Start: 기능명 / End: 기능명
 * 변경 구간 형식: Start: YYMMDD 추가/수정 - 기능명 / End: YYMMDD 추가/수정 - 기능명
 * 주석 정리 내역
 * - 261023 주석 정리 - 구간 표시와 변경 내용 표기를 통일합니다. 기존 작업 날짜와 기능 설명은 유지합니다.
 */

(function registerdraft_reportModule(window) {
    window.AIOneDraftFeatureModules = window.AIOneDraftFeatureModules || {};
    window.AIOneDraftFeatureModules["draft-report.js"] = function install(runtime) {
        with (runtime) {
            // 목록 응답에서 report_id 또는 id가 있는 보고서 항목만 추린다.
            function reportItems(data) {
              const items = listResponse(data, "items");
              return items.filter((item) => item && (item.report_id || item.id));
            }

            // loadConversationReports: 서버/상태 데이터를 조회하고 화면 상태에 반영.
            async function loadConversationReports(conversationId, preferredReportId, preferredVersion, selectionEpoch) {
              if (!conversationId) {
                clearReport();
                return;
              }
              try {
                // [API 연동] GET ND_reportList.do: 선택한 대화의 답변서 목록 조회.
                const data = await requestJson(
                  "ND_reportList.do?conversationId=" + encodeURIComponent(conversationId) +
                  "&page=1&size=20"
                );
                const reports = reportItems(data);
                if (!isWorkspaceSelectionActive(conversationId, selectionEpoch)) return;
                if (!reports.length) {
                  clearReport();
                  return;
                }
                let selected = preferredReportId
                  ? reports.find((item) =>
                    String(item.report_id || item.id) === String(preferredReportId)
                  )
                  : null;
                if (!selected) {
                  selected = reports.slice().sort((a, b) =>
                    (Number(b.latest_version || b.version || 0) - Number(a.latest_version || a.version || 0)) ||
                    (new Date(b.updated_at || 0) - new Date(a.updated_at || 0))
                  )[0];
                }
                await loadReportDetail(
                  String(selected.report_id || selected.id),
                  preferredVersion || 0,
                  conversationId,
                  selectionEpoch
                );
              } catch (error) {
                console.error("보고서 목록 조회 실패", error);
                if (!isWorkspaceSelectionActive(conversationId, selectionEpoch)) return;
                clearReport();
              }
            }

            // getVersionList: 필요한 값을 조회.
            function getVersionList(report) {
              const candidates = [
                report?.versions,
                report?.version_history,
                report?.history
              ];
              for (const candidate of candidates) {
                if (Array.isArray(candidate)) return candidate;
              }
              return [];
            }

            // applySavedDocIdsToSelection: 계산/저장된 상태를 화면에 반영.
            function applySavedDocIdsToSelection(docIds) {
              const ids = new Set((Array.isArray(docIds) ? docIds : [])
                .map((id) => String(id || "").trim())
                .filter(Boolean));
              state.reportSelectedDocIds = ids;
              const selectedKeys = new Set();
              // 새로고침 복원 시 같은 doc_id가 history/evidence 양쪽에 있으면
              // 둘 다 선택되던 문제를 막는다. 동일 doc_id에서는 점수가 높은 항목 하나만 복원한다.
              ids.forEach((docId) => {
                const candidates = state.recommendationItems
                  .filter((item) => String(item.doc_id || "").trim() === docId)
                  .sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
                if (candidates.length) selectedKeys.add(candidates[0].key);
              });
              state.selectedReferenceKeys = selectedKeys;
              // DEBUG: 서버에서 다시 받은 doc_id가 화면의 어떤 key로 복원됐는지 확인
              console.log("[선택자료 DEBUG 2] 서버 조회 후 복원된 ID", {
                receivedDocIds: Array.from(ids),
                restoredReferenceKeys: Array.from(selectedKeys),
                restoredItems: Array.from(selectedKeys).map((key) => {
                  const item = state.recommendationItems.find((candidate) => candidate.key === key);
                  return {
                    key: key,
                    doc_id: String(item?.doc_id || "").trim(),
                    title: item?.title || item?.document_name || ""
                  };
                })
              });
              renderRecommendations();
              renderSelectedReferences();
            }

            // loadReportSelectedSources: 서버/상태 데이터를 조회하고 화면 상태에 반영.
            async function loadReportSelectedSources(reportId) {
              if (!reportId) {
                state.reportSelectedDocIds.clear();
                return [];
              }
              try {
                // [API 연동] GET ND_reportSources.do: 답변서에 저장된 선택자료 ID 조회.
                const data = await requestJson(
                  "ND_reportSources.do?reportId=" + encodeURIComponent(reportId)
                );
                const selectedDocIds =
                  nestedValue(data, "selected_doc_ids") ||
                  nestedValue(data, "selectedDocIds") ||
                  [];
                const normalized = Array.isArray(selectedDocIds)
                  ? selectedDocIds.map((id) => String(id || "").trim()).filter(Boolean)
                  : [];
                applySavedDocIdsToSelection(normalized);
                console.log("[v1.5 선택자료 조회]", {
                  reportId: reportId,
                  selected_doc_ids: normalized
                });
                return normalized;
              } catch (error) {
                console.warn("[v1.5 선택자료 조회 실패]", error);
                return [];
              }
            }

            // saveReportSelectedSources: 현재 상태를 서버 또는 저장소에 저장.
            async function saveReportSelectedSources(docIds, options) {
              const config = options || {};
              const normalized = Array.from(new Set(
                (Array.isArray(docIds) ? docIds : [])
                  .map((id) => String(id || "").trim())
                  .filter(Boolean)
              )).slice(0, 50);
              if (!state.reportId) {
                // 최초 보고서가 아직 없으면 No.17 저장 대상 자체가 없다.
                state.reportSelectedDocIds = new Set(normalized);
                return normalized;
              }
              try {
                const patchPayload = {
                  reportId: state.reportId,
                  selectedDocIds: normalized
                };
                console.log("[선택자료 DEBUG 3] PATCH 요청 직전", {
                  url: "ND_reportSources.do",
                  method: "PATCH",
                  reportId: state.reportId,
                  selectedDocIds: normalized,
                  payload: patchPayload,
                  payloadJson: JSON.stringify(patchPayload)
                });
                // [API 연동] PATCH ND_reportSources.do: 답변서의 선택자료 목록 저장.
                const patchResponse = await requestJson("ND_reportSources.do", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json;charset=UTF-8" },
                  body: JSON.stringify(patchPayload)
                });
                console.log("[선택자료 DEBUG 4] PATCH 응답", {
                  reportId: state.reportId,
                  sentDocIds: normalized,
                  response: patchResponse
                });
                state.reportSelectedDocIds = new Set(normalized);
                if (!config.silent) {
                  showToast("선택한 관련자료를 저장했습니다.");
                }
                console.log("[v1.5 선택자료 저장]", {
                  reportId: state.reportId,
                  selected_doc_ids: normalized
                });
                return normalized;
              } catch (error) {
                console.error("[v1.5 선택자료 저장 실패]", error);
                if (!config.silent) {
                  showToast("선택한 관련자료 저장에 실패했습니다.");
                }
                throw error;
              }
            }

            // scheduleSelectedSourcesSave: 지연 실행 또는 저장 작업을 예약.
            function scheduleSelectedSourcesSave() {
              if (!state.reportId) return;
              window.clearTimeout(selectedSourcesSaveTimer);
              selectedSourcesSaveTimer = window.setTimeout(() => {
                saveReportSelectedSources(selectedDocIdsFromUi(), { silent: true })
                  .catch(() => {});
              }, 250);
            }

            // loadReportVersionContext: 서버/상태 데이터를 조회하고 화면 상태에 반영.
            async function loadReportVersionContext(reportId, version, visitedVersions) {
              const targetVersion = Number(version);
              if (!reportId || targetVersion < 1) return null;
              const visited = visitedVersions || new Set();
              if (visited.has(targetVersion)) return null;
              visited.add(targetVersion);
              // [API 연동] GET ND_reportVersionDetail.do: 지정 버전의 관련자료/답변서 정보 조회.
              const data = await requestJson(
                "ND_reportVersionDetail.do?reportId=" + encodeURIComponent(reportId) +
                "&version=" + encodeURIComponent(targetVersion)
              );
              const current = singleResponse(data);
              if (!current) return null;
              // references가 null뿐 아니라 빈 배열([])이어도 이 버전에 자체 참고자료가 없는 것으로 보고
              // based_on 버전의 참고자료를 상속한다.
              const hasReferences = Array.isArray(current.references) && current.references.length > 0;
              const hasSources = Array.isArray(current.sources);
              if (hasReferences && hasSources) {
                return {
                  versionReport: current,
                  references: current.references,
                  sources: current.sources
                };
              }
              const basedOn = Number(current.based_on || 0);
              if (basedOn > 0 && basedOn !== targetVersion) {
                const inherited = await loadReportVersionContext(reportId, basedOn, visited);
                return {
                  versionReport: current,
                  references: hasReferences ? current.references : (inherited?.references ?? null),
                  sources: hasSources ? current.sources : (inherited?.sources ?? null)
                };
              }
              return {
                versionReport: current,
                references: hasReferences ? current.references : null,
                sources: hasSources ? current.sources : null
              };
            }

            // loadLatestReportRecommendationContext: 서버/상태 데이터를 조회하고 화면 상태에 반영.
            async function loadLatestReportRecommendationContext(reportId, excludedVersion) {
              if (!reportId) return null;
              const versions = normalizeVersionNumbers()
                .filter((version) => Number(version) !== Number(excludedVersion))
                .sort((a, b) => b - a);
              for (const version of versions) {
                try {
                  // [API 연동] GET ND_reportVersionDetail.do: 관련자료가 있는 최신 버전의 정보 조회.
                  const data = await requestJson(
                    "ND_reportVersionDetail.do?reportId=" + encodeURIComponent(reportId) +
                    "&version=" + encodeURIComponent(version)
                  );
                  const versionReport = singleResponse(data);
                  const sources = Array.isArray(versionReport?.sources) ? versionReport.sources : [];
                  if (!sources.length) continue;
                  return {
                    version: version,
                    sources: sources
                  };
                } catch (error) {
                  console.warn("[보고서 최신 유사답변서 조회 실패] v" + version, error);
                }
              }
              return null;
            }

            // loadReportDetail: 서버/상태 데이터를 조회하고 화면 상태에 반영.
            async function loadReportDetail(reportId, preferredVersion, guardConversationId, guardEpoch, referenceBaseVersion) {
              const requestSeq = ++reportDetailRequestSeq;
              try {
                // [API 연동] GET ND_reportDetail.do: 답변서 상세 조회. renderReport() 및 관련자료 렌더링에 반영.
                const data = await requestJson(
                  "ND_reportDetail.do?reportId=" + encodeURIComponent(reportId)
                );
                const report = singleResponse(data);
                if (requestSeq !== reportDetailRequestSeq) return;
                if (
                  guardConversationId &&
                  !isWorkspaceSelectionActive(guardConversationId, guardEpoch)
                ) return;
                if (!report || !(report.report_id || report.id)) {
                  clearReport();
                  return;
                }
                state.reportId = String(report.report_id || report.id);
                state.reportTitle = String(report.title || "답변서");
                state.reportVersions = getVersionList(report);
                const latestVersion = Number(report.latest_version || report.version || 0);
                const requestedVersion = Number(preferredVersion) || latestVersion || 1;
                let version = requestedVersion;
                let content = String(report.content || report.markdown || "");
                try {
                  const versionContext = await loadReportVersionContext(
                    state.reportId,
                    requestedVersion
                  );
                  if (requestSeq !== reportDetailRequestSeq) return;
                  if (
                    guardConversationId &&
                    !isWorkspaceSelectionActive(guardConversationId, guardEpoch)
                  ) return;
                  const versionReport = versionContext?.versionReport;
                  if (versionReport) {
                    version = Number(versionReport.version || requestedVersion);
                    content = String(versionReport.content || versionReport.markdown || content);
                    const selectedVersionSources = Array.isArray(versionContext.sources)
                      ? versionContext.sources
                      : [];
                    // 일반 조회는 현재 버전의 based_on 체인을 사용한다.
                    // 편집/복원 직후에는 새 버전 자체의 based_on 값과 무관하게
                    // 실제 편집 대상/복원 대상 버전을 참고자료 기준으로 명시할 수 있다.
                    let referenceContext = versionContext;
                    const referenceVersion = Number(referenceBaseVersion) || 0;
                    if (referenceVersion > 0 && referenceVersion !== version) {
                      referenceContext = await loadReportVersionContext(
                        state.reportId,
                        referenceVersion
                      ) || versionContext;
                      if (requestSeq !== reportDetailRequestSeq) return;
                      if (
                        guardConversationId &&
                        !isWorkspaceSelectionActive(guardConversationId, guardEpoch)
                      ) return;
                    }
                    const selectedVersionReferences = Array.isArray(referenceContext?.references)
                      ? referenceContext.references
                      : [];
                    let displaySources = selectedVersionSources;
                    if (!displaySources.length) {
                      // 선택한 버전에 유사답변서가 없으면 버전에 종속시키지 않는다.
                      // 전체 보고서 버전 중 유사답변서가 실제 저장된 가장 최신 버전을 사용한다.
                      let fallback = await loadLatestReportRecommendationContext(
                        state.reportId,
                        version
                      );
                      if (requestSeq !== reportDetailRequestSeq) return;
                      if (
                        guardConversationId &&
                        !isWorkspaceSelectionActive(guardConversationId, guardEpoch)
                      ) return;
                      // 보고서 어느 버전에도 없을 때만 대화 메시지의 최신 유사답변서를 사용한다.
                      if (!fallback?.sources?.length && state.conversationId) {
                        const recovered = await recoverLatestAssistantMetadata(state.conversationId);
                        if (requestSeq !== reportDetailRequestSeq) return;
                        if (Array.isArray(recovered.sources) && recovered.sources.length > 0) {
                          fallback = { sources: recovered.sources };
                        }
                      }
                      displaySources = Array.isArray(fallback?.sources) ? fallback.sources : [];
                    }
                    // 유사답변서는 버전과 무관하게 최신 사용 가능 자료를 표시한다.
                    // 참조소스는 반드시 현재 선택한 답변서 버전의 references만 표시한다.
                    setRecommendations(displaySources, selectedVersionReferences);
                  }
                } catch (versionError) {
                  if (requestSeq !== reportDetailRequestSeq) return;
                  console.warn("[보고서 버전별 관련자료 조회 실패] 기존 보고서 본문으로 계속 표시합니다.", versionError);
                }
                if (requestSeq !== reportDetailRequestSeq) return;
                state.reportVersion = version;
                state.reportContent = content;
                renderReport();
                if (el.compareTabCount) {
                  const hasCompare = !!(
                    state.reportId &&
                    getCompareSimilarSources().length &&
                    getCompareVersionNumbers().length
                  );
                  el.compareTabCount.textContent = hasCompare ? "1" : "0";
                }
                if (!el.comparePanel?.hidden) {
                  await renderCompareWorkspace();
                }
              } catch (error) {
                if (requestSeq !== reportDetailRequestSeq) return;
                console.error("보고서 조회 실패", error);
                if (
                  guardConversationId &&
                  !isWorkspaceSelectionActive(guardConversationId, guardEpoch)
                ) return;
                clearReport();
              }
            }

            // clearReport: 관련 상태와 화면 값을 비움.
            function clearReport() {
              state.reportId = "";
              state.reportTitle = "";
              state.reportVersion = 0;
              state.reportContent = "";
              state.reportVersions = [];
              state.dismissedVersions.clear();
              renderReport();
            }

            // clearReportContentOnly: 관련 상태와 화면 값을 비움.
            function clearReportContentOnly() {
              if (!state.reportId || state.reportVersion <= 0) {
                clearReport();
                return;
              }
              state.reportContent = "";
              closeDraftEvidence();
              renderReport();
            }

            // normalizeVersionNumbers: 입력/API 데이터를 화면에서 사용할 형태로 정규화.
            function normalizeVersionNumbers() {
              const values = new Set();
              state.reportVersions.forEach((item) => {
                const value = Number(item.version || item.version_no || item.number || item);
                if (value > 0) values.add(value);
              });
              if (state.reportVersion > 0) values.add(state.reportVersion);
              // 전체 버전 목록은 selectbox 등 공통 영역에서 사용한다.
              // 상단 버전 칩의 X 버튼으로 숨긴 버전은 여기서 제거하지 않는다.
              return Array.from(values).sort((a, b) => b - a);
            }

            // getVersionTime: 필요한 값을 조회.
            function getVersionTime(version) {
              const item = state.reportVersions.find((entry) => {
                const value = Number(entry.version || entry.version_no || entry.number || entry);
                return value === version;
              });
              const raw =
                item?.regDt ||
                item?.reg_dt ||
                item?.createDt ||
                item?.create_dt ||
                item?.created_at ||
                item?.updated_at ||
                item?.time ||
                "";
              if (!raw) return "";
              const rawText = String(raw).trim();
              // "14:21:33" 같이 시간만 오는 경우
              const timeOnlyMatch = rawText.match(/(?:T|\s|^)(\d{2}):(\d{2})(?::(\d{2}))?/);
              if (timeOnlyMatch) {
                return (
                  timeOnlyMatch[1] + ":" +
                  timeOnlyMatch[2]
                );
              }
              // ISO datetime 등 Date로 파싱 가능한 경우
              const date = new Date(rawText);
              if (Number.isNaN(date.getTime())) return "";
              return (
                String(date.getHours()).padStart(2, "0") + ":" +
                String(date.getMinutes()).padStart(2, "0") + ":" +
                String(date.getSeconds()).padStart(2, "0")
              );
            }

            // renderVersionChips: 현재 상태를 기준으로 화면을 렌더링.
            function renderVersionChips(hasReport) {
              if (!el.versionChips) return;
              el.versionChips.innerHTML = "";
              if (!hasReport) {
                const empty = document.createElement("span");
                empty.className = "draft-version-chip-empty";
                empty.textContent = "버전 없음";
                el.versionChips.appendChild(empty);
                return;
              }
              normalizeVersionNumbers()
                .filter((version) => !state.dismissedVersions.has(version))
                .forEach((version) => {
                const isActive = version === state.reportVersion;
                const time = getVersionTime(version);
                const versionLabel = "v" + version + (time ? `(${time})` : "");
                const chip = document.createElement("span");
                chip.className = "answer-version-chip" + (isActive ? " active" : "");
                chip.dataset.answerVersionLabel = "v" + version;
                if (isActive) chip.setAttribute("aria-current", "true");
                const openButton = document.createElement("button");
                openButton.type = "button";
                openButton.className = "answer-version-open";
                openButton.dataset.answerVersionOpen = "";
                openButton.dataset.reportVersionChip = String(version);
                openButton.textContent = versionLabel;
                const closeButton = document.createElement("button");
                closeButton.type = "button";
                closeButton.className = "answer-version-close";
                closeButton.dataset.answerVersionClose = "";
                closeButton.dataset.reportVersionChip = String(version);
                closeButton.setAttribute("aria-label", versionLabel + " 레이블 닫기");
                closeButton.textContent = "×";
                chip.append(openButton, closeButton);
                el.versionChips.appendChild(chip);
              });
            }

            // cleanEvidenceSentenceText: 해당 기능의 세부 처리를 담당.
            function cleanEvidenceSentenceText(value) {
              return String(value || "")
                .replace(/\u00a0/g, " ")
                .replace(/<!--[\s\S]*?-->/g, " ")
                .replace(/<\/?[^>]+>/g, " ")
                .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
                .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
                .replace(/\\([*_`~#>\[\]()])/g, "$1")
                .replace(/\*\*([^*]+)\*\*/g, "$1")
                .replace(/__([^_]+)__/g, "$1")
                .replace(/~~([^~]+)~~/g, "$1")
                .replace(/`([^`]+)`/g, "$1")
                .replace(/^#{1,6}\s*/g, "")
                .replace(/^[>\-*+]\s+/g, "")
                .replace(/[*_`~]/g, "")
                .replace(/\s+/g, " ")
                .replace(/^[ㅇ○◦□■]\s*/g, "")
                .trim();
            }

            // getEvidenceSentenceText: 필요한 값을 조회.
            function getEvidenceSentenceText(marker) {
              const sentenceHost = marker?.closest("p, li, div") || marker?.parentElement;
              if (!sentenceHost) return "";
              const clone = sentenceHost.cloneNode(true);
              // 클릭 가능한 주석/각주 숫자는 선택 문장 본문이 아니므로 제거한다.
              clone.querySelectorAll(
                "[data-reference-marker], .draft-ref-marker, sup, .reference-marker, .citation-marker"
              ).forEach((node) => node.remove());
              return cleanEvidenceSentenceText(clone.innerText || clone.textContent || "");
            }

            // getReferenceByMarker: 필요한 값을 조회.
            function getReferenceByMarker(markerText) {
              const refs = Array.isArray(state.references) ? state.references : [];
              const marker = String(markerText || "").trim();
              const numberMatch = marker.match(/\d+/);
              if (!numberMatch) return null;
              const sourceIndex = Number(numberMatch[0]) - 1;
              if (sourceIndex < 0) return null;
              // 보고서 주석 번호는 현재 보고서 버전의 "참조소스" 표시 순서와 1:1로 연결한다.
              // [1] -> 첫 번째 참조소스, [2] -> 두 번째 참조소스 ...
              // 참조소스 UI는 동일 document_id의 chunk들을 하나의 문서로 묶어 표시하므로
              // 주석도 동일한 문서 단위 순서를 사용한다.
              const referenceItems = state.recommendationItems.filter(
                (item) => item.category === "evidence"
              );
              const item = referenceItems[sourceIndex];
              if (!item) return null;
              const ref =
                item.reference ||
                (Array.isArray(item.references) ? item.references[0] : null) ||
                item.raw ||
                null;
              if (!ref) return null;
              return {
                ref: ref,
                index: sourceIndex
              };
            }

            // renderDraftEvidence: 현재 상태를 기준으로 화면을 렌더링.
            function renderDraftEvidence(target, sentenceText) {
              if (!target?.ref) return;
              const ref = target.ref;
              const index = Number(target.index || 0);
              const refs = Array.isArray(state.references) ? state.references : [];
              if (el.evidenceSubtitle) {
                el.evidenceSubtitle.textContent = "선택 문장의 출처, 원문, 검토 의견";
              }
              if (el.evidenceStatus) {
                el.evidenceStatus.className = "status-badge green";
                el.evidenceStatus.textContent = "근거 확인";
              }
              const selectedSentence =
                cleanEvidenceSentenceText(sentenceText) ||
                cleanEvidenceSentenceText(ref.content);
              if (el.evidenceSentenceNumber) {
                el.evidenceSentenceNumber.textContent =
                  "문장 " + String(index + 1).padStart(2, "0");
              }
              if (el.evidenceSentence) {
                el.evidenceSentence.textContent = selectedSentence;
              }
              if (el.evidenceReferenceList) {
                const meta = ref.meta || {};
                const title = ref.document_name || ref.title || "참조자료";
                const metaText = [
                  meta.answerer_org,
                  meta.question_date,
                  meta.page ? "p." + meta.page : ""
                ].filter(Boolean).join(" · ");
                const quote = cleanEvidenceSentenceText(ref.content);
                el.evidenceReferenceList.innerHTML =
                  '<div class="vd-ref-card" data-vd-reference="' + index + '">' +
                    '<div class="vd-ref-head">' +
                      '<span class="vd-ref-file" data-vd-reference-file>' +
                        escapeHtml(title) +
                      '</span>' +
                      '<button class="vd-ref-btn" type="button" data-evidence-original="' +
                        escapeHtml(String(ref.document_id || ref.doc_id || "")) +
                      '" data-vd-reference-action>원문</button>' +
                    '</div>' +
                    '<div class="vd-ref-meta" data-vd-reference-meta>' +
                      escapeHtml(metaText) +
                    '</div>' +
                    '<div class="vd-ref-quote" data-vd-reference-quote>“' +
                      escapeHtml(quote) +
                    '”</div>' +
                  '</div>';
              }
            }

            // createDraftEvidenceSplitHandle: 새 데이터 또는 UI 요소를 생성.
            function createDraftEvidenceSplitHandle() {
              const handle = document.createElement("div");
              handle.className = "split-handler-handle";
              handle.setAttribute("role", "separator");
              handle.setAttribute("aria-orientation", "vertical");
              handle.setAttribute("aria-label", "답변서와 근거 상세 영역 너비 조절");
              handle.tabIndex = 0;
              handle.dataset.draftEvidenceSplitHandle = "";
              return handle;
            }

            // 근거 상세 패널 열기는 현재 비활성화되어 있다. 아래 패널 구성 코드는 실행되지 않는다.
            function openDraftEvidence(markerText, sentenceText) {
              // [비활성화] 보고서의 첨부파일/근거 주석을 클릭해도 우측 근거 상세 패널을 열지 않는다.
              // 기존 패널 로직은 아래에 그대로 보존하고, 필요 시 이 return만 제거하면 다시 활성화할 수 있다.
              return;
              const selected = getReferenceByMarker(markerText);
              if (!selected) {
                showToast("해당 주석에 연결된 근거 자료가 없습니다.");
                return;
              }
              renderDraftEvidence(selected, sentenceText);
              const layout = document.querySelector(".answer-draft-split-area");
              if (!layout || !el.evidencePanel) return;
              // 예전 퍼블 구조처럼 근거 패널을 열 때 split handle을 동적으로 생성한다.
              let handle = layout.querySelector("[data-draft-evidence-split-handle]");
              if (!handle) {
                handle = createDraftEvidenceSplitHandle();
                layout.insertBefore(handle, el.evidencePanel);
              }
              el.evidencePanel.classList.remove("hidden");
              el.evidencePanel.setAttribute("aria-hidden", "false");
              layout.classList.add("is-evidence-open");
              const draftPane = layout.querySelector(".answer-draft-main");
              draftPane?.style.removeProperty("flex");
              draftPane?.style.removeProperty("width");
              window.AIOneSplitHandler?.init?.(layout);
            }

            // closeDraftEvidence: 대상 화면/팝업을 닫고 상태를 정리.
            function closeDraftEvidence() {
              const layout = document.querySelector(".answer-draft-split-area");
              if (!layout || !el.evidencePanel) return;
              window.AIOneSplitHandler?.reset?.(layout);
              layout.querySelector("[data-draft-evidence-split-handle]")?.remove();
              layout.classList.remove("is-evidence-open");
              const draftPane = layout.querySelector(".answer-draft-main");
              draftPane?.style.removeProperty("flex");
              draftPane?.style.removeProperty("width");
              el.evidencePanel.classList.add("hidden");
              el.evidencePanel.setAttribute("aria-hidden", "true");
            }

            // decorateDraftReferenceMarkers: 해당 기능의 세부 처리를 담당.
            function decorateDraftReferenceMarkers() {
              const body = el.draftPaper?.querySelector("[data-ai-content]");
              if (!body) return;
              const superscriptDigitMap = {
                "⁰": "0",
                "¹": "1",
                "²": "2",
                "³": "3",
                "⁴": "4",
                "⁵": "5",
                "⁶": "6",
                "⁷": "7",
                "⁸": "8",
                "⁹": "9"
              };

              // superscriptToNormal: 해당 기능의 세부 처리를 담당.
              function superscriptToNormal(value) {
                return String(value || "")
                  .split("")
                  .map((char) => superscriptDigitMap[char] || char)
                  .join("");
              }

              // createReferenceMarkerButton: 새 데이터 또는 UI 요소를 생성.
              function createReferenceMarkerButton(number, displayText) {
                const button = document.createElement("button");
                button.type = "button";
                button.className = "draft-ref-marker";
                button.dataset.referenceMarker = String(number);
                button.textContent = displayText;
                button.title = "근거 " + number + " 확인";
                button.style.cursor = "pointer";
                button.style.pointerEvents = "auto";
                button.addEventListener("click", (event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  openDraftEvidence(number, getEvidenceSentenceText(button));
                });
                return button;
              }
              // API 본문에서 주석이 다음 세 형태 중 어느 것으로 와도 클릭 가능하게 변환한다.
              // 1) [1], [2]
              // 2) <sup>1</sup>
              // 3) 유니코드 위첨자 ¹ ² ³ ... (현재 실제 보고서 DOM 형태)
              const walker = document.createTreeWalker(
                body,
                NodeFilter.SHOW_TEXT,
                {
                  acceptNode(node) {
                    const value = node.nodeValue || "";
                    if (
                      !/\[(\d{1,3})\]/.test(value) &&
                      !/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/.test(value)
                    ) {
                      return NodeFilter.FILTER_REJECT;
                    }
                    if (node.parentElement?.closest("a,button,code,pre,script,style")) {
                      return NodeFilter.FILTER_REJECT;
                    }
                    return NodeFilter.FILTER_ACCEPT;
                  }
                }
              );
              const nodes = [];
              while (walker.nextNode()) nodes.push(walker.currentNode);
              nodes.forEach((node) => {
                const text = node.nodeValue || "";
                const frag = document.createDocumentFragment();
                let last = 0;
                const markerRegex = /\[(\d{1,3})\]|([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g;
                let match;
                while ((match = markerRegex.exec(text)) !== null) {
                  frag.appendChild(
                    document.createTextNode(text.slice(last, match.index))
                  );
                  if (match[1]) {
                    const number = match[1];
                    frag.appendChild(
                      createReferenceMarkerButton(number, "[" + number + "]")
                    );
                  } else {
                    const rawSuperscript = match[2];
                    const number = superscriptToNormal(rawSuperscript);
                    if (/^\d{1,3}$/.test(number)) {
                      frag.appendChild(
                        createReferenceMarkerButton(number, rawSuperscript)
                      );
                    } else {
                      frag.appendChild(document.createTextNode(rawSuperscript));
                    }
                  }
                  last = markerRegex.lastIndex;
                }
                frag.appendChild(document.createTextNode(text.slice(last)));
                node.parentNode?.replaceChild(frag, node);
              });
              body.querySelectorAll("sup").forEach((sup) => {
                if (!/^\s*\d{1,3}\s*$/.test(sup.textContent || "")) return;
                if (sup.querySelector("[data-reference-marker]")) return;
                const number = sup.textContent.trim();
                sup.style.pointerEvents = "auto";
                sup.replaceChildren(createReferenceMarkerButton(number, number));
              });
            }

            // getDraftPlainText: 필요한 값을 조회.
            function getDraftPlainText() {
              const body = el.draftPaper?.querySelector("[data-ai-content]");
              return String(body?.innerText || body?.textContent || "")
                .replace(/\u00a0/g, " ")
                .trim();
            }

            // getDraftPageMetrics: 필요한 값을 조회.
            function getDraftPageMetrics() {
              const explicitPages = el.draftPaper?.querySelectorAll(".web-doc-page, .draft-page, [data-document-page]");
              if (explicitPages && explicitPages.length > 0) {
                return {
                  pageHeight: explicitPages[0].getBoundingClientRect().height || 1,
                  total: explicitPages.length
                };
              }
              const scroll = el.draftScroll;
              const paper = el.draftPaper;
              if (!scroll || !paper) return { pageHeight: 1, total: 0 };
              // 별도 page DOM이 없는 API 응답은 현재 문서 뷰포트 높이를 한 페이지로 계산한다.
              const pageHeight = Math.max(1, scroll.clientHeight || paper.clientHeight || 1);
              const total = Math.max(1, Math.ceil(paper.scrollHeight / pageHeight));
              return { pageHeight, total };
            }

            // updateDraftDocumentStats: 기존 상태 또는 데이터를 갱신.
            function updateDraftDocumentStats() {
              if (!el.draftCharCount || !el.draftPageCurrent || !el.draftPageTotal) return;
              const hasReport = !!state.reportId && state.reportVersion > 0 && !!state.reportContent;
              if (!hasReport) {
                el.draftCharCount.textContent = "0";
                el.draftPageCurrent.textContent = "0";
                el.draftPageTotal.textContent = "0";
                return;
              }
              const text = getDraftPlainText();
              el.draftCharCount.textContent =
                text.replace(/\s/g, "").length.toLocaleString("ko-KR");
              const metrics = getDraftPageMetrics();
              const current = Math.min(
                metrics.total,
                Math.max(1, Math.floor((el.draftScroll?.scrollTop || 0) / metrics.pageHeight) + 1)
              );
              el.draftPageCurrent.textContent = String(current);
              el.draftPageTotal.textContent = String(metrics.total);
            }

            // renderReport: 현재 상태를 기준으로 화면을 렌더링.
            function renderReport() {
              // 보고서 본문이 없는 업무지원 화면에서도 채팅 초기화는 계속 진행한다.
              if (!el.draftPaper) return;
              const hasReport = !!state.reportId && state.reportVersion > 0;
              const draftPanel = document.getElementById("answerPanelDraft");
              const draftEmpty = draftPanel?.querySelector("[data-answer-draft-empty]");
              const draftContents = draftPanel?.querySelectorAll("[data-answer-draft-content]") || [];
              // 퍼블과 동일하게 보고서 자체가 없을 때는 빈 화면만 중앙에 표시한다.
              // 기존 보고서가 있으나 현재 본문만 비운 경우(clearReportContentOnly)는 버전 UI를 유지한다.
              if (draftEmpty) draftEmpty.hidden = hasReport;
              draftContents.forEach((element) => {
                element.hidden = !hasReport;
              });
              el.reportTitle.textContent = state.reportTitle || "답변서";
              el.reportVersionBadge.textContent = hasReport ? "v" + state.reportVersion : "버전 없음";
              el.reportEditBtn.disabled = !hasReport;
              el.reportRestoreBtn.disabled = !hasReport;
              el.draftDownloadBtn.disabled = !hasReport;
              // 답변서 초안 탭 배지는 현재 표시 중인 답변서 개수가 아니라
              // 이 대화에서 지금까지 생성된 전체 초안 버전 수를 표시한다.
              // 숨긴 버전 칩도 실제 버전 이력에는 남아 있으므로 전체 개수에 포함한다.
              const draftVersionCount = hasReport ? normalizeVersionNumbers().length : 0;
              el.draftTabCount.textContent = String(draftVersionCount);
              el.reportVersionSelect.innerHTML = "";
              if (!hasReport) {
                const option = document.createElement("option");
                option.value = "";
                option.textContent = "버전 없음";
                el.reportVersionSelect.appendChild(option);
                el.reportVersionSelect.disabled = true;
              } else {
                normalizeVersionNumbers().forEach((version) => {
                  const option = document.createElement("option");
                  option.value = String(version);
                  option.textContent = "v" + version;
                  option.selected = version === state.reportVersion;
                  el.reportVersionSelect.appendChild(option);
                });
                el.reportVersionSelect.disabled = false;
              }
              renderVersionChips(hasReport);
              ensureDraftVersionCompareUi();
              if (!hasReport || normalizeVersionNumbers().length < 2) {
                state.draftDisplayMode = "single";
              }
              applyDraftDisplayMode();
              closeDraftEvidence();
              const body = el.draftPaper.querySelector("[data-ai-content]");
              if (hasReport && state.reportContent) {
                const parsedReportHtml = parseMarkdown(state.reportContent);
                body.innerHTML = parsedReportHtml;
                console.groupCollapsed("[REPORT DOM DEBUG] innerHTML 삽입 후");
                console.log("[4] 실제 DOM table 개수:", body.querySelectorAll("table").length);
                console.log("[4-1] 실제 DOM tr 개수:", body.querySelectorAll("tr").length);
                console.log("[4-2] 실제 DOM td 개수:", body.querySelectorAll("td").length);
                console.log("[4-3] 실제 DOM th 개수:", body.querySelectorAll("th").length);
                console.log("[4-4] 실제 body.innerHTML:", body.innerHTML);
                console.groupEnd();
                wrapDocumentTables(body);
                console.groupCollapsed("[REPORT DOM DEBUG] wrapDocumentTables 후");
                console.log("[5] wrapper 개수:", body.querySelectorAll(".report-table-scroll").length);
                console.log("[5-1] table 개수:", body.querySelectorAll("table").length);
                console.groupEnd();
              } else {
                body.innerHTML = '<div class="draft-empty">생성된 답변서가 없습니다.</div>';
              }
              if (hasReport && state.reportContent) {
                decorateDraftReferenceMarkers();
              }
              requestAnimationFrame(updateDraftDocumentStats);
            }

            // extractReportMarkers: 해당 기능의 세부 처리를 담당.
            function extractReportMarkers(content) {
              const source = String(content || "");
              const markers = source.match(/<!--\s*(?:DRAFT_REPORT|Q::[\s\S]*?::)\s*-->/g);
              return Array.isArray(markers) ? markers.join("\n") : "";
            }

            // getEditableReportHtml: 필요한 값을 조회.
            function getEditableReportHtml(content) {
              const source = String(content || "");
              return parseMarkdown(source);
            }

            // clearCurrentAnswerResult: 관련 상태와 화면 값을 비움.
            function clearCurrentAnswerResult() {
              state.recommendationItems = [];
              state.references = [];
              state.selectedReferenceKeys.clear();
              state.activeReferenceKey = "";
              renderRecommendations();
              renderSelectedReferences();
              renderPreview();
              // 새 질문 시작 시 중앙 본문은 비우되,
              // 이전에 생성된 보고서 버전 칩 / 버전 selectbox 이력은 유지한다.
              clearReportContentOnly();
              closeDraftEvidence();
            }

            // saveReportVersion: 현재 상태를 서버 또는 저장소에 저장.
            async function saveReportVersion() {
              // 편집을 시작한 실제 대상 버전. 새 버전 생성 후 참고자료는 이 버전의
              // references(없으면 해당 버전의 based_on 체인)를 그대로 사용한다.
              const editBaseVersion = Number(state.reportVersion) || 0;
              const visibleContent = String(el.editContent.innerHTML || "").trim();
              const plainText = String(el.editContent.textContent || "").trim();
              if (!plainText) {
                showToast("보고서 본문을 입력해 주세요.");
                return;
              }
              const content = [state.editPreservedMarkers, visibleContent]
                .filter(Boolean)
                .join("\n")
                .trim();
              el.editSave.disabled = true;
              console.group("[보고서 수정/다운로드 검증] 1. 수정 저장 요청");
              console.log("reportId:", state.reportId);
              console.log("baseVersion:", state.reportVersion);
              console.log("contentLength:", content.length);
              console.log("content:", content);
              console.groupEnd();
              try {
                // [API 연동] POST ND_reportVersion.do: 편집한 답변서를 새 버전으로 저장.
                const response = await requestJson("ND_reportVersion.do", {
                  method: "POST",
                  headers: { "Content-Type": "application/json;charset=UTF-8" },
                  body: JSON.stringify({
                    reportId: state.reportId,
                    content: content,
                    note: "",
                    baseVersion: state.reportVersion
                  })
                });
                const created = singleResponse(response);
                const createdVersion = Number(
                  created?.version ||
                  created?.latest_version ||
                  nestedValue(response, "version") ||
                  nestedValue(response, "latest_version") ||
                  0
                );
                console.group("[보고서 수정/다운로드 검증] 2. 수정 저장 응답");
                console.log("response:", response);
                console.log("createdVersion:", createdVersion);
                console.groupEnd();
                if (createdVersion > 0) {
                  try {
                    // [API 연동] GET ND_reportVersionDetail.do: 저장된 버전의 상세 정보 재조회.
                    const savedVersionData = await requestJson(
                      "ND_reportVersionDetail.do?reportId=" + encodeURIComponent(state.reportId) +
                      "&version=" + encodeURIComponent(createdVersion)
                    );
                    const savedVersionReport = singleResponse(savedVersionData);
                    const savedVersionContent = String(
                      savedVersionReport?.content ||
                      savedVersionReport?.markdown ||
                      ""
                    );
                    console.group("[보고서 수정/다운로드 검증] 3. 저장 직후 버전 상세");
                    console.log("reportId:", state.reportId);
                    console.log("version:", createdVersion);
                    console.log("contentLength:", savedVersionContent.length);
                    console.log("content:", savedVersionContent);
                    console.log("rawResponse:", savedVersionData);
                    console.groupEnd();
                  } catch (verifyError) {
                    console.error("[보고서 수정/다운로드 검증] 저장 직후 버전 상세 조회 실패", verifyError);
                  }
                }
                closeEditModal();
                // 새 버전 번호가 응답에 있으면 그 버전을 정확히 조회하고,
                // 없으면 보고서 최신본을 다시 조회한다.
                await loadReportDetail(
                  state.reportId,
                  createdVersion,
                  undefined,
                  undefined,
                  editBaseVersion
                );
                setTab("draft");
                showToast("새 보고서 버전이 저장되었습니다.");
              } catch (error) {
                console.error(error);
                showToast(error.message.includes("409") ?
                  "다른 버전이 먼저 생성되었습니다. 최신 버전을 다시 확인해 주세요." :
                  "보고서 저장에 실패했습니다.");
              } finally {
                el.editSave.disabled = false;
              }
            }

            // openRestoreVersionModal: 대상 화면/팝업을 열고 필요한 데이터를 준비.
            function openRestoreVersionModal() {
              const versions = normalizeVersionNumbers().sort((a, b) => b - a);
              if (!state.reportId || !versions.length) {
                showToast("복원할 보고서 버전이 없습니다.");
                return;
              }
              document.getElementById("reportRestoreVersionModal")?.remove();
              const latestVersion = Math.max(...versions);
              let selectedVersion = state.reportVersion > 0 ? state.reportVersion : latestVersion;
              if (!versions.includes(selectedVersion)) selectedVersion = latestVersion;
              const modal = document.createElement("div");
              modal.id = "reportRestoreVersionModal";
              modal.className = "report-restore-modal";
              modal.innerHTML =
                '<div class="report-restore-dim" data-restore-close></div>' +
                '<section class="report-restore-dialog" role="dialog" aria-modal="true" aria-labelledby="reportRestoreTitle">' +
                  '<div class="report-restore-head">' +
                    '<div>' +
                      '<h3 id="reportRestoreTitle">버전 복원</h3>' +
                      '<p>복원할 버전을 선택해 주세요. 기존 버전은 유지되고 선택한 내용을 기준으로 새 최신 버전이 생성됩니다.</p>' +
                    '</div>' +
                    '<button type="button" class="report-restore-x" data-restore-close aria-label="닫기">×</button>' +
                  '</div>' +
                  '<div class="report-restore-body">' +
                    '<div class="report-restore-summary">' +
                      '<span>현재 최신 버전</span>' +
                      '<strong>v' + latestVersion + '</strong>' +
                      '<span class="report-restore-arrow">→</span>' +
                      '<span>복원 후</span>' +
                      '<strong class="report-restore-next">v' + (latestVersion + 1) + '</strong>' +
                    '</div>' +
                    '<div class="report-restore-label">복원 기준 버전</div>' +
                    '<div class="report-restore-list">' +
                      versions.map(function (version) {
                        const time = getVersionTime(version);
                        const currentText = version === latestVersion ? '<span class="report-restore-current">최신</span>' : '';
                        return '<button type="button" class="report-restore-item' +
                          (version === selectedVersion ? ' is-selected' : '') +
                          '" data-restore-version="' + version + '">' +
                          '<span class="report-restore-radio"></span>' +
                          '<span class="report-restore-version">v' + version + '</span>' +
                          (time ? '<span class="report-restore-time">' + escapeHtml(time) + '</span>' : '') +
                          currentText +
                        '</button>';
                      }).join("") +
                    '</div>' +
                    '<div class="report-restore-notice">' +
                      '<strong>v<span data-restore-selected>' + selectedVersion + '</span></strong>의 내용을 그대로 복사해 ' +
                      '<strong>v' + (latestVersion + 1) + '</strong>로 생성합니다.' +
                    '</div>' +
                  '</div>' +
                  '<div class="report-restore-foot">' +
                    '<button type="button" class="report-restore-cancel" data-restore-close>취소</button>' +
                    '<button type="button" class="report-restore-confirm" data-restore-confirm>선택 버전으로 복원</button>' +
                  '</div>' +
                '</section>';
              document.body.appendChild(modal);
              const close = function () {
                modal.remove();
              };
              modal.querySelectorAll("[data-restore-close]").forEach(function (button) {
                button.addEventListener("click", close);
              });
              modal.querySelectorAll("[data-restore-version]").forEach(function (button) {
                button.addEventListener("click", function () {
                  selectedVersion = Number(button.dataset.restoreVersion);
                  modal.querySelectorAll("[data-restore-version]").forEach(function (item) {
                    item.classList.toggle("is-selected", item === button);
                  });
                  const selected = modal.querySelector("[data-restore-selected]");
                  if (selected) selected.textContent = String(selectedVersion);
                });
              });
              modal.querySelector("[data-restore-confirm]").addEventListener("click", async function () {
                const confirmButton = modal.querySelector("[data-restore-confirm]");
                confirmButton.disabled = true;
                confirmButton.textContent = "복원 중...";
                try {
                  await restoreReportVersion(selectedVersion, latestVersion);
                  close();
                } catch (error) {
                  console.error("보고서 버전 복원 실패", error);
                  showToast(error.message && error.message.includes("409")
                    ? "다른 버전이 먼저 생성되었습니다. 최신 버전을 다시 확인해 주세요."
                    : "보고서 버전 복원에 실패했습니다.");
                  confirmButton.disabled = false;
                  confirmButton.textContent = "선택 버전으로 복원";
                }
              });
            }

            // 선택한 과거 버전을 기준으로 새 버전을 생성하고, 원본 버전의 참고자료와 함께 표시한다.
            async function restoreReportVersion(selectedVersion, latestVersion) {
              const reportId = state.reportId;
              selectedVersion = Number(selectedVersion);
              latestVersion = Number(latestVersion);
              if (!reportId || selectedVersion < 1 || latestVersion < 1) {
                throw new Error("복원할 버전 정보가 올바르지 않습니다.");
              }
              // 복원은 편집/버전생성 API(ND_reportVersion.do)가 아니라
              // 전용 복원 API를 호출한다.
              // 실제 외부 API: POST /report/{report_id}/versions/{version}/restore
              // [API 연동] POST ND_reportVersionRestore.do: 선택한 답변서 버전 복원.
              const response = await requestJson("ND_reportVersionRestore.do", {
                method: "POST",
                headers: { "Content-Type": "application/json;charset=UTF-8" },
                body: JSON.stringify({
                  reportId: reportId,
                  version: selectedVersion
                })
              });
              const created = singleResponse(response);
              // 복원 API의 정상 응답 version을 우선 사용한다.
              // 응답에 버전값이 없는 예외적인 경우에만 기존 예상값(latest + 1)을 사용한다.
              const createdVersion = Number(
                created?.version ||
                created?.latest_version ||
                nestedValue(response, "version") ||
                nestedValue(response, "latest_version") ||
                (latestVersion + 1)
              );
              // 복원으로 생성된 새 버전의 본문은 createdVersion을 조회하고,
              // 참고자료는 기존 처리 그대로 복원 대상 selectedVersion을 기준으로 한다.
              // loadReportDetail의 referenceBaseVersion -> loadReportVersionContext가
              // selectedVersion의 references/sources 및 based_on 체인을 따라간다.
              await loadReportDetail(
                reportId,
                createdVersion,
                undefined,
                undefined,
                selectedVersion
              );
              setTab("draft");
              showToast("v" + selectedVersion + " 버전을 기준으로 v" + createdVersion + " 버전을 생성했습니다.");
            }

            // downloadDraft: 보고서/파일 다운로드를 처리.
            async function downloadDraft(format, version) {
              const downloadVersion = Number(version) || Number(state.reportVersion);
              if (!state.reportId || downloadVersion < 1) {
                showToast("다운로드할 보고서가 없습니다.");
                return;
              }
              format = String(format || "").trim().toLowerCase();
              if (!["hwpx", "pdf", "md"].includes(format)) {
                showToast("지원하지 않는 다운로드 형식입니다.");
                return;
              }
              el.draftDownloadBtn.disabled = true;
              const compareDownloadButtons = document.querySelectorAll("[data-compare-download-wrap] button");
              compareDownloadButtons.forEach((button) => { button.disabled = true; });
              const formatLabel = format === "hwpx" ? "HWPX" : format === "pdf" ? "PDF" : "MD";
              showToast(formatLabel + " 파일 생성 중입니다.");
              try {
                // 다운로드 API에는 본문이 아니라 reportId + version만 전달된다.
                // 다운로드 대상 version의 상세와 현재 화면 본문을 진단 로그로 비교한다.
                // 비교 불일치나 상세 조회 실패는 다운로드를 차단하지 않는다.
                try {
                  // [API 연동] GET ND_reportVersionDetail.do: 다운로드 대상 버전 정보 조회.
                  const downloadVersionData = await requestJson(
                    "ND_reportVersionDetail.do?reportId=" + encodeURIComponent(state.reportId) +
                    "&version=" + encodeURIComponent(downloadVersion)
                  );
                  const downloadVersionReport = singleResponse(downloadVersionData);
                  const downloadVersionContent = String(
                    downloadVersionReport?.content ||
                    downloadVersionReport?.markdown ||
                    ""
                  );
                  console.group("[보고서 수정/다운로드 검증] 4. 다운로드 직전 버전 상세");
                  console.log("state.reportVersion:", state.reportVersion);
                  console.log("downloadVersion:", downloadVersion);
                  console.log("reportId:", state.reportId);
                  console.log("format:", format);
                  console.log("contentLength:", downloadVersionContent.length);
                  console.log("content:", downloadVersionContent);
                  console.log("state.reportContentLength:", String(state.reportContent || "").length);
                  console.log("state.reportContent:", state.reportContent);
                  console.log(
                    "상세 content === 화면 state.reportContent:",
                    downloadVersionContent === String(state.reportContent || "")
                  );
                  console.log("rawResponse:", downloadVersionData);
                  console.groupEnd();
                } catch (verifyError) {
                  console.error("[보고서 수정/다운로드 검증] 다운로드 직전 버전 상세 조회 실패", verifyError);
                }
                console.log("[보고서 수정/다운로드 검증] 5. 다운로드 생성 요청", {
                  reportId: state.reportId,
                  version: downloadVersion,
                  format: format
                });
                // [API 연동] GET ND_reportDownloadStart.do: 답변서 다운로드 파일 생성 시작.
                const start = await requestJson(
                  "ND_reportDownloadStart.do?reportId=" + encodeURIComponent(state.reportId) +
                  "&version=" + encodeURIComponent(downloadVersion) +
                  "&format=" + encodeURIComponent(format)
                );
                const jobId = String(nestedValue(start, "download_job_id") || nestedValue(start, "downloadJobId") || nestedValue(start, "job_id") || nestedValue(start, "jobId") || "");
                console.log("[보고서 수정/다운로드 검증] 6. 다운로드 시작 응답", {
                  reportId: state.reportId,
                  version: downloadVersion,
                  format,
                  jobId,
                  startResponse: start
                });
                if (!jobId) {
                  console.error("[보고서 다운로드 작업 ID 없음]", {
                    reportId: state.reportId,
                    version: downloadVersion,
                    format,
                    startResponse: start
                  });
                  throw new Error("download_job_id가 없습니다.");
                }
                for (let attempt = 0; attempt < 120; attempt += 1) {
                  // [API 연동] GET ND_reportDownloadStatus.do: 다운로드 파일 생성 상태 반복 조회.
                  const statusData = await requestJson(
                    "ND_reportDownloadStatus.do?reportId=" + encodeURIComponent(state.reportId) +
                    "&jobId=" + encodeURIComponent(jobId)
                  );
                  const status = String(nestedValue(statusData, "status") || "").toLowerCase();
                  if (["done", "completed", "complete", "success", "finished"].includes(status)) break;
                  if (status === "failed") {
                    const serverMessage = String(
                      nestedValue(statusData, "message") ||
                      nestedValue(statusData, "error_message") ||
                      nestedValue(statusData, "error") ||
                      nestedValue(statusData, "detail") ||
                      "파일 생성 실패"
                    );
                    console.error("[보고서 파일 생성 실패]", {
                      reportId: state.reportId,
                      version: downloadVersion,
                      format,
                      jobId,
                      status,
                      statusResponse: statusData
                    });
                    throw new Error(serverMessage);
                  }
                  if (!["queued", "processing", "pending", "running", "in_progress", "started"].includes(status)) {
                    console.error("[보고서 다운로드 알 수 없는 상태]", {
                      reportId: state.reportId,
                      version: downloadVersion,
                      format,
                      jobId,
                      status,
                      statusResponse: statusData
                    });
                    throw new Error("알 수 없는 상태: " + status);
                  }
                  if (attempt === 119) throw new Error("파일 생성 시간이 초과되었습니다.");
                  await sleep(1500);
                }
                // [API 연동] GET ND_reportDownloadFile.do: 생성이 완료된 답변서 파일 다운로드.
                const response = await fetch(
                  "ND_reportDownloadFile.do?reportId=" + encodeURIComponent(state.reportId) +
                  "&jobId=" + encodeURIComponent(jobId),
                  { method: "GET", credentials: "same-origin" }
                );
                if (!response.ok) throw new Error("파일 다운로드 실패: " + response.status);
                const blob = await response.blob();
                if (!blob.size) throw new Error("빈 파일입니다.");
                const contentType = response.headers.get("Content-Type") || "";
                if (/application\/json|text\/html/i.test(contentType)) {
                  const detail = await blob.text();
                  throw new Error("다운로드 API가 파일 대신 응답을 반환했습니다: " + detail.slice(0, 300));
                }
                const disposition = response.headers.get("Content-Disposition") || "";
                const utf8 = disposition.match(/filename\*=UTF-8''([^;]+)/i);
                const normal = disposition.match(/filename="?([^";]+)"?/i);
                let fileName = (state.reportTitle || "report") + "_v" + downloadVersion + "." + format;
                if (utf8?.[1]) {
                  try { fileName = decodeURIComponent(utf8[1]); }
                  catch (_) { fileName = utf8[1]; }
                } else if (normal?.[1]) {
                  fileName = normal[1];
                }
                const url = URL.createObjectURL(blob);
                const anchor = document.createElement("a");
                anchor.href = url;
                anchor.download = fileName;
                document.body.appendChild(anchor);
                anchor.click();
                anchor.remove();
                window.setTimeout(() => URL.revokeObjectURL(url), 1000);
              } catch (error) {
                console.error("[보고서 다운로드 최종 실패]", {
                  reportId: state.reportId,
                  version: downloadVersion,
                  format,
                  message: error?.message,
                  error
                });
                showToast(error?.message || "보고서 다운로드에 실패했습니다.");
              } finally {
                el.draftDownloadBtn.disabled = false;
                compareDownloadButtons.forEach((button) => { button.disabled = false; });
              }
            }

            // openDraftDownloadConfirm: 대상 화면/팝업을 열고 필요한 데이터를 준비.
            function openDraftDownloadConfirm(format, version) {
              runtime.pendingDownloadFormat = format;
              runtime.pendingDownloadVersion = version;
              const formatLabel = format === "hwpx" ? "HWPX" : format === "pdf" ? "PDF" : "MD";
              if (el.draftDownloadConfirmFormat) el.draftDownloadConfirmFormat.textContent = formatLabel;
              if (window.AIOneModal?.open) {
                window.AIOneModal.open(el.draftDownloadConfirmModal);
              } else {
                el.draftDownloadConfirmModal.classList.remove("hidden");
              }
            }

            async function openEditModal() {
                if (!state.reportId) return;
                const selectedVersion = Number(el.reportVersionSelect?.value) || Number(state.reportVersion) || 0;
                if (selectedVersion < 1) {
                    showToast("편집할 보고서 버전이 없습니다.");
                    return;
                }
                try {
                    /*
                     * 새 답변에 report가 없어서 중앙 본문만 비운 상태여도
                     * 상단의 기존 버전은 살아 있다.
                     *
                     * 이 상태에서 편집을 누르면 빈 content를 편집하면 안 되므로,
                     * selectbox가 가리키는 실제 버전 본문을 먼저 다시 조회한다.
                     */
                    if (!state.reportContent || Number(state.reportVersion) !== selectedVersion) {
                        await loadReportDetail(state.reportId, selectedVersion);
                    }
                    if (!state.reportContent) {
                        showToast("편집할 보고서 본문을 불러오지 못했습니다.");
                        return;
                    }
                    /*
                     * 중요:
                     * 기존 보고서 표시/편집 방식은 그대로 유지한다.
                     * source content를 임의로 textContent/escapeHtml로 바꾸지 않는다.
                     * 따라서 HTML 태그 문자열이 본문에 노출되는 방식으로 변환하지 않는다.
                     */
                    state.editPreservedMarkers = extractReportMarkers(state.reportContent);
                    el.editContent.innerHTML = getEditableReportHtml(state.reportContent);
                    el.editBackdrop.classList.remove("hidden");
                    el.editBackdrop.setAttribute("aria-hidden", "false");
                    window.setTimeout(() => el.editContent.focus(), 0);
                } catch (error) {
                    console.error("보고서 편집 본문 조회 실패", error);
                    showToast("편집할 보고서를 불러오지 못했습니다.");
                }
            }

            function closeEditModal() {
                el.editBackdrop.classList.add("hidden");
                el.editBackdrop.setAttribute("aria-hidden", "true");
            }

            function applyZoom() {
              const scale = state.zoom / 100;
              el.draftPaper.style.transform = "scale(" + scale + ")";
              el.draftPaper.style.transformOrigin = "top center";
              el.zoomPercent.textContent = state.zoom + "%";
              const paperHeight = el.draftPaper.offsetHeight || 0;
              el.draftPaper.style.marginBottom = Math.max(0, paperHeight * (scale - 1)) + "px";
            }

            Object.assign(runtime, {
                applyZoom,
                closeEditModal,
                openEditModal,
                reportItems,
                loadConversationReports,
                getVersionList,
                applySavedDocIdsToSelection,
                loadReportSelectedSources,
                saveReportSelectedSources,
                scheduleSelectedSourcesSave,
                loadReportVersionContext,
                loadLatestReportRecommendationContext,
                loadReportDetail,
                clearReport,
                clearReportContentOnly,
                normalizeVersionNumbers,
                getVersionTime,
                renderVersionChips,
                cleanEvidenceSentenceText,
                getEvidenceSentenceText,
                getReferenceByMarker,
                renderDraftEvidence,
                createDraftEvidenceSplitHandle,
                openDraftEvidence,
                closeDraftEvidence,
                decorateDraftReferenceMarkers,
                getDraftPlainText,
                getDraftPageMetrics,
                updateDraftDocumentStats,
                renderReport,
                extractReportMarkers,
                getEditableReportHtml,
                clearCurrentAnswerResult,
                saveReportVersion,
                openRestoreVersionModal,
                restoreReportVersion,
                downloadDraft,
                openDraftDownloadConfirm
            });
        }
    };
})(window);
