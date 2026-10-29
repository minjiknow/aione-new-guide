"use strict";

/*
 * 261028 누적 변경 요약 (현재 구현 기준)
 * - 공통 사이드바·모달·툴팁·제목 편집·목록·로딩·패널 배치와 답변 액션을 제공합니다. 페이지별 데이터와 이벤트 계약을 유지하면서 공통 UI를 재사용합니다.
 *
 * 목록 관련 적용 페이지: html/ai-answer.html의 채팅 목록, html/work-support.html의 작업 목록 (#runDrawer > #chatTopics).
 * html/chatbot.html의 #chatHistoryList는 chat.js의 별도 목록이다.
 * 초기 주석 정리 기준일: 261022. 이후 변경은 날짜별 요약과 구간 주석에 기록한다.
 * 변경 내용 · 관련 함수
 * [채팅 제목 변경] setItemTitle: 제목 텍스트만 바꾸고 아이콘·완료점을 유지한다.
 * [답변서 채팅 목록 카드] renderChatItems: 상태점, 제목, 날짜·상태, 더보기를 표시한다.
 * [공통 목록 제어] bindControls, syncSortWidth: 답변서·질의분류의 검색/정렬 제어를 공유한다.
 *
 * [261020 변경 내용 · 관련 함수]
 * [모드 이동] bindNavModes: data-nav-mode-href로 홈 Chat은 chatbot.html, 챗봇 Work는 home.html로 이동한다.
 * - 방향키는 포커스를 이동하고 Enter/Space 또는 클릭으로 선택한다.
 * [답변 블록 복사] addBlockCopyBars, tableToTsv, tableToClipboardHtml, copyRich, copyPlain, copyBlock: 표·코드 복사 행을 공통 처리한다.
 * [261021 변경 내용 · 관련 함수]
 * [업무지원 작업 목록] renderChatItems: showIcon: false이면 채팅 아이콘 DOM을 생성하지 않는다. 기본값은 기존 아이콘 표시다.
 * [버튼 툴팁] 업무지원 검색 결과 전체 보기는 HTML의 data-tooltip/data-tooltip-auto/data-tooltip-placement로 공통 툴팁에 연결한다.
 * [파일명 자동 연결] syncFileTooltips, initFileTooltips, init: 초기·추가 목록과 미리보기 파일명에 아래 방향 툴팁을 자동 연결한다.
 * - 기존 AIOneTooltip의 show/hide/bind를 재사용하며, MutationObserver로 파일명 추가·변경을 감지한다.
 * - 반영 버튼과 sub-badge는 제외한다. 업무지원·답변서 등 페이지별 중복 등록은 두지 않는다.
 * [261022 변경 내용 · 관련 함수]
 * [모드 툴팁] show, bindNavTooltips: 펼친 사이드바에서도 Work/Chat 툴팁을 표시하고 일반 메뉴의 축소 상태 조건은 유지한다.
 * [사이드바 너비 저장] bindSidebarResize: 공통 localStorage 키 ai-one:sidebar-width로 화면 이동·새로고침 시 너비를 복원한다.
 * - 180~360px 범위를 유지하며 드래그 종료·키보드 조절·더블클릭 초기화(220px) 시 저장한다. 저장소 접근 실패 시에도 너비 조절은 동작한다.
 * 적용 페이지: common.js를 로드하는 전체 화면.
 * 주요 구성: 공통 UI 초기화, 사이드바·모달·툴팁, 목록·패널 및 답변 액션.
 * 데이터 관리: 공통 UI는 전달받은 데이터를 사용하며 페이지 예시 데이터는 js/dummy에서 공급합니다.
 * - 261022 주석 보완 - 공통 컴포넌트 런타임의 종료 표시와 공통 입력창 구간 표시를 보완했다.
 *
 * 261026 변경 요약
 * - 수정 - 레이아웃 초기화를 기본 동작으로 통합: 패널 순서·너비·접힘·조작 상태 복원, 페이지별 저장소·후처리 연결 및 홈 제외
 * - 수정 - 공통 스피너·스켈레톤 생성 및 Drawer 목록 조회 로딩 제공
 * - 수정 - 탑바 제목 표시·편집을 AIOneTopbar.createTitleEditor로 통합하고 화면별 제목 조회·저장 함수를 연결
 * - 수정 - Enter·포커스 이탈 저장, Escape 취소, 한글 조합 입력·중복 이벤트·비동기 중복 저장 방지 및 전체 제목 툴팁 처리
 *
 * 기본 구간 형식: Start: 기능명 / End: 기능명
 * 변경 구간 형식: Start: YYMMDD 추가/수정 - 기능명 / End: YYMMDD 추가/수정 - 기능명
 * 주석 정리 내역
 * - 261023 주석 정리 - 구간 표시와 변경 내용 표기를 통일합니다. 기존 작업 날짜와 기능 설명은 유지합니다.
 * - 261023 추가 - 기존 빈 화면과 no-file 아이콘을 재사용하는 createFilterEmpty
 */

(function () {
    const NOTIFICATION_KEY = "ai-one-long-task-notification";
    let notificationEnabled = readNotificationPreference();

    /* Start: 알림 설정 (Notification Settings) */
    function readNotificationPreference() {
        try {
            const saved = localStorage.getItem(NOTIFICATION_KEY);
            return saved === null ? true : saved === "true";
        } catch (e) {
            return true;
        }
    }

    function saveNotificationPreference(enabled) {
        notificationEnabled = Boolean(enabled);
        try {
            localStorage.setItem(NOTIFICATION_KEY, String(notificationEnabled));
        } catch (e) {
            /* 현재 화면에만 적용 */
        }
        if (!notificationEnabled) window.AIOneSidebar?.clearCompletion();
        else window.AIOneSidebar?.renderCompletionDots();
        updateAllNotificationUIs();
        document.dispatchEvent(new CustomEvent("ai-one-notification-change", { detail: { enabled: notificationEnabled } }));
    }

    function updateNotificationUI(panel, message = "") {
        const toggle = panel?.querySelector(".notification-toggle");
        const status = panel?.querySelector(".notification-setting-status");
        if (!toggle || !status) return;

        toggle.classList.toggle("active", notificationEnabled);
        toggle.setAttribute("aria-checked", String(notificationEnabled));
        status.textContent = message || (notificationEnabled ? "알림이 켜져 있습니다." : "알림이 꺼져 있습니다.");
    }

    function updateAllNotificationUIs(message = "") {
        document.querySelectorAll("[data-settings-panel]").forEach((panel) => updateNotificationUI(panel, message));
    }

    function initSettingsPanels(root = document) {
        const panels = [];
        if (root instanceof Element && root.matches("[data-settings-panel]")) panels.push(root);
        root.querySelectorAll?.("[data-settings-panel]").forEach((panel) => panels.push(panel));

        panels.forEach((panel) => {
            if (panel.dataset.settingsReady !== "true") {
                panel.querySelector(".notification-toggle")?.addEventListener("click", async () => {
                    if (notificationEnabled) {
                        saveNotificationPreference(false);
                        return;
                    }

                    if ("Notification" in window && Notification.permission === "default") {
                        try {
                            await Notification.requestPermission();
                        } catch (e) {
                            /* 브라우저 알림 미지원 */
                        }
                    }
                    if ("Notification" in window && Notification.permission === "denied") {
                        saveNotificationPreference(false);
                        updateAllNotificationUIs("브라우저 알림 권한이 차단되어 있습니다.");
                        return;
                    }

                    saveNotificationPreference(true);
                    showInAppNotification("알림 설정 완료", "시간이 걸리는 요청의 응답 완료 알림을 받습니다.");
                });
                panel.dataset.settingsReady = "true";
            }

            updateNotificationUI(panel);
        });
    }

    window.AIOnePreferences = Object.freeze({
        init: initSettingsPanels,
        isNotificationEnabled: () => notificationEnabled,
        setNotificationEnabled: (enabled) => saveNotificationPreference(enabled),
    });
    document.dispatchEvent(new CustomEvent("ai-one-preferences:ready"));

    function showInAppNotification(title, body) {
        let toast = document.querySelector(".ai-one-notification-toast");
        if (!toast) return;
        if (toast.dataset.notificationReady !== "true") {
            toast.querySelector("button")?.addEventListener("click", () => toast.classList.remove("show"));
            toast.dataset.notificationReady = "true";
        }
        toast.querySelector("strong").textContent = title;
        toast.querySelector("span").textContent = body;
        toast.classList.add("show");
        clearTimeout(toast._hideTimer);
        toast._hideTimer = setTimeout(() => toast.classList.remove("show"), 4500);
    }

    function inferMenuKeyFromNotification(title) {
        const text = String(title || "");
        if (text.includes("질의 분류") || text.includes("질의 재분류")) return "intake";
        if (text.includes("답변서") || text.includes("관련자료")) return "answer";
        if (text.includes("경제")) return "economy";
        if (text.includes("챗봇")) return "chatbot";
        return "";
    }

    function notifyLongTask(title, body, menuKey) {
        if (!notificationEnabled) return false;
        const resolvedMenuKey = menuKey || inferMenuKeyFromNotification(title);
        if (resolvedMenuKey) window.AIOneSidebar?.markCompletion(resolvedMenuKey);
        showInAppNotification(title, body);
        if ("Notification" in window && Notification.permission === "granted" && document.hidden) {
            try {
                new Notification(title, { body: body, tag: "ai-one-long-task" });
            } catch (e) {
                /* 인앱 알림으로 대체 */
            }
        }
        return true;
    }

    window.AIOneNotifications = {
        isEnabled: () => notificationEnabled,
        notifyLongTask,
    };

    /* End: 알림 설정 (Notification Settings) */

    /* Start: 드로어 레이어 상태 (Drawer Layer State) */
    function observeDrawerLayering() {
        const selectors = ".run-drawer, .chat-drawer, .rule-drawer, .report-drawer";
        const update = () => {
            const open = Array.from(document.querySelectorAll(selectors)).some((drawer) => !drawer.classList.contains("hidden"));
            document.body.classList.toggle("drawer-layer-open", open);
        };
        const drawers = document.querySelectorAll(selectors);
        drawers.forEach((drawer) => {
            if (!(drawer instanceof Node)) return;
            try {
                new MutationObserver(update).observe(drawer, { attributes: true, attributeFilter: ["class"] });
            } catch (error) {
                return;
            }
        });
        update();
    }

    document.addEventListener("app:includes-ready", () => {
        initSettingsPanels();
    });
    document.addEventListener("component:ready", (event) => {
        initSettingsPanels(event.target);
    });
    document.addEventListener("DOMContentLoaded", () => {
        initSettingsPanels();
        observeDrawerLayering();
    });
})();

/* End: 드로어 레이어 상태 (Drawer Layer State) */

/* Start: 공통 컴포넌트 런타임 (Shared Component Runtime) */

/* Start: 레이어 팝업 (Layer Popup) */

(() => {
    const returnFocus = new WeakMap();
    const registeredTypes = new Map();

    function getOpenLayers() {
        return Array.from(registeredTypes.values()).flatMap((config) => Array.from(document.querySelectorAll(`${config.layerSelector}:not(.hidden):not([hidden])`)));
    }

    function syncBodyState() {
        document.body.classList.toggle("is-component-layer-open", getOpenLayers().length > 0);
    }

    function getConfigForLayer(layer) {
        return Array.from(registeredTypes.values()).find((config) => layer.matches(config.layerSelector));
    }

    function setOpen(layer, isOpen, trigger = null) {
        const config = layer && getConfigForLayer(layer);
        if (!layer || !config) return;

        layer.classList.toggle("hidden", !isOpen);
        layer.hidden = !isOpen;
        document.querySelectorAll(`[${config.openAttribute}="${layer.id}"]`).forEach((button) => {
            button.setAttribute("aria-expanded", String(isOpen));
        });

        if (isOpen) {
            returnFocus.set(layer, trigger || document.activeElement);
            if (config.focusOnOpen !== false) {
                window.requestAnimationFrame(() => {
                    const focusScope = layer.querySelector('[role="dialog"]') || layer;
                    const focusableSelector = 'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';
                    const focusTarget = [focusScope.querySelector("[autofocus]"), ...focusScope.querySelectorAll(focusableSelector)].find((element) => element instanceof HTMLElement && element.getClientRects().length > 0);
                    focusTarget?.focus();
                });
            }
        } else {
            const returnTarget = returnFocus.get(layer);
            if (returnTarget instanceof HTMLElement && returnTarget.isConnected) returnTarget.focus();
            returnFocus.delete(layer);
        }

        syncBodyState();
        layer.dispatchEvent(
            new CustomEvent(`${config.type}:${isOpen ? "open" : "close"}`, {
                bubbles: true,
            }),
        );
    }

    function initType(root, config) {
        root.querySelectorAll?.(`[${config.openAttribute}]`).forEach((trigger) => {
            if (!trigger.hasAttribute("aria-haspopup")) trigger.setAttribute("aria-haspopup", "dialog");
            if (!trigger.hasAttribute("aria-expanded")) trigger.setAttribute("aria-expanded", "false");
        });
        syncBodyState();
    }

    function bindGlobalEvents() {
        if (document.documentElement.dataset.componentLayerEventsReady === "true") return;

        document.addEventListener("click", (event) => {
            for (const config of registeredTypes.values()) {
                const close = event.target.closest(`[${config.closeAttribute}]`);
                if (close) {
                    setOpen(close.closest(config.layerSelector), false);
                    return;
                }

                const trigger = event.target.closest(`[${config.openAttribute}]`);
                if (trigger) {
                    setOpen(document.getElementById(trigger.getAttribute(config.openAttribute)), true, trigger);
                    return;
                }

                const layer = event.target.closest(config.layerSelector);
                if (layer && config.closeOnLayerClick && event.target === layer) {
                    setOpen(layer, false);
                    return;
                }
            }
        });

        document.addEventListener("keydown", (event) => {
            const layer = getOpenLayers().at(-1);
            if (!layer) return;
            if (event.defaultPrevented) return;

            if (event.key === "Escape") {
                if (event.target.closest?.("[data-dropdown-menu].is-open")) return;
                event.preventDefault();
                setOpen(layer, false);
                return;
            }
            if (event.key !== "Tab") return;

            const focusScope = layer.querySelector('[role="dialog"]') || layer;
            const focusable = Array.from(focusScope.querySelectorAll('button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')).filter(
                (element) => element.getClientRects().length > 0,
            );
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

        document.documentElement.dataset.componentLayerEventsReady = "true";
    }

    function create(config) {
        registeredTypes.set(config.type, Object.freeze({ ...config }));
        bindGlobalEvents();

        return Object.freeze({
            init(root = document) {
                initType(root, config);
            },
            open(target, trigger = null) {
                const layer = target instanceof Element ? target : document.querySelector(target);
                setOpen(layer, true, trigger);
            },
            close(target) {
                const layer = target instanceof Element ? target : document.querySelector(target);
                setOpen(layer, false);
            },
        });
    }

    window.AIOneLayerFactory = Object.freeze({ create });
})();

/* End: 레이어 팝업 (Layer Popup) */

/* Start: 버튼 (Button) */

(() => {
    function bindReactionButton(button) {
        if (!button || button.closest("[data-chat-message-list]")) return;
        if (button.dataset.reactionButtonReady === "true") return;

        if (!button.hasAttribute("aria-pressed")) button.setAttribute("aria-pressed", "false");
        button.addEventListener("click", () => {
            const isPressed = button.getAttribute("aria-pressed") === "true";
            button.classList.toggle("active", !isPressed);
            button.setAttribute("aria-pressed", String(!isPressed));
        });
        button.dataset.reactionButtonReady = "true";
    }

    function init(root = document) {
        const selector = '.icon-button-message[data-action="like"], .icon-button-message[data-action="dislike"]';
        if (root.matches?.(selector)) bindReactionButton(root);
        root.querySelectorAll?.(selector).forEach(bindReactionButton);
    }

    window.AIOneButton = Object.freeze({ init });

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => init(), { once: true });
    } else {
        init();
    }
    document.addEventListener("app:includes-ready", (event) => init(event.target));
})();

/* End: 버튼 (Button) */

/* Start: 칩 (Chip) */

(() => {
    function resolveConfig(button) {
        const group = button.closest("[data-chip-target]");
        const targetSelector = button.dataset.chipTarget || group?.dataset.chipTarget;
        if (!targetSelector) return null;

        return {
            targetSelector,
            value: button.dataset.chipValue ?? `${button.textContent.trim()}${button.dataset.chipSuffix ?? group?.dataset.chipSuffix ?? ""}`,
        };
    }

    document.addEventListener("click", (event) => {
        const button = event.target.closest(".chat-tag");
        if (!button) return;

        const config = resolveConfig(button);
        if (!config) return;

        const target = document.querySelector(config.targetSelector);
        if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;

        // 생성 중 추천 클릭이 중지 버튼을 누르거나 입력 내용을 덮어쓰지 않도록 한다.
        if (target.disabled) return;
        const composer = target.closest(".chat-input-area, [data-chat-composer], .chat-composer, form");
        if (composer?.querySelector(".chat-stop, .prompt-composer-stop, .is-stop")) return;

        target.value = config.value;
        target.dispatchEvent(new Event("input", { bubbles: true }));
        target.focus();
        button.dispatchEvent(
            new CustomEvent("chip:action", {
                bubbles: true,
                detail: { target, value: config.value },
            }),
        );
    });
})();

/* End: 칩 (Chip) */

/* Start: 툴팁 (Tooltip) */

(() => {
    const TOOLTIP_ID = "aiOneTooltip";
    const VIEWPORT_PADDING = 8;
    const DEFAULT_GAP = 10;
    const boundRoots = new WeakMap();
    const describedByStates = new WeakMap();
    let activeTrigger = null;
    let hideTimer = 0;

    function ensureTooltip() {
        let tooltip = document.getElementById(TOOLTIP_ID);
        if (!tooltip) {
            tooltip = document.createElement("div");
            tooltip.id = TOOLTIP_ID;
            tooltip.className = "ai-one-tooltip";
            tooltip.setAttribute("role", "tooltip");
            tooltip.hidden = true;
            document.body.appendChild(tooltip);
        }
        return tooltip;
    }

    function resolveContent(trigger, options) {
        if (typeof options.content === "function") return options.content(trigger);
        if (options.content !== undefined) return options.content;
        return trigger.dataset.tooltip || "";
    }

    function setDescribedBy(trigger, tooltip) {
        if (!describedByStates.has(trigger)) {
            describedByStates.set(trigger, trigger.getAttribute("aria-describedby"));
        }
        const currentIds = (trigger.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean);
        if (!currentIds.includes(tooltip.id)) currentIds.push(tooltip.id);
        trigger.setAttribute("aria-describedby", currentIds.join(" "));
    }

    function restoreDescribedBy(trigger) {
        if (!trigger || !describedByStates.has(trigger)) return;
        const previousValue = describedByStates.get(trigger);
        if (previousValue) trigger.setAttribute("aria-describedby", previousValue);
        else trigger.removeAttribute("aria-describedby");
        describedByStates.delete(trigger);
    }

    function positionTooltip(tooltip, trigger, gap) {
        const triggerRect = trigger.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();
        let left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
        let top = triggerRect.bottom + gap;

        // 모든 공통 툴팁은 아래에 표시하고, 아래 공간이 부족하면 위로 전환한다.
        if (top + tooltipRect.height > window.innerHeight - VIEWPORT_PADDING) {
            top = triggerRect.top - tooltipRect.height - gap;
        }

        left = Math.max(VIEWPORT_PADDING, Math.min(left, window.innerWidth - tooltipRect.width - VIEWPORT_PADDING));
        top = Math.max(VIEWPORT_PADDING, Math.min(top, window.innerHeight - tooltipRect.height - VIEWPORT_PADDING));
        tooltip.style.left = `${Math.round(left)}px`;
        tooltip.style.top = `${Math.round(top)}px`;
    }

    function hide(trigger = activeTrigger) {
        if (trigger && activeTrigger && trigger !== activeTrigger) return;
        const tooltip = document.getElementById(TOOLTIP_ID);
        if (!tooltip) return;

        window.clearTimeout(hideTimer);
        tooltip.classList.remove("is-visible");
        restoreDescribedBy(activeTrigger);
        activeTrigger = null;
        hideTimer = window.setTimeout(() => {
            if (!tooltip.classList.contains("is-visible")) tooltip.hidden = true;
        }, 150);
    }

    function show(trigger, options = {}) {
        if (!(trigger instanceof Element)) return null;
        const sidebar = trigger.closest(".sidebar, .chatbot-sidebar");
        // 문서 전체 바인딩에서도 사이드바의 표시 조건을 동일하게 적용한다.
        const isCollapsed = sidebar?.matches(".chatbot-sidebar") ? sidebar.closest(".chatbot-app")?.classList.contains("is-sidebar-collapsed") : sidebar?.classList.contains("collapsed");
        // Start: 261022 수정 - 펼친 사이드바 모드 툴팁 허용
        if (sidebar && !isCollapsed && !trigger.closest(".nav-mode, .sidebar-collapse-btn")) {
            hide();
            return null;
        }
        // End: 261022 수정 - 펼친 사이드바 모드 툴팁 허용
        if (typeof options.enabled === "function" && !options.enabled(trigger)) {
            hide();
            return null;
        }

        const content = String(resolveContent(trigger, options) ?? "").trim();
        if (!content) return null;

        const tooltip = ensureTooltip();
        window.clearTimeout(hideTimer);
        if (activeTrigger && activeTrigger !== trigger) restoreDescribedBy(activeTrigger);
        activeTrigger = trigger;
        tooltip.textContent = content;
        tooltip.hidden = false;
        tooltip.style.visibility = "hidden";
        tooltip.classList.remove("is-visible");
        setDescribedBy(trigger, tooltip);
        positionTooltip(tooltip, trigger, Number.isFinite(Number(options.gap)) ? Math.max(0, Number(options.gap)) : DEFAULT_GAP);
        tooltip.style.visibility = "";
        window.requestAnimationFrame(() => {
            if (activeTrigger === trigger) tooltip.classList.add("is-visible");
        });
        return tooltip;
    }

    function bind(root = document, options = {}) {
        if (!(root instanceof Document || root instanceof Element)) return null;
        if (boundRoots.has(root)) return boundRoots.get(root);

        const selector = options.selector || "[data-tooltip]";
        const getTrigger = (target) => {
            const trigger = target instanceof Element ? target.closest(selector) : null;
            if (!trigger) return null;
            return root instanceof Document || root.contains(trigger) ? trigger : null;
        };
        const handleShow = (event) => {
            const trigger = getTrigger(event.target);
            if (trigger) show(trigger, options);
        };
        const handleMouseOut = (event) => {
            const trigger = getTrigger(event.target);
            if (!trigger || trigger.contains(event.relatedTarget)) return;
            hide(trigger);
        };
        const handleFocusOut = (event) => {
            const trigger = getTrigger(event.target);
            if (!trigger || trigger.contains(event.relatedTarget)) return;
            hide(trigger);
        };

        root.addEventListener("mouseover", handleShow);
        root.addEventListener("mouseout", handleMouseOut);
        root.addEventListener("focusin", handleShow);
        root.addEventListener("focusout", handleFocusOut);

        const binding = Object.freeze({
            destroy() {
                root.removeEventListener("mouseover", handleShow);
                root.removeEventListener("mouseout", handleMouseOut);
                root.removeEventListener("focusin", handleShow);
                root.removeEventListener("focusout", handleFocusOut);
                boundRoots.delete(root);
                hide();
            },
        });
        boundRoots.set(root, binding);
        return binding;
    }

    // Start: 261021 추가 - 파일명 공통 툴팁 자동 연결 및 동적 갱신
    // 파일명을 만드는 기존 렌더러는 유지하고, 새 목록/미리보기 제목에도 공통 툴팁을 적용한다.
    const fileNameSelector = ".file-name:not(.sub-badge), .file-name-simple, .source-search-result-name, .source-search-all-name, .selected-refs-list .ref-name, .work-search-file .work-source strong";
    function syncFileTooltips(root) {
        if (!(root instanceof Element)) return;
        const titled = [...root.querySelectorAll("[title]")];
        if (root.hasAttribute("title")) titled.unshift(root);
        titled.forEach((element) => {
            const label = element.getAttribute("title");
            if (label) element.dataset.tooltip = label;
            element.removeAttribute("title");
        });
        const iconButtons = [...root.querySelectorAll("button.icon-button[aria-label]:not([data-tooltip])")];
        if (root.matches("button.icon-button[aria-label]:not([data-tooltip])")) iconButtons.unshift(root);
        iconButtons.forEach((button) => {
            button.dataset.tooltip = button.getAttribute("aria-label");
        });
        const names = [...root.querySelectorAll(fileNameSelector)];
        if (root.matches(fileNameSelector)) names.unshift(root);
        names.forEach((name) => {
            if (name.closest("[data-apply-references], .sub-badge")) return;
            const title = name.textContent.trim();
            if (!title) {
                delete name.dataset.tooltip;
                delete name.dataset.tooltipAuto;
                return;
            }
            name.dataset.tooltip = title;
            name.dataset.tooltipAuto = "";
            name.dataset.tooltipPlacement = "bottom";
            name.removeAttribute("title");
            const row = name.closest(".file-item-main, .file-item-simple, li");
            row?.querySelectorAll(".file-icon-collapsed").forEach((icon) => {
                icon.dataset.tooltip = title;
                icon.dataset.tooltipPlacement = "right";
            });
            name.closest(".file-item-main, .file-item-simple")?.removeAttribute("title");
        });
    }
    let fileTooltipsReady = false;
    function initFileTooltips() {
        if (fileTooltipsReady || !document.body) return;
        fileTooltipsReady = true;
        syncFileTooltips(document.body);
        new MutationObserver((records) => {
            const roots = new Set();
            records.forEach((record) => {
                roots.add(record.target.nodeType === Node.TEXT_NODE ? record.target.parentElement : record.target);
            });
            roots.forEach(syncFileTooltips);
        }).observe(document.body, { childList: true, characterData: true, attributes: true, attributeFilter: ["title"], subtree: true });
    }

    // End: 261021 추가 - 파일명 공통 툴팁 자동 연결 및 동적 갱신

    function init(root = document) {
        // Start: 261021 추가 - 파일명 툴팁 초기화 연결
        initFileTooltips();
        // End: 261021 추가 - 파일명 툴팁 초기화 연결
        return bind(root, { selector: "[data-tooltip]" });
    }

    window.AIOneTooltip = Object.freeze({ bind, hide, init, show });
    window.addEventListener("resize", () => hide(), { passive: true });
    document.addEventListener("scroll", () => hide(), true);
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") hide();
    });

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => init(), { once: true });
    } else {
        init();
    }
})();

/* End: 툴팁 (Tooltip) */

/* Start: 드롭다운 메뉴 (Dropdown Menu) */

(() => {
    function getEnabledItems(menu) {
        return Array.from(menu.querySelectorAll('[role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"]')).filter((item) => !item.disabled && item.getAttribute("aria-disabled") !== "true");
    }

    function setOpen(component, isOpen, focusTarget = "first") {
        const trigger = component?.querySelector("[data-dropdown-trigger]");
        const menu = component?.querySelector('[role="menu"]');
        if (!trigger || !menu) return;

        if (isOpen) {
            document.querySelectorAll("[data-dropdown-menu]").forEach((other) => {
                if (other !== component) setOpen(other, false);
            });
        }

        menu.hidden = !isOpen;
        trigger.setAttribute("aria-expanded", String(isOpen));
        component.classList.toggle("is-open", isOpen);

        if (isOpen && focusTarget !== "none") {
            const items = getEnabledItems(menu);
            const focusItem = focusTarget === "last" ? items.at(-1) : items[0];
            focusItem?.focus();
        }

        component.dispatchEvent(
            new CustomEvent("dropdownmenu:toggle", {
                bubbles: true,
                detail: { open: isOpen },
            }),
        );
    }

    function init(root = document) {
        const components = [];
        if (root instanceof Element && root.matches("[data-dropdown-menu]")) components.push(root);
        root.querySelectorAll?.("[data-dropdown-menu]").forEach((component) => components.push(component));

        components.forEach((component) => {
            if (component.dataset.dropdownMenuReady === "true") return;
            const trigger = component.querySelector("[data-dropdown-trigger]");
            const menu = component.querySelector('[role="menu"]');
            if (!trigger || !menu) return;

            menu.hidden = trigger.getAttribute("aria-expanded") !== "true";
            component.dataset.dropdownMenuReady = "true";
        });

        if (document.documentElement.dataset.dropdownMenuEventsReady === "true") return;

        document.addEventListener("click", (event) => {
            const trigger = event.target.closest("[data-dropdown-trigger]");
            const triggerComponent = trigger?.closest("[data-dropdown-menu]");
            if (trigger && triggerComponent) {
                const isOpen = trigger.getAttribute("aria-expanded") === "true";
                setOpen(triggerComponent, !isOpen);
                return;
            }

            const item = event.target.closest('[role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"]');
            const itemComponent = item?.closest("[data-dropdown-menu]");
            if (item && itemComponent) {
                if (item.disabled || item.getAttribute("aria-disabled") === "true") return;
                if (item.matches('[role="menuitemradio"]')) {
                    item.closest('[role="menu"]')
                        ?.querySelectorAll('[role="menuitemradio"]')
                        .forEach((option) => option.setAttribute("aria-checked", String(option === item)));
                    const label = item.closest('[role="menu"]') === itemComponent.querySelector('[role="menu"]') ? itemComponent.querySelector("[data-dropdown-label]") : null;
                    if (label) label.textContent = item.dataset.menuLabel || item.textContent.trim();
                }
                if (item.matches('[role="menuitemcheckbox"]')) {
                    item.setAttribute("aria-checked", String(item.getAttribute("aria-checked") !== "true"));
                }
                itemComponent.dispatchEvent(
                    new CustomEvent("dropdownmenu:select", {
                        bubbles: true,
                        detail: {
                            value: item.dataset.menuValue || item.textContent.trim(),
                            item,
                        },
                    }),
                );
                if (!item.hasAttribute("data-menu-keep-open")) {
                    setOpen(itemComponent, false);
                    itemComponent.querySelector("[data-dropdown-trigger]")?.focus();
                }
                return;
            }

            document.querySelectorAll("[data-dropdown-menu].is-open").forEach((component) => setOpen(component, false));
        });

        document.addEventListener("keydown", (event) => {
            const trigger = event.target.closest("[data-dropdown-trigger]");
            const component = event.target.closest("[data-dropdown-menu]");
            if (!component) return;
            const menu = event.target.closest('[role="menu"]') || component.querySelector('[role="menu"]');
            if (!menu) return;

            if (trigger && ["ArrowDown", "ArrowUp"].includes(event.key)) {
                event.preventDefault();
                setOpen(component, true, event.key === "ArrowUp" ? "last" : "first");
                return;
            }

            const items = getEnabledItems(menu);
            const currentIndex = items.indexOf(document.activeElement);
            if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) && currentIndex >= 0) {
                event.preventDefault();
                let nextIndex = currentIndex;
                if (event.key === "ArrowDown") nextIndex = (currentIndex + 1) % items.length;
                if (event.key === "ArrowUp") nextIndex = (currentIndex - 1 + items.length) % items.length;
                if (event.key === "Home") nextIndex = 0;
                if (event.key === "End") nextIndex = items.length - 1;
                items[nextIndex]?.focus();
            }
            if (event.key === "Escape") {
                event.preventDefault();
                setOpen(component, false);
                component.querySelector("[data-dropdown-trigger]")?.focus();
            }
        });

        document.documentElement.dataset.dropdownMenuEventsReady = "true";
    }

    window.AIOneDropdownMenu = Object.freeze({ init, setOpen });
    document.addEventListener("DOMContentLoaded", () => init());
    document.addEventListener("app:includes-ready", (event) => init(event.target));
})();

/* End: 드롭다운 메뉴 (Dropdown Menu) */

/* Start: 261023 추가 - 모달·drawer 공통 닫기 버튼 */
(() => {
    // 기존 ID·data-*·전용 이벤트는 유지한다. 배경·취소·확인 버튼은 대상에서 제외한다.
    const selector = [
        "button.query-edit-modal-close",
        "button.history-modal-close",
        "button.service-notice-close",
        "button.chat-issue-close",
        "button.answer-new-chat-notice-close",
        "button.icon-button[data-modal-close]",
        "button.icon-button[data-sidepop-close]",
        "button.icon-button[data-drawer-close]",
    ].join(",");

    function init(root = document) {
        const buttons = [];
        if (root instanceof Element && root.matches(selector)) buttons.push(root);
        root.querySelectorAll?.(selector).forEach((button) => buttons.push(button));
        buttons.forEach((button) => {
            button.classList.add("drawer-close");
            // 이전 모달 클래스의 페이지별 20px 덮어쓰기를 제거한다.
            button.classList.remove("query-edit-modal-close", "icon-button", "icon-button-ghost");
        });
    }

    function start() {
        init();
        // 동적으로 생성되는 담당자 설정 drawer 및 모달에도 같은 스타일을 적용한다.
        new MutationObserver((records) => {
            records.forEach((record) =>
                record.addedNodes.forEach((node) => {
                    if (node instanceof Element) init(node);
                }),
            );
        }).observe(document.body, { childList: true, subtree: true });
    }

    window.AIOneCloseButton = Object.freeze({ init });
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start, { once: true });
    } else {
        start();
    }
})();
/* End: 261023 추가 - 모달·drawer 공통 닫기 버튼 */

