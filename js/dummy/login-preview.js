/**
 * AI-ONE 정적 로그인 미리보기
 * 기본 구간 형식: Start: 기능명 / End: 기능명
 * 변경 구간 형식: Start: YYMMDD 추가/수정 - 기능명 / End: YYMMDD 추가/수정 - 기능명
 * 주석 정리 내역
 * - 261023 주석 정리 - 파일 안내와 구간·변경 내용 작성 형식을 통일합니다.
 */
(() => {
    "use strict";
    // 정적 HTML 전용 흐름. 운영 JSP는 원본 login.js가 아이디 저장을 담당합니다.
    const staticForm = document.getElementById("dataForm");
    if (!staticForm?.dataset.serverLoginUrl) return;
    staticForm.dataset.rememberIdReady = "true";

    /* 정적 로그인 화면: 입력 확인 -> 아이디 저장 -> 홈 미리보기 이동.
       실제 연동 모드는 서버 로그인 화면에서 인증하며, 이 파일은 비밀번호를 저장하거나 전송하지 않습니다. */
    const SAVED_ID_KEY = "aiOneRememberedLoginId";
    const LEGACY_SAVED_ID_KEY = "ai-one-saved-login-id";
    const NOTICE_KEY = "aiOneServiceNoticeDismissedUntil";

    function restoreRememberedId(input, checkbox) {
        try {
            const savedId = localStorage.getItem(SAVED_ID_KEY) || localStorage.getItem(LEGACY_SAVED_ID_KEY);
            if (!savedId) return;
            input.value = savedId;
            checkbox.checked = true;
        } catch {
            /* 저장소를 사용할 수 없어도 화면은 계속 사용할 수 있습니다. */
        }
    }

    function saveRememberedId(id, remember) {
        try {
            if (remember) localStorage.setItem(SAVED_ID_KEY, id);
            else localStorage.removeItem(SAVED_ID_KEY);
            localStorage.removeItem(LEGACY_SAVED_ID_KEY);
        } catch {
            /* 아이디 저장에 실패해도 화면 이동은 계속합니다. */
        }
    }

    function initLogin() {
        const form = document.getElementById("dataForm");
        const picId = document.getElementById("picId");
        const picPswd = document.getElementById("picPswd");
        const rememberMe = document.getElementById("rememberMe");
        if (!form || !picId || !picPswd || !rememberMe || form.dataset.loginReady === "true") return;

        form.dataset.loginReady = "true";
        restoreRememberedId(picId, rememberMe);

        [picId, picPswd].forEach((input) => {
            input.addEventListener("input", () => input.setCustomValidity(""));
        });

        // 기본 submit 이벤트를 사용하므로 버튼 클릭과 Enter 입력이 같은 흐름을 따릅니다.
        form.addEventListener("submit", (event) => {
            event.preventDefault();

            if (!window.AIOnePreview?.enabled) {
                window.location.assign(form.dataset.serverLoginUrl);
                return;
            }

            const id = picId.value.trim();
            picId.setCustomValidity(id ? "" : "로그인 아이디를 입력해주세요.");
            picPswd.setCustomValidity(picPswd.value ? "" : "로그인 비밀번호를 입력해주세요.");
            if (!form.reportValidity()) return;

            saveRememberedId(id, rememberMe.checked);
            picPswd.value = "";
            const homeUrl = new URL(form.getAttribute("action"), document.baseURI);
            homeUrl.searchParams.set("preview", "1");
            window.location.assign(homeUrl.href);
        });
    }

    function initServiceNotice() {
        const modal = document.getElementById("serviceNoticeModal");
        if (!modal || !window.AIOneModal || modal.dataset.noticeReady === "true") return;
        modal.dataset.noticeReady = "true";

        let dismissed = false;
        try {
            const saved = localStorage.getItem(NOTICE_KEY);
            dismissed = saved === "forever" || Date.now() < Number(saved);
        } catch {
            /* 저장소를 사용할 수 없으면 안내를 표시합니다. */
        }

        modal.querySelectorAll("[data-notice-dismiss-days]").forEach((button) => {
            button.addEventListener("click", () => {
                const days = button.dataset.noticeDismissDays;
                const until = days === "forever" ? "forever" : String(Date.now() + Number(days) * 86400000);
                try {
                    localStorage.setItem(NOTICE_KEY, until);
                } catch {
                    /* 저장에 실패해도 공통 모달의 닫기 동작은 유지합니다. */
                }
            });
        });

        if (!dismissed) window.AIOneModal.open(modal);
    }

    function init() {
        initLogin();
        initServiceNotice();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }
})();
