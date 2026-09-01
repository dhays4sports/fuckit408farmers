/* 408-LIFE-1.8 — protected producer queue + one-time split-vault reveal. Memory-only; no browser persistence. */
(function (window, document) {
  'use strict';
  var BUILD = '408-LIFE-1.8';
  var QUEUE = '/api/life/producer/queue';
  var ITEM = '/api/life/producer/item';
  var STATUS = '/api/life/producer/status';
  var CONVERSIONS = '/api/life/producer/conversions';
  var READINESS = '/api/life/producer/readiness';
  var SENSITIVE_REVEAL = '/api/life/producer/sensitive-reveal';
  var state = { filter: 'all', items: [], openId: '', openItem: null, busy: false };
  var labels = {
    new: 'New', initiated: 'Application initiated', emailed: 'Application emailed',
    follow_up: 'Follow-up needed', completed: 'Completed', archived: 'Archived',
    family_income: "Family's income", home_mortgage: 'Home / mortgage', children: 'Children',
    debt_final_expenses: 'Debt & final expenses', business: 'Business', coverage_in_place: 'Coverage in place', not_sure: 'Not sure yet',
    under_3_months: 'Less than 3 months', '3_to_6_months': '3–6 months', '6_to_12_months': '6–12 months', over_1_year: 'More than a year', income_not_primary: "Income isn't the primary concern",
    none: 'None', work: 'Coverage through work', personal: 'Personal policy', both: 'Work + personal coverage',
    carrier_application_start: 'Secure carrier application', finish_with_dylan_later: 'Finish with Dylan later',
    ready: 'Ready', revealed: 'Revealed', destroyed: 'Destroyed', expired: 'Expired', not_collected: 'Not collected', unavailable: 'Unavailable'
  };

  function q(sel) { return document.querySelector(sel); }
  function qa(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }
  function safe(value) { return value == null ? '' : String(value); }
  function label(value) { return labels[value] || safe(value).replace(/_/g, ' '); }
  function formatDate(value) {
    if (!value) return '';
    var d = new Date(value);
    if (Number.isNaN(d.getTime())) return safe(value);
    return new Intl.DateTimeFormat('en-US', { month:'short', day:'numeric', year:'numeric', hour:'numeric', minute:'2-digit' }).format(d);
  }
  function formatDob(value) {
    var parts = safe(value).split('-');
    return parts.length === 3 ? parts[1] + '/' + parts[2] + '/' + parts[0] : safe(value);
  }
  function setStatus(message) { var node = q('[data-life-ops-status]'); if (node) node.textContent = message || ''; }
  function setBusy(busy) { state.busy = !!busy; document.body.classList.toggle('life-ops-loading', !!busy); }
  function pill(status) { return '<span class="life-ops-pill" data-status="' + safe(status) + '">' + label(status) + '</span>'; }

  function clearDetail() {
    clearSensitivePanel();
    state.openId = '';
    state.openItem = null;
    qa('[data-life-detail]').forEach(function (node) { node.textContent = ''; });
    var record = q('[data-life-ops-record]'); var empty = q('[data-life-ops-empty]');
    if (record) record.hidden = true; if (empty) empty.hidden = false;
    qa('.life-ops-card').forEach(function (node) { node.classList.remove('is-active'); });
  }

  function clearSensitivePanel() {
    qa('[data-life-sensitive]').forEach(function (node) { node.textContent = ''; });
    var panel = q('[data-life-sensitive-panel]'); if (panel) panel.hidden = true;
  }

  function updateCounts() {
    var counts = { all: state.items.length, new:0, initiated:0, emailed:0, follow_up:0, completed:0, archived:0 };
    state.items.forEach(function (item) { if (Object.prototype.hasOwnProperty.call(counts, item.status)) counts[item.status] += 1; });
    Object.keys(counts).forEach(function (key) { var node = q('[data-life-count="' + key + '"]'); if (node) node.textContent = String(counts[key]); });
  }

  function renderList() {
    var list = q('[data-life-ops-list]'); if (!list) return;
    var items = state.filter === 'all' ? state.items : state.items.filter(function (item) { return item.status === state.filter; });
    list.textContent = '';
    if (!items.length) {
      var empty = document.createElement('div'); empty.className = 'life-ops-empty-list'; empty.textContent = 'No application starts in this view.'; list.appendChild(empty); return;
    }
    items.forEach(function (item) {
      var button = document.createElement('button');
      button.type = 'button'; button.className = 'life-ops-card' + (item.request_id === state.openId ? ' is-active' : '');
      button.setAttribute('data-life-open-id', item.request_id);
      var top = document.createElement('div'); top.className = 'life-ops-card-top';
      var copy = document.createElement('div');
      var h2 = document.createElement('h2'); h2.textContent = item.name || 'Life applicant';
      var email = document.createElement('p'); email.textContent = item.email || 'No email';
      var phone = document.createElement('p'); phone.textContent = item.phone || 'No mobile provided';
      copy.appendChild(h2); copy.appendChild(email); copy.appendChild(phone);
      var statusWrap = document.createElement('div'); statusWrap.innerHTML = pill(item.status);
      top.appendChild(copy); top.appendChild(statusWrap);
      var meta = document.createElement('div'); meta.className = 'life-ops-card-meta';
      var when = document.createElement('span'); when.textContent = formatDate(item.created_at);
      var protection = document.createElement('span'); protection.textContent = (item.protection_priority || []).slice(0,2).map(label).join(' · ');
      var campaign = document.createElement('span'); campaign.textContent = item.creative_code ? ('Creative ' + item.creative_code + ' · ' + label(item.utm_source || 'direct')) : label(item.utm_source || 'direct');
      meta.appendChild(when); meta.appendChild(protection); meta.appendChild(campaign);
      button.appendChild(top); button.appendChild(meta);
      button.addEventListener('click', function () { openItem(item.request_id); });
      list.appendChild(button);
    });
  }

  async function api(url, options) {
    var response = await window.fetch(url, Object.assign({ credentials:'same-origin', cache:'no-store', redirect:'error', headers:{ 'Accept':'application/json' } }, options || {}));
    var data = null; try { data = await response.json(); } catch (_) { data = null; }
    if (!response.ok || !data || data.ok !== true) throw new Error('request_failed');
    return data;
  }

  function pct(value) { return (Math.max(0, Number(value) || 0) * 100).toFixed(1).replace(/\.0$/, '') + '%'; }

  function renderFunnel(funnel) {
    var totals = funnel && funnel.totals ? funnel.totals : {};
    ['landing_view','start_clicked','quick_questions_complete','application_details_started','application_start_submitted'].forEach(function (name) {
      var node = q('[data-life-funnel="' + name + '"]');
      if (node) node.textContent = String(Number(totals[name]) || 0);
    });
    var rate = q('[data-life-funnel-rate]'); if (rate) rate.textContent = pct(totals.rates && totals.rates.landing_to_submission);
    var container = q('[data-life-creative-performance]'); if (!container) return;
    container.textContent = '';
    ['A','B','C','D'].forEach(function (code) {
      var values = funnel && funnel.creatives && funnel.creatives[code] ? funnel.creatives[code] : {};
      var row = document.createElement('div'); row.className = 'life-ops-creative-row';
      var name = document.createElement('strong'); name.textContent = 'Creative ' + code;
      var views = document.createElement('span'); views.textContent = String(Number(values.landing_view) || 0) + ' views';
      var submits = document.createElement('span'); submits.textContent = String(Number(values.application_start_submitted) || 0) + ' submitted';
      var conversion = document.createElement('span'); conversion.textContent = pct(values.rates && values.rates.landing_to_submission);
      row.appendChild(name); row.appendChild(views); row.appendChild(submits); row.appendChild(conversion); container.appendChild(row);
    });
  }

  function renderReadiness(data) {
    var wrap = q('[data-life-readiness]'); var labelNode = q('[data-life-readiness-label]'); var detail = q('[data-life-readiness-detail]');
    if (!wrap || !labelNode || !detail) return;
    var ready = !!(data && data.ready); wrap.setAttribute('data-ready', ready ? 'true' : 'false');
    labelNode.textContent = ready ? 'Ready for paid LIFE traffic' : 'Production configuration needs attention';
    var checks = data && data.checks ? data.checks : {};
    var missing = Object.keys(checks).filter(function (key) { return checks[key] !== true; });
    detail.textContent = ready ? 'Cloudflare runtime bindings, encryption, D1 schema, origin and protected producer access are verified.' : (missing.length ? 'Missing or failing: ' + missing.map(label).join(' · ') : 'Protected readiness check could not be completed.');
  }

  async function loadCertification() {
    try { var conversionData = await api(CONVERSIONS); renderFunnel(conversionData.funnel || {}); } catch (_) { /* queue operation remains available */ }
    try { var readinessData = await api(READINESS); renderReadiness(readinessData); } catch (_) { renderReadiness({ ready:false, checks:{} }); }
  }

  async function loadQueue() {
    if (state.busy) return;
    setBusy(true); setStatus('Refreshing secure queue…');
    try {
      var data = await api(QUEUE + '?status=all');
      state.items = Array.isArray(data.items) ? data.items : [];
      var producer = q('[data-life-ops-producer]'); if (producer) producer.textContent = data.producer || 'Authorized producer';
      updateCounts(); renderList(); setStatus(state.items.length ? state.items.length + ' application start' + (state.items.length === 1 ? '' : 's') + ' loaded.' : 'No application starts are waiting.');
      if (state.openId && !state.items.some(function (item) { return item.request_id === state.openId; })) clearDetail();
    } catch (_) {
      setStatus('The protected queue could not be loaded. Verify Cloudflare Access and queue configuration.'); clearDetail();
    } finally { setBusy(false); }
  }

  function detail(name, value) { var node = q('[data-life-detail="' + name + '"]'); if (node) node.textContent = value || '—'; }
  function renderVault(meta, mode) {
    clearSensitivePanel();
    var vault = meta || { status:'not_collected', expires_at:'', revealed_at:'', destroyed_at:'' };
    var status = vault.status || 'not_collected';
    var statusNode = q('[data-life-vault-status]'); if (statusNode) { statusNode.textContent = label(status); statusNode.setAttribute('data-status', status); }
    var summary = q('[data-life-vault-summary]');
    var expiry = q('[data-life-vault-expiry]');
    var reveal = q('[data-life-sensitive-reveal]');
    if (summary) {
      if (mode === 'finish_with_dylan_later' || status === 'not_collected') summary.textContent = 'No date of birth or Social Security digits were collected for this follow-up request.';
      else if (status === 'ready') summary.textContent = 'Available for one authorized reveal to start the carrier application.';
      else if (status === 'revealed') summary.textContent = 'Already revealed once. The values cannot be opened again.';
      else if (status === 'destroyed') summary.textContent = 'The carrier-required values were permanently destroyed.';
      else if (status === 'expired') summary.textContent = 'The 72-hour window ended and the values were permanently destroyed.';
      else summary.textContent = 'Carrier-required values are unavailable.';
    }
    if (expiry) {
      if (status === 'ready' && vault.expires_at) expiry.textContent = 'Reveal window ends ' + formatDate(vault.expires_at) + '.';
      else if (status === 'revealed' && vault.revealed_at) expiry.textContent = 'Revealed ' + formatDate(vault.revealed_at) + '; automatic destruction follows shortly.';
      else if (vault.destroyed_at) expiry.textContent = 'Destroyed ' + formatDate(vault.destroyed_at) + '.';
      else expiry.textContent = '';
    }
    if (reveal) { reveal.hidden = status !== 'ready'; reveal.disabled = status !== 'ready'; }
  }

  function renderDetail(item) {
    state.openItem = item; state.openId = item.request_id;
    var a = item.applicant || {}; var e = item.engagement || {}; var c = item.attribution || {};
    var legal = [a.first_name, a.middle_name, a.last_name].filter(Boolean).join(' ');
    var address = [a.residential_address, a.residential_address_2, [a.residential_city, a.residential_state].filter(Boolean).join(', ') + (a.residential_zip ? ' ' + a.residential_zip : '')].filter(Boolean).join('\n');
    detail('legal_name', legal); detail('gender', label(a.gender)); detail('submission_mode', label(item.submission_mode));
    detail('email', a.email); detail('phone', a.phone || 'Not provided'); detail('address', address);
    detail('protection_priority', (e.protection_priority || []).map(label).join(' · ')); detail('income_runway', label(e.income_runway)); detail('existing_life_coverage', label(e.existing_life_coverage));
    detail('campaign_creative', c.creative_code ? ('Creative ' + c.creative_code + ' · ' + label(c.landing_variant)) : label(c.landing_variant)); detail('campaign_source', label(c.utm_source)); detail('campaign_name', c.utm_campaign || '—'); detail('campaign_id', c.campaign_id || '—'); detail('campaign_content', c.utm_content || '—');
    var nameNode = q('[data-life-detail-name]'); if (nameNode) nameNode.textContent = legal || 'Life applicant';
    var submitted = q('[data-life-detail-submitted]'); if (submitted) submitted.textContent = 'Submitted ' + formatDate(item.created_at);
    var status = q('[data-life-detail-status]'); if (status) { status.textContent = label(item.status); status.setAttribute('data-status', item.status); }
    var id = q('[data-life-detail-id]'); if (id) id.textContent = item.request_id;
    renderVault(item.sensitive, item.submission_mode);
    qa('[data-life-set-status]').forEach(function (button) { button.classList.toggle('is-current', button.getAttribute('data-life-set-status') === item.status); });
    var record = q('[data-life-ops-record]'); var empty = q('[data-life-ops-empty]'); if (record) record.hidden = false; if (empty) empty.hidden = true;
    renderList();
  }

  async function revealSensitive() {
    if (state.busy || !state.openId || !state.openItem || !state.openItem.sensitive || state.openItem.sensitive.status !== 'ready') return;
    if (!window.confirm('Reveal the date of birth and last four once? They cannot be opened again after this protected view.')) return;
    var id = state.openId;
    setBusy(true); setStatus('Opening the one-time protected view…');
    try {
      var data = await api(SENSITIVE_REVEAL, {
        method:'POST',
        headers:{ 'Accept':'application/json', 'Content-Type':'application/json', 'X-Life-Ops-Action':'1' },
        body:JSON.stringify({ request_id:id, confirmation:'REVEAL_ONCE' })
      });
      if (id !== state.openId) return;
      state.openItem.sensitive = { status:'revealed', expires_at:data.auto_destroy_at || '', revealed_at:new Date().toISOString(), destroyed_at:'' };
      renderVault(state.openItem.sensitive, state.openItem.submission_mode);
      var sensitive = data.sensitive || {};
      var dob = q('[data-life-sensitive="date_of_birth"]'); if (dob) dob.textContent = formatDob(sensitive.date_of_birth) || '—';
      var ssn = q('[data-life-sensitive="ssn_last4"]'); if (ssn) ssn.textContent = sensitive.ssn_last4 ? '***-**-' + sensitive.ssn_last4 : '—';
      var panel = q('[data-life-sensitive-panel]'); if (panel) { panel.hidden = false; try { panel.focus({ preventScroll:true }); } catch (_) {} }
      setStatus('One-time protected details revealed. Use them now; they cannot be reopened.');
    } catch (_) { clearSensitivePanel(); setStatus('The protected details could not be revealed. Refresh the record to confirm its current status.'); }
    finally { setBusy(false); }
  }

  async function openItem(id) {
    if (state.busy || !id) return;
    clearDetail(); state.openId = id; renderList(); setBusy(true); setStatus('Loading protected applicant details…');
    try { var data = await api(ITEM + '?id=' + encodeURIComponent(id)); renderDetail(data.item); setStatus('Applicant details loaded.'); }
    catch (_) { clearDetail(); setStatus('Applicant details could not be loaded.'); }
    finally { setBusy(false); }
  }

  async function setItemStatus(status) {
    if (state.busy || !state.openId || !status) return;
    setBusy(true); setStatus('Updating application status…');
    try {
      var data = await api(STATUS, { method:'POST', headers:{ 'Accept':'application/json', 'Content-Type':'application/json', 'X-Life-Ops-Action':'1' }, body:JSON.stringify({ request_id:state.openId, status:status }) });
      if (state.openItem) { state.openItem.status = data.status; state.openItem.sensitive = data.sensitive || state.openItem.sensitive; renderDetail(state.openItem); }
      state.items = state.items.map(function (item) { if (item.request_id === state.openId) item.status = data.status; return item; });
      updateCounts(); renderList(); setStatus('Status updated to ' + label(data.status) + '.');
    } catch (_) { setStatus('Status could not be updated.'); }
    finally { setBusy(false); }
  }

  async function deleteItem() {
    if (state.busy || !state.openId) return;
    if (!window.confirm('Permanently delete this application-start record from the producer queue? This cannot be undone.')) return;
    var id = state.openId; setBusy(true); setStatus('Deleting protected record…');
    try {
      await api(ITEM + '?id=' + encodeURIComponent(id), { method:'DELETE', headers:{ 'Accept':'application/json', 'X-Life-Ops-Action':'1' } });
      state.items = state.items.filter(function (item) { return item.request_id !== id; }); clearDetail(); updateCounts(); renderList(); setStatus('Record deleted.');
    } catch (_) { setStatus('Record could not be deleted.'); }
    finally { setBusy(false); }
  }

  function init() {
    qa('[data-life-ops-filter]').forEach(function (button) { button.addEventListener('click', function () { state.filter = button.getAttribute('data-life-ops-filter') || 'all'; qa('[data-life-ops-filter]').forEach(function (b) { b.classList.toggle('is-active', b === button); }); renderList(); }); });
    var refresh = q('[data-life-ops-refresh]'); if (refresh) refresh.addEventListener('click', function () { loadQueue(); loadCertification(); });
    var close = q('[data-life-ops-close]'); if (close) close.addEventListener('click', clearDetail);
    qa('[data-life-set-status]').forEach(function (button) { button.addEventListener('click', function () { setItemStatus(button.getAttribute('data-life-set-status')); }); });
    var del = q('[data-life-delete]'); if (del) del.addEventListener('click', deleteItem);
    var reveal = q('[data-life-sensitive-reveal]'); if (reveal) reveal.addEventListener('click', revealSensitive);
    window.addEventListener('pagehide', clearDetail);
    window.addEventListener('beforeunload', clearDetail);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') clearDetail(); });
    document.body.dataset.lifeOpsReady = 'true';
    loadQueue();
    loadCertification();
  }
  window.LifeProducerQueue = { build: BUILD, clearDetail: clearDetail };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true }); else init();
})(window, document);