/* Start: 모달 (Modal) */

(() => {
    const MENU_GAP = 10;
    const VIEWPORT_MARGIN = 16;
    const PREPARING_SERVICE_MODAL_ID = "preparingServiceModal";
    const DEFAULT_PREPARING_SERVICE_MESSAGE = "해당 서비스는 준비 중 입니다.";
    const CHATBOT_PREPARING_SERVICE_MESSAGE = ["해당 서비스는 준비 중 입니다."];
    const CHATBOT_PROTOTYPE_PATH = "ai-chatbot.html";
    const menuAnchors = new WeakMap();
    const baseController = window.AIOneLayerFactory.create({
        type: "modal",
        layerSelector: "[data-modal]",
        openAttribute: "data-modal-open",
        closeAttribute: "data-modal-close",
        closeOnLayerClick: true,
        focusOnOpen: false,
    });

    function ensurePreparingServiceModal() {
        return document.getElementById(PREPARING_SERVICE_MODAL_ID);
    }

    function preparePreparingServiceModal(layer, trigger) {
        if (layer?.id !== PREPARING_SERVICE_MODAL_ID) return;

        const description = layer.querySelector('[data-slot="description"]');
        const confirmButton = layer.querySelector(".btn-confirm[data-modal-close]");
        const isChatbotTrigger = trigger?.dataset.page === "chatbot";
        if (!description || !confirmButton) return;

        if (isChatbotTrigger) {
            description.replaceChildren(CHATBOT_PREPARING_SERVICE_MESSAGE[0]);
            //description.replaceChildren(CHATBOT_PREPARING_SERVICE_MESSAGE[0], document.createElement("br"), CHATBOT_PREPARING_SERVICE_MESSAGE[1]);
            //confirmButton.dataset.navigateTo = new URL(CHATBOT_PROTOTYPE_PATH, document.baseURI).href;
            return;
        }

        description.textContent = DEFAULT_PREPARING_SERVICE_MESSAGE;
        delete confirmButton.dataset.navigateTo;
    }

    function resolveLayer(target) {
        if (target instanceof Element) return target;
        if (typeof target === "string") return document.querySelector(target);
        return null;
    }

    function isActionMenu(layer) {
        return layer?.classList.contains("modal-menu-backdrop") && Boolean(layer.querySelector(".modal-contents.modal-small"));
    }

    function positionActionMenu(layer, trigger) {
        if (!isActionMenu(layer) || !(trigger instanceof Element)) return;

        const dialog = layer.querySelector(".modal-contents.modal-small");
        const triggerRect = trigger.getBoundingClientRect();
        const dialogRect = dialog.getBoundingClientRect();
        const maxLeft = window.innerWidth - dialogRect.width - VIEWPORT_MARGIN;
        const maxTop = window.innerHeight - dialogRect.height - VIEWPORT_MARGIN;
        const belowPosition = triggerRect.bottom + MENU_GAP;
        const abovePosition = triggerRect.top - dialogRect.height - MENU_GAP;
        const left = Math.min(Math.max(VIEWPORT_MARGIN, triggerRect.right - dialogRect.width), Math.max(VIEWPORT_MARGIN, maxLeft));
        const top = belowPosition <= maxTop ? belowPosition : Math.max(VIEWPORT_MARGIN, abovePosition);

        layer.style.setProperty("--modal-menu-left", `${Math.round(left)}px`);
        layer.style.setProperty("--modal-menu-top", `${Math.round(top)}px`);
        layer.classList.add("is-anchored");
        menuAnchors.set(layer, trigger);
    }

    function repositionOpenMenus() {
        document.querySelectorAll(".modal.modal-menu-backdrop:not(.hidden):not([hidden])").forEach((layer) => {
            const trigger = menuAnchors.get(layer);
            if (trigger?.isConnected) positionActionMenu(layer, trigger);
        });
    }

    const controller = Object.freeze({
        init(root = document) {
            ensurePreparingServiceModal();
            baseController.init(root);
        },
        open(target, trigger = null) {
            const layer = resolveLayer(target);
            preparePreparingServiceModal(layer, trigger);
            baseController.open(layer, trigger);
            if (trigger) positionActionMenu(layer, trigger);
        },
        close: baseController.close,
        ensurePreparingServiceModal,
    });

    window.AIOneModal = controller;
    document.addEventListener("DOMContentLoaded", () => controller.init());
    document.addEventListener("app:includes-ready", (event) => controller.init(event.target));
    document.addEventListener("click", (event) => {
        const trigger = event.target.closest("[data-modal-open]");
        if (!trigger) return;

        const layer = document.getElementById(trigger.getAttribute("data-modal-open"));
        preparePreparingServiceModal(layer, trigger);
        if (isActionMenu(layer)) positionActionMenu(layer, trigger);
    });
    document.addEventListener("click", (event) => {
        const confirmButton = event.target.closest(`#${PREPARING_SERVICE_MODAL_ID} .btn-confirm[data-navigate-to]`);
        if (!confirmButton) return;
        window.location.assign(confirmButton.dataset.navigateTo);
    });
    document.addEventListener("modal:close", (event) => {
        if (!isActionMenu(event.target)) return;
        menuAnchors.delete(event.target);
        event.target.classList.remove("is-anchored");
    });
    window.addEventListener("resize", repositionOpenMenus);
    document.addEventListener("scroll", repositionOpenMenus, true);
})();

(() => {
    function resolveLayer(target) {
        if (target instanceof Element) return target;
        if (typeof target === "string") return document.querySelector(target);
        return null;
    }

    function getVariant(layer) {
        return layer?.querySelector(".modal-contents[data-modal-variant]")?.getAttribute("data-modal-variant") || "";
    }

    function resolveUserCard(source, layer) {
        if (source instanceof Element) {
            if (source.matches(".user-card")) return source;
            const sourceCard = source.closest(".user-card");
            if (sourceCard) return sourceCard;
            const nestedCard = source.querySelector?.(".user-card");
            if (nestedCard) return nestedCard;
        }
        return layer?.closest(".app-sidebar, .sidebar")?.querySelector(".user-card") || null;
    }

    function getProfileValue(card, selector, fallback) {
        return card?.querySelector(selector)?.textContent?.trim() || fallback;
    }

    function syncProfile(target, source = null) {
        const layer = resolveLayer(target);
        if (!layer || getVariant(layer) !== "account-profile") return;

        const card = resolveUserCard(source, layer);
        const profile = {
            name: document.querySelector("[data-account-profile-name]")?.textContent?.trim() || getProfileValue(card, ".user-name, .user-name-sm", ""),
            department: getProfileValue(card, ".user-dept", ""),
            role: getProfileValue(card, ".user-role-badge", "국회담당자"),
        };

        layer.querySelectorAll("[data-account-profile-name]").forEach((element) => {
            element.textContent = profile.name;
        });
        layer.querySelectorAll("[data-account-profile-dept]").forEach((element) => {
            element.textContent = profile.department;
        });
        layer.querySelectorAll("[data-account-profile-role]").forEach((element) => {
            element.textContent = profile.role;
        });
    }

    function initSettings(layer) {
        if (getVariant(layer) !== "account-settings") return;
        window.AIOnePreferences?.init(layer);
    }

    function prepare(target, source = null) {
        const layer = resolveLayer(target);
        if (!layer) return;

        const variant = getVariant(layer);
        if (variant === "account-profile") syncProfile(layer, source);
        if (variant === "account-settings") initSettings(layer);
    }

    function bindLayer(layer) {
        const variant = getVariant(layer);
        if (!["account-profile", "account-settings"].includes(variant)) return;
        if (layer.dataset.accountModalReady === "true") {
            prepare(layer);
            return;
        }

        layer.dataset.accountModalReady = "true";
        layer.addEventListener("modal:open", () => prepare(layer));
        prepare(layer);
    }

    function init(root = document) {
        if (root instanceof Element && root.matches("[data-modal]")) bindLayer(root);
        root.querySelectorAll?.("[data-modal]").forEach(bindLayer);
    }

    window.AIOneAccountModal = Object.freeze({
        init,
        prepare,
        syncProfile,
    });

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => init(), { once: true });
    } else {
        init();
    }

    document.addEventListener("app:includes-ready", (event) => init(event.target));
    document.addEventListener("component:ready", (event) => {
        if (event.detail?.name === "modal") init(event.target);
    });
    document.addEventListener("ai-one-preferences:ready", () => init());
})();

/* End: 모달 (Modal) */

/* Start: 사이드바 (Sidebar) */

(() => {
    const MENU_COMPLETION_KEY = "ai-one-menu-completion-state";
    const SIDEBAR_SELECTOR = ".app-sidebar, .sidebar";
    const RESPONSIVE_RAIL_QUERY = "(max-width: 1024px)";
    let pendingModalRequest = null;
    let collapsedHomeNavigationReady = false;
    let menuCompletionState = readMenuCompletionState();
    const accountMenuStates = new WeakMap();
    const sidebarControllerStates = new WeakMap();

    // 사이드바 메뉴 작업 완료 상태
    function readMenuCompletionState() {
        try {
            const saved = JSON.parse(localStorage.getItem(MENU_COMPLETION_KEY) || "{}");
            return saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
        } catch (error) {
            return {};
        }
    }

    function persistMenuCompletionState() {
        try {
            localStorage.setItem(MENU_COMPLETION_KEY, JSON.stringify(menuCompletionState));
        } catch (error) {
            /* 현재 화면에만 적용 */
        }
    }

    function resolveMenuKeyFromLink(link) {
        if (!link) return "";
        if (link.dataset.page) return link.dataset.page;

        const href = link.getAttribute("href") || "";
        if (href.includes("ai-intake")) return "intake";
        if (href.includes("ai-answer")) return "answer";
        if (href.includes("ai-chatbot")) return "chatbot";
        if (href.includes("ai-economy")) return "economy";
        if (href.includes("ai-home")) return "home";
        return "";
    }

    function getNavLinks(root = document) {
        if (root instanceof Element && root.matches(SIDEBAR_SELECTOR)) {
            return Array.from(root.querySelectorAll(".nav-link"));
        }

        return Array.from(root.querySelectorAll?.(".app-sidebar .nav-link, .sidebar .nav-link") || []);
    }

    function isNotificationEnabled() {
        return window.AIOneNotifications?.isEnabled?.() ?? true;
    }

    function renderCompletionDots(root = document) {
        getNavLinks(root).forEach((link) => {
            const menuKey = resolveMenuKeyFromLink(link);
            if (!menuKey) return;

            let dot = link.querySelector(".nav-complete-dot");
            if (!dot) return;

            const isVisible = isNotificationEnabled() && Boolean(menuCompletionState[menuKey]);
            dot.classList.toggle("hidden", !isVisible);
            link.classList.toggle("has-complete-status", isVisible);

            if (link.dataset.completionBound === "true") return;
            link.dataset.completionBound = "true";
            link.addEventListener("click", () => {
                const key = resolveMenuKeyFromLink(link);
                if (!key || !menuCompletionState[key]) return;

                delete menuCompletionState[key];
                persistMenuCompletionState();
                renderCompletionDots();
            });
        });
    }

    function markCompletion(menuKey) {
        if (!isNotificationEnabled() || !menuKey) return;

        menuCompletionState[menuKey] = { completedAt: Date.now() };
        persistMenuCompletionState();
        renderCompletionDots();
    }

    function clearCompletion() {
        menuCompletionState = {};
        persistMenuCompletionState();
        renderCompletionDots();
    }

    // 축소 사이드바에서 홈 메뉴로 이동할 때 접힘 상태 해제
    function initCollapsedHomeNavigation() {
        if (collapsedHomeNavigationReady) return;
        collapsedHomeNavigationReady = true;

        document.addEventListener(
            "click",
            (event) => {
                const homeLink = event.target.closest('.app-sidebar .nav-link[data-page="home"], .sidebar .nav-link[data-page="home"]');
                if (!homeLink) return;

                const sidebar = homeLink.closest(SIDEBAR_SELECTOR);
                if (!sidebar?.classList.contains("collapsed")) return;

                setSidebarCollapsed(sidebar, false);
                window.AIOneTooltip?.hide();
            },
            true,
        );
    }

    // SSO 로그아웃 처리 URL (SsoController#logout 대응)
    // ★ SSO 사(연동사) 안내: Single Logout(SLO)을 쓰려면 클라이언트는 /sso/Logout.do 만
    //   호출하면 된다. /sso/LogoutEx.do 는 SLO 프로세스 흐름 안에서 자동으로 호출되는
    //   페이지라 별도로 호출할 필요가 없다(과거에는 세션 공유 사이트로의 수동 전파를 위해
    //   LogoutEx.do + others 파라미터를 직접 호출하도록 만들어져 있었으나, 더 이상 필요 없음).
    const SSO_LOGOUT_PATH = "/sso/Logout.do";
    const SSO_LOGOUT_DEBUG_PREFIX = "[SSO][Logout.do]";

    // 개발환경에서는 SSO 연동(Logout.do) 대신 일반 로그아웃(ND_processLogout.do)을 사용한다.
    // (SSO Agent 가 없거나 IdP 연동이 안 된 로컬/개발 환경에서 Logout.do 를 호출하면
    //  SSOConfig.setHomeDir/SSOInit.initialize() 단계에서 실패하기 쉽기 때문)
    const GENERAL_LOGOUT_PATH = "/login/ND_processLogout.do";

    // 환경 판별 우선순위:
    //   1) logout({ mode: "development" | "production" }) 처럼 호출 시 명시적으로 넘긴 값
    //   2) 페이지에서 미리 선언한 전역 변수 window.AIONE_SSO_ENV ("development" | "production")
    //      (예: JSP 의 CTX_PATH 선언 옆에 <script>var AIONE_SSO_ENV = "production";</script> 추가)
    //   3) 위 두 가지가 없으면 호스트명으로 추정(localhost/127.0.0.1/사설망/‘dev’류 키워드 = 개발)
    // ★ 운영 배포 시 호스트명 추정만으로 불안하면, 2)번처럼 서버에서 명시적으로 값을 내려주는 것을 권장한다.
    const DEV_HOSTNAME_PATTERN = /^(localhost|127(?:\.\d+){3}|0\.0\.0\.0|::1|.*\.local)$/i;
    const DEV_HOSTNAME_KEYWORD_PATTERN = /(^|[.-])(dev|local|test|stg|stage|sandbox)([.-]|$)/i;

    function isDevEnvironment(options = {}) {
        if (typeof options.mode === "string") return options.mode.trim().toLowerCase() !== "production";
        if (typeof window.AIONE_SSO_ENV === "string") return window.AIONE_SSO_ENV.trim().toLowerCase() !== "production";

        const host = window.location.hostname || "";
        return DEV_HOSTNAME_PATTERN.test(host) || DEV_HOSTNAME_KEYWORD_PATTERN.test(host);
    }

    // /sso/Logout.do 호출 URL 조립. SsoController#logout() 이 실제로 읽는 파라미터만 사용한다.
    //  - dup : 중복 로그인 등 부가 정보 (선택, 필요할 때만 전달)
    //  - slo : "n" 이면 SP(현재 업무시스템)만 로그아웃, 그 외(기본값)에는 IdP까지 SLO 전파
    function buildLogoutUrl(options = {}) {
        const contextPath = typeof window.CTX_PATH === "string" ? window.CTX_PATH : "";
        const params = new URLSearchParams();

        if (options.dup) params.set("dup", options.dup);
        if (options.slo) params.set("slo", options.slo);

        const query = params.toString();
        const url = `${contextPath}${SSO_LOGOUT_PATH}${query ? `?${query}` : ""}`;

        console.debug(`${SSO_LOGOUT_DEBUG_PREFIX} 호출 URL:`, url);

        return url;
    }

    function logout(options = {}) {
        console.debug(`${SSO_LOGOUT_DEBUG_PREFIX} 로그아웃 실행 시작`, options || {});
        try {
            localStorage.removeItem("sidebar-collapsed");
        } catch (error) {
            /* 현재 화면 상태만 정리 */
        }

        if (window.AIOnePreview?.enabled) {
            window.location.href = window.AIOnePreview.loginUrl;
            return;
        }

        if (isDevEnvironment(options)) {
            const contextPath = typeof window.CTX_PATH === "string" ? window.CTX_PATH : "";
            const generalLogoutUrl = `${contextPath}${GENERAL_LOGOUT_PATH}`;
            console.debug(`${SSO_LOGOUT_DEBUG_PREFIX} 개발환경으로 판단 → 일반 로그아웃(ND_processLogout.do) 처리:`, generalLogoutUrl);
            window.location.href = generalLogoutUrl;
            return;
        }

        console.debug(`${SSO_LOGOUT_DEBUG_PREFIX} 운영환경으로 판단 → SSO Logout.do 호출`);
        const logoutUrl = buildLogoutUrl(options);
        console.debug(`${SSO_LOGOUT_DEBUG_PREFIX} 페이지 이동:`, logoutUrl);
        window.location.href = logoutUrl;
    }

    // 사용자 계정 메뉴와 연결된 모달
    function positionDetachedAccountMenu(state) {
        if (!state?.isDetached || !state.userCard || state.menu.hidden) return;

        const viewportGap = 8;
        const menuGap = 8;
        const anchorRect = state.userCard.getBoundingClientRect();
        const menuRect = state.menu.getBoundingClientRect();
        const maxLeft = Math.max(viewportGap, window.innerWidth - menuRect.width - viewportGap);
        const left = Math.max(viewportGap, Math.min(anchorRect.left, maxLeft));
        const preferredTop = anchorRect.top - menuRect.height - menuGap;
        const fallbackTop = anchorRect.bottom + menuGap;
        const maxTop = Math.max(viewportGap, window.innerHeight - menuRect.height - viewportGap);
        const top = preferredTop >= viewportGap ? preferredTop : Math.min(fallbackTop, maxTop);

        state.menu.style.left = `${Math.round(left)}px`;
        state.menu.style.top = `${Math.round(Math.max(viewportGap, top))}px`;
    }

    function setAccountMenuOpen(sidebar, isOpen, trigger = null, options = {}) {
        const state = accountMenuStates.get(sidebar);
        if (!state) return;

        state.menu.hidden = !isOpen;
        state.menu.classList.toggle("hidden", !isOpen);
        state.triggers.forEach((item) => item.setAttribute("aria-expanded", String(isOpen)));
        if (isOpen) {
            state.openMode = options.mode || "programmatic";
            if (trigger) state.lastTrigger = trigger;
            positionDetachedAccountMenu(state);
            if (options.focusFirst) {
                window.requestAnimationFrame(() => state.menu.querySelector('[role="menuitem"]')?.focus());
            }
        } else {
            state.openMode = null;
        }
    }

    function openModal(trigger) {
        const targetId = trigger?.getAttribute("data-modal-open");
        const modal = targetId ? document.getElementById(targetId) : null;
        const sidebar = trigger?.closest(SIDEBAR_SELECTOR);
        if (sidebar) setAccountMenuOpen(sidebar, false);
        if (!modal || !window.AIOneModal) {
            pendingModalRequest = targetId ? { targetId, trigger } : null;
            return false;
        }

        pendingModalRequest = null;
        window.AIOneAccountModal?.prepare(modal, sidebar || trigger);
        window.AIOneModal.open(modal, trigger);
        return true;
    }

    function flushPendingModalRequest() {
        if (!pendingModalRequest) return;
        if (!pendingModalRequest.trigger?.isConnected) {
            pendingModalRequest = null;
            return;
        }
        openModal(pendingModalRequest.trigger);
    }

    function bindAccountMenu(sidebar) {
        if (!sidebar || accountMenuStates.has(sidebar)) return;
        const menu = sidebar.querySelector(".user-account-menu");
        const triggers = Array.from(sidebar.querySelectorAll("[data-sidebar-account-toggle]"));
        if (!menu || !triggers.length) return;

        const nestedUserCard = menu.closest(".user-card");
        const userCard = nestedUserCard || sidebar.querySelector(".user-card, .chatbot-user");
        const isDetached = menu.dataset.sidebarAccountMenu === "detached" || !nestedUserCard;
        const state = {
            menu,
            triggers,
            lastTrigger: null,
            userCard,
            isDetached,
            openMode: null,
        };

        menu.classList.toggle("user-account-menu-detached", isDetached);
        accountMenuStates.set(sidebar, state);

        if (userCard) {
            userCard.dataset.accountMenuReady = "true";
            const summaryName = menu.querySelector(".user-account-summary strong");
            const summaryDepartment = menu.querySelector(".user-account-summary span");
            if (summaryName) {
                summaryName.textContent = userCard.querySelector(".user-name, .user-name-sm")?.textContent?.trim() || summaryName.textContent;
            }
            if (summaryDepartment) {
                summaryDepartment.textContent = userCard.querySelector(".user-dept")?.textContent?.trim() || summaryDepartment.textContent;
            }
        }

        triggers.forEach((trigger) => {
            trigger.addEventListener("click", (event) => {
                event.preventDefault();
                event.stopPropagation();
                const shouldOpen = menu.hidden;
                setAccountMenuOpen(sidebar, shouldOpen, trigger, {
                    mode: "click",
                    focusFirst: shouldOpen,
                });
            });
        });

        menu.addEventListener("click", (event) => {
            const actionButton = event.target.closest("[data-sidebar-account-action]");
            if (!actionButton) return;

            event.preventDefault();
            event.stopPropagation();
            setAccountMenuOpen(sidebar, false);
            if (actionButton.hasAttribute("data-modal-open")) openModal(actionButton);
        });

        document.addEventListener("click", (event) => {
            if (event.target.closest(".user-account-menu, [data-sidebar-account-toggle]")) return;
            setAccountMenuOpen(sidebar, false);
        });

        document.addEventListener("keydown", (event) => {
            if (event.key !== "Escape" || menu.hidden) return;
            setAccountMenuOpen(sidebar, false);
            state.lastTrigger?.focus();
        });

        const reposition = () => {
            if (!menu.hidden) positionDetachedAccountMenu(state);
        };
        window.addEventListener("resize", reposition);
        document.addEventListener("scroll", reposition, true);
    }

    // Start: 261022 수정 - 사이드바 모드 툴팁 바인딩 조건
    // 모드 전환은 항상, 일반 메뉴는 축소 상태에서 툴팁을 표시한다.
    function bindNavTooltips(sidebar) {
        if (!sidebar || sidebar.dataset.navTooltipsReady === "true" || !window.AIOneTooltip) return;

        window.AIOneTooltip.bind(sidebar, {
            selector: ".nav-link",
            placement: "bottom",
            enabled: (link) => !!link.closest(".nav-mode") || sidebar.classList.contains("collapsed"),
            content: (link) => link.dataset.tooltip || link.querySelector(".nav-text")?.textContent?.trim() || link.getAttribute("aria-label"),
        });
        sidebar.dataset.navTooltipsReady = "true";
    }
    // End: 261022 수정 - 사이드바 모드 툴팁 바인딩 조건

    function setActiveSidebarRoute(sidebar, activePage) {
        if (!activePage) return;

        sidebar.querySelectorAll(".nav-link").forEach((link) => {
            if (link.closest(".nav-mode")) return;
            const isActive = link.dataset.page === activePage;
            link.classList.toggle("active", isActive);
            if (isActive) link.setAttribute("aria-current", "page");
            else link.removeAttribute("aria-current");
        });
    }

    function readSidebarCollapsedState(storageKey, fallback) {
        if (!storageKey) return fallback;
        try {
            return localStorage.getItem(storageKey) === "true" ? true : fallback;
        } catch (error) {
            return fallback;
        }
    }

    function persistSidebarCollapsedState(storageKey, isCollapsed) {
        if (!storageKey) return;
        try {
            if (isCollapsed) localStorage.setItem(storageKey, "true");
            else localStorage.removeItem(storageKey);
        } catch (error) {
            /* 저장소를 사용할 수 없어도 현재 화면의 상태 변경은 유지 */
        }
    }

    function syncSidebarResponsiveRail(sidebar) {
        const state = sidebarControllerStates.get(sidebar);
        if (!state?.responsiveMediaQuery) return;

        const shouldUseRail = state.config.responsiveRail !== false && state.responsiveMediaQuery.matches;

        if (shouldUseRail) {
            if (!state.responsiveRailActive) {
                state.desktopCollapsed = sidebar.classList.contains("collapsed");
            }
            state.responsiveRailActive = true;
            sidebar.dataset.sidebarResponsiveRail = "true";
            setSidebarResponsiveCollapsed(sidebar, true);
            return;
        }

        delete sidebar.dataset.sidebarResponsiveRail;
        if (!state.responsiveRailActive) return;

        state.responsiveRailActive = false;
        setSidebarResponsiveCollapsed(sidebar, Boolean(state.desktopCollapsed));
    }

    function setSidebarResponsiveCollapsed(sidebar, collapsed) {
        const state = sidebarControllerStates.get(sidebar);
        const transitionTarget = state?.config?.stateTarget || sidebar;

        if (!(transitionTarget instanceof Element)) {
            setSidebarCollapsed(sidebar, collapsed, { persist: false });
            return;
        }

        if (state.responsiveSyncFrame) window.cancelAnimationFrame(state.responsiveSyncFrame);
        transitionTarget.dataset.sidebarResponsiveSync = "true";
        setSidebarCollapsed(sidebar, collapsed, { persist: false });
        transitionTarget.getBoundingClientRect();
        transitionTarget.nextElementSibling?.getBoundingClientRect();
        state.responsiveSyncFrame = window.requestAnimationFrame(() => {
            delete transitionTarget.dataset.sidebarResponsiveSync;
            state.responsiveSyncFrame = 0;
        });
    }

    function bindSidebarResponsiveRail(sidebar) {
        const state = sidebarControllerStates.get(sidebar);
        if (!state || typeof window.matchMedia !== "function") return;

        const query = state.config.responsiveRailQuery || RESPONSIVE_RAIL_QUERY;
        if (!state.responsiveMediaQuery || state.responsiveMediaQuery.media !== query) {
            if (state.responsiveMediaQuery && state.responsiveMediaListener) {
                state.responsiveMediaQuery.removeEventListener?.("change", state.responsiveMediaListener);
                state.responsiveMediaQuery.removeListener?.(state.responsiveMediaListener);
            }

            state.responsiveMediaQuery = window.matchMedia(query);
            state.responsiveMediaListener = () => syncSidebarResponsiveRail(sidebar);
            state.responsiveMediaQuery.addEventListener?.("change", state.responsiveMediaListener);
            if (!state.responsiveMediaQuery.addEventListener) {
                state.responsiveMediaQuery.addListener?.(state.responsiveMediaListener);
            }
        }

        syncSidebarResponsiveRail(sidebar);
    }

    function setSidebarCollapsed(sidebar, isCollapsed, options = {}) {
        if (typeof sidebar === "string") sidebar = document.querySelector(sidebar);
        if (!sidebar) return false;

        const state = sidebarControllerStates.get(sidebar);
        const collapsed = Boolean(isCollapsed);
        const config = state?.config || {};
        const stateTarget = config.stateTarget;
        if (state && !state.responsiveRailActive) state.desktopCollapsed = collapsed;

        sidebar.classList.toggle("collapsed", collapsed);
        if (stateTarget) {
            if (config.collapsedClass) stateTarget.classList.toggle(config.collapsedClass, collapsed);
            if (config.expandedClass) stateTarget.classList.toggle(config.expandedClass, !collapsed);
        }

        const collapseButton = sidebar.querySelector("#sidebarCollapseBtn");
        if (collapseButton) {
            const label = collapsed ? "사이드바 펼치기" : "사이드바 접기";
            collapseButton.setAttribute("aria-expanded", String(!collapsed));
            collapseButton.setAttribute("aria-label", label);
            collapseButton.title = label;
            collapseButton.setAttribute("data-tooltip", label);
        }

        const brandButton = sidebar.querySelector("#sidebarBrandButton, .sidebar-brand");
        if (brandButton) {
            const label = brandButton.dataset.sidebarBrandAction === "navigate" ? brandButton.dataset.tooltip : collapsed ? "사이드바 펼치기" : "AI-ONE 홈";
            brandButton.setAttribute("aria-label", label);
            brandButton.title = label;
        }

        if (options.persist !== false && !state?.responsiveRailActive) {
            persistSidebarCollapsedState(config.storageKey, collapsed);
        }
        window.AIOneTooltip?.hide();
        config.onChange?.(collapsed, sidebar);
        sidebar.dispatchEvent(
            new CustomEvent("sidebar:collapse-change", {
                bubbles: true,
                detail: { collapsed },
            }),
        );
        return collapsed;
    }

    function configureSidebar(sidebar, options = {}) {
        if (typeof sidebar === "string") sidebar = document.querySelector(sidebar);
        if (!sidebar) return null;

        bindSidebar(sidebar);
        const state = sidebarControllerStates.get(sidebar) || {};
        state.config = {
            activePage: options.activePage || document.body?.dataset.page || "",
            initialCollapsed: options.initialCollapsed ?? sidebar.classList.contains("collapsed"),
            stateTarget: options.stateTarget || null,
            collapsedClass: options.collapsedClass || "",
            expandedClass: options.expandedClass || "",
            storageKey: options.storageKey || "",
            collapseOnNavigate: Boolean(options.collapseOnNavigate),
            responsiveRail: options.responsiveRail !== false,
            responsiveRailQuery: options.responsiveRailQuery || RESPONSIVE_RAIL_QUERY,
            onChange: typeof options.onChange === "function" ? options.onChange : null,
        };
        sidebarControllerStates.set(sidebar, state);
        setActiveSidebarRoute(sidebar, state.config.activePage);

        if (sidebar.dataset.collapseControllerReady !== "true") {
            sidebar.dataset.collapseControllerReady = "true";
            sidebar.querySelector("#sidebarCollapseBtn")?.addEventListener("click", (event) => {
                event.stopPropagation();
                setSidebarCollapsed(sidebar, !sidebar.classList.contains("collapsed"));
            });
            sidebar.querySelector("#sidebarBrandButton, .sidebar-brand")?.addEventListener("click", (event) => {
                if (event.currentTarget.dataset.sidebarBrandAction === "navigate") return;
                if (!sidebar.classList.contains("collapsed")) return;
                event.preventDefault();
                setSidebarCollapsed(sidebar, false);
            });
            sidebar.addEventListener("click", (event) => {
                const link = event.target.closest(".nav-link");
                if (!link || !sidebar.contains(link) || link.closest(".nav-mode")) return;

                const currentConfig = sidebarControllerStates.get(sidebar)?.config;
                if (!currentConfig?.collapseOnNavigate || link.dataset.page === "home" || link.dataset.soonTarget || link.getAttribute("aria-disabled") === "true") return;
                setSidebarCollapsed(sidebar, true);
            });
        }

        const initialCollapsed = readSidebarCollapsedState(state.config.storageKey, Boolean(state.config.initialCollapsed));
        setSidebarCollapsed(sidebar, initialCollapsed, { persist: false });
        bindSidebarResponsiveRail(sidebar);
        return sidebar;
    }

    /* Start: 261020 수정 - Work·Chat 모드 화면 바로 이동 */
    // 이동 경로가 없는 모드는 기존 패널을 전환하고, 경로가 있는 모드는 해당 화면을 엽니다.
    function bindNavModes(sidebar) {
        sidebar.querySelectorAll(".nav-mode").forEach((list) => {
            if (list.dataset.navModeReady === "true") return;
            const tabs = Array.from(list.querySelectorAll(":scope > .nav-link[role='tab']"));
            if (!tabs.length) return;

            const activate = (selected) => {
                tabs.forEach((tab) => {
                    const active = tab === selected;
                    tab.classList.toggle("active", active);
                    tab.setAttribute("aria-selected", String(active));
                    tab.tabIndex = active ? 0 : -1;
                    const panel = document.getElementById(tab.getAttribute("aria-controls"));
                    if (panel && sidebar.contains(panel)) panel.hidden = !active;
                });
            };

            list.addEventListener("click", (event) => {
                const tab = event.target.closest(".nav-link");
                if (!tabs.includes(tab)) return;
                event.preventDefault();
                if (tab.dataset.navModeHref) {
                    window.location.assign(tab.dataset.navModeHref);
                    return;
                }
                activate(tab);
            });
            list.addEventListener("keydown", (event) => {
                const index = tabs.indexOf(event.target.closest(".nav-link"));
                if (index < 0) return;
                let next;
                if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
                else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
                else if (event.key === "Home") next = 0;
                else if (event.key === "End") next = tabs.length - 1;
                else return;
                event.preventDefault();
                tabs[next].focus();
            });
            activate(tabs.find((tab) => tab.classList.contains("active")) || tabs[0]);
            list.dataset.navModeReady = "true";
        });
    }
    /* End: 261020 수정 - Work·Chat 모드 화면 바로 이동 */

    // Start: 261022 수정 - 공통 사이드바 너비 저장 및 복원
    // 우측 경계의 공통 크기 조절: 펼친 데스크톱 사이드바에만 적용합니다.
    function bindSidebarResize(sidebar) {
        if (sidebar.classList.contains("chatbot-account-host") || sidebar.querySelector(":scope > .sidebar-resize-handle")) return;
        const min = 180;
        const max = 360;
        const defaultWidth = 220;
        const storageKey = "ai-one:sidebar-width";
        const handle = document.createElement("div");
        handle.className = "sidebar-resize-handle";
        handle.tabIndex = 0;
        handle.setAttribute("role", "separator");
        handle.setAttribute("aria-label", "사이드바 너비 조절");
        handle.setAttribute("aria-orientation", "vertical");
        handle.setAttribute("aria-valuemin", String(min));
        handle.setAttribute("aria-valuemax", String(max));
        handle.setAttribute("aria-valuenow", String(defaultWidth));
        sidebar.append(handle);

        const enabled = () => window.innerWidth > 768 && !sidebar.classList.contains("collapsed") && !sidebar.closest(".is-sidebar-collapsed, .is-rail-mode");
        const saveWidth = (width) => {
            try {
                localStorage.setItem(storageKey, String(width));
            } catch (error) {
                // 저장소가 차단돼도 현재 화면의 너비 조절은 유지한다.
            }
        };
        const setWidth = (value, persist = true) => {
            const width = Math.round(Math.min(max, Math.max(min, value)));
            document.documentElement.style.setProperty("--sidebar-w", `${width}px`);
            document.querySelectorAll(".sidebar-resize-handle").forEach((item) => {
                item.setAttribute("aria-valuenow", String(width));
            });
            if (persist) saveWidth(width);
        };
        let initialWidth = defaultWidth;
        try {
            const saved = localStorage.getItem(storageKey);
            const width = Number(saved);
            if (saved?.trim() && Number.isFinite(width)) initialWidth = width;
        } catch (error) {
            // 저장된 값을 읽지 못하면 기본 너비를 사용한다.
        }
        setWidth(initialWidth, false);
        let drag = null;
        const finish = () => {
            if (!drag) return;
            const pointerId = drag.pointerId;
            drag = null;
            saveWidth(Number(handle.getAttribute("aria-valuenow")));
            document.documentElement.classList.remove("is-sidebar-resizing");
            if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
        };
        handle.addEventListener("pointerdown", (event) => {
            if (event.button !== 0 || !enabled()) return;
            event.preventDefault();
            handle.focus({ preventScroll: true });
            drag = { pointerId: event.pointerId, x: event.clientX, width: sidebar.getBoundingClientRect().width };
            handle.setPointerCapture(event.pointerId);
            document.documentElement.classList.add("is-sidebar-resizing");
        });
        handle.addEventListener("pointermove", (event) => {
            if (!drag || event.pointerId !== drag.pointerId) return;
            if (!enabled()) return finish();
            setWidth(drag.width + event.clientX - drag.x, false);
        });
        ["pointerup", "pointercancel", "lostpointercapture"].forEach((type) => handle.addEventListener(type, finish));
        window.addEventListener("blur", finish);
        window.addEventListener("resize", finish);
        handle.addEventListener("dblclick", () => {
            if (enabled()) setWidth(defaultWidth);
        });
        handle.addEventListener("keydown", (event) => {
            if (!enabled()) return;
            const current = Number(handle.getAttribute("aria-valuenow"));
            const values = { ArrowLeft: current - 10, ArrowRight: current + 10, Home: min, End: max, Enter: defaultWidth };
            if (!(event.key in values)) return;
            event.preventDefault();
            setWidth(values[event.key]);
        });
    }

    // End: 261022 수정 - 공통 사이드바 너비 저장 및 복원

    // 사이드바 초기화와 공개 API
    function bindSidebar(sidebar) {
        if (!sidebar) return;
        bindNavModes(sidebar);
        renderCompletionDots(sidebar);
        if (!sidebar || sidebar.dataset.modalTriggersReady === "true") return;

        sidebar.dataset.modalTriggersReady = "true";
        bindNavTooltips(sidebar);
        bindAccountMenu(sidebar);
        sidebar.querySelectorAll("[data-modal-open]:not([data-sidebar-account-action])").forEach((trigger) => {
            trigger.addEventListener("click", (event) => {
                event.preventDefault();
                event.stopPropagation();
                openModal(trigger);
            });
        });
    }

    // 페이지별 스크립트(ai-home.js 등)가 자체적으로 configure()를 호출하지 않는 사이드바에
    // 적용할 기본 접기/펼치기 동작. 이미 configure()가 호출된 사이드바는
    // collapseControllerReady 플래그로 감지해 건드리지 않는다.
    // 페이지별 초기화가 같은 타이밍에 나중에 등록되어 있을 수 있어, 그 초기화가
    // 먼저 끝나도록 한 틱 뒤로 미뤄서 확인한다.
    function autoConfigureSidebar(sidebar) {
        if (!(sidebar instanceof Element)) return;
        setTimeout(() => {
            if (sidebar.dataset.collapseControllerReady !== "true") configureSidebar(sidebar);
        }, 0);
    }

    function init(root = document) {
        initCollapsedHomeNavigation();
        if (root.matches?.(".sidebar, .chatbot-sidebar")) bindSidebarResize(root);
        root.querySelectorAll?.(".sidebar, .chatbot-sidebar").forEach(bindSidebarResize);
        /* Start: 261020 추가 - 챗봇 사이드바 모드 초기화 */
        if (root.matches?.(".chatbot-sidebar")) bindNavModes(root);
        root.querySelectorAll?.(".chatbot-sidebar").forEach(bindNavModes);
        /* End: 261020 추가 - 챗봇 사이드바 모드 초기화 */
        if (root.matches?.(".app-sidebar, .sidebar")) bindSidebar(root);
        root.querySelectorAll?.(".app-sidebar, .sidebar").forEach(bindSidebar);
        if (root.matches?.(".app-sidebar, .sidebar")) autoConfigureSidebar(root);
        root.querySelectorAll?.(".app-sidebar, .sidebar").forEach(autoConfigureSidebar);
    }

    window.AIOneSidebar = Object.freeze({
        init,
        configure: configureSidebar,
        bindAccountMenu,
        setCollapsed: setSidebarCollapsed,
        openModal,
        bindNavTooltips,
        renderCompletionDots,
        markCompletion,
        clearCompletion,
        logout,
    });

    document.addEventListener("click", (event) => {
        if (!event.target.closest("[data-sidebar-logout-confirm]")) return;
        logout();
    });

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => init(), { once: true });
    } else {
        init();
    }

    document.addEventListener("component:ready", (event) => {
        if (["sidebar", "sidebar-chatbot"].includes(event.detail?.name)) init(event.target);
        if (pendingModalRequest && event.detail?.name === "modal" && event.detail?.id === pendingModalRequest.targetId) {
            flushPendingModalRequest();
        }
    });
    document.addEventListener("app:includes-ready", (event) => {
        init(event.target);
        flushPendingModalRequest();
    });
})();

