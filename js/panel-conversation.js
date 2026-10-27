/**
 * AI-ONE 공통 채팅·대화 이력
 * 적용 화면: ai-answer.html, work-support.html, sale-review.html
 * 역할: 메시지·입력창·피드백, 대화 이력과 API/SSE 전송
 * 연결: panel.js 런타임. 응답별 후처리는 runtime.page의 페이지 처리 함수
 * - 261022 정리 - 공통 패널과 화면 전용 기능의 관리 범위를 분리합니다.
 *
 * 261026 변경 요약
 * - 수정 - 대화·작업 Drawer 목록 조회 시작·종료에 공통 스켈레톤 연결
 * - 수정 - 대화·분석 제목의 조회·저장만 담당하고 제목 렌더링·편집 이벤트는 common.js의 AIOneTopbar에 위임
 *
 * 기본 구간 형식: Start: 기능명 / End: 기능명
 * 변경 구간 형식: Start: YYMMDD 추가/수정 - 기능명 / End: YYMMDD 추가/수정 - 기능명
 * 주석 정리 내역
 * - 261023 주석 정리 - 구간 표시와 변경 내용 표기를 통일합니다. 기존 작업 날짜와 기능 설명은 유지합니다.
 */

(function registerpanel_conversationModule(window) {
    // Start: 261013 추가 - AI 아바타 아이콘 경로
    const answerAvatarIconUrl = new URL("../assets/icons/ai-answer-sparkles.svg", document.currentScript?.src || document.baseURI).href;
    // End: 261013 추가 - AI 아바타 아이콘 경로

    window.AIOnePanelFeatureModules = window.AIOnePanelFeatureModules || {};
    window.AIOnePanelFeatureModules["panel-conversation.js"] = function install(runtime) {
        // Start: 261015 수정 - 답변서 채팅 목록 실패 이력
        // 실패 이력은 현재 페이지 메모리에서만 관리하며 서버 저장 상태가 아니다. 재전송·삭제 시 해제한다.
        const failedConversationIds = new Set();
        const activeRequests = new Set();
        // 대화 생성 전 편집한 제목은 첫 요청에 사용하고 새 작업에서 초기화합니다.
        let pendingWorkspaceTitle = "";
        // End: 261015 수정 - 답변서 채팅 목록 실패 이력
        with (runtime) {
            function hideSearchSkeleton(...args) { return runtime.page.hideLoading?.(...args); }

            function showSearchSkeleton(...args) { return runtime.page.showLoading?.(...args); }

            function getSearchSkeletonTarget(...args) { return runtime.page.getLoadingTarget?.(...args) || "all"; }

            function setTab(...args) { return runtime.page.activateView?.(...args); }

            // getChatDateLabel: 필요한 값을 조회.
            function getChatDateLabel(date) {
                if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
                const now = new Date();
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
                const diffDays = Math.round((today.getTime() - target.getTime()) / 86400000);
                if (diffDays === 0) return "오늘";
                if (diffDays === 1) return "어제";
                // 올해의 대화는 월/일, 이전 연도는 연/월/일로 표시
                if (date.getFullYear() === now.getFullYear()) {
                    return date.getMonth() + 1 + "월 " + date.getDate() + "일";
                }
                return date.getFullYear() + "년 " + (date.getMonth() + 1) + "월 " + date.getDate() + "일";
            }

            // formatChatTime: 화면 표시 형식으로 변환.
            function formatChatTime(date) {
                if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
                const hour = date.getHours();
                const period = hour < 12 ? "오전" : "오후";
                const displayHour = hour % 12 || 12;
                const minute = String(date.getMinutes()).padStart(2, "0");
                return period + " " + displayHour + ":" + minute;
            }

            // getCurrentTime: 필요한 값을 조회.
            function getCurrentTime() {
                return formatChatTime(new Date());
            }

            // formatMessageTime: 화면 표시 형식으로 변환.
            function formatMessageTime(value) {
                if (!value) return "";
                return formatChatTime(new Date(value));
            }

            // getMessageDateKey: 필요한 값을 조회.
            function getMessageDateKey(value) {
                const date = value ? new Date(value) : new Date();
                if (Number.isNaN(date.getTime())) return "";
                return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
            }

            // getMessageDateLabel: 필요한 값을 조회.
            function getMessageDateLabel(value) {
                const date = value ? new Date(value) : new Date();
                return getChatDateLabel(date);
            }

            // appendChatDateDivider: 화면 또는 목록에 항목을 추가.
            function appendChatDateDivider(dateValue) {
                if (!el.chatBody) return null;
                const dateKey = getMessageDateKey(dateValue);
                const dateLabel = getMessageDateLabel(dateValue);
                if (!dateKey || !dateLabel) return null;
                const lastDateKey = String(el.chatBody.dataset.lastChatDateKey || "");
                const hasRenderedMessage = Boolean(el.chatBody.querySelector(".chat-msg"));
                if (hasRenderedMessage && lastDateKey === dateKey) return null;
                el.chatBody.dataset.lastChatDateKey = dateKey;
                const divider = document.createElement("div");
                divider.className = "chat-time-divider chat-date-divider";
                divider.dataset.date = dateKey;
                const label = document.createElement("span");
                label.className = "chat-time-divider-label";
                const dateElement = document.createElement("strong");
                dateElement.className = "chat-time-divider-date";
                dateElement.textContent = dateLabel;
                label.appendChild(dateElement);
                divider.appendChild(label);
                el.chatBody.appendChild(divider);
                return divider;
            }

            // setTab: 상태 또는 표시 값을 설정.

            // normalizeChatDisplayText: 입력/API 데이터를 화면에서 사용할 형태로 정규화.
            function normalizeChatDisplayText(text) {
                const source = String(text || "")
                    .replace(/\r\n?/g, "\n")
                    .trim();
                if (!source) return "";
                const lines = source.split("\n").map(function (line) {
                    return line.replace(/\s+$/g, "");
                });
                const out = [];
                let paragraph = [];

                // flushParagraph: 해당 기능의 세부 처리를 담당.
                function flushParagraph() {
                    if (!paragraph.length) return;
                    const merged = paragraph
                        .map(function (line) {
                            return line.trim();
                        })
                        .filter(Boolean)
                        .join(" ")
                        .replace(/\s+([.,!?;:])/g, "$1");
                    if (merged) out.push(merged);
                    paragraph = [];
                }

                // pushBlank: 해당 기능의 세부 처리를 담당.
                function pushBlank() {
                    flushParagraph();
                    if (out.length && out[out.length - 1] !== "") out.push("");
                }

                // isMarkdownStructure: 조건 충족 여부를 판별.
                function isMarkdownStructure(line) {
                    return /^(#{1,6}\s+|[-*+]\s+|\d+[.)]\s+|>\s+|```|\|.*\|$)/.test(line);
                }

                // isReferenceHeading: 조건 충족 여부를 판별.
                function isReferenceHeading(line) {
                    return /^(참고|출처)\s*\d+\s*[:：]/.test(line);
                }

                // isSquareBullet: 조건 충족 여부를 판별.
                function isSquareBullet(line) {
                    return /^[□■]\s*/.test(line);
                }

                // isCircleBullet: 조건 충족 여부를 판별.
                function isCircleBullet(line) {
                    return /^[○◦]\s*/.test(line);
                }

                // looksLikeSectionTitle: 해당 기능의 세부 처리를 담당.
                function looksLikeSectionTitle(line) {
                    return /^(재검색 결과|검색 결과|발언 스크립트|답변서|참고자료|관련자료|출처|근거)(\s*[:：].*)?$/.test(line);
                }
                lines.forEach(function (rawLine) {
                    const t = rawLine.trim();
                    if (!t) {
                        pushBlank();
                        return;
                    }
                    if (looksLikeSectionTitle(t)) {
                        flushParagraph();
                        out.push("### " + t);
                        return;
                    }
                    if (isReferenceHeading(t)) {
                        flushParagraph();
                        out.push("#### " + t);
                        return;
                    }
                    if (isSquareBullet(t)) {
                        flushParagraph();
                        out.push("- " + t.replace(/^[□■]\s*/, ""));
                        return;
                    }
                    if (isCircleBullet(t)) {
                        flushParagraph();
                        out.push("  - " + t.replace(/^[○◦]\s*/, ""));
                        return;
                    }
                    if (isMarkdownStructure(t)) {
                        flushParagraph();
                        out.push(t);
                        return;
                    }
                    paragraph.push(t);
                });
                flushParagraph();
                return out
                    .join("\n")
                    .replace(/\n{3,}/g, "\n\n")
                    .trim();
            }

            // getAssistantChatDisplayText: 필요한 값을 조회.
            function getAssistantChatDisplayText(content, metadata) {
                const pageText = runtime.page.getAssistantText?.(content, metadata);
                if (pageText !== undefined) return pageText;
                const action = metadata?.action || {};
                const kind = String(action.kind || "")
                    .trim()
                    .toLowerCase();
                const notice = String(action.notice || "").trim();
                if (kind === "download" && notice) {
                    return notice;
                }
                return String(content || "");
            }

            // copyChatMessageText: 대상 내용을 복사.
            async function copyChatMessageText(message) {
                const content = message?.querySelector(".msg-text");
                const value = String(content?.innerText || content?.textContent || "").trim();
                if (!value) return;
                try {
                    if (navigator.clipboard?.writeText) {
                        await navigator.clipboard.writeText(value);
                    } else {
                        const textarea = document.createElement("textarea");
                        textarea.value = value;
                        textarea.setAttribute("readonly", "");
                        textarea.style.position = "fixed";
                        textarea.style.opacity = "0";
                        document.body.appendChild(textarea);
                        textarea.select();
                        const copied = document.execCommand("copy");
                        textarea.remove();
                        if (!copied) throw new Error("copy command failed");
                    }
                    showToast("복사되었습니다.");
                } catch (error) {
                    console.error("[채팅 복사 실패]", error);
                    showToast("복사에 실패했습니다.");
                }
            }

            // applyMessageFeedbackState: 계산/저장된 상태를 화면에 반영.
            function applyMessageFeedbackState(item, data) {
                if (!item || !data) return;
                const feedback = String(nestedValue(data, "feedback") || "");
                const feedbackContent = nestedValue(data, "feedback_content");
                item.dataset.feedback = feedback;
                if (feedbackContent != null) {
                    item.dataset.feedbackContent = String(feedbackContent);
                } else {
                    delete item.dataset.feedbackContent;
                }
                item.querySelectorAll("[data-feedback-value]").forEach((button) => {
                    const active = button.dataset.feedbackValue === feedback;
                    button.classList.toggle("is-active", active);
                    button.classList.toggle("active", active);
                    button.setAttribute("aria-pressed", String(active));
                });
            }

            // saveMessageFeedback: 현재 상태를 서버 또는 저장소에 저장.
            async function saveMessageFeedback(item, fields) {
                const logId = String(item?.dataset.messageId || "").trim();
                if (!logId) {
                    showToast("피드백을 남길 답변 ID가 없습니다.");
                    return null;
                }
                // [API 연동] POST ND_answerFeedback.do: 답변 피드백 저장.
                const data = await requestJson("ND_answerFeedback.do?logId=" + encodeURIComponent(logId), {
                    method: "POST",
                    headers: { "Content-Type": "application/json;charset=UTF-8" },
                    body: JSON.stringify(fields),
                });
                applyMessageFeedbackState(item, data);
                return data;
            }

            // loadMessageFeedback: 서버/상태 데이터를 조회하고 화면 상태에 반영.
            async function loadMessageFeedback(item) {
                const logId = String(item?.dataset.messageId || "").trim();
                if (!logId) return;
                try {
                    // [API 연동] GET ND_answerFeedback.do: 저장된 답변 피드백 조회.
                    const data = await requestJson("ND_answerFeedback.do?logId=" + encodeURIComponent(logId));
                    applyMessageFeedbackState(item, data);
                } catch (error) {
                    console.warn("[답변 피드백 조회 실패]", logId, error);
                }
            }

            // openMessageFeedbackEditor: 대상 화면/팝업을 열고 필요한 데이터를 준비.
            function openMessageFeedbackEditor(item) {
                const actions = item?.querySelector(".chat-copy-actions");
                if (!actions) return;
                const opened = item.querySelector(".chat-feedback-editor");
                if (opened) {
                    opened.remove();
                    return;
                }
                const template = document.getElementById("answerFeedbackEditorTemplate");
                const editor = template?.content.firstElementChild?.cloneNode(true);
                if (!editor) return;

                const textarea = editor.querySelector("textarea");
                textarea.value = item.dataset.feedbackContent || "";
                editor.querySelector("[data-feedback-cancel]")?.addEventListener("click", () => editor.remove());
                editor.querySelector("[data-feedback-save]")?.addEventListener("click", async () => {
                    const saveButton = editor.querySelector("[data-feedback-save]");
                    saveButton.disabled = true;
                    try {
                        await saveMessageFeedback(item, { feedback_content: textarea.value.trim() || null });
                        showToast(textarea.value.trim() ? "의견을 저장했습니다." : "의견을 삭제했습니다.");
                        editor.remove();
                    } catch (error) {
                        console.error("[답변 의견 저장 실패]", error);
                        showToast("의견을 저장하지 못했습니다.");
                        saveButton.disabled = false;
                    }
                });
                actions.insertAdjacentElement("afterend", editor);
                textarea.focus();
            }

            // openCustomerIssueModal: 공통 오류 신고 화면에 답변서 API를 연결한다.
            function openCustomerIssueModal(item) {
                return window.AIOneChatMessageActions.openIssue(item, {
                    showToast,
                    async uploadFile(file) {
                        const formData = new FormData();
                        formData.append("file", file);
                        // [API 연동] POST ND_fileUpload.do: 문의에 첨부할 파일 업로드.
                        const uploadResponse = await fetch("ND_fileUpload.do", {
                            method: "POST",
                            body: formData,
                            credentials: "same-origin",
                        });
                        if (!uploadResponse.ok) throw new Error("신고 파일 업로드 실패: " + uploadResponse.status);
                        const uploaded = await uploadResponse.json();
                        return String(nestedValue(uploaded, "file_id") || nestedValue(uploaded, "fileId") || nestedValue(uploaded, "id") || "").trim();
                    },
                    submitIssue(payload) {
                        // [API 연동] POST ND_customer.do: 문의 내용과 첨부파일 정보 전송.
                        return requestJson("ND_customer.do", {
                            method: "POST",
                            headers: { "Content-Type": "application/json;charset=UTF-8" },
                            body: JSON.stringify(payload),
                        });
                    },
                });
            }

            // attachFeedbackControlsToMessage: 해당 기능의 세부 처리를 담당.
            function attachFeedbackControlsToMessage(item, messageData) {
                const messageId = String(messageData?.id || messageData?.log_id || "").trim();
                const actions = item?.querySelector(".chat-copy-actions");
                if (!item || !actions || !messageId || actions.querySelector("[data-feedback-value]")) return;
                item.dataset.messageId = messageId;
                const copyButton = actions.querySelector(".chat-copy-btn");
                ["like", "dislike"].forEach((value) => {
                    const button = window.AIOneChatMessageActions.createButton(value);
                    button.addEventListener("click", async () => {
                        const current = item.dataset.feedback || "";
                        button.disabled = true;
                        try {
                            await saveMessageFeedback(item, { feedback: current === value ? null : value });
                        } catch (error) {
                            console.error("[답변 평가 저장 실패]", error);
                            showToast("평가를 저장하지 못했습니다.");
                        } finally {
                            button.disabled = false;
                        }
                    });
                    actions.insertBefore(button, copyButton);
                });
                const researchButton = window.AIOneChatMessageActions.createButton("research");
                researchButton.addEventListener("click", () => {
                    sendChat("관련자료를 다시 찾고 재검색해줘");
                });
                actions.insertBefore(researchButton, copyButton);
                /* 의견 버튼은 기존 설정에 따라 사용하지 않음.
                const opinionButton = document.createElement("button");
                opinionButton.type = "button";
                opinionButton.className = "msg-action-btn chat-feedback-btn chat-feedback-opinion";
                opinionButton.setAttribute("aria-label", "답변 의견 작성");
                opinionButton.title = "의견 작성";
                opinionButton.textContent = "의견";

                opinionButton.addEventListener("click", () => openMessageFeedbackEditor(item));
                actions.appendChild(opinionButton);
                */
                const issueButton = window.AIOneChatMessageActions.createButton("issue");
                issueButton.addEventListener("click", () => openCustomerIssueModal(item));
                actions.appendChild(issueButton);
                applyMessageFeedbackState(item, messageData);
                loadMessageFeedback(item);
            }

            // 일반 답변과 생성 중 메시지에서 같은 아바타를 사용한다.
            function createAnswerAvatar() {
                const avatar = document.createElement("div");
                avatar.className = "chat-ai-avatar";
                avatar.setAttribute("aria-hidden", "true");
                const icon = document.createElement("img");
                icon.className = "icon";
                icon.src = answerAvatarIconUrl;
                icon.alt = "";
                icon.dataset.icon = "ai-answer-sparkles";
                avatar.appendChild(icon);
                return avatar;
            }

            // appendMessage: 화면 또는 목록에 항목을 추가.
            function appendMessage(type, text, time, messageData, options) {
                // 초기 더미 안내도 메시지 ID를 제공해 기존 평가·복사·신고 액션을 사용한다.
                if (!messageData && type === "ai" && options?.rawHtml
                    && window.AIOnePreview?.enabled
                    && runtime.config.previewConversation === true) {
                    const question = window.AIOneDummyData?.workSupport.responses.question;
                    if (question && !el.chatBody.querySelector(".chat-msg")) {
                        appendMessage("user", question.content, question.time, question);
                    }
                    messageData = window.AIOneDummyData?.workSupport.responses.welcome;
                }
                const displayTime = time || getCurrentTime();
                const messageDateValue = messageData?.created_at || null;
                appendChatDateDivider(messageDateValue);
                const item = document.createElement("div");
                item.className = "chat-msg " + type;
                const messageId = String(messageData?.id || messageData?.log_id || "").trim();
                if (messageId) item.dataset.messageId = messageId;
                if (type === "ai") item.appendChild(createAnswerAvatar());
                const content = document.createElement("div");
                content.className = "msg-text";
                if (type === "ai" && options && options.rawHtml) {
                    content.innerHTML = String(text || "");
                } else if (type === "ai") {
                    if (!runtime.page.renderMessage?.(content, text)) content.innerHTML = parseMarkdown(normalizeChatDisplayText(text));
                    wrapDocumentTables(content, { chat: true });
                } else {
                    content.textContent = text || "";
                }
                item.appendChild(content);
                if (displayTime !== "") {
                    const timeElement = document.createElement("span");
                    timeElement.className = "msg-time";
                    timeElement.textContent = displayTime;
                    item.appendChild(timeElement);
                }
                if (type === "user" || type === "ai") {
                    // 피드백 버튼 생성 여부와 관계없이 복사 버튼의 hover 스타일은 적용한다.
                    const actions = document.createElement("div");
                    actions.className = "msg-actions chat-copy-actions";
                    const copyButton = window.AIOneChatMessageActions.createButton("copy");
                    copyButton.addEventListener("click", function () {
                        copyChatMessageText(item);
                    });
                    actions.appendChild(copyButton);
                    item.appendChild(actions);
                }
                el.chatBody.appendChild(item);

                // Start: 261013 추가 - 메시지 액션버튼 연결
                if (type === "ai" && messageId) {
                    attachFeedbackControlsToMessage(item, messageData);
                }
                // End: 261013 추가 - 메시지 액션버튼 연결
                el.chatBody.scrollTop = el.chatBody.scrollHeight;
                return item;
            }

            // setMessageMarkdown: 상태 또는 표시 값을 설정.
            function setMessageMarkdown(message, markdown) {
                if (!message) return;
                const content = message.querySelector(".msg-text");
                if (content) {
                    if (!runtime.page.renderMessage?.(content, markdown)) content.innerHTML = parseMarkdown(normalizeChatDisplayText(markdown));
                    wrapDocumentTables(content, { chat: true });
                }
                el.chatBody.scrollTop = el.chatBody.scrollHeight;
            }

            // createChatTypingController: 새 데이터 또는 UI 요소를 생성.
            function createChatTypingController(loadingElement) {
                let fullStreamText = "";
                let messageElement = null;
                let timer = null;
                let finishResolve = null;

                // stopTimer: 해당 기능의 세부 처리를 담당.
                function stopTimer() {
                    if (timer) {
                        window.clearInterval(timer);
                        timer = null;
                    }
                }

                // ensureMessage: 필요한 요소나 상태가 존재하도록 보장.
                function ensureMessage() {
                    if (messageElement) return messageElement;
                    loadingElement?.remove();
                    messageElement = appendMessage("ai", "", getCurrentTime());
                    messageElement.classList.add("is-streaming");
                    return messageElement;
                }

                // collectTypingUnits: 해당 기능의 세부 처리를 담당.
                function collectTypingUnits(root) {
                    const units = [];
                    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
                        acceptNode(node) {
                            if (node.nodeType === Node.TEXT_NODE) {
                                const parent = node.parentElement;
                                if (!parent || parent.closest("script, style, template")) {
                                    return NodeFilter.FILTER_REJECT;
                                }
                                // HTML pretty-print용 개행/들여쓰기처럼 공백만 있는 text node는
                                // 화면 콘텐츠가 아니므로 타이핑 대상에서 제외한다.
                                if (!node.nodeValue || !node.nodeValue.trim()) {
                                    return NodeFilter.FILTER_REJECT;
                                }
                                return NodeFilter.FILTER_ACCEPT;
                            }
                            if (node.nodeType === Node.ELEMENT_NODE && /^(HR|BR)$/.test(node.tagName)) {
                                return NodeFilter.FILTER_ACCEPT;
                            }
                            return NodeFilter.FILTER_SKIP;
                        },
                    });
                    let node;
                    while ((node = walker.nextNode())) {
                        if (node.nodeType === Node.TEXT_NODE) {
                            units.push({
                                type: "text",
                                node: node,
                                original: node.nodeValue || "",
                                index: 0,
                            });
                        } else {
                            units.push({
                                type: "element",
                                node: node,
                            });
                        }
                    }
                    return units;
                }

                // typeRenderedHtml: 해당 기능의 세부 처리를 담당.
                function typeRenderedHtml(finalText) {
                    const message = ensureMessage();
                    const content = message.querySelector(".msg-text");
                    if (!content) return Promise.resolve(message);
                    // 구조화 답변의 파일·출처 버튼은 본문과 함께 완성된 상태로 공개한다.
                    if (runtime.page.renderMessage?.(content, finalText)) {
                        message.classList.remove("is-streaming");
                        el.chatBody.scrollTop = el.chatBody.scrollHeight;
                        return Promise.resolve(message);
                    }
                    /*
                     * 전체 응답을 먼저 완성된 HTML/Markdown DOM으로 만든다.
                     * 최종 Markdown DOM 구조는 처음부터 유지한다.
                     * p/ul/ol/li 등의 margin과 문단 간격도 타이핑 시작부터 최종 상태와 동일하다.
                     * 텍스트 노드의 글자만 비운 뒤 순서대로 채워 넣는다.
                     */
                    content.innerHTML = parseMarkdown(normalizeChatDisplayText(finalText));
                    wrapDocumentTables(content, { chat: true });
                    // 타이핑 중에도 최종 렌더와 동일하게 공백/개행을 계산한다.
                    // pre-wrap을 사용하면 HTML 소스의 들여쓰기/개행이 빈 공간으로 먼저 잡혔다가
                    // 종료 시 normal로 바뀌면서 갑자기 붙는 현상이 생긴다.
                    const units = collectTypingUnits(content);
                    const totalChars = units.reduce(function (sum, unit) {
                        return sum + (unit.type === "text" ? unit.original.length : 0);
                    }, 0);
                    units.forEach(function (unit) {
                        if (unit.type === "text") {
                            // 블록 구조와 margin은 그대로 두고 글자만 비운다.
                            unit.node.nodeValue = "";
                        } else {
                            // BR/HR은 display:none 대신 visibility로 숨겨 레이아웃을 유지한다.
                            unit.node.style.visibility = "hidden";
                        }
                    });
                    if (!units.length) {
                        message.classList.remove("is-streaming");
                        return Promise.resolve(message);
                    }
                    let unitIndex = 0;
                    let revealedChars = 0;
                    const intervalMs = 22;
                    const targetTicks = Math.max(1, Math.floor(4000 / intervalMs));
                    const charsPerTick = Math.max(1, Math.min(36, Math.ceil(Math.max(totalChars, 1) / targetTicks)));
                    return new Promise(function (resolve) {
                        finishResolve = resolve;
                        timer = window.setInterval(function () {
                            let budget = charsPerTick;
                            while (unitIndex < units.length) {
                                const unit = units[unitIndex];
                                if (unit.type === "element") {
                                    unit.node.style.removeProperty("visibility");
                                    unitIndex += 1;
                                    continue;
                                }
                                if (unit.index >= unit.original.length) {
                                    unitIndex += 1;
                                    continue;
                                }
                                if (budget <= 0) break;
                                const take = Math.min(budget, unit.original.length - unit.index);
                                unit.node.nodeValue += unit.original.slice(unit.index, unit.index + take);
                                unit.index += take;
                                revealedChars += take;
                                budget -= take;
                                if (unit.index >= unit.original.length) {
                                    unitIndex += 1;
                                }
                            }
                            el.chatBody.scrollTop = el.chatBody.scrollHeight;
                            if (unitIndex >= units.length) {
                                stopTimer();
                                units.forEach(function (unit) {
                                    if (unit.type === "element") {
                                        unit.node.style.removeProperty("visibility");
                                    }
                                });
                                message.classList.remove("is-streaming");
                                if (finishResolve) {
                                    const done = finishResolve;
                                    finishResolve = null;
                                    done(message);
                                }
                            }
                        }, intervalMs);
                    });
                }
                return {
                    push(delta) {
                        // SSE 수신 중에는 조각을 화면에 직접 그리지 않고 완성본 조립용으로만 누적한다.
                        if (delta) fullStreamText += String(delta);
                    },
                    hasMessage() {
                        return !!messageElement;
                    },
                    getMessage() {
                        return messageElement;
                    },
                    finish(finalText) {
                        const serverText = String(finalText || fullStreamText || "");
                        if (!serverText) {
                            loadingElement?.remove();
                            return Promise.resolve(null);
                        }
                        return typeRenderedHtml(serverText);
                    },
                    cancel() {
                        stopTimer();
                        loadingElement?.remove();
                        const content = messageElement?.querySelector(".msg-text");
                        if (content) {
                            content.querySelectorAll("br, hr").forEach(function (element) {
                                element.style.removeProperty("visibility");
                            });
                        }
                        if (finishResolve) {
                            const done = finishResolve;
                            finishResolve = null;
                            done(messageElement);
                        }
                    },
                };
            }

            // 진행 중인 대화의 로딩 영역을 기억하여 다른 대화로 이동했다 돌아와도 같은 영역에 표시한다.
            const pendingSkeletonTargets = new Map();
            const recommendationLoadingMessage = "관련자료를 검색하고 있습니다";
            runtime.recommendationLoadingMessage = recommendationLoadingMessage;

            // 채팅 문구에 따른 스켈레톤 표시 범위(서버 요청 내용은 변경하지 않는다).
            // updateSearchSkeleton: 기존 상태 또는 데이터를 갱신.
            function updateSearchSkeleton(message, loadingElement) {
                const text = String(message || "").trim();
                if (!text) return;
                runtime.page.updateLoading?.(text);
                // 채팅 영역에서는 검은 제목만 stage 문구로 갱신한다.
                // 회색 설명문(.typing-desc)은 최초 안내 문구를 그대로 유지한다.
                const typingTitle = loadingElement?.querySelector?.(".typing-title");
                if (typingTitle) {
                    typingTitle.textContent = text;
                }
            }

            // showLoading: 대상 UI를 표시.
            function showLoading(target) {
                const item = document.createElement("div");
                item.className = "chat-msg ai is-pending chat-typing";
                item.dataset.component = "chat-message";
                item.dataset.variant = "answer";
                item.dataset.role = "ai";
                item.dataset.status = "pending";
                item.setAttribute("aria-busy", "true");
                item.innerHTML =
                    '<div class="typing-content" role="status">' +
                    '<div class="typing-text-wrap">' +
                    '<span class="typing-title">답변서 생성 중</span>' +
                    '<span class="typing-desc">관련자료를 검색하고 답변서를 작성하고 있습니다.</span>' +
                    "</div>" +
                    '<div class="typing-dots" aria-hidden="true">' +
                    "<span></span><span></span><span></span>" +
                    "</div>" +
                    "</div>";
                item.prepend(createAnswerAvatar());
                if (target === "recommend") {
                    item.querySelector(".typing-title").textContent = recommendationLoadingMessage;
                    item.querySelector(".typing-desc").hidden = true;
                }
                el.chatBody.appendChild(item);
                el.chatBody.scrollTop = el.chatBody.scrollHeight;
                return item;
            }

            // syncSendButton: 관련 상태와 화면을 동기화.
            function syncSendButton() {
                el.sendBtn.disabled = !state.sending && (state.uploading || !el.chatInput.value.trim());
                el.sendBtn.classList.toggle("chat-stop", state.sending);
                el.sendBtn.setAttribute("aria-label", state.sending ? "생성 중지" : "전송");
                el.sendBtn.title = state.sending ? "생성 중지" : "전송";
                el.sendBtn.dataset.tooltip = state.sending ? "생성 중지" : "전송";
                el.sendBtn.dataset.tooltipAuto = "";
                window.AIOneTooltip?.hide(el.sendBtn);
            }

            // syncChatInputHeight: 관련 상태와 화면을 동기화.
            function syncChatInputHeight() {
                window.AIOneChatInput?.resize(el.chatInput);
            }

            // setBusy: 상태 또는 표시 값을 설정.
            function setBusy(sending) {
                state.sending = sending;
                el.chatInput.disabled = sending;
                if (el.fileButton) el.fileButton.disabled = sending || state.uploading;
                syncSendButton();
            }

            // getConversationPageInfo: 필요한 값을 조회.
            function getConversationPageInfo(data) {
                const page = Number(nestedValue(data, "page")) || 1;
                const pages = Number(nestedValue(data, "pages")) || 1;
                const total = Number(nestedValue(data, "total")) || 0;
                return { page, pages, total };
            }

            // requestJson: 서버 API 작업을 요청.
            async function requestJson(url, options) {
                // [API 공통] draft-*.js의 requestJson 호출을 실제 HTTP 요청으로 처리하고 응답 반환.
                const response = await fetch(url, Object.assign({ credentials: "same-origin" }, options || {}));
                if (!response.ok) throw new Error(response.status + " " + (await response.text()));
                const text = await response.text();
                if (!text) return null;
                try {
                    return JSON.parse(text);
                } catch (_) {
                    return text;
                }
            }

            // loadConversationList: 서버/상태 데이터를 조회하고 화면 상태에 반영.
            async function loadConversationList(options) {
                if (runtime.config.chatOnly) return;
                const config = options || {};
                const title = String(config.title ?? state.conversationSearchTitle ?? "").trim();
                const page = Math.max(1, Number(config.page) || 1);
                const append = Boolean(config.append);
                if (append && state.conversationLoadingMore) {
                    console.log("[대화목록 DEBUG] 추가 조회 차단 - 이미 조회 중", {
                        requestedPage: page,
                        currentPage: state.conversationPage,
                        totalPages: state.conversationPages,
                    });
                    return;
                }
                console.log("[대화목록 DEBUG] loadConversationList 호출", {
                    requestedPage: page,
                    size: PAGE_SIZE,
                    append: append,
                    currentPage: state.conversationPage,
                    totalPages: state.conversationPages,
                });
                const favoriteOnly = config.favoriteOnly != null ? Boolean(config.favoriteOnly) : Boolean(state.conversationFavoriteOnly);
                state.conversationSearchTitle = title;
                state.conversationFavoriteOnly = favoriteOnly;
                if (append) state.conversationLoadingMore = true;
                // Start: 261026 수정 - Drawer 목록 조회 로딩
                window.AIOneDrawerLoading.show(el.historyList, runtime.config.kind === "work-support" ? "작업 목록" : "대화 목록", { append });
                // End: 261026 수정 - Drawer 목록 조회 로딩
                try {
                    // 미리보기의 즉시 응답도 첫 조회·추가 조회 모두 로딩 상태를 확인할 수 있게 한다.
                    if (window.AIOnePreview?.enabled) await new Promise((resolve) => setTimeout(resolve, 400));
                    const sortMode = el.historySort?.value || "latest";
                    const serverSort = sortMode === "oldest" ? "created_at" : sortMode === "modified" ? "-updated_at" : "-created_at";
                    const buildUrl = (targetPage) =>
                        "ND_conversationList.do?title=" + encodeURIComponent(title) + "&page=" + targetPage + "&size=" + PAGE_SIZE + "&sort=" + encodeURIComponent(serverSort) + (favoriteOnly ? "&favorite=true" : "");
                    let items = [];
                    let pageInfo = { page: page, pages: 1 };
                    if (sortMode === "title") {
                        // [API 연동] GET ND_conversationList.do: 제목순 정렬을 위한 작성 이력 첫 페이지 조회.
                        const firstData = await requestJson(buildUrl(1));
                        const firstItems = listResponse(firstData, "items");
                        const firstPageInfo = getConversationPageInfo(firstData);
                        const totalPages = Math.max(1, Number(firstPageInfo.pages) || 1);
                        const restPages =
                            totalPages > 1
                                ? await Promise.all(
                                      Array.from({ length: totalPages - 1 }, (_, index) =>
                                          // [API 연동] GET ND_conversationList.do: 제목순 정렬을 위한 나머지 작성 이력 페이지 조회.
                                          requestJson(buildUrl(index + 2)),
                                      ),
                                  )
                                : [];
                        const allItems = [...firstItems, ...restPages.flatMap((data) => listResponse(data, "items"))];
                        const unique = [];
                        const known = new Set();
                        allItems.forEach((item) => {
                            const id = String(item?.id || "").trim();
                            if (!id || known.has(id)) return;
                            known.add(id);
                            unique.push(item);
                        });
                        unique.sort((a, b) => {
                            const aPinned = Boolean(a?.is_favorite);
                            const bPinned = Boolean(b?.is_favorite);
                            if (aPinned !== bPinned) return Number(bPinned) - Number(aPinned);
                            return String(a?.display_title || a?.title || "").localeCompare(String(b?.display_title || b?.title || ""), "ko-KR", { numeric: true, sensitivity: "base" });
                        });
                        const clientPages = Math.max(1, Math.ceil(unique.length / PAGE_SIZE));
                        const safePage = Math.min(page, clientPages);
                        const startIndex = (safePage - 1) * PAGE_SIZE;
                        items = unique.slice(startIndex, startIndex + PAGE_SIZE);
                        pageInfo = { page: safePage, pages: clientPages };
                    } else {
                        const requestUrl = buildUrl(page);
                        console.log("[대화목록 DEBUG] API 요청", {
                            page: page,
                            size: PAGE_SIZE,
                            url: requestUrl,
                            append: append,
                        });
                        // [API 연동] GET ND_conversationList.do: 작성 이력의 검색/정렬/페이지 조회. renderConversationHistory()가 #chatTopics에 표시.
                        const data = await requestJson(requestUrl);
                        items = listResponse(data, "items");
                        pageInfo = getConversationPageInfo(data);
                        console.log("[대화목록 DEBUG] API 응답", {
                            requestedPage: page,
                            responsePage: pageInfo.page,
                            responsePages: pageInfo.pages,
                            responseTotal: pageInfo.total,
                            receivedCount: items.length,
                            raw: data,
                        });
                    }
                    if (append) {
                        const merged = state.conversations.slice();
                        const knownIds = new Set(merged.map((item) => String(item?.id || "").trim()).filter(Boolean));
                        items.forEach((item) => {
                            const id = String(item?.id || "").trim();
                            if (!id || knownIds.has(id)) return;
                            knownIds.add(id);
                            merged.push(item);
                        });
                        state.conversations = merged;
                    } else {
                        state.conversations = items;
                    }
                    state.conversationPage = pageInfo.page;
                    state.conversationPages = pageInfo.pages;
                    console.log("[대화목록 DEBUG] 목록 반영 완료", {
                        append: append,
                        currentPage: state.conversationPage,
                        totalPages: state.conversationPages,
                        loadedCount: state.conversations.length,
                    });
                    renderConversationHistory();
                    if (config.openLatest && items.length) {
                        const latest = items.slice().sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0))[0];
                        await selectConversation(String(latest.id || ""));
                    }
                } catch (error) {
                    console.error("대화 목록 조회 실패", error);
                    el.historyList.innerHTML = '<div class="selected-empty">작성 이력을 불러오지 못했습니다.</div>';
                } finally {
                    if (append) state.conversationLoadingMore = false;
                    // Start: 261026 수정 - Drawer 목록 조회 완료 정리
                    window.AIOneDrawerLoading.hide(el.historyList);
                    // End: 261026 수정 - Drawer 목록 조회 완료 정리
                }
            }

            // isPinnedConversation: 조건 충족 여부를 판별.
            function isPinnedConversation(conversationId) {
                const item = state.conversations.find((conversation) => String(conversation.id || "") === String(conversationId || ""));
                return Boolean(item?.is_favorite);
            }

            // setConversationFavorite: 상태 또는 표시 값을 설정.
            async function setConversationFavorite(conversationId, favorite) {
                const id = String(conversationId || "").trim();
                if (!id) return false;
                try {
                    // [API 연동] POST/DELETE ND_conversationFavorite.do: 작성 이력 즐겨찾기 추가/해제.
                    const result = await requestJson("ND_conversationFavorite.do?conversationId=" + encodeURIComponent(id), { method: favorite ? "POST" : "DELETE" });
                    const updatedResponse = singleResponse(result);
                    const item = state.conversations.find((conversation) => String(conversation.id || "") === id);
                    if (item) {
                        item.is_favorite = updatedResponse?.is_favorite != null ? Boolean(updatedResponse.is_favorite) : Boolean(favorite);
                        if (updatedResponse?.updated_at) {
                            item.updated_at = updatedResponse.updated_at;
                        }
                    }
                    renderConversationHistory();
                    return true;
                } catch (error) {
                    console.error(favorite ? "대화 즐겨찾기 등록 실패" : "대화 즐겨찾기 해제 실패", error);
                    showToast(favorite ? "대화 즐겨찾기에 실패했습니다." : "대화 즐겨찾기 해제에 실패했습니다.");
                    return false;
                }
            }

            // togglePinnedConversation: 활성/표시 상태를 전환.
            async function togglePinnedConversation(conversationId) {
                const favorite = !isPinnedConversation(conversationId);
                const saved = await setConversationFavorite(conversationId, favorite);
                return saved ? favorite : isPinnedConversation(conversationId);
            }

            // getConversationById: 필요한 값을 조회.
            function getConversationById(conversationId) {
                return state.conversations.find((item) => String(item.id || "") === String(conversationId || "")) || null;
            }

            // renameConversation: 해당 기능의 세부 처리를 담당.
            async function renameConversation(conversationId, title) {
                const normalizedTitle = String(title || "").trim();
                if (!conversationId || !normalizedTitle) return false;
                try {
                    // [API 연동] PUT ND_conversation.do: 작성 이력의 대화 제목 변경.
                    const result = await requestJson("ND_conversation.do", {
                        method: "PUT",
                        headers: { "Content-Type": "application/json;charset=UTF-8" },
                        body: JSON.stringify({
                            conversationId: conversationId,
                            title: normalizedTitle,
                        }),
                    });
                    /*
                     * SidePop 공통 UI는 저장 버튼을 누르는 순간 목록 DOM의 제목을 먼저 바꾼다.
                     * 여기서 곧바로 conversationList를 재조회하면 백엔드/목록 API 반영 타이밍에 따라
                     * 직전의 예전 제목이 다시 내려와 화면이 원래 제목으로 되돌아가 보일 수 있다.
                     *
                     * 성공 시에는 재조회하지 않고 현재 state를 서버에 저장한 제목으로 맞춘다.
                     * 실패 시에는 sidepop:chat-action 쪽에서 목록을 다시 읽어 UI를 원복한다.
                     */
                    const updated = state.conversations.find((item) => String(item.id || "") === String(conversationId));
                    if (updated) {
                        updated.title = normalizedTitle;
                        if (Object.prototype.hasOwnProperty.call(updated, "display_title")) {
                            updated.display_title = normalizedTitle;
                        }
                    }
                    console.log("[대화 이름 변경 완료]", {
                        conversationId: conversationId,
                        title: normalizedTitle,
                        response: result,
                    });
                    showToast(runtime.config.labels.renameSuccess);
                    return true;
                } catch (error) {
                    console.error("대화 이름 변경 실패", error);
                    showToast(runtime.config.labels.renameFailure);
                    return false;
                }
            }

            // Start: 261021 수정 - 화면별 새 작업 기본 제목
            function getDefaultAnswerWorkspaceTitle() {
                return window.AIOneWorkspaceUi.createDefaultWorkspaceTitle(runtime.config.labels.workspace);
            }
            // End: 261021 수정 - 화면별 새 작업 기본 제목

            // getActiveConversationTitle: 필요한 값을 조회.
            function getActiveConversationTitle() {
                const conversationId = String(state.conversationId || "");
                const item = state.conversations.find((conversation) => String(conversation?.id || "") === conversationId);
                return String(item?.display_title || item?.title || "제목 없는 대화");
            }

            // 탑바에는 제목 데이터 조회·저장만 연결합니다.
            let workspaceTitleEditor;
            function bindAnswerWorkspaceTitleEdit() {
                workspaceTitleEditor = window.AIOneTopbar.createTitleEditor({
                    button: el.workspaceTitleBtn,
                    text: el.workspaceTitleText,
                    input: el.workspaceTitleInput,
                    editLabel: runtime.page.workspaceTitle?.editLabel || "대화 제목 수정",
                    getTitle: () => runtime.page.workspaceTitle?.get() ?? (state.conversationId
                        ? getActiveConversationTitle()
                        : (pendingWorkspaceTitle || getDefaultAnswerWorkspaceTitle())),
                    saveTitle: async (title) => {
                        if (runtime.page.workspaceTitle) {
                            await runtime.page.workspaceTitle.set(title);
                        } else if (!state.conversationId) {
                            pendingWorkspaceTitle = title;
                        } else if (await renameConversation(String(state.conversationId), title)) {
                            renderConversationHistory();
                        }
                    },
                });
            }
            function renderAnswerWorkspaceTitle() {
                if (!workspaceTitleEditor) bindAnswerWorkspaceTitleEdit();
                workspaceTitleEditor?.render();
            }


            // deleteConversation: 대상 데이터를 삭제.
            async function deleteConversation(conversationId) {
                if (!conversationId) return false;
                try {
                    // [API 연동] DELETE ND_conversation.do: 작성 이력의 대화 삭제.
                    await requestJson("ND_conversation.do?conversationId=" + encodeURIComponent(conversationId), { method: "DELETE" });
                    // Start: 261015 수정 - 삭제한 대화의 실패 이력 정리
                    failedConversationIds.delete(String(conversationId));
                    // End: 261015 수정 - 삭제한 대화의 실패 이력 정리
                    if (String(state.conversationId) === String(conversationId)) {
                        resetWorkspace();
                    }
                    showToast("대화를 삭제했습니다.");
                    await loadConversationList({
                        title: state.conversationSearchTitle,
                        page: 1,
                        favoriteOnly: state.conversationFavoriteOnly,
                    });
                    return true;
                } catch (error) {
                    console.error("대화 삭제 실패", error);
                    showToast("대화 삭제에 실패했습니다.");
                    return false;
                }
            }

            // ensureHistorySortOptions: 필요한 요소나 상태가 존재하도록 보장.
            function ensureHistorySortOptions() {
                if (!el.historySort) return;
                const current = String(el.historySort.value || "latest");
                el.historySort.innerHTML = '<option value="latest">최신순</option>' + '<option value="oldest">과거순</option>';
                el.historySort.value = ["latest", "oldest"].includes(current) ? current : "latest";
                window.AIOneConversationDrawer?.syncSortWidth(el.historySort);
            }

            // requestNextConversationPage: 서버 API 작업을 요청.
            function requestNextConversationPage(reason, scrollTarget) {
                const currentPage = Math.max(1, Number(state.conversationPage) || 1);
                const totalPages = Math.max(1, Number(state.conversationPages) || 1);
                const nextPage = currentPage + 1;
                console.log("[대화목록 DEBUG] 다음 페이지 판정", {
                    reason: reason,
                    currentPage: currentPage,
                    nextPage: nextPage,
                    totalPages: totalPages,
                    loading: state.conversationLoadingMore,
                    scrollTop: scrollTarget && typeof scrollTarget.scrollTop === "number" ? scrollTarget.scrollTop : null,
                    clientHeight: scrollTarget && typeof scrollTarget.clientHeight === "number" ? scrollTarget.clientHeight : null,
                    scrollHeight: scrollTarget && typeof scrollTarget.scrollHeight === "number" ? scrollTarget.scrollHeight : null,
                });
                if (state.conversationLoadingMore) return;
                if (nextPage > totalPages) {
                    console.log("[대화목록 DEBUG] 마지막 페이지 - 추가 조회 없음", {
                        currentPage: currentPage,
                        totalPages: totalPages,
                    });
                    return;
                }
                console.log("[대화목록 DEBUG] ★ 다음 페이지 요청 실행 ★", {
                    page: nextPage,
                    size: PAGE_SIZE,
                });
                loadConversationList({
                    title: state.conversationSearchTitle,
                    page: nextPage,
                    favoriteOnly: state.conversationFavoriteOnly,
                    append: true,
                }).catch((error) => {
                    console.error("[대화목록 DEBUG] 다음 페이지 요청 실패", error);
                });
            }

            // ensureConversationInfiniteScroll: 필요한 요소나 상태가 존재하도록 보장.
            function ensureConversationInfiniteScroll() {
                const drawer = el.historyDrawer || document.getElementById("runDrawer");
                if (!drawer || drawer.dataset.conversationInfiniteScrollReady === "true") return;
                drawer.dataset.conversationInfiniteScrollReady = "true";
                // 실제 스크롤 엘리먼트가 chatTopics 자체가 아닐 수 있으므로
                // runDrawer 안쪽에서 발생하는 모든 scroll을 capture 단계에서 잡는다.
                drawer.addEventListener(
                    "scroll",
                    (event) => {
                        const target = event.target;
                        if (!(target instanceof Element)) return;
                        if (!drawer.contains(target)) return;
                        const scrollTop = Number(target.scrollTop) || 0;
                        const clientHeight = Number(target.clientHeight) || 0;
                        const scrollHeight = Number(target.scrollHeight) || 0;
                        if (!clientHeight || !scrollHeight || scrollHeight <= clientHeight) return;
                        const remaining = scrollHeight - (scrollTop + clientHeight);
                        console.log("[대화목록 DEBUG] 스크롤", {
                            target: target.id || target.className || target.tagName,
                            scrollTop: scrollTop,
                            clientHeight: clientHeight,
                            scrollHeight: scrollHeight,
                            remaining: remaining,
                            currentPage: state.conversationPage,
                            totalPages: state.conversationPages,
                        });
                        if (remaining <= window.AIOneConversationDrawer.SCROLL_THRESHOLD) {
                            requestNextConversationPage("scroll-bottom", target);
                        }
                    },
                    true,
                );
                console.log("[대화목록 DEBUG] 무한스크롤 이벤트 등록 완료", {
                    drawer: drawer.id || drawer.className,
                });
            }

            // renderConversationPagination: 현재 상태를 기준으로 화면을 렌더링.
            function renderConversationPagination() {
                if (el.historyPager) {
                    // 페이지 번호 UI는 사용하지 않는다. 스크롤 하단 도달 시 다음 페이지를 붙인다.
                    el.historyPager.innerHTML = "";
                }
                ensureConversationInfiniteScroll();
                console.log("[대화목록 DEBUG] 페이지 상태", {
                    currentPage: state.conversationPage,
                    totalPages: state.conversationPages,
                    loadedCount: state.conversations.length,
                    size: PAGE_SIZE,
                });
            }

            // Start: 261015 수정 - 답변서 채팅 목록 상태 전달
            // #chatTopics의 카드 구조는 common.js의 renderChatItems를 사용한다. 업무지원은 채팅 아이콘을 제외한다.
            // 진행중·실패 상태와 미확인 완료점을 각각 전달한다. 완료점은 대화 선택 시 읽음 처리한다.
            function renderConversationHistory() {
                if (runtime.config.chatOnly) return;
                ensureHistorySortOptions();
                window.AIOneConversationDrawer.renderChatItems({
                    list: el.historyList,
                    totalElement: el.historyTotal,
                    items: state.conversations,
                    total: state.conversations.length,
                    activeId: state.conversationId,
                    sortMode: el.historySort?.value || "latest",
                    fallbackTitle: runtime.config.labels.untitled,
                    showIcon: runtime.config.showHistoryIcon !== false,
                    titleMax: 24,
                    isPending: (_, id) => isConversationPending(id),
                    isFailed: (_, id) => failedConversationIds.has(id),
                    isCompleted: (_, id) => completedConversationIds.has(id),
                    onSelect: (_, id) => selectConversation(id),
                });
                renderConversationPagination();
                renderAnswerWorkspaceTitle();
            }
            // End: 261015 수정 - 답변서 채팅 목록 상태 전달

            // selectConversation: 해당 기능의 세부 처리를 담당.
            async function selectConversation(conversationId) {
                if (!conversationId) return;
                workspaceEpoch += 1;
                const selectionEpoch = workspaceEpoch;
                // Start: 261014 추가 - 대화 전환 시 검색 초기화
                runtime.resetSourceSearch();
                // End: 261014 추가 - 대화 전환 시 검색 초기화
                state.conversationId = conversationId;
                // 해당 대화방을 열면 완료 표시를 읽음 처리한다.
                completedConversationIds.delete(String(conversationId));
                // uploadedFiles는 "현재 화면에서 다음 전송에 사용할 임시 파일"이다.
                // 다른 대화로 이동할 때 절대 들고 가지 않는다.
                state.uploadedFiles = [];
                if (el.fileInput) el.fileInput.value = "";
                // 이전 대화의 첨부/보고서가 새 대화 조회 완료 전 잠깐 보이는 것도 방지한다.
                state.conversationFiles = [];
                runtime.page.reset?.();
                setRecommendations([], []);
                renderUploadedFiles();
                hideSearchSkeleton();
                syncBusyForActiveConversation();
                if (isConversationPending(conversationId)) {
                    const target = pendingSkeletonTargets.get(String(conversationId)) || "all";
                    if (target === "recommend") setTab("recommend");
                    showSearchSkeleton(target === "recommend" ? recommendationLoadingMessage : "AI 응답 데이터를 불러오고 있습니다...", target);
                }
                renderConversationHistory();
                await Promise.all([loadConversationMessages(conversationId, selectionEpoch), loadConversationAttachments(conversationId, selectionEpoch)]);
                if (!isWorkspaceSelectionActive(conversationId, selectionEpoch)) return;
                await runtime.page.loadConversation?.(conversationId, selectionEpoch);
            }

            // loadConversationAttachments: 서버/상태 데이터를 조회하고 화면 상태에 반영.
            async function loadConversationAttachments(conversationId, selectionEpoch) {
                if (!conversationId) {
                    state.conversationFiles = [];
                    renderUploadedFiles();
                    return [];
                }
                const previousConversationFiles = Array.isArray(state.conversationFiles) ? state.conversationFiles.slice() : [];
                try {
                    // [API 연동] GET ND_conversationFiles.do: 선택한 대화에 저장된 첨부파일 목록 조회.
                    const data = await requestJson("ND_conversationFiles.do?conversationId=" + encodeURIComponent(conversationId));
                    const items = listResponse(data, "items");
                    if (!isWorkspaceSelectionActive(conversationId, selectionEpoch)) return [];
                    state.conversationFiles = Array.isArray(items) ? items.slice() : [];
                    console.log("[v1.5 대화 첨부파일 목록]", state.conversationFiles);
                    // 과거 첨부 이력은 화면에는 복원하되 uploadedFiles에는 넣지 않는다.
                    // 따라서 새 질문 전송 시 과거 파일이 자동 재첨부되지 않는다.
                    renderUploadedFiles();
                    return state.conversationFiles;
                } catch (error) {
                    console.warn("[v1.5 대화 첨부파일 목록 조회 실패]", error);
                    if (!isWorkspaceSelectionActive(conversationId, selectionEpoch)) return [];
                    state.conversationFiles = previousConversationFiles;
                    renderUploadedFiles();
                    return previousConversationFiles;
                }
            }

            // loadConversationMessages: 서버/상태 데이터를 조회하고 화면 상태에 반영.
            async function loadConversationMessages(conversationId, selectionEpoch) {
                try {
                    // [API 연동] GET ND_conversationMessageList.do: 선택한 대화의 메시지를 조회하여 #chatBody에 표시.
                    const data = await requestJson("ND_conversationMessageList.do?conversationId=" + encodeURIComponent(conversationId));
                    const messages = listResponse(data, "items");
                    if (!isWorkspaceSelectionActive(conversationId, selectionEpoch)) return;
                    el.chatBody.innerHTML = "";
                    let latestActionSources = [];
                    let latestReferences = [];
                    messages.forEach((message) => {
                        console.log("[대화 메시지 시간 확인]", {
                            role: message.role,
                            created_at: message.created_at,
                            createdAt: message.createdAt,
                            reg_dt: message.reg_dt,
                            regDt: message.regDt,
                            create_dt: message.create_dt,
                            createDt: message.createDt,
                            time: message.time,
                            raw: message,
                        });
                        const type = message.role === "assistant" ? "ai" : "user";
                        if (message.content) {
                            const displayText = type === "ai" ? getAssistantChatDisplayText(message.content, message.metadata) : message.content;
                            appendMessage(type, displayText, formatMessageTime(message.created_at), message);
                        }
                        if (type === "ai") {
                            const sources = message.metadata?.action?.sources;
                            const references = message.metadata?.references;
                            if (Array.isArray(sources) && sources.length > 0) {
                                latestActionSources = sources;
                            }
                            if (Array.isArray(references) && references.length > 0) {
                                latestReferences = references;
                            }
                        }
                    });
                    if (!messages.length) {
                        appendMessage("ai", "아직 저장된 대화가 없습니다.", "");
                    }
                    setRecommendations(latestActionSources, latestReferences);
                } catch (error) {
                    console.error(error);
                    if (!isWorkspaceSelectionActive(conversationId, selectionEpoch)) return;
                    el.chatBody.innerHTML = "";
                    appendMessage("ai", "대화 내용을 불러오지 못했습니다.");
                }
            }

            // parseSseEvent: 해당 기능의 세부 처리를 담당.
            function parseSseEvent(rawEvent) {
                let name = "message";
                const dataLines = [];
                String(rawEvent || "")
                    .split("\n")
                    .forEach((line) => {
                        if (line.startsWith("event:")) name = line.substring(6).trim();
                        if (line.startsWith("data:")) dataLines.push(line.substring(5).trimStart());
                    });
                return { name, data: dataLines.join("\n") };
            }

            // sendMessageStream: 해당 기능의 세부 처리를 담당.
            async function sendMessageStream(conversationId, text, files, docIds, onDelta, onReport, onProgress, signal) {
                const requestData = {
                    role: "user",
                    content: text,
                    prompt_type: "agent",
                    prompt_type_option: runtime.config.promptType,
                    conversation_id: conversationId,
                };
                if (files.length) requestData.files = files;
                // v1.5 No.6: 선택 확정한 유사답변서는 metadata.doc_ids 로 보낸다.
                // content 문자열에 doc_id를 박아 넣는 구형 임시방식은 사용하지 않는다.
                if (Array.isArray(docIds) && docIds.length) {
                    requestData.doc_ids = Array.from(new Set(docIds.map((id) => String(id || "").trim()).filter(Boolean)));
                }
                console.groupCollapsed("[답변서 실제 요청 payload]");
                console.log("conversation_id:", conversationId);
                console.log("content:", text);
                console.log("files:", files);
                console.log("doc_ids:", requestData.doc_ids || []);
                console.log("payload(raw):", requestData);
                console.groupEnd();
                // [API 연동] POST ND_sendConversation.do: 질문/파일/자료 ID 전송. 스트림으로 답변과 보고서 진행 상태 수신.
                const response = await fetch("ND_sendConversation.do", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json;charset=UTF-8",
                        Accept: "text/event-stream",
                    },
                    credentials: "same-origin",
                    body: JSON.stringify(requestData),
                    signal,
                });
                if (!response.ok) throw new Error("메시지 전송 실패: " + response.status + " " + (await response.text()));
                if (!response.body) throw new Error("스트림 응답을 읽을 수 없습니다.");
                const reader = response.body.getReader();
                const decoder = new TextDecoder("utf-8");
                let buffer = "";
                let fullText = "";
                let metadata = {};
                let messageId = "";
                let completed = false;
                while (!completed) {
                    signal?.throwIfAborted();
                    const result = await reader.read();
                    signal?.throwIfAborted();
                    buffer += decoder.decode(result.value || new Uint8Array(), { stream: !result.done });
                    buffer = buffer.replace(/\r\n/g, "\n");
                    let separator;
                    while ((separator = buffer.indexOf("\n\n")) !== -1) {
                        const raw = buffer.substring(0, separator);
                        buffer = buffer.substring(separator + 2);
                        if (!raw.trim()) continue;
                        const event = parseSseEvent(raw);
                        if (event.name === "done" || event.name === "complete") {
                            completed = true;
                            break;
                        }
                        if (event.name === "error") {
                            let message = event.data || "AI 응답 처리 중 오류가 발생했습니다.";
                            try {
                                message = JSON.parse(event.data).message || message;
                            } catch (_) {}
                            throw new Error(message);
                        }
                        if (event.name !== "message" || !event.data) continue;
                        let chunk;
                        try {
                            chunk = JSON.parse(event.data);
                        } catch (_) {
                            continue;
                        }
                        if (chunk.id) messageId = String(chunk.id);
                        // v1.6 진행 이벤트는 채팅 메시지가 아니므로 본문/메타데이터에 합치지 않는다.
                        if (chunk.type === "stage") {
                            if (typeof onProgress === "function") {
                                onProgress({
                                    type: "stage",
                                    seq: Number(chunk.seq || 0),
                                    label: String(chunk.label || ""),
                                });
                            }
                            continue;
                        }
                        if (chunk.type === "trace") {
                            if (typeof onProgress === "function") {
                                onProgress({
                                    type: "trace",
                                    steps: Array.isArray(chunk.steps) ? chunk.steps : [],
                                });
                            }
                            continue;
                        }
                        if (chunk.content) {
                            fullText += chunk.content;
                            if (typeof onDelta === "function") onDelta(chunk.content, fullText);
                        }
                        if (chunk.metadata) {
                            metadata = Object.assign({}, metadata, chunk.metadata, {
                                action: chunk.metadata.action ?? metadata.action,
                                references: chunk.metadata.references ?? metadata.references,
                                report: chunk.metadata.report ?? metadata.report,
                            });
                            if (chunk.metadata.report?.report_id && typeof onReport === "function") {
                                onReport(chunk.metadata.report);
                            }
                        }
                    }
                    if (result.done) break;
                }
                return { id: messageId, content: fullText, metadata };
            }

            // ensureConversation: 필요한 요소나 상태가 존재하도록 보장.
            async function ensureConversation(title, requestWorkspaceEpoch, signal) {
                if (state.conversationId) return state.conversationId;
                // [API 연동] POST ND_conversation.do: 답변서 작업에 사용할 새 대화 생성.
                const data = await requestJson("ND_conversation.do", {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
                    body: "title=" + encodeURIComponent(pendingWorkspaceTitle || title),
                    signal,
                });
                signal?.throwIfAborted();
                const id = String(nestedValue(data, "id") || "");
                if (!id) throw new Error("대화 생성에 실패했습니다.");
                // 새 채팅을 누른 사이에 생성 응답이 와도 현재 화면의 conversationId를 덮어쓰지 않는다.
                if (workspaceEpoch === requestWorkspaceEpoch && !state.conversationId) {
                    state.conversationId = id;
                    renderConversationHistory();
                }
                return id;
            }

            // recoverLatestAssistantMetadata: 해당 기능의 세부 처리를 담당.
            async function recoverLatestAssistantMetadata(conversationId) {
                if (!conversationId) return { sources: [], references: [], report: null, content: "" };
                try {
                    // [API 연동] GET ND_conversationMessageList.do: 최신 AI 답변의 메타데이터 보완 조회.
                    const data = await requestJson("ND_conversationMessageList.do?conversationId=" + encodeURIComponent(conversationId));
                    const messages = listResponse(data, "items");
                    const assistants = messages
                        .filter((message) => message && message.role === "assistant")
                        .slice()
                        .reverse();
                    let sources = [];
                    let references = [];
                    let report = null;
                    let content = "";
                    for (const message of assistants) {
                        if (!content && message.content) content = message.content;
                        const messageSources = Array.isArray(message.metadata?.action?.sources) ? message.metadata.action.sources : [];
                        const messageReferences = Array.isArray(message.metadata?.references) ? message.metadata.references : [];
                        const messageReport = message.metadata?.report;
                        // 보고서 버전과 무관하게 유사답변서가 존재하는 가장 최신 AI 답변을 찾는다.
                        // 해당 답변의 유사답변서 전체와 참고자료를 한 묶음으로 복원한다.
                        if (messageSources.length > 0) {
                            sources = messageSources;
                            references = messageReferences;
                            report = messageReport && (messageReport.report_id || messageReport.id) ? messageReport : null;
                            break;
                        }
                    }
                    const recovered = { content, report, sources, references };
                    console.groupCollapsed("[답변서 최신 사용가능 assistant 저장 데이터]");
                    console.log("content:", recovered.content);
                    console.log("report:", recovered.report);
                    console.log("references:", recovered.references);
                    console.log("sources:", recovered.sources);
                    console.groupEnd();
                    return recovered;
                } catch (error) {
                    console.warn("[답변서] 추천 메타데이터 재조회 실패:", error);
                    return { sources: [], references: [], report: null, content: "" };
                }
            }

            // sendChat: 해당 기능의 세부 처리를 담당.
            async function sendChat(overrideText, options) {
                if (state.sending) {
                    if (overrideText == null) {
                        const request = [...activeRequests].find((item) => item.conversationId
                            ? item.conversationId === String(state.conversationId || "")
                            : item.epoch === workspaceEpoch && !state.conversationId);
                        request?.controller.abort();
                    }
                    return;
                }
                const config = options || {};
                const preserveWorkspace = config.preserveWorkspace === true;
                const requestDocIds = Array.isArray(config.docIds) ? Array.from(new Set(config.docIds.map((id) => String(id || "").trim()).filter(Boolean))) : [];
                const text = String(overrideText ?? el.chatInput.value).trim();
                if (!text || state.uploading || isConversationPending(state.conversationId)) return;
                const skeletonTarget = getSearchSkeletonTarget(text, preserveWorkspace);
                const requestWorkspaceEpoch = workspaceEpoch;
                const startingConversationId = String(state.conversationId || "");
                if (!startingConversationId) pendingNewWorkspaceEpochs.add(requestWorkspaceEpoch);
                appendMessage("user", text, getCurrentTime());
                if (overrideText == null) {
                    el.chatInput.value = "";
                    syncChatInputHeight();
                }
                // 특정 영역 요청은 기존 결과를 지우지 않고 해당 탭 위에만 로딩을 표시한다.
                if (!preserveWorkspace && skeletonTarget === "all") runtime.page.clearResult?.();
                console.log("[답변서 전송] content:", text);
                setBusy(true);
                runtime.page.beforeSend?.(skeletonTarget);
                const skeletonMessage = runtime.page.getLoadingMessage?.(skeletonTarget) || "관련자료를 검색하고 있습니다...";
                showSearchSkeleton(skeletonMessage, skeletonTarget);
                const loading = showLoading(skeletonTarget);
                const typingController = createChatTypingController(loading);
                const controller = new AbortController();
                const request = { controller, epoch: requestWorkspaceEpoch, conversationId: startingConversationId };
                activeRequests.add(request);
                controller.signal.addEventListener("abort", () => typingController.cancel(), { once: true });
                const filesForRequest = state.uploadedFiles.slice();
                let messageElement = null;
                const pageRequest = {};
                let conversationId = startingConversationId;
                const isRequestActive = () => conversationId ? String(state.conversationId || "") === String(conversationId) : workspaceEpoch === requestWorkspaceEpoch && !state.conversationId;
                try {
                    conversationId = await ensureConversation(text, requestWorkspaceEpoch, controller.signal);
                    request.conversationId = String(conversationId);
                    controller.signal.throwIfAborted();
                    pendingNewWorkspaceEpochs.delete(requestWorkspaceEpoch);
                    pendingConversationIds.add(String(conversationId));
                    // Start: 261015 수정 - 대화 재전송 시 목록 상태 초기화
                    // 재전송한 대화의 이전 실패 표시와 미확인 완료점을 지우고 진행중 상태로 갱신한다.
                    failedConversationIds.delete(String(conversationId));
                    completedConversationIds.delete(String(conversationId));
                    // End: 261015 수정 - 대화 재전송 시 목록 상태 초기화
                    pendingSkeletonTargets.set(String(conversationId), skeletonTarget);
                    renderConversationHistory();
                    // 새 대화 생성이 끝나기 전에 다른 화면으로 이동하지 않았다면 현재 대화로 확정한다.
                    if (workspaceEpoch === requestWorkspaceEpoch && !state.conversationId) {
                        state.conversationId = conversationId;
                        renderConversationHistory();
                    }
                    const result = await sendMessageStream(
                        conversationId,
                        text,
                        filesForRequest,
                        requestDocIds,
                        function (delta) {
                            typingController.push(delta);
                            if (isRequestActive()) messageElement = typingController.getMessage();
                        },
                        (reportInfo) => runtime.page.receiveMetadata?.(reportInfo, pageRequest, isRequestActive),
                        function (progressInfo) {
                            if (progressInfo.type === "stage" && isRequestActive()) {
                                updateSearchSkeleton(skeletonTarget === "recommend" ? recommendationLoadingMessage : progressInfo.label, loading);
                            }
                            if (progressInfo.type === "trace") {
                                console.log("[답변서 SSE 처리 trace]:", progressInfo.steps);
                            }
                        },
                        controller.signal,
                    );
                    controller.signal.throwIfAborted();
                    const chatDisplayText = getAssistantChatDisplayText(result.content, result.metadata);
                    if (isRequestActive()) {
                        messageElement = await typingController.finish(chatDisplayText);
                        controller.signal.throwIfAborted();
                        // Start: 261013 추가 - 메시지 액션버튼 연결
                        attachFeedbackControlsToMessage(messageElement, {
                            id: result.id,
                            feedback: nestedValue(result.metadata, "feedback"),
                            feedback_content: nestedValue(result.metadata, "feedback_content"),
                        });
                        // End: 261013 추가 - 메시지 액션버튼 연결
                        hideSearchSkeleton();
                    } else {
                        // 응답은 서버의 해당 conversation에 저장된다. 현재 보고 있는 채팅 DOM에는 그리지 않는다.
                        typingController.cancel();
                    }
                    console.groupCollapsed("[답변서 SSE 최종 응답]");
                    console.log("conversationId:", conversationId);
                    console.log("content:", result.content || "");
                    console.log("report:", result.metadata?.report ?? null);
                    console.log("references:", result.metadata?.references ?? []);
                    console.log("sources:", result.metadata?.action?.sources ?? []);
                    console.log("metadata(raw):", result.metadata || {});
                    console.groupEnd();
                    let sources = Array.isArray(result.metadata?.action?.sources) ? result.metadata.action.sources : [];
                    let references = Array.isArray(result.metadata?.references) ? result.metadata.references : [];
                    // 현재 답변에 유사답변서가 하나도 없을 때만 과거 답변을 조회한다.
                    // 보고서 버전과 상관없이 유사답변서가 존재하는 가장 최신 AI 답변에서
                    // 유사답변서만 복원한다. references는 현재 응답의 값을 유지한다.
                    if (!runtime.config.chatOnly && isRequestActive() && !sources.length) {
                        const recovered = await recoverLatestAssistantMetadata(conversationId);
                        if (Array.isArray(recovered.sources) && recovered.sources.length > 0) {
                            sources = recovered.sources;
                        }
                    }
                    if (isRequestActive()) {
                        if (!runtime.config.chatOnly && ((!preserveWorkspace && runtime.page.shouldReplaceSources?.(skeletonTarget) !== false) || sources.length || references.length)) {
                            setRecommendations(sources, references);
                        }
                        if (filesForRequest.length) {
                            state.uploadedFiles = [];
                            if (el.fileInput) el.fileInput.value = "";
                            await loadConversationAttachments(conversationId);
                        }
                        await runtime.page.completeResponse?.({ result, conversationId, requestDocIds,
                            skeletonTarget, pageRequest, isRequestActive });
                    }
                    // 목록은 어느 채팅을 보고 있어도 갱신 가능하지만, 본문/보고서 상태는 건드리지 않는다.
                    await loadConversationList({ page: 1, title: "" });
                    // 공통 Manage 완료점 대신 실제 작업이 끝난 대화방에 완료점을 표시한다.
                    completedConversationIds.add(String(conversationId));
                    renderConversationHistory();
                } catch (error) {
                    if (controller.signal.aborted) {
                        typingController.cancel();
                        if (isRequestActive()) {
                            hideSearchSkeleton();
                            messageElement = typingController.getMessage() || appendMessage("ai", "", getCurrentTime());
                            messageElement.classList.remove("is-streaming");
                            const note = document.createElement("p");
                            note.textContent = "답변 생성을 중지했습니다.";
                            (messageElement.querySelector(".msg-text") || messageElement).appendChild(note);
                        }
                        return;
                    }
                    // Start: 261015 수정 - 대화 요청 실패 상태 반영
                    // finally에서 진행중 상태를 제거한 뒤 목록을 다시 그리면 실패 배지가 표시된다.
                    if (conversationId) failedConversationIds.add(String(conversationId));
                    // End: 261015 수정 - 대화 요청 실패 상태 반영
                    typingController.cancel();
                    loading.remove();
                    if (isRequestActive()) {
                        hideSearchSkeleton();
                        if (!messageElement) messageElement = appendMessage("ai", "", getCurrentTime());
                        setMessageMarkdown(messageElement, "오류가 발생했습니다: " + error.message);
                    }
                    console.error("[답변서 전송 오류]", error);
                } finally {
                    activeRequests.delete(request);
                    pendingNewWorkspaceEpochs.delete(requestWorkspaceEpoch);
                    if (conversationId) {
                        pendingConversationIds.delete(String(conversationId));
                        pendingSkeletonTargets.delete(String(conversationId));
                        renderConversationHistory();
                    }
                    // A 작업의 finally가 B 채팅의 입력 잠금 상태를 풀어버리지 않도록 현재 대화 기준으로 다시 계산한다.
                    syncBusyForActiveConversation();
                    if (!state.sending) {
                        hideSearchSkeleton();
                        el.chatInput.focus();
                    }
                }
            }

            // getAnswerWelcomeHtml: 필요한 값을 조회.
            function getAnswerWelcomeHtml() {
                if (runtime.page.getWelcomeHtml) return runtime.page.getWelcomeHtml();
                const template = document.getElementById("answerWelcomeTemplate");
                const welcomeHtml = template?.content.firstElementChild?.innerHTML.trim() || "";
                return welcomeHtml;
            }

            // resetWorkspace: 상태 또는 화면을 기본값으로 초기화.
            function resetWorkspace() {
                pendingWorkspaceTitle = "";
                workspaceEpoch += 1;
                if (runtime.config.chatOnly) {
                    activeRequests.forEach((request) => request.controller.abort());
                    state.conversationId = "";
                    el.chatBody.replaceChildren();
                    delete el.chatBody.dataset.lastChatDateKey;
                    appendMessage("ai", getAnswerWelcomeHtml(), undefined, undefined, { rawHtml: true });
                    el.chatInput.value = "";
                    syncChatInputHeight();
                    syncBusyForActiveConversation();
                    return;
                }
                // Start: 261014 추가 - 새 대화 시작 시 검색 초기화
                runtime.resetSourceSearch();
                // End: 261014 추가 - 새 대화 시작 시 검색 초기화
                hideSearchSkeleton();
                state.conversationId = "";
                renderAnswerWorkspaceTitle();
                state.sending = false;
                state.uploadedFiles = [];
                // 새 채팅·새 작업은 미리보기 모드에서도 첨부자료 없이 시작한다.
                state.conversationFiles = [];
                if (el.fileInput) el.fileInput.value = "";
                state.recommendationItems = [];
                state.references = [];
                state.selectedReferenceKeys.clear();
                state.activeReferenceKey = "";
                runtime.page.reset?.();
                renderUploadedFiles();
                renderRecommendations();
                renderSelectedReferences();
                renderPreview();
                el.chatBody.innerHTML = "";
                appendMessage("ai", getAnswerWelcomeHtml(), undefined, undefined, { rawHtml: true });
                setTab("recommend");
                el.chatInput.value = "";
                syncChatInputHeight();
                syncBusyForActiveConversation();
            }

            // syncDrawerPositionButton: 관련 상태와 화면을 동기화.
            function syncDrawerPositionButton() {
                const button = el.historyPositionBtn;
                if (!button || !el.historyDrawer) return;
                const isLeft = el.historyDrawer.classList.contains("is-left");
                const label = isLeft ? "우측으로 이동" : "좌측으로 이동";
                const span = button.querySelector("span");
                if (span) span.textContent = label;
                const listLabel = runtime.config.labels.history;
                button.setAttribute("aria-label", listLabel + " " + label);
                button.title = listLabel + " " + label;
                const path = button.querySelector("svg path");
                if (path) {
                    path.setAttribute("d", isLeft ? "M8 5.5V18.5M10 12H17M14.5 9.5 17 12l-2.5 2.5" : "M16 5.5V18.5M14 12H7M9.5 9.5 7 12l2.5 2.5");
                }
            }

            // toggleDrawerPosition: 활성/표시 상태를 전환.
            function toggleDrawerPosition() {
                if (!el.historyDrawer) return;
                el.historyDrawer.classList.toggle("is-left");
                syncDrawerPositionButton();
            }

            // openDrawer: 대상 화면/팝업을 열고 필요한 데이터를 준비.
            function openDrawer() {
                if (!el.historyDrawer) return;
                syncDrawerPositionButton();
                el.historyDrawer.hidden = false;
                el.historyDrawer.classList.add("is-open");
                el.historyDrawer.removeAttribute("inert");
                document.body.classList.add("answer-chat-list-open");
                el.historyDrawer.setAttribute("aria-hidden", "false");
                el.historyBtn?.setAttribute("aria-expanded", "true");
                loadConversationList({
                    title: state.conversationSearchTitle,
                    page: state.conversationPage || 1,
                });
            }

            // closeDrawer: 대상 화면/팝업을 닫고 상태를 정리.
            function closeDrawer() {
                if (!el.historyDrawer) return;
                if (el.historySearch) {
                    el.historySearch.value = "";
                }
                state.conversationSearchTitle = "";
                state.conversationPage = 1;
                el.historySearchClear?.classList.add("hidden");
                document.body.classList.remove("answer-chat-list-open");
                el.historyDrawer.classList.remove("is-open");
                el.historyDrawer.setAttribute("aria-hidden", "true");
                el.historyDrawer.setAttribute("inert", "");
                el.historyDrawer.hidden = true;
                el.historyBtn?.setAttribute("aria-expanded", "false");
            }

            Object.assign(runtime, {
                getChatDateLabel,
                formatChatTime,
                getCurrentTime,
                formatMessageTime,
                getMessageDateKey,
                getMessageDateLabel,
                appendChatDateDivider,
                setTab,
                normalizeChatDisplayText,
                getAssistantChatDisplayText,
                copyChatMessageText,
                applyMessageFeedbackState,
                saveMessageFeedback,
                loadMessageFeedback,
                openMessageFeedbackEditor,
                openCustomerIssueModal,
                attachFeedbackControlsToMessage,
                appendMessage,
                setMessageMarkdown,
                createChatTypingController,
                showSearchSkeleton,
                hideSearchSkeleton,
                updateSearchSkeleton,
                showLoading,
                syncSendButton,
                syncChatInputHeight,
                setBusy,
                getConversationPageInfo,
                requestJson,
                loadConversationList,
                isPinnedConversation,
                setConversationFavorite,
                togglePinnedConversation,
                getConversationById,
                renameConversation,
                getDefaultAnswerWorkspaceTitle,
                getActiveConversationTitle,
                renderAnswerWorkspaceTitle,
                bindAnswerWorkspaceTitleEdit,
                deleteConversation,
                ensureHistorySortOptions,
                requestNextConversationPage,
                ensureConversationInfiniteScroll,
                renderConversationPagination,
                renderConversationHistory,
                selectConversation,
                loadConversationAttachments,
                loadConversationMessages,
                parseSseEvent,
                sendMessageStream,
                ensureConversation,
                recoverLatestAssistantMetadata,
                sendChat,
                getAnswerWelcomeHtml,
                resetWorkspace,
                syncDrawerPositionButton,
                toggleDrawerPosition,
                openDrawer,
                closeDrawer,
            });
        }
    };
})(window);
