/**
 * AI-ONE 분류 룰 API·팝업 연결
 * 기본 구간 형식: Start: 기능명 / End: 기능명
 * 변경 구간 형식: Start: YYMMDD 추가/수정 - 기능명 / End: YYMMDD 추가/수정 - 기능명
 * 주석 정리 내역
 * - 261023 주석 정리 - 파일 안내와 구간·변경 내용 작성 형식을 통일합니다.
 */
/** 분류 룰 API와 공통 모달을 연결한다. */
(function (window) {
  'use strict';
  window.AIOneClassificationFeatureModules = window.AIOneClassificationFeatureModules || {};
  window.AIOneClassificationFeatureModules['classification-rule.js'] = function (runtime) {
    const $ = selector => document.querySelector(selector);
    const escape = value => runtime.escapeHtml(String(value ?? ''));
    let rules = [];
    let busy = false;
    let page = 0;
    let total = 0;
    let initialized = false;
    const pageSize = 50;

    // 목록은 total/page/size가 필요하므로 공용 fetchJson의 data 추출 전에 읽는다.
    async function request(url, body) {
      const response = await fetch(url, body ? { method: 'POST', body } : undefined);
      let result;
      try {
        result = await response.json();
      } catch (error) {
        // 미배포 엔드포인트/로그인 화면 등 HTML 응답을 파싱 오류 그대로 노출하지 않는다.
        throw new Error('분류 룰 API 응답을 확인할 수 없습니다. 서버 적용 상태와 로그인 상태를 확인해 주세요.');
      }
      if (!response.ok || result?.success === false) {
        throw new Error(result?.message || `요청 실패 (${response.status})`);
      }
      return result;
    }

    function feedback(message, error = false) {
      const element = $('#ruleFeedback');
      element.textContent = message;
      element.classList.toggle('is-error', error);
    }

    async function perform(task) {
      if (busy) return;
      busy = true;
      $('#ruleFormFields').querySelectorAll('input, select').forEach(element => { element.disabled = true; });
      $('#workspaceRuleSettingsSidepop').setAttribute('aria-busy', 'true');
      renderRuleList();
      updateButtons();
      feedback('처리 중입니다...');
      try {
        await task();
      } catch (error) {
        feedback(error.message || '룰 요청에 실패했습니다.', true);
        runtime.showToast(error.message || '룰 요청에 실패했습니다.');
      } finally {
        busy = false;
        $('#ruleFormFields').querySelectorAll('input, select').forEach(element => { element.disabled = false; });
        $('#workspaceRuleSettingsSidepop').setAttribute('aria-busy', 'false');
        renderRuleList();
        updateButtons();
      }
    }

    function updateButtons() {
      $('#ruleFormSave').disabled = busy;
    }

    function keywords() {
      return [...new Set($('#ruleIncludeKeywords').value.split(/[,，\n]/).map(value => value.trim()).filter(Boolean))];
    }

    async function loadRules(reset) {
      const nextPage = reset ? 1 : page + 1;
      const result = await request(`ND_rules.do?page=${nextPage}&size=${pageSize}`);
      if (!Array.isArray(result.data)) throw new Error('룰 목록 응답을 확인할 수 없습니다.');
      rules = reset ? result.data : [...new Map(rules.concat(result.data).map(rule => [rule.rule_id, rule])).values()];
      page = Number(result.page || nextPage);
      total = Number(result.total ?? rules.length);
    }

    function renderRuleList() {
      const list = $('#ruleList');
      if (!list) return;
      $('#ruleCount').textContent = `${total}건`;
      list.innerHTML = rules.length ? rules.map(rule => `
        <div class="manual-rule-card">
          <div><strong>${escape((rule.include_keywords || []).join(', ') || rule.name)}</strong><span>${escape(rule.department?.name || '')}</span></div>
          <button type="button" class="icon-button icon-button-ghost" data-rule-delete="${escape(rule.rule_id)}"
              aria-label="${escape(rule.name)} 룰 삭제"${busy ? ' disabled' : ''}>
            <img class="icon icon-small" src="../assets/icons/delete.svg" alt="" aria-hidden="true">
          </button>
        </div>`).join('') : '<p class="rule-list-empty">등록된 룰이 없습니다. 위에서 룰을 추가해 주세요.</p>';
      if (rules.length < total) {
        list.insertAdjacentHTML('beforeend', `<button type="button" class="button button-text-primary rule-load-more" data-rule-more${busy ? ' disabled' : ''}>더 보기 (${rules.length}/${total})</button>`);
      }
    }

    async function saveRule() {
      const name = keywords().join(', ');
      const include = keywords();
      const option = $('#ruleDept').selectedOptions[0];
      const departmentId = option?.dataset.deptId;
      if (!name || name.length > 100) throw new Error('키워드는 쉼표를 포함해 100자 이내로 입력해 주세요.');
      if (!departmentId) throw new Error('추천 실국을 선택해 주세요.');
      if (!include.length || include.length > 20 || include.some(value => value.length > 50)) {
        throw new Error('포함 키워드는 1~20개, 키워드당 1~50자로 입력해 주세요.');
      }
      const body = new URLSearchParams();
      body.set('name', name);
      body.set('departmentId', departmentId);
      body.set('isActive', 'true');
      include.forEach(value => body.append('includeKeywords', value));
      body.set('matchMode', 'any');
      const result = await request('ND_saveRule.do', body);
      if (!result.data?.rule_id) throw new Error('룰 저장 응답을 확인할 수 없습니다.');
      $('#ruleFormFields').reset();
      const index = rules.findIndex(rule => rule.rule_id === result.data.rule_id);
      if (index >= 0) rules[index] = result.data;
      else {
        rules.unshift(result.data);
        total += 1;
        // 신규 등록으로 페이지 경계가 이동하므로 다음 조회는 첫 페이지부터 한다.
        page = 0;
      }
      feedback('룰이 추가되었습니다.');
      runtime.showToast('분류 룰이 저장되었습니다.');
    }

    function deleteRule(id) {
      if (busy) return;
      const target = rules.find(rule => String(rule.rule_id) === String(id));
      if (!target) return;
      runtime.customConfirm('분류 룰 삭제', `‘${escape(target.name)}’ 룰을 삭제하시겠습니까?`, () => {
        perform(async () => {
          await request('ND_deleteRule.do', new URLSearchParams({ ruleId: id }));
          rules = rules.filter(rule => String(rule.rule_id) !== String(id));
          total = Math.max(0, total - 1);
          page = 0;
          feedback('룰이 삭제되었습니다. 기존 매칭 근거는 다시 적용할 때 갱신됩니다.');
          runtime.showToast('분류 룰이 삭제되었습니다.');
        });
      }, 'danger', '삭제');
    }

    function initRuleManagement() {
      const drawer = $('#workspaceRuleSettingsSidepop');
      if (!drawer || initialized) return;
      initialized = true;
      drawer.addEventListener('modal:open', () => perform(async () => {
        await runtime.loadActualDepartments();
        await loadRules(true);
        feedback('');
      }));
      $('#ruleList').addEventListener('click', event => {
        const remove = event.target.closest('[data-rule-delete]');
        if (remove) deleteRule(remove.dataset.ruleDelete);
        else if (event.target.closest('[data-rule-more]')) perform(async () => { await loadRules(page === 0); feedback(''); });
      });
      const form = $('#ruleFormFields');
      // 빈 키워드는 브라우저 기본 안내 대신 공통 토스트로 안내한다.
      form.noValidate = true;
      form.addEventListener('submit', event => {
        event.preventDefault();
        if (busy) return;
        if (!keywords().length) {
          runtime.showToast('키워드를 입력해주세요');
          $('#ruleIncludeKeywords').focus();
          return;
        }
        if (!form.reportValidity()) return;
        perform(saveRule);
      });
      renderRuleList();
      updateButtons();
    }

    Object.assign(runtime, { initRuleManagement, renderRuleList });
  };
})(window);