/* End: 사이드바 (Sidebar) */

/* Start: 파일 업로드 (File Upload) */

(() => {
    const FILE_SECURITY_SCAN_LIMIT = 1024 * 1024;
    const FILE_SENSITIVE_RULES = [
        { label: "개인정보 표기", pattern: /(개인정보|민감정보|개인 식별정보|개인식별정보)/i },
        { label: "주민등록·외국인등록 정보", pattern: /(주민등록(번호)?|주민번호|외국인등록(번호)?|\b\d{6}-?[1-4]\d{6}\b)/i },
        { label: "여권·면허 정보", pattern: /(여권번호|운전면허(번호)?|면허번호)/i },
        { label: "금융·인증 정보", pattern: /(계좌번호|신용카드(번호)?|카드번호|비밀번호|인증번호|보안카드)/i },
        { label: "건강·의료 정보", pattern: /(건강정보|진료기록|진단명|병력|의료정보|장애정보|유전정보|생체정보|지문정보)/i },
        { label: "민감한 개인 속성", pattern: /(범죄경력|정치적 견해|노동조합|종교정보|성생활|성적 지향)/i },
        { label: "연락처 정보", pattern: /(\b01[016789]-?\d{3,4}-?\d{4}\b|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i },
    ];
    const FILE_CONFIDENTIAL_RULES = [
        { label: "대외비", pattern: /(대외\s*비|대외비)/i },
        { label: "비공개·내부한정", pattern: /(비공개|내부한정|내부용|외부공개금지|외부 공개 금지)/i },
        { label: "보안·기밀", pattern: /(보안문서|기밀|confidential|secret)/i },
    ];

    async function inspectFileSecurity(file) {
        let contentSample = "";
        try {
            contentSample = await file.slice(0, FILE_SECURITY_SCAN_LIMIT).text();
        } catch {
            contentSample = "";
        }

        const target = `${file.name || ""}\n${contentSample}`;
        const sensitiveReasons = FILE_SENSITIVE_RULES.filter((rule) => rule.pattern.test(target)).map((rule) => rule.label);
        const confidentialReasons = FILE_CONFIDENTIAL_RULES.filter((rule) => rule.pattern.test(target)).map((rule) => rule.label);

        return {
            file,
            sensitiveReasons: [...new Set(sensitiveReasons)],
            confidentialReasons: [...new Set(confidentialReasons)],
            level: sensitiveReasons.length ? "sensitive" : confidentialReasons.length ? "confidential" : "safe",
        };
    }

    async function validateFileSecurity(inputFiles) {
        const files = Array.from(inputFiles || []);
        const results = await Promise.all(files.map(inspectFileSecurity));
        return {
            results,
            blocked: results.filter((result) => result.level === "sensitive"),
            confidential: results.filter((result) => result.level === "confidential"),
            safeFiles: results.filter((result) => result.level === "safe").map((result) => result.file),
        };
    }

    function bindUploadZone(zone) {
        if (!zone || zone.dataset.fileUploadReady === "true") return;

        const input = zone.querySelector('input[type="file"]');
        if (!input) return;

        const emitFiles = (fileList, source) => {
            const files = Array.from(fileList || []);
            if (!files.length) return;
            zone.dispatchEvent(
                new CustomEvent("app:file-upload", {
                    bubbles: true,
                    detail: { files, source },
                }),
            );
        };

        zone.addEventListener("click", (event) => {
            if (event.target === input) return;
            input.click();
        });
        zone.addEventListener("keydown", (event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            input.click();
        });
        input.addEventListener("change", () => {
            emitFiles(input.files, "picker");
            input.value = "";
        });
        zone.addEventListener("dragenter", (event) => {
            event.preventDefault();
            zone.classList.add("dragover");
        });
        zone.addEventListener("dragover", (event) => {
            event.preventDefault();
            zone.classList.add("dragover");
        });
        zone.addEventListener("dragleave", (event) => {
            if (event.relatedTarget && zone.contains(event.relatedTarget)) return;
            zone.classList.remove("dragover");
        });
        zone.addEventListener("drop", (event) => {
            event.preventDefault();
            zone.classList.remove("dragover");
            emitFiles(event.dataTransfer?.files, "drop");
        });

        zone.dataset.fileUploadReady = "true";
    }

    function init(root = document) {
        if (root.matches?.("[data-file-upload-zone]")) bindUploadZone(root);
        root.querySelectorAll?.("[data-file-upload-zone]").forEach(bindUploadZone);
    }

    window.AIOneUploadSecurity = Object.freeze({
        inspect: inspectFileSecurity,
        validate: validateFileSecurity,
    });
    window.AIOneFileUpload = Object.freeze({ init });

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => init(), { once: true });
    } else {
        init();
    }
    document.addEventListener("app:includes-ready", (event) => init(event.target));
    document.addEventListener("component:ready", (event) => {
        if (event.detail?.name === "file-upload") init(event.target);
    });
})();

/* End: 파일 업로드 (File Upload) */

/* Start: 파일 항목 (File Item) */

(() => {
    const ACTION_SCOPE_SELECTOR = "[data-file-actions]";
    const FILE_ITEM_SELECTOR = ".file-list > li";
    const PINNED_META_SUFFIX = " · 목록 고정";
    let pendingDelete = null;

    function getItems(list) {
        return Array.from(list?.children || []).filter((item) => item.matches("li:not(.file-list-empty)"));
    }

    function assignInitialOrder(list) {
        const items = getItems(list);
        const usedOrders = items.map((item) => Number(item.dataset.fileInitialIndex)).filter(Number.isFinite);
        let nextOrder = usedOrders.length ? Math.max(...usedOrders) + 1 : 0;

        items.forEach((item) => {
            if (Number.isFinite(Number(item.dataset.fileInitialIndex))) return;
            item.dataset.fileInitialIndex = String(nextOrder);
            nextOrder += 1;
        });
    }

    function syncPinnedState(item, isPinned) {
        item.classList.toggle("pinned", isPinned);

        const pinButton = item.querySelector('[data-menu-value="pin"]');
        if (pinButton) {
            pinButton.textContent = isPinned ? "목록 고정 해제" : "목록 고정";
            pinButton.setAttribute("aria-pressed", String(isPinned));
        }

        const meta = item.querySelector(".file-meta");
        if (meta) {
            meta.dataset.fileMetaBase ||= meta.textContent.replace(/\s*·\s*목록 고정$/, "").trim();
            meta.textContent = `${meta.dataset.fileMetaBase}${isPinned ? PINNED_META_SUFFIX : ""}`;
        }
    }

    function sortPinnedItems(list) {
        assignInitialOrder(list);
        getItems(list)
            .sort((first, second) => Number(second.classList.contains("pinned")) - Number(first.classList.contains("pinned")) || Number(first.dataset.fileInitialIndex) - Number(second.dataset.fileInitialIndex))
            .forEach((item) => list.append(item));
    }

    function syncListState(list) {
        if (!list || list.classList.contains("simple")) return;

        const count = getItems(list).length;
        const section = list.closest(".file-list-section");
        const countElement = section?.querySelector(".upload-summary-file-count");
        if (countElement) countElement.textContent = String(count);
        const summaryMessage = section?.querySelector(".upload-summary-footer-copy em");
        if (summaryMessage) summaryMessage.textContent = `${count}건 질의 확인`;

        const scope = list.closest(ACTION_SCOPE_SELECTOR);
        const emptyTarget = list.dataset.fileEmptyTarget ? scope?.querySelector(list.dataset.fileEmptyTarget) : null;
        if (emptyTarget) {
            emptyTarget.classList.toggle("hidden", count > 0);
            list.classList.toggle("hidden", count === 0);
        }
    }

    function selectItem(item) {
        const list = item.closest(".file-list");
        if (!list || list.classList.contains("simple")) return;
        getItems(list).forEach((candidate) => {
            candidate.classList.toggle("active", candidate === item);
        });
    }

    function getFileName(item) {
        return item.querySelector(".file-name, .file-name-simple")?.textContent.trim() || "선택한 파일";
    }

    function getDeleteModal(item) {
        const scope = item.closest(ACTION_SCOPE_SELECTOR);
        const modalId = scope?.dataset.fileDeleteModal;
        return modalId ? document.getElementById(modalId) : null;
    }

    function prepareDelete(item, trigger) {
        const modal = getDeleteModal(item);
        if (!modal || !window.AIOneModal) return;

        const fileName = getFileName(item);
        const nameElement = modal.querySelector("[data-file-delete-name]");
        if (nameElement) nameElement.textContent = fileName;

        pendingDelete = { item, modal, fileName };
        window.AIOneModal.open(modal, trigger);
    }

    function deletePendingItem() {
        const target = pendingDelete;
        if (!target?.item.isConnected) return;

        const { item, modal, fileName } = target;
        const list = item.closest(".file-list");
        const wasActive = item.classList.contains("active");
        const nextItem = item.nextElementSibling || item.previousElementSibling;

        item.remove();
        if (wasActive && nextItem?.matches("li:not(.file-list-empty)")) {
            selectItem(nextItem);
        }
        syncListState(list);

        pendingDelete = null;
        window.AIOneModal?.close(modal);
        list?.dispatchEvent(
            new CustomEvent("fileitem:delete", {
                bubbles: true,
                detail: { fileName },
            }),
        );
    }

    function togglePinnedItem(item) {
        const list = item.closest(".file-list");
        const isPinned = !item.classList.contains("pinned");
        syncPinnedState(item, isPinned);
        sortPinnedItems(list);
        item.dispatchEvent(
            new CustomEvent("fileitem:pinchange", {
                bubbles: true,
                detail: { pinned: isPinned, fileName: getFileName(item) },
            }),
        );
    }

    function init(root = document) {
        const scopes = [];
        if (root instanceof Element && root.matches(ACTION_SCOPE_SELECTOR)) scopes.push(root);
        root.querySelectorAll?.(ACTION_SCOPE_SELECTOR).forEach((scope) => scopes.push(scope));

        scopes.forEach((scope) => {
            scope.querySelectorAll(".file-list:not(.simple)").forEach((list) => {
                assignInitialOrder(list);
                getItems(list).forEach((item) => {
                    syncPinnedState(item, item.classList.contains("pinned"));
                });
                syncListState(list);
            });
        });
    }

    document.addEventListener("dropdownmenu:select", (event) => {
        const item = event.target.closest(FILE_ITEM_SELECTOR);
        if (!item?.closest(ACTION_SCOPE_SELECTOR)) return;

        if (event.detail?.value === "pin") togglePinnedItem(item);
        if (event.detail?.value === "delete") {
            prepareDelete(item, event.detail.item || event.target);
        }
    });

    document.addEventListener("click", (event) => {
        const confirmButton = event.target.closest("[data-file-delete-confirm]");
        if (confirmButton) {
            if (pendingDelete?.modal.contains(confirmButton)) deletePendingItem();
            return;
        }

        const removeButton = event.target.closest(".file-remove-simple");
        const simpleItem = removeButton?.closest(FILE_ITEM_SELECTOR);
        if (simpleItem?.closest(ACTION_SCOPE_SELECTOR)) {
            prepareDelete(simpleItem, removeButton);
            return;
        }

        const mainButton = event.target.closest(".file-item-main");
        const item = mainButton?.closest(FILE_ITEM_SELECTOR);
        if (item?.closest(ACTION_SCOPE_SELECTOR)) selectItem(item);
    });

    document.addEventListener("modal:close", (event) => {
        if (pendingDelete?.modal === event.target) pendingDelete = null;
    });

    window.AIOneFileItem = Object.freeze({
        init,
        syncPinnedState,
        prepareDelete,
    });
    document.addEventListener("DOMContentLoaded", () => init());
    document.addEventListener("app:includes-ready", (event) => init(event.target));
})();

/* End: 파일 항목 (File Item) */

/* Start: 필터 버튼 (Filter Button) */

(() => {
    function getButtons(list) {
        return Array.from(list.querySelectorAll(".filter-btn")).filter((button) => button.closest(".filter-bar") === list);
    }

    function bindFilterBar(list) {
        const buttons = getButtons(list);
        if (!buttons.length) return;

        const selectedButton = buttons.find((button) => button.classList.contains("active")) || buttons.find((button) => !button.disabled);
        buttons.forEach((button) => button.setAttribute("aria-pressed", String(button === selectedButton)));
        selectedButton?.classList.add("active");
        list.dataset.filterButtonReady = "true";
    }

    function init(root = document) {
        if (root.matches?.(".filter-bar")) bindFilterBar(root);
        root.querySelectorAll?.(".filter-bar").forEach(bindFilterBar);

        if (document.documentElement.dataset.filterButtonEventsReady === "true") return;
        document.addEventListener("click", (event) => {
            const button = event.target.closest(".filter-btn");
            const list = button?.closest(".filter-bar");
            if (!button || !list || button.disabled || button.getAttribute("aria-disabled") === "true") return;

            getButtons(list).forEach((item) => {
                const isSelected = item === button;
                item.classList.toggle("active", isSelected);
                item.setAttribute("aria-pressed", String(isSelected));
            });
            list.dispatchEvent(
                new CustomEvent("filter-btn:change", {
                    bubbles: true,
                    detail: {
                        filter: button.dataset.filter || button.value || button.textContent.trim(),
                        button,
                    },
                }),
            );
        });
        document.documentElement.dataset.filterButtonEventsReady = "true";
    }

    window.AIOneFilterButtons = Object.freeze({ init });

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => init(), { once: true });
    } else {
        init();
    }
    document.addEventListener("app:includes-ready", (event) => init(event.target));
})();

/* End: 필터 버튼 (Filter Button) */

/* Start: 진행률 표시줄 (Progress Bar) */

(() => {
    function resolveProgressbar(target) {
        if (target instanceof Element) return target;
        if (typeof target === "string") return document.querySelector(target);
        return null;
    }

    function setValue(target, nextValue) {
        const progressbar = resolveProgressbar(target);
        if (!progressbar) return null;

        const min = Number(progressbar.getAttribute("aria-valuemin") ?? 0);
        const max = Number(progressbar.getAttribute("aria-valuemax") ?? 100);
        const safeMin = Number.isFinite(min) ? min : 0;
        const safeMax = Number.isFinite(max) && max > safeMin ? max : 100;
        const numericValue = Number(nextValue);
        const value = Math.min(safeMax, Math.max(safeMin, Number.isFinite(numericValue) ? numericValue : safeMin));
        const percent = ((value - safeMin) / (safeMax - safeMin)) * 100;

        progressbar.style.setProperty("--progressbar-value", `${percent}%`);
        progressbar.dataset.value = String(value);
        progressbar.setAttribute("role", "progressbar");
        progressbar.setAttribute("aria-valuemin", String(safeMin));
        progressbar.setAttribute("aria-valuemax", String(safeMax));
        progressbar.setAttribute("aria-valuenow", String(value));
        progressbar.classList.toggle("is-high", percent >= 90);
        progressbar.classList.toggle("is-medium", percent >= 75 && percent < 90);
        progressbar.classList.toggle("is-low", percent < 75);
        progressbar
            .closest(".progressbar-row")
            ?.querySelector("[data-progressbar-value]")
            ?.replaceChildren(`${Math.round(percent)}%`);
        progressbar.dispatchEvent(
            new CustomEvent("progressbar:change", {
                bubbles: true,
                detail: { value, percent },
            }),
        );
        return progressbar;
    }

    function init(root = document) {
        const progressbars = [];
        if (root instanceof Element && root.matches("[data-progressbar]")) progressbars.push(root);
        root.querySelectorAll?.("[data-progressbar]").forEach((progressbar) => progressbars.push(progressbar));
        progressbars.forEach((progressbar) => {
            setValue(progressbar, progressbar.dataset.value ?? progressbar.getAttribute("aria-valuenow") ?? 0);
        });
    }

    window.AIOneProgressBar = Object.freeze({ init, setValue });
    document.addEventListener("DOMContentLoaded", () => init());
    document.addEventListener("app:includes-ready", (event) => init(event.target));
})();

/* End: 진행률 표시줄 (Progress Bar) */

/* Start: 데이터 테이블 (Data Table) */

(() => {
    const loadingStates = new WeakMap();

    function resolveTable(target) {
        if (typeof target === "string") return document.querySelector(target);
        if (!(target instanceof Element)) return null;
        return target.matches("table") ? target : target.querySelector("table");
    }

    function getColumnCount(table, tbody) {
        const headerRow = table.tHead?.rows[table.tHead.rows.length - 1];
        const sourceRow = headerRow || Array.from(tbody.rows).find((row) => !row.classList.contains("data-table-skeleton-row"));
        if (!sourceRow) return 1;
        return Array.from(sourceRow.cells).reduce((total, cell) => total + Math.max(1, cell.colSpan || 1), 0);
    }

    function createSkeletonRow(columnCount) {
        const row = document.createElement("tr");
        row.className = "data-table-skeleton-row";
        row.dataset.tableSkeletonRow = "true";
        row.setAttribute("aria-hidden", "true");

        for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
            const cell = document.createElement("td");
            const skeleton = document.createElement("span");
            skeleton.className = "ai-skeleton data-table-skeleton-cell";
            if (columnIndex % 3 === 0) skeleton.classList.add("wide");
            if (columnIndex % 3 === 1) skeleton.classList.add("short");
            cell.appendChild(skeleton);
            row.appendChild(cell);
        }
        return row;
    }

    function setLoading(target, isLoading, options = {}) {
        const table = resolveTable(target);
        const tbody = table?.tBodies[0];
        if (!table || !tbody) return null;

        const currentState = loadingStates.get(table);
        if (!isLoading) {
            if (!currentState) return table;

            currentState.skeletonRows.forEach((row) => row.remove());
            currentState.dataRows.forEach(({ row, hidden, ariaHidden }) => {
                row.hidden = hidden;
                if (ariaHidden === null) row.removeAttribute("aria-hidden");
                else row.setAttribute("aria-hidden", ariaHidden);
            });
            if (currentState.ariaBusy === null) table.removeAttribute("aria-busy");
            else table.setAttribute("aria-busy", currentState.ariaBusy);
            if (currentState.container) {
                if (currentState.containerState === null) currentState.container.removeAttribute("data-state");
                else currentState.container.setAttribute("data-state", currentState.containerState);
            }
            loadingStates.delete(table);
            table.dispatchEvent(new CustomEvent("datatable:loading-change", { bubbles: true, detail: { loading: false } }));
            return table;
        }

        if (currentState) return table;

        const dataRows = Array.from(tbody.rows)
            .filter((row) => !row.matches("[data-table-skeleton-row]"))
            .map((row) => ({ row, hidden: row.hidden, ariaHidden: row.getAttribute("aria-hidden") }));
        dataRows.forEach(({ row }) => {
            row.hidden = true;
            row.setAttribute("aria-hidden", "true");
        });

        const columnCount = getColumnCount(table, tbody);
        const requestedRowCount = Number.parseInt(options.rowCount, 10);
        const rowCount = Number.isFinite(requestedRowCount) ? Math.min(Math.max(requestedRowCount, 1), 20) : 5;
        const skeletonRows = Array.from({ length: rowCount }, () => createSkeletonRow(columnCount));
        skeletonRows.forEach((row) => tbody.appendChild(row));

        const container = table.closest(".table");
        loadingStates.set(table, {
            ariaBusy: table.getAttribute("aria-busy"),
            container,
            containerState: container?.getAttribute("data-state") ?? null,
            dataRows,
            skeletonRows,
        });
        table.setAttribute("aria-busy", "true");
        container?.setAttribute("data-state", "loading");
        table.dispatchEvent(new CustomEvent("datatable:loading-change", { bubbles: true, detail: { loading: true } }));
        return table;
    }

    function init(root = document) {
        const tables = [];
        if (root instanceof Element && root.matches("[data-datatable]")) tables.push(root);
        root.querySelectorAll?.("[data-datatable]").forEach((table) => tables.push(table));

        tables.forEach((table) => {
            if (table.dataset.dataTableReady === "true") return;
            const tbody = table.tBodies[0];
            if (!tbody) return;

            const rowCheckboxes = () => Array.from(table.querySelectorAll("[data-table-select-row]"));
            const selectAll = table.querySelector("[data-table-select-all]");
            const emitSelection = () => {
                const checkboxes = rowCheckboxes().filter((input) => !input.disabled);
                const selected = checkboxes.filter((input) => input.checked);
                checkboxes.forEach((input) => {
                    const row = input.closest("tr");
                    row?.classList.toggle("is-selected", input.checked);
                    row?.setAttribute("aria-selected", String(input.checked));
                });
                if (selectAll) {
                    selectAll.checked = checkboxes.length > 0 && selected.length === checkboxes.length;
                    selectAll.indeterminate = selected.length > 0 && selected.length < checkboxes.length;
                }
                table.dispatchEvent(
                    new CustomEvent("datatable:selection-change", {
                        bubbles: true,
                        detail: {
                            selectedValues: selected.map((input) => input.value),
                        },
                    }),
                );
            };

            selectAll?.addEventListener("change", () => {
                rowCheckboxes().forEach((input) => {
                    if (!input.disabled) input.checked = selectAll.checked;
                });
                emitSelection();
            });
            rowCheckboxes().forEach((input) => input.addEventListener("change", emitSelection));

            table.querySelectorAll("[data-table-sort]").forEach((button) => {
                button.addEventListener("click", () => {
                    const header = button.closest("th");
                    if (!header) return;
                    const columnIndex = header.cellIndex;
                    const nextDirection = header.getAttribute("aria-sort") === "ascending" ? "descending" : "ascending";
                    const sortType = button.dataset.sortType || "text";
                    const rows = Array.from(tbody.rows).filter((row) => !row.querySelector(".data-table-empty"));

                    const getValue = (row) => {
                        const cell = row.cells[columnIndex];
                        const rawValue = cell?.dataset.sortValue || cell?.textContent.trim() || "";
                        if (sortType === "number") {
                            const numberValue = Number(rawValue.replace(/[^\d.-]/g, ""));
                            return Number.isFinite(numberValue) ? numberValue : 0;
                        }
                        if (sortType === "date") {
                            const dateValue = Date.parse(rawValue);
                            return Number.isNaN(dateValue) ? 0 : dateValue;
                        }
                        return rawValue;
                    };

                    rows.sort((rowA, rowB) => {
                        const valueA = getValue(rowA);
                        const valueB = getValue(rowB);
                        const comparison = typeof valueA === "number" ? valueA - valueB : String(valueA).localeCompare(String(valueB), "ko", { numeric: true });
                        return nextDirection === "ascending" ? comparison : -comparison;
                    });

                    table.querySelectorAll("th[aria-sort]").forEach((item) => item.setAttribute("aria-sort", "none"));
                    header.setAttribute("aria-sort", nextDirection);
                    rows.forEach((row) => tbody.appendChild(row));
                    table.dispatchEvent(
                        new CustomEvent("datatable:sort", {
                            bubbles: true,
                            detail: {
                                column: button.dataset.tableSort,
                                direction: nextDirection,
                            },
                        }),
                    );
                });
            });

            table.dataset.dataTableReady = "true";
            emitSelection();
        });
    }

    window.AIOneDataTable = Object.freeze({ init, setLoading });
    document.addEventListener("DOMContentLoaded", () => init());
    document.addEventListener("app:includes-ready", (event) => init(event.target));
})();

/* End: 데이터 테이블 (Data Table) */

/* Start: 문서 상태 표시줄 (Document Status Bar) */

