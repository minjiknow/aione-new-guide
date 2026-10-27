/**
 * AI-ONE 로그인 아이디 저장·비밀번호 표시
 * 최근 변경 내용
 * - 261023 추가 - 비밀번호 표시 전환
 *
 * 기본 구간 형식: Start: 기능명 / End: 기능명
 * 변경 구간 형식: Start: YYMMDD 추가/수정 - 기능명 / End: YYMMDD 추가/수정 - 기능명
 * 주석 정리 내역
 * - 261023 주석 정리 - 파일 안내와 구간·변경 내용 작성 형식을 통일합니다.
 */
(() => {
    "use strict";

    /* 파일 구성: 아이디 저장/복원 -> 비밀번호 표시 전환. */
    /* 주의: 폼 검증(빈 값 체크)과 실제 제출(암호화, disabled 처리, POST)은
       ND_loginForm.jsp 내 인라인 스크립트(jQuery, $("#dataForm").submit(...))가 이미 담당합니다.
       이 파일은 아이디 저장과 비밀번호 표시 전환을 담당하며, 기존 제출 로직을 건드리거나 대체하지 않습니다. */

    /* Start: 아이디 저장 */

    const SAVED_ID_KEY = "ai-one-saved-login-id";

    // 아이디 저장 기능 초기화
    function initRememberId() {
        const form = document.getElementById("dataForm");
        const picId = document.getElementById("picId");
        const picPswd = document.getElementById("picPswd");
        const rememberMe = document.getElementById("rememberMe");
        if (!form || !picId || !rememberMe || form.dataset.rememberIdReady === "true") return;

        form.dataset.rememberIdReady = "true";

        // 저장된 아이디 복원
        try {
            const savedId = localStorage.getItem(SAVED_ID_KEY);
            if (savedId) {
                picId.value = savedId;
                rememberMe.checked = true;
                picPswd?.focus();
            }
        } catch (error) {
            /* 저장소를 사용할 수 없어도 로그인 진행에는 영향 없음 */
        }

        // 제출 시 저장/삭제 (기존 검증·암호화·POST 로직과 별개로 동작, capture 없이 addEventListener로 추가만 함)
        form.addEventListener("submit", () => {
            const id = picId.value.trim();
            if (!id) return; // 빈 값이면 기존 검증 로직이 별도로 막으므로 여기서는 저장하지 않음

            try {
                if (rememberMe.checked) localStorage.setItem(SAVED_ID_KEY, id);
                else localStorage.removeItem(SAVED_ID_KEY);
            } catch (error) {
                /* 저장소를 사용할 수 없어도 로그인 진행에는 영향 없음 */
            }
        });
    }

    /* Start: 261023 추가 - 비밀번호 표시 전환 */
    function initPasswordToggle() {
        const button = document.querySelector(".login-password-toggle");
        const input = document.getElementById(button?.getAttribute("aria-controls"));
        const icon = button?.querySelector("img");
        if (!button || !input || !icon) return;

        button.addEventListener("click", () => {
            const visible = input.type === "password";
            input.type = visible ? "text" : "password";
            icon.src = visible ? "../assets/icons/pw-open.svg" : "../assets/icons/pw-close.svg";
            button.setAttribute("aria-pressed", String(visible));
        });
    }
    /* End: 261023 추가 - 비밀번호 표시 전환 */

    function init() {
        initRememberId();
        initPasswordToggle();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }

    /* End: 아이디 저장 */
})();
