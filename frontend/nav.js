/**
 * Proof of Claw — Shared Navigation Shell  v3
 * ─────────────────────────────────────────────
 * Single source of truth for sidebar + topbar across every app page.
 * Supports drag-and-drop reordering saved to localStorage.
 *
 * Drop-in — no build step:
 *   <script src="nav.js"></script>  (after wallet.js)
 *
 * Auto-detects page from location.pathname.
 * Override with: window.POC_PAGE = 'dashboard'
 */
(function () {
  'use strict';

  // ─── Default nav order (dashboard first) ────────────────────────────────────
  const DEFAULT_NAV = [
    { id: 'dashboard',    href: 'dashboard.html',    icon: '▣',  label: 'Dashboard'     },
    { id: 'agents',       href: 'agents.html',       icon: '✦',  label: 'Agents'        },
    { id: 'auth-modules', href: 'auth-modules.html', icon: '🔒', label: 'Auth Modules'  },
    { id: 'messages',     href: 'messages.html',     icon: '✉',  label: 'Messages'      },
    { id: 'proofs',       href: 'proofs.html',       icon: '✱',  label: 'Proofs'        },
    { id: 'kanban',       href: 'kanban.html',       icon: '▪',  label: 'Kanban'        },
    { id: 'soul-vault',   href: 'soul-vault.html',   icon: '⬡',  label: 'Soul Vault'    },
    { id: 'approve',      href: 'approve.html',      icon: '✔',  label: 'Approve'       },
  ];

  const STORAGE_KEY = 'poc_nav_order';

  // ─── Load saved order from localStorage ─────────────────────────────────────
  function loadNavItems() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (!Array.isArray(saved) || saved.length !== DEFAULT_NAV.length) return DEFAULT_NAV.slice();
      // Reorder DEFAULT_NAV by saved id sequence (preserves any new items we add)
      const map = Object.fromEntries(DEFAULT_NAV.map(n => [n.id, n]));
      const reordered = saved.map(id => map[id]).filter(Boolean);
      // Append any new items not in saved order
      DEFAULT_NAV.forEach(n => { if (!saved.includes(n.id)) reordered.push(n); });
      return reordered;
    } catch (_) {
      return DEFAULT_NAV.slice();
    }
  }

  function saveNavOrder(items) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items.map(n => n.id))); } catch (_) {}
  }

  // ─── Detect current page ────────────────────────────────────────────────────
  function currentPageId() {
    if (window.POC_PAGE) return window.POC_PAGE;
    const name = window.location.pathname.split('/').pop().replace('.html', '');
    return DEFAULT_NAV.some(n => n.id === name) ? name : '';
  }

  // ─── Build sidebar nav with drag-and-drop ───────────────────────────────────
  function buildNav(pageId, items) {
    const nav = document.createElement('nav');
    nav.className = 'sidebar-nav';
    nav.setAttribute('aria-label', 'App navigation');

    items.forEach((item, idx) => {
      const a = document.createElement('a');
      a.href = item.href;
      a.dataset.navId = item.id;
      a.draggable = true;
      if (item.id === pageId) {
        a.className = 'active';
        a.setAttribute('aria-current', 'page');
      }
      a.innerHTML =
        `<span class="nav-drag-handle" aria-hidden="true">⠿</span>` +
        `<span class="nav-icon">${item.icon}</span> ${item.label}`;
      nav.appendChild(a);
    });

    addDragBehavior(nav, pageId);
    return nav;
  }

  // ─── Drag-and-drop logic ────────────────────────────────────────────────────
  function addDragBehavior(nav, pageId) {
    let dragSrc = null;

    function onDragStart(e) {
      dragSrc = e.currentTarget;
      dragSrc.classList.add('nav-dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', dragSrc.dataset.navId);
    }

    function onDragOver(e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const target = e.currentTarget;
      if (!dragSrc || target === dragSrc) return;
      // Visual indicator
      nav.querySelectorAll('a').forEach(a => a.classList.remove('nav-drag-over'));
      target.classList.add('nav-drag-over');
    }

    function onDragLeave(e) {
      e.currentTarget.classList.remove('nav-drag-over');
    }

    function onDrop(e) {
      e.preventDefault();
      const target = e.currentTarget;
      target.classList.remove('nav-drag-over');
      if (!dragSrc || target === dragSrc) return;

      // Reorder DOM
      const links = [...nav.querySelectorAll('a')];
      const fromIdx = links.indexOf(dragSrc);
      const toIdx   = links.indexOf(target);
      if (fromIdx < toIdx) {
        target.after(dragSrc);
      } else {
        target.before(dragSrc);
      }

      // Save new order
      const newOrder = [...nav.querySelectorAll('a')].map(a => ({
        id:    a.dataset.navId,
        href:  DEFAULT_NAV.find(n => n.id === a.dataset.navId)?.href,
        icon:  DEFAULT_NAV.find(n => n.id === a.dataset.navId)?.icon,
        label: DEFAULT_NAV.find(n => n.id === a.dataset.navId)?.label,
      })).filter(n => n.href);
      saveNavOrder(newOrder);
    }

    function onDragEnd(e) {
      nav.querySelectorAll('a').forEach(a => {
        a.classList.remove('nav-dragging', 'nav-drag-over');
      });
      dragSrc = null;
    }

    nav.querySelectorAll('a').forEach(a => {
      a.addEventListener('dragstart', onDragStart);
      a.addEventListener('dragover',  onDragOver);
      a.addEventListener('dragleave', onDragLeave);
      a.addEventListener('drop',      onDrop);
      a.addEventListener('dragend',   onDragEnd);
    });
  }

  // ─── Inject drag-and-drop CSS ────────────────────────────────────────────────
  function injectDragStyles() {
    if (document.getElementById('poc-nav-drag-css')) return;
    const style = document.createElement('style');
    style.id = 'poc-nav-drag-css';
    style.textContent = `
      .sidebar-nav a { cursor: grab; user-select: none; position: relative; }
      .sidebar-nav a:active { cursor: grabbing; }
      .nav-drag-handle {
        display: inline-block;
        font-size: 0.6rem;
        color: var(--text-dim, #444);
        opacity: 0;
        margin-right: 4px;
        font-family: monospace;
        transition: opacity 0.15s;
        vertical-align: middle;
        pointer-events: none;
      }
      .sidebar-nav a:hover .nav-drag-handle,
      .sidebar-nav a.nav-dragging .nav-drag-handle {
        opacity: 0.5;
      }
      .sidebar-nav a.nav-dragging {
        opacity: 0.45;
        background: rgba(0,229,255,0.05) !important;
      }
      .sidebar-nav a.nav-drag-over {
        border-top: 2px solid var(--cyan, #00e5ff) !important;
        margin-top: -2px;
      }
    `;
    document.head.appendChild(style);
  }

  // ─── Build canonical sidebar-bottom ─────────────────────────────────────────
  function buildBottom(pageId) {
    const div = document.createElement('div');
    div.className = 'sidebar-bottom';
    div.innerHTML = `
      <div id="poc-connection-slot"></div>
      <a href="docs.html" class="btn-docs${pageId === 'docs' ? ' active' : ''}">
        <span class="nav-icon">📄</span> Docs
      </a>
      <a href="${pageId === 'agents' ? '#' : 'agents.html'}"
         id="sidebar-new-agent-btn"
         class="btn-new-agent">+ New Agent</a>
      <a href="index.html" class="btn-home">&#x2190; Back to Home</a>
    `.trim();
    return div;
  }

  // ─── Build topbar wallet widget ─────────────────────────────────────────────
  function walletHTML() {
    return `
      <button id="wallet-connect-btn"
        style="background:transparent;border:1px solid var(--border-cyan);color:var(--cyan);padding:5px 14px;border-radius:6px;font-family:var(--font-mono);font-size:12px;font-weight:600;letter-spacing:0.04em;cursor:pointer;transition:all 0.2s;white-space:nowrap;"
        onclick="connectWalletUI()"
        aria-label="Connect wallet">
        Connect Wallet
      </button>
      <div id="wallet-display" style="display:none;align-items:center;gap:8px;">
        <span id="wallet-address"
          style="font-family:var(--font-mono);font-size:12px;color:var(--cyan);"></span>
        <span class="status-dot online" style="display:inline-block;" aria-hidden="true"></span>
      </div>
    `.trim();
  }

  // ─── Inject sidebar ──────────────────────────────────────────────────────────
  function injectSidebar(pageId) {
    const sidebar = document.querySelector('aside.sidebar, .sidebar');
    if (!sidebar) return;

    injectDragStyles();

    const items = loadNavItems();

    const oldNav = sidebar.querySelector('.sidebar-nav');
    const newNav = buildNav(pageId, items);
    if (oldNav) { oldNav.replaceWith(newNav); }
    else {
      const logo = sidebar.querySelector('.sidebar-logo');
      logo ? logo.after(newNav) : sidebar.prepend(newNav);
    }

    const oldBottom = sidebar.querySelector('.sidebar-bottom');
    const newBottom = buildBottom(pageId);
    if (oldBottom) { oldBottom.replaceWith(newBottom); }
    else { sidebar.appendChild(newBottom); }

    // Wire agents page wizard button
    if (pageId === 'agents') {
      const btn = document.getElementById('sidebar-new-agent-btn');
      if (btn) btn.onclick = (e) => { e.preventDefault(); if (typeof openWizard === 'function') openWizard(); };
    }

    // Re-render PocAPI badge
    const slot = document.getElementById('poc-connection-slot');
    if (slot && typeof PocAPI !== 'undefined' && PocAPI.renderConnectionBadge) {
      PocAPI.renderConnectionBadge(slot);
    }
  }

  // ─── Inject/standardize topbar wallet ───────────────────────────────────────
  function injectTopbarWallet(pageId) {
    if (pageId === 'approve') return;

    let topbarRight = document.querySelector('.topbar-right, .top-bar-right');
    if (!topbarRight) {
      const header = document.querySelector('header.topbar, header.top-bar');
      if (!header) return;
      topbarRight = document.createElement('div');
      topbarRight.className = 'topbar-right';
      header.appendChild(topbarRight);
    }

    const existingBtn = topbarRight.querySelector('#wallet-connect-btn');
    if (existingBtn) {
      existingBtn.style.cssText = 'background:transparent;border:1px solid var(--border-cyan);color:var(--cyan);padding:5px 14px;border-radius:6px;font-family:var(--font-mono);font-size:12px;font-weight:600;letter-spacing:0.04em;cursor:pointer;white-space:nowrap;transition:all 0.2s;';
      existingBtn.removeAttribute('class');
      const addr = topbarRight.querySelector('#wallet-address');
      if (addr) addr.style.color = 'var(--cyan)';
      const display = topbarRight.querySelector('#wallet-display');
      if (display && !display.querySelector('.status-dot')) {
        const dot = document.createElement('span');
        dot.className = 'status-dot online';
        dot.style.display = 'inline-block';
        dot.setAttribute('aria-hidden', 'true');
        display.appendChild(dot);
      }
      return;
    }

    topbarRight.insertAdjacentHTML('beforeend', walletHTML());
  }

  // ─── Main ────────────────────────────────────────────────────────────────────
  function run() {
    const pageId = currentPageId();
    injectSidebar(pageId);
    injectTopbarWallet(pageId);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