(() => {
    const rootSelector = "[data-document-statusbar]";
    const fullscreenClass = "document-statusbar-fullscreen";
    let pageSyncFrame = 0;
    let fullscreenOrigin = null;

    function resolveRoot(target) {
        if (target instanceof Element) {
            return target.matches(rootSelector) ? target : target.closest(rootSelector);
        }
        if (typeof target === "string") return document.querySelector(target);
        return null;
    }

    function resolveSelector(root, selector) {
        if (!selector) return null;
        try {
            return document.querySelector(selector);
        } catch (error) {
            return null;
        }
    }

    function readNumber(value, fallback) {
        const number = Number(value);
        return Number.isFinite(number) ? number : fallback;
    }

    function isScrollable(element) {
        if (!(element instanceof Element)) return false;
        const overflowY = window.getComputedStyle(element).overflowY;
        return ["auto", "scroll", "overlay"].includes(overflowY) && element.scrollHeight > element.clientHeight + 1;
    }

    function resolvePageScrollTarget(pages, preferredTarget) {
        const pageList = Array.from(pages || []).filter((page) => page instanceof Element);
        if (isScrollable(preferredTarget)) return preferredTarget;

        let candidate = preferredTarget?.parentElement || pageList[0]?.parentElement || null;
        while (candidate) {
            if (isScrollable(candidate)) return candidate;
            candidate = candidate.parentElement;
        }
        return preferredTarget;
    }

    function getCurrentPage(pages, scrollTarget) {
        const pageList = Array.from(pages || []).filter((page) => page instanceof Element);
        const activeScrollTarget = resolvePageScrollTarget(pageList, scrollTarget);
        if (!pageList.length || !(activeScrollTarget instanceof Element)) return 1;

        const maxScrollTop = Math.max(0, activeScrollTarget.scrollHeight - activeScrollTarget.clientHeight);
        if (activeScrollTarget.scrollTop <= 1) return 1;
        if (maxScrollTop > 0 && activeScrollTarget.scrollTop >= maxScrollTop - 1) return pageList.length;

        const viewport = activeScrollTarget.getBoundingClientRect();
        let current = 1;
        let greatestVisibleHeight = -1;
        pageList.forEach((page, index) => {
            const pageRect = page.getBoundingClientRect();
            const visibleHeight = Math.max(0, Math.min(pageRect.bottom, viewport.bottom) - Math.max(pageRect.top, viewport.top));
            if (visibleHeight <= greatestVisibleHeight) return;
            greatestVisibleHeight = visibleHeight;
            current = index + 1;
        });
        return current;
    }

    function stateFor(root) {
        if (!root) return null;
        const min = readNumber(root.dataset.documentMinZoom, 50);
        const max = Math.max(min, readNumber(root.dataset.documentMaxZoom, 200));
        const step = Math.max(1, readNumber(root.dataset.documentZoomStep, 10));
        const target = resolveSelector(root, root.dataset.documentTarget);
        const scrollTarget = resolveSelector(root, root.dataset.documentScrollTarget);
        const configuredFullscreenTarget = resolveSelector(root, root.dataset.documentFullscreenTarget) || root.parentElement;
        // 상태바가 속한 패널의 헤더까지 함께 확대하고, 독립 뷰어는 지정 대상을 유지한다.
        const fullscreenTarget = configuredFullscreenTarget?.closest(".panel:has(> .panel-head)") || configuredFullscreenTarget;
        return {
            root,
            min,
            max,
            step,
            target,
            scrollTarget,
            fullscreenTarget,
        };
    }

    function updatePage(state) {
        const selector = state.root.dataset.documentPageSelector;
        if (!selector || !state.scrollTarget) return;

        let pages = [];
        try {
            pages = Array.from(state.target?.querySelectorAll(selector) || []);
        } catch (error) {
            return;
        }
        if (!pages.length) return;

        const pageTotal = state.root.querySelector("[data-document-page-total]");
        const pageCurrent = state.root.querySelector("[data-document-page-current]");
        const current = getCurrentPage(pages, state.scrollTarget);
        if (pageCurrent) pageCurrent.textContent = String(current);
        if (pageTotal) pageTotal.textContent = String(pages.length);
    }

    function syncDocumentPages() {
        pageSyncFrame = 0;
        document.querySelectorAll(rootSelector).forEach((statusbar) => {
            const state = stateFor(statusbar);
            if (state) updatePage(state);
        });
    }

    function scheduleDocumentPageSync() {
        if (pageSyncFrame) return;
        pageSyncFrame = window.requestAnimationFrame(syncDocumentPages);
    }

    function setZoom(target, nextZoom) {
        const root = resolveRoot(target);
        const state = stateFor(root);
        if (!state) return null;

        const zoom = Math.min(state.max, Math.max(state.min, readNumber(nextZoom, readNumber(root.dataset.documentZoom, 100))));
        root.dataset.documentZoom = String(zoom);
        if (state.target) {
            state.target.style.zoom = String(zoom / 100);
            state.target.style.setProperty("--document-zoom-scale", String(zoom / 100));
            state.target.dataset.documentZoom = String(zoom);
        }

        const value = root.querySelector("[data-document-statusbar-zoom-value]");
        const zoomOut = root.querySelector('[data-document-statusbar-action="zoom-out"]');
        const zoomIn = root.querySelector('[data-document-statusbar-action="zoom-in"]');
        if (value) value.textContent = `${zoom}%`;
        if (zoomOut) zoomOut.disabled = zoom <= state.min;
        if (zoomIn) zoomIn.disabled = zoom >= state.max;
        window.requestAnimationFrame(() => updatePage(state));

        root.dispatchEvent(
            new CustomEvent("document-statusbar:zoomchange", {
                bubbles: true,
                detail: { zoom, target: state.target },
            }),
        );
        return root;
    }

    function syncFullscreenState(root) {
        const state = stateFor(root);
        if (!state) return;
        const isFullscreen = state.fullscreenTarget?.classList.contains(fullscreenClass) || false;
        const button = root.querySelector('[data-document-statusbar-action="fullscreen"]');
        if (!button) return;
        button.setAttribute("aria-pressed", String(isFullscreen));
        const label = isFullscreen ? "패널 전체보기 종료" : "패널 전체보기";
        button.setAttribute("aria-label", label);
        button.dataset.tooltip = label;
        button.removeAttribute("title");
        window.AIOneTooltip?.hide(button);
    }

    function toggleFullscreen(target, force) {
        const root = resolveRoot(target);
        const state = stateFor(root);
        if (!state?.fullscreenTarget) return null;

        const nextState = typeof force === "boolean" ? force : !state.fullscreenTarget.classList.contains(fullscreenClass);
        // DOM 위치와 인라인 크기는 유지하고, 해제 시 각 스크롤 영역을 복원한다.
        if (fullscreenOrigin && (fullscreenOrigin.root !== root || !nextState)) {
            const origin = fullscreenOrigin;
            fullscreenOrigin = null;
            origin.panel.classList.remove(fullscreenClass);
            // 탭을 전환했더라도 종료하는 패널의 문서 배율과 표시값을 함께 초기화한다.
            origin.panel.querySelectorAll(rootSelector).forEach((statusbar) => {
                if (stateFor(statusbar)?.fullscreenTarget === origin.panel) setZoom(statusbar, 100);
            });
            origin.scrollPositions.forEach(({ element, left, top }) => element.scrollTo(left, top));
            window.scrollTo(origin.x, origin.y);
            origin.root.querySelector('[data-document-statusbar-action="fullscreen"]')?.focus({ preventScroll: true });
            origin.root.dispatchEvent(
                new CustomEvent("document-statusbar:fullscreenchange", {
                    bubbles: true,
                    detail: { fullscreen: false, target: origin.panel },
                }),
            );
        }
        if (nextState && !fullscreenOrigin) {
            const panel = state.fullscreenTarget;
            const scrollElements = [panel, ...panel.querySelectorAll("*")];
            for (let ancestor = panel.parentElement; ancestor; ancestor = ancestor.parentElement) {
                scrollElements.push(ancestor);
            }
            fullscreenOrigin = {
                root,
                panel,
                x: window.scrollX,
                y: window.scrollY,
                scrollPositions: scrollElements.filter((element) => element.scrollHeight > element.clientHeight || element.scrollWidth > element.clientWidth).map((element) => ({ element, left: element.scrollLeft, top: element.scrollTop })),
            };
        }
        state.fullscreenTarget.classList.toggle(fullscreenClass, nextState);
        document.querySelectorAll(rootSelector).forEach(syncFullscreenState);
        if (nextState)
            root.dispatchEvent(
                new CustomEvent("document-statusbar:fullscreenchange", {
                    bubbles: true,
                    detail: { fullscreen: nextState, target: state.fullscreenTarget },
                }),
            );
        return root;
    }

    function init(root = document) {
        const statusbars = [];
        if (root instanceof Element && root.matches(rootSelector)) statusbars.push(root);
        root.querySelectorAll?.(rootSelector).forEach((statusbar) => statusbars.push(statusbar));

        if (document.documentElement.dataset.documentStatusbarPageSyncReady !== "true") {
            document.documentElement.dataset.documentStatusbarPageSyncReady = "true";
            document.addEventListener("scroll", scheduleDocumentPageSync, {
                capture: true,
                passive: true,
            });
            window.addEventListener("resize", scheduleDocumentPageSync, { passive: true });
        }

        statusbars.forEach((statusbar) => {
            if (statusbar.dataset.documentStatusbarReady !== "true") {
                statusbar.dataset.documentStatusbarReady = "true";
                statusbar.addEventListener("click", (event) => {
                    const actionButton = event.target.closest("[data-document-statusbar-action]");
                    if (!actionButton || !statusbar.contains(actionButton)) return;
                    const action = actionButton.dataset.documentStatusbarAction;
                    const state = stateFor(statusbar);
                    if (!state) return;
                    if (action === "zoom-out") {
                        setZoom(statusbar, readNumber(statusbar.dataset.documentZoom, 100) - state.step);
                    }
                    if (action === "zoom-in") {
                        setZoom(statusbar, readNumber(statusbar.dataset.documentZoom, 100) + state.step);
                    }
                    if (action === "fullscreen") toggleFullscreen(statusbar);
                });
            }
            setZoom(statusbar, statusbar.dataset.documentZoom);
            syncFullscreenState(statusbar);
        });
        scheduleDocumentPageSync();
    }

    document.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") return;
        if (fullscreenOrigin) toggleFullscreen(fullscreenOrigin.root, false);
    });

    window.AIOneDocumentStatusBar = Object.freeze({
        getCurrentPage,
        init,
        setZoom,
        toggleFullscreen,
    });
    document.addEventListener("DOMContentLoaded", () => init());
    document.addEventListener("app:includes-ready", (event) => init(event.target));
})();

/* End: 문서 상태 표시줄 (Document Status Bar) */

/* Start: 채팅 메시지 (Chat Message) */

