/**
 * [더미 응답] 미리보기에서 실제 서버 대신 더미데이터로 응답합니다.
 * 공통 더미데이터는 dummy-data.js, 업무지원은 dummy-work-support-data.js에 있으며, 화면 표시와 버튼 동작은 기존 페이지 JS에서 처리합니다.
 * 미리보기 모드에서는 현재 페이지와 프로토콜·도메인·포트가 같은 주소의 ND_*.do 요청에 더미데이터로 응답합니다. 그 외 요청은 기존 fetch로 전달합니다.
 * 미리보기에서 변경한 내용은 서버에 저장되지 않으며, 새로고침하면 처음 더미데이터로 돌아갑니다.
 *
 * 공통 기본형은 common.css, 페이지 전용 보정은 각 페이지 CSS에 작성합니다.
 * 변경 내용 · 관련 함수
 * [더미 응답] request
 *
 * 관련 요청
 * [검색·가져오기] ND_sourceSearch.do, ND_sourceImport.do
 * [파일업로드] ND_uploadFile.do, ND_fileUpload.do

 * [261021 변경 내용 · 관련 함수]
 * [더미 분리] answerData: 업무지원 페이지는 workSupport, 답변서 페이지는 answer 저장소를 선택한다.
 * [초기 이력] seedConversation: 선택된 저장소의 메시지·첨부·참조자료·보고서·버전으로 초기화한다.
 * [더미 응답] request: 목록·검색·가져오기·업로드·답변 메타데이터도 같은 저장소를 사용한다.
 * - 업무지원 요약·검색은 workSupport.responses.answer/search 객체를 JSON 문자열로 변환해 SSE로 전달한다.
 * - 기존 answer API 주소와 domain 계약을 유지하며 업무지원 데이터는 answer에서 복사하거나 참조하지 않는다.
 *
 * 기본 구간 형식: Start: 기능명 / End: 기능명
 * 변경 구간 형식: Start: YYMMDD 추가/수정 - 기능명 / End: YYMMDD 추가/수정 - 기능명
 * 주석 정리 내역
 * - 261023 주석 정리 - 구간 표시와 변경 내용 표기를 통일합니다. 기존 작업 날짜와 기능 설명은 유지합니다.
 */
