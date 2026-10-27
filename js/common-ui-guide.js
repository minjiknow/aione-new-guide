/** 공통 UI 가이드: 내용 검색, 목차 선택 상태, 표 헤더 고정을 처리합니다. */
(() => {
  'use strict';
  document.querySelectorAll('[data-guide-message-actions]').forEach(actions => {
    const types = actions.dataset.guideMessageActions === 'ai'
      ? ['copy', 'like', 'dislike', 'research', 'issue'] : ['copy'];
    types.forEach(type => {
      const button = window.AIOneChatMessageActions.createButton(type);
      button.addEventListener('click', async () => {
        if (type === 'copy') {
          try {
            await navigator.clipboard.writeText(actions.closest('.chat-msg').querySelector('.msg-text').textContent);
            window.AIOneToast.show('메시지를 복사했습니다.');
          } catch {
            window.AIOneToast.show('메시지를 복사하지 못했습니다. 브라우저의 복사 권한을 확인해 주세요.');
          }
        } else if (type === 'like' || type === 'dislike') {
          const pressed = button.getAttribute('aria-pressed') !== 'true';
          actions.querySelectorAll('[data-feedback-value]').forEach(control => {
            control.setAttribute('aria-pressed', String(control === button && pressed));
          });
        } else {
          window.AIOneToast.show('이 기능은 원본 화면에서 실행할 수 있습니다.');
        }
      });
      actions.append(button);
    });
  });
  // 예시도 실제 공통 컨트롤러를 사용합니다. 화면별 API 초기화는 호출하지 않습니다.
  document.querySelectorAll('.guide-preview .three-panel:not(.guide-panel-layout)').forEach(container => {
    window.AIOnePanel.initShell({ container, accessory: false });
  });
  document.querySelectorAll('.guide-panel-layout').forEach(container => {
    window.AIOneWorkspaceUi.initPanelDragDrop({
      container,
      applyState(state) {
        window.AIOneWorkspaceUi.applyPanelLayout(container, state, container.classList.contains('guide-panel-resizable')
          ? { minimumWidths: { folder: 120, center: 120, chat: 120 } } : {});
        // 공통 노드 이동은 재사용하고, 예시의 동일한 3열 너비는 CSS로 유지합니다.
        if (!container.classList.contains('guide-panel-resizable')) container.style.removeProperty('grid-template-columns');
      },
    });
  });
  document.querySelectorAll('.guide-panel-resizable').forEach(container => {
    window.AIOneSplitHandler.init(container);
  });
  window.AIOneWorkspaceUi.initAccessoryController({
    container: () => document.querySelector('.guide-preview .three-panel'),
    font: { cookieKey: '' },
  });
  document.querySelector('[data-guide-notification]')?.addEventListener('click', event => {
    const toast = event.currentTarget.parentElement.querySelector('.ai-one-notification-toast');
    toast.hidden = false;
    toast.classList.add('show');
  });
  document.querySelector('.guide-preview .ai-one-notification-toast button')?.addEventListener('click', event => {
    const toast = event.currentTarget.closest('.ai-one-notification-toast');
    toast.classList.remove('show');
    toast.hidden = true;
  });
  document.querySelector('.guide-preview .selected-refs-toggle')?.addEventListener('click', event => {
    const button = event.currentTarget;
    const expanded = button.closest('.selected-refs').classList.toggle('is-expanded');
    button.setAttribute('aria-expanded', String(expanded));
    const label = `선택된 소스 목록 ${expanded ? '접기' : '펼치기'}`;
    window.AIOneTooltip.hide(button);
    button.setAttribute('aria-label', label);
    button.dataset.tooltip = label;
  });
  document.querySelector('[data-guide-toast]')?.addEventListener('click', event => {
    window.AIOneToast.show('저장되었습니다.', {
      target: event.currentTarget.parentElement.querySelector('[data-toast]'),
    });
  });
  // 페이지 전용 탭은 예시의 탭 목록 안에서만 선택 상태를 전환합니다.
  document.querySelectorAll('.guide-preview [role="tablist"]').forEach(list => {
    const tabs = [...list.querySelectorAll('[role="tab"]')];
    const select = target => tabs.forEach(tab => {
      const active = tab === target;
      tab.classList.toggle('active', active);
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      const panel = document.getElementById(tab.getAttribute('aria-controls'));
      if (panel) panel.hidden = !active;
    });
    list.addEventListener('click', event => {
      const tab = event.target.closest('[role="tab"]');
      if (tabs.includes(tab) && !tab.disabled) select(tab);
    });
    list.addEventListener('keydown', event => {
      const current = tabs.indexOf(document.activeElement);
      if (current < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const index = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
        : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      select(tabs[index]);
      tabs[index].focus();
    });
  });
  const input = document.querySelector('#guide-search');
  const status = document.querySelector('#search-status');
  const empty = document.querySelector('#guide-search-empty');
  const tables = [...document.querySelectorAll('.guide-table')];
  const normalize = value => value.normalize('NFKC').toLocaleLowerCase('ko-KR').replace(/\s+/g, ' ').trim();
  // 표의 행과 표 밖 설명을 같은 검색 단위로 관리합니다.
  // 제목은 각 단위에 포함해 제목 검색 시 관련 내용을 함께 보여 줍니다.
  const searchSections = [...document.querySelectorAll('.guide-section')].map(section => {
    const title = section.querySelector(':scope > h2').textContent;
    const groups = [];
    let group = { heading: null, items: [] };
    groups.push(group);
    [...section.children].forEach(element => {
      if (element.matches('h2')) return;
      if (element.matches('h3')) {
        group = { heading: element, items: [] };
        groups.push(group);
        return;
      }
      const rows = [...element.querySelectorAll('[data-guide-row]')];
      const nodes = rows.length ? rows : [element];
      nodes.forEach(node => group.items.push({
        node,
        text: normalize([title, group.heading?.textContent || '', node.textContent].join(' ')),
      }));
    });
    return { section, groups };
  });
  const total = searchSections.reduce((sum, { groups }) => sum + groups.reduce((count, group) => count + group.items.length, 0), 0);
  status.textContent = `전체 ${total}개 내용`;
  input.addEventListener('input', () => {
    const terms = normalize(input.value).split(' ').filter(Boolean);
    let visible = 0;
    searchSections.forEach(({ section, groups }) => {
      let sectionMatches = 0;
      groups.forEach(({ heading, items }) => {
        let groupMatches = 0;
        items.forEach(({ node, text }) => {
          node.hidden = !terms.every(term => text.includes(term));
          if (!node.hidden) groupMatches++;
        });
        if (heading) heading.hidden = groupMatches === 0;
        sectionMatches += groupMatches;
      });
      section.hidden = sectionMatches === 0;
      visible += sectionMatches;
    });
    tables.forEach(table => {
      const hasMatches = !!table.querySelector('[data-guide-row]:not([hidden])');
      table.closest('.guide-table-area').hidden = !hasMatches;
      table.querySelector('.empty-row').hidden = true;
    });
    empty.hidden = visible !== 0;
    status.textContent = terms.length ? `검색 결과 ${visible}개 내용 / 전체 ${total}개` : `전체 ${total}개 내용`;
    // 아래쪽에서 검색해도 결과 시작 부분을 바로 볼 수 있게 합니다.
    scroller.scrollTop = Math.min(scroller.scrollTop, toolbar.offsetTop);
    scheduleStickyHeaders();
  });
  input.addEventListener('keydown', event => {
    if (event.key === 'Escape') { input.value = ''; input.dispatchEvent(new Event('input')); }
  });
  const links = [...document.querySelectorAll('[data-guide-section]')];
  links.forEach(link => link.addEventListener('click', () => {
    if (!document.getElementById(link.hash.slice(1))?.hidden) return;
    input.value = '';
    input.dispatchEvent(new Event('input'));
  }));
  window.AIOneSidebar.configure('#guideSidebar', {
    activePage: location.hash.slice(1) || 'components',
    storageKey: 'ai-one:guide-sidebar-collapsed',
    responsiveRail: true,
  });
  const sections = links.map(link => document.getElementById(link.hash.slice(1)));
  const setActiveSection = (sectionId) => {
    links.forEach(link => {
      const isCurrent = link.dataset.guideSection === sectionId;
      link.classList.toggle('active', isCurrent);
      if (isCurrent) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  };
  setActiveSection(location.hash.slice(1) || sections[0].id);

  // 가로 스크롤이 없는 표는 CSS sticky를 사용합니다.
  // 가로 스크롤 영역에서는 뷰포트에 고정한 표시용 헤더를 원본 열 너비와 동기화합니다.
  const toolbar = document.querySelector('.guide-toolbar');
  const scroller = document.querySelector('.guide-main');
  const wrappers = tables.map(table => table.closest('.guide-table-scroll'));
  const floatingHeader = document.createElement('div');
  floatingHeader.className = 'guide-table-sticky';
  floatingHeader.hidden = true;
  floatingHeader.setAttribute('aria-hidden', 'true');
  floatingHeader.inert = true;
  // 팝업과 같은 앱 스태킹 컨텍스트에 두어 공통 modal/drawer z-index를 따릅니다.
  scroller.append(floatingHeader);

  let frame = 0;
  let mirroredTable = null;

  function updateNavigationFromScroll() {
    const activationTop = toolbar.getBoundingClientRect().bottom + 28;
    const visibleSections = sections.filter(section => !section.hidden);
    if (!visibleSections.length) { setActiveSection(''); return; }
    let current = visibleSections[0];
    for (const section of visibleSections) {
      if (section.getBoundingClientRect().top > activationTop + 1) break;
      current = section;
    }
    if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1) {
      current = visibleSections[visibleSections.length - 1];
    }
    setActiveSection(current.id);
  }

  function updateStickyHeaders() {
    frame = 0;
    const offset = toolbar.getBoundingClientRect().height;
    document.documentElement.style.setProperty('--guide-toolbar-height', `${offset}px`);
    updateNavigationFromScroll();

    let active = null;
    for (const wrapper of wrappers) {
      if (wrapper.closest('[hidden]')) continue;
      const hasOverflow = wrapper.scrollWidth > wrapper.clientWidth + 1;
      wrapper.classList.toggle('has-horizontal-scroll', hasOverflow);
      wrapper.classList.toggle('has-no-horizontal-scroll', !hasOverflow);
      const table = wrapper.querySelector('.guide-table');
      const rect = table.getBoundingClientRect();
      table.classList.toggle('is-header-stuck', !hasOverflow && rect.top <= offset && rect.bottom > offset);
      if (hasOverflow && rect.top < offset && rect.bottom > offset) {
        active = { wrapper, table, rect };
      }
    }

    floatingHeader.hidden = !active;
    if (!active) return;

    const { wrapper, table, rect } = active;
    if (mirroredTable !== table) {
      const mirror = table.cloneNode(false);
      mirror.removeAttribute('id');
      mirror.removeAttribute('data-datatable');
      mirror.removeAttribute('data-data-table-ready');
      mirror.classList.add('guide-table-mirror');
      const columns = document.createElement('colgroup');
      for (const cell of table.tHead.rows[0].cells) {
        columns.append(document.createElement('col'));
      }
      mirror.append(columns, table.tHead.cloneNode(true));
      floatingHeader.replaceChildren(mirror);
      mirroredTable = table;
    }

    const mirror = floatingHeader.firstElementChild;
    const wrapperRect = wrapper.getBoundingClientRect();
    const cells = [...table.tHead.rows[0].cells];
    [...mirror.querySelectorAll('col')].forEach((column, index) => {
      column.style.width = `${cells[index].getBoundingClientRect().width}px`;
    });
    mirror.style.width = `${rect.width}px`;
    mirror.style.transform = `translateX(${-wrapper.scrollLeft}px)`;
    mirror.style.setProperty('--guide-scroll-left', `${wrapper.scrollLeft}px`);
    floatingHeader.style.left = `${wrapperRect.left + wrapper.clientLeft}px`;
    floatingHeader.style.width = `${wrapper.clientWidth}px`;
    const height = table.tHead.getBoundingClientRect().height;
    floatingHeader.style.transform = `translateY(${Math.min(0, rect.bottom - offset - height)}px)`;
  }

  function scheduleStickyHeaders() {
    if (!frame) frame = requestAnimationFrame(updateStickyHeaders);
  }

  const resizeObserver = new ResizeObserver(scheduleStickyHeaders);
  [toolbar, ...wrappers, ...tables].forEach(element => resizeObserver.observe(element));
  window.addEventListener('scroll', scheduleStickyHeaders, { passive: true });
  scroller.addEventListener('scroll', scheduleStickyHeaders, { passive: true });
  window.addEventListener('hashchange', scheduleStickyHeaders);
  window.addEventListener('resize', scheduleStickyHeaders, { passive: true });
  wrappers.forEach(wrapper => wrapper.addEventListener('scroll', scheduleStickyHeaders, { passive: true }));
  scheduleStickyHeaders();
})();