(() => {
    const bindings = new WeakMap();
    const retryTimers = new WeakMap();
    const copyTimers = new WeakMap();
    const typingAnimations = new WeakMap();
    const commonScriptUrl = Array.from(document.scripts)
        .map((script) => script.src)
        .find((scriptUrl) => /\/js\/common\.js(?:[?#]|$)/.test(scriptUrl));
    const iconBaseUrl = commonScriptUrl ? new URL("../assets/icons/", commonScriptUrl) : new URL("../../assets/icons/", document.currentScript?.src || document.baseURI);
    const answerPendingIconUrl = new URL("ai-answer-sparkles.svg", iconBaseUrl);

    function cloneCommonPrototype(prototypeId) {
        const prototype = document.getElementById(prototypeId);
        if (!prototype) return null;
        const source = prototype.hasAttribute("data-prototype-wrapper") ? prototype.firstElementChild : prototype;
        if (!source) return null;
        const clone = source.cloneNode(true);
        clone.removeAttribute("id");
        clone.removeAttribute("hidden");
        clone.removeAttribute("data-dom-prototype");
        return clone;
    }

    function ensureActions(message) {
        const messageList = message instanceof Element ? message.closest("[data-chat-message-list]") : null;
        if (
            !(message instanceof Element) ||
            message.dataset.role !== "ai" ||
            message.dataset.status === "pending" ||
            message.dataset.messageActions === "none" ||
            messageList?.dataset.messageActions === "none" ||
            message.querySelector(":scope > .msg-actions")
        )
            return;

        const variant = message.dataset.variant || messageList?.dataset.variant;
        const actions = cloneCommonPrototype("commonMessageActionsPrototype");
        if (!actions) return;
        actions.querySelector("[data-answer-action-only]")?.toggleAttribute("hidden", variant !== "answer");
        message.append(actions);
    }

    function ensureAnswerAvatar(message) {
        if (!(message instanceof Element)) return;
        const messageList = message.closest("[data-chat-message-list]");
        const variant = message.dataset.variant || messageList?.dataset.variant;
        if (variant !== "answer" || message.dataset.role !== "ai" || message.dataset.status === "pending" || message.querySelector(":scope > .chat-ai-avatar")) return;
        // 답변 메시지 아바타는 각 페이지의 실제 HTML 또는 메시지 원형에서 제공합니다.
    }

    function decorateActions(root = document) {
        const messages = [];
        if (root instanceof Element && root.matches('[data-component="chat-message"], .chat-msg')) {
            messages.push(root);
        }
        root.querySelectorAll?.('[data-component="chat-message"], .chat-msg').forEach((message) => messages.push(message));
        messages.forEach((message) => {
            ensureAnswerAvatar(message);
            ensureActions(message);
        });
    }

    function typewrite(message, { text, target, scrollContainer, minDuration = 400, maxDuration = 2400, characterDelay = 10, onComplete } = {}) {
        if (!(message instanceof Element) || message.dataset.role !== "ai" || message.dataset.status === "pending") return null;

        const textTarget = target instanceof Element ? target : message.querySelector("[data-chat-message-text], .msg-text, .msg-content");
        if (!textTarget) return null;

        const fullText = String(text ?? textTarget.textContent ?? "");
        const characters = Array.from(fullText);
        const messageList = message.closest("[data-chat-message-list]");
        const scrollingElement = scrollContainer instanceof Element ? scrollContainer : messageList;
        const messageWindow = message.ownerDocument?.defaultView || window;
        const reducedMotion = messageWindow.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
        const previousAnimation = typingAnimations.get(message);
        if (previousAnimation) previousAnimation.finish(false);

        ensureActions(message);
        const actions = message.querySelector(":scope > .msg-actions");
        const actionsWereHidden = actions?.hidden || false;
        const duration = Math.min(maxDuration, Math.max(minDuration, characters.length * characterDelay));
        const state = { done: false, frameId: 0, finish: null };

        const scrollToLatest = () => {
            if (scrollingElement) scrollingElement.scrollTop = scrollingElement.scrollHeight;
        };
        const finish = (notify = true) => {
            if (state.done) return;
            state.done = true;
            if (state.frameId) messageWindow.cancelAnimationFrame(state.frameId);
            textTarget.textContent = fullText;
            textTarget.classList.remove("has-typing-cursor");
            message.classList.remove("is-typing");
            message.removeAttribute("aria-busy");
            if (actions) actions.hidden = actionsWereHidden;
            if (typingAnimations.get(message) === state) typingAnimations.delete(message);
            scrollToLatest();

            if (notify) {
                message.dispatchEvent(new CustomEvent("chat-message:typing-complete", { bubbles: true }));
                onComplete?.({ message, target: textTarget });
            }
        };

        state.finish = finish;
        typingAnimations.set(message, state);
        message.classList.add("is-typing");
        message.setAttribute("aria-busy", "true");
        textTarget.textContent = "";
        textTarget.classList.add("has-typing-cursor");
        if (actions) actions.hidden = true;
        scrollToLatest();

        if (!characters.length || reducedMotion || duration <= 0) {
            finish();
            return message;
        }

        const start = messageWindow.performance.now();
        const step = (now) => {
            if (state.done) return;
            const progress = Math.min(1, (now - start) / duration);
            const visibleLength = Math.floor(characters.length * progress);
            textTarget.textContent = characters.slice(0, visibleLength).join("");
            scrollToLatest();

            if (progress < 1) state.frameId = messageWindow.requestAnimationFrame(step);
            else finish();
        };

        state.frameId = messageWindow.requestAnimationFrame(step);
        return message;
    }

    function createPending({ variant = "answer", title = "생성 중", description = "답변서를 생성하고 있습니다..." } = {}) {
        const prototypeId = variant === "answer" ? "commonAnswerPendingMessagePrototype" : "commonChatPendingMessagePrototype";
        const message = cloneCommonPrototype(prototypeId);
        if (!message) return null;

        if (variant === "answer") {
            const pendingIcon = message.querySelector(".typing-avatar img");
            if (pendingIcon && !pendingIcon.src) pendingIcon.src = answerPendingIconUrl.href;
            message.querySelector(".typing-title").textContent = title;
            message.querySelector(".typing-desc").textContent = description;
            return message;
        }

        message.setAttribute("aria-label", title);
        return message;
    }

    function getMessage(button) {
        return button.closest('[data-component="chat-message"], .chat-msg');
    }

    function emitAction(message, action, detail = {}) {
        if (!message) return;
        message.dispatchEvent(
            new CustomEvent("chat-message:action", {
                bubbles: true,
                detail: { action, ...detail },
            }),
        );
    }

    function setFeedback(button, message, options) {
        const action = button.dataset.action;
        const shouldActivate = button.getAttribute("aria-pressed") !== "true";
        const actions = button.closest(".msg-actions");

        actions?.querySelectorAll('[data-action="like"], [data-action="dislike"]').forEach((feedbackButton) => {
            feedbackButton.classList.remove("active");
            feedbackButton.setAttribute("aria-pressed", "false");
        });

        if (shouldActivate) {
            button.classList.add("active");
            button.setAttribute("aria-pressed", "true");
        }

        emitAction(message, action, {
            selected: shouldActivate,
            value: shouldActivate ? action : null,
        });
        options.onFeedback?.({
            action,
            button,
            message,
            selected: shouldActivate,
            value: shouldActivate ? action : null,
        });
    }

    function fallbackCopy(text) {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.append(textarea);
        textarea.select();
        const copied = document.execCommand("copy");
        textarea.remove();
        if (!copied) throw new Error("Clipboard copy failed");
    }

    async function writeClipboard(text) {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return;
        }
        fallbackCopy(text);
    }

    function showCopyFeedback(button) {
        const originalLabel = button.getAttribute("aria-label") || "복사";
        const originalTitle = button.title || "복사";
        const activeTimer = copyTimers.get(button);
        if (activeTimer) window.clearTimeout(activeTimer);

        button.classList.add("active");
        button.setAttribute("aria-label", "복사됨");
        button.title = "복사됨";

        copyTimers.set(
            button,
            window.setTimeout(() => {
                button.classList.remove("active");
                button.setAttribute("aria-label", originalLabel);
                button.title = originalTitle;
                copyTimers.delete(button);
            }, 1200),
        );
    }

    async function copyMessage(button, message, options) {
        const text = options.getText?.({ button, message }) ?? message?.querySelector(".msg-content, .msg-text")?.innerText ?? "";

        try {
            await writeClipboard(text.trim());
            showCopyFeedback(button);
            emitAction(message, "copy", { copied: true, text });
            options.onCopy?.({ button, message, copied: true, text });
        } catch {
            emitAction(message, "copy", { copied: false, text });
            options.onCopy?.({ button, message, copied: false, text });
        }
    }

    function simulateRetry(message) {
        if (!message || message.classList.contains("is-pending")) return;

        const content = message.querySelector(".msg-content, .msg-text");
        const actions = message.querySelector(".msg-actions");
        if (!content || !actions) return;

        const activeTimer = retryTimers.get(message);
        if (activeTimer) window.clearTimeout(activeTimer);

        const originalContent = content.innerHTML;
        const originalText = content.innerText;
        message.classList.add("is-pending");
        message.dataset.status = "pending";
        message.setAttribute("aria-busy", "true");
        const variant = message.dataset.variant || message.closest("[data-chat-message-list]")?.dataset.variant;
        content.innerHTML = variant === "answer" ? '<span class="typing-cursor" role="status" aria-label="답변 생성 중"></span>' : '<span class="chat-typing-ellipsis" role="status" aria-label="답변 생성 중">...</span>';
        actions.hidden = true;

        retryTimers.set(
            message,
            window.setTimeout(() => {
                content.innerHTML = originalContent;
                actions.hidden = false;
                message.classList.remove("is-pending");
                message.dataset.status = "complete";
                message.removeAttribute("aria-busy");
                retryTimers.delete(message);
                emitAction(message, "retry-complete");
                typewrite(message, { text: originalText });
            }, 800),
        );
    }

    function bind(root, options) {
        const rootWindow = root?.ownerDocument?.defaultView;
        const RootNode = rootWindow?.Node || window.Node;
        if (!root || !(root instanceof RootNode)) return;

        const currentBinding = bindings.get(root);
        if (currentBinding) {
            if (options) currentBinding.options = options;
            return;
        }

        const binding = { options: options || {} };
        decorateActions(root);
        const RootMutationObserver = rootWindow?.MutationObserver || window.MutationObserver;
        binding.observer = new RootMutationObserver(() => decorateActions(root));
        try {
            binding.observer.observe(root, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ["data-message-actions", "data-role", "data-status"],
            });
        } catch (error) {
            binding.observer.disconnect();
            return;
        }
        root.addEventListener("click", (event) => {
            const target = event.target instanceof Element ? event.target : null;
            const button = target?.closest(".msg-action-btn[data-action]");
            if (!button || !root.contains(button)) return;

            const action = button.dataset.action;
            if (!["like", "dislike", "retry", "copy", "more", "report"].includes(action)) return;

            event.stopPropagation();
            const message = getMessage(button);

            if (action === "like" || action === "dislike") {
                setFeedback(button, message, binding.options);
                return;
            }
            if (action === "copy") {
                copyMessage(button, message, binding.options);
                return;
            }
            if (action === "report") {
                emitAction(message, "report");
                binding.options.onReport?.({ button, message });
                return;
            }
            if (action === "more") {
                emitAction(message, "more");
                binding.options.onMore?.({ button, message });
                return;
            }

            emitAction(message, "retry");
            if (typeof binding.options.onRetry === "function") {
                binding.options.onRetry({ button, message });
            } else {
                simulateRetry(message);
            }
        });

        bindings.set(root, binding);
    }

    function autoBind(root = document) {
        const lists = [];
        if (root instanceof Element && root.matches("[data-chat-message-list]")) lists.push(root);
        root.querySelectorAll?.("[data-chat-message-list]").forEach((messageList) => lists.push(messageList));
        lists.forEach((messageList) => bind(messageList));
    }

    window.ChatMessage = Object.freeze({ bind, autoBind, createPending, decorateActions, typewrite });
    document.addEventListener("DOMContentLoaded", () => autoBind());
    document.addEventListener("app:includes-ready", (event) => autoBind(event.target));
})();

/* End: 채팅 메시지 (Chat Message) */

/* Start: 프롬프트 작성기 (Prompt Composer) */

(() => {
    function init(root = document) {
        const composers = [];
        if (root instanceof Element && root.matches("[data-prompt-composer]")) composers.push(root);
        root.querySelectorAll?.("[data-prompt-composer]").forEach((composer) => composers.push(composer));

        composers.forEach((composer) => {
            if (composer.dataset.promptComposerReady === "true") return;

            const input = composer.querySelector("[data-prompt-input]");
            const submitButton = composer.querySelector("[data-prompt-submit]");
            const attachButton = composer.querySelector("[data-prompt-attach]");
            const fileInput = composer.querySelector("[data-prompt-file-input]");
            const fileList = composer.querySelector("[data-prompt-files]");
            const currentCount = composer.querySelector("[data-prompt-current]");
            const form = composer.matches("form") ? composer : composer.querySelector("form");
            if (!input || !submitButton || !form) return;

            let selectedFiles = [];
            const maxLength = Number(input.getAttribute("maxlength")) || 0;
            const isMultiline = input.tagName === "TEXTAREA";

            const syncInput = () => {
                if (isMultiline) {
                    input.style.height = "auto";
                    input.style.height = `${Math.min(input.scrollHeight, 180)}px`;
                }
                submitButton.disabled = input.value.trim().length === 0;

                if (currentCount) {
                    currentCount.textContent = String(input.value.length);
                    currentCount.closest(".prompt-composer-counter")?.classList.toggle("is-limit", maxLength > 0 && input.value.length >= maxLength);
                }
            };

            const renderFiles = () => {
                if (!fileList) return;
                fileList.replaceChildren();
                selectedFiles.forEach((file, index) => {
                    const prototype = document.getElementById("commonPromptFilePrototype");
                    if (!prototype) return;
                    const item = prototype.cloneNode(true);
                    item.removeAttribute("id");
                    item.removeAttribute("hidden");
                    item.removeAttribute("data-dom-prototype");
                    const name = item.querySelector(".prompt-composer-file-name");
                    name.textContent = file.name;
                    const removeButton = item.querySelector("button");
                    removeButton.dataset.promptFileRemove = String(index);
                    removeButton.setAttribute("aria-label", `${file.name} 삭제`);
                    fileList.append(item);
                });
            };

            input.addEventListener("input", syncInput);
            input.addEventListener("keydown", (event) => {
                if (event.key !== "Enter" || event.isComposing) return;
                if (isMultiline && event.shiftKey) return;
                event.preventDefault();
                if (!submitButton.disabled) form.requestSubmit(submitButton);
            });

            attachButton?.addEventListener("click", () => fileInput?.click());
            fileInput?.addEventListener("change", () => {
                selectedFiles = Array.from(fileInput.files || []);
                renderFiles();
                composer.dispatchEvent(
                    new CustomEvent("promptcomposer:files-change", {
                        bubbles: true,
                        detail: { files: selectedFiles.slice() },
                    }),
                );
            });
            fileList?.addEventListener("click", (event) => {
                const removeButton = event.target.closest("[data-prompt-file-remove]");
                if (!removeButton) return;
                selectedFiles.splice(Number(removeButton.dataset.promptFileRemove), 1);
                if (fileInput) fileInput.value = "";
                renderFiles();
                composer.dispatchEvent(
                    new CustomEvent("promptcomposer:files-change", {
                        bubbles: true,
                        detail: { files: selectedFiles.slice() },
                    }),
                );
            });
            form.addEventListener("submit", (event) => {
                event.preventDefault();
                const value = input.value.trim();
                if (!value) return;
                composer.dispatchEvent(
                    new CustomEvent("promptcomposer:submit", {
                        bubbles: true,
                        detail: {
                            value,
                            files: selectedFiles.slice(),
                        },
                    }),
                );
            });

            composer.dataset.promptComposerReady = "true";
            syncInput();
        });
    }

    window.AIOnePromptComposer = Object.freeze({ init });
    document.addEventListener("DOMContentLoaded", () => init());
    document.addEventListener("app:includes-ready", (event) => init(event.target));
})();

/* End: 프롬프트 작성기 (Prompt Composer) */

/* Start: 분할 핸들러 (Split Handler) */

(() => {
    const HANDLE_SELECTOR = [".split-handler-handle", ".three-panel > .panel-resize-handle"].join(", ");
    const DEFAULT_SPLIT_MIN_WIDTH = 160;
    const DEFAULT_PANEL_MIN_WIDTH = 220;
    const PANEL_HANDLE_WIDTH = 2;
    const threePanelResizeStates = new WeakMap();

    function getDirectChildren(container, predicate) {
        return Array.from(container?.children || []).filter(predicate);
    }

    function getSplitPanes(container) {
        return getDirectChildren(container, (element) => element.classList.contains("split-handler-left") || element.classList.contains("split-handler-right") || element.classList.contains("split-handler-pane"));
    }

    function getTwoPaneParts(handle) {
        const splitContainer = handle.closest('[data-component="split-handler"]');
        if (splitContainer && handle.parentElement === splitContainer && handle.classList.contains("split-handler-handle")) {
            const panes = getSplitPanes(splitContainer);
            const handles = getDirectChildren(splitContainer, (element) => element.classList.contains("split-handler-handle"));
            const handleIndex = handles.indexOf(handle);
            const left = panes[handleIndex];
            const right = panes[handleIndex + 1];
            return left && right ? { kind: "two-pane", container: splitContainer, handle, left, right } : null;
        }

        return null;
    }

    function getThreePanelParts(handle) {
        const container = handle.closest(".three-panel");
        if (!container || handle.parentElement !== container) return null;

        const compareHorizontalPosition = (first, second) => first.getBoundingClientRect().left - second.getBoundingClientRect().left;
        const panels = getDirectChildren(container, (element) => element.hasAttribute("data-slot")).sort(compareHorizontalPosition);
        const handles = getDirectChildren(container, (element) => element.classList.contains("panel-resize-handle")).sort(compareHorizontalPosition);
        const handleIndex = handles.indexOf(handle);
        const left = panels[handleIndex];
        const right = panels[handleIndex + 1];
        if (handleIndex < 0 || !left || !right) return null;

        return { kind: "three-panel", container, handle, panels, left, right };
    }

    function getResizeParts(handle) {
        if (handle.closest('[data-component="split-handler"]')) {
            return getTwoPaneParts(handle);
        }
        return getThreePanelParts(handle);
    }

    function getMinimum(container, totalWidth, fallback) {
        const configured = Number.parseFloat(container.dataset.splitMin);
        const minimum = Number.isFinite(configured) ? configured : fallback;
        return Math.min(Math.max(0, minimum), Math.max(0, Math.floor(totalWidth / 2)));
    }

    function getSplitOrientation(parts) {
        return parts.kind === "two-pane" && parts.container.classList.contains("type2") ? "vertical" : "horizontal";
    }

    function getPaneSize(pane, orientation) {
        const rect = pane.getBoundingClientRect();
        return orientation === "vertical" ? rect.height : rect.width;
    }

    function syncAria(parts) {
        const orientation = getSplitOrientation(parts);
        const beforeSize = Math.round(getPaneSize(parts.left, orientation));
        const afterSize = Math.round(getPaneSize(parts.right, orientation));
        const totalSize = beforeSize + afterSize;
        const beforeMinimum = parts.kind === "three-panel" ? Math.min(getThreePanelMinimum(parts.left, parts.container), Math.floor(totalSize / 2)) : getMinimum(parts.container, totalSize, DEFAULT_SPLIT_MIN_WIDTH);
        const afterMinimum = parts.kind === "three-panel" ? Math.min(getThreePanelMinimum(parts.right, parts.container), Math.floor(totalSize / 2)) : beforeMinimum;

        parts.handle.setAttribute("aria-orientation", orientation === "vertical" ? "horizontal" : "vertical");
        parts.handle.setAttribute("aria-valuemin", String(beforeMinimum));
        parts.handle.setAttribute("aria-valuemax", String(Math.max(beforeMinimum, totalSize - afterMinimum)));
        parts.handle.setAttribute("aria-valuenow", String(beforeSize));
    }

    function applyTwoPaneSizes(parts, requestedBeforeSize, totalSize) {
        const orientation = getSplitOrientation(parts);
        const sizeProperty = orientation === "vertical" ? "height" : "width";
        const crossSizeProperty = orientation === "vertical" ? "width" : "height";
        const minimum = getMinimum(parts.container, totalSize, DEFAULT_SPLIT_MIN_WIDTH);
        const beforeSize = Math.min(Math.max(Math.round(requestedBeforeSize), minimum), totalSize - minimum);
        const afterSize = totalSize - beforeSize;

        parts.left.style.setProperty("flex", "none", "important");
        parts.left.style.removeProperty(crossSizeProperty);
        parts.left.style.setProperty(sizeProperty, `${beforeSize}px`);
        parts.right.style.setProperty("flex", "none", "important");
        parts.right.style.removeProperty(crossSizeProperty);
        parts.right.style.setProperty(sizeProperty, `${afterSize}px`);
        syncAria(parts);
        const detail = {
            handle: parts.handle,
            left: parts.left,
            right: parts.right,
            orientation,
            beforeSize,
            afterSize,
        };
        if (orientation === "vertical") {
            detail.topHeight = beforeSize;
            detail.bottomHeight = afterSize;
        } else {
            detail.leftWidth = beforeSize;
            detail.rightWidth = afterSize;
        }
        parts.container.dispatchEvent(
            new CustomEvent("split-handler:resize", {
                bubbles: true,
                detail,
            }),
        );
    }

    function readThreePanelWidths(parts) {
        return new Map(parts.panels.map((panel) => [panel, Math.round(panel.getBoundingClientRect().width)]));
    }

    function getThreePanelHandles(container) {
        return getDirectChildren(container, (element) => element.classList.contains("panel-resize-handle"));
    }

    function getThreePanelAvailableWidth(container) {
        const styles = getComputedStyle(container);
        const horizontalPadding = Number.parseFloat(styles.paddingLeft) + Number.parseFloat(styles.paddingRight);
        const handleWidth = getThreePanelHandles(container).reduce((total, handle) => total + handle.getBoundingClientRect().width, 0);
        return Math.max(0, Math.round(container.clientWidth - horizontalPadding - handleWidth));
    }

    function isCollapsedPanel(panel) {
        return panel.classList.contains("panel-collapsed") || Boolean(panel.querySelector(":scope > .panel-collapsed"));
    }

    function getThreePanelMinimum(panel, container) {
        if (isCollapsedPanel(panel)) return 44;
        const configured = Number.parseFloat(panel.dataset.panelMin || container.dataset.splitMin);
        return Number.isFinite(configured) ? Math.max(0, configured) : DEFAULT_PANEL_MIN_WIDTH;
    }

    function getFlexiblePanelIndex(panels) {
        const centerIndex = panels.findIndex((panel) => panel.dataset.slot === "center" || panel.classList.contains("panel-center"));
        return centerIndex >= 0 ? centerIndex : Math.floor(panels.length / 2);
    }

    function fitThreePanelWidths(container, panels, preferredWidths) {
        const minimums = panels.map((panel) => getThreePanelMinimum(panel, container));
        const widths = panels.map((panel, index) => {
            if (isCollapsedPanel(panel)) return minimums[index];
            const preferred = preferredWidths?.get(panel);
            const current = Math.round(panel.getBoundingClientRect().width);
            return Math.max(minimums[index], Number.isFinite(preferred) ? preferred : current);
        });
        const flexibleIndex = getFlexiblePanelIndex(panels);
        const delta = getThreePanelAvailableWidth(container) - widths.reduce((sum, width) => sum + width, 0);

        if (delta > 0) {
            widths[flexibleIndex] += delta;
        } else if (delta < 0) {
            let deficit = -delta;
            const shrinkOrder = [flexibleIndex, ...widths.map((_, index) => index).filter((index) => index !== flexibleIndex)];
            shrinkOrder.forEach((index) => {
                if (deficit <= 0) return;
                const reduction = Math.min(deficit, Math.max(0, widths[index] - minimums[index]));
                widths[index] -= reduction;
                deficit -= reduction;
            });

            // 반응형 전환 직전 최소 너비의 합도 담을 수 없으면 중앙 패널부터 남은 폭에 맞춥니다.
            shrinkOrder.forEach((index) => {
                if (deficit <= 0) return;
                const reduction = Math.min(deficit, widths[index]);
                widths[index] -= reduction;
                deficit -= reduction;
            });
        }

        return new Map(panels.map((panel, index) => [panel, widths[index]]));
    }

    function applyThreePanelTracks(container, panels, widths) {
        const flexibleIndex = getFlexiblePanelIndex(panels);
        container.style.gridTemplateColumns = panels
            .flatMap((panel, index) => {
                const track = index === flexibleIndex ? "minmax(0, 1fr)" : `${Math.round(widths.get(panel))}px`;
                return index < panels.length - 1 ? [track, `${PANEL_HANDLE_WIDTH}px`] : [track];
            })
            .join(" ");
        getThreePanelHandles(container).forEach((handle) => {
            const nextParts = getThreePanelParts(handle);
            if (nextParts) syncAria(nextParts);
        });
    }

    function setPanelToMinimum(panel) {
        if (!(panel instanceof Element) || window.matchMedia("(max-width: 1024px)").matches) return false;

        const slot = panel.matches("[data-slot]") ? panel : panel.closest("[data-slot]");
        const container = slot?.parentElement;
        if (!slot || !container?.matches(".three-panel") || getComputedStyle(container).display !== "grid") return false;

        const compareHorizontalPosition = (first, second) => first.getBoundingClientRect().left - second.getBoundingClientRect().left;
        const panels = getDirectChildren(container, (element) => element.hasAttribute("data-slot")).sort(compareHorizontalPosition);
        if (!panels.includes(slot)) return false;

        const preferredWidths = new Map(panels.map((item) => [item, Math.round(item.getBoundingClientRect().width)]));
        preferredWidths.set(slot, getThreePanelMinimum(slot, container));

        const widths = fitThreePanelWidths(container, panels, preferredWidths);
        const state = ensureThreePanelResizeState(container);
        state.preferredWidths = new Map(widths);
        state.lastContainerWidth = container.clientWidth;
        applyThreePanelTracks(container, panels, widths);
        return true;
    }

    function normalizeThreePanel(container, state) {
        if (!container.isConnected || container.clientWidth <= 0 || getComputedStyle(container).display !== "grid") return;
        if (!container.style.gridTemplateColumns) return;

        const panels = getDirectChildren(container, (element) => element.hasAttribute("data-slot"));
        if (panels.length < 2) return;
        const widths = fitThreePanelWidths(container, panels, state.preferredWidths);
        applyThreePanelTracks(container, panels, widths);
    }

    function ensureThreePanelResizeState(container) {
        let state = threePanelResizeStates.get(container);
        if (state) return state;

        const panels = getDirectChildren(container, (element) => element.hasAttribute("data-slot"));
        state = {
            preferredWidths: container.style.gridTemplateColumns ? new Map(panels.map((panel) => [panel, Math.round(panel.getBoundingClientRect().width)])) : null,
            lastContainerWidth: container.clientWidth,
            observer: null,
        };
        if ("ResizeObserver" in window) {
            state.observer = new ResizeObserver(() => {
                if (container.clientWidth === state.lastContainerWidth) return;
                state.lastContainerWidth = container.clientWidth;
                normalizeThreePanel(container, state);
            });
            state.observer.observe(container);
        }
        threePanelResizeStates.set(container, state);
        return state;
    }

    function applyThreePanelWidths(parts, requestedLeftWidth, totalWidth, startWidths) {
        const leftMinimum = getThreePanelMinimum(parts.left, parts.container);
        const rightMinimum = getThreePanelMinimum(parts.right, parts.container);
        const leftWidth = Math.min(Math.max(Math.round(requestedLeftWidth), leftMinimum), totalWidth - rightMinimum);
        const widths = new Map(startWidths);
        widths.set(parts.left, leftWidth);
        widths.set(parts.right, totalWidth - leftWidth);
        const fittedWidths = fitThreePanelWidths(parts.container, parts.panels, widths);
        const state = ensureThreePanelResizeState(parts.container);
        state.preferredWidths = new Map(fittedWidths);
        state.lastContainerWidth = parts.container.clientWidth;
        applyThreePanelTracks(parts.container, parts.panels, fittedWidths);
    }

    function applyWidths(parts, requestedLeftWidth, totalWidth, startWidths) {
        if (parts.kind === "three-panel") {
            applyThreePanelWidths(parts, requestedLeftWidth, totalWidth, startWidths);
            return;
        }
        applyTwoPaneSizes(parts, requestedLeftWidth, totalWidth);
    }

    function init(root = document) {
        const handles = [];
        const threePanels = new Set();
        if (root instanceof Element && root.matches(HANDLE_SELECTOR)) handles.push(root);
        root.querySelectorAll?.(HANDLE_SELECTOR).forEach((handle) => handles.push(handle));
        handles.forEach((handle) => {
            const parts = getResizeParts(handle);
            if (!parts) return;
            syncAria(parts);
            if (parts.kind === "three-panel") threePanels.add(parts.container);
        });
        threePanels.forEach((container) => ensureThreePanelResizeState(container));
    }

    function reset(container) {
        if (!(container instanceof Element)) return;
        if (container.matches(".three-panel")) {
            container.style.removeProperty("grid-template-columns");
            const state = ensureThreePanelResizeState(container);
            state.preferredWidths = null;
            state.lastContainerWidth = container.clientWidth;
        } else {
            getDirectChildren(container, (element) => element.classList.contains("split-handler-left") || element.classList.contains("split-handler-right") || element.classList.contains("split-handler-pane")).forEach((panel) => {
                panel.style.removeProperty("flex");
                panel.style.removeProperty("width");
                panel.style.removeProperty("height");
            });
        }
        init(container);
    }

    if (document.documentElement.dataset.splitHandlerEventsReady !== "true") {
        document.documentElement.dataset.splitHandlerEventsReady = "true";

        document.addEventListener("pointerdown", (event) => {
            const handle = event.target.closest(HANDLE_SELECTOR);
            if (!handle || event.button !== 0) return;
            const parts = getResizeParts(handle);
            if (!parts) return;

            event.preventDefault();
            const orientation = getSplitOrientation(parts);
            const pointerId = event.pointerId;
            const startPosition = orientation === "vertical" ? event.clientY : event.clientX;
            const startBeforeSize = getPaneSize(parts.left, orientation);
            const startAfterSize = getPaneSize(parts.right, orientation);
            const totalSize = startBeforeSize + startAfterSize;
            const startWidths = parts.kind === "three-panel" ? readThreePanelWidths(parts) : null;

            handle.classList.add("active");
            document.body.style.cursor = orientation === "vertical" ? "row-resize" : "col-resize";
            document.body.style.userSelect = "none";

            const onPointerMove = (moveEvent) => {
                if (moveEvent.pointerId !== pointerId) return;
                moveEvent.preventDefault();
                const currentPosition = orientation === "vertical" ? moveEvent.clientY : moveEvent.clientX;
                applyWidths(parts, startBeforeSize + currentPosition - startPosition, totalSize, startWidths);
            };
            const onPointerEnd = (endEvent) => {
                if (endEvent.pointerId !== pointerId) return;
                handle.classList.remove("active");
                document.body.style.cursor = "";
                document.body.style.userSelect = "";
                document.removeEventListener("pointermove", onPointerMove);
                document.removeEventListener("pointerup", onPointerEnd);
                document.removeEventListener("pointercancel", onPointerEnd);
            };

            document.addEventListener("pointermove", onPointerMove, { passive: false });
            document.addEventListener("pointerup", onPointerEnd);
            document.addEventListener("pointercancel", onPointerEnd);
        });

        document.addEventListener("keydown", (event) => {
            const handle = event.target.closest(HANDLE_SELECTOR);
            if (!handle) return;
            const parts = getResizeParts(handle);
            if (!parts) return;
            const orientation = getSplitOrientation(parts);
            const supportedKeys = orientation === "vertical" ? ["ArrowUp", "ArrowDown"] : ["ArrowLeft", "ArrowRight"];
            if (!supportedKeys.includes(event.key)) return;

            event.preventDefault();
            const beforeSize = getPaneSize(parts.left, orientation);
            const afterSize = getPaneSize(parts.right, orientation);
            const positiveKey = orientation === "vertical" ? "ArrowDown" : "ArrowRight";
            const difference = (event.key === positiveKey ? 1 : -1) * (event.shiftKey ? 32 : 16);
            const startWidths = parts.kind === "three-panel" ? readThreePanelWidths(parts) : null;
            applyWidths(parts, beforeSize + difference, beforeSize + afterSize, startWidths);
        });
    }

    window.AIOneSplitHandler = Object.freeze({ init, reset, setPanelToMinimum });
    document.addEventListener("component:ready", (event) => init(event.target));
    document.addEventListener("app:includes-ready", (event) => init(event.target));
    document.addEventListener("DOMContentLoaded", () => init());
    init();
})();

/* End: 분할 핸들러 (Split Handler) */

/* Start: 내부 패널 전환 */
// 페이지별 초기화 없이 동적으로 생성된 패널에도 공통 전환을 적용한다.
(() => {
    const paneSelector = ".split-handler-left, .split-handler-right, .split-handler-pane";
    const isVisible = (element) => element && element.getClientRects().length > 0 && window.getComputedStyle(element).visibility !== "hidden";

    document.addEventListener("click", (event) => {
        const button = event.target.closest(".panel-switch-btn");
        const panel = button?.closest(".panel");
        if (!panel || button.disabled) return;

        const containers = panel.querySelectorAll('[data-component="split-handler"], .split-handler');
        for (const container of containers) {
            // 다른 탭, 중첩된 외부 패널, 세로 분할 및 모바일 세로 배치는 제외한다.
            if (container.closest(".panel") !== panel || !isVisible(container) || container.classList.contains("type2") || window.getComputedStyle(container).flexDirection !== "row") continue;

            const handle = Array.from(container.children).find((child) => child.matches(".split-handler-handle") && isVisible(child));
            const left = handle?.previousElementSibling;
            const right = handle?.nextElementSibling;
            if (!left?.matches(paneSelector) || !right?.matches(paneSelector) || !isVisible(left) || !isVisible(right)) continue;

            event.preventDefault();
            // 기존 노드를 이동하여 콘텐츠, 이벤트, 패널별 리사이즈 너비를 유지한다.
            container.insertBefore(right, left);
            container.insertBefore(handle, left);
            window.AIOneSplitHandler?.init?.(container);
            button.focus({ preventScroll: true });
            break;
        }
    });
})();
/* End: 내부 패널 전환 */

/* Start: 사이드 팝업 (Side Pop) */

(() => {
    const variants = new Set(["run-list", "chat-list", "content"]);
    const sizes = new Set(["small", "medium", "large", "xlarge"]);
    const listTypes = Object.freeze({
        run: {
            itemSelector: ".drawer-run-item",
            titleSelector: ".drawer-run-title",
            renameLabel: "제목 변경",
            menuLabel: "실행 건 관리",
            eventName: "sidepop:run-action",
        },
        chat: {
            itemSelector: ".drawer-chat-item",
            titleSelector: ".drawer-chat-name",
            renameLabel: "이름 변경",
            menuLabel: "대화 관리",
            eventName: "sidepop:chat-action",
        },
    });
    const actions = Object.freeze([{ value: "pin", label: "고정" }, { value: "rename" }, { value: "delete", label: "삭제" }]);
    const modalContexts = new WeakMap();
    const modalOrigins = new WeakMap();
    const sharedActionContexts = new WeakMap();
    let pinSequence = 0;
    const controller = window.AIOneLayerFactory.create({
        type: "sidepop",
        layerSelector: "[data-sidepop]",
        openAttribute: "data-sidepop-open",
        closeAttribute: "data-sidepop-close",
        closeOnLayerClick: false,
    });

    function resolveLayer(target) {
        if (target instanceof Element) return target.closest("[data-sidepop]") || target;
        if (typeof target !== "string") return null;
        return target.startsWith("#") ? document.querySelector(target) : document.getElementById(target);
    }

    function setVariant(target, variant = "run-list") {
        const layer = resolveLayer(target);
        const sidepop = layer?.querySelector(".drawer-contents");
        if (!sidepop || !variants.has(variant)) return false;

        variants.forEach((name) => sidepop.classList.toggle(`drawer-variant-${name}`, name === variant));
        sidepop.dataset.sidepopVariant = variant;
        layer.dispatchEvent(
            new CustomEvent("sidepop:variant-change", {
                bubbles: true,
                detail: { variant },
            }),
        );
        return true;
    }

    function setSize(target, size = "medium") {
        const layer = resolveLayer(target);
        const sidepop = layer?.querySelector(".drawer-contents");
        if (!sidepop || !sizes.has(size)) return false;

        sizes.forEach((name) => sidepop.classList.toggle(`drawer-${name}`, name === size));
        sidepop.dataset.sidepopSize = size;
        layer.dispatchEvent(
            new CustomEvent("sidepop:size-change", {
                bubbles: true,
                detail: { size },
            }),
        );
        return true;
    }

    function syncPositionControl(layer) {
        const buttons = layer?.querySelectorAll("[data-sidepop-position-toggle]");
        if (!buttons?.length) return;

        const isLeft = layer.classList.contains("drawer-position-left");
        const destination = isLeft ? "오른쪽" : "왼쪽";
        buttons.forEach((button) => {
            const label = button.querySelector("span");
            if (label) label.textContent = `${isLeft ? "우측" : "좌측"}으로 이동`;
            button.setAttribute("aria-label", `Drawer를 ${destination}으로 이동`);
        });
    }

    function setPosition(target, position = "right") {
        const layer = resolveLayer(target);
        if (!layer) return false;

        const isLeft = position === "left";
        layer.classList.toggle("drawer-position-left", isLeft);
        syncPositionControl(layer);
        layer.dispatchEvent(
            new CustomEvent("sidepop:position-change", {
                bubbles: true,
                detail: { position: isLeft ? "left" : "right" },
            }),
        );
        return true;
    }

    function initPositionControls(root = document) {
        const layers = [];
        if (root.matches?.("[data-sidepop]")) layers.push(root);
        root.querySelectorAll?.("[data-sidepop]").forEach((layer) => layers.push(layer));
        layers.forEach(syncPositionControl);
    }

    function getListType(item) {
        if (item?.matches(listTypes.run.itemSelector)) return "run";
        if (item?.matches(listTypes.chat.itemSelector)) return "chat";
        return "";
    }

    function getListItems(container, type) {
        const selector = listTypes[type]?.itemSelector;
        if (!container || !selector) return [];
        return Array.from(container.children).filter((item) => item.matches(selector));
    }

    function getItemTitle(item, type = getListType(item)) {
        const title = item?.querySelector(listTypes[type]?.titleSelector);
        if (!title) return "";
        if (type !== "chat") return title.textContent.replace(/\s+/g, " ").trim();

        return Array.from(title.childNodes)
            .filter((node) => !(node instanceof Element && node.classList.contains("drawer-chat-icon")))
            .map((node) => node.textContent)
            .join("")
            .replace(/\s+/g, " ")
            .trim();
    }

    // Start: 261015 수정 - 답변서 채팅 목록 제목 변경
    // .drawer-chat-name-text만 갱신해 아이콘·완료점을 보존하고 툴팁·접근성 이름도 맞춘다.
    // 제목 span이 없는 기존 chat-list 마크업은 아이콘을 유지하는 이전 방식을 사용한다.
    function setItemTitle(item, type, value) {
        const title = item?.querySelector(listTypes[type]?.titleSelector);
        if (!title) return;

        if (type === "chat") {
            const text = title.querySelector(".drawer-chat-name-text");
            if (text) {
                text.textContent = value;
                text.title = value;
            } else {
                const icon = title.querySelector(".drawer-chat-icon");
                title.replaceChildren();
                if (icon) title.append(icon);
                title.append(document.createTextNode(value));
            }
            item.querySelector(".drawer-chat-select")?.setAttribute("aria-label", `${value} 대화 열기`);
            return;
        }
        title.textContent = value;
    }
    // End: 261015 수정 - 답변서 채팅 목록 제목 변경

    function createListActionMenu(trigger, item, type, itemIndex, itemCount) {
        const definition = listTypes[type];
        const layerId = item.closest("[data-sidepop]")?.id || "sidepop";
        const menuId = `${layerId}-${type}-action-${itemIndex + 1}`;
        const prototype = document.getElementById("commonSidepopActionPrototype");
        if (!prototype) return;
        const component = prototype.cloneNode(true);
        const menu = component.querySelector(".drawer-list-action-menu");
        if (!menu) return;

        component.removeAttribute("id");
        component.removeAttribute("hidden");
        component.removeAttribute("data-dom-prototype");
        component.setAttribute("data-dropdown-menu", "");
        component.classList.add(`drawer-${type}-action`);

        trigger.before(component);
        component.prepend(trigger);
        trigger.dataset.dropdownTrigger = "";
        trigger.setAttribute("aria-label", "더보기");
        trigger.setAttribute("title", "더보기");
        trigger.setAttribute("aria-haspopup", "menu");
        trigger.setAttribute("aria-expanded", "false");
        trigger.setAttribute("aria-controls", menuId);

        menu.classList.add(`drawer-${type}-action-menu`);
        menu.id = menuId;
        menu.hidden = true;
        menu.setAttribute("role", "menu");
        menu.setAttribute("aria-label", definition.menuLabel);
        menu.dataset.placement = itemCount > 3 && itemIndex >= itemCount - 2 ? "top-end" : "bottom-end";

        actions.forEach((action) => {
            const button = menu.querySelector(`[data-menu-value="${action.value}"]`);
            const label = button?.querySelector(".drawer-list-action-label");
            if (!button || !label) return;
            const isPinned = item.classList.contains("is-pinned");

            if (action.value === "pin") button.setAttribute("aria-pressed", String(isPinned));
            label.textContent = action.value === "pin" ? (isPinned ? "고정 해제" : "고정") : action.value === "rename" ? definition.renameLabel : action.label;
        });
    }

    function resolveSharedActionModal(item) {
        const modalId = item.closest("[data-sidepop]")?.dataset.sidepopActionModal;
        return modalId ? document.getElementById(modalId) : null;
    }

    function syncSharedActionModal(modal, item, type) {
        const isPinned = item.classList.contains("is-pinned");
        const shareButton = modal.querySelector('[data-sidepop-list-action="share"]');
        const pinButton = modal.querySelector('[data-sidepop-list-action="pin"]');
        const pinLabel = pinButton?.querySelector("[data-sidepop-action-label]");

        if (shareButton) shareButton.hidden = type !== "chat";
        pinButton?.setAttribute("aria-pressed", String(isPinned));
        if (pinLabel) pinLabel.textContent = isPinned ? "고정 해제" : "고정";
    }

    function bindSharedActionModal(modal) {
        if (!modal || modal.dataset.sidepopSharedActionsReady === "true") return;

        modal.addEventListener("click", (event) => {
            const button = event.target.closest("[data-sidepop-list-action]");
            const context = sharedActionContexts.get(modal);
            if (!button || !context) return;

            event.preventDefault();
            event.stopPropagation();
            const action = button.dataset.sidepopListAction;
            const { item, type, trigger } = context;
            window.AIOneModal?.close(modal);

            if (action === "share") {
                dispatchListAction(item, type, action, { completed: true });
                return;
            }
            if (action === "pin") {
                togglePinned(item, type);
                return;
            }
            if (["rename", "delete"].includes(action)) {
                queueMicrotask(() => openItemModal(item, type, action, trigger));
            }
        });
        modal.dataset.sidepopSharedActionsReady = "true";
    }

    function bindSharedActionTrigger(trigger, item, type, modal) {
        if (trigger.dataset.sidepopSharedActionReady === "true") return;

        trigger.setAttribute("aria-label", "더보기");
        trigger.setAttribute("title", "더보기");
        trigger.setAttribute("aria-haspopup", "menu");
        trigger.setAttribute("aria-expanded", "false");
        trigger.setAttribute("aria-controls", modal.id);
        trigger.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            const layer = item.closest("[data-sidepop]");
            sharedActionContexts.set(modal, { item, type, trigger });
            syncSharedActionModal(modal, item, type);
            bindSharedActionModal(modal);
            trigger.setAttribute("aria-expanded", "true");
            // 투명 작업 메뉴는 SidePop의 기존 backdrop을 그대로 사용해야 한다.
            // 여기서까지 backdrop을 해제하면 화면 전체 dim이 사라진다.
            if (!modal.classList.contains("modal-menu-backdrop")) {
                layer?.classList.add("has-child-modal");
            }
            modal.classList.add("modal-over-drawer");
            if (layer) modalOrigins.set(modal, layer);
            window.AIOneModal?.open(modal, trigger);
        });
        trigger.dataset.sidepopSharedActionReady = "true";
    }

    function initListActionMenus(root = document) {
        Object.entries(listTypes).forEach(([type, definition]) => {
            const items = [];
            if (root.matches?.(definition.itemSelector)) items.push(root);
            root.querySelectorAll?.(definition.itemSelector).forEach((item) => items.push(item));

            items.forEach((item) => {
                if (item.closest("[data-dom-prototype]")) return;

                const container = item.parentElement;
                const siblings = getListItems(container, type);
                if (!item.dataset.sidepopOriginalOrder) {
                    item.dataset.sidepopOriginalOrder = String(siblings.indexOf(item));
                }
                if (item.classList.contains("is-pinned") && !item.dataset.sidepopPinOrder) {
                    pinSequence += 1;
                    item.dataset.sidepopPinOrder = String(pinSequence);
                }

                const select = item.querySelector(":scope > .drawer-chat-select");
                if (type === "chat" && select && !select.getAttribute("aria-label")) {
                    select.setAttribute("aria-label", `${getItemTitle(item, type)} 대화 열기`);
                }

                const trigger = item.querySelector(".btn-more");
                if (!trigger || trigger.closest("[data-dropdown-menu], .drawer-list-action")) return;
                const sharedActionModal = resolveSharedActionModal(item);
                if (sharedActionModal) {
                    bindSharedActionTrigger(trigger, item, type, sharedActionModal);
                    return;
                }
                createListActionMenu(trigger, item, type, siblings.indexOf(item), siblings.length);
            });
        });

        window.AIOneDropdownMenu?.init(root);
    }

    function reorderList(item, type) {
        const container = item?.parentElement;
        const items = getListItems(container, type);
        items.sort((left, right) => {
            const leftPinned = left.classList.contains("is-pinned");
            const rightPinned = right.classList.contains("is-pinned");
            if (leftPinned !== rightPinned) return rightPinned - leftPinned;
            if (leftPinned) {
                return Number(right.dataset.sidepopPinOrder || 0) - Number(left.dataset.sidepopPinOrder || 0);
            }
            return Number(left.dataset.sidepopOriginalOrder || 0) - Number(right.dataset.sidepopOriginalOrder || 0);
        });
        items.forEach((listItem) => container.append(listItem));
    }

    function updatePinControl(item, isPinned) {
        const button = item.querySelector('.drawer-list-action [data-menu-value="pin"]');
        button?.setAttribute("aria-pressed", String(isPinned));
        const label = button?.querySelector(".drawer-list-action-label");
        if (label) label.textContent = isPinned ? "고정 해제" : "고정";
    }

    function dispatchListAction(item, type, action, detail = {}) {
        const payload = {
            action,
            type,
            item,
            title: getItemTitle(item, type),
            ...detail,
        };
        item.dispatchEvent(
            new CustomEvent("sidepop:list-action", {
                bubbles: true,
                detail: payload,
            }),
        );
        item.dispatchEvent(
            new CustomEvent(listTypes[type].eventName, {
                bubbles: true,
                detail: payload,
            }),
        );
    }

    function togglePinned(item, type) {
        const isPinned = !item.classList.contains("is-pinned");
        item.classList.toggle("is-pinned", isPinned);
        item.dataset.pinned = String(isPinned);
        if (isPinned) {
            pinSequence += 1;
            item.dataset.sidepopPinOrder = String(pinSequence);
        } else {
            delete item.dataset.sidepopPinOrder;
        }
        updatePinControl(item, isPinned);
        reorderList(item, type);
        dispatchListAction(item, type, "pin", { completed: true, pinned: isPinned });
    }

    function bindActionModal(modal) {
        if (!modal || modal.dataset.sidepopActionsReady === "true") return;
        modal.querySelector("[data-sidepop-rename-confirm]")?.addEventListener("click", (event) => {
            event.preventDefault();
            completeRename(modal);
        });
        modal.querySelector("[data-sidepop-delete-confirm]")?.addEventListener("click", (event) => {
            event.preventDefault();
            completeDelete(modal);
        });
        modal.dataset.sidepopActionsReady = "true";
    }

    function openItemModal(item, type, action, trigger) {
        const layer = item.closest("[data-sidepop]");
        const modalId = action === "rename" ? layer?.dataset.sidepopRenameModal : layer?.dataset.sidepopDeleteModal;
        const modal = modalId ? document.getElementById(modalId) : null;

        if (!modal || !window.AIOneModal) {
            dispatchListAction(item, type, action, { completed: false, modalAvailable: false });
            return;
        }

        bindActionModal(modal);
        modalContexts.set(modal, { action, item, type });
        modalOrigins.set(modal, layer);
        layer.classList.add("has-child-modal");
        modal.classList.add("modal-over-drawer");
        if (action === "rename") {
            const input = modal.querySelector("[data-sidepop-rename-input]");
            const error = modal.querySelector("[data-sidepop-rename-error]");
            if (input) {
                input.value = getItemTitle(item, type);
                input.removeAttribute("aria-invalid");
            }
            if (error) error.hidden = true;
        } else {
            const title = modal.querySelector("[data-sidepop-delete-title]");
            if (title) title.textContent = getItemTitle(item, type);
        }

        window.AIOneModal.open(modal, trigger);
        if (action === "rename") {
            window.setTimeout(() => {
                const input = modal.querySelector("[data-sidepop-rename-input]");
                input?.focus();
                input?.select();
            }, 0);
        }
        dispatchListAction(item, type, action, { completed: false, modalAvailable: true });
    }

    function completeRename(modal) {
        const context = modalContexts.get(modal);
        const input = modal.querySelector("[data-sidepop-rename-input]");
        const error = modal.querySelector("[data-sidepop-rename-error]");
        const value = input?.value.trim() || "";
        if (!context || context.action !== "rename") return;

        if (!value) {
            if (error) error.hidden = false;
            input?.setAttribute("aria-invalid", "true");
            input?.focus();
            return;
        }

        const previousTitle = getItemTitle(context.item, context.type);
        setItemTitle(context.item, context.type, value);
        dispatchListAction(context.item, context.type, "rename", {
            completed: true,
            previousTitle,
            title: value,
        });
        window.AIOneModal?.close(modal);
    }

    function decrementPanelCounts(item) {
        const panel = item.closest(".drawer-variant-panel");
        const counters = new Set(panel?.querySelectorAll(".drawer-list-count, .drawer-list-meta strong") || []);
        counters.forEach((counter) => {
            const current = Number(counter.textContent.match(/\d+/)?.[0]);
            if (!Number.isFinite(current)) return;
            counter.textContent = counter.textContent.replace(/\d+/, String(Math.max(0, current - 1)));
        });
    }

    function completeDelete(modal) {
        const context = modalContexts.get(modal);
        if (!context || context.action !== "delete") return;

        const { item, type } = context;
        const container = item.parentElement;
        const siblings = getListItems(container, type).filter((candidate) => candidate !== item);
        const wasActive = item.classList.contains("is-active");
        const title = getItemTitle(item, type);

        dispatchListAction(item, type, "delete", {
            completed: true,
            removed: true,
            title,
        });
        window.AIOneModal?.close(modal);
        decrementPanelCounts(item);
        item.remove();
        if (wasActive) siblings[0]?.classList.add("is-active");
    }

    function getRuleItems(list) {
        return Array.from(list?.children || []).filter((item) => item.matches(".rule-item"));
    }

    function activateRuleItem(item, shouldFocus = false) {
        const list = item?.closest(".rule-list");
        const items = getRuleItems(list);
        if (!list || !items.includes(item)) return false;

        items.forEach((ruleItem) => {
            const isActive = ruleItem === item;
            ruleItem.classList.toggle("active", isActive);
            ruleItem.setAttribute("aria-selected", String(isActive));
            ruleItem.tabIndex = isActive ? 0 : -1;
        });
        if (shouldFocus) item.focus();
        return true;
    }

    function initRuleLists(root = document) {
        const lists = [];
        if (root.matches?.(".rule-list")) lists.push(root);
        root.querySelectorAll?.(".rule-list").forEach((list) => lists.push(list));

        lists.forEach((list) => {
            const items = getRuleItems(list);
            if (!items.length) return;

            list.setAttribute("role", "tablist");
            list.setAttribute("aria-orientation", "vertical");
            items.forEach((item) => item.setAttribute("role", "tab"));
            activateRuleItem(items.find((item) => item.classList.contains("active")) || items[0]);
        });
    }

    document.addEventListener(
        "click",
        (event) => {
            const positionButton = event.target.closest("[data-sidepop-position-toggle]");
            if (positionButton) {
                const layer = positionButton.closest("[data-sidepop]");
                setPosition(layer, layer?.classList.contains("drawer-position-left") ? "right" : "left");
                return;
            }

            const trigger = event.target.closest("[data-sidepop-open]");
            if (trigger) {
                const target = trigger.getAttribute("data-sidepop-open");
                if (trigger.dataset.sidepopSize) setSize(target, trigger.dataset.sidepopSize);
                if (trigger.dataset.sidepopVariant) setVariant(target, trigger.dataset.sidepopVariant);
                return;
            }

            const ruleItem = event.target.closest(".rule-list > .rule-item");
            if (ruleItem) activateRuleItem(ruleItem);
        },
        true,
    );

    document.addEventListener("input", (event) => {
        const input = event.target.closest("[data-sidepop-rename-input]");
        if (!input) return;
        input.removeAttribute("aria-invalid");
        const error = input.closest("[data-modal]")?.querySelector("[data-sidepop-rename-error]");
        if (error) error.hidden = true;
    });

    document.addEventListener("dropdownmenu:select", (event) => {
        const actionComponent = event.target.closest?.(".drawer-list-action");
        const item = actionComponent?.closest(".drawer-run-item, .drawer-chat-item");
        const type = getListType(item);
        const action = event.detail?.value;
        if (!item || !type || !actions.some((candidate) => candidate.value === action)) return;

        if (action === "pin") {
            togglePinned(item, type);
            return;
        }

        const trigger = actionComponent.querySelector("[data-dropdown-trigger]");
        queueMicrotask(() => openItemModal(item, type, action, trigger));
    });

    document.addEventListener("keydown", (event) => {
        const renameInput = event.target.closest?.("[data-sidepop-rename-input]");
        if (renameInput && event.key === "Enter") {
            event.preventDefault();
            renameInput.closest("[data-modal]")?.querySelector("[data-sidepop-rename-confirm]")?.click();
            return;
        }

        const currentItem = event.target.closest?.(".rule-list > .rule-item");
        if (!currentItem) return;

        const items = getRuleItems(currentItem.closest(".rule-list"));
        const currentIndex = items.indexOf(currentItem);
        let nextItem = null;

        if (event.key === "ArrowDown") nextItem = items[(currentIndex + 1) % items.length];
        if (event.key === "ArrowUp") nextItem = items[(currentIndex - 1 + items.length) % items.length];
        if (event.key === "Home") nextItem = items[0];
        if (event.key === "End") nextItem = items[items.length - 1];
        if (["Enter", " "].includes(event.key)) nextItem = currentItem;
        if (!nextItem) return;

        event.preventDefault();
        activateRuleItem(nextItem, true);
    });

    document.addEventListener("modal:close", (event) => {
        const origin = modalOrigins.get(event.target);
        if (!origin) return;
        sharedActionContexts.get(event.target)?.trigger?.setAttribute("aria-expanded", "false");
        origin.classList.remove("has-child-modal");
        event.target.classList.remove("modal-over-drawer");
        modalOrigins.delete(event.target);
        sharedActionContexts.delete(event.target);
    });

    window.AIOneSidePop = Object.freeze({
        init: controller.init,
        open: controller.open,
        close: controller.close,
        setVariant,
        setSize,
        setPosition,
        initRuleLists,
        initListActionMenus,
        initRunActionMenus: initListActionMenus,
    });
    document.addEventListener("DOMContentLoaded", () => {
        controller.init();
        initPositionControls();
        initRuleLists();
        initListActionMenus();
    });
    document.addEventListener("app:includes-ready", (event) => {
        controller.init(event.target);
        initPositionControls(event.target);
        initRuleLists(event.target);
        initListActionMenus(event.target);
    });
})();

/* End: 사이드 팝업 (Side Pop) */

/* Start: 텍스트 입력 영역 (Textarea) */

(() => {
    function bindCharacterCount(field) {
        if (!field || field.dataset.characterCountReady === "true") return;

        const textarea = field.querySelector("textarea[maxlength]");
        const currentCount = field.querySelector("[data-character-current]");
        if (!textarea || !currentCount) return;

        const sync = () => {
            currentCount.textContent = String(textarea.value.length);
        };
        textarea.addEventListener("input", sync);
        field.dataset.characterCountReady = "true";
        sync();
    }

    function init(root = document) {
        if (root.matches?.("[data-character-count]")) bindCharacterCount(root);
        root.querySelectorAll?.("[data-character-count]").forEach(bindCharacterCount);
    }

    window.AIOneTextarea = Object.freeze({ init });

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => init(), { once: true });
    } else {
        init();
    }
    document.addEventListener("app:includes-ready", (event) => init(event.target));
})();