(() => {
    "use strict";
    if (!window.AIOnePreview?.enabled) return;
    const data = structuredClone(window.AIOneDummyData);
    const isWorkSupportPage = location.pathname.endsWith("/work-support.html");
    const isSaleReviewPage = location.pathname.endsWith("/sale-review.html");
    // API 주소/domain은 answer 계약을 유지합니다. answerData는 현재 화면의 데이터 선택자이며 workSupport를 answer에 합치지 않습니다.
    const answerData = isWorkSupportPage ? data.workSupport : data.answer;
    const previewAssets = new URL("../../assets/dummy/chat/", document.currentScript.src);
    // 챗봇 미리보기에서만 로컬 PDF.js를 사용합니다. 실제 연동의 서버 배포 경로는 유지합니다.
    if (document.body.dataset.page === "chatbot") {
        Object.assign(window.AIOneChatConfig ||= {}, {
            // 사용자 예시도 실제 연동과 같은 설정/렌더러를 사용합니다.
            user: data.chat.user,
            pdfjsSrc: new URL("vendor/pdfjs/pdf.min.mjs", document.currentScript.src).href,
            pdfjsWorker: new URL("vendor/pdfjs/pdf.worker.min.mjs", document.currentScript.src).href,
        });
    }
    const projectSources = new Map();
    const reports = new Map();
    const messages = new Map();
    const documents = new Map();
    const questions = new Map();
    const attachments = new Map();
    const conversationFiles = new Map();
    const feedback = new Map();
    const settings = new Map();
    const jobs = new Map();
    const makeId = (prefix) => prefix + "-" + crypto.randomUUID();
    const now = () => new Date().toISOString();
    const result = (value, status = 200) =>
        new Response(
            JSON.stringify({
                success: status < 400,
                ...(status < 400 ? { data: value, ...(Array.isArray(value?.items) ? value : {}) } : { message: value }),
            }),
            { status, headers: { "Content-Type": "application/json; charset=utf-8" } },
        );
    const reportFor = (id) => reports.get(id);
    // Start: 261016 수정 - 챗봇 이력·응답을 개발 메시지 계약에 맞춰 구성
    function chatReply(id, agent) {
        const scenario = data.chat.scenarios[id]
            || (agent === "report_generator" ? data.chat.scenarios["dummy-chat-budget-execution"] : null);
        const sources = (scenario?.source_ids || []).map((sourceId) => {
            const source = data.chat.sourceDocuments.find((item) => item.doc_id === sourceId);
            if (!source) return null;
            const { preview_file, ...metadata } = source;
            return metadata;
        }).filter(Boolean);
        return {
            content: scenario ? scenario.answer + "\n\n※ 화면 확인을 위한 예시 답변입니다." : data.messages.chat,
            metadata: sources.length ? {
                action: {
                    kind: "report",
                    notice: "근거 부족 — 확인이 필요한 항목이 있습니다.",
                    sources,
                },
            } : {},
        };
    }
    // End: 261016 수정 - 챗봇 이력·응답을 개발 메시지 계약에 맞춰 구성
    function seedConversation(conversation, domain) {
        const id = conversation.id;
        messages.set(domain + ":" + id, domain === "answer" ? structuredClone(answerData.messages) : []);
        if (domain === "chat" && data.chat.scenarios[id]) {
            const scenario = data.chat.scenarios[id];
            messages.set("chat:" + id, [
                {
                    id: id + "-question",
                    role: "user",
                    content: scenario.question,
                    metadata: { prompt_type_option: conversation.agent },
                    created_at: conversation.created_at,
                },
                {
                    id: id + "-answer",
                    role: "assistant",
                    ...chatReply(id, conversation.agent),
                    created_at: conversation.created_at,
                },
            ]);
        }
        if (domain === "answer") {
            conversationFiles.set(id, (answerData.conversationFiles || []).map((file) => {
                const fileId = file.id + "-" + id;
                return { ...structuredClone(file), id: fileId, file_id: fileId };
            }));
            const report = {
                ...structuredClone(answerData.report),
                report_id: "dummy-report-" + id,
                conversation_id: id,
                sources: structuredClone(answerData.sources),
                references: structuredClone(answerData.references),
                selected_doc_ids: [],
            };
            const history = [structuredClone(report), ...(answerData.reportVersions || []).map((version) => ({
                ...structuredClone(report),
                ...structuredClone(version),
            }))].sort((a, b) => a.version - b.version);
            const latest = history[history.length - 1];
            const versions = history.map((snapshot) => snapshot.version);
            Object.assign(report, latest, { latest_version: latest.version, versions });
            report.history = history.map((snapshot) => ({
                ...snapshot,
                latest_version: latest.version,
                versions: [...versions],
            }));
            reports.set(report.report_id, report);
        }
        if (domain === "classification") {
            const document = { ...structuredClone(data.classification.document), document_id: "dummy-document-" + id, conversation_id: id };
            // 진행중 예시는 실제 목록과 동일하게 문서의 작업 ID와 작업 상태로 판정한다.
            if (conversation.document_status === "processing") {
                const jobId = "dummy-job-" + id;
                Object.assign(document, { status: "processing", last_job_id: jobId, question_count: 0 });
                jobs.set(jobId, {
                    id: jobId,
                    job_id: jobId,
                    conversation_id: id,
                    document_id: document.document_id,
                    status: "processing",
                    question_count: 0,
                });
            }
            documents.set(document.document_id, document);
            questions.set(
                document.document_id,
                (document.status === "processing" ? [] : data.classification.questions).map((q, i) => ({
                    ...structuredClone(q),
                    question_id: document.document_id + "-q" + (i + 1),
                    document_id: document.document_id,
                })),
            );
        }
    }
    for (const domain of ["answer", "classification", "chat"]) {
        (domain === "answer" ? answerData : data[domain]).conversations.forEach((c) => seedConversation(c, domain));
    }
    function domainFor(url) {
        if (url.pathname.includes("/clsf/")) return "classification";
        if (url.pathname.includes("/answer/")) return "answer";
        if (url.pathname.includes("/chat/")) return "chat";
        return document.body.dataset.page === "intake" ? "classification" : document.body.dataset.page === "chatbot" ? "chat" : "answer";
    }
    function pageItems(items, params) {
        let rows = items.slice();
        const title = (params.get("title") || "").toLocaleLowerCase("ko-KR");
        if (title) rows = rows.filter((row) => (row.display_title || row.title || "").toLocaleLowerCase("ko-KR").includes(title));
        if (params.get("favorite") === "true") rows = rows.filter((row) => row.is_favorite);
        const sort = params.get("sort") || "-created_at";
        const field = sort.replace(/^-/, "");
        rows.sort((a, b) => String(a[field] || a.created_at || "").localeCompare(String(b[field] || b.created_at || ""), "ko") * (sort.startsWith("-") ? -1 : 1));
        const size = Math.max(1, Number(params.get("size")) || 50);
        const page = Math.max(1, Number(params.get("page")) || 1);
        return { items: rows.slice((page - 1) * size, page * size), page, pages: Math.max(1, Math.ceil(rows.length / size)), total: rows.length };
    }
    function bodyValues(body) {
        if (!body) return new URLSearchParams();
        if (body instanceof FormData || body instanceof URLSearchParams) return body;
        if (typeof body === "string" && body.trim().startsWith("{")) return JSON.parse(body);
        return new URLSearchParams(body);
    }
    function stream(frames, signal) {
        let cancelled = false;
        const encoder = new TextEncoder();
        const body = new ReadableStream({
            async start(controller) {
                try {
                    for (const frame of frames) {
                        await new Promise((resolve) => setTimeout(resolve, 400));
                        if (cancelled) return;
                        if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
                        controller.enqueue(encoder.encode(frame));
                    }
                    if (!cancelled) controller.close();
                } catch (error) {
                    if (!cancelled) controller.error(error);
                }
            },
            cancel() {
                cancelled = true;
            },
        });
        return new Response(body, { headers: { "Content-Type": "text/event-stream; charset=utf-8" } });
    }
    async function request(input, options = {}) {
        if (options.signal?.aborted) throw new DOMException("Aborted", "AbortError");
        const url = new URL(String(input), location.href);
        const endpoint = url.pathname.split("/").pop();
        // 홈 메뉴별 이력 예시 전용. 실제 서버에는 호출하지 않습니다.
        // Windows file://에서는 pathname 앞에 /C: 같은 드라이브 경로가 붙습니다.
        if (url.pathname.endsWith("/intra/ai/home/ND_recentHistory.do")) return result(data.home.history);
        const domain = domainFor(url);
        const list = (domain === "answer" ? answerData : data[domain]).conversations;
        const method = (options.method || "GET").toUpperCase();
        const body = bodyValues(options.body);
        const get = (key) => (body instanceof FormData || body instanceof URLSearchParams ? (body.get(key) ?? url.searchParams.get(key)) : (body[key] ?? url.searchParams.get(key)));
        const all = (key) => (body instanceof FormData || body instanceof URLSearchParams ? body.getAll(key) : [].concat(body[key] || []));
        const conversationId = String(get("conversationId") || get("conversation_id") || "");
        const documentId = String(get("documentId") || get("document_id") || "");
        const conversation = list.find((c) => c.id === conversationId);
        const reportId = String(get("reportId") || "");
        const report = reportFor(reportId);
        const messageKey = domain + ":" + conversationId;
        const questionId = String(get("questionId") || "");
        const question = [...questions.values()].flat().find((q) => q.question_id === questionId);
        const projectId = String(get("projectId") || "");
        const project = data.chat.projects.find((item) => item.id === projectId);
        switch (endpoint) {
            // 챗봇 프로젝트·검색 미리보기. 실제 연동 모드에서는 이 파일이 요청을 가로채지 않습니다.
            case "ND_projectList.do":
                return result(data.chat.projects);
            case "ND_project.do":
                return project ? result(project) : result("프로젝트가 없습니다.", 404);
            case "ND_projectCreate.do": {
                const created = { id: makeId("dummy-project"), name: get("name"), description: get("description") || "", system_instructions: get("instructions") || "", is_active: true };
                data.chat.projects.push(created);
                return result(created);
            }
            case "ND_projectUpdate.do":
                if (!project) return result("프로젝트가 없습니다.", 404);
                for (const [key, field] of [["name", "name"], ["description", "description"], ["instructions", "system_instructions"]]) {
                    if (get(key) != null) project[field] = String(get(key));
                }
                return result(project);
            case "ND_projectDelete.do":
                data.chat.projects = data.chat.projects.filter((item) => item.id !== projectId);
                data.chat.conversations.forEach((item) => { if (item.project_id === projectId) item.project_id = null; });
                projectSources.delete(projectId);
                return result({});
            case "ND_projectConversations.do":
                return result(data.chat.conversations.filter((item) => item.project_id === projectId));
            case "ND_projectSources.do":
                return result(projectSources.get(projectId) || []);
            case "ND_projectUploadSources.do": {
                const added = all("files").filter((file) => file instanceof File).map((file) => ({ id: makeId("dummy-source"), name: file.name, size: file.size, status: "completed" }));
                projectSources.set(projectId, [...(projectSources.get(projectId) || []), ...added]);
                return result(added);
            }
            case "ND_projectDeleteSource.do":
                projectSources.set(projectId, (projectSources.get(projectId) || []).filter((item) => item.id !== get("sourceId")));
                return result({});
            case "ND_moveConversation.do":
            case "ND_projectRemoveConversation.do":
                if (!conversation) return result("대화가 없습니다.", 404);
                conversation.project_id = endpoint === "ND_moveConversation.do" ? projectId : null;
                return result(conversation);
            case "ND_search.do": {
                const terms = String(get("query") || "").trim().split(/\s+/).filter(Boolean);
                const matches = data.chat.searchItems.filter((item) => terms.every((word) => (item.name + item.path).includes(word)));
                return result({ items: Number(get("page") || 1) === 1 ? matches : [], total: matches.length });
            }
            // Start: 261014 추가 - 소스 검색·가져오기 더미 응답
            // 운영 검색 API와 이전 미리보기 주소가 같은 예시 자료를 사용합니다.
            case "ND_documentSearch.do":
            case "ND_sourceSearch.do": {
                const terms = String(get(endpoint === "ND_documentSearch.do" ? "query" : "keyword") || "").trim().toLocaleLowerCase("ko-KR").split(/\s+/).filter(Boolean);
                const matches = terms.length ? (answerData.sourceSearch || []).filter((item) => {
                    const searchable = [item.document_name, item.content, ...(item.keywords || [])].join(" ").toLocaleLowerCase("ko-KR");
                    return terms.every((term) => searchable.includes(term));
                }) : [];
                const items = matches.map(({ keywords, ...reference }) => reference);
                return result({ items, total: items.length });
            }
            // 검색결과 가져오기 화면을 확인하기 위한 임시 요청 주소입니다. 실제 서버 연동 시 사용할 주소를 확인해야 합니다.
            case "ND_sourceImport.do": {
                if (method !== "POST") return result("소스 가져오기는 POST 요청을 사용해야 합니다.", 405);
                const requestedIds = get("documentIds");
                if (!Array.isArray(requestedIds) || !requestedIds.length || requestedIds.some((id) => typeof id !== "string" || !id.trim())) {
                    return result("가져올 소스의 문서 ID가 필요합니다.", 400);
                }
                const ids = [...new Set(requestedIds.map((id) => id.trim()))];
                const sourcesById = new Map((answerData.sourceSearch || []).map((item) => [item.document_id, item]));
                if (ids.some((id) => !sourcesById.has(id))) return result("가져올 소스를 찾을 수 없습니다.", 400);

                // 미리보기에서 처리 과정을 볼 수 있도록 응답을 잠시 늦춥니다. 화면에는 요청이 끝날 때까지 청킹 중 표시가 나옵니다.
                await new Promise((resolve, reject) => {
                    const signal = options.signal;
                    let timeoutId;
                    const onAbort = () => {
                        clearTimeout(timeoutId);
                        signal?.removeEventListener("abort", onAbort);
                        reject(new DOMException("Aborted", "AbortError"));
                    };
                    signal?.addEventListener("abort", onAbort, { once: true });
                    if (signal?.aborted) {
                        onAbort();
                        return;
                    }
                    timeoutId = setTimeout(() => {
                        signal?.removeEventListener("abort", onAbort);
                        resolve();
                    }, 900);
                });
                const items = ids.map((id) => {
                    const { keywords, ...reference } = sourcesById.get(id);
                    return reference;
                });
                return result({ items });
            }
            // End: 261014 추가 - 소스 검색·가져오기 더미 응답
            case "ND_reportSourcePreview.do": {
                const source = data.chat.sourceDocuments.find((item) => item.doc_id === documentId);
                if (source) return nativeFetch(new URL(source.preview_file, previewAssets), { signal: options.signal });
                return new Response(null, { status: 204 });
            }
            case "ND_conversationList.do":
                return result(pageItems(domain === "chat" ? list.filter((item) => !item.project_id) : list, url.searchParams));
            case "ND_createConversation.do":
            case "ND_conversation.do": {
                if (endpoint === "ND_conversation.do" && method === "GET") return result(messages.get(messageKey) || []);
                if (method === "PUT") {
                    if (!conversation) return result("대화가 없습니다.", 404);
                    conversation.display_title = String(get("title") || "새 대화");
                    conversation.updated_at = now();
                    return result(conversation);
                }
                if (method === "DELETE") {
                    const index = list.findIndex((c) => c.id === conversationId);
                    if (index >= 0) list.splice(index, 1);
                    return result({ id: conversationId });
                }
                const created = { id: makeId("dummy-conversation"), display_title: String(get("title") || "새 대화"), created_at: now(), updated_at: now(), is_favorite: false, ...(domain === "chat" ? { agent: get("agent") || "chat", project_id: projectId || null } : {}) };
                list.unshift(created);
                messages.set(domain + ":" + created.id, []);
                return result(created);
            }
            case "ND_updateChatTitle.do":
            case "ND_updateConversationTitle.do":
                if (!conversation) return result("대화가 없습니다.", 404);
                conversation.display_title = String(get("title") || "새 대화");
                return result(conversation);
            case "ND_deleteChat.do":
            case "ND_deleteConversation.do": {
                const index = list.findIndex((c) => c.id === conversationId);
                if (index >= 0) list.splice(index, 1);
                return result({ id: conversationId });
            }
            case "ND_conversationFavorite.do":
            case "ND_addConversationFavorite.do":
            case "ND_removeConversationFavorite.do":
                if (!conversation) return result("대화가 없습니다.", 404);
                conversation.is_favorite = method !== "DELETE" && endpoint !== "ND_removeConversationFavorite.do" && get("favorite") !== "false";
                return result(conversation);
            case "ND_conversationSettings.do":
                return result({ member_count: settings.get(conversationId) ?? 1 });
            case "ND_conversationSettingsBatch.do":
                return result(data.classification.conversations.map((c) => ({ conversation_id: c.id, member_count: settings.get(c.id) ?? 1 })));
            case "ND_updateConversationSettings.do":
                settings.set(conversationId, Number(get("memberCount")) || 0);
                return result({ member_count: settings.get(conversationId) });
            case "ND_conversationDocuments.do":
                return result([...documents.values()].filter((d) => d.conversation_id === conversationId));
            case "ND_documents.do":
                return result(documents.get(documentId) || {});
            // 수동 룰 미리보기: 실제 화면과 같은 목록/등록/삭제 API 계약을 사용한다.
            case "ND_rules.do": {
                const page = Math.max(1, Number(get("page")) || 1);
                const size = Math.max(1, Number(get("size")) || 50);
                const rules = data.classification.rules;
                return new Response(JSON.stringify({ success: true, data: rules.slice((page - 1) * size, page * size), total: rules.length, page, size }), { headers: { "Content-Type": "application/json" } });
            }
            case "ND_saveRule.do": {
                const department = data.classification.departments.find(item => item.id === get("departmentId"));
                const include = all("includeKeywords");
                if (!department || !include.length) return result("키워드와 실국을 확인해 주세요.", 400);
                const rule = { rule_id: makeId("dummy-rule"), name: get("name"), include_keywords: include, department: { id: department.id, name: department.name }, is_active: true, match_mode: "any" };
                data.classification.rules.unshift(rule);
                return result(rule);
            }
            case "ND_deleteRule.do": {
                const index = data.classification.rules.findIndex(rule => rule.rule_id === get("ruleId"));
                if (index < 0) return result("룰을 찾을 수 없습니다.", 404);
                data.classification.rules.splice(index, 1);
                return result({ deleted: true });
            }
            case "ND_departments.do":
                return result(data.classification.departments);
            case "ND_questions.do": {
                const job = jobs.get(String(get("jobId") || ""));
                const rows = questions.get(documentId || job?.document_id) || job?.questions || [];
                return result({ items: rows.filter((q) => Boolean(q.is_deleted) === (get("deleted") === "true")) });
            }
            case "ND_updateQuestion.do": {
                if (!question) return result("질의가 없습니다.", 404);
                if (get("questionText") != null) question.question_text = String(get("questionText"));
                for (const [key, field, clear] of [
                    ["primaryDepartmentIds", "primary_departments", "clearPrimaryDepartments"],
                    ["supportDepartmentIds", "support_departments", "clearSupportDepartments"],
                ]) {
                    const ids = all(key).map(String);
                    if (ids.length || get(clear) === "true") question[field] = data.classification.departments.filter((d) => ids.includes(d.id));
                }
                question.modified_fields = ["question_text", "primary_department_ids", "support_department_ids"];
                return result(question);
            }
            case "ND_deleteQuestion.do":
            case "ND_restoreQuestion.do":
                if (!question) return result("질의가 없습니다.", 404);
                question.is_deleted = endpoint === "ND_deleteQuestion.do";
                return result(question);
            case "ND_deleteDocument.do":
                documents.delete(documentId);
                questions.delete(documentId);
                return result({ document_id: documentId });
            case "ND_submitDocument.do":
            case "ND_cancelSubmit.do":
                (questions.get(documentId) || []).forEach((q) => {
                    q.is_submitted = endpoint === "ND_submitDocument.do";
                });
                return result({ document_id: documentId });
            case "ND_addFavorite.do":
            case "ND_removeFavorite.do": {
                const doc = documents.get(documentId);
                if (doc) doc.is_favorite = endpoint === "ND_addFavorite.do";
                return result(doc || {});
            }
            case "ND_uploadDocuments.do": {
                const uploaded = [];
                for (const file of body.values()) {
                    if (!(file instanceof File)) continue;
                    const id = makeId("dummy-document");
                    const doc = { document_id: id, conversation_id: conversationId, file_name: file.name, file_size: file.size, status: "completed", question_count: data.classification.questions.length };
                    documents.set(id, doc);
                    questions.set(
                        id,
                        data.classification.questions.map((q, i) => ({ ...structuredClone(q), question_id: id + "-q" + (i + 1), document_id: id })),
                    );
                    uploaded.push(doc);
                }
                return result(uploaded);
            }
            case "ND_classify.do": {
                const id = makeId("dummy-job");
                const job = {
                    job_id: id,
                    id,
                    status: "completed",
                    document_id: documentId,
                    question_count: (questions.get(documentId) || data.classification.questions).length,
                    questions: [{ ...structuredClone(data.classification.questions[0]), question_text: String(get("text") || get("questionText") || data.classification.questions[0].question_text) }],
                };
                jobs.set(id, job);
                return result(job);
            }
            case "ND_jobStatus.do":
                return result(jobs.get(String(get("jobId"))) || { status: "completed", question_count: data.classification.questions.length });
            case "ND_jobs.do":
                return result([...jobs.values()]);
            case "ND_conversationMessageList.do":
                return result({ items: messages.get(messageKey) || [] });
            case "ND_conversationFiles.do":
                return result(domain === "answer" ? conversationFiles.get(conversationId) || [] : []);
            case "ND_reportList.do":
                return result({ items: [...reports.values()].filter((r) => r.conversation_id === conversationId) });
            case "ND_reportDetail.do":
                return result(report || {});
            case "ND_reportVersionDetail.do": {
                const version = Number(get("version")) || report?.version;
                return result(report?.history.find((r) => r.version === version) || {});
            }
            case "ND_reportSources.do":
                if (!report) return result("답변서가 없습니다.", 404);
                if (method === "PATCH") report.selected_doc_ids = get("selectedDocIds") || get("selected_doc_ids") || get("docIds") || get("doc_ids") || [];
                return result({ selected_doc_ids: report.selected_doc_ids });
            case "ND_reportVersion.do":
            case "ND_reportVersionRestore.do": {
                if (!report) return result("답변서가 없습니다.", 404);
                const previous = report.history.find((r) => r.version === Number(get("version") || get("restoreVersion")));
                report.content = endpoint === "ND_reportVersionRestore.do" ? previous?.content || report.content : String(get("content") || report.content);
                report.version += 1;
                report.latest_version = report.version;
                report.versions.push(report.version);
                const { history, ...snapshot } = report;
                history.push(structuredClone(snapshot));
                return result(snapshot);
            }
            case "ND_sendConversation.do":
            case "ND_send.do": {
                const text = String(get("content") || get("message") || "");
                const reply = domain === "chat" ? chatReply(conversationId, get("agent") || conversation?.agent) : null;
                // 반영 목업은 기존 자료 목록 렌더러를 재사용하되 자료 한 건만 표시한다.
                const isWorkSupportApply = isWorkSupportPage && text === "선택한 참조자료를 바탕으로 주요 내용을 정리해 주세요.";
                const workSupportResponse = isWorkSupportPage
                    ? (isWorkSupportApply
                        ? { ...answerData.responses.search, documents: answerData.responses.search.documents.slice(0, 1) }
                        : /찾|검색/.test(text) ? answerData.responses.search : answerData.responses.answer)
                    : null;
                const answer = isSaleReviewPage ? data.messages.chat : domain === "answer"
                    ? (isWorkSupportPage ? JSON.stringify(workSupportResponse) : data.messages.answer)
                    : reply?.content || data.messages.chat;
                const id = makeId("dummy-message");
                const history = messages.get(messageKey) || [];
                history.push({ id: makeId("dummy-message"), role: "user", content: text, metadata: { prompt_type_option: get("agent") || "chat" }, created_at: now() });
                let current = [...reports.values()].find((r) => r.conversation_id === conversationId);
                if (domain === "answer" && !isSaleReviewPage && !current) {
                    const savedMessages = history;
                    seedConversation({ id: conversationId }, "answer");
                    messages.set(messageKey, savedMessages);
                    current = [...reports.values()].find((r) => r.conversation_id === conversationId);
                }
                const metadata = domain === "answer" && !isSaleReviewPage ? { action: { sources: answerData.sources }, references: answerData.references, report: { report_id: current.report_id, version: current.version } } : reply?.metadata || {};
                history.push({ id, role: "assistant", content: answer, metadata, created_at: now() });
                messages.set(messageKey, history);
                if (conversation) conversation.updated_at = now();
                const frame = (value) => "data: " + JSON.stringify(value) + "\n\n";
                return stream(
                    [
                        frame({ type: "stage", label: "예시 자료 확인 중" }),
                        frame({ type: "stage", label: "미리보기 답변 생성 중" }),
                        frame({ id, content: answer, metadata }),
                        endpoint === "ND_sendConversation.do" ? "event: done\ndata: {}\n\n" : frame({ type: "done" }),
                    ],
                    options.signal,
                );
            }
            case "ND_uploadFile.do":
            case "ND_fileUpload.do": {
                const uploaded = [];
                for (const file of body.values()) {
                    if (!(file instanceof File)) continue;
                    const id = makeId("dummy-file");
                    // Start: 261012 추가 - 업로드 응답에 참조소스 표시 설정과 정렬용 날짜 연결
                    const appearance = domain === "answer" ? answerData.fileUpload : null;
                    const extension = file.name.split(".").pop().toLowerCase();
                    const item = {
                        ...appearance?.default,
                        ...appearance?.extensions?.[extension],
                        ...appearance?.files?.[file.name],
                        id, file_id: id, name: file.name, file_name: file.name, size: file.size,
                        ...(appearance ? { lastModified: file.lastModified, created_at: now() } : {}),
                    };
                    // End: 261012 추가 - 업로드 응답에 참조소스 표시 설정과 정렬용 날짜 연결
                    attachments.set(id, { item, file });
                    uploaded.push(item);
                }
                return result(endpoint === "ND_uploadFile.do" ? uploaded : uploaded[0] || {});
            }
            case "ND_deleteFile.do":
            case "ND_fileDelete.do":
                attachments.delete(String(get("fileId")));
                conversationFiles.forEach((files, id) => {
                    conversationFiles.set(id, files.filter((file) => file.id !== String(get("fileId"))));
                });
                return result({});
            case "ND_fileDownload.do": {
                const stored = attachments.get(String(get("fileId")));
                if (!stored) return result("미리보기에는 참고자료의 원본 파일이 없습니다.", 501);
                return new Response(stored.file, { headers: { "Content-Disposition": "attachment; filename*=UTF-8''" + encodeURIComponent(stored.file.name) } });
            }
            case "ND_answerFeedback.do":
            case "ND_feedback.do": {
                const id = String(get("logId") || get("messageId"));
                if (method !== "GET") feedback.set(id, body instanceof URLSearchParams ? Object.fromEntries(body) : body);
                return result(feedback.get(id) || {});
            }
            case "ND_customer.do":
                return result("미리보기에서는 문의를 전송하지 않습니다.", 501);
            default:
                return result("미리보기에서 지원하지 않는 서버 기능입니다: " + endpoint, 501);
        }
    }
    window.AIOneDummy = Object.freeze({ request });

    // 기존 페이지의 요청 코드를 그대로 사용하면서, 미리보기에서는 아래에서 더미 응답으로 연결합니다.
    // 이 처리는 미리보기 모드에서만 적용합니다. 이미지·스크립트 파일이나 다른 출처의 요청은 기존 fetch로 전달합니다.
    const nativeFetch = window.fetch.bind(window);
    window.fetch = async function previewFetch(input, options) {
        const url = new URL(input instanceof Request ? input.url : String(input), location.href);
        if (url.origin !== location.origin || !/\/ND_[^/]+\.do$/.test(url.pathname)) {
            return nativeFetch(input, options);
        }
        if (input instanceof Request) {
            const req = new Request(input, options);
            return request(req.url, {
                method: req.method,
                headers: req.headers,
                signal: req.signal,
                body: ["GET", "HEAD"].includes(req.method)
                    ? undefined
                    : await req
                          .clone()
                          .formData()
                          .catch(() => req.text()),
            });
        }
        return request(input, options);
    };

})();
