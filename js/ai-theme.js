/**
 * AI-ONE 테마·강조 색상 설정
 * 기본 구간 형식: Start: 기능명 / End: 기능명
 * 변경 구간 형식: Start: YYMMDD 추가/수정 - 기능명 / End: YYMMDD 추가/수정 - 기능명
 * 주석 정리 내역
 * - 261023 주석 정리 - 파일 안내와 구간·변경 내용 작성 형식을 통일합니다.
 */
(() => {
    "use strict";

    /* 파일 구성: 테마/강조 색상 저장 -> 컨트롤 동기화 -> 공개 테마 동작. */

    /* Start: 테마 상태와 저장소 */

    const STORAGE_KEY = "ai-one-color-theme";
    const THEME_SCHEMA_KEY = "ai-one-color-theme-user-set-v2";
    const ACCENT_STORAGE_KEY = "ai-one-accent-color";
    const LEGACY_PRIMARY_COLOR_KEY = "ai-one-primary-color";
    const VALID_THEMES = Object.freeze(["system", "dark", "light"]);
    const VALID_ACCENTS = Object.freeze(["default", "blue", "green", "yellow", "pink", "orange", "purple"]);
    const ACCENT_LABELS = Object.freeze({
        default: "기본값",
        blue: "블루",
        green: "그린",
        yellow: "옐로",
        pink: "핑크",
        orange: "오렌지",
        purple: "퍼플",
    });
    const LEGACY_PRIMARY_COLOR_ACCENTS = Object.freeze({
        default: "default",
        "#218BFF": "blue",
        "#2DA44E": "green",
        "#BF8700": "yellow",
        "#D63384": "pink",
        "#F06A35": "orange",
        "#8250DF": "purple",
    });

    const systemThemeQuery = window.matchMedia("(prefers-color-scheme: dark)");
    let currentPreference = readThemePreference();
    let currentAccent = readAccentPreference();

    // 테마 설정 읽기
    function readThemePreference() {
        try {
            if (localStorage.getItem(THEME_SCHEMA_KEY) !== "ready") {
                localStorage.setItem(STORAGE_KEY, "light");
                return "light";
            }
            const saved = localStorage.getItem(STORAGE_KEY);
            return VALID_THEMES.includes(saved) ? saved : "light";
        } catch (error) {
            return "light";
        }
    }

    // 강조색 설정 읽기
    function readAccentPreference() {
        try {
            const saved = localStorage.getItem(ACCENT_STORAGE_KEY);
            if (VALID_ACCENTS.includes(saved)) return saved;

            const legacyColor = localStorage.getItem(LEGACY_PRIMARY_COLOR_KEY);
            const migratedAccent = LEGACY_PRIMARY_COLOR_ACCENTS[legacyColor] || "default";
            localStorage.setItem(ACCENT_STORAGE_KEY, migratedAccent);
            return migratedAccent;
        } catch (error) {
            return "default";
        }
    }

    // 테마 해결
    function resolveTheme(preference) {
        return preference === "system" ? (systemThemeQuery.matches ? "dark" : "light") : preference;
    }

    /* End: 테마 상태와 저장소 */

    /* Start: 설정 UI 동기화 */

    // 화면 동작 수집
    function collect(root, selector) {
        const matches = [];
        if (root instanceof Element && root.matches(selector)) matches.push(root);
        root?.querySelectorAll?.(selector).forEach((element) => matches.push(element));
        return matches;
    }

    // 테마 컨트롤 동기화
    function syncThemeControls(root = document) {
        collect(root, ".theme-option").forEach((option) => {
            const isActive = option.dataset.themeValue === currentPreference;
            option.classList.toggle("active", isActive);
            option.setAttribute("aria-checked", String(isActive));
            const check = option.querySelector(".theme-option-check");
            if (check) check.textContent = isActive ? "✓" : "";
        });
    }

    // 강조색 컨트롤 동기화
    function syncAccentControls(root = document) {
        collect(root, "[data-accent-control]").forEach((control) => {
            control.dataset.accentValue = currentAccent;
            const label = control.querySelector("[data-accent-label]");
            const swatch = control.querySelector(".settings-accent-swatch");
            if (label) label.textContent = ACCENT_LABELS[currentAccent];
            if (swatch) swatch.dataset.accentValue = currentAccent;
            control.querySelectorAll("[data-accent-value]").forEach((option) => {
                option.setAttribute("aria-selected", String(option.dataset.accentValue === currentAccent));
            });
        });
    }

    // 컨트롤 동기화
    function syncControls(root = document) {
        syncThemeControls(root);
        syncAccentControls(root);
    }

    // 테마 옵션 이벤트 연결
    function bindThemeOption(option) {
        if (!option || option.dataset.themeReady === "true") return;

        option.addEventListener("click", () => {
            setTheme(option.dataset.themeValue, true);
        });
        option.dataset.themeReady = "true";
    }

    // 설정 패널 이벤트 연결
    function bindSettingsPanel(panel) {
        if (!panel || panel.dataset.themePanelReady === "true") return;

        panel.addEventListener("click", (event) => {
            if (event.target.closest("[data-accent-control]")) return;
            panel.querySelectorAll("[data-accent-control].is-open").forEach((control) => setAccentControlOpen(control, false));
        });
        panel.dataset.themePanelReady = "true";
    }

    // 화면 초기화
    function init(root = document) {
        collect(root, ".theme-option").forEach(bindThemeOption);
        collect(root, "[data-accent-control]").forEach(bindAccentControl);
        collect(root, "[data-settings-panel]").forEach(bindSettingsPanel);
        syncControls(root);
    }

    /* End: 설정 UI 동기화 */

    /* Start: 테마와 강조 컬러 적용 */

    // 테마 설정
    function setTheme(preference, persist = true) {
        const normalized = VALID_THEMES.includes(preference) ? preference : "light";
        const resolvedTheme = resolveTheme(normalized);
        currentPreference = normalized;

        document.documentElement.dataset.themePreference = normalized;
        document.documentElement.dataset.theme = resolvedTheme;
        document.documentElement.style.colorScheme = resolvedTheme;

        if (persist) {
            try {
                localStorage.setItem(STORAGE_KEY, normalized);
                localStorage.setItem(THEME_SCHEMA_KEY, "ready");
            } catch (error) {
                /* 현재 화면에만 적용 */
            }
        }

        syncThemeControls();
        document.dispatchEvent(
            new CustomEvent("ai-one-theme-change", {
                detail: { preference: normalized, resolvedTheme },
            }),
        );
        return resolvedTheme;
    }

    // 강조색 설정
    function setAccent(accent, persist = true) {
        const normalized = VALID_ACCENTS.includes(accent) ? accent : "default";
        currentAccent = normalized;
        document.documentElement.dataset.accentColor = normalized;

        if (persist) {
            try {
                localStorage.setItem(ACCENT_STORAGE_KEY, normalized);
            } catch (error) {
                /* 현재 화면에만 적용 */
            }
        }

        syncAccentControls();
        document.dispatchEvent(
            new CustomEvent("ai-one-accent-change", {
                detail: { accent: normalized },
            }),
        );
        return normalized;
    }

    /* End: 테마와 강조 컬러 적용 */

    /* Start: 강조 컬러 선택기 */

    // 강조색 컨트롤 Open 설정
    function setAccentControlOpen(control, isOpen, focusTarget = "selected") {
        if (!control) return;
        const trigger = control.querySelector("[data-accent-trigger]");
        const listbox = control.querySelector("[data-accent-listbox]");
        if (!trigger || !listbox) return;

        if (isOpen) {
            document.querySelectorAll("[data-accent-control].is-open").forEach((other) => {
                if (other !== control) setAccentControlOpen(other, false);
            });
        }

        control.classList.toggle("is-open", isOpen);
        trigger.setAttribute("aria-expanded", String(isOpen));
        listbox.hidden = !isOpen;
        if (!isOpen) return;

        const options = Array.from(listbox.querySelectorAll('[role="option"]'));
        const focusOption = focusTarget === "first" ? options[0] : focusTarget === "last" ? options.at(-1) : options.find((option) => option.getAttribute("aria-selected") === "true");
        window.requestAnimationFrame(() => focusOption?.focus());
    }

    // 강조색 컨트롤 이벤트 연결
    function bindAccentControl(control) {
        if (!control || control.dataset.accentReady === "true") return;
        const trigger = control.querySelector("[data-accent-trigger]");
        const listbox = control.querySelector("[data-accent-listbox]");
        const options = Array.from(listbox?.querySelectorAll('[role="option"]') || []);
        if (!trigger || !listbox || !options.length) return;

        trigger.addEventListener("click", () => {
            setAccentControlOpen(control, trigger.getAttribute("aria-expanded") !== "true");
        });
        trigger.addEventListener("keydown", (event) => {
            if (!["ArrowDown", "ArrowUp"].includes(event.key)) return;
            event.preventDefault();
            setAccentControlOpen(control, true, event.key === "ArrowUp" ? "last" : "first");
        });

        options.forEach((option) => {
            option.addEventListener("click", () => {
                setAccent(option.dataset.accentValue, true);
                setAccentControlOpen(control, false);
                trigger.focus();
            });
            option.addEventListener("keydown", (event) => {
                const currentIndex = options.indexOf(option);
                if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
                    event.preventDefault();
                    let nextIndex = currentIndex;
                    if (event.key === "ArrowDown") nextIndex = (currentIndex + 1) % options.length;
                    if (event.key === "ArrowUp") nextIndex = (currentIndex - 1 + options.length) % options.length;
                    if (event.key === "Home") nextIndex = 0;
                    if (event.key === "End") nextIndex = options.length - 1;
                    options[nextIndex]?.focus();
                }
                if (event.key === "Escape") {
                    event.preventDefault();
                    setAccentControlOpen(control, false);
                    trigger.focus();
                }
                if (event.key === "Tab") setAccentControlOpen(control, false);
            });
        });

        control.dataset.accentReady = "true";
        syncAccentControls(control);
    }

    /* End: 강조 컬러 선택기 */

    /* Start: 공개 API와 초기화 */

    window.AIOneTheme = Object.freeze({
        bindAccentControl,
        getAccent: () => currentAccent,
        getResolvedTheme: () => resolveTheme(currentPreference),
        getTheme: () => currentPreference,
        init,
        setAccent,
        setAccentControlOpen,
        setTheme,
        syncControls,
    });

    setTheme(currentPreference, false);
    setAccent(currentAccent, false);

    // on System 테마 Change 동작 처리
    const onSystemThemeChange = () => {
        if (currentPreference === "system") setTheme("system", false);
    };
    if (systemThemeQuery.addEventListener) systemThemeQuery.addEventListener("change", onSystemThemeChange);
    else if (systemThemeQuery.addListener) systemThemeQuery.addListener(onSystemThemeChange);

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => init(), { once: true });
    } else {
        init();
    }
    document.addEventListener("app:includes-ready", (event) => init(event.target));
    document.addEventListener("component:ready", (event) => init(event.target));

    document.dispatchEvent(new CustomEvent("ai-one-theme:ready"));

    /* End: 공개 API와 초기화 */
})();