/* End: 텍스트 입력 영역 (Textarea) */

/* Start: 토스트 (Toast) */

(() => {
    const timers = new WeakMap();

    function resolve(target) {
        if (target instanceof Element) return target;
        if (typeof target === "string") return document.querySelector(target);
        return document.querySelector("[data-toast]");
    }

    function hide(target) {
        const toast = resolve(target);
        if (!toast) return;

        const currentTimers = timers.get(toast);
        if (currentTimers) {
            clearTimeout(currentTimers.hide);
            clearTimeout(currentTimers.hidden);
        }

        toast.classList.remove("is-visible");
        const hiddenTimer = window.setTimeout(() => {
            if (!toast.classList.contains("is-visible")) toast.hidden = true;
        }, 200);
        timers.set(toast, { hide: 0, hidden: hiddenTimer });
    }

    function show(message, options = {}) {
        const toast = resolve(options.target);
        if (!toast) return null;

        const messageElement = toast.querySelector("[data-toast-message]") || toast;
        messageElement.textContent = String(message ?? "");
        toast.hidden = false;
        toast.setAttribute("role", toast.getAttribute("role") || "status");
        toast.setAttribute("aria-live", toast.getAttribute("aria-live") || "polite");
        toast.setAttribute("aria-atomic", "true");

        const currentTimers = timers.get(toast);
        if (currentTimers) {
            clearTimeout(currentTimers.hide);
            clearTimeout(currentTimers.hidden);
        }

        window.requestAnimationFrame(() => toast.classList.add("is-visible"));

        const duration = Number.isFinite(Number(options.duration)) ? Math.max(0, Number(options.duration)) : 2000;
        const hideTimer = duration > 0 ? window.setTimeout(() => hide(toast), duration) : 0;
        timers.set(toast, { hide: hideTimer, hidden: 0 });
        return toast;
    }

    window.AIOneToast = Object.freeze({ show, hide });
})();

/* End: 토스트 (Toast) */

/* Start: 탑바 (Top Bar) */

(() => {
    const FONT_STORAGE_KEY = "ai-one-font-scale";
    const MIN_FONT_PERCENT = 100;
    const MAX_FONT_PERCENT = 150;
    const FONT_STEP = 10;
    const initializedTools = new WeakSet();
    const accessoryOptions = new WeakMap();
    let fontInitialized = false;

    function clampFontPercent(value) {
        const numericValue = Number(value);
        if (!Number.isFinite(numericValue)) return MIN_FONT_PERCENT;
        return Math.min(MAX_FONT_PERCENT, Math.max(MIN_FONT_PERCENT, Math.round(numericValue)));
    }

    function readFontPercent() {
        try {
            const scale = Number(localStorage.getItem(FONT_STORAGE_KEY));
            return Number.isFinite(scale) ? clampFontPercent(scale * 100) : MIN_FONT_PERCENT;
        } catch (error) {
            return MIN_FONT_PERCENT;
        }
    }

    function applyFontPercent(percent) {
        const nextPercent = clampFontPercent(percent);
        const scale = nextPercent / 100;

        document.documentElement.style.setProperty("--ui-font-scale", String(scale));
        try {
            localStorage.setItem(FONT_STORAGE_KEY, String(scale));
        } catch (error) {
            // 저장소를 사용할 수 없는 환경에서는 현재 화면에만 적용합니다.
        }

        document.querySelectorAll("[data-accessory-font-value]").forEach((value) => {
            value.textContent = `${nextPercent}%`;
        });
        document.querySelectorAll("[data-accessory-font-decrease]").forEach((button) => {
            button.disabled = nextPercent <= MIN_FONT_PERCENT;
        });
        document.querySelectorAll("[data-accessory-font-increase]").forEach((button) => {
            button.disabled = nextPercent >= MAX_FONT_PERCENT;
        });
        document.dispatchEvent(
            new CustomEvent("ai-one-font-size-change", {
                detail: { percent: nextPercent, scale },
            }),
        );
    }

    async function toggleFullscreen() {
        try {
            if (document.fullscreenElement) await document.exitFullscreen();
            else await document.documentElement.requestFullscreen();
        } catch (error) {
            document.dispatchEvent(new CustomEvent("topbar:fullscreen-unavailable"));
        }
    }

    function hideFontPanel(tool) {
        tool.querySelector(".accessory-font-panel")?.classList.add("hidden");
        tool.querySelector('[data-accessory-action="font"]')?.setAttribute("aria-expanded", "false");
    }

    function setOpen(tool, shouldOpen) {
        if (!tool) return;
        const trigger = tool.querySelector(".accessory-trigger");
        const menu = tool.querySelector(".accessory-menu");

        tool.classList.toggle("open", shouldOpen);
        trigger?.classList.toggle("active", shouldOpen);
        trigger?.setAttribute("aria-expanded", String(shouldOpen));
        if (menu) menu.hidden = !shouldOpen;
        if (!shouldOpen) hideFontPanel(tool);
    }

    function syncFullscreenButton(button) {
        const enabled = Boolean(document.fullscreenElement);
        if (!button) return enabled;
        const label = enabled ? "전체화면 종료" : "전체화면";
        button.classList.toggle("active", enabled);
        button.setAttribute("aria-pressed", String(enabled));
        button.setAttribute("aria-label", label);
        button.dataset.tooltip = label;
        button.removeAttribute("title");
        const icon = button.querySelector("svg");
        icon?.setAttribute("aria-hidden", "true");
        icon?.querySelector("path")?.setAttribute("d", enabled ? "M8 3v5H3M21 8h-5V3M16 21v-5h5M3 16h5v5" : "M3 8V3h5M16 3h5v5M21 16v5h-5M8 21H3v-5");
        window.AIOneTooltip?.hide(button);
        return enabled;
    }

    function closeOtherTools(currentTool) {
        document.querySelectorAll(".accessory-tool.open").forEach((tool) => {
            if (tool !== currentTool) setOpen(tool, false);
        });
    }

    function initAccessoryTool(tool) {
        if (initializedTools.has(tool)) return;

        const trigger = tool.querySelector(".accessory-trigger");
        const fontPanel = tool.querySelector(".accessory-font-panel");
        if (!trigger) return;

        initializedTools.add(tool);
        tool.dataset.topbarAccessoryReady = "true";
        syncFullscreenButton(tool.querySelector('[data-accessory-action="fullscreen"]'));
        trigger.addEventListener("click", (event) => {
            event.stopPropagation();
            const shouldOpen = !tool.classList.contains("open");
            closeOtherTools(shouldOpen ? tool : null);
            setOpen(tool, shouldOpen);
        });

        tool.querySelectorAll("[data-accessory-action]").forEach((button) => {
            button.addEventListener("click", (event) => {
                event.stopPropagation();
                const action = button.dataset.accessoryAction;
                if (button.disabled || button.classList.contains("is-disabled")) return;

                if (action === "font") {
                    if (!fontPanel) return;
                    const shouldOpen = fontPanel.classList.contains("hidden");
                    fontPanel.classList.toggle("hidden", !shouldOpen);
                    button.setAttribute("aria-expanded", String(shouldOpen));
                    return;
                }

                hideFontPanel(tool);
                const options = accessoryOptions.get(tool) || {};
                if (action === "fullscreen") {
                    if (typeof options.onToggleFullscreen === "function") options.onToggleFullscreen();
                    else toggleFullscreen();
                } else if (action === "panel-size") {
                    if (options.onTogglePanelResize) options.onTogglePanelResize(button);
                    else window.AIOneWorkspaceUi?.togglePanelResizeMode({ button });
                } else if (action === "layout") {
                    window.AIOneWorkspaceUi?.resetPanelLayout();
                }
                tool.dispatchEvent(
                    new CustomEvent("topbar:accessory-action", {
                        bubbles: true,
                        detail: { action },
                    }),
                );
            });
        });

        tool.querySelector("[data-accessory-font-decrease]")?.addEventListener("click", (event) => {
            event.stopPropagation();
            const callback = accessoryOptions.get(tool)?.onFontDecrease;
            if (typeof callback === "function") callback();
            else applyFontPercent(readFontPercent() - FONT_STEP);
        });
        tool.querySelector("[data-accessory-font-increase]")?.addEventListener("click", (event) => {
            event.stopPropagation();
            const callback = accessoryOptions.get(tool)?.onFontIncrease;
            if (typeof callback === "function") callback();
            else applyFontPercent(readFontPercent() + FONT_STEP);
        });
        tool.querySelector(".accessory-font-default")?.addEventListener("click", (event) => {
            event.stopPropagation();
            const callback = accessoryOptions.get(tool)?.onFontDefault;
            if (typeof callback === "function") callback();
            else applyFontPercent(MIN_FONT_PERCENT);
        });
        fontPanel?.addEventListener("click", (event) => event.stopPropagation());
    }

    // 페이지별 기능을 갱신해도 DOM 이벤트는 탑바에서 한 번만 등록합니다.
    // options: onToggleFullscreen, onTogglePanelResize,
    // onFontDecrease, onFontIncrease, onFontDefault, onFullscreenChange, onInit.
    // 동적으로 넣은 탑바는 init(컨테이너), 기능 연결은 configure(도구, options)를 사용합니다.
    function configure(tool, options = {}) {
        if (!tool) return null;
        accessoryOptions.set(tool, { ...accessoryOptions.get(tool), ...options });
        initAccessoryTool(tool);
        if (options.onFontIncrease || options.onFontDecrease || options.onFontDefault) fontInitialized = true;
        options.onInit?.();
        return tool;
    }

    function init(root = document) {
        const tools = [];
        if (root instanceof Element && root.matches("[data-accessory-tools]")) tools.push(root);
        root.querySelectorAll?.("[data-accessory-tools]").forEach((tool) => tools.push(tool));
        tools.forEach(initAccessoryTool);
        if (!fontInitialized) {
            fontInitialized = true;
            applyFontPercent(readFontPercent());
        }
    }

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") closeOtherTools(null);
    });
    document.addEventListener("click", (event) => {
        if (!event.target.closest(".accessory-tool")) closeOtherTools(null);
    });
    document.addEventListener("component:ready", (event) => {
        if (event.detail?.name === "topbar") init(event.target);
    });
    document.addEventListener("fullscreenchange", () => {
        document.querySelectorAll("[data-accessory-tools]").forEach((tool) => {
            if (!initializedTools.has(tool)) return;
            syncFullscreenButton(tool.querySelector('[data-accessory-action="fullscreen"]'));
            accessoryOptions.get(tool)?.onFullscreenChange?.();
        });
    });
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => init());
    else init();

    // Start: 261026 수정 - 공통 탑바 제목 표시 및 편집
    // 제목 UI는 탑바가 소유하고, 화면은 getTitle/saveTitle로 데이터만 연결합니다.
    // saveTitle은 저장 성공 후 화면 데이터를 갱신합니다. 실패 시 기존 데이터를 유지하고 오류를 처리합니다.
    // 같은 버튼을 다시 연결해도 이벤트는 한 번만 등록합니다.
    const titleEditors = new WeakMap();
    function createTitleEditor({ button, text, input, getTitle, saveTitle, editLabel, maxDisplayLength = 30, emptyTitle = "", onError } = {}) {
        if (!button || !text || !input) return null;
        if (titleEditors.has(button)) return titleEditors.get(button);
        let editing = false;
        let saving = false;
        const readTitle = () => String(getTitle?.() ?? "");
        text.setAttribute("data-workspace-title-text", "");
        if (editLabel) button.setAttribute("aria-label", editLabel);
        button.setAttribute("data-tooltip", "클릭하여 제목 수정");
        button.removeAttribute("title");
        input.setAttribute("draggable", "false");

        function render() {
            const title = readTitle();
            const characters = Array.from(title);
            text.textContent = characters.length > maxDisplayLength ? characters.slice(0, maxDisplayLength).join("").trimEnd() + "..." : title;
            text.removeAttribute("data-tooltip");
            text.removeAttribute("title");
            if (!editing) input.value = title;
            button.classList.toggle("hidden", editing);
            input.classList.toggle("hidden", !editing);
        }
        function open() {
            if (saving || editing) return;
            input.value = readTitle();
            editing = true;
            render();
            input.focus();
            input.select();
        }
        async function close(save, restoreFocus = false) {
            if (saving || !editing) return;
            const previousTitle = readTitle();
            const nextTitle = input.value.trim() || emptyTitle;
            saving = true;
            input.disabled = true;
            try {
                if (save && nextTitle && nextTitle !== previousTitle) {
                    await saveTitle?.(nextTitle);
                }
            } catch (error) {
                if (onError) onError(error);
                else console.error("탑바 제목 저장 실패", error);
            } finally {
                saving = false;
                editing = false;
                input.disabled = false;
                render();
                if (restoreFocus) button.focus();
            }
        }
        button.addEventListener("click", open);
        input.addEventListener("keydown", (event) => {
            if (event.isComposing) return;
            if (event.key === "Enter" || event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                void close(event.key === "Enter", true);
            }
        });
        input.addEventListener("blur", () => {
            void close(true);
        });
        ["pointerdown", "mousedown", "click"].forEach((type) => {
            input.addEventListener(type, (event) => event.stopPropagation());
        });
        input.addEventListener("dragstart", (event) => event.preventDefault());
        const editor = Object.freeze({ render });
        titleEditors.set(button, editor);
        render();
        return editor;
    }

    // End: 261026 수정 - 공통 탑바 제목 표시 및 편집

    window.AIOneTopbar = Object.freeze({ init, configure, createTitleEditor, setOpen, applyFontPercent, syncFullscreenButton });
})();

/* End: 탑바 (Top Bar) */

window.AIOneSharedBundle = Object.freeze({ assetsBundled: true });

/* Start: 아이콘 하이드레이션 (Icon Hydration) */
(() => {
    const commonScriptUrl = Array.from(document.scripts)
        .map((script) => script.src)
        .find((scriptUrl) => /\/js\/common\.js(?:[?#]|$)/.test(scriptUrl));
    const iconBaseUrl = commonScriptUrl ? new URL("../assets/icons/", commonScriptUrl) : new URL("../../assets/icons/", document.currentScript?.src || document.baseURI);

    function hydrateIcons(root = document) {
        root.querySelectorAll?.("img[data-icon]").forEach((icon) => {
            if (icon.src) return;
            icon.src = new URL(`${icon.dataset.icon}.svg`, iconBaseUrl).href;
        });
    }

    window.AIOneIcons = Object.freeze({ hydrate: hydrateIcons });
})();
/* End: 아이콘 하이드레이션 (Icon Hydration) */

/* Start: 워크스페이스 공통 유틸 (Workspace Common) */

(() => {
    const DEFAULT_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

    // 원문을 유지하고 모바일 표시 전환은 CSS에서 처리합니다.
    function renderDisplayTitle(element, value, maxLength = 30) {
        const title = String(value ?? "");
        const characters = Array.from(title);
        if (characters.length <= maxLength) {
            element.textContent = title;
            return;
        }
        const full = document.createElement("span");
        full.className = "display-title-full";
        full.textContent = title;
        const short = document.createElement("span");
        short.className = "display-title-short";
        short.textContent = characters.slice(0, maxLength).join("").trimEnd() + "...";
        element.replaceChildren(full, short);
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function showToast(message, options = {}) {
        const text = String(message || "");
        if (window.AIOneToast?.show) {
            window.AIOneToast.show(text, {
                target: options.target || "#toast",
                duration: Number(options.duration) || 2500,
            });
            return;
        }

        if (typeof options.fallback === "function") {
            options.fallback(text);
            return;
        }

        console.log(text);
    }

    function setCookie(name, value, options = {}) {
        const maxAge = Number.isFinite(Number(options.maxAge)) ? Number(options.maxAge) : DEFAULT_COOKIE_MAX_AGE;
        document.cookie = encodeURIComponent(name) + "=" + encodeURIComponent(String(value)) + "; path=" + (options.path || "/") + "; max-age=" + maxAge + "; SameSite=" + (options.sameSite || "Lax");
    }

    function getCookie(name) {
        const key = encodeURIComponent(name) + "=";
        const item = document.cookie.split("; ").find((part) => part.indexOf(key) === 0);
        return item ? decodeURIComponent(item.slice(key.length)) : "";
    }

    function deleteCookie(name, options = {}) {
        document.cookie = encodeURIComponent(name) + "=; path=" + (options.path || "/") + "; max-age=0; SameSite=" + (options.sameSite || "Lax");
    }

    function setAccessoryOpen(tool, open) {
        window.AIOneTopbar.setOpen(tool, open);
    }

    function syncBrowserFullscreenButton(options = {}) {
        const button = document.querySelector(options.selector || '[data-accessory-action="fullscreen"]');
        const enabled = window.AIOneTopbar.syncFullscreenButton(button);
        if (button) options.onChange?.(enabled, button);
        return enabled;
    }

    async function toggleBrowserFullscreen(options = {}) {
        try {
            if (document.fullscreenElement) {
                await document.exitFullscreen();
            } else {
                await document.documentElement.requestFullscreen();
            }
        } catch (error) {
            console.warn("전체화면 실패", error);
            options.onError?.(error);
        }
    }

    function initAccessoryTools(options = {}) {
        const tool = document.querySelector(options.selector || "[data-accessory-tools]");
        if (!tool) return null;

        const readyKey = options.readyKey || "workspaceAccessoryReady";
        if (tool.dataset[readyKey] === "true") return tool;
        tool.dataset[readyKey] = "true";

        // 기존 페이지 API는 유지하고 이벤트 소유권은 공통 탑바에 위임합니다.
        window.AIOneTopbar.configure(tool, {
            ...options,
        });
        return tool;
    }

    function getPanels(container, selector = ":scope > .panel") {
        return container ? Array.from(container.querySelectorAll(selector)) : [];
    }

    function getPanelHandles(container, selector = ":scope > .panel-resize-handle") {
        return container ? Array.from(container.querySelectorAll(selector)) : [];
    }

    function getPanelKey(panel, index = 0, options = {}) {
        const includeSlot = options.includeSlot !== false;
        return panel?.dataset?.panel || (includeSlot ? panel?.dataset?.slot : "") || panel?.id || `panel-${index}`;
    }

    function getAvailablePanelWidth(container, handles) {
        if (!container) return 0;

        const style = window.getComputedStyle(container);
        const horizontalPadding = parseFloat(style.paddingLeft || 0) + parseFloat(style.paddingRight || 0);
        const handleWidth = Array.from(handles || []).reduce((sum, handle) => sum + handle.getBoundingClientRect().width, 0);

        return Math.max(0, container.clientWidth - horizontalPadding - handleWidth);
    }

    function fitPanelWidths(options = {}) {
        const order = Array.isArray(options.order) ? options.order : [];
        const widthsByPanel = options.widthsByPanel || {};
        const getMinimum = options.getMinimum || (() => 180);
        const getAvailableWidth = options.getAvailableWidth || (() => 0);
        const flexibleKey = options.flexibleKey || "center";

        const mins = order.map((key, index) => Math.max(0, Number(getMinimum(key, index)) || 0));
        const widths = order.map((key, index) => Math.max(mins[index], Math.round(Number(widthsByPanel[key]) || mins[index])));

        let delta = Math.round(Number(getAvailableWidth()) - widths.reduce((sum, width) => sum + width, 0));
        const flexibleIndex = Math.max(0, order.indexOf(flexibleKey));

        if (delta > 0) {
            widths[flexibleIndex] += delta;
        } else if (delta < 0) {
            let deficit = -delta;
            const shrinkOrder = [flexibleIndex, ...widths.map((_, index) => index).filter((index) => index !== flexibleIndex)];

            shrinkOrder.forEach((index) => {
                if (deficit <= 0) return;
                const reducible = Math.max(0, widths[index] - mins[index]);
                const reduction = Math.min(deficit, reducible);
                widths[index] -= reduction;
                deficit -= reduction;
            });
        }

        return widths;
    }

    /* Start: 261023 추가 - 기존 빈 화면 컴포넌트를 사용하는 필터 결과 안내 */
    function createFilterEmpty(title, description) {
        const empty = document.createElement("div");
        empty.className = "empty-state filter-empty-state";
        const iconWrap = document.createElement("div");
        iconWrap.className = "no-file-icon";
        iconWrap.setAttribute("aria-hidden", "true");
        const icon = document.createElement("img");
        icon.src = "../assets/icons/no-file.svg";
        icon.alt = "";
        icon.setAttribute("aria-hidden", "true");
        const heading = document.createElement("strong");
        heading.className = "empty-title";
        heading.textContent = title;
        const detail = document.createElement("span");
        detail.className = "empty-desc";
        detail.textContent = description;
        iconWrap.append(icon);
        empty.append(iconWrap, heading, detail);
        return empty;
    }
    /* End: 261023 추가 - 기존 빈 화면 컴포넌트를 사용하는 필터 결과 안내 */

    window.AIOneWorkspaceCommon = Object.freeze({
        renderDisplayTitle,
        createFilterEmpty,
        escapeHtml,
        showToast,
        setCookie,
        getCookie,
        deleteCookie,
        setAccessoryOpen,
        syncBrowserFullscreenButton,
        toggleBrowserFullscreen,
        initAccessoryTools,
        getPanels,
        getPanelHandles,
        getPanelKey,
        getAvailablePanelWidth,
        fitPanelWidths,
    });
})();

/* End: 워크스페이스 공통 유틸 (Workspace Common) */

/* Start: 공통 대화 목록 Drawer */

(() => {
    const PAGE_SIZE = 10;
    const SCROLL_THRESHOLD = 24;
    const SORT_OPTIONS = Object.freeze([
        ["latest", "최신순"],
        ["oldest", "과거순"],
    ]);

    function normalizeId(item) {
        return String(item?.id ?? item?.conversation_id ?? "").trim();
    }

    function getTitle(item, fallback = "제목 없는 대화") {
        return String(item?.display_title || item?.title || fallback).trim() || fallback;
    }

    function setSortOptions(select, value = "latest") {
        if (!select) return;
        select.replaceChildren(
            ...SORT_OPTIONS.map(([optionValue, label]) => {
                const option = document.createElement("option");
                option.value = optionValue;
                option.textContent = label;
                return option;
            }),
        );
        select.value = SORT_OPTIONS.some(([optionValue]) => optionValue === value) ? value : "latest";
        syncSortWidth(select);
    }

    function syncSortWidth(select) {
        if (!select) return;
        const option = select.options?.[select.selectedIndex];
        const label = String(option?.textContent || "").trim();
        const probe = document.createElement("span");
        const computed = window.getComputedStyle(select);

        probe.textContent = label;
        probe.className = "conversation-sort-width-probe";
        probe.style.font = computed.font;
        document.body.appendChild(probe);

        const textWidth = Math.ceil(probe.getBoundingClientRect().width);
        probe.remove();
        select.style.width = `${Math.max(70, textWidth + 30)}px`;
    }

    function formatDateTime(value, options = {}) {
        const raw = String(value || "").trim();
        if (!raw) return { date: "", time: "", combined: "" };

        const date = new Date(raw);
        if (Number.isNaN(date.getTime())) {
            const combined = raw.replace("T", " ").slice(0, 16);
            return {
                date: combined.slice(0, 10),
                time: combined.slice(11, 16),
                combined,
            };
        }

        const timeZone = options.timeZone || "Asia/Seoul";
        const parts = new Intl.DateTimeFormat("ko-KR", {
            timeZone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hourCycle: "h23",
        }).formatToParts(date);
        const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
        const separator = options.dateSeparator ?? ".";
        const dateText = [values.year, values.month, values.day].join(separator);
        const timeText = `${values.hour}:${values.minute}`;

        return {
            date: dateText,
            time: timeText,
            combined: `${dateText} ${timeText}`,
        };
    }

    function sortItems(items, mode = "latest", options = {}) {
        const rows = Array.isArray(items) ? items.slice() : [];
        const pinnedFirst = options.pinnedFirst !== false;
        const titleOf = options.getTitle || getTitle;

        rows.sort((a, b) => {
            if (pinnedFirst) {
                const favoriteDiff = Number(Boolean(b?.is_favorite)) - Number(Boolean(a?.is_favorite));
                if (favoriteDiff !== 0) return favoriteDiff;
            }

            if (mode === "oldest") {
                return new Date(a?.created_at || 0) - new Date(b?.created_at || 0);
            }
            if (mode === "modified") {
                return new Date(b?.updated_at || b?.created_at || 0) - new Date(a?.updated_at || a?.created_at || 0);
            }
            if (mode === "title") {
                return titleOf(a).localeCompare(titleOf(b), "ko-KR", {
                    numeric: true,
                    sensitivity: "base",
                });
            }
            return new Date(b?.created_at || 0) - new Date(a?.created_at || 0);
        });

        return rows;
    }

    function filterItems(items, query) {
        const keyword = String(query || "")
            .trim()
            .toLocaleLowerCase("ko-KR");
        return (items || []).filter((item) => getTitle(item).toLocaleLowerCase("ko-KR").includes(keyword));
    }

    // 모달 완료 이벤트의 형식은 공통에서 정규화하고 저장 방식은 화면에 위임한다.
    function bindActions({ drawer, type = "chat", onAction, onError }) {
        const eventName = type === "run" ? "sidepop:run-action" : "sidepop:chat-action";
        const listener = async (event) => {
            const detail = event.detail || {};
            const conversationId = String(detail.item?.dataset?.conversationId || "");
            if (!detail.completed || !conversationId) return;
            if (!["pin", "rename", "delete", "share"].includes(detail.action)) return;
            const title = String(detail.title || "").trim();
            if (detail.action === "rename" && !title) return;
            try {
                await onAction?.({ ...detail, conversationId, title, pinned: Boolean(detail.pinned) });
            } catch (error) {
                console.error("목록 작업 처리 실패", error);
                if (onError) onError(error);
                else window.AIOneWorkspaceCommon.showToast("목록 작업을 처리하지 못했습니다.");
            }
        };
        drawer?.addEventListener(eventName, listener);
        return () => drawer?.removeEventListener(eventName, listener);
    }

    // 미리보기 목록만 사용한다. 실제 API 화면은 bindActions의 onAction에서 저장한다.
    function applyLocalAction(items, detail) {
        const item = items.find((entry) => normalizeId(entry) === detail.conversationId);
        if (!item) return { items, item: null };
        if (detail.action === "pin") item.is_favorite = detail.pinned;
        if (detail.action === "rename") {
            item.title = detail.title;
            if (Object.hasOwn(item, "display_title")) item.display_title = detail.title;
        }
        return { items: detail.action === "delete" ? items.filter((entry) => entry !== item) : items, item };
    }

    function bindControls(options = {}) {
        const search = options.search;
        const searchButton = options.searchButton;
        const searchClear = options.searchClear;
        const sort = options.sort;
        const list = options.list;
        const threshold = Number(options.scrollThreshold) || SCROLL_THRESHOLD;

        if (sort) {
            setSortOptions(sort, options.sortValue || "latest");
        }

        const requestSearch = () => {
            const value = String(search?.value || "").trim();
            options.onSearch?.(value);
        };

        searchButton?.addEventListener("click", requestSearch);
        search?.addEventListener("keydown", (event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            requestSearch();
        });
        search?.addEventListener("input", () => {
            const hasValue = String(search.value || "").trim().length > 0;
            searchClear?.classList.toggle("hidden", !hasValue);
            options.onSearchInput?.(search.value);
        });
        searchClear?.addEventListener("click", () => {
            if (search) {
                search.value = "";
                search.focus();
            }
            searchClear.classList.add("hidden");
            options.onClear?.();
        });
        sort?.addEventListener("change", () => {
            syncSortWidth(sort);
            options.onSort?.(String(sort.value || "latest"));
        });
        list?.addEventListener(
            "scroll",
            () => {
                if (options.isLoading?.()) return;
                if (!options.hasNext?.()) return;

                const remaining = list.scrollHeight - list.scrollTop - list.clientHeight;
                if (remaining <= threshold) {
                    options.onLoadMore?.();
                }
            },
            { passive: true },
        );

        return {
            requestSearch,
            syncSortWidth: () => syncSortWidth(sort),
        };
    }

    // Start: 261015 수정 - 답변서 채팅 목록 카드 렌더링
    // 적용: html/ai-answer.html, html/work-support.html의 #chatTopics. panel-conversation.js의 renderConversationHistory에서 호출한다.
    // 업무지원은 showIcon: false를 전달하고, 다른 호출은 기존 아이콘 표시를 유지한다.
    // 상태점 옆에 제목과 날짜·상태를 배치하고, 더보기는 진행 상태와 관계없이 표시한다.
    // 상태 배지는 진행중 > 실패 > 완료 순으로 판정한다. 완료는 진행중·실패가 아닐 때의 기본 표시다.
    // isCompleted는 상태 배지와 별개인 미확인 완료점이며, 날짜·상태는 aria-describedby로 연결한다.
    // 모든 실행 목록에서 같은 배지 DOM과 색상 변형을 사용한다.
    function createBadges(items = []) {
        if (!items.length) return null;
        const group = document.createElement("span");
        group.className = "drawer-run-badges";
        items.forEach(({ text, variant }) => {
            const badge = document.createElement("span");
            badge.className = "drawer-run-badge";
            if (["member", "query", "review"].includes(variant)) badge.classList.add(variant);
            badge.textContent = text;
            group.append(badge);
        });
        return group;
    }

    function createEmpty(message, tagName = "div") {
        const content = window.AIOneWorkspaceCommon.createFilterEmpty(message, "");
        content.className = "empty-state drawer-list-empty";
        content.querySelector(".no-file-icon").classList.add("type1");
        content.querySelector(".empty-title").classList.add("type1");
        content.querySelector(".empty-desc").remove();
        if (tagName === "li") {
            const item = document.createElement("li");
            item.append(content);
            return item;
        }
        return content;
    }

    function renderChatItems(options = {}) {
        const list = options.list;
        if (!list) return;

        const escapeHtml = window.AIOneWorkspaceCommon?.escapeHtml || ((value) => String(value ?? ""));
        const items = sortItems(options.items, options.sortMode, { pinnedFirst: true });
        const activeId = String(options.activeId || "");
        const titleMax = Number(options.titleMax) || 24;

        const loading = list.querySelector(":scope > .drawer-list-loading-more");
        const scrollTop = list.scrollTop;
        list.replaceChildren();
        if (!items.length && options.emptyMessage) list.append(createEmpty(options.emptyMessage));
        items.forEach((item, index) => {
            const id = normalizeId(item);
            const title = getTitle(item, options.fallbackTitle);
            const displayTitle = title.length > titleMax ? `${title.slice(0, titleMax).trimEnd()}...` : title;
            const pinned = Boolean(item?.is_favorite);
            const pending = Boolean(options.isPending?.(item, id));
            const failed = !pending && Boolean(options.isFailed?.(item, id));
            const statusClass = pending ? " pending" : failed ? " failed" : "";
            const statusLabel = pending ? "진행중" : failed ? "실패" : "완료";
            const completed = Boolean(options.isCompleted?.(item, id));
            const rawDate = item?.updated_at || item?.created_at || "";
            const dateTime = formatDateTime(rawDate, { dateSeparator: "." });
            const metaId = `${list.id || "conversation-list"}-meta-${index + 1}`;

            const row = document.createElement("div");
            row.className = "drawer-chat-item sidepop-chat-item chat-topic" + (id === activeId ? " is-active active" : "") + (pinned ? " is-pinned" : "");
            row.dataset.conversationId = id;
            row.dataset.pinned = String(pinned);
            row.innerHTML =
                '<button type="button" class="drawer-chat-select sidepop-chat-select" ' +
                'aria-label="' +
                escapeHtml(title) +
                ' 대화 열기" aria-describedby="' +
                escapeHtml(metaId) +
                '">' +
                '<span class="drawer-run-state drawer-chat-state' +
                statusClass +
                '" aria-hidden="true"></span>' +
                '<span class="drawer-run-main drawer-chat-main">' +
                '<span class="drawer-chat-name sidepop-chat-name">' +
                // (options.showIcon !== false ? '<span class="drawer-chat-icon sidepop-chat-icon" aria-hidden="true">💬</span>' : "") +
                (completed ? '<span class="nav-complete-dot" aria-hidden="true"></span>' : "") +
                '<span class="drawer-chat-name-text" title="' +
                escapeHtml(title) +
                '">' +
                escapeHtml(displayTitle) +
                "</span>" +
                "</span>" +
                '<span class="drawer-run-meta" id="' +
                escapeHtml(metaId) +
                '">' +
                '<time class="drawer-chat-time sidepop-chat-time">' +
                escapeHtml(dateTime.combined) +
                "</time>" +
                '<span class="drawer-run-status drawer-chat-status' +
                statusClass +
                '">' +
                statusLabel +
                "</span>" +
                "</span>" +
                "</span>" +
                "</button>" +
                createMoreButton();

            const badges = createBadges(options.getBadges?.(item, id));
            if (badges) row.querySelector(".drawer-chat-main").append(badges);
            row.querySelector(".drawer-chat-select")?.addEventListener("click", () => {
                options.onSelect?.(item, id);
            });
            list.appendChild(row);
            window.AIOneSidePop?.initListActionMenus?.(row);
        });

        if (loading) list.append(loading);
        list.scrollTop = scrollTop;
        options.totalElement && (options.totalElement.textContent = String(options.total ?? items.length));
    }
    // End: 261015 수정 - 답변서 채팅 목록 카드 렌더링

    // 이미 받은 로컬 이력의 행을 나눠 표시한다. 서버 페이징 목록에는 사용하지 않는다.
    function bindLocalPagination({ list, drawer, pageSize = PAGE_SIZE }) {
        const size = Math.max(1, Math.floor(Number(pageSize) || PAGE_SIZE));
        let pending = [];
        let visibleCount = size;
        let resetKey;
        let timer = null;

        function cancel() {
            if (timer === null) return;
            clearTimeout(timer);
            timer = null;
            window.AIOneDrawerLoading.hide(list);
        }

        function paginate(key = "") {
            cancel();
            if (key !== resetKey) {
                visibleCount = size;
                list.scrollTop = 0;
                resetKey = key;
            }
            const rows = Array.from(list.children).filter((row) => row.matches("[data-conversation-id]"));
            pending = rows.slice(visibleCount);
            pending.forEach((row) => row.remove());
        }

        list.addEventListener(
            "scroll",
            () => {
                if (timer !== null || !pending.length || list.getAttribute("aria-busy") === "true") return;
                if (list.scrollHeight - list.scrollTop - list.clientHeight > SCROLL_THRESHOLD) return;
                window.AIOneDrawerLoading.show(list, "목록", { append: true });
                // 로컬 예시도 첫 조회와 동일한 준비 시간을 사용한다.
                timer = setTimeout(() => {
                    timer = null;
                    window.AIOneDrawerLoading.hide(list);
                    const next = pending.splice(0, size);
                    visibleCount += next.length;
                    list.append(...next);
                }, 400);
            },
            { passive: true },
        );
        drawer?.addEventListener("sidepop:close", cancel);
        drawer?.addEventListener("sidepop:open", () => {
            cancel();
            visibleCount = size;
            resetKey = undefined;
        });
        return { paginate };
    }

    function createMoreButton() {
        return (
            '<button type="button" class="btn-more" aria-label="더보기" title="더보기" ' +
            'aria-haspopup="menu" aria-expanded="false">' +
            '<svg viewBox="0 0 24 24" aria-hidden="true">' +
            '<circle cx="12" cy="5" r="1.7"></circle>' +
            '<circle cx="12" cy="12" r="1.7"></circle>' +
            '<circle cx="12" cy="19" r="1.7"></circle>' +
            "</svg>" +
            "</button>"
        );
    }

    window.AIOneConversationDrawer = Object.freeze({
        PAGE_SIZE,
        SCROLL_THRESHOLD,
        SORT_OPTIONS,
        normalizeId,
        getTitle,
        setSortOptions,
        syncSortWidth,
        formatDateTime,
        sortItems,
        bindControls,
        bindLocalPagination,
        bindActions,
        applyLocalAction,
        filterItems,
        renderChatItems,
        createEmpty,
        createBadges,
    });
})();

/* End: 공통 대화 목록 Drawer */

/* Start: 공통 로딩 오버레이 */

(() => {
    function remove(selector, options = {}) {
        if (!selector) return;
        document.querySelectorAll(selector).forEach((overlay) => {
            const container = options.resolveContainer?.(overlay) || overlay.parentElement;
            overlay.remove();
            if (options.ariaBusy !== false && container) {
                container.removeAttribute("aria-busy");
            }
        });
    }

    function mount(options = {}) {
        const container = options.container;
        const overlay = options.overlay;
        if (!(container instanceof Element) || !(overlay instanceof Element)) return null;

        if (options.replaceSelector) {
            remove(options.replaceSelector, {
                ariaBusy: options.ariaBusy,
                resolveContainer: options.resolveContainer,
            });
        }

        if (options.ariaBusy !== false) {
            container.setAttribute("aria-busy", "true");
        }
        container.appendChild(overlay);
        return overlay;
    }

    /* Start: 261026 추가 - 공통 문서·목록 로딩 UI 생성 */
    function create({ message = "목록을 불러오고 있습니다", title = "", preview = false, count = 4 } = {}) {
        const overlay = document.createElement("div");
        overlay.className = "api-skeleton-overlay";
        overlay.setAttribute("role", "status");
        overlay.setAttribute("aria-live", "polite");
        if (preview) overlay.classList.add("document-loading-preview");
        if (title) {
            const heading = document.createElement("strong");
            heading.textContent = title;
            overlay.append(heading);
        }
        const label = document.createElement("div");
        label.className = "skeleton-loading-label";
        label.textContent = message;
        overlay.append(label);
        if (!preview) {
            const cards = document.createElement("div");
            cards.className = "loading-skeleton-list";
            cards.setAttribute("aria-hidden", "true");
            for (let index = 0; index < count; index += 1) {
                const card = document.createElement("div");
                card.className = "skeleton-card";
                ["lg", "full", "md"].forEach((size) => {
                    const line = document.createElement("div");
                    line.className = `ai-skeleton skeleton-line ${size}`;
                    card.append(line);
                });
                cards.append(card);
            }
            overlay.append(cards);
        }
        return overlay;
    }
    /* End: 261026 추가 - 공통 문서·목록 로딩 UI 생성 */

    // 문서 렌더러가 내용을 교체해도 로딩 UI는 유지하고, 최신 요청만 해제한다.
    const documentLoads = new WeakMap();
    async function preview(container, fileName, render) {
        if (!container?.parentElement) return render();
        const host = container.parentElement;
        documentLoads.get(container)?.remove();
        if (!fileName) {
            documentLoads.delete(container);
            container.classList.remove("document-preview-loading-content");
            host.classList.remove("document-preview-loading-host");
            host.removeAttribute("aria-busy");
            return render();
        }
        const overlay = create({ preview: true, title: "문서 미리보기를 불러오는 중입니다", message: fileName });
        overlay.classList.add("document-preview-loading");
        documentLoads.set(container, overlay);
        host.classList.add("document-preview-loading-host");
        container.classList.add("document-preview-loading-content");
        mount({ container: host, overlay });
        // 초기 스크립트 실행 시간이 아닌, 브라우저가 로딩 UI를 그린 뒤부터 표시 시간을 센다.
        const visible = new Promise((resolve) => {
            requestAnimationFrame(() =>
                requestAnimationFrame(() => {
                    setTimeout(resolve, window.AIOnePreview?.enabled ? 600 : 200);
                }),
            );
        });
        try {
            return await render();
        } finally {
            await visible;
            if (documentLoads.get(container) === overlay) {
                documentLoads.delete(container);
                overlay.remove();
                container.classList.remove("document-preview-loading-content");
                host.classList.remove("document-preview-loading-host");
                host.removeAttribute("aria-busy");
            }
        }
    }

    // 정적 목업과 페이지 전용 렌더러도 같은 문서 로딩 계약을 사용한다.
    function initDocumentPreviews() {
        document.querySelectorAll("[data-document-loading-name]").forEach((container) => {
            const show = () => {
                if (documentLoads.has(container) || container.hidden || !container.children.length) return;
                if (container.querySelector(".empty-state, .answer-recommend-empty, .answer-pdf-error, .answer-pdf-loading")) return;
                const name = document.querySelector(container.dataset.documentLoadingName)?.textContent.trim();
                if (name) preview(container, name, () => {});
            };
            new MutationObserver(show).observe(container, { childList: true });
            show();
        });
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initDocumentPreviews, { once: true });
    else initDocumentPreviews();

    window.AIOneLoadingOverlay = Object.freeze({
        create,
        preview,
        mount,
        remove,
    });
})();

/* End: 공통 로딩 오버레이 */

/* Start: 261026 추가 - Drawer 목록 공통 조회 상태 */
(() => {
    const states = new WeakMap();
    function hide(list) {
        if (!list) return;
        const state = states.get(list);
        const restoreScroll = state?.scrollTop != null && Math.abs(list.scrollTop - state.loadingScrollTop) < 1;
        state?.overlay.remove();
        if (restoreScroll) list.scrollTop = state.scrollTop;
        states.delete(list);
        list.removeAttribute("aria-busy");
        list.classList.remove("is-drawer-loading");
    }
    function show(list, name = "목록", { append = false } = {}) {
        if (!list) return;
        hide(list);
        if (append) {
            const scrollTop = list.scrollTop;
            const row = document.createElement(list.matches("ul, ol") ? "li" : "div");
            row.className = "drawer-list-loading-more";
            const status = document.createElement("span");
            status.className = "ai-search-banner is-loading";
            status.setAttribute("role", "status");
            status.setAttribute("aria-live", "polite");
            const spinner = document.createElement("span");
            spinner.className = "source-search-spinner";
            spinner.setAttribute("aria-hidden", "true");
            const label = document.createElement("span");
            label.textContent = "이전 목록 불러오는 중";
            status.append(spinner, label);
            row.append(status);
            window.AIOneLoadingOverlay.mount({ container: list, overlay: row });
            // 생성결과 목록처럼 일반 흐름의 마지막 행을 실제로 보이게 한다.
            // 고정 위치를 사용하지 않아 마지막 카드와 겹치지 않는다.
            list.scrollTop = list.scrollHeight;
            states.set(list, { overlay: row, scrollTop, loadingScrollTop: list.scrollTop });
            return;
        }
        const overlay = window.AIOneLoadingOverlay.create({ message: `${name}을 불러오고 있습니다` });
        overlay.classList.add("drawer-list-loading");
        list.classList.add("is-drawer-loading");
        list.scrollTop = 0;
        window.AIOneLoadingOverlay.mount({ container: list, overlay });
        states.set(list, { overlay });
    }
    async function run(list, name, render) {
        show(list, name);
        try {
            // 로컬 예시도 첫 목록을 준비하는 동안 동일한 상태를 표시한다.
            await new Promise((resolve) => setTimeout(resolve, 400));
            return await render();
        } finally {
            hide(list);
        }
    }
    window.AIOneDrawerLoading = Object.freeze({ show, hide, run });
})();
/* End: 261026 추가 - Drawer 목록 공통 조회 상태 */

/* Start: 워크스페이스 UI 컨트롤러 */

(() => {
    function clamp(value, min, max) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return min;
        return Math.min(max, Math.max(min, Math.round(numeric)));
    }

    function createFontController(options = {}) {
        const min = Number(options.min) || 100;
        const max = Number(options.max) || 150;
        const step = Number(options.step) || 10;
        const defaultValue = Number(options.defaultValue) || min;
        const cookieKey = String(options.cookieKey || "");
        const cookieMaxAge = Number(options.cookieMaxAge) || 60 * 60 * 24 * 365;
        let currentValue;

        function read() {
            if (currentValue !== undefined) return currentValue;
            const saved = cookieKey ? window.AIOneWorkspaceCommon.getCookie(cookieKey) : "";
            currentValue = clamp(Number(saved) || defaultValue, min, max);
            return currentValue;
        }

        function apply(value, persist = true) {
            const next = clamp(value, min, max);
            currentValue = next;
            document.documentElement.style.setProperty("--ui-font-scale", String(next / 100));

            document.querySelectorAll("[data-accessory-font-value]").forEach((element) => {
                element.textContent = `${next}%`;
            });
            document.querySelectorAll("[data-accessory-font-decrease]").forEach((button) => {
                button.disabled = next <= min;
            });
            document.querySelectorAll("[data-accessory-font-increase]").forEach((button) => {
                button.disabled = next >= max;
            });

            if (persist && cookieKey) {
                window.AIOneWorkspaceCommon.setCookie(cookieKey, String(next), {
                    maxAge: cookieMaxAge,
                });
            }
            return next;
        }

        return Object.freeze({
            read,
            apply,
            decrease: () => apply(read() - step),
            increase: () => apply(read() + step),
            reset: () => apply(defaultValue),
        });
    }

    function togglePanelResizeMode(options = {}) {
        const container = options.container || document.querySelector(".three-panel");
        const button = options.button;
        if (!container) return false;
        const common = window.AIOneWorkspaceCommon;
        const panels = common.getPanels(container);
        const handles = common.getPanelHandles(container);
        if (panels.length !== 3 || handles.length !== 2) return false;
        if (window.matchMedia("(max-width: 1024px)").matches) return false;

        // 각 패널의 너비를 기억하여 이동 시 함께 옮긴다.
        const sizes = panels.map((panel) => panel.getBoundingClientRect().width);
        const nextPanels = [panels[2], panels[0], panels[1]];
        const nextSizes = [sizes[2], sizes[0], sizes[1]];
        const fragment = document.createDocumentFragment();
        nextPanels.forEach((panel, index) => {
            fragment.appendChild(panel);
            if (index < 2) fragment.appendChild(handles[index]);
        });
        container.replaceChildren(fragment);
        window.AIOneWorkspaceUi.applyPanelWidths(container, nextSizes, { fixedHandleWidth: 2 });

        container.classList.remove("panel-resize-mode");
        button?.classList.remove("active");
        button?.setAttribute("aria-pressed", "false");
        handles.forEach((handle) => handle.classList.remove("active"));
        // 양쪽 화면에서 이미 연결한 레이아웃 저장 리스너를 재사용한다.
        container.dispatchEvent(new CustomEvent("split-handler:resize", { bubbles: true }));
        container.dispatchEvent(new CustomEvent("workspace:panel-order-changed", { bubbles: true }));
        return true;
    }

    // Start: 261026 수정 - 공통 레이아웃 초기화
    // 작업 데이터는 유지하고 패널 배치만 복원합니다. 페이지는 기본값·저장소·후처리를 연결합니다.
    const panelLayoutDefaults = new WeakMap();
    function configurePanelLayout(container, options = {}) {
        if (!container || document.body?.dataset.page === "home") return;
        let entry = panelLayoutDefaults.get(container);
        if (!entry) {
            const panels = window.AIOneWorkspaceCommon.getPanels(container);
            entry = {
                children: Array.from(container.children),
                grid: container.style.gridTemplateColumns,
                panels: panels.map((panel) => ({
                    panel,
                    width: panel.style.width,
                    flexBasis: panel.style.flexBasis,
                    minimum: panel.getAttribute("data-panel-min"),
                })),
                options: {},
            };
            panelLayoutDefaults.set(container, entry);
        }
        Object.assign(entry.options, options);
    }

    function resetPanelLayout(container = document.querySelector(".three-panel")) {
        if (!container || document.body?.dataset.page === "home") return false;
        const entry = panelLayoutDefaults.get(container);
        if (!entry) return false;
        const options = entry.options;
        options.beforeReset?.();
        options.clearSaved?.();
        const orderChanged = entry.children.some((child, index) => container.children[index] !== child);
        container.classList.remove("panel-resize-mode", "panel-dragging", "is-source-collapsed");
        delete container.dataset.sourceExpandedGrid;
        entry.panels.forEach(({ panel, width, flexBasis, minimum }) => {
            panel.classList.remove("panel-collapsed", "is-source-expanded", "drag-over", "panel-selected", "selected");
            panel.style.opacity = "";
            panel.style.width = width;
            panel.style.flexBasis = flexBasis;
            delete panel.dataset.expandedPanelWidth;
            panelExpandedWidths.delete(panel);
            if (minimum === null) panel.removeAttribute("data-panel-min");
            else panel.setAttribute("data-panel-min", minimum);
            panel.querySelectorAll(".answer-source-file-section, .file-list-section").forEach((section) => section.classList.remove("is-collapsed"));
            syncPanelCollapseButton(panel, false);
        });
        // 순서가 같으면 iframe/canvas를 떼어내지 않습니다.
        if (orderChanged) container.replaceChildren(...entry.children);
        container.querySelectorAll(".panel-resize-handle.active, .doc-split-handle.active").forEach((handle) => handle.classList.remove("active"));
        document.querySelectorAll('[data-accessory-action="panel-size"]').forEach((button) => {
            button.classList.remove("active");
            button.setAttribute("aria-pressed", "false");
        });
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
        window.getSelection()?.removeAllRanges();
        window.AIOneSplitHandler?.reset?.(container);
        container.style.gridTemplateColumns = entry.grid;
        const state = options.getDefaultState?.();
        if (state) applyPanelLayout(container, state, options);
        else window.AIOneSplitHandler?.init?.(container);
        options.afterReset?.({ orderChanged });
        container.dispatchEvent(new CustomEvent("workspace:layout-reset", { bubbles: true }));
        window.AIOneWorkspaceCommon.showToast("레이아웃이 기본값으로 초기화되었습니다.");
        return true;
    }
    // End: 261026 수정 - 공통 레이아웃 초기화

    function initAccessoryController(options = {}) {
        const font = createFontController(options.font || {});

        window.AIOneWorkspaceCommon.initAccessoryTools({
            readyKey: options.readyKey || "workspaceAccessoryReady",
            onToggleFullscreen: async () => {
                await window.AIOneWorkspaceCommon.toggleBrowserFullscreen({
                    onError: options.onFullscreenError,
                });
            },
            onTogglePanelResize: (button) => {
                const enabled = togglePanelResizeMode({
                    container: options.container?.() || document.querySelector(".three-panel"),
                    button,
                    focusFirstHandle: options.focusFirstHandle,
                    onChange: options.onPanelResizeModeChange,
                });
                options.onPanelResizeToggle?.(enabled);
            },
            onFontDecrease: font.decrease,
            onFontIncrease: font.increase,
            onFontDefault: font.reset,
            onFullscreenChange: () => {
                window.AIOneWorkspaceCommon.syncBrowserFullscreenButton({
                    onChange: options.onFullscreenChange,
                });
            },
            onInit: () => {
                font.apply(font.read(), false);
                window.AIOneWorkspaceCommon.syncBrowserFullscreenButton({
                    onChange: options.onFullscreenChange,
                });
                options.onInit?.();
            },
        });

        return font;
    }

    function getLayoutState(container, options = {}) {
        if (!container) return null;
        const panels = window.AIOneWorkspaceCommon.getPanels(container);
        const widthsByPanel = {};
        const order = panels.map((panel, index) => {
            const key = window.AIOneWorkspaceCommon.getPanelKey(panel, index, {
                includeSlot: options.includeSlot !== false,
            });
            widthsByPanel[key] = Math.round(panel.getBoundingClientRect().width);
            return key;
        });
        return { order, widthsByPanel };
    }

    function applyPanelWidths(container, widths, options = {}) {
        if (!container || !Array.isArray(widths) || widths.length !== 3) return;
        if (window.matchMedia(options.responsiveQuery || "(max-width: 1024px)").matches) {
            container.style.removeProperty("grid-template-columns");
            return;
        }

        const handles = window.AIOneWorkspaceCommon.getPanelHandles(container);
        const handleWidths = handles.map((handle) => Math.max(1, Math.round(options.fixedHandleWidth || handle?.getBoundingClientRect().width || 2)));

        container.style.gridTemplateColumns = `${Math.round(widths[0])}px ${handleWidths[0] || 2}px ` + `${Math.round(widths[1])}px ${handleWidths[1] || 2}px ` + `${Math.round(widths[2])}px`;
    }

    function applyPanelLayout(container, state, { flexibleKey = "center", minimumWidths = {} } = {}) {
        const workspaceCommon = window.AIOneWorkspaceCommon;
        if (!container || !state || !Array.isArray(state.order) || state.order.length !== 3) {
            return;
        }
        const handles = workspaceCommon.getPanelHandles(container);
        const currentPanels = workspaceCommon.getPanels(container);
        const currentOrder = currentPanels.map((panel, index) => workspaceCommon.getPanelKey(panel, index, { includeSlot: true }));
        const panelMap = new Map();
        currentPanels.forEach((panel, index) => {
            panelMap.set(workspaceCommon.getPanelKey(panel, index, { includeSlot: true }), panel);
        });
        const orderedPanels = state.order.map((key) => panelMap.get(key)).filter(Boolean);
        if (orderedPanels.length !== currentPanels.length) return;
        const orderChanged = currentOrder.some((key, index) => key !== state.order[index]);
        if (orderChanged) {
            // 접힌 참조소스를 옮긴 뒤 펼쳐도 원래 폭이 같은 패널에 적용되도록 복원용 순서도 갱신한다.
            const expandedTracks = container.dataset.sourceExpandedGrid?.match(/minmax\([^)]*\)|\S+/g);
            if (expandedTracks?.length === currentPanels.length + handles.length) {
                const tracksByPanel = new Map(currentOrder.map((key, index) => [key, expandedTracks[index * 2]]));
                container.dataset.sourceExpandedGrid = state.order.flatMap((key, index) => (index < orderedPanels.length - 1 ? [tracksByPanel.get(key), expandedTracks[index * 2 + 1]] : [tracksByPanel.get(key)])).join(" ");
            }
            const fragment = document.createDocumentFragment();
            orderedPanels.forEach((panel, index) => {
                fragment.appendChild(panel);
                if (index < orderedPanels.length - 1 && handles[index]) {
                    fragment.appendChild(handles[index]);
                }
            });
            container.replaceChildren(fragment);
        }
        // 핵심: "자리의 폭"을 유지하지 않고 "패널이 갖고 있던 폭"까지 같이 이동시킨다.
        const widths = workspaceCommon.fitPanelWidths({
            order: state.order,
            widthsByPanel: state.widthsByPanel || {},
            flexibleKey,
            getMinimum: (key) => {
                const panel = panelMap.get(key);
                if (panel?.classList.contains("panel-collapsed")) return 44;
                return minimumWidths[key] || Math.max(180, Number(panel?.dataset?.panelMin) || 180);
            },
            getAvailableWidth: () => workspaceCommon.getAvailablePanelWidth(container, workspaceCommon.getPanelHandles(container)),
        });
        // 새 배치를 적용하기 전에 공통 리사이즈가 기억한 이전 폭을 지운다.
        window.AIOneSplitHandler?.reset?.(container);
        window.AIOneWorkspaceUi.applyPanelWidths(container, widths);
        window.AIOneSplitHandler?.init?.(container);
    }

    const panelDragContainers = new WeakSet();

    function initPanelDragDrop(options = {}) {
        const container = options.container;
        if (!container || panelDragContainers.has(container)) return;
        const readyKey = options.readyKey || "workspacePanelDragReady";
        if (container.dataset[readyKey] === "true") return;
        container.dataset[readyKey] = "true";
        panelDragContainers.add(container);

        let draggedPanel = null;
        const getPanels = () => window.AIOneWorkspaceCommon.getPanels(container);
        const getKey = (panel, index = 0) =>
            window.AIOneWorkspaceCommon.getPanelKey(panel, index, {
                includeSlot: options.includeSlot !== false,
            });

        getPanels().forEach((panel) => {
            const head = panel.querySelector(options.headSelector || ".panel-head");
            if (!head) return;

            head.style.cursor = "grab";
            head.setAttribute("draggable", "true");
            head.querySelectorAll("button, input, select, a, [contenteditable]").forEach((element) => {
                element.setAttribute("draggable", "false");
                element.addEventListener("pointerdown", (event) => event.stopPropagation());
                element.addEventListener("mousedown", (event) => event.stopPropagation());
                element.addEventListener("dragstart", (event) => event.preventDefault());
            });

            head.addEventListener("dragstart", (event) => {
                if (event.target.closest("button, input, select, a, [contenteditable]")) {
                    event.preventDefault();
                    return;
                }
                draggedPanel = panel;
                container.classList.add("panel-dragging");
                panel.style.opacity = "0.5";
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("application/x-ai-one-panel", getKey(panel));
            });

            head.addEventListener("dragend", () => {
                panel.style.opacity = "";
                draggedPanel = null;
                container.classList.remove("panel-dragging");
                getPanels().forEach((item) => item.classList.remove("drag-over"));
            });
        });

        container.addEventListener("dragover", (event) => {
            if (!draggedPanel) return;
            event.preventDefault();
            event.stopPropagation();
            event.dataTransfer.dropEffect = "move";
            const target = event.target.closest(".panel");
            if (!target || target === draggedPanel) return;
            getPanels().forEach((item) => item.classList.remove("drag-over"));
            target.classList.add("drag-over");
        });

        container.addEventListener("dragleave", (event) => {
            if (!draggedPanel) return;
            event.target.closest(".panel")?.classList.remove("drag-over");
        });

        container.addEventListener("drop", (event) => {
            if (!draggedPanel) return;
            event.preventDefault();
            event.stopPropagation();

            const target = event.target.closest(".panel");
            if (!target || target === draggedPanel) return;
            target.classList.remove("drag-over");

            const state = options.getState ? options.getState() : getLayoutState(container, options);
            if (!state?.order) return;
            const nextOrder = [...state.order];
            const dragIndex = nextOrder.indexOf(getKey(draggedPanel));
            const targetIndex = nextOrder.indexOf(getKey(target));
            if (dragIndex < 0 || targetIndex < 0) return;

            [nextOrder[dragIndex], nextOrder[targetIndex]] = [nextOrder[targetIndex], nextOrder[dragIndex]];

            const nextState = {
                order: nextOrder,
                widthsByPanel: state.widthsByPanel,
            };
            if (options.applyState) options.applyState(nextState);
            else applyPanelLayout(container, nextState, options);
            options.saveState?.();
            options.onChanged?.();
        });
    }

    function createPanelLayoutController(options = {}) {
        const cookieKey = String(options.cookieKey || "");
        const cookieMaxAge = Number(options.cookieMaxAge) || 60 * 60 * 24 * 365;
        const includeSlot = options.includeSlot !== false;
        let saveTimer = 0;

        function getState(container) {
            return getLayoutState(container, { includeSlot });
        }

        function save(container) {
            if (!container || !cookieKey) return null;
            const state = options.getState?.(container) || getState(container);
            if (!state) return null;
            window.AIOneWorkspaceCommon.setCookie(cookieKey, JSON.stringify(state), { maxAge: cookieMaxAge });
            return state;
        }

        function scheduleSave(container, delay = 120) {
            window.clearTimeout(saveTimer);
            saveTimer = window.setTimeout(() => save(container), Math.max(0, Number(delay) || 0));
        }

        function restore(container) {
            if (!container || !cookieKey) return null;
            const saved = window.AIOneWorkspaceCommon.getCookie(cookieKey);
            if (!saved) return null;

            try {
                const state = JSON.parse(saved);
                if (!state || !Array.isArray(state.order) || !state.widthsByPanel) return null;
                options.applyState?.(container, state);
                return state;
            } catch (error) {
                window.AIOneWorkspaceCommon.deleteCookie(cookieKey);
                options.onRestoreError?.(error);
                return null;
            }
        }

        function clear() {
            window.clearTimeout(saveTimer);
            if (cookieKey) window.AIOneWorkspaceCommon.deleteCookie(cookieKey);
        }

        return Object.freeze({
            getState,
            save,
            scheduleSave,
            restore,
            clear,
        });
    }

    function createDefaultWorkspaceTitle(suffix = "", date = new Date()) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        const tail = String(suffix || "").trim();
        return `${year}-${month}-${day}${tail ? ` ${tail}` : ""}`;
    }

    // 명시적으로 초기화한 레이아웃에서만 공통 접기를 사용한다.
    const panelExpandedWidths = new WeakMap();
    const collapseLayouts = new WeakSet();
    function syncPanelCollapseButton(panel, collapsed) {
        const button = panel.querySelector(".panel-head .panel-collapse-btn:not(.source-expand)");
        if (!button) return;
        const name = (button.getAttribute("aria-label") || "패널").replace(/\s*(접기|펼치기)$/, "");
        const label = `${name} ${collapsed ? "펼치기" : "접기"}`;
        button.setAttribute("aria-expanded", String(!collapsed));
        button.setAttribute("aria-label", label);
        button.setAttribute("title", label);
        button.setAttribute("data-tooltip", label);
    }
    function setPanelCollapsed(panel, collapsed, { flexibleKey = "center" } = {}) {
        const container = panel?.closest(".three-panel");
        if (!container) return;
        const common = window.AIOneWorkspaceCommon;
        const state = getLayoutState(container);
        const key = panel.dataset.panel;
        if (collapsed && !panel.classList.contains("panel-collapsed")) {
            panelExpandedWidths.set(panel, state.widthsByPanel[key]);
        }
        panel.classList.toggle("panel-collapsed", collapsed);
        panel.querySelectorAll(".answer-source-file-section, .file-list-section").forEach((section) => {
            section.classList.toggle("is-collapsed", collapsed);
        });
        if (key === "folder") container.classList.toggle("is-source-collapsed", collapsed);
        state.widthsByPanel[key] = collapsed ? 44 : panelExpandedWidths.get(panel) || Number(panel.dataset.panelMin) || 320;
        syncPanelCollapseButton(panel, collapsed);
        const panels = common.getPanels(container);
        const widths = common.fitPanelWidths({
            ...state,
            flexibleKey,
            getMinimum: (name) => {
                const target = panels.find((item) => item.dataset.panel === name);
                return target?.classList.contains("panel-collapsed") ? 44 : Number(target?.dataset.panelMin) || 180;
            },
            getAvailableWidth: () => common.getAvailablePanelWidth(container, common.getPanelHandles(container)),
        });
        window.AIOneSplitHandler?.reset?.(container);
        applyPanelWidths(container, widths);
        window.AIOneSplitHandler?.init?.(container);
    }
    function initPanelCollapse({ container, flexibleKey = "center" } = {}) {
        if (!container || collapseLayouts.has(container)) return;
        collapseLayouts.add(container);
        container.addEventListener("click", (event) => {
            const button = event.target.closest(".panel-collapse-btn:not(.source-expand)");
            const panel = button?.closest(".panel[data-panel]");
            if (!panel || panel.parentElement !== container) return;
            event.preventDefault();
            setPanelCollapsed(panel, !panel.classList.contains("panel-collapsed"), { flexibleKey });
        });
    }

    window.AIOneWorkspaceUi = Object.freeze({
        configurePanelLayout,
        resetPanelLayout,
        initPanelCollapse,
        setPanelCollapsed,
        syncPanelCollapseButton,
        clamp,
        createFontController,
        togglePanelResizeMode,
        initAccessoryController,
        getLayoutState,
        applyPanelWidths,
        applyPanelLayout,
        initPanelDragDrop,
        createPanelLayoutController,
        createDefaultWorkspaceTitle,
    });
    // defer 로드 시 페이지별 저장 상태를 복원하기 전의 기본 배치를 기록합니다.
    document.querySelectorAll(".three-panel").forEach((container) => configurePanelLayout(container));
})();

/* End: 워크스페이스 UI 컨트롤러 */

/* Start: 261016 수정 - 공통 답변 액션 및 오류신고 */
/** 답변서와 챗봇에서 함께 사용하는 AI 메시지 액션과 오류 신고 화면. */
(() => {
    "use strict";

    const actionDefinitions = Object.freeze({
        like: {
            className: "chat-feedback-btn",
            label: "좋아요",
            icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>',
        },
        dislike: {
            className: "chat-feedback-btn",
            label: "싫어요",
            icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10zM17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>',
        },
        research: {
            className: "chat-research-btn",
            label: "다시 생성",
            icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>',
        },
        copy: {
            className: "chat-copy-btn",
            label: "메시지 복사",
            title: "복사",
            icon: '<svg aria-hidden="true" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>',
        },
        issue: {
            className: "msg-report-btn chat-issue-btn",
            label: "오류신고",
            icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>',
        },
    });

    function createButton(action, { className = "", attributes = {} } = {}) {
        const definition = actionDefinitions[action];
        if (!definition) throw new TypeError("지원하지 않는 메시지 액션: " + action);
        const button = document.createElement("button");
        button.type = "button";
        button.className = ["msg-action-btn", definition.className, className].filter(Boolean).join(" ");
        button.setAttribute("aria-label", definition.label);
        button.title = definition.title || definition.label;
        button.innerHTML = definition.icon;
        if (action === "like" || action === "dislike") {
            button.dataset.feedbackValue = action;
            button.setAttribute("aria-pressed", "false");
        }
        if (action === "issue") button.setAttribute("aria-pressed", "false");
        Object.entries(attributes).forEach(([name, value]) => {
            if (value != null) button.setAttribute(name, String(value));
        });
        return button;
    }

    let closeActiveIssue = null;

    /** API 요청은 각 화면의 어댑터가 담당하고 화면·첨부 검증은 공유한다. */
    function openIssue(item, { templateId = "answerIssueModalTemplate", showToast = () => {}, uploadFile, submitIssue } = {}) {
        const sourceId = String(item?.dataset.messageId || "").trim();
        if (!sourceId) {
            showToast("오류를 신고할 답변 ID가 없습니다.");
            return null;
        }
        const template = document.getElementById(templateId);
        const backdrop = template?.content.firstElementChild?.cloneNode(true);
        if (!backdrop) {
            showToast("오류 신고 화면을 불러오지 못했습니다.");
            return null;
        }
        if (typeof uploadFile !== "function" || typeof submitIssue !== "function") {
            showToast("오류 신고 기능을 불러오지 못했습니다.");
            return null;
        }

        closeActiveIssue?.(false);
        const previousFocus = document.activeElement;
        const issueButton = item.querySelector(".chat-issue-btn");
        issueButton?.classList.add("is-active");
        issueButton?.setAttribute("aria-pressed", "true");
        let closed = false;
        const closeModal = (restoreFocus = true) => {
            if (closed) return;
            closed = true;
            document.removeEventListener("keydown", onKeydown);
            issueButton?.classList.remove("is-active");
            issueButton?.setAttribute("aria-pressed", "false");
            backdrop.remove();
            if (closeActiveIssue === closeModal) closeActiveIssue = null;
            if (restoreFocus) {
                const focusTarget = issueButton?.isConnected ? issueButton : previousFocus;
                if (focusTarget?.isConnected) focusTarget.focus();
            }
        };
        const onKeydown = (event) => {
            if (event.key === "Escape") {
                event.preventDefault();
                closeModal();
                return;
            }
            if (event.key !== "Tab") return;
            const focusable = Array.from(backdrop.querySelectorAll('button:not(:disabled), input:not(:disabled):not([type="hidden"]), textarea:not(:disabled), [tabindex="0"]')).filter(
                (element) => !element.hidden && element.getClientRects().length > 0,
            );
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (!first) return;
            if (event.shiftKey && (document.activeElement === first || !backdrop.contains(document.activeElement))) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && (document.activeElement === last || !backdrop.contains(document.activeElement))) {
                event.preventDefault();
                first.focus();
            }
        };
        closeActiveIssue = closeModal;
        backdrop.querySelectorAll("[data-issue-close]").forEach((button) => {
            button.addEventListener("click", () => closeModal());
        });
        backdrop.addEventListener("click", (event) => {
            if (event.target === backdrop) closeModal();
        });

        const issueFiles = [];
        const fileInput = backdrop.querySelector("#chatIssueFiles");
        const uploadZone = backdrop.querySelector(".chat-issue-upload");
        const renderIssueFiles = () => {
            const list = backdrop.querySelector("[data-issue-file-list]");
            list.replaceChildren(
                ...issueFiles.map((file, index) => {
                    const row = document.createElement("div");
                    row.className = "chat-issue-file";
                    const name = document.createElement("span");
                    name.title = file.name;
                    name.textContent = file.name;
                    const removeButton = document.createElement("button");
                    removeButton.type = "button";
                    removeButton.dataset.issueFileRemove = String(index);
                    removeButton.setAttribute("aria-label", "삭제");
                    removeButton.textContent = "×";
                    row.append(name, removeButton);
                    return row;
                }),
            );
        };
        const addIssueFiles = (files) => {
            const incomingFiles = Array.from(files || []);
            const availableCount = Math.max(0, 5 - issueFiles.length);
            if (incomingFiles.length > availableCount) showToast("파일은 최대 5개까지 첨부할 수 있습니다.");
            incomingFiles.slice(0, availableCount).forEach((file) => {
                if (issueFiles.length >= 5) return;
                if (file.size > 10 * 1024 * 1024) {
                    showToast(file.name + " 파일은 10MB를 초과했습니다.");
                    return;
                }
                if (!issueFiles.some((saved) => saved.name === file.name && saved.size === file.size)) issueFiles.push(file);
            });
            renderIssueFiles();
        };
        fileInput?.addEventListener("change", (event) => {
            addIssueFiles(event.target.files);
            event.target.value = "";
        });
        uploadZone?.addEventListener("dragover", (event) => event.preventDefault());
        uploadZone?.addEventListener("drop", (event) => {
            event.preventDefault();
            addIssueFiles(event.dataTransfer?.files);
        });
        backdrop.querySelector("[data-issue-file-list]")?.addEventListener("click", (event) => {
            const removeButton = event.target.closest("[data-issue-file-remove]");
            if (!removeButton) return;
            issueFiles.splice(Number(removeButton.dataset.issueFileRemove), 1);
            renderIssueFiles();
        });
        backdrop.querySelector("[data-issue-submit]")?.addEventListener("click", async () => {
            const submitButton = backdrop.querySelector("[data-issue-submit]");
            if (submitButton.disabled) return;
            const issueType = String(backdrop.querySelector('input[name="chatIssueType"]:checked')?.value || "").trim();
            const content = String(backdrop.querySelector("#chatIssueContent")?.value || "").trim();
            const selectedFiles = issueFiles.slice();
            submitButton.disabled = true;
            try {
                const fileIds = [];
                for (const file of selectedFiles) {
                    const fileId = String((await uploadFile(file)) || "").trim();
                    if (!fileId) throw new Error("신고 파일 ID를 확인할 수 없습니다.");
                    fileIds.push(fileId);
                }
                await submitIssue({
                    issue_type: issueType,
                    content,
                    source_type: "conversation_log",
                    source_id: sourceId,
                    file_ids: fileIds,
                });
                closeModal();
                showToast("오류신고가 접수되었습니다.");
            } catch (error) {
                console.error("[오류신고 등록 실패]", error);
                showToast("오류신고를 접수하지 못했습니다.");
                submitButton.disabled = false;
            }
        });
        document.body.appendChild(backdrop);
        document.addEventListener("keydown", onKeydown);
        backdrop.querySelector("#chatIssueContent")?.focus();
        return backdrop;
    }

    window.AIOneChatMessageActions = Object.freeze({ createButton, openIssue });
})();
/* End: 261016 수정 - 공통 답변 액션 및 오류신고 */

/* Start: 261020 추가 - 공통 채팅 표·코드 블록 복사 행 및 복사 기능 */
/* 공통 채팅 표 · 코드 블록: 스타일은 각 페이지의 draft-report.js 또는 chat.js에서 관리합니다. */
(() => {
    "use strict";
    /* ───────── 표 · 코드 블록 복사 버튼 ─────────
     * 답변 안의 표와 코드 블록 위에 머리 막대(왼쪽: 표 · 언어 이름, 오른쪽: 복사 버튼)를 붙인다.
     *  - 표   : HTML(테두리 포함) + 탭 구분 글자를 함께 복사 → 엑셀 · 워드 · 한글에 붙여넣으면 표 그대로 들어간다
     *  - 코드 : 코드 글자만 복사
     * 막대 글자는 CSS ::before 로 그려 "답변 복사"(innerText)에는 섞이지 않는다. 스타일은 각 페이지의 draft-report.js 또는 chat.js에서 관리한다.
     */
    function addBlockCopyBars(root, { includeCode = true } = {}) {
        root.querySelectorAll("table").forEach((table) => {
            if (table.closest(".chat-table-wrap, .chat-block")) return;
            const scroll = document.createElement("div");
            scroll.className = "chat-table-wrap";
            table.replaceWith(scroll);
            scroll.appendChild(table);
        });
        const blocks = [
            ...Array.from(root.querySelectorAll(".chat-table-wrap")).map((node) => ({ node, kind: "table", label: "" })),
            ...Array.from(includeCode ? root.querySelectorAll("pre") : []).map((node) => ({ node, kind: "code", label: node.getAttribute("data-lang") || "코드" })),
        ].filter((b) => !b.node.parentElement?.classList.contains("chat-block"));
        // HTML 로 온 답변의 표(감싸는 상자가 없음)도 같이
        root.querySelectorAll("table").forEach((table) => {
            if (table.closest(".chat-table-wrap, .chat-block")) return;
            blocks.push({ node: table, kind: "table", label: "" });
        });
        if (!blocks.length) return;

        blocks.forEach(({ node, kind, label }) => {
            const box = document.createElement("div");
            box.className = "chat-block";
            box.dataset.blockKind = kind;
            const bar = document.createElement("div");
            bar.className = "chat-block-bar";
            bar.dataset.label = label;
            const button = window.AIOneChatMessageActions.createButton("copy", {
                className: "chat-block-copy",
                attributes: {
                    "data-chat-block-copy": "",
                    "data-common-block-copy": "",
                    "data-tip": "복사",
                    "aria-label": kind === "table" ? "표 복사" : "코드 복사",
                },
            });
            bar.appendChild(button);
            node.replaceWith(box);
            box.append(bar, node);
        });
    }

    /** 표 → 탭 구분 글자 (엑셀에 칸별로 들어간다) */
    function tableToTsv(table) {
        return Array.from(table.rows)
            .map((row) =>
                Array.from(row.cells)
                    .map((cell) => cell.innerText.replace(/[\t\r\n]+/g, " ").trim())
                    .join("\t"),
            )
            .join("\n");
    }

    /** 붙여넣을 곳에서도 테두리가 보이도록 스타일을 직접 넣은 표 HTML */
    function tableToClipboardHtml(table) {
        const copy = table.cloneNode(true);
        copy.removeAttribute("class");
        copy.setAttribute("border", "1");
        copy.style.cssText = "border-collapse:collapse";
        copy.querySelectorAll("th, td").forEach((cell) => {
            cell.style.cssText = `border:1px solid #999;padding:4px 8px;vertical-align:top;${cell.tagName === "TH" ? "background:#f2f2f2;font-weight:bold;" : ""}${cell.style.textAlign ? `text-align:${cell.style.textAlign};` : ""}`;
        });
        return `<meta charset="utf-8">${copy.outerHTML}`;
    }

    /** HTML + 글자를 함께 클립보드에 (안 되면 화면 선택 복사로) */
    async function copyRich(html, text) {
        if (window.isSecureContext && navigator.clipboard?.write && window.ClipboardItem) {
            await navigator.clipboard.write([
                new ClipboardItem({
                    "text/html": new Blob([html], { type: "text/html" }),
                    "text/plain": new Blob([text], { type: "text/plain" }),
                }),
            ]);
            return;
        }
        const holder = document.createElement("div");
        holder.contentEditable = "true";
        holder.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0";
        holder.innerHTML = html;
        document.body.appendChild(holder);
        const range = document.createRange();
        range.selectNodeContents(holder);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        let ok = false;
        try {
            ok = document.execCommand("copy");
        } catch (e) {
            ok = false;
        }
        selection.removeAllRanges();
        holder.remove();
        if (!ok) throw new Error("copy failed");
    }

    async function copyPlain(text) {
        if (window.isSecureContext && navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return;
        }
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0";
        document.body.appendChild(ta);
        ta.select();
        let ok = false;
        try {
            ok = document.execCommand("copy");
        } catch (e) {
            ok = false;
        }
        ta.remove();
        if (!ok) throw new Error("copy failed");
    }

    function notifyBlockCopy(message) {
        const target = document.querySelector("#toast, #chatActionToast, [data-toast]");
        if (target) {
            window.AIOneWorkspaceCommon.showToast(message, { target });
            return;
        }
        window.Toastify({ text: message, duration: 2500, gravity: "bottom", position: "center" }).showToast();
    }

    async function copyBlock(button) {
        const box = button.closest(".chat-block");
        if (!box) return;
        try {
            if (box.dataset.blockKind === "table") {
                const table = box.querySelector("table");
                if (!table) return;
                await copyRich(tableToClipboardHtml(table), tableToTsv(table));
            } else {
                await copyPlain(box.querySelector("pre")?.innerText.replace(/\n$/, "") || "");
            }
            notifyBlockCopy("복사되었습니다.");
        } catch (error) {
            notifyBlockCopy("복사하지 못했습니다. 다시 시도해 주세요.");
        }
    }

    window.AIOneChatBlocks = Object.freeze({ decorate: addBlockCopyBars, copyPlain });
    document.addEventListener("click", (event) => {
        const button = event.target.closest?.("[data-common-block-copy]");
        if (button) copyBlock(button);
    });
})();
/* End: 261020 추가 - 공통 채팅 표·코드 블록 복사 행 및 복사 기능 */

/* End: 공통 컴포넌트 런타임 (Shared Component Runtime) */
/* 업로드 목록: drawer-list 메뉴와 모달 DOM을 재사용한다. 데이터 변경은 각 화면이 담당한다. */
(() => {
    let sequence = 0;

    function openModal(action, context, trigger) {
        const sourceId = document.querySelector(`[data-sidepop-${action}-modal]`)?.getAttribute(`data-sidepop-${action}-modal`);
        const source = document.getElementById(sourceId);
        if (!source) return;
        const modal = source.cloneNode(true);
        const prefix = `upload-action-${++sequence}`;
        const ids = new Map();
        [modal, ...modal.querySelectorAll("[id]")].forEach((node) => {
            if (!node.id) return;
            ids.set(node.id, `${prefix}-${node.id}`);
            node.id = ids.get(node.id);
        });
        modal.querySelectorAll("[for], [aria-labelledby], [aria-describedby]").forEach((node) => {
            ["for", "aria-labelledby", "aria-describedby"].forEach((attr) => {
                if (node.hasAttribute(attr))
                    node.setAttribute(
                        attr,
                        node
                            .getAttribute(attr)
                            .split(" ")
                            .map((id) => ids.get(id) || id)
                            .join(" "),
                    );
            });
        });
        modal.removeAttribute("data-sidepop-actions-ready");
        const input = modal.querySelector("[data-sidepop-rename-input]");
        const error = modal.querySelector("[data-sidepop-rename-error]");
        const confirm = modal.querySelector(`[data-sidepop-${action}-confirm]`);
        modal.querySelectorAll("*").forEach((node) => {
            Array.from(node.attributes)
                .filter((attr) => attr.name.startsWith("data-sidepop-"))
                .forEach((attr) => node.removeAttribute(attr.name));
        });
        const title = action === "rename" ? "제목 변경" : "문서 삭제";
        modal.querySelector(".modal-title").textContent = title;
        modal.querySelector('[role="dialog"]').setAttribute("aria-label", title);
        if (input) {
            input.value = context.title();
            modal.querySelector(".modal-rename-label").textContent = "제목";
            modal.querySelector(".modal-rename-helper").textContent = context.renameDescription || "목록에서 구분하기 쉬운 제목으로 변경할 수 있습니다.";
            error.textContent = "제목을 입력해 주세요.";
            error.hidden = true;
            input.addEventListener("keydown", (event) => {
                if (event.key === "Enter" && !event.isComposing) {
                    event.preventDefault();
                    confirm.click();
                }
            });
        } else {
            const description = modal.querySelector(".modal-msg");
            const name = document.createElement("strong");
            name.textContent = context.title();
            const message = document.createElement("p");
            message.textContent = context.listName ? `${context.listName}에서 삭제하시겠습니까?` : context.deleteDescription || "이 문서를 목록에서 삭제하시겠습니까?";
            description.replaceChildren(name, message);
        }
        confirm.addEventListener("click", async () => {
            const value = input?.value.trim();
            if (input && !value) {
                error.hidden = false;
                input.setAttribute("aria-invalid", "true");
                input.focus();
                return;
            }
            confirm.disabled = true;
            try {
                const completed = await (action === "rename" ? context.onRename(value) : context.onDelete());
                if (completed !== false) window.AIOneModal.close(modal);
            } catch (failure) {
                window.AIOneWorkspaceCommon?.showToast?.(failure.message || "변경하지 못했습니다. 다시 시도해 주세요.");
            } finally {
                confirm.disabled = false;
            }
        });
        modal.addEventListener("modal:close", () => modal.remove(), { once: true });
        document.body.append(modal);
        window.AIOneModal.open(modal, trigger);
        input?.focus();
        input?.select();
    }

    function attach(row, context) {
        const prototype = document.getElementById("commonSidepopActionPrototype");
        if (!prototype) return;
        row.querySelector(".file-action-wrap")?.remove();
        const component = prototype.cloneNode(true);
        component.removeAttribute("id");
        component.removeAttribute("hidden");
        component.removeAttribute("data-dom-prototype");
        component.classList.add("file-action-wrap");
        component.setAttribute("data-dropdown-menu", "");
        component.setAttribute("data-file-action-menu", "");
        const trigger = document.createElement("button");
        trigger.type = "button";
        trigger.className = "btn-more small";
        trigger.setAttribute("data-dropdown-trigger", "");
        trigger.setAttribute("aria-label", "파일 더보기");
        trigger.setAttribute("aria-haspopup", "menu");
        trigger.setAttribute("aria-expanded", "false");
        trigger.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="1.7"></circle><circle cx="12" cy="12" r="1.7"></circle><circle cx="12" cy="19" r="1.7"></circle></svg>';
        component.prepend(trigger);
        const menu = component.querySelector('[role="menu"]');
        menu.id = `upload-menu-${++sequence}`;
        trigger.setAttribute("aria-controls", menu.id);
        const pinned = context.pinned();
        component.querySelector('[data-menu-value="pin"]').setAttribute("aria-pressed", String(pinned));
        component.querySelector('[data-menu-value="pin"] .drawer-list-action-label').textContent = pinned ? "고정 해제" : "고정";
        component.querySelector('[data-menu-value="rename"] .drawer-list-action-label').textContent = "제목 변경";
        (row.querySelector(".file-item-side") || row).append(component);
        component.addEventListener("dropdownmenu:select", (event) => {
            event.stopPropagation();
            const action = event.detail.value;
            if (action === "pin") context.onPin();
            else queueMicrotask(() => openModal(action, context, trigger));
        });
        component.addEventListener("dropdownmenu:toggle", (event) => {
            if (!event.detail.open) return;
            const rect = trigger.getBoundingClientRect();
            menu.style.position = "fixed";
            menu.style.zIndex = "100000";
            menu.style.right = "auto";
            menu.style.left = `${Math.max(8, Math.min(rect.right - menu.offsetWidth, innerWidth - menu.offsetWidth - 8))}px`;
            menu.style.top = `${Math.max(8, Math.min(rect.bottom + 6, innerHeight - menu.offsetHeight - 8))}px`;
        });
        window.AIOneDropdownMenu.init(component);
    }
    window.AIOneFileActions = Object.freeze({ attach, confirmDelete: (context, trigger) => openModal("delete", context, trigger) });
})();

/* 홈·챗봇·가이드에서 같은 모델·작업 선택 동작을 사용합니다. */
(() => {
    "use strict";
    /** 열린 메뉴 전체를 기준으로 화면 안에 배치한다. 기존 입력창의 이동 효과도 유지한다. */
    function initChatMenuPosition(composer, component, trigger, panels, { floating, placement }) {
        const gap = 8;
        const viewportPadding = 12;
        const modelMenu = panels.querySelector('[role="menu"]');
        const syncTaskHeight = () => panels.style.setProperty("--chat-model-menu-height", `${modelMenu.getBoundingClientRect().height}px`);
        let frame = 0;

        const position = () => {
            if (!component.classList.contains("is-open")) return;
            const viewport = window.visualViewport;
            const viewportTop = (viewport?.offsetTop || 0) + viewportPadding;
            const viewportLeft = (viewport?.offsetLeft || 0) + viewportPadding;
            const viewportBottom = (viewport?.offsetTop || 0) + (viewport?.height || window.innerHeight) - viewportPadding;
            const viewportRight = (viewport?.offsetLeft || 0) + (viewport?.width || document.documentElement.clientWidth) - viewportPadding;
            const triggerRect = trigger.getBoundingClientRect();
            const spaceAbove = Math.max(0, triggerRect.top - viewportTop - gap);
            const spaceBelow = Math.max(0, viewportBottom - triggerRect.bottom - gap);

            // 이전 방향의 높이 제한을 풀고 현재 메뉴에 필요한 높이를 다시 잰다.
            panels.style.removeProperty("--chat-menu-available-height");
            syncTaskHeight();
            const openAbove = placement === "top" || (panels.getBoundingClientRect().height > spaceBelow && spaceAbove > spaceBelow);
            panels.style.setProperty("--chat-menu-available-height", `${openAbove ? spaceAbove : spaceBelow}px`);
            syncTaskHeight();
            panels.dataset.placement = openAbove ? "top" : "bottom";

            const panelRect = panels.getBoundingClientRect();
            const modelWidth = panels.querySelector('[role="menu"]').getBoundingClientRect().width;
            const left = Math.max(viewportLeft, Math.min(triggerRect.right - modelWidth, viewportRight - panelRect.width));
            const top = openAbove ? triggerRect.top - gap - panelRect.height : triggerRect.bottom + gap;
            if (floating) {
                panels.style.left = `${left}px`;
                panels.style.top = `${Math.max(viewportTop, top)}px`;
                return;
            }
            const parent = panels.offsetParent;
            const parentRect = parent.getBoundingClientRect();
            panels.style.left = `${left - parentRect.left + parent.scrollLeft - parent.clientLeft}px`;
            panels.style.top = `${top - parentRect.top + parent.scrollTop - parent.clientTop}px`;
        };
        const schedule = () => {
            if (frame || !component.classList.contains("is-open")) return;
            frame = window.requestAnimationFrame(() => {
                frame = 0;
                position();
            });
        };
        window.addEventListener("resize", schedule, { passive: true });
        document.addEventListener(
            "scroll",
            (event) => {
                if (!panels.contains(event.target)) schedule();
            },
            { capture: true, passive: true },
        );
        window.visualViewport?.addEventListener("resize", schedule, { passive: true });
        window.visualViewport?.addEventListener("scroll", schedule, { passive: true });
        const observer = new ResizeObserver(schedule);
        observer.observe(composer);
        observer.observe(trigger);
        observer.observe(panels);
        return position;
    }

    /** 모델·작업 목록은 HTML을 그대로 사용한다. aria-controls로 각 작업 메뉴를 연결한다.
     * 모델은 임시 선택하고 작업 선택 시 두 값을 확정한다.
     */
    function init({ composer, input, placeholders = {}, floating = false, placement = "auto" } = {}) {
        const component = composer?.querySelector('[data-dropdown-menu][data-chat-menu="model"]');
        const modelMenu = component?.querySelector('[role="menu"]');
        const panels = component?.querySelector(".chat-menu-panels");
        if (!modelMenu || !panels || component.dataset.taskSubmenuReady === "true") return;
        const trigger = component.querySelector("[data-dropdown-trigger]");
        const modelLabel = trigger.querySelector("[data-chat-model-label]");
        const taskLabel = trigger.querySelector("[data-chat-task-label]");
        const itemLabel = (item) => item.dataset.menuLabel || item.querySelector(".dropdown-model-name")?.textContent.trim() || "";
        const models = Array.from(modelMenu.querySelectorAll("[data-menu-value]"))
            .map((item) => {
                const menu = document.getElementById(item.getAttribute("aria-controls"));
                if (!menu || !panels.contains(menu)) return null;
                const tasks = Array.from(menu.querySelectorAll("[data-menu-value]"));
                return tasks.length ? { item, menu, tasks, value: item.dataset.menuValue, label: itemLabel(item) } : null;
            })
            .filter(Boolean);
        if (!models.length) return;
        component.dataset.taskSubmenuReady = "true";
        // Popover keeps the existing DOM/events/styles while escaping table clipping.
        if (floating) panels.setAttribute("popover", "manual");
        const positionPanels = initChatMenuPosition(composer, component, trigger, panels, { floating, placement });
        const modelItems = models.map((model) => model.item);
        let selectedModel = models.find((model) => model.value === composer.dataset.chatModelCurrent) || models[0];
        let selectedTask = selectedModel.tasks.find((task) => task.dataset.menuValue === (composer.dataset.chatTaskCurrent || "chat")) || selectedModel.tasks[0];
        let pendingModel = selectedModel;
        let hoverCloseTimer = 0;
        const cancelHoverClose = () => window.clearTimeout(hoverCloseTimer);
        const closeAfterLeave = (event) => {
            if (event.pointerType === "touch") return;
            cancelHoverClose();
            // 버튼과 메뉴 사이의 간격을 지나갈 시간을 둔다.
            hoverCloseTimer = window.setTimeout(() => {
                window.AIOneDropdownMenu.setOpen(component, false);
            }, 160);
        };
        trigger.addEventListener("pointerenter", (event) => {
            if (event.pointerType === "touch") return;
            cancelHoverClose();
            if (!component.classList.contains("is-open")) {
                window.AIOneDropdownMenu.setOpen(component, true, "none");
            }
        });
        trigger.addEventListener("pointerleave", closeAfterLeave);
        panels.addEventListener("pointerenter", cancelHoverClose);
        panels.addEventListener("pointerleave", closeAfterLeave);
        trigger.addEventListener("click", (event) => {
            // 마우스는 hover로 열고, 터치·키보드는 기존 클릭 동작을 사용한다.
            if (event.detail > 0 && event.pointerType !== "touch" && window.matchMedia("(hover: hover)").matches) {
                event.stopPropagation();
            }
        });
        const updateLabel = () => {
            modelLabel.textContent = selectedModel.label;
            taskLabel.textContent = itemLabel(selectedTask);
            trigger.setAttribute("aria-label", `${selectedModel.label} · ${itemLabel(selectedTask)}`);
            trigger.title = trigger.getAttribute("aria-label");
            composer.dataset.chatModelCurrent = selectedModel.value;
            composer.dataset.chatTaskCurrent = selectedTask.dataset.menuValue;
            models.forEach((model) =>
                model.tasks.forEach((task) => {
                    task.setAttribute("aria-checked", String(model === selectedModel && task === selectedTask));
                }),
            );
        };
        const close = () => {
            models.forEach((model) => {
                model.menu.hidden = true;
            });
            pendingModel = selectedModel;
            modelItems.forEach((item) => {
                item.setAttribute("aria-expanded", "false");
                item.setAttribute("aria-checked", String(item.dataset.menuValue === selectedModel.value));
            });
        };
        // Hover previews tasks without committing a model or moving keyboard focus.
        const openTasks = (item, focusTask = false) => {
            const model = models.find((option) => option.item === item);
            if (!model || !component.classList.contains("is-open")) return;
            pendingModel = model;
            modelMenu.hidden = false;
            models.forEach((option) => {
                option.menu.hidden = option !== model;
            });
            component.dataset.taskModel = model.value;
            modelItems.forEach((option) => option.setAttribute("aria-expanded", String(option === item)));
            positionPanels();
            if (focusTask) (model.menu.querySelector('[aria-checked="true"]') || model.tasks[0])?.focus({ preventScroll: true });
        };
        modelItems.forEach((item) => {
            item.addEventListener("pointerenter", (event) => {
                if (event.pointerType !== "touch") openTasks(item);
            });
        });
        component.addEventListener("dropdownmenu:select", (event) => {
            const { item } = event.detail;
            if (modelMenu.contains(item)) {
                openTasks(item, true);
            } else {
                const model = models.find((option) => option.tasks.includes(item));
                if (!model) return;
                selectedModel = model;
                selectedTask = item;
                updateLabel();
                const value = item.dataset.menuValue;
                if (input)
                    input.placeholder =
                        selectedModel.value === "government"
                            ? `${itemLabel(item)} 요청을 입력하세요 (API 연결 준비 중)`
                            : placeholders[value] || (value === "search" ? "찾을 내부 업무자료를 입력해 보세요" : "AI-ONE에게 요청해 보세요");
            }
        });
        component.addEventListener("dropdownmenu:toggle", (event) => {
            if (!event.detail.open) {
                cancelHoverClose();
                close();
                if (floating && panels.matches(":popover-open")) panels.hidePopover();
            } else {
                if (floating && !panels.matches(":popover-open")) panels.showPopover();
                positionPanels();
            }
        });
        component.addEventListener("keydown", (event) => {
            const item = event.target.closest("[data-menu-value]");
            if (event.key === "ArrowRight" && item && modelMenu.contains(item)) {
                event.preventDefault();
                item.click();
            } else if (pendingModel.menu.contains(event.target) && ["ArrowLeft", "Escape"].includes(event.key)) {
                event.preventDefault();
                event.stopPropagation();
                const parent = modelItems.find((option) => option.dataset.menuValue === pendingModel.value);
                close();
                positionPanels();
                parent?.focus({ preventScroll: true });
            }
        });
        updateLabel();
        close();
    }

    window.AIOneModelTaskMenu = Object.freeze({ init });
})();

/* 홈 입력창의 자동 줄바꿈·개행 배치를 가이드에서도 재사용합니다. */
(() => {
    "use strict";
    /** 한 줄 배치의 너비로 판단하여 펼친 뒤에도 배치가 반복 전환되지 않게 한다. */
    function init(input) {
        const form = input?.closest(".prompt-composer");
        if (!form || input.tagName !== "TEXTAREA") return () => {};
        // 실제 입력창을 접었다 펼치지 않아 커서·스크롤과 주변 레이아웃을 유지한다.
        const mirror = document.createElement("textarea");
        mirror.className = "home-composer-measure";
        mirror.tabIndex = -1;
        mirror.setAttribute("aria-hidden", "true");
        mirror.setAttribute("inert", "");
        mirror.rows = 1;
        document.body.append(mirror);
        const controls = [...form.querySelectorAll(":scope > .prompt-composer-tools, :scope > .prompt-composer-bar")];
        const textProperties = [
            "font-family",
            "font-size",
            "font-weight",
            "font-style",
            "font-stretch",
            "font-variant",
            "font-feature-settings",
            "font-variation-settings",
            "font-optical-sizing",
            "font-size-adjust",
            "font-kerning",
            "line-height",
            "letter-spacing",
            "word-spacing",
            "text-indent",
            "text-transform",
            "tab-size",
            "white-space",
            "word-break",
            "overflow-wrap",
            "direction",
        ];
        let metrics = null;
        let frame = 0;
        const measure = () => {
            frame = 0;
            if (!metrics) {
                if (!form.getClientRects().length) return;
                const style = getComputedStyle(input);
                const formStyle = getComputedStyle(form);
                const lineHeight = parseFloat(style.lineHeight);
                if (!Number.isFinite(lineHeight)) return;
                const inlinePadding = parseFloat(formStyle.getPropertyValue("--composer-inline-padding-left")) + parseFloat(formStyle.getPropertyValue("--composer-inline-padding-right"));
                const fullWidth = form.clientWidth - 2 * parseFloat(formStyle.getPropertyValue("--composer-multiline-padding"));
                const controlsWidth = controls.reduce((width, node) => width + node.getBoundingClientRect().width, 0);
                metrics = {
                    lineHeight,
                    maximum: parseFloat(style.maxHeight) || 200,
                    fullWidth,
                    inlineWidth: Math.max(1, form.clientWidth - inlinePadding - controlsWidth - (parseFloat(formStyle.columnGap) || 0) * controls.length),
                };
                textProperties.forEach((property) => mirror.style.setProperty(property, style.getPropertyValue(property)));
                mirror.wrap = input.wrap;
            }
            const { lineHeight, maximum, inlineWidth, fullWidth } = metrics;
            mirror.value = input.value;
            mirror.style.width = `${inlineWidth}px`;
            const multiline = input.value.length > 0 && mirror.scrollHeight > lineHeight + 1;
            const minimum = lineHeight * (multiline ? 2 : 1);
            if (multiline) mirror.style.width = `${fullWidth}px`;
            const contentHeight = input.value ? mirror.scrollHeight : minimum;
            const height = Math.min(maximum, Math.max(minimum, contentHeight)) + "px";
            // 안내 문구의 줄바꿈·소수점 높이 차이로 불필요한 스크롤바가 생기지 않게 합니다.
            const overflow = input.value && contentHeight > maximum ? "auto" : "hidden";
            if (input.style.overflowY !== overflow) input.style.overflowY = overflow;
            if (form.classList.contains("is-multiline") !== multiline) form.classList.toggle("is-multiline", multiline);
            if (input.style.getPropertyValue("--composer-input-height") !== height) input.style.setProperty("--composer-input-height", height);
        };
        const schedule = () => {
            if (!frame) frame = requestAnimationFrame(measure);
        };
        const invalidate = () => {
            metrics = null;
            schedule();
        };
        // 높이 변경에는 반응하지 않고 화면 및 버튼 너비 변경에만 다시 측정한다.
        const widths = new WeakMap();
        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const width = entry.borderBoxSize?.[0]?.inlineSize ?? entry.contentRect.width;
                if (widths.get(entry.target) === width) continue;
                widths.set(entry.target, width);
                invalidate();
            }
        });
        observer.observe(form);
        controls.forEach((node) => observer.observe(node));
        window.addEventListener("resize", invalidate, { passive: true });
        document.fonts?.ready.then(invalidate);
        document.fonts?.addEventListener("loadingdone", invalidate);
        input.addEventListener("input", schedule);
        form.addEventListener("reset", schedule);
        measure();
        return schedule;
    }

    window.AIOneHomeComposerLayout = Object.freeze({ init });
})();

/* 관련자료 필터: 실제 화면과 가이드가 같은 선택 상태 계약을 사용합니다. */
(() => {
    function init(root, onChange = () => {}) {
        if (!root || root.dataset.referenceFiltersReady === "true") return;
        root.dataset.referenceFiltersReady = "true";
        root.addEventListener("click", (event) => {
            const button = event.target.closest("[data-reference-filter]");
            if (!button || !root.contains(button) || button.disabled) return;
            root.querySelectorAll("[data-reference-filter]").forEach((item) => {
                item.classList.toggle("active", item === button);
                item.setAttribute("aria-pressed", String(item === button));
            });
            onChange(button.dataset.referenceFilter);
        });
    }
    window.AIOneReferenceFilters = Object.freeze({ init });
})();
