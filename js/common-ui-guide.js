/** 공통 UI 가이드: 표 검색, 목차 선택 상태, 표 헤더 고정을 처리합니다. */
(() => {
  'use strict';
  const input = document.querySelector('#guide-search');
  const rows = [...document.querySelectorAll('[data-guide-row]')];
  const status = document.querySelector('#search-status');
  const tables = [...document.querySelectorAll('.guide-table')];
  const normalize = value => value.normalize('NFKC').toLocaleLowerCase('ko-KR').replace(/\s+/g, ' ').trim();
  const index = rows.map(row => ({ row, text: normalize(row.innerText) }));
  input.addEventListener('input', () => {
    const terms = normalize(input.value).split(' ').filter(Boolean);
    let visible = 0;
    index.forEach(({ row, text }) => {
      row.hidden = !terms.every(term => text.includes(term));
      if (!row.hidden) visible++;
    });
    tables.forEach(table => {
      table.querySelector('.empty-row').hidden = !!table.querySelector('[data-guide-row]:not([hidden])');
    });
    status.textContent = terms.length ? `${visible} / ${rows.length}개 항목` : `전체 ${rows.length}개 항목`;
  });
  input.addEventListener('keydown', event => {
    if (event.key === 'Escape') { input.value = ''; input.dispatchEvent(new Event('input')); }
  });
  const links = [...document.querySelectorAll('[data-guide-section]')];
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
  document.body.append(floatingHeader);

  let frame = 0;
  let mirroredTable = null;

  function updateNavigationFromScroll() {
    const activationTop = toolbar.getBoundingClientRect().bottom + 28;
    let current = sections[0];
    for (const section of sections) {
      if (section.getBoundingClientRect().top > activationTop + 1) break;
      current = section;
    }
    if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1) {
      current = sections[sections.length - 1];
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
      const hasOverflow = wrapper.scrollWidth > wrapper.clientWidth + 1;
      wrapper.classList.toggle('has-horizontal-scroll', hasOverflow);
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
