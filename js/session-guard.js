/*
 * [AI-ONE] 세션 만료 공통 처리 스크립트
 *
 * <pre>
 * << 개정이력(Modification Information) >>
 *
 *     수정일       수정자   수정내용
 * --------------  --------  -------------------------------
 *  2026. 9. 20.   Claude    최초작성
 *                            - MD_home.jsp / MD_answer.jsp / MD_classification.jsp
 *                              워크스페이스 화면에서 화면 진입 후 세션이 만료된 채로
 *                              내부 AJAX(ND_*.do) 호출이 발생하는 경우, 응답이 로그인
 *                              페이지 HTML이거나 401/403 으로 내려와도 화면이 아무런
 *                              반응 없이 멈추던 문제를 해결하기 위해 추가.
 *                            - fetch / XMLHttpRequest 를 공통으로 가로채어 세션 만료로
 *                              판단되는 응답을 감지하면 기존 프레임워크의 세션 만료
 *                              처리 화면(ND_LostSession.do)으로 강제 이동시킨다.
 *                            - ND_LostSession.jsp를 확인해 보면 이 화면이 이미
 *                              "로그인 정보가 소멸되었습니다" 알림을 띄운 뒤
 *                              CTX_PATH + OpConfig.urls.mgrLogin(로그인 화면)으로
 *                              top.location 이동을 처리하고 있다. 동일한 안내/이동
 *                              로직을 이 스크립트에서 중복 구현하지 않고, 그 화면으로
 *                              그대로 이동시켜 재사용한다. (LoginController.ssoLogin()
 *                              주석에서 설명하는, 세션 없이 업무 페이지 진입 시 튕기는
 *                              기존 목적지와 동일한 화면)
 *
 * </pre>
 *
 * 감지 기준(아래 중 하나라도 해당하면 세션 만료로 간주한다):
 *  1) 응답 상태코드가 401(Unauthorized) 또는 403(Forbidden) 인 경우
 *  2) 요청이 서버에서 리다이렉트되어 최종 URL이 로그인 관련 페이지
 *     (/login/ND_loginForm.do, /login/ND_LostSession.do) 인 경우
 *  3) 화면 내부 AJAX 호출(.do 요청)인데 응답 Content-Type이 text/html 로 내려온 경우
 *     (정상적인 ND_*.do 응답은 JSON/이벤트스트림/바이너리이며, text/html 은 세션 만료 시
 *      로그인/세션종료 페이지가 대신 내려오는 경우가 대부분이다)
 *
 * 주의: 이 스크립트는 반드시 draft.js / classification.js / ai-home.js 등 실제 업무 로직을
 *       담당하는 스크립트보다 먼저 로드되어야 fetch/XMLHttpRequest 가로채기가 정상 동작한다.
 *       (defer 없이, <head> 최상단에서 로드할 것)
 *
 * 기본 구간 형식: Start: 기능명 / End: 기능명
 * 변경 구간 형식: Start: YYMMDD 추가/수정 - 기능명 / End: YYMMDD 추가/수정 - 기능명
 * 주석 정리 내역
 * - 261023 주석 정리 - 구간 표시와 변경 내용 표기를 통일합니다. 기존 작업 날짜와 기능 설명은 유지합니다.
 */
(function () {
    "use strict";

    if (window.__AI_ONE_SESSION_GUARD_LOADED__) {
        // 페이지 내 중복 로드 방지 (실수로 두 번 include 되어도 안전하게 동작)
        return;
    }
    window.__AI_ONE_SESSION_GUARD_LOADED__ = true;

    var LOGIN_FORM_PATH = "/login/ND_loginForm.do";
    var LOST_SESSION_PATH = "/login/ND_LostSession.do";

    // 컨텍스트 경로 결정: common.js의 buildLogoutUrl()과 동일하게, 프레임워크가 전역으로
    // 심어두는 window.CTX_PATH를 최우선으로 사용한다. (ND_LostSession.jsp도 CTX_PATH를
    // 그대로 사용하므로 동일한 값을 써야 화면 간 이동 경로가 어긋나지 않는다)
    // 혹시 CTX_PATH가 아직 정의되지 않은 시점이라면, 이 스크립트 자신의
    // <script src="..."> 경로를 기준으로 컨텍스트 경로를 역산해 대비한다.
    var contextPath = (function () {
        if (typeof window.CTX_PATH === "string") {
            return window.CTX_PATH;
        }

        var scripts = document.getElementsByTagName("script");
        var marker = "../js/session-guard.js";
        for (var i = 0; i < scripts.length; i++) {
            var src = scripts[i].getAttribute("src") || "";
            var idx = src.indexOf(marker);
            if (idx > -1) {
                return src.substring(0, idx);
            }
        }
        return "";
    })();

    // 세션 만료 감지 시 이동할 화면: 로그인 화면(ND_loginForm.do)으로 바로 보내지 않고,
    // 기존에 이미 있는 세션 종료 안내 화면(ND_LostSession.do)을 그대로 재사용한다.
    // 그 화면이 "로그인 정보가 소멸되었습니다" 알림을 띄운 뒤 로그인 화면으로 다시
    // 이동시켜 주므로, 결과적으로 사용자는 로그인 화면(ND_loginForm.jsp)까지 도달한다.
    var lostSessionUrl = contextPath + LOST_SESSION_PATH;
    var alreadyRedirecting = false;

    /**
     * url이 로그인/세션종료 관련 페이지를 가리키는지 확인한다.
     */
    function isLoginRelatedUrl(url) {
        if (!url) {
            return false;
        }
        return url.indexOf(LOGIN_FORM_PATH) > -1 || url.indexOf(LOST_SESSION_PATH) > -1;
    }

    /**
     * 현재 페이지가 이미 로그인 관련 화면인 경우(중복 이동 방지)를 확인한다.
     */
    function isCurrentPageLoginRelated() {
        return isLoginRelatedUrl(window.location.pathname);
    }

    /**
     * 내부 업무 AJAX 호출(.do)인지 확인한다. (바이너리/미리보기 다운로드 등은 별도 판단 없이
     * 그대로 두되, text/html 응답이 내려오면 어차피 세션 만료 판단 대상이 되므로 문제 없다)
     */
    function isAppDoRequest(url) {
        return !!url && url.indexOf(".do") > -1;
    }

    /**
     * 세션 종료 안내 화면(ND_LostSession.do)으로 강제 이동한다. (target="_top" 링크와
     * 동일하게, 포털 프레임에 임베드되어 있는 경우까지 고려하여 최상위 창을 이동시킨다)
     * 그 화면이 알림 후 최종적으로 로그인 화면(ND_loginForm.jsp)까지 이동시켜 준다.
     */
    function goToLogin() {
        if (alreadyRedirecting || isCurrentPageLoginRelated()) {
            return;
        }
        alreadyRedirecting = true;

        try {
            (window.top || window).location.href = lostSessionUrl;
        } catch (crossOriginError) {
            // 최상위 창이 다른 origin이라 접근이 막히는 경우(cross-origin) 현재 창이라도 이동시킨다.
            window.location.href = lostSessionUrl;
        }
    }

    // ── fetch 전역 가로채기 ──────────────────────────────────────────
    var originalFetch = window.fetch;
    if (typeof originalFetch === "function") {
        window.fetch = function () {
            var requestArg = arguments[0];
            var requestUrl = typeof requestArg === "string" ? requestArg : (requestArg && requestArg.url) || "";

            return originalFetch.apply(this, arguments).then(
                function (response) {
                    if (!response) {
                        return response;
                    }

                    if (response.status === 401 || response.status === 403) {
                        goToLogin();
                        return response;
                    }

                    if (response.redirected && isLoginRelatedUrl(response.url)) {
                        goToLogin();
                        return response;
                    }

                    if (response.ok && isAppDoRequest(requestUrl)) {
                        var contentType = response.headers && response.headers.get ? response.headers.get("Content-Type") || "" : "";
                        if (contentType.indexOf("text/html") > -1) {
                            goToLogin();
                        }
                    }

                    return response;
                },
                function (error) {
                    // 네트워크 오류 등은 세션 만료와 무관하므로 그대로 전달한다.
                    return Promise.reject(error);
                },
            );
        };
    }

    // ── XMLHttpRequest 전역 가로채기 (jQuery.ajax 등 구형 호출 대응) ──────
    var OriginalXHR = window.XMLHttpRequest;
    if (OriginalXHR) {
        var originalOpen = OriginalXHR.prototype.open;
        OriginalXHR.prototype.open = function (method, url) {
            this.__sessionGuardRequestUrl = url;
            return originalOpen.apply(this, arguments);
        };

        var originalSend = OriginalXHR.prototype.send;
        OriginalXHR.prototype.send = function () {
            this.addEventListener("load", function () {
                if (this.status === 401 || this.status === 403) {
                    goToLogin();
                    return;
                }

                var finalUrl = (typeof this.responseURL === "string" && this.responseURL) || this.__sessionGuardRequestUrl || "";

                if (this.status >= 200 && this.status < 300 && isLoginRelatedUrl(finalUrl)) {
                    goToLogin();
                    return;
                }

                if (this.status >= 200 && this.status < 300 && isAppDoRequest(this.__sessionGuardRequestUrl)) {
                    var contentType = "";
                    try {
                        contentType = this.getResponseHeader("Content-Type") || "";
                    } catch (headerError) {
                        contentType = "";
                    }
                    if (contentType.indexOf("text/html") > -1) {
                        goToLogin();
                    }
                }
            });

            return originalSend.apply(this, arguments);
        };
    }

    // 다른 스크립트에서 명시적으로 세션 만료 처리를 호출해야 하는 경우를 위해 공개한다.
    // (예: SSE 스트림 중 서버가 error 이벤트로 인증 만료를 알려주는 경우 등)
    window.AiOneSessionGuard = {
        goToLogin: goToLogin,
        isLoginRelatedUrl: isLoginRelatedUrl,
    };
})();
