/**
 * 261028 누적 변경 요약 (현재 구현 기준)
 * - 문서 업로드·삭제·제출·즐겨찾기와 질의/PDF 조회를 처리합니다. 원본 너비 저장·복원, 원본/추출 보기 및 PDF 질의 강조·선택을 연결합니다.
 *
 * AI-ONE 질의분류 문서·질의 조회
 * 기본 구간 형식: Start: 기능명 / End: 기능명
 * 변경 구간 형식: Start: YYMMDD 추가/수정 - 기능명 / End: YYMMDD 추가/수정 - 기능명
 * 주석 정리 내역
 * - 261023 주석 정리 - 파일 안내와 구간·변경 내용 작성 형식을 통일합니다.
 */
(function registerclassification_fileModule(window) {
    window.AIOneClassificationFeatureModules = window.AIOneClassificationFeatureModules || {};
    window.AIOneClassificationFeatureModules["classification-file.js"] = function install(runtime) {
        with (runtime) {
            function getOriginalQuestionForView(query) {
              if (!query) return query;
              return {
                ...query,
                text: String(
                  query?.raw?.question_original_text ??
                  query?.question_original_text ??
                  ''
                )
              };
            }

            function buildOriginalPages(meta, queries) {
              const displayTitle = meta.formTitle || '질의 요지서';
              const displayCommittee = meta.committee || meta.dept || '';
              const displayMemberName = meta.memberName || '';
              const displayPartyName = meta.partyName || '';
              const displayDate = (meta.date || '')
                .replace(/\./g, '. ')
                .replace(/\s+/g, ' ')
                .trim();
              return `
                <div class="orig-page orig-page-form">
                  <div class="orig-form-title-wrap">
                    <h3 class="orig-form-title">${escapeHtml(displayTitle)}</h3>
                  </div>
                  <div class="orig-form-meta-row">
                    <span class="orig-form-date">${escapeHtml(displayDate)}</span>
                    <span class="orig-form-committee">${escapeHtml(displayCommittee)}</span>
                  </div>
                  <div class="orig-form-info-table">
                    <div class="orig-form-info-row">
                      <div class="orig-form-info-label">질의의원명</div>
                      <div class="orig-form-info-value">${escapeHtml(displayMemberName)}</div>
                      <div class="orig-form-info-label">교섭단체명</div>
                      <div class="orig-form-info-value">${escapeHtml(displayPartyName)}</div>
                    </div>
                  </div>
                  <div class="orig-query-boxes orig-query-boxes-form">
                    ${queries.map((q, idx) => {
                      const originalQ =
                        getOriginalQuestionForView(
                          q,
                          idx
                        );
                      const subQuestions =
                        Array.isArray(originalQ?.subQuestions)
                          ? originalQ.subQuestions
                          : [];
                      return `
                        <div class="orig-question-group${q.isDeleted ? ' is-disabled' : ''}"${q.isDeleted ? ' aria-disabled="true" inert' : ''}>
                          <div class="orig-query-box orig-form-query-box${!q.isDeleted && idx === activeQueryIndex ? ' active' : ''}" data-qidx="${idx}">
                            <span class="orig-query-num orig-form-query-num">${originalQ.questionOrder ?? originalQ.id ?? (idx + 1)}</span>
                            <span class="orig-query-box-text orig-form-query-text">${escapeHtml(originalQ.text)}</span>
                          </div>
                          ${subQuestions.length ? `
                            <div class="orig-sub-question-list">
                              ${subQuestions.map(sub => `<div class="orig-sub-question-item"><span class="orig-sub-question-bullet">-</span><span class="orig-sub-question-card">${sub}</span></div>`).join('')}
                            </div>` : ''}
                        </div>`;
                    }).join('')}
                  </div>
                </div>`;
            }

            function getDocOriginalWidthBounds(splitView, handleWidth = 4) {
              const availableWidth = Math.max(0, splitView.clientWidth - handleWidth);
              const minLeft = Math.min(300, Math.max(220, Math.round(availableWidth * 0.28)));
              const minRight = Math.min(320, Math.max(240, Math.round(availableWidth * 0.30)));
              const maxByRight = Math.max(minLeft, availableWidth - minRight);
              const maxByRatio = Math.max(minLeft, Math.round(availableWidth * 0.72));
              const maxLeft = Math.max(minLeft, Math.min(maxByRight, maxByRatio));
              return { minLeft, maxLeft };
            }

            function resetDocOriginalWidth(showMessage = false) {
              const left = $('.doc-split-left');
              const right = $('.doc-split-right');
              if (!left || !right) return;
              left.style.removeProperty('width');
              left.style.flex = '1.8 1 0%';
              right.style.removeProperty('width');
              right.style.flex = '1 1 0%';
              workspaceCommon.deleteCookie(UI_DOC_SPLIT_WIDTH_COOKIE);
              if (showMessage) showToast('원본 문서 영역을 기본 너비로 초기화했습니다.');
            }

            function applyDocOriginalWidth() {
              const splitView = $('.doc-split-view');
              const left = $('.doc-split-left', splitView);
              const right = $('.doc-split-right', splitView);
              const handle = splitView?.querySelector(
                ':scope > .doc-split-handle, :scope > [data-component="split-handler"], :scope > .resize-handle'
              );
              if (!splitView || !left || !right) return;

              const savedWidth = Number(
                workspaceCommon.getCookie(UI_DOC_SPLIT_WIDTH_COOKIE)
              );
              if (!Number.isFinite(savedWidth) || savedWidth <= 0) return;

              const handleWidth = Math.max(
                2,
                Math.round(handle?.getBoundingClientRect().width || 2)
              );
              const { minLeft, maxLeft } = getDocOriginalWidthBounds(
                splitView,
                handleWidth
              );
              const nextWidth = Math.min(
                maxLeft,
                Math.max(minLeft, Math.round(savedWidth))
              );

              left.style.flex = `0 0 ${nextWidth}px`;
              left.style.width = `${nextWidth}px`;
              right.style.flex = '1 1 0%';
              right.style.removeProperty('width');
            }

            function initDocSplitPersistence(splitView) {
              if (
                !splitView ||
                splitView.dataset.classificationSplitPersistenceReady === 'true'
              ) {
                return;
              }

              const left = splitView.querySelector(':scope > .doc-split-left');
              const handle = splitView.querySelector(
                ':scope > .doc-split-handle, :scope > [data-component="split-handler"], :scope > .resize-handle'
              );
              if (!left || !handle) return;

              splitView.dataset.classificationSplitPersistenceReady = 'true';

              const persistCurrentWidth = () => {
                const width = Math.round(left.getBoundingClientRect().width);
                if (!Number.isFinite(width) || width <= 0) return;
                workspaceCommon.setCookie(
                  UI_DOC_SPLIT_WIDTH_COOKIE,
                  String(width),
                  { maxAge: UI_COOKIE_MAX_AGE }
                );
              };

              const finishPointerResize = event => {
                if (
                  event.pointerId !== undefined &&
                  handle.hasPointerCapture?.(event.pointerId)
                ) {
                  try {
                    handle.releasePointerCapture(event.pointerId);
                  } catch (error) {
                    // 이미 해제된 pointer capture는 무시한다.
                  }
                }
                persistCurrentWidth();
              };

              handle.addEventListener('pointerdown', event => {
                if (
                  event.pointerId !== undefined &&
                  typeof handle.setPointerCapture === 'function'
                ) {
                  try {
                    handle.setPointerCapture(event.pointerId);
                  } catch (error) {
                    // 브라우저가 pointer capture를 지원하지 않는 경우 기존 resize만 유지한다.
                  }
                }
              });
              handle.addEventListener('pointerup', finishPointerResize);
              handle.addEventListener('pointercancel', finishPointerResize);
              handle.addEventListener('keydown', event => {
                if (
                  event.key !== 'ArrowLeft' &&
                  event.key !== 'ArrowRight'
                ) {
                  return;
                }
                window.requestAnimationFrame(persistCurrentWidth);
              });
              handle.addEventListener('dblclick', () => {
                resetDocOriginalWidth(true);
              });

              applyDocOriginalWidth();
            }

            function renderDocContentForFile(text) {
              if (text !== undefined) lastDocText = text;
              text = lastDocText;
              const queries = questions;
              if (activeQueryIndex >= queries.length) activeQueryIndex = Math.max(0, queries.length - 1);
              // Left: Original text — 질의 건수에 따라 여러 페이지로 구성, 각 문장은 클릭 가능한 번호 박스로 표시
              const docOriginal = $('#docOriginal');
              if (docOriginal) {
                const activeFile = uploadedFiles[activeFileIndex];
                const meta = (activeFile && documentMetaMap[activeFile.name]) || {};
                docOriginal.innerHTML = buildOriginalPages(meta, queries);
                // 번호 박스 클릭 → 우측 상세 패널 갱신
                $$('.orig-query-box', docOriginal).forEach(box => {
                  box.addEventListener('click', () => {
                    const targetIndex =
                      parseInt(box.dataset.qidx, 10);
                    if (
                      !Number.isInteger(targetIndex) ||
                      targetIndex < 0 ||
                      targetIndex >= questions.length ||
                      questions[targetIndex].isDeleted
                    ) {
                      return;
                    }
                    activeQueryIndex = targetIndex;
                    const targetQuery =
                      questions[targetIndex];
                    renderDocContentForFile(text);
                    /*
                     * 질의요지서에서 Q4/Q5처럼 아래쪽 질의를 눌렀을 때
                     * 오른쪽 "질의목록·추천실국"도 같은 질의 카드가 보이도록 이동한다.
                     * 연결 시 전체 필터로 맞추고, 전체에는 제외 질의도 포함한다.
                     */
                    currentFilter = 'all';
                    $$('.filter-btn').forEach(item => {
                      const isAll =
                        item.dataset.filter === 'all';
                      item.classList.toggle(
                        'active',
                        isAll
                      );
                      item.setAttribute(
                        'aria-pressed',
                        String(isAll)
                      );
                    });
                    renderQueryList();
                    window.requestAnimationFrame(() => {
                      const targetQuestionKey = getQuestionStableKey(targetQuery);
                      const targetCard = $$('.query-card', queryList).find(
                        card => String(card.dataset.questionKey || '') === targetQuestionKey
                      );
                      if (!targetCard) return;
                      setMappedQueryCard(targetCard);
                      targetCard.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center',
                        inline: 'nearest'
                      });
                    });
                  });
                });
              }
              renderQueryDetailPanel(queries);
              applyDocOriginalWidth();
              // split drag/keyboard 처리는 common.js가 담당하고,
              // 질의분류 전용 너비 저장/복원과 더블클릭 초기화만 이 모듈에서 연결한다.
              const splitView = $('.doc-split-view');
              if (splitView) {
                window.AIOneSplitHandler?.init(splitView);
                initDocSplitPersistence(splitView);
              }
              // Update doc status bar
              updateDocStatusBar(text);
            }

            function updateDocStatusBar(text, pageCount) {
              const charCount = text ? text.replace(/\s/g, '').length : 0;
              const charEl = $('#docCharCount');
              if (charEl) charEl.textContent = charCount.toLocaleString();
              const pages = pageCount ?? Math.ceil(charCount / 2000);
              const pageNum = $('#docPageNum');
              const pageTotal = $('#docPageTotal');
              if (pageNum) pageNum.textContent = pages > 0 ? '1' : '0';
              if (pageTotal) pageTotal.textContent = pages;
              window.AIOneDocumentStatusBar?.init(document);
            }

            function getSecurityModal() {
              let modal = $('#customModalBackdrop');
              if (!modal) {
                modal = document.createElement('div');
                modal.id = 'customModalBackdrop';
                document.body.appendChild(modal);
              }
              modal.className = 'modal hidden';
              modal.setAttribute('data-modal', '');
              window.AIOneModal?.init(modal);
              return modal;
            }

            function renderSecurityFileRows(results, reasonKey) {
              return results.map(result => {
                const reasons = result[reasonKey] || [];
                return `<li class="security-file-row"><span class="security-file-name">${escapeSecurityHtml(result.file.name)}</span><span class="security-file-reason">${escapeSecurityHtml(reasons.join(' · '))}</span></li>`;
              }).join('');
            }

            function showSensitiveFileBlocked(results, onClose) {
              const modal = getSecurityModal();
              modal.innerHTML = `
                <div class="modal-bg" aria-hidden="true"></div>
                <section class="modal-contents modal-medium" data-modal-variant="alert" role="dialog" aria-modal="true" aria-label="업로드할 수 없는 파일이 있습니다">
                  <div class="modal-variant-panel" data-modal-panel="content">
                    <div class="modal-icon danger" data-modal-icon="default" aria-hidden="true">!</div>
                    <div class="modal-title">업로드할 수 없는 파일이 있습니다</div>
                    <div class="modal-msg security-modal-msg">개인정보 또는 민감정보가 감지된 파일은 업로드할 수 없습니다. 해당 정보를 삭제하거나 비식별 처리한 뒤 다시 업로드해 주세요.</div>
                    <ul class="security-file-list">${renderSecurityFileRows(results, 'sensitiveReasons')}</ul>
                    <div class="security-policy-note">차단된 파일은 업로드 목록 및 AI 분석 대상에 추가되지 않습니다.</div>
                    <div class="modal-actions"><button class="btn-confirm danger" data-modal-close id="securityBlockedOk">확인</button></div>
                  </div>
                </section>`;
              modal.addEventListener('modal:close', () => { if (onClose) onClose(); }, { once: true });
              window.AIOneModal?.init(modal);
              window.AIOneModal?.open(modal);
            }

            function showConfidentialFileConfirm(results, onConfirm) {
              const modal = getSecurityModal();
              modal.innerHTML = `
                <div class="modal-bg" aria-hidden="true"></div>
                <section class="modal-contents modal-medium" data-modal-variant="confirm" role="dialog" aria-modal="true" aria-label="대외비 파일 업로드 확인">
                  <div class="modal-variant-panel" data-modal-panel="content">
                    <div class="modal-icon alert" data-modal-icon="alert" aria-hidden="true">!</div>
                    <div class="modal-title">대외비 파일 업로드 확인</div>
                    <div class="modal-msg security-modal-msg">대외비 또는 비공개 정보가 감지되었습니다. 해당 자료에 대한 열람·활용 권한이 있는지 확인한 후 업로드를 진행해 주세요.</div>
                    <ul class="security-file-list">${renderSecurityFileRows(results, 'confidentialReasons')}</ul>
                    <div class="security-policy-note warning">확인 후 업로드하면 해당 파일이 AI 분석에 사용되며 업로드 및 이용 이력이 기록될 수 있습니다.</div>
                    <div class="modal-actions">
                      <button class="btn-cancel" data-modal-close>취소</button>
                      <button class="btn-confirm" id="securityConfidentialConfirm">확인 후 업로드</button>
                    </div>
                  </div>
                </section>`;
              window.AIOneModal?.init(modal);
              window.AIOneModal?.open(modal);
              $('#securityConfidentialConfirm')?.addEventListener('click', () => {
                window.AIOneModal?.close(modal);
                if (onConfirm) onConfirm(results.map(result => result.file));
              }, { once: true });
            }

            async function validateFilesBeforeUpload(inputFiles, uploadHandler) {
              const candidateFiles = Array.from(inputFiles || []);
              if (!candidateFiles.length) return;
              if (!window.AIOneUploadSecurity?.validate) {
                uploadHandler(candidateFiles);
                return;
              }
              const security = await window.AIOneUploadSecurity.validate(candidateFiles);
              const blocked = security.blocked || [];
              const confidential = security.confidential || [];
              const allowedFiles = candidateFiles.filter(file => !blocked.some(item => item.file === file));
              const continueAllowedUpload = () => {
                if (!allowedFiles.length) return;
                if (confidential.length) {
                  showConfidentialFileConfirm(confidential, approvedFiles => uploadHandler(approvedFiles));
                } else {
                  uploadHandler(allowedFiles);
                }
              };
              if (blocked.length) {
                showSensitiveFileBlocked(blocked, continueAllowedUpload);
                return;
              }
              continueAllowedUpload();
            }

            function getFileQueryCount(file) {
              const explicitCount = Number(file?.queryCount);
              if (Number.isFinite(explicitCount) && explicitCount >= 0) return explicitCount;
              const data = fileDataMap[file?.name];
              if (Array.isArray(data?.queries)) return data.queries.length;
              return 0;
            }

            $('#uploadFileSort')?.addEventListener('change', () => renderFileList());

            function renderFileList() {
              const hasFiles = uploadedFiles.length > 0;
              if (!hasFiles) updateDocStatusBar('');
              const summaryFileMemberCount = $('#uploadFileMemberCount');
              const currentMemberCount =
                hasFiles && Number.isFinite(Number(workspaceMemberCount))
                  ? Number(workspaceMemberCount)
                  : 0;
              const isMatched =
                uploadedFiles.length === currentMemberCount;
              const totalQueryCount =
                uploadedFiles.reduce(
                  (sum, file) =>
                    sum + Number(getFileQueryCount(file) || 0),
                  0
                );
              const summaryMessage =
                $('[data-upload-summary-message]');
              const summaryFooterFileCount =
                $('.upload-summary-footer .upload-summary-file-count');
              const summaryFooterMemberCount =
                $('.upload-summary-footer .upload-summary-member-count');
              if (summaryMessage) {
                summaryMessage.textContent =
                  `${totalQueryCount}건 질의 확인`;
              }
              if (summaryFooterFileCount) {
                summaryFooterFileCount.textContent =
                  String(uploadedFiles.length);
              }
              if (summaryFooterMemberCount) {
                summaryFooterMemberCount.textContent =
                  String(currentMemberCount);
              }
              if (fileCount) {
                fileCount.textContent =
                  uploadedFiles.length + '건';
              }
              const fileMemberRatio =
                $('#fileMemberRatio');
              if (fileMemberRatio) {
                fileMemberRatio.textContent =
                  uploadedFiles.length + '/' + currentMemberCount;
              }
              if (summaryFileMemberCount) {
                summaryFileMemberCount.innerHTML = `
                  <strong class="upload-summary-file-count ${isMatched ? 'match' : 'mismatch'}">
                    ${uploadedFiles.length}
                  </strong>
                  /
                  <span class="upload-summary-member-count">${currentMemberCount}</span>
                `;
                summaryFileMemberCount.classList.toggle(
                  'matched',
                  isMatched
                );
                summaryFileMemberCount.classList.toggle(
                  'mismatched',
                  !isMatched
                );
              }
              const sortDirection = $('#uploadFileSort')?.value === 'oldest' ? 1 : -1;
              const sortedFiles = uploadedFiles
                .map((file, index) => ({ file, index }))
                .sort((a, b) => {
                  const favoriteDiff = Number(Boolean(b.file.isFavorite)) - Number(Boolean(a.file.isFavorite));
                  if (favoriteDiff !== 0) return favoriteDiff;
                  const aCreatedAt = new Date(a.file.serverDoc?.created_at || a.file.createdAt || 0).getTime() || 0;
                  const bCreatedAt = new Date(b.file.serverDoc?.created_at || b.file.createdAt || 0).getTime() || 0;
                  if (aCreatedAt !== bCreatedAt) return (aCreatedAt - bCreatedAt) * sortDirection;
                  return a.index - b.index;
                });
              if (!sortedFiles.length) {
                fileList.innerHTML = `
                  <li class="file-list-empty">
                    <div class="empty-state answer-recommend-empty query-upload-empty">
                      <div class="no-file-icon type1" aria-hidden="true"><img src="../assets/icons/no-file.svg" alt="" aria-hidden="true"></div>
                      <strong class="empty-title type1">질의 업로드 목록이 없습니다</strong>
                      <span class="empty-desc type1">질의 파일을 업로드하면 이 영역에 목록이 표시됩니다</span>
                    </div>
                  </li>
                `;
                return;
              }
              fileList.innerHTML =
                sortedFiles
                  .map(
                    (
                      {
                        file: f,
                        index: i
                      },
                      displayIndex
                    ) => {
                      const type =
                        String(f.type || 'file')
                          .toLowerCase();
                      const displayName =
                        f.displayName ||
                        f.name ||
                        '업로드 파일';
                      return `
                        <li
                          class="${i === activeFileIndex ? 'active' : ''}${f.isFavorite ? ' pinned' : ''}"
                          data-file-idx="${i}"
                          data-file-key="${escapeHtml(f.name || displayName)}"
                        >
                          <button
                            class="file-item-main"
                            type="button"
                            aria-current="${i === activeFileIndex ? 'true' : 'false'}"
                            aria-label="업로드 순서 ${displayIndex + 1}번, ${escapeHtml(displayName)} 파일 보기"
                          >
                            <span class="file-index">${displayIndex + 1}</span>
                            <span class="file-type-dot ${escapeHtml(type)}" aria-hidden="true"></span>
                            <span class="file-icon file-icon-collapsed ${escapeHtml(type)}" aria-hidden="true">
                              ${escapeHtml(type === 'file' ? 'FILE' : type.toUpperCase())}
                            </span>
                            <span class="file-info">
                              <span class="file-name" title="${escapeHtml(displayName)}">
                                ${escapeHtml(displayName)}
                              </span>
                              <span class="file-meta">
                                ${escapeHtml(f.size || '')}${f.isFavorite ? ' · 목록 고정' : ''}
                              </span>
                            </span>
                          </button>
                          <span class="file-item-side">
                            <span class="file-status-group${normalizeActualStatus(f?.status) === 'completed' ? ' final' : ''}">
                              ${renderFileStatusBadge(f)}
                            </span>

                          </span>
                        </li>
                      `;
                    }
                  )
                  .join('');
              $$('.file-list li[data-file-idx]', fileList)
                .forEach(li => {
                  li.addEventListener(
                    'click',
                    event => {
                      if (
                        event.target.closest(
                          '.file-action-wrap'
                        )
                      ) {
                        return;
                      }
                      const idx =
                        parseInt(
                          li.dataset.fileIdx,
                          10
                        );
                      loadFileData(idx);
                    }
                  );
                });
              $$('.file-item-main', fileList)
                .forEach(btn => {
                  btn.addEventListener(
                    'click',
                    () => {
                      const li =
                        btn.closest(
                          'li[data-file-idx]'
                        );
                      if (!li) return;
                      loadFileData(
                        parseInt(
                          li.dataset.fileIdx,
                          10
                        )
                      );
                    }
                  );
                });
              fileList.querySelectorAll('li[data-file-idx]').forEach(row => {
                const index = Number(row.dataset.fileIdx);
                const file = uploadedFiles[index];
                window.AIOneFileActions.attach(row, {
                  title: () => file.displayName || file.name,
                  pinned: () => Boolean(file.isFavorite),
                  onPin: () => toggleActualFavorite(index),
                  onRename: title => { file.displayName = title; renderFileList(); },
                  onDelete: () => deleteUploadedFile(index),
                  listName: '질의 업로드 목록',
                  renameDescription: '현재 목록에 표시할 제목을 변경합니다.'
                });
              });
            }

            function closeFileActionMenus() {
              fileList.querySelectorAll('[data-file-action-menu]').forEach(component => {
                window.AIOneDropdownMenu.setOpen(component, false);
              });
            }

            async function toggleActualFavorite(index) {
              const file = uploadedFiles[index];
              if (!file?.documentId) {
                showToast('서버 document_id가 없어 즐겨찾기를 변경할 수 없습니다.');
                return;
              }
              const next = !Boolean(file.isFavorite);
              try {
                await setActualDocumentFavorite(file.documentId, next);
                file.isFavorite = next;
                renderFileList();
                showToast(next ? '파일을 목록 상단에 고정했습니다.' : '파일 고정을 해제했습니다.');
              } catch (error) {
                console.error('즐겨찾기 변경 실패', error);
                showToast(error.message || '즐겨찾기 변경에 실패했습니다.');
              }
            }

            function requestFileDelete(index) {
              const file = uploadedFiles[index];
              if (!file) return;
              window.AIOneFileActions.confirmDelete({
                title: () => file.displayName || file.name,
                listName: '질의 업로드 목록',
                onDelete: () => deleteUploadedFile(index)
              });
            }

            async function deleteUploadedFile(index) {
              const file = uploadedFiles[index];
              if (!file) return;
              try {
                if (file.documentId) {
                  const body = new URLSearchParams();
                  body.append('documentId', String(file.documentId));
                  // [API 연동] POST ND_deleteDocument.do: 업로드 문서 삭제.
                  await fetchJson('ND_deleteDocument.do', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
                    },
                    body: body.toString()
                  });
                }
                const removedName = String(file.name || '');
                uploadedFiles.splice(index, 1);
                if (removedName && fileDataMap[removedName]) {
                  delete fileDataMap[removedName];
                }
                if (activeFileIndex > index) {
                  activeFileIndex -= 1;
                } else if (activeFileIndex >= uploadedFiles.length) {
                  activeFileIndex = Math.max(0, uploadedFiles.length - 1);
                }
                renderFileList();
                if (uploadedFiles.length > 0) {
                  await loadFileData(activeFileIndex);
                } else {
                  resetAll({ full: false, showMessage: false });
                }
                showToast('문서가 삭제되었습니다.');
              } catch (error) {
                console.error('문서 삭제 실패', error);
                showToast(error.message || '문서 삭제에 실패했습니다.');
                return false;
              }
            }

            async function applyReclassificationToOriginalQuestion(
              originalQuery,
              primaryDepartments,
              supportDepartments
            ) {
              const questionId =
                String(originalQuery?.questionId || '').trim();
              const questionText =
                String(originalQuery?.text || '').trim();
              if (!questionId) {
                throw new Error('수정할 원본 질의 ID가 없습니다.');
              }
              if (!questionText) {
                throw new Error('수정할 원본 질의 내용이 없습니다.');
              }
              const body = new URLSearchParams();
              body.append('questionId', questionId);
              /*
               * 사용자가 저장한 변경 질의 제목은 그대로 유지한다.
               * 재분류 결과로 바꾸는 것은 담당/협조실국이다.
               */
              body.append('questionText', questionText);
              if (primaryDepartments.length) {
                primaryDepartments.forEach(dept => {
                  body.append(
                    'primaryDepartmentIds',
                    actualDepartmentId(dept)
                  );
                });
              } else {
                body.append('clearPrimaryDepartments', 'true');
              }
              if (supportDepartments.length) {
                supportDepartments.forEach(dept => {
                  body.append(
                    'supportDepartmentIds',
                    actualDepartmentId(dept)
                  );
                });
              } else {
                body.append('clearSupportDepartments', 'true');
              }
              // [API 연동] POST ND_updateQuestion.do: 재분류 결과를 원래 질의에 저장.
              return await fetchJson('ND_updateQuestion.do', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: body.toString()
              });
            }

            async function submitActualDocument(documentId) {
              const body = new URLSearchParams();
              body.append('documentId', documentId);
              // [API 연동] POST ND_submitDocument.do: 문서 제출 처리.
              return fetchJson('ND_submitDocument.do', { method: 'POST', body });
            }

            async function cancelActualDocumentSubmit(documentId) {
              const body = new URLSearchParams();
              body.append('documentId', documentId);
              // [API 연동] POST ND_cancelSubmit.do: 문서 제출 취소.
              return fetchJson('ND_cancelSubmit.do', { method: 'POST', body });
            }

            async function setActualDocumentFavorite(documentId, favorite) {
              const body = new URLSearchParams();
              body.append('documentId', documentId);
              // [API 연동] POST ND_addFavorite.do / ND_removeFavorite.do: 문서 즐겨찾기 추가/해제.
              return fetchJson(
                favorite ? 'ND_addFavorite.do' : 'ND_removeFavorite.do',
                { method: 'POST', body }
              );
            }

            function formatActualFileSize(bytes) {
              const value = Number(bytes || 0);
              if (value < 1024) return `${value}B`;
              if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)}KB`;
              return `${(value / 1024 / 1024).toFixed(1)}MB`;
            }

            function actualFileType(name) {
              const ext = String(name || '').split('.').pop().toLowerCase();
              if (ext === 'pdf') return 'pdf';
              if (ext === 'hwp' || ext === 'hwpx') return 'hwp';
              if (ext === 'docx' || ext === 'doc') return 'docx';
              if (['png','jpg','jpeg','tif','tiff'].includes(ext)) return 'img';
              return 'txt';
            }

            function normalizeActualDocuments(data) {
              if (Array.isArray(data)) return data;
              if (Array.isArray(data?.items)) return data.items;
              if (Array.isArray(data?.documents)) return data.documents;
              return data ? [data] : [];
            }

            async function addFiles(files) {
              const selected = Array.from(files || []);
              if (!selected.length) return;
              let targetConversationId = '';
              let requestEpoch = classificationWorkspaceEpoch;
              try {
                targetConversationId = String(await ensureActualConversation() || '');
                requestEpoch = classificationWorkspaceEpoch;
                if (!targetConversationId) {
                  throw new Error('파일을 업로드할 대화 ID가 없습니다.');
                }
                if (isClassificationWorkspaceActive(targetConversationId, requestEpoch)) {
                  showIntakeSkeleton('문서를 업로드하고 AI 분석을 시작하고 있습니다...');
                }
                const formData = new FormData();
                selected.forEach(file => formData.append('fileInput', file));
                // [API 연동] POST ND_uploadDocuments.do: 문서 업로드 후 응답으로 업로드 목록 구성.
                const data = await fetchJson('ND_uploadDocuments.do', { method: 'POST', body: formData });
                const docs = normalizeActualDocuments(data);
                console.groupCollapsed('[질의분류 진단][1-UPLOAD] ND_uploadDocuments.do');
                console.log('conversationId:', targetConversationId);
                console.log('선택 파일:', selected.map(file => ({
                  name: file.name,
                  size: file.size,
                  type: file.type
                })));
                console.log('upload raw response:', data);
                console.log('normalized documents:', docs.map(doc => ({
                  document_id: doc?.document_id,
                  file_name: doc?.file_name,
                  file_size: doc?.file_size,
                  classified: doc?.classified,
                  question_count: doc?.question_count,
                  last_job_id: doc?.last_job_id
                })));
                console.groupEnd();
                const completionBatchId =
                  `classification-${Date.now()}-${++classificationCompletionBatchSeq}`;
                const browserFileByKey = new Map(
                  selected.map(file => [`${file.name}_${file.size}`, file])
                );
                const active = isClassificationWorkspaceActive(targetConversationId, requestEpoch);
                let firstNewIndex = -1;
                if (active) {
                  firstNewIndex = uploadedFiles.length;
                  docs.forEach(doc => {
                    const serverName = String(doc.file_name || '');
                    const serverSize = Number(doc.file_size || 0);
                    const browserFile =
                      browserFileByKey.get(`${serverName}_${serverSize}`) ||
                      selected.find(file => file.name === serverName) ||
                      null;
                    const item = {
                      name: serverName,
                      displayName: serverName,
                      type: actualFileType(serverName),
                      size: formatActualFileSize(serverSize),
                      sizeBytes: serverSize,
                      status: 'processing',
                      chunks: 0,
                      documentId: String(doc.document_id || ''),
                      jobId: '',
                      serverDoc: doc,
                      file: browserFile,
                      isFavorite: Boolean(doc.is_favorite),
                      pinned: false,
                      completionBatchId,
                      completionBatchNotified: false,
                      conversationId: targetConversationId
                    };
                    uploadedFiles.push(item);
                    if (item.documentId && browserFile) {
                      actualFileMap.set(item.documentId, browserFile);
                    }
                    fileDataMap[item.name] = { docText: '', queries: [] };
                  });
                  renderFileList();
                  if (docs.length) loadFileData(firstNewIndex);
                  showToast(`${docs.length}건 파일이 업로드되었습니다. AI 분석을 시작합니다.`);
                }
                docs.forEach((doc, index) => {
                  const documentId = String(doc?.document_id || '');
                  registerActualPendingJob(targetConversationId, `starting:${documentId}`);
                  classifyActualDocument(
                    doc,
                    active ? firstNewIndex + index : -1,
                    targetConversationId,
                    requestEpoch,
                    completionBatchId
                  );
                });
              } catch (error) {
                if (!targetConversationId || isClassificationWorkspaceActive(targetConversationId, requestEpoch)) {
                  hideIntakeSkeleton();
                  console.error('문서 업로드 실패', error);
                  showToast(error.message || '문서 업로드에 실패했습니다.');
                } else {
                  console.error('백그라운드 문서 업로드 실패', error);
                }
              }
            }

            async function classifyActualDocument(
              doc,
              fileIndex,
              targetConversationId,
              requestEpoch,
              completionBatchId
            ) {
              const documentId = String(doc?.document_id || '');
              const conversationId = String(targetConversationId || actualConversationId || '');
              if (!documentId || !conversationId) return;
              try {
                const body = new URLSearchParams();
                body.append('documentIds', documentId);
                body.append('conversationId', conversationId);
                console.groupCollapsed('[질의분류 진단][1-CLASSIFY] ND_classify.do 요청');
                console.log('documentId:', documentId);
                console.log('conversationId:', conversationId);
                console.log('request body:', body.toString());
                console.groupEnd();

                // [API 연동] POST ND_classify.do: 문서 분류 작업 요청. 반환된 jobId로 진행 상태 조회.
                const job = await fetchJson('ND_classify.do', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                  body: body.toString()
                });
                console.groupCollapsed('[질의분류 진단][1-CLASSIFY] ND_classify.do 응답');
                console.log('documentId:', documentId);
                console.log('conversationId:', conversationId);
                console.log('classify raw response:', job);
                console.log('job_id:', job?.job_id);
                console.log('status:', job?.status);
                console.groupEnd();
                const jobId = String(job?.job_id || '');
                unregisterActualPendingJob(conversationId, `starting:${documentId}`);
                if (!jobId) throw new Error('질의분류 작업 ID가 없습니다.');
                registerActualPendingJob(conversationId, jobId);
                if (isClassificationWorkspaceActive(conversationId, requestEpoch)) {
                  const fileObj = findUploadedFileByDocumentId(documentId);
                  if (fileObj) {
                    fileObj.jobId = jobId;
                    fileObj.status = job?.status
                      ? normalizeActualStatus(job.status)
                      : 'processing';
                    fileObj.completionBatchId =
                      fileObj.completionBatchId || completionBatchId;
                    renderFileList();
                  }
                  renderDrawer();
                }
                pollActualJob(
                  documentId,
                  jobId,
                  fileIndex,
                  conversationId,
                  requestEpoch
                );
              } catch (error) {
                unregisterActualPendingJob(conversationId, `starting:${documentId}`);
                if (isClassificationWorkspaceActive(conversationId, requestEpoch)) {
                  const fileObj = findUploadedFileByDocumentId(documentId);
                  if (fileObj) fileObj.status = 'failed';
                  renderFileList();
                  syncActiveIntakeSkeleton();
                }
                console.group('[질의분류 진단][1-CLASSIFY-FAIL] 질의분류 생성 실패');
                console.error('error:', error);
                console.log('documentId:', documentId);
                console.log('conversationId:', conversationId);
                console.log('error message:', error?.message);
                console.log('error stack:', error?.stack);
                console.groupEnd();
              }
            }

            async function pollActualJob(
              documentId,
              jobId,
              fileIndex,
              targetConversationId,
              requestEpoch
            ) {
              const conversationId = String(targetConversationId || actualConversationId || '');
              try {
                // [API 연동] GET ND_jobStatus.do: 분류 작업 완료 여부를 반복 조회.
                const job = await fetchJson(`ND_jobStatus.do?jobId=${encodeURIComponent(jobId)}`);
                console.groupCollapsed('[질의분류 진단][1-JOB] ND_jobStatus.do');
                console.log('documentId:', documentId);
                console.log('jobId:', jobId);
                console.log('job status:', job?.status);
                console.log('job question_count:', job?.question_count);
                console.log('job documents:', job?.documents);
                console.log('job raw response:', job);
                console.groupEnd();
                let status = normalizeActualStatus(job?.status);
                const targetJobDocument = Array.isArray(job?.documents)
                  ? job.documents.find(
                      row => String(row?.document_id || '') === String(documentId)
                    )
                  : null;
                if (targetJobDocument?.status) {
                  status = normalizeActualStatus(targetJobDocument.status);
                }

                const active = isClassificationWorkspaceActive(conversationId, requestEpoch);
                if (status === 'processing') {
                  registerActualPendingJob(conversationId, jobId);
                }
                const currentFileIndex = active
                  ? uploadedFiles.findIndex(
                      file => String(file?.documentId || '') === String(documentId)
                    )
                  : -1;
                const fileObj = currentFileIndex >= 0
                  ? uploadedFiles[currentFileIndex]
                  : null;
                let expectedQuestionCount = Number(job?.question_count || 0);
                if (fileObj) {
                  fileObj.status = status;
                  if (targetJobDocument) {
                    fileObj.status = status;
                    if (Number.isFinite(Number(targetJobDocument?.question_count))) {
                      expectedQuestionCount = Number(targetJobDocument.question_count);
                    }
                  }
                  if (
                    status === 'completed' &&
                    expectedQuestionCount > 0 &&
                    !Number(fileObj.queryCount)
                  ) {
                    fileObj.queryCount = expectedQuestionCount;
                  }
                  renderFileList();
                }
                if (status === 'completed') {
                  actualJobTimers.delete(jobId);
                  unregisterActualPendingJob(conversationId, jobId);
                  if (active && currentFileIndex >= 0) {
                    await loadActualQuestions(
                      documentId,
                      jobId,
                      currentFileIndex,
                      expectedQuestionCount,
                      conversationId,
                      requestEpoch
                    );
                    const conversationStatus = await refreshActualConversationStatus(conversationId);
                    if (conversationStatus === 'completed') {
                      completedConversationIds.add(conversationId);
                    }
                    renderDrawer();
                    syncActiveIntakeSkeleton();
                    maybeNotifyClassificationBatchComplete(fileObj);
                  } else {
                    const conversationStatus = await refreshActualConversationStatus(conversationId).catch(() => 'processing');
                    if (conversationStatus === 'completed') {
                      completedConversationIds.add(conversationId);
                    }
                    renderDrawer();
                  }
                  await loadActualConversations(true, runListSearchTerm);
                  return;
                }
                if (status === 'failed') {
                  actualJobTimers.delete(jobId);
                  unregisterActualPendingJob(conversationId, jobId);
                  await refreshActualConversationStatus(conversationId).catch(() => {});
                  if (active) {
                    if (fileObj) fileObj.status = 'failed';
                    renderFileList();
                    renderDrawer();
                    syncActiveIntakeSkeleton();
                    showToast(`${fileObj?.name || '문서'} 분류 작업이 실패했습니다.`);
                  }
                  await loadActualConversations(true, runListSearchTerm);
                  return;
                }
                const timer = setTimeout(
                  () => pollActualJob(
                    documentId,
                    jobId,
                    fileIndex,
                    conversationId,
                    requestEpoch
                  ),
                  ACTUAL_JOB_POLL_INTERVAL
                );
                actualJobTimers.set(jobId, timer);
              } catch (error) {
                console.error('분류 작업 상태 조회 실패', error);
                const timer = setTimeout(
                  () => pollActualJob(
                    documentId,
                    jobId,
                    fileIndex,
                    conversationId,
                    requestEpoch
                  ),
                  ACTUAL_JOB_POLL_INTERVAL * 2
                );
                actualJobTimers.set(jobId, timer);
              }
            }

            async function loadActualQuestions(documentId, jobId, fileIndex, expectedQuestionCount = 0, targetConversationId, requestEpoch) {
              const guardedConversationId = String(targetConversationId || actualConversationId || '');
              const fetchActiveRows = async () => {
                const queryParams = new URLSearchParams();
                if (jobId) queryParams.append('jobId', jobId);
                queryParams.append('documentId', documentId);
                queryParams.append('deleted', 'false');
                queryParams.append('page', '1');
                queryParams.append('size', '200');
                // [API 연동] GET ND_questions.do: 활성 질의를 조회하여 #queryList와 질의 상세 화면 구성.
                const activeData = await fetchJson(`ND_questions.do?${queryParams.toString()}`);
                return normalizeActualQuestions(activeData).filter(raw => {
                  const rawDocumentId = String(raw?.document_id ?? '');
                  return !rawDocumentId || rawDocumentId === String(documentId);
                });
              };
              let rawQuestions = await fetchActiveRows();
              console.groupCollapsed('[질의분류 진단][4-QUESTIONS] ND_questions.do active');
              console.log('documentId:', documentId);
              console.log('jobId:', jobId);
              console.log('count:', rawQuestions.length);
              console.table(rawQuestions.map((row, index) => ({
                index: index + 1,
                question_id: row?.question_id ?? row?.id ?? '',
                question_order: row?.question_order ?? '',
                question_text: row?.question_text ?? '',
                question_original_text: row?.question_original_text ?? '',
                has_question_original_text:
                  row?.question_original_text != null &&
                  String(row.question_original_text).length > 0
              })));
              console.log('raw questions:', rawQuestions);
              console.groupEnd();
              /*
               * 간헐적으로 job=completed 직후 GET /questions가 아직 빈 배열을 주는 시점이 있다.
               * 서버 job 응답의 question_count가 1 이상인데 결과가 0건이면 최대 5회 재조회한다.
               * 이 때문에 강력 새로고침 후에만 정상 건수가 보이던 현상을 막는다.
               */
              const expected = Math.max(0, Number(expectedQuestionCount || 0));
              if (expected > 0 && rawQuestions.length === 0) {
                for (let attempt = 1; attempt <= 5 && rawQuestions.length === 0; attempt += 1) {
                  await new Promise(resolve => setTimeout(resolve, 650 * attempt));
                  rawQuestions = await fetchActiveRows();
                }
              }
              try {
                const deletedParams = new URLSearchParams();
                if (jobId) deletedParams.append('jobId', jobId);
                deletedParams.append('documentId', documentId);
                deletedParams.append('deleted', 'true');
                deletedParams.append('page', '1');
                deletedParams.append('size', '200');
                // [API 연동] GET ND_questions.do: 제외된 질의를 별도로 조회하여 제외 목록 구성.
                const deletedData = await fetchJson(`ND_questions.do?${deletedParams.toString()}`);
                const deletedRows = normalizeActualQuestions(deletedData).filter(raw => {
                  const rawDocumentId = String(raw?.document_id ?? '');
                  return (!rawDocumentId || rawDocumentId === String(documentId)) &&
                         Boolean(raw?.is_deleted);
                });
                rawQuestions.push(...deletedRows);
              } catch (error) {
                console.warn('제외 질의 조회 생략', error);
              }
              const indexedRows = rawQuestions.map((raw, originalIndex) => ({ raw, originalIndex }));
              indexedRows.sort((a, b) => {
                const aOrder = Number(a.raw?.question_order);
                const bOrder = Number(b.raw?.question_order);
                const hasAOrder =
                  a.raw?.question_order != null &&
                  Number.isInteger(aOrder) &&
                  aOrder > 0;
                const hasBOrder =
                  b.raw?.question_order != null &&
                  Number.isInteger(bOrder) &&
                  bOrder > 0;
                if (hasAOrder && hasBOrder && aOrder !== bOrder) return aOrder - bOrder;
                if (hasAOrder !== hasBOrder) return hasAOrder ? -1 : 1;
                const aTime = Date.parse(a.raw?.created_at || '');
                const bTime = Date.parse(b.raw?.created_at || '');
                if (Number.isFinite(aTime) && Number.isFinite(bTime) && aTime !== bTime) {
                  return aTime - bTime;
                }
                return a.originalIndex - b.originalIndex;
              });
              const seen = new Set();
              const mapped = indexedRows
                .map(item => item.raw)
                .filter(raw => {
                  const key = String(raw?.question_id ?? raw?.id ?? '');
                  if (!key || seen.has(key)) return false;
                  seen.add(key);
                  return true;
                })
                .map(mapActualQuestion);
              if (targetConversationId && !isClassificationWorkspaceActive(guardedConversationId, requestEpoch)) return;
              const fileObj = uploadedFiles[fileIndex];
              if (!fileObj || String(fileObj.documentId || '') !== String(documentId || '')) return;
              /*
               * job이 completed까지 왔다면 questions 조회가 순간적으로 0건이어도
               * 파일을 failed로 뒤집지 않는다.
               * 서버 job의 question_count가 있으면 그 값을 유지하고,
               * 결과 적재 지연이면 아래 후속 동기화에서 실제 질의를 다시 가져온다.
               */
              fileObj.status = 'completed';
              const activeCount = mapped.filter(q => !q.isDeleted).length;
              fileObj.queryCount = activeCount || (expected > 0 ? expected : 0);
              fileObj.isSubmitted =
                mapped.some(q => !q.isDeleted) &&
                mapped.filter(q => !q.isDeleted).every(q => q.isSubmitted);
              fileDataMap[fileObj.name] = {
                ...(fileDataMap[fileObj.name] || {}),
                queries: mapped,
                docText: mapped
                  .map((q, index) => `${index + 1}. ${getOriginalQuestionForView(q).text}`)
                  .join('\n\n')
              };
              if (activeFileIndex === fileIndex || activeFileIndex < 0) {
                await loadFileData(fileIndex);
              } else {
                renderFileList();
              }

              // completed 직후 DB 반영 지연으로 0건이면 3초 뒤 한 번 더 실제 결과를 동기화한다.
              if (expected > 0 && activeCount === 0) {
                setTimeout(() => {
                  loadActualQuestions(
                    documentId,
                    jobId,
                    fileIndex,
                    expected,
                    guardedConversationId,
                    requestEpoch
                  ).catch(error => console.warn('완료 질의 후속 동기화 실패', error));
                }, 3000);
              }
            }

            function renderFileStatusBadge(f) {
              const status =
                normalizeActualStatus(
                  f?.status
                );
              if (status === 'completed') {
                const countText =
                  Number.isFinite(
                    Number(f?.queryCount)
                  )
                    ? `질의 ${Number(f.queryCount)}건`
                    : '완료';
                const submittedText =
                  f?.isSubmitted
                    ? ' · 제출완료'
                    : '';
                return `
                  <span
                    class="status-badge type1 purple file-status-badge done"
                    data-file-status="query-count"
                  >
                    ${countText}${submittedText}
                  </span>
                `;
              }
              if (status === 'failed') {
                return `
                  <span
                    class="status-badge type1 red file-status-badge error"
                    data-file-status="failed"
                  >
                    실패
                  </span>
                `;
              }
              return `
                <span
                  class="status-badge type1 green file-status-badge processing"
                  data-file-status="waiting"
                >
                  진행중
                </span>
              `;
            }

            async function loadFileData(idx) {
              const nextFileIndex = Number(idx);
              const previousFile = uploadedFiles[activeFileIndex];
              const nextFile = uploadedFiles[nextFileIndex];
              const previousFileKey = previousFile
                ? String(previousFile.documentId || previousFile.name || '')
                : '';
              const nextFileKey = nextFile
                ? String(nextFile.documentId || nextFile.name || '')
                : '';
              const isDifferentFile = previousFileKey !== nextFileKey;
              activeFileIndex = nextFileIndex;
              const file = uploadedFiles[activeFileIndex];
              if (!file) return;
              syncActiveIntakeSkeleton();
              const fileNameEl = $('#activeFileName');
              if (fileNameEl) fileNameEl.textContent = file.displayName || file.name;
              const data = fileDataMap[file.name] || { docText: '', queries: [] };
              questions.length = 0;
              (data.queries || []).forEach(q => questions.push({ ...q }));
              activeQueryIndex = 0;
              currentFilter = 'all';
              $$('.filter-btn').forEach(btn =>
                btn.classList.toggle('active', btn.dataset.filter === 'all')
              );
              renderQueryList();
              renderQueryDetailPanel(questions.filter(q => !q.isDeleted));
              const stat = $('#statExtracted');
              if (stat) stat.textContent = String(questions.filter(q => !q.isDeleted).length);
              $$('.file-list li[data-file-idx]', fileList).forEach(li => li.classList.toggle('active', Number(li.dataset.fileIdx) === activeFileIndex));
              // 과거 대화/새로고침으로 불러온 제출완료 문서의 버튼 상태 복구
              syncActiveSubmittedConfirmState();
              updateConfirmBtnUI();
              // 원본 보기 모드는 같은 파일을 보고 있는 동안 유지한다.
              // 왼쪽 업로드 목록에서 실제로 다른 파일로 이동했을 때만 HTML을 기본값으로 되돌린다.
              if (isDifferentFile) actualDocumentViewMode = 'html';
              updateOriginalViewToggleButton(file);
              await renderActualDocument(file, data.docText || '');
            }

            function ensureOriginalViewToggleButton() {
              let button = $('#originalViewToggleBtn');
              if (button) return button;
              const stats = $('.panel-center .doc-stats');
              if (!stats) return null;
              stats.insertAdjacentHTML(
                'beforeend',
                `<button
                  id="originalViewToggleBtn"
                  type="button"
                  class="query-edit-btn"
                  style="margin-left:6px;white-space:nowrap"
                  title="원본 PDF 미리보기"
                >PDF 미리보기</button>`
              );
              button = $('#originalViewToggleBtn');
              button?.addEventListener('click', async () => {
                const file = uploadedFiles[activeFileIndex];
                if (!file) {
                  showToast('먼저 문서를 선택해 주세요.');
                  return;
                }
                const isPdf =
                  String(file.name || '')
                    .toLowerCase()
                    .endsWith('.pdf');
                if (!isPdf) {
                  showToast('PDF 파일에서만 원본 PDF 미리보기를 사용할 수 있습니다.');
                  return;
                }
                actualDocumentViewMode =
                  actualDocumentViewMode === 'pdf'
                    ? 'html'
                    : 'pdf';
                await renderActualDocument(
                  file,
                  fileDataMap[file.name]?.docText || ''
                );
              });
              return button;
            }

            function updateOriginalViewToggleButton(fileObj) {
              const button = ensureOriginalViewToggleButton();
              if (!button) return;
              const isPdf =
                String(fileObj?.name || '')
                  .toLowerCase()
                  .endsWith('.pdf');
              const browserFile =
                fileObj?.file ||
                actualFileMap.get(
                  String(fileObj?.documentId || '')
                );
              const canLoadServerPreview =
                Boolean(fileObj?.documentId);
              button.textContent =
                actualDocumentViewMode === 'pdf'
                  ? '질의 요지서 미리보기'
                  : 'PDF 미리보기';
              button.disabled =
                !isPdf ||
                (!canLoadServerPreview && !browserFile);
              button.title =
                actualDocumentViewMode === 'pdf'
                  ? '정리된 질의요지서 화면으로 돌아가기'
                  : canLoadServerPreview
                    ? '서버에 보관된 원본 PDF 미리보기'
                    : '업로드한 원본 PDF 미리보기';
              button.classList.toggle(
                'active',
                actualDocumentViewMode === 'pdf'
              );
            }

            function normalizeOriginalMetaValue(value) {
              return String(value || '')
                .replace(/\s+/g, ' ')
                .trim();
            }

            function extractOriginalDocumentMetaFromHtml(html) {
              const result = {
                memberName: '',
                partyName: '',
                committee: '',
                date: ''
              };
              if (!html || typeof DOMParser === 'undefined') return result;
              try {
                const doc = new DOMParser().parseFromString(String(html), 'text/html');
                const cells = Array.from(doc.querySelectorAll('th, td'))
                  .map(cell => normalizeOriginalMetaValue(cell.textContent));
                const valueAfterLabel = label => {
                  const idx = cells.findIndex(value => value === label || value.includes(label));
                  return idx >= 0 ? normalizeOriginalMetaValue(cells[idx + 1] || '') : '';
                };
                const allText = normalizeOriginalMetaValue(
                  doc.body?.innerText ||
                  doc.body?.textContent ||
                  ''
                );
                const valueFromText = labels => {
                  for (const label of labels) {
                    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const match = allText.match(
                      new RegExp(
                        escaped +
                        '\\s*[:：]?\\s*([^|\\n]{1,50}?)(?=\\s+(?:질의의원명|질의의원|의원명|교섭단체명|교섭단체|정당명|소속정당|소속|위원회|질의일자|질의일|작성일|$))'
                      )
                    );
                    if (match?.[1]) return normalizeOriginalMetaValue(match[1]);
                  }
                  return '';
                };
                result.memberName =
                  valueAfterLabel('질의의원명') ||
                  valueAfterLabel('질의의원') ||
                  valueAfterLabel('의원명') ||
                  valueFromText(['질의의원명', '질의의원', '의원명']);
                result.memberName = result.memberName
                  .replace(/\s*\(인\)\s*/g, '')
                  .trim();
                result.partyName =
                  valueAfterLabel('교섭단체명') ||
                  valueAfterLabel('교섭단체') ||
                  valueAfterLabel('정당명') ||
                  valueAfterLabel('소속정당') ||
                  valueAfterLabel('소속') ||
                  valueFromText([
                    '교섭단체명',
                    '교섭단체',
                    '정당명',
                    '소속정당',
                    '소속'
                  ]);
                const committeeMatch =
                  allText.match(/([가-힣A-Za-z0-9·\s]{2,30}위원회)/);
                if (committeeMatch) {
                  result.committee =
                    normalizeOriginalMetaValue(committeeMatch[1]);
                }
                const dateMatch =
                  allText.match(/(20\d{2})[.\-/년]\s*(\d{1,2})[.\-/월]\s*(\d{1,2})/);
                if (dateMatch) {
                  result.date = [
                    dateMatch[1],
                    String(dateMatch[2]).padStart(2, '0'),
                    String(dateMatch[3]).padStart(2, '0')
                  ].join('.');
                }
              } catch (error) {
                console.warn('원본 HTML 메타정보 추출 실패', error);
              }
              return result;
            }

            function extractOriginalDocumentMetaFromObject(source) {
              const root = source && typeof source === 'object' ? source : {};
              const candidates = [
                root,
                root.data,
                root.document,
                root.metadata,
                root.meta,
                root.document_metadata,
                root.documentMetadata
              ].filter(value => value && typeof value === 'object');
              const pick = keys => {
                for (const obj of candidates) {
                  for (const key of keys) {
                    const value = obj?.[key];
                    if (value !== undefined && value !== null && String(value).trim()) {
                      return normalizeOriginalMetaValue(value);
                    }
                  }
                }
                return '';
              };
              return {
                memberName: pick([
                  'questioner',
                  'questioner_name',
                  'questionerName',
                  'member_name',
                  'memberName',
                  'assembly_member_name',
                  'assemblyMemberName',
                  'assemblyman_name',
                  'assemblymanName'
                ]).replace(/\s*\(인\)\s*/g, '').trim(),
                partyName: pick([
                  'party',
                  'party_name',
                  'partyName',
                  'negotiation_group_name',
                  'negotiationGroupName',
                  'negotiating_group_name',
                  'negotiatingGroupName',
                  'parliamentary_group_name',
                  'parliamentaryGroupName',
                  'affiliation',
                  'affiliation_name',
                  'affiliationName',
                  'belong',
                  'belong_name',
                  'belongName',
                  'organization',
                  'organization_name',
                  'organizationName'
                ]),
                committee: pick([
                  'committee',
                  'committee_name',
                  'committeeName'
                ]),
                date: pick([
                  'question_date',
                  'questionDate',
                  'date',
                  'created_date',
                  'createdDate'
                ])
              };
            }

            function buildActualDocumentMeta(fileObj, queries, html = '', detail = null) {
              const current = documentMetaMap[fileObj?.name] || {};
              const activeQuestions = Array.isArray(queries) ? queries.filter(q => !q.isDeleted) : [];
              const first = activeQuestions[0] || {};
              const htmlMeta = extractOriginalDocumentMetaFromHtml(html);
              const detailMeta = extractOriginalDocumentMetaFromObject(detail);
              const rawQuestionMeta = extractOriginalDocumentMetaFromObject(first.raw || first);
              const memberName = normalizeOriginalMetaValue(
                first.questioner ||
                rawQuestionMeta.memberName ||
                detailMeta.memberName ||
                current.memberName ||
                htmlMeta.memberName
              ).replace(/\s*\(인\)\s*/g, '').trim();
              const partyName = normalizeOriginalMetaValue(
                first.party ||
                rawQuestionMeta.partyName ||
                detailMeta.partyName ||
                current.partyName ||
                htmlMeta.partyName
              );
              const committee = normalizeOriginalMetaValue(
                first.committee ||
                rawQuestionMeta.committee ||
                detailMeta.committee ||
                current.committee ||
                current.dept ||
                htmlMeta.committee
              );
              const date = normalizeOriginalMetaValue(
                first.questionDate ||
                rawQuestionMeta.date ||
                detailMeta.date ||
                current.date ||
                htmlMeta.date
              );
              const meta = {
                ...current,
                formTitle: current.formTitle || '질의 요지서',
                memberName,
                partyName,
                committee,
                date
              };
              if (fileObj?.name) documentMetaMap[fileObj.name] = meta;
              return meta;
            }

            function getQuestionIdValue(query) {
              return String(
                query?.questionId ??
                query?.question_id ??
                query?.raw?.question_id ??
                ''
              ).trim();
            }

            function getActiveQuestionIndexById(questionId) {
              const targetId = String(questionId || '').trim();
              if (!targetId) return -1;
              return questions
                .filter(q => !q.isDeleted)
                .findIndex(q => getQuestionIdValue(q) === targetId);
            }

            function setActivePdfHighlight(questionId, options = {}) {
              const original = $('#docOriginal');
              if (!original) return false;
              const targetId = String(questionId || '').trim();
              if (!targetId) return false;

              const highlights = $$('.pdf-question-highlight', original);
              let target = null;
              highlights.forEach(item => {
                const ids = String(item.dataset.questionIds || '')
                  .split(',')
                  .map(value => value.trim())
                  .filter(Boolean);
                const active = ids.includes(targetId);
                item.classList.toggle('active', active);
                item.setAttribute('aria-hidden', 'false');
                item.tabIndex = 0;
                if (active && !target) target = item;
              });

              if (target && options.scroll !== false) {
                target.scrollIntoView({
                  behavior: options.behavior || 'smooth',
                  block: 'center',
                  inline: 'nearest'
                });
                target.classList.remove('source-link-focus');
                void target.offsetWidth;
                target.classList.add('source-link-focus');
                window.setTimeout(
                  () => target?.classList.remove('source-link-focus'),
                  1400
                );
              }
              return Boolean(target);
            }

            function focusActualQuestionInOriginal(query, options = {}) {
              const questionId = getQuestionIdValue(query);
              if (
                actualDocumentViewMode === 'pdf' &&
                questionId &&
                setActivePdfHighlight(questionId, options)
              ) {
                return true;
              }

              const original = $('#docOriginal');
              if (!original) return false;
              const questionIndex = questions.findIndex(item => {
                if (questionId) {
                  return getQuestionIdValue(item) === questionId;
                }
                return Number(item?.id) === Number(query?.id);
              });
              const box = $(
                `.orig-query-box[data-qidx="${questionIndex}"]`,
                original
              );
              if (!box || box.closest('.orig-question-group')?.hasAttribute('inert')) return false;

              $$('.orig-query-box', original).forEach(item =>
                item.classList.toggle('active', item === box)
              );
              if (options.scroll !== false) {
                box.scrollIntoView({
                  behavior: options.behavior || 'smooth',
                  block: 'center',
                  inline: 'nearest'
                });
                box.classList.remove('source-link-focus');
                void box.offsetWidth;
                box.classList.add('source-link-focus');
                window.setTimeout(
                  () => box?.classList.remove('source-link-focus'),
                  1400
                );
              }
              return true;
            }

            function selectQuestionFromPdf(questionId) {
              const activeQueries = questions.filter(q => !q.isDeleted);
              const index = getActiveQuestionIndexById(questionId);
              if (index < 0) return;

              activeQueryIndex = index;
              currentFilter = 'all';
              $$('.filter-btn').forEach(item => {
                const isAll = item.dataset.filter === 'all';
                item.classList.toggle('active', isAll);
                item.setAttribute('aria-pressed', String(isAll));
              });

              renderQueryList();
              renderQueryDetailPanel(activeQueries);
              setActivePdfHighlight(questionId, { scroll: false });

              const selectedQuery = activeQueries[index];
              const selectedQuestionKey = getQuestionStableKey(selectedQuery);
              const card = selectedQuery
                ? $$('.query-card', queryList).find(
                    item =>
                      String(item.dataset.questionKey || '') ===
                      selectedQuestionKey
                  )
                : null;
              if (card) {
                setMappedQueryCard(card);
                card.scrollIntoView({
                  behavior: 'smooth',
                  block: 'center',
                  inline: 'nearest'
                });
              }
            }

            async function loadActualDocumentBbox(fileObj) {
              if (!fileObj?.documentId) {
                return {
                  pages: [],
                  blocks: [],
                  unmatched_question_ids: []
                };
              }

              const params = new URLSearchParams();
              params.append('documentId', String(fileObj.documentId));
              params.append('bbox', 'true');
              if (actualConversationId) {
                params.append('conversationId', String(actualConversationId));
              }

              // [API 연동] GET ND_documents.do: 원문 미리보기의 질의 좌표(bbox) 정보 조회.
              const detail = await fetchJson(
                `ND_documents.do?${params.toString()}`
              );
              const diagnosticPages =
                Array.isArray(detail?.pages) ? detail.pages : [];
              const diagnosticBlocks =
                Array.isArray(detail?.blocks) ? detail.blocks : [];
              const diagnosticMatchedBlocks = diagnosticBlocks.filter(
                block =>
                  Array.isArray(block?.question_ids) &&
                  block.question_ids.length > 0
              );
              console.groupCollapsed('[질의분류 진단][2-BBOX] ND_documents.do?bbox=true');
              console.log('documentId:', fileObj.documentId);
              console.log('fileName:', fileObj.name);
              console.log('pages count:', diagnosticPages.length);
              console.log('blocks count:', diagnosticBlocks.length);
              console.log('blocks with question_ids:', diagnosticMatchedBlocks.length);
              console.log(
                'question_ids:',
                diagnosticMatchedBlocks.map(block => ({
                  block_id: block?.block_id,
                  page: block?.page,
                  question_ids: block?.question_ids,
                  bbox: block?.bbox,
                  text: block?.text
                }))
              );
              console.log('unmatched_question_ids:', detail?.unmatched_question_ids);
              console.log('classified:', detail?.classified);
              console.log('question_count:', detail?.question_count);
              console.log('last_job_id:', detail?.last_job_id);
              console.groupEnd();
              return {
                pages: diagnosticPages,
                blocks: diagnosticBlocks,
                unmatched_question_ids: Array.isArray(detail?.unmatched_question_ids)
                  ? detail.unmatched_question_ids
                  : []
              };
            }

            function createPdfQuestionHighlight(block, questionMap) {
              const ids = Array.isArray(block?.question_ids)
                ? block.question_ids.map(value => String(value || '').trim()).filter(Boolean)
                : [];
              if (!ids.length) return null;

              const bbox = block?.bbox || {};
              const x = Math.max(0, Math.min(1, Number(bbox.x) || 0));
              const y = Math.max(0, Math.min(1, Number(bbox.y) || 0));
              const width = Math.max(0, Math.min(1 - x, Number(bbox.width) || 0));
              const height = Math.max(0, Math.min(1 - y, Number(bbox.height) || 0));
              if (!width || !height) return null;

              const button = document.createElement('button');
              button.type = 'button';
              button.className = 'pdf-question-highlight';
              button.dataset.questionIds = ids.join(',');
              button.style.left = `${x * 100}%`;
              button.style.top = `${y * 100}%`;
              button.style.width = `${width * 100}%`;
              button.style.height = `${height * 100}%`;

              const firstMatched = ids
                .map(id => questionMap.get(id))
                .find(Boolean);
              const label = firstMatched?.order || firstMatched?.index || '';
              if (label) {
                const badge = document.createElement('span');
                badge.className = 'pdf-question-highlight-number';
                badge.textContent = String(label);
                button.appendChild(badge);
              }

              const description = String(block?.text || '').trim();
              button.setAttribute(
                'aria-label',
                description
                  ? `질의 ${label || ''}: ${description}`
                  : `질의 ${label || ''} 원문 위치`
              );
              button.title = description;
              button.addEventListener('click', event => {
                event.preventDefault();
                event.stopPropagation();
                selectQuestionFromPdf(ids[0]);
              });
              return button;
            }

            async function renderPdfWithQuestionHighlights(
              pdfBlob,
              bboxData,
              fallbackText
            ) {
              const original = $('#docOriginal');
              if (!original || !window.pdfjsLib) return false;

              const bytes = await pdfBlob.arrayBuffer();
              const pdf = await window.pdfjsLib.getDocument({ data: bytes }).promise;
              const pages = Array.isArray(bboxData?.pages) ? bboxData.pages : [];
              const blocks = Array.isArray(bboxData?.blocks) ? bboxData.blocks : [];
              const activeQueries = questions.filter(q => !q.isDeleted);
              const questionMap = new Map();

              activeQueries.forEach((query, index) => {
                const questionId = getQuestionIdValue(query);
                if (!questionId) return;
                questionMap.set(questionId, {
                  query,
                  index: index + 1,
                  order: Number(query?.raw?.question_order ?? query?.questionOrder ?? index + 1)
                });
              });

              original.innerHTML = `
                <div class="actual-pdf-highlight-viewer" id="actualPdfHighlightViewer"></div>
              `;
              const viewer = $('#actualPdfHighlightViewer', original);
              if (!viewer) return false;

              for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
                const page = await pdf.getPage(pageNumber);
                const baseViewport = page.getViewport({ scale: 1 });
                const availableWidth = Math.max(
                  320,
                  Number(original.clientWidth || 0) - 32
                );
                const scale = Math.max(
                  0.5,
                  Math.min(2.2, availableWidth / baseViewport.width)
                );
                const viewport = page.getViewport({ scale });

                const pageWrap = document.createElement('div');
                pageWrap.className = 'actual-pdf-page';
                pageWrap.dataset.page = String(pageNumber);
                pageWrap.style.width = `${viewport.width}px`;
                pageWrap.style.height = `${viewport.height}px`;

                const canvas = document.createElement('canvas');
                canvas.className = 'actual-pdf-page-canvas';
                canvas.width = Math.ceil(viewport.width);
                canvas.height = Math.ceil(viewport.height);
                canvas.style.width = `${viewport.width}px`;
                canvas.style.height = `${viewport.height}px`;
                pageWrap.appendChild(canvas);

                const overlay = document.createElement('div');
                overlay.className = 'actual-pdf-highlight-layer';
                pageWrap.appendChild(overlay);
                viewer.appendChild(pageWrap);

                await page.render({
                  canvasContext: canvas.getContext('2d'),
                  viewport
                }).promise;

                blocks
                  .filter(block => Number(block?.page) === pageNumber)
                  .forEach(block => {
                    const highlight = createPdfQuestionHighlight(block, questionMap);
                    if (highlight) {
                      overlay.appendChild(highlight);
                    }
                  });
              }

              updateDocStatusBar(fallbackText || '', pdf.numPages);

              const activeQuery = activeQueries[activeQueryIndex];
              const activeQuestionId = getQuestionIdValue(activeQuery);
              if (activeQuestionId) {
                setActivePdfHighlight(activeQuestionId, {
                  scroll: false
                });
              }

              if (pages.length && pages.length !== pdf.numPages) {
                console.warn(
                  '[PDF bbox] PDF 페이지 수와 bbox pages 수가 다릅니다.',
                  { pdfPages: pdf.numPages, bboxPages: pages.length }
                );
              }
              if (bboxData?.unmatched_question_ids?.length) {
                console.warn(
                  '[PDF bbox] 원문 위치를 찾지 못한 질의',
                  bboxData.unmatched_question_ids
                );
              }
              return true;
            }

            async function renderActualPdfPreview(fileObj, fallbackText) {
              const original = $('#docOriginal');
              if (!original) return false;
              const isPdf = String(fileObj?.name || '').toLowerCase().endsWith('.pdf');
              if (!isPdf) {
                showToast('PDF 파일에서만 원본 PDF 미리보기를 사용할 수 있습니다.');
                return false;
              }

              let blob = null;
              let serverError = null;
              if (fileObj?.documentId) {
                try {
                  const params = new URLSearchParams();
                  params.append('documentId', String(fileObj.documentId));
                  if (actualConversationId) {
                    params.append('conversationId', String(actualConversationId));
                  }
                  const previewUrl = `ND_documentPreview.do?${params.toString()}`;
                  // [API 연동] GET ND_documentPreview.do: previewUrl에서 원문 PDF 파일 조회.
                  const response = await fetch(previewUrl, {
                    method: 'GET',
                    headers: {
                      'Accept': 'application/pdf'
                    },
                    cache: 'no-store'
                  });
                  if (!response.ok) {
                    throw new Error(
                      response.status === 404
                        ? '서버에 원본 PDF 미리보기가 없습니다.'
                        : `원본 PDF 요청 실패 (${response.status})`
                    );
                  }
                  blob = await response.blob();
                  if (!blob?.size) {
                    throw new Error('서버에서 빈 PDF가 반환되었습니다.');
                  }
                } catch (error) {
                  serverError = error;
                  console.error('[PDF 미리보기 서버 조회 실패]', error);
                }
              }

              if (!blob) {
                const browserFile =
                  fileObj?.file ||
                  actualFileMap.get(String(fileObj?.documentId || ''));
                if (browserFile) blob = browserFile;
              }
              if (!blob) {
                showToast(
                  serverError?.message ||
                  '원본 PDF를 불러올 수 없습니다.'
                );
                return false;
              }

              try {
                const pdfBlob =
                  blob.type === 'application/pdf'
                    ? blob
                    : new Blob([blob], { type: 'application/pdf' });
                const bboxData = await loadActualDocumentBbox(fileObj);
                return await renderPdfWithQuestionHighlights(
                  pdfBlob,
                  bboxData,
                  fallbackText
                );
              } catch (error) {
                console.error('[PDF bbox 미리보기 표시 실패]', error);
                showToast('원본 PDF의 질의 위치를 표시하지 못했습니다.');
                return false;
              }
            }

            async function renderActualDocument(fileObj, fallbackText) {
              return window.AIOneLoadingOverlay.preview($('#docOriginal'), fileObj?.name, () => renderActualDocumentContent(fileObj, fallbackText));
            }

            async function renderActualDocumentContent(fileObj, fallbackText) {
              const original = $('#docOriginal');
              if (!original) return;
              updateOriginalViewToggleButton(fileObj);
              // 사용자가 PDF 미리보기를 선택한 경우 v1.5 서버 preview PDF를 렌더링.
              if (actualDocumentViewMode === 'pdf') {
                const rendered = await renderActualPdfPreview(fileObj, fallbackText);
                if (rendered) return;
                actualDocumentViewMode = 'html';
                updateOriginalViewToggleButton(fileObj);
              }
              const data = fileObj?.name ? fileDataMap[fileObj.name] : null;
              // 원문 문구와 순서는 유지하고, 제외/복원 상태는 그룹 활성화에만 반영한다.
              // 전체 질의를 원래 순서대로 유지하고, 실제 문구는 buildOriginalPages()에서
              // API question_original_text만 사용한다.
              const originalQueries = Array.isArray(data?.queries)
                ? data.queries.slice()
                : questions.slice();
              let originalHtml = '';
              let documentDetail = null;
              // 원본 HTML은 화면에 iframe으로 그대로 보여주지 않고,
              // 의원명/교섭단체/위원회 같은 메타정보 추출용으로만 사용한다.
              if (fileObj?.documentId) {
                try {
                  // [API 연동] GET ND_documents.do: 문서 원문과 좌표(bbox) 정보를 조회하여 원문 패널 구성.
                  const detail = await fetchJson(
                    `ND_documents.do?documentId=${encodeURIComponent(fileObj.documentId)}&bbox=true`
                  );
                  documentDetail = detail;
                  originalHtml =
                    detail?.original_html ??
                    detail?.html ??
                    detail?.content ??
                    detail?.document_html ??
                    '';
                } catch (error) {
                  console.warn('문서 상세 메타정보 조회 실패', error);
                }
              }
              const documentId =
                String(fileObj?.documentId || '');
              /* 질의문 원본은 API의 question_original_text만 사용한다. */
            const meta = buildActualDocumentMeta(fileObj, originalQueries, originalHtml, documentDetail);
              /*
               * 기본 화면은 기존 퍼블리싱의 "질의요지서" 카드형 UI로 통일한다.
               * 서버 original_html iframe은 더 이상 기본 화면에 직접 노출하지 않는다.
               */
              original.innerHTML = buildOriginalPages(meta, originalQueries);
              $$('.orig-query-box', original).forEach(box => {
                box.addEventListener('click', () => {
                  const index = Number(box.dataset.qidx);
                  if (
                    !Number.isInteger(index) ||
                    index < 0 ||
                    index >= originalQueries.length ||
                    originalQueries[index].isDeleted
                  ) {
                    return;
                  }
                  activeQueryIndex = index;
                  const targetQuery =
                    originalQueries[index];
                  $$('.orig-query-box', original).forEach(item =>
                    item.classList.toggle('active', item === box)
                  );
                  renderQueryDetailPanel(originalQueries);
                  /*
                   * 총집합본과 동일하게 질의요지서 클릭 시
                   * 현재 originalQueries의 질의를 오른쪽 질의목록과 연결한다.
                   */
                  currentFilter = 'all';
                  $$('.filter-btn').forEach(item => {
                    const isAll =
                      item.dataset.filter === 'all';
                    item.classList.toggle(
                      'active',
                      isAll
                    );
                    item.setAttribute(
                      'aria-pressed',
                      String(isAll)
                    );
                  });
                  renderQueryList();
                  window.requestAnimationFrame(() => {
                    const targetCard = $(
                      `.query-card[data-qid="${targetQuery?.id}"]`,
                      queryList
                    );
                    if (!targetCard) return;
                    setMappedQueryCard(targetCard);
                    targetCard.scrollIntoView({
                      behavior: 'smooth',
                      block: 'center',
                      inline: 'nearest'
                    });
                  });
                });
              });
              updateDocStatusBar(fallbackText || '', 1);
            }

            Object.assign(runtime, {
                getOriginalQuestionForView,
                buildOriginalPages,
                getDocOriginalWidthBounds,
                resetDocOriginalWidth,
                applyDocOriginalWidth,
                initDocSplitPersistence,
                renderDocContentForFile,
                updateDocStatusBar,
                getSecurityModal,
                renderSecurityFileRows,
                showSensitiveFileBlocked,
                showConfidentialFileConfirm,
                validateFilesBeforeUpload,
                getFileQueryCount,
                renderFileList,
                closeFileActionMenus,
                toggleActualFavorite,
                requestFileDelete,
                deleteUploadedFile,
                applyReclassificationToOriginalQuestion,
                submitActualDocument,
                cancelActualDocumentSubmit,
                setActualDocumentFavorite,
                formatActualFileSize,
                actualFileType,
                normalizeActualDocuments,
                addFiles,
                classifyActualDocument,
                pollActualJob,
                loadActualQuestions,
                renderFileStatusBadge,
                loadFileData,
                ensureOriginalViewToggleButton,
                updateOriginalViewToggleButton,
                normalizeOriginalMetaValue,
                extractOriginalDocumentMetaFromHtml,
                extractOriginalDocumentMetaFromObject,
                buildActualDocumentMeta,
                getQuestionIdValue,
                setActivePdfHighlight,
                focusActualQuestionInOriginal,
                selectQuestionFromPdf,
                loadActualDocumentBbox,
                renderPdfWithQuestionHighlights,
                renderActualPdfPreview,
                renderActualDocument
            });
        }
    };
})(window);
