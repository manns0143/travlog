// Travlog: editing the day's itinerary. Anyone who has joined can change it, and everyone sees it at once.
import { getApp } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js';
import { getDatabase, ref, onValue, set, update, remove, push } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-database.js';
import { DB_URL } from './config.js';

const API = 'https://travlog-api.mannmshah143.workers.dev';
const db = getDatabase(getApp(), DB_URL), auth = getAuth(getApp());
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const panel = $('editPanel'), body = $('editBody');

const KINDS = { stop: 'Stop', hotel: 'Hotel', airport: 'Airport', flight: 'Flight' };
const LEGS = { road: 'Road', boat: 'Boat', cable: 'Cable car', flight: 'Flight', none: 'None' };

let days = {}, dayKey = null, subscribed = false, form = null;

async function api(path, data) {
    const r = await fetch(API + path, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + await auth.currentUser.getIdToken(), 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    const out = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(out.error || 'network');
    return out;
}

const stopsOf = key => Object.entries((days[key] || {}).stops || {}).map(([id, s]) => ({ id, ...s })).sort((a, b) => (a.order || 0) - (b.order || 0));
const path = id => 'trip/days/' + dayKey + '/stops/' + id;

// ---------- Open and close (Back closes the panel) ----------
let pushedHere = false, skipPop = false;
function open() {
    const chips = [...document.querySelectorAll('#chips .chip')];
    const i = Math.max(0, chips.findIndex(c => c.classList.contains('on')));
    dayKey = String(i);
    $('editTitle').textContent = 'Edit Day ' + (i + 1);
    if (!subscribed) {
        subscribed = true;
        onValue(ref(db, 'trip/days'), s => {
            const v = s.val() || {};
            days = Array.isArray(v) ? Object.fromEntries(v.map((d, k) => [String(k), d])) : v;
            if (panel.classList.contains('open') && !form) renderList();
        }, () => { subscribed = false; });
    }
    form = null;
    renderList();
    panel.classList.add('open');
    try { history.pushState({ travlog: 'edit' }, ''); pushedHere = true; } catch (e) { }
}
function close(fromBack) {
    panel.classList.remove('open');
    document.activeElement && document.activeElement.blur && document.activeElement.blur();
    form = null;
    if (!fromBack && pushedHere) { pushedHere = false; skipPop = true; history.back(); }
}
addEventListener('popstate', e => {
    if (skipPop) { skipPop = false; e.stopImmediatePropagation(); return; }
    if (!panel.classList.contains('open')) return;
    e.stopImmediatePropagation();
    pushedHere = false;
    if (form) { form = null; renderList(); try { history.pushState({ travlog: 'edit' }, ''); pushedHere = true; } catch (x) { } }
    else close(true);
}, { capture: true });

$('editDay').addEventListener('click', open);
$('editDone').addEventListener('click', () => { if (form) { form = null; renderList(); } else close(false); });

// ---------- The day's list: tap to edit, arrows to reorder ----------
function renderList() {
    $('editDone').innerHTML = '<b>Done</b>';
    const stops = stopsOf(dayKey);
    body.innerHTML = '<ul class="list">' + (stops.length ? stops.map((s, i) => {
        const meta = [s.time ? (s.approx ? '~' : '') + s.time : '', KINDS[s.kind] || 'Stop'].filter(Boolean).join(' · ');
        return '<li class="row tap" data-id="' + esc(s.id) + '"><div class="txt"><div class="name">' + esc(s.name) + '</div>' +
            '<div class="meta">' + esc(meta) + '</div></div>' +
            '<button class="move" data-move="-1"' + (i === 0 ? ' disabled' : '') + ' aria-label="Move up">↑</button>' +
            '<button class="move" data-move="1"' + (i === stops.length - 1 ? ' disabled' : '') + ' aria-label="Move down">↓</button></li>';
    }).join('') : '<li class="empty">No stops yet.</li>') + '</ul>' +
        '<button class="add-route" id="addStop" style="margin-top:12px">+ Add stop</button>' +
        '<p class="foot">Changes show on everyone’s phone straight away.</p>';
}

body.addEventListener('click', e => {
    if (form) return;
    if (e.target.closest('#addStop')) { showForm(null); return; }
    const row = e.target.closest('[data-id]');
    if (!row) return;
    const mv = e.target.closest('[data-move]');
    if (mv) { move(row.dataset.id, +mv.dataset.move); return; }
    showForm(row.dataset.id);
});

function move(id, dir) {
    const stops = stopsOf(dayKey), i = stops.findIndex(s => s.id === id), j = i + dir;
    if (i < 0 || j < 0 || j >= stops.length) return;
    [stops[i], stops[j]] = [stops[j], stops[i]];
    const changes = {};
    stops.forEach((s, k) => { changes[path(s.id) + '/order'] = k + 1; });
    update(ref(db), changes).catch(() => alert('Couldn’t save. Check your connection.'));
}

// ---------- Stop form ----------
function showForm(id) {
    const s = id ? stopsOf(dayKey).find(x => x.id === id) : { kind: 'stop', leg: 'road', name: '', time: '' };
    if (!s) return;
    form = { id, kind: s.kind || 'stop', leg: s.leg || 'road', approx: !!s.approx, lat: s.lat, lng: s.lng, placeId: s.placeId, session: crypto.randomUUID() };
    const f = s.flight || {};
    const seg = (name, opts, cur) => '<div class="seg" data-seg="' + name + '" style="grid-template-columns:repeat(' + Object.keys(opts).length + ',1fr)">' +
        Object.entries(opts).map(([k, v]) => '<button type="button" data-v="' + k + '" class="' + (k === cur ? 'on' : '') + '">' + v + '</button>').join('') + '</div>';
    body.innerHTML =
        '<p class="label">Name</p><div class="fields"><input id="efName" maxlength="80" value="' + esc(s.name) + '" placeholder="Name"></div>' +
        '<p class="label">Type</p>' + seg('kind', KINDS, form.kind) +
        '<div id="efPlain"><p class="label">Time</p><div class="fields">' +
        '<label class="row-input"><span>Time</span><input id="efTime" type="time" value="' + esc(s.time || '') + '"></label>' +
        '<div class="row-input"><span style="flex:1;width:auto;color:var(--label)">Approximate time</span><button type="button" class="switch' + (form.approx ? ' on' : '') + '" id="efApprox" aria-label="Approximate time"></button></div></div>' +
        '<p class="label">Getting there</p>' + seg('leg', LEGS, form.leg) +
        '<p class="label">Place</p><div class="fields"><input id="efPlace" placeholder="' + (typeof s.lat === 'number' ? 'Location set · search to change' : 'Search to set the location') + '" autocomplete="off"></div>' +
        '<ul class="list place-results" id="efResults" style="margin-top:8px"></ul></div>' +
        '<div id="efFlight"><p class="label">Flight</p><div class="fields">' +
        '<label class="row-input"><span>From</span><input id="efFrom" maxlength="4" value="' + esc(f.from || '') + '" placeholder="HAN" autocapitalize="characters"></label>' +
        '<label class="row-input"><span>To</span><input id="efTo" maxlength="4" value="' + esc(f.to || '') + '" placeholder="PQC" autocapitalize="characters"></label>' +
        '<label class="row-input"><span>Departs</span><input id="efDep" type="time" value="' + esc(f.dep || s.time || '') + '"></label>' +
        '<label class="row-input"><span>Lands</span><input id="efArr" type="time" value="' + esc(f.arr || '') + '"></label></div></div>' +
        '<p class="label">Note</p><div class="fields"><textarea id="efNote" rows="2" maxlength="300" placeholder="Optional">' + esc(s.note || '') + '</textarea></div>' +
        '<button class="primary" id="efSave">' + (id ? 'Save' : 'Add Stop') + '</button>' +
        (id ? '<button class="danger-link" id="efDelete">Delete stop</button>' : '');
    $('editDone').textContent = 'Cancel';
    syncKind();

    body.querySelectorAll('[data-seg] button').forEach(b => b.addEventListener('click', () => {
        const segEl = b.parentElement;
        segEl.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
        form[segEl.dataset.seg] = b.dataset.v;
        syncKind();
    }));
    $('efApprox').addEventListener('click', () => { form.approx = !form.approx; $('efApprox').classList.toggle('on', form.approx); });
    $('efPlace').addEventListener('input', placeSearch);
    $('efSave').addEventListener('click', save);
    if (id) $('efDelete').addEventListener('click', deleteStop);
    body.scrollTop = 0;
    if (!id) $('efName').focus();
}

function syncKind() {
    $('efPlain').hidden = form.kind === 'flight';
    $('efFlight').hidden = form.kind !== 'flight';
}

let placeTimer = 0, placeSeq = 0;
function placeSearch() {
    clearTimeout(placeTimer);
    const q = $('efPlace').value.trim();
    if (q.length < 2) { $('efResults').innerHTML = ''; return; }
    placeTimer = setTimeout(async () => {
        const seq = ++placeSeq;
        try {
            const r = await api('/autocomplete', { input: q, session: form.session });
            if (seq !== placeSeq || !form) return;
            $('efResults').innerHTML = (r.places || []).map((p, i) =>
                '<li class="row tap" data-i="' + i + '"><div class="txt"><div class="name">' + esc(p.name) + '</div><div class="meta">' + esc(p.address) + '</div></div></li>').join('');
            $('efResults').querySelectorAll('[data-i]').forEach(row => row.addEventListener('click', () => pickPlace(r.places[+row.dataset.i])));
        } catch (e) {
            if (seq === placeSeq && form) $('efResults').innerHTML = '<li class="empty">' + (e.message === 'limit' ? 'Search is paused for today.' : 'Couldn’t search.') + '</li>';
        }
    }, 300);
}

async function pickPlace(p) {
    try {
        const d = await api('/place', { id: p.id, session: form.session });
        form.session = crypto.randomUUID();
        if (typeof d.lat !== 'number') return;
        Object.assign(form, { lat: d.lat, lng: d.lng, placeId: p.id });
        if (!$('efName').value.trim()) $('efName').value = p.name;
        $('efPlace').value = '';
        $('efPlace').placeholder = 'Location set: ' + p.name;
        $('efResults').innerHTML = '';
    } catch (e) {
        alert('Couldn’t open that place.');
    }
}

async function save() {
    const name = $('efName').value.trim().slice(0, 80);
    if (!name) { $('efName').focus(); return; }
    const note = $('efNote').value.trim().slice(0, 300);
    const stops = stopsOf(dayKey), old = form.id ? stops.find(s => s.id === form.id) : null;
    const s = { order: old ? old.order : (stops.length ? Math.max(...stops.map(x => x.order || 0)) + 1 : 1), kind: form.kind, name };
    if (note) s.note = note;
    if (form.kind === 'flight') {
        const dep = $('efDep').value, arr = $('efArr').value;
        s.time = dep;
        s.flight = { from: $('efFrom').value.trim().toUpperCase(), to: $('efTo').value.trim().toUpperCase(), dep, arr };
    } else {
        s.time = $('efTime').value;
        if (form.approx) s.approx = true;
        s.leg = form.leg;
        if (typeof form.lat === 'number') { s.lat = form.lat; s.lng = form.lng; }
        if (form.placeId) s.placeId = form.placeId;
    }
    const id = form.id || push(ref(db, 'trip/days/' + dayKey + '/stops')).key;
    $('efSave').disabled = true;
    try {
        await set(ref(db, path(id)), s);
        form = null;
        renderList();
    } catch (e) {
        $('efSave').disabled = false;
        alert('Couldn’t save. Check your connection.');
    }
}

let deleteArmed = 0;
async function deleteStop() {
    const btn = $('efDelete');
    if (Date.now() - deleteArmed > 3000) {
        deleteArmed = Date.now();
        btn.textContent = 'Tap again to delete';
        setTimeout(() => { if (btn.isConnected) btn.textContent = 'Delete stop'; }, 3000);
        return;
    }
    try { await remove(ref(db, path(form.id))); form = null; renderList(); }
    catch (e) { alert('Couldn’t delete. Check your connection.'); }
}