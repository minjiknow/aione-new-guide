/**
 * AI-ONE 미리보기 모드 설정
 * 기본 구간 형식: Start: 기능명 / End: 기능명
 * 변경 구간 형식: Start: YYMMDD 추가/수정 - 기능명 / End: YYMMDD 추가/수정 - 기능명
 * 주석 정리 내역
 * - 261023 주석 정리 - 파일 안내와 구간·변경 내용 작성 형식을 통일합니다.
 */
/** 작업용 미리보기 설정. 서버용 초기화 로직은 각 페이지에 그대로 유지한다. */
(() => {
  "use strict";
  // [개발 연동 안내] 미리보기 여부만 선택합니다. 요청 가로채기는 더미 모드에서 dummy-api.js가 담당합니다.
  // ?preview=1: 미리보기 / ?preview=0: 실제 연동. 선택값은 같은 탭의 sessionStorage에 유지됩니다.
  // 기존 페이지 JS는 원래 fetch()와 렌더러를 그대로 사용합니다.
  const LOCAL_PREVIEW_DEFAULT = true;
  const local = location.protocol === "file:" || ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
  const vercel = location.hostname.endsWith(".vercel.app");
  const requested = new URLSearchParams(location.search).get("preview");
  let override = null;
  try {
    if (requested === "1" || requested === "0") sessionStorage.setItem("ai-one:preview", requested);
    override = sessionStorage.getItem("ai-one:preview");
  } catch { /* 파일 직접 열기 등 저장소를 사용할 수 없는 환경 */ }
  const choice = requested === "1" || requested === "0" ? requested : override;
  const enabled = choice === null ? (local && LOCAL_PREVIEW_DEFAULT) || vercel : choice === "1";
  // HTML을 파일로 열거나 하위 경로에 배포해도 같은 프로젝트의 로그인으로 이동한다.
  const loginUrl = new URL("../../html/login.html", document.currentScript.src).href;
  document.documentElement.dataset.runtime = enabled ? "static" : "live";
  window.AIOnePreview = Object.freeze({ enabled, loginUrl });
})();
