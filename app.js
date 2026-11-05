import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js';
import { getDatabase, ref, get, set, push, update, remove, onValue, serverTimestamp } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-database.js';
import { firebaseConfig, DB_URL } from './config.js';

const API = 'https://travlog-api.mannmshah143.workers.dev';

const fb = initializeApp(firebaseConfig);
const auth = getAuth(fb);
const db = getDatabase(fb, DB_URL);

const $ = id => document.getElementById(id);
const sheet = $('sheet'), head = $('head'), scroller = $('scroll'), chipsEl = $('chips');
const dim = $('dim'), fabs = $('fabs'), searchBar = $('searchBar'), card = $('card');

const ICON = {
    plane: '<svg viewBox="0 0 24 24"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/></svg>',
    bed: '<svg viewBox="0 0 24 24"><path d="M3 7v12h2v-3h14v3h2v-7a3 3 0 0 0-3-3h-7v5H5V7zm4.5 5a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/></svg>',
    food: '<svg viewBox="0 0 24 24"><path d="M7 2h1.5v6h1V2H11v6h1V2h1.5v7a2.5 2.5 0 0 1-2 2.45V22h-2V11.45A2.5 2.5 0 0 1 7 9zm10 0c1.66 0 3 2.24 3 5v6h-2v9h-2V2z"/></svg>',
    shop: '<svg viewBox="0 0 24 24"><path d="M7 7V6.5a5 5 0 0 1 10 0V7h3l-1 15H5L4 7zm2 0h6v-.5a3 3 0 0 0-6 0z"/></svg>',
    sight: '<svg viewBox="0 0 24 24"><path d="m12 2.5 2.9 6.1 6.6.8-4.9 4.6 1.3 6.5L12 17.3l-5.9 3.2 1.3-6.5-4.9-4.6 6.6-.8z"/></svg>',
    pin: '<svg viewBox="0 0 24 24"><path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>',
    locate: '<svg viewBox="0 0 24 24"><path d="M20 4 4 10.5l7 2.5 2.5 7z"/></svg>',
    walk: '<svg viewBox="0 0 24 24"><path d="M13.5 5.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM9.8 8.9 7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3A7.3 7.3 0 0 0 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6z"/></svg>',
    car: '<svg viewBox="0 0 24 24"><path d="M18.9 6c-.2-.6-.8-1-1.4-1h-11c-.7 0-1.2.4-1.4 1L3 12v8c0 .6.4 1 1 1h1c.6 0 1-.4 1-1v-1h12v1c0 .6.4 1 1 1h1c.6 0 1-.4 1-1v-8zM6.5 16a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm11 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zM5 11l1.5-4.5h11L19 11z"/></svg>',
    bike: '<svg viewBox="0 0 24 24"><path d="M19 7c0-1.1-.9-2-2-2h-3v2h3v2.65L13.52 14H10V9H6c-2.21 0-4 1.79-4 4v3h2c0 1.66 1.34 3 3 3s3-1.34 3-3h4.48L19 10.35zM7 17c-.55 0-1-.45-1-1h2c0 .55-.45 1-1 1zM5 6h5v2H5zm14 7c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3zm0 4c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/></svg>',
};
const CATS = {
    food: { label: 'Food', color: '#FF9500', icon: ICON.food },
    shop: { label: 'Shop', color: '#30B0C7', icon: ICON.shop },
    sight: { label: 'Sight', color: '#FF3B30', icon: ICON.sight },
    hotel: { label: 'Hotel', color: '#AF52DE', icon: ICON.bed },
};
const LEG_LABEL = { boat: 'By boat', cable: 'Cable car', flight: 'Flight' };

// ---------- Small helpers ----------
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const located = s => typeof s.lat === 'number' && typeof s.lng === 'number';
const ll = s => ({ lat: s.lat, lng: s.lng });
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDate(iso, withDay = true) {
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return (withDay ? DAY_NAMES[dt.getUTCDay()] + ' ' : '') + d + ' ' + MONTHS[m - 1];
}
function hash(str) { // short, database-safe key for a list of points
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
    return 'r' + h.toString(36) + str.length.toString(36);
}
const navUrl = p => 'https://www.google.com/maps/dir/?api=1&destination=' + p.lat + ',' + p.lng +
    (p.placeId ? '&destination_place_id=' + encodeURIComponent(p.placeId) : '');

// Photos, reviews and hours: info.js loads them only when tapped, because they use a small free allowance
const placeLink = (p, path) => '<button class="more" data-info="' + esc(p.placeId || '') + '" data-name="' + esc(p.name || '') +
  '" data-lat="' + (p.lat ?? '') + '" data-lng="' + (p.lng ?? '') + '"' + (path ? ' data-path="' + esc(path) + '"' : '') +
  '>Photos, reviews and hours ›</button><div class="info"></div>';

let toastTimer = 0;
function toast(msg, action, onAction) {
    const t = $('toast'), btn = $('toastBtn');
    $('toastMsg').textContent = msg;
    btn.textContent = action || '';
    btn.onclick = () => { t.classList.remove('show'); onAction && onAction(); };
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), action ? 5000 : 3200);
}

let alertDone = null;
function confirmBox(title, msg, ok) {
    $('alertTitle').textContent = title;
    $('alertMsg').textContent = msg;
    $('alertOk').textContent = ok;
    $('alert').classList.add('open');
    return new Promise(resolve => { alertDone = resolve; });
}
function closeAlert(result) {
    $('alert').classList.remove('open');
    if (alertDone) { alertDone(result); alertDone = null; }
}
$('alertOk').addEventListener('click', () => closeAlert(true));
$('alertCancel').addEventListener('click', () => closeAlert(false));

async function api(path, body = {}) {
    const token = await auth.currentUser.getIdToken();
    const r = await fetch(API + path, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error === 'limit' ? 'limit' : data.error || 'network');
    return data;
}

// The on-screen keyboard covers the bottom of the page; keep cards above it.
const vv = window.visualViewport;
function onViewport() {
    const kb = vv ? Math.max(0, innerHeight - vv.height - vv.offsetTop) : 0;
    document.documentElement.style.setProperty('--kb', kb + 'px');
    document.documentElement.style.setProperty('--vvh', (vv ? vv.height : innerHeight) + 'px');
}
if (vv) { vv.addEventListener('resize', onViewport); vv.addEventListener('scroll', onViewport); }
onViewport();

// ---------- Sign-in and joining ----------
let started = false, myName = localStorage.getItem('travlog.name') || '';
onAuthStateChanged(auth, async user => {
    if (!user) {
        signInAnonymously(auth).catch(() => showWelcome('Couldn’t connect. Check your internet and reload.'));
        return;
    }
    if (started) return;
    let member = null, noSignal = false;
    try {
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000));
        member = (await Promise.race([get(ref(db, 'members/' + user.uid)), timeout])).val();
    } catch (e) { noSignal = true; }
    if (member) { myName = member.name; localStorage.setItem('travlog.name', myName); start(); }
    else if (noSignal && myName) start(); // offline, but this phone has joined before: open the saved copy
    else showWelcome();
});

function showWelcome(err) {
    $('welcome').hidden = false;
    if (err) $('joinError').textContent = err;
}

$('join').addEventListener('submit', async e => {
    e.preventDefault();
    const passcode = $('pass').value.trim(), name = $('name').value.trim().slice(0, 30);
    const errEl = $('joinError');
    if (!passcode || !name) { errEl.textContent = 'Enter the passcode and your name.'; return; }
    if (!auth.currentUser) { errEl.textContent = 'Still connecting. Try again in a moment.'; return; }
    $('joinBtn').disabled = true;
    errEl.textContent = '';
    try {
        await set(ref(db, 'members/' + auth.currentUser.uid), { name, passcode, joined: serverTimestamp() });
        myName = name;
        localStorage.setItem('travlog.name', name);
        $('welcome').hidden = true;
        start();
    } catch (err) {
        errEl.textContent = 'That passcode isn’t right.';
        const f = $('join');
        f.classList.remove('shake'); void f.offsetWidth; f.classList.add('shake');
    } finally {
        $('joinBtn').disabled = false;
    }
});

// ---------- App ----------
let trip = null, dayIndex = 0, routes = {}, pins = {}, chosenDay = false;

// The last copy of the trip, pins and route lines is kept on the phone for when there's no signal.
const saved = k => { try { return JSON.parse(localStorage.getItem('travlog.' + k)); } catch (e) { return null; } };
const keep = (k, v) => { try { localStorage.setItem('travlog.' + k, JSON.stringify(v)); } catch (e) { } };

function showTrip(val) {
    trip = normalise(val);
    if (!trip) { $('dayTitle').textContent = 'Travlog'; $('daySub').textContent = 'No itinerary yet'; return; }
    if (!chosenDay) dayIndex = defaultDay();
    dayIndex = Math.min(dayIndex, trip.days.length - 1);
    renderChips();
    renderDay();
    drawDay(!comparing);
}

function start() {
    started = true;
    document.body.classList.add('ready');
    initSheet();
    routes = saved('routes') || {};
    pins = saved('pins') || {};
    const lastTrip = saved('trip');
    if (lastTrip) showTrip(lastTrip);
    if (!navigator.onLine) toast('You’re offline. Showing the saved itinerary.');
    onValue(ref(db, 'trip'), snap => { keep('trip', snap.val()); showTrip(snap.val()); });
    onValue(ref(db, 'routes'), snap => { routes = snap.val() || {}; keep('routes', routes); drawDay(false); });
    onValue(ref(db, 'pins'), snap => {
        pins = snap.val() || {};
        keep('pins', pins);
        if (selectedPin && !pins[selectedPin]) hideCard();
        if (layer) layer.draw();
    });
    addEventListener('online', () => { if (!map) loadMap(); });
    loadMap();
}

function normalise(t) {
    if (!t || !t.days) return null;
    const days = (Array.isArray(t.days) ? t.days : Object.values(t.days)).filter(Boolean).map(d => ({
        ...d,
        stops: Object.entries(d.stops || {}).map(([id, s]) => ({ id, ...s })).sort((a, b) => (a.order || 0) - (b.order || 0)),
    }));
    return days.length ? { ...t, days } : null;
}

// Today in Vietnam time; Day 1 before the trip, the last day after it.
function defaultDay() {
    const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
    const i = trip.days.findIndex(d => d.date === today);
    if (i >= 0) return i;
    return today < trip.days[0].date ? 0 : trip.days.length - 1;
}

function renderChips() {
    chipsEl.innerHTML = trip.days.map((d, i) =>
        '<button class="chip' + (i === dayIndex ? ' on' : '') + '"><b>Day ' + (i + 1) + '</b> · ' + fmtDate(d.date, false) + '</button>').join('');
    [...chipsEl.children].forEach((c, i) => c.addEventListener('click', () => {
        if (i === dayIndex) return;
        dayIndex = i; chosenDay = true;
        [...chipsEl.children].forEach((x, j) => x.classList.toggle('on', j === i));
        renderDay();
        drawDay(true);
    }));
    centreChip();
}
function centreChip() {
    const on = chipsEl.children[dayIndex];
    if (on) chipsEl.scrollTo({ left: on.offsetLeft - (chipsEl.clientWidth - on.offsetWidth) / 2, behavior: 'smooth' });
}

function badgeFor(s, n) {
    if (s.kind === 'flight') return '<span class="badge flight">' + ICON.plane + '</span>';
    if (s.kind === 'airport') return '<span class="badge airport">' + ICON.plane + '</span>';
    if (s.kind === 'hotel') return '<span class="badge hotel">' + ICON.bed + '</span>';
    return '<span class="badge">' + n + '</span>';
}

function stopMeta(s) {
    const meta = [];
    if (s.kind === 'flight' && s.flight) meta.push(s.flight.from + ' → ' + s.flight.to + ' · lands ' + s.flight.arr);
    if (LEG_LABEL[s.leg] && s.leg !== 'flight') meta.push(LEG_LABEL[s.leg]);
    if (s.note) meta.push(s.note);
    return meta.join(' · ');
}
const stopTime = s => s.time ? (s.approx ? '~' : '') + s.time : '';

function renderDay() {
    const day = trip.days[dayIndex];
    $('dayTitle').textContent = 'Day ' + (dayIndex + 1);
    $('daySub').textContent = fmtDate(day.date) + ' · ' + day.city;
    let n = 0;
    $('stops').innerHTML = day.stops.length ? day.stops.map(s => {
        if (s.kind === 'stop') n++;
        const meta = stopMeta(s);
        return '<li class="row' + (located(s) ? ' tap' : '') + '" data-id="' + esc(s.id) + '">' + badgeFor(s, n) +
            '<div class="txt"><div class="name">' + esc(s.name) + '</div>' +
            (meta ? '<div class="meta">' + esc(meta) + '</div>' : '') + '</div>' +
            '<div class="time">' + esc(stopTime(s)) + '</div></li>';
    }).join('') : '<li class="empty">No stops for this day yet.</li>';
    $('stops').querySelectorAll('.row.tap').forEach(r => r.addEventListener('click', () => focusStop(r.dataset.id, 'list')));
    scroller.scrollTop = 0;
    centreChip();
}

// ---------- Map ----------
const STYLE = [
    { elementType: 'geometry', stylers: [{ color: '#F4F3EF' }] },
    { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#5A5A5E' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#F4F3EF' }, { weight: 3 }] },
    { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#C9C7C0' }] },
    { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
    { featureType: 'landscape.man_made', elementType: 'geometry', stylers: [{ color: '#EDEBE5' }] },
    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
    { featureType: 'poi.park', elementType: 'geometry', stylers: [{ visibility: 'on' }, { color: '#D6EAC9' }] },
    { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#FFFFFF' }] },
    { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#E4E1D8' }] },
    { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#7C7C80' }] },
    { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: '#F7E7B5' }] },
    { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#EAD38E' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit.station.airport', stylers: [{ visibility: 'on' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#AAD3EA' }] },
    { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#5B8FB0' }] },
];

const AREAS = {
    hanoi: [[20.96, 105.74], [21.10, 105.90]],
    ninhbinh: [[20.20, 105.85], [20.32, 105.98]],
    phuquoc: [[9.84, 103.83], [10.47, 104.10]],
    vietnam: [[8.3, 102.1], [23.4, 109.6]],
};

let map = null, geo = null, Pin = null, layer = null, drawn = [], pinEls = {};
const pending = new Set(), failed = new Set(); // road lines being fetched, or that Google couldn't route this session

let mapLoading = false;
async function loadMap() {
    if (map || mapLoading) return;
    mapLoading = true;
    try { await loadMapNow(); } finally { mapLoading = false; }
}
async function loadMapNow() {
    let key;
    try { key = (await api('/map-key')).key; }
    catch (e) {
        if (navigator.onLine) toast(e.message === 'limit' ? 'The map is paused for today. The itinerary still works.' : 'Couldn’t load the map. Check your connection.');
        return;
    }
    try {
        await new Promise((resolve, reject) => {
            window.__travlogMap = resolve;
            const s = document.createElement('script');
            s.src = 'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(key) + '&v=weekly&loading=async&callback=__travlogMap';
            s.onerror = reject;
            document.head.appendChild(s);
        });
        const { Map } = await google.maps.importLibrary('maps');
        geo = await google.maps.importLibrary('geometry');
        map = new Map($('map'), {
            center: { lat: 16, lng: 106 }, zoom: 5, styles: STYLE,
            disableDefaultUI: true, gestureHandling: 'greedy', clickableIcons: false,
            keyboardShortcuts: false, backgroundColor: '#F4F3EF',
        });
        Pin = class extends google.maps.OverlayView {
            constructor(pos, el) { super(); this.pos = pos; this.el = el; this.setMap(map); }
            onAdd() { google.maps.OverlayView.preventMapHitsAndGesturesFrom(this.el); this.getPanes().overlayMouseTarget.appendChild(this.el); }
            draw() {
                const p = this.getProjection().fromLatLngToDivPixel(this.pos);
                if (p) { this.el.style.left = p.x + 'px'; this.el.style.top = p.y + 'px'; }
            }
            onRemove() { this.el.remove(); }
        };
        definePinLayer();
        layer = new PinLayer();
        drawDay(!comparing);
        drawMe();
        if (comparing) drawCompare(true);
    } catch (e) {
        toast('Couldn’t load the map. Check your connection.');
    }
}

// Everyone's pins in one layer, merged into numbered bubbles when they crowd together.
let PinLayer = null;
function definePinLayer() { // needs Google's OverlayView, so it runs once the map script has loaded
    PinLayer = class extends google.maps.OverlayView {
        constructor() { super(); this.box = document.createElement('div'); this.box.className = 'upins'; this.setMap(map); }
        onAdd() { this.getPanes().overlayMouseTarget.appendChild(this.box); }
        onRemove() { this.box.remove(); }
        draw() {
            const proj = this.getProjection();
            if (!proj) return;
            const groups = [];
            for (const [id, p] of Object.entries(pins)) {
                const px = proj.fromLatLngToDivPixel(new google.maps.LatLng(p.lat, p.lng));
                if (!px) continue;
                const g = groups.find(g => Math.abs(g.x - px.x) < 40 && Math.abs(g.y - px.y) < 40);
                if (g) g.items.push({ id, p }); else groups.push({ x: px.x, y: px.y, items: [{ id, p }] });
            }
            this.box.replaceChildren(...groups.map(g => g.items.length === 1 ? pinButton(g) : clusterButton(g)));
        }
    };
}

function pinButton(g) {
    const { id, p } = g.items[0], c = CATS[p.cat] || CATS.sight;
    const el = document.createElement('button');
    el.className = 'upin' + (id === selectedPin ? ' lit' : '');
    el.style.cssText = 'left:' + g.x + 'px;top:' + g.y + 'px;background:' + c.color;
    el.innerHTML = c.icon;
    el.setAttribute('aria-label', p.name);
    google.maps.OverlayView.preventMapHitsAndGesturesFrom(el);
    el.addEventListener('click', () => openPin(id));
    return el;
}

function clusterButton(g) {
    const el = document.createElement('button');
    el.className = 'cluster';
    const c = CATS[g.items[0].p.cat] || CATS.sight;
    el.style.cssText = 'left:' + g.x + 'px;top:' + g.y + 'px;--c:' + c.color;
    el.textContent = g.items.length;
    google.maps.OverlayView.preventMapHitsAndGesturesFrom(el);
    el.addEventListener('click', () => {
        const pts = g.items.map(i => ll(i.p));
        const same = pts.every(p => Math.abs(p.lat - pts[0].lat) < 1e-5 && Math.abs(p.lng - pts[0].lng) < 1e-5);
        if (same) { map.setCenter(pts[0]); map.setZoom(Math.min(21, map.getZoom() + 3)); }
        else fitTo(pts);
    });
    return el;
}

function padding() {
    if (wide()) return { top: 70, right: 80, bottom: 40, left: 420 };
    return { top: (snaps.full || 0) + 70, right: 64, bottom: Math.max(120, H - snaps.half) + 24, left: 40 };
}

function fitTo(points) {
    if (!map || !points.length) return;
    const b = new google.maps.LatLngBounds();
    points.forEach(p => b.extend(p));
    if (points.length === 1) { frame(points[0]); return; }
    map.fitBounds(b, padding());
}

// Centres a point in the part of the map that isn't covered by the sheet or a card.
function frame(pt, minZoom = 15) {
    if (!map) return;
    map.panTo(pt);
    if (map.getZoom() < minZoom) map.setZoom(minZoom);
    if (wide()) map.panBy(-200, 0);
    else map.panBy(0, Math.round((cardOpen() ? card.offsetHeight + 16 : H - snaps.half) / 2));
}

// Splits the day into lines: road runs (drawn from Google's route), boat, cable car and flight legs.
function segmentsFor(day) {
    const segs = [];
    let prev = null, run = [];
    const flush = () => { if (run.length > 1) segs.push({ type: 'road', pts: run }); run = []; };
    for (const s of day.stops) {
        if (!located(s)) continue;
        if (prev) {
            const leg = s.leg || 'road';
            if (leg === 'road') { if (!run.length) run.push(prev); run.push(s); }
            else { flush(); if (leg !== 'none') segs.push({ type: leg, a: prev, b: s }); }
        }
        prev = s;
    }
    flush();
    // Google allows 10 stops in between, so long runs are split
    const out = [];
    for (const seg of segs) {
        if (seg.type !== 'road' || seg.pts.length <= 12) { out.push(seg); continue; }
        for (let i = 0; i < seg.pts.length - 1; i += 11) out.push({ type: 'road', pts: seg.pts.slice(i, i + 12) });
    }
    return out;
}

const runKey = pts => hash(pts.map(p => p.lat.toFixed(5) + ',' + p.lng.toFixed(5)).join('|'));

async function fetchRun(key, pts) {
    if (pending.has(key) || failed.has(key)) return;
    pending.add(key);
    try {
        const r = await api('/route', {
            mode: 'car', from: ll(pts[0]), to: ll(pts[pts.length - 1]), via: pts.slice(1, -1).map(ll),
        });
        if (r.line) await set(ref(db, 'routes/' + key), { line: r.line, at: serverTimestamp() });
        else failed.add(key);
    } catch (e) {
        failed.add(key);
        if (e.message === 'limit') toast('Route lines are paused for today. Straight lines shown instead.');
    } finally {
        pending.delete(key);
    }
}

function arc(a, b) { // gentle curve for flights
    const n = 64, mx = (a.lat + b.lat) / 2, my = (a.lng + b.lng) / 2;
    const dLat = b.lat - a.lat, dLng = b.lng - a.lng;
    const cx = mx - dLng * 0.18, cy = my + dLat * 0.18; // control point, off to one side
    const pts = [];
    for (let i = 0; i <= n; i++) {
        const t = i / n, u = 1 - t;
        pts.push({ lat: u * u * a.lat + 2 * u * t * cx + t * t * b.lat, lng: u * u * a.lng + 2 * u * t * cy + t * t * b.lng });
    }
    return pts;
}

function line(path, opts) {
    if (comparing) { // the day's itinerary fades into the background while comparing
        if (opts.strokeOpacity) opts.strokeOpacity *= 0.3;
        if (opts.icons) opts.icons = opts.icons.map(i => ({
            ...i, icon: {
                ...i.icon,
                fillOpacity: (i.icon.fillOpacity || 0) * 0.3, strokeOpacity: (i.icon.strokeOpacity || 0) * 0.3
            }
        }));
    }
    const l = new google.maps.Polyline({ path, map, clickable: false, geodesic: false, ...opts });
    drawn.push(l);
    return l;
}
const BLUE = '#007AFF';
const dotted = repeat => [{ icon: { path: google.maps.SymbolPath.CIRCLE, scale: 2.2, fillColor: BLUE, fillOpacity: 1, strokeOpacity: 0 }, offset: '0', repeat }];
const dashed = repeat => [{ icon: { path: 'M 0,-1 0,1', strokeColor: BLUE, strokeOpacity: 1, strokeWeight: 3, scale: 3 }, offset: '0', repeat }];

function drawDay(fit) {
    if (!map || !trip) return;
    drawn.forEach(o => o.setMap(null));
    drawn = []; pinEls = {};
    const day = trip.days[dayIndex];

    for (const seg of segmentsFor(day)) {
        if (seg.type === 'road') {
            const key = runKey(seg.pts), cached = routes[key];
            if (cached && cached.line) {
                const path = geo.encoding.decodePath(cached.line);
                line(path, { strokeColor: '#FFFFFF', strokeWeight: 8, strokeOpacity: 1, zIndex: 1 });
                line(path, { strokeColor: BLUE, strokeWeight: 4.5, strokeOpacity: 1, zIndex: 2 });
            } else {
                line(seg.pts.map(ll), { strokeColor: BLUE, strokeOpacity: 0, icons: dashed('12px'), zIndex: 2 });
                fetchRun(key, seg.pts);
            }
        } else if (seg.type === 'boat') {
            line([ll(seg.a), ll(seg.b)], { strokeOpacity: 0, icons: dotted('10px'), zIndex: 2 });
        } else if (seg.type === 'cable') {
            line([ll(seg.a), ll(seg.b)], { strokeColor: BLUE, strokeWeight: 2, strokeOpacity: .9, zIndex: 2 });
        } else if (seg.type === 'flight') {
            const path = arc(ll(seg.a), ll(seg.b));
            line(path, { strokeOpacity: 0, icons: dashed('14px'), zIndex: 2 });
            const mid = path[32], heading = geo.spherical.computeHeading(path[30], path[34]);
            const el = document.createElement('div');
            el.className = 'plane';
            el.innerHTML = ICON.plane;
            el.firstChild.style.transform = 'rotate(' + heading + 'deg)';
            drawn.push(new Pin(mid, el));
        }
    }

    // Pins: one per place, so a hotel at both ends of the day shows once
    const byPlace = new Map();
    let n = 0;
    for (const s of day.stops) {
        if (s.kind === 'stop') n++;
        if (!located(s) || s.kind === 'flight') continue;
        const at = s.lat.toFixed(5) + ',' + s.lng.toFixed(5);
        if (byPlace.has(at)) { pinEls[s.id] = byPlace.get(at); continue; }
        const el = document.createElement('button');
        el.className = 'pin' + (s.kind === 'hotel' ? ' hotel' : s.kind === 'airport' ? ' airport' : '');
        el.innerHTML = s.kind === 'hotel' ? ICON.bed : s.kind === 'airport' ? ICON.plane : String(n);
        el.setAttribute('aria-label', s.name);
        el.addEventListener('click', () => focusStop(s.id, 'map'));
        byPlace.set(at, el);
        pinEls[s.id] = el;
        drawn.push(new Pin(ll(s), el));
    }

    if (fit) fitTo(day.stops.filter(located).map(ll));
}

function focusStop(id, from) {
    const day = trip.days[dayIndex], s = day.stops.find(x => x.id === id);
    if (!s || !located(s)) return;
    document.querySelectorAll('.row.lit, .pin.lit').forEach(x => x.classList.remove('lit'));
    const row = $('stops').querySelector('[data-id="' + CSS.escape(id) + '"]');
    if (row) row.classList.add('lit');
    if (pinEls[id]) pinEls[id].classList.add('lit');
    if (from === 'map') { showStopCard(s); return; }
    if (!wide() && state === 'full') springTo('half');
    frame(ll(s), 14);
}

// ---------- Cards (pin details and pin forms) ----------
let selectedPin = null, cardClose = null, tempPin = null;
const cardOpen = () => card.classList.contains('open');

function showCard(html, actions = {}, onClose = null) {
    card.innerHTML = html;
    card.onclick = e => {
        const a = e.target.closest('[data-act]');
        if (!a) return;
        if (a.dataset.act === 'close') hideCard();
        else if (actions[a.dataset.act]) actions[a.dataset.act]();
    };
    if (cardClose && cardClose !== onClose) { const f = cardClose; cardClose = null; f(); }
    cardClose = onClose;
    card.classList.add('open');
    if (!wide() && state !== 'peek') springTo('peek');
    syncHistory();
}

function hideCard() {
    card.classList.remove('open');
    document.activeElement && document.activeElement.blur && document.activeElement.blur();
    if (selectedPin) { selectedPin = null; if (layer) layer.draw(); }
    if (cardClose) { const f = cardClose; cardClose = null; f(); }
    syncHistory();
}

function showStopCard(s) {
    if (selectedPin) { selectedPin = null; if (layer) layer.draw(); }
    const meta = [stopTime(s), stopMeta(s)].filter(Boolean).join(' · ');
    showCard(
        '<div class="card-head"><div class="txt"><div class="card-title">' + esc(s.name) + '</div>' +
        (meta ? '<div class="meta">' + esc(meta) + '</div>' : '') + '</div>' +
    '<button class="x" data-act="close" aria-label="Close">×</button></div>' + placeLink(s, 'trip/days/' + dayIndex + '/stops/' + s.id) +
    '<div class="card-actions"><a class="btn fill" href="' + navUrl(s) + '" target="_blank" rel="noopener">Navigate</a></div>');
    frame(ll(s), 14);
}

function openPin(id) {
    const p = pins[id];
    if (!p) return;
    const c = CATS[p.cat] || CATS.sight, mine = auth.currentUser && p.by === auth.currentUser.uid;
    showCard(
        '<div class="card-head"><span class="cat-dot" style="background:' + c.color + '">' + c.icon + '</span>' +
        '<div class="txt"><div class="card-title">' + esc(p.name) + '</div>' +
        '<div class="meta">' + c.label + ' · Added by ' + esc(mine ? 'you' : p.byName) + '</div></div>' +
        '<button class="x" data-act="close" aria-label="Close">×</button></div>' +
        (p.note ? '<p class="card-note">' + esc(p.note) + '</p>' : '') + placeLink(p) +
        '<div class="card-actions"><a class="btn fill" href="' + navUrl(p) + '" target="_blank" rel="noopener">Navigate</a>' +
        (mine ? '<button class="btn" data-act="edit">Edit</button><button class="btn danger" data-act="delete">Delete</button>' : '') +
        '</div>',
        { edit: () => editPin(id), delete: () => deletePin(id) });
    selectedPin = id;
    if (layer) layer.draw();
    frame(ll(p), 15);
}

function pinForm({ title, name, cat, note, submit, onSave, onClose, link }) {
  showCard(
    '<div class="card-head"><div class="txt"><div class="card-title">' + esc(title) + '</div></div>' +
    '<button class="x" data-act="close" aria-label="Close">×</button></div>' + (link || '') +
        '<div class="fields"><input id="pfName" maxlength="80" placeholder="Name" value="' + esc(name) + '">' +
        '<textarea id="pfNote" maxlength="500" rows="2" placeholder="Note (optional)">' + esc(note || '') + '</textarea></div>' +
        '<div class="seg" id="pfCat">' + Object.entries(CATS).map(([k, c]) =>
            '<button type="button" data-cat="' + k + '" class="' + (k === cat ? 'on' : '') + '">' + c.label + '</button>').join('') + '</div>' +
        '<button class="primary" data-act="save">' + esc(submit) + '</button>',
        {
            save: async () => {
                const v = {
                    name: $('pfName').value.trim().slice(0, 80),
                    note: $('pfNote').value.trim().slice(0, 500),
                    cat: card.querySelector('#pfCat .on').dataset.cat,
                };
                if (!v.name) { $('pfName').focus(); return; }
                const btn = card.querySelector('[data-act="save"]');
                btn.disabled = true;
                try { await onSave(v); }
                catch (e) { btn.disabled = false; toast('Couldn’t save. Check your connection.'); }
            },
        }, onClose);
    card.querySelectorAll('#pfCat button').forEach(b => b.addEventListener('click', () => {
        card.querySelectorAll('#pfCat button').forEach(x => x.classList.toggle('on', x === b));
    }));
}

function editPin(id) {
    const p = pins[id];
    if (!p) return;
    pinForm({
        title: 'Edit pin', name: p.name, cat: p.cat, note: p.note, submit: 'Save',
        onSave: async v => {
            await update(ref(db, 'pins/' + id), { name: v.name, cat: v.cat, note: v.note || null });
            openPin(id);
        },
    });
}

async function deletePin(id) {
    const p = pins[id];
    if (!p) return;
    if (!(await confirmBox('Delete “' + p.name + '”?', 'It disappears from everyone’s map.', 'Delete'))) return;
    hideCard();
    try {
        await remove(ref(db, 'pins/' + id));
        toast('Pin deleted', 'Undo', () => set(ref(db, 'pins/' + id), { ...p, at: serverTimestamp() }));
    } catch (e) {
        toast('Couldn’t delete. Check your connection.');
    }
}

function showTemp(pos) {
    hideTemp();
    const el = document.createElement('div');
    el.className = 'pin new';
    el.innerHTML = ICON.pin;
    tempPin = { pos, el, overlay: new Pin(pos, el) };
}
function hideTemp() {
    if (tempPin) { tempPin.overlay.setMap(null); tempPin = null; }
}

// ---------- Search (also used to choose From and To in Compare) ----------
let session = null, searchSeq = 0, searchTimer = 0, found = [], searchMode = null;
const searchOpen = () => $('search').classList.contains('open');

function openSearch(mode = null) {
    if (cardOpen()) hideCard();
    searchMode = mode;
    $('q').placeholder = mode ? (mode.end === 'from' ? 'Choose start' : 'Choose destination') : 'Search Vietnam';
    $('search').classList.add('open');
    $('q').value = '';
    $('q').focus();
    session = crypto.randomUUID();
    showResults('', null);
    syncHistory();
}
searchBar.addEventListener('click', () => openSearch());
$('qCancel').addEventListener('click', () => closeSearch());
function closeSearch() {
    $('search').classList.remove('open');
    $('q').blur();
    clearTimeout(searchTimer);
    searchSeq++;
    searchMode = null;
    syncHistory();
}

$('q').addEventListener('input', () => {
    clearTimeout(searchTimer);
    const q = $('q').value.trim();
    showResults(q, null);
    if (q.length >= 2) searchTimer = setTimeout(() => runSearch(q), 300);
});
$('q').addEventListener('keydown', e => { if (e.key === 'Enter') { clearTimeout(searchTimer); runSearch($('q').value.trim()); } });

async function runSearch(q) {
    if (q.length < 2) return;
    const seq = ++searchSeq;
    const c = map && map.getCenter();
    try {
        const r = await api('/autocomplete', { input: q, session, near: c ? { lat: c.lat(), lng: c.lng() } : undefined });
        if (seq === searchSeq) showResults(q, r.places);
    } catch (e) {
        if (seq === searchSeq) showResults(q, [], e.message === 'limit' ? 'Search is paused for today.' : 'Couldn’t search. Check your connection.');
    }
}

function showResults(q, places, err) {
    const ql = q.toLowerCase();
    found = [];
    const add = item => found.push(item) - 1;
    const row = (item, icon, color, name, sub) =>
        '<li class="row tap" data-i="' + add(item) + '"><span class="badge" style="background:' + color + '">' + icon + '</span>' +
        '<div class="txt"><div class="name">' + esc(name) + '</div>' + (sub ? '<div class="meta">' + esc(sub) + '</div>' : '') + '</div></li>';
    let html = '';
    const section = (title, rows) => {
        if (rows.length) html += (title ? '<p class="section">' + esc(title) + '</p>' : '<div style="height:8px"></div>') + '<ul class="list">' + rows.join('') + '</ul>';
    };
    if (searchMode) { // choosing a From or To: offer My Location and the day's stops first
        if (!ql || 'my location'.includes(ql)) section('', [row({ me: true }, ICON.locate, BLUE, 'My Location', '')]);
        const seen = new Set(), stops = trip ? trip.days[dayIndex].stops.filter(s => {
            if (!located(s) || (ql && !s.name.toLowerCase().includes(ql))) return false;
            const k = s.name + s.lat + s.lng;
            if (seen.has(k)) return false;
            seen.add(k); return true;
        }) : [];
        section('Day ' + (dayIndex + 1), stops.map(s => row({ stop: s }, s.kind === 'hotel' ? ICON.bed : ICON.pin,
            s.kind === 'hotel' ? '#AF52DE' : BLUE, s.name, stopTime(s))));
    }
if (ql || !searchMode) { // with nothing typed, list every pin, newest first
    const saved = Object.entries(pins).filter(([, p]) => p.name.toLowerCase().includes(ql))
      .sort((a, b) => (b[1].at || 0) - (a[1].at || 0)).slice(0, ql ? 5 : 500);
    section(ql ? 'On the map' : 'All pins · ' + saved.length, saved.map(([id, p]) => {
            const c = CATS[p.cat] || CATS.sight;
            return row({ saved: id }, c.icon, c.color, p.name, c.label + ' · ' + p.byName);
        }));
    }
    if (places && places.length) section('Places', places.map(p => row({ place: p }, ICON.pin, '#8E8E93', p.name, p.address)));
    if (err) html += '<p class="foot">' + esc(err) + '</p>';
    else if (ql.length >= 2 && places && !found.length) html += '<p class="foot">No places found.</p>';
    $('results').innerHTML = html;
    $('results').querySelectorAll('[data-i]').forEach(r => r.addEventListener('click', () => pick(found[+r.dataset.i])));
}

async function pick(item) {
    const mode = searchMode;
    closeSearch();
    if (mode) { setEndpoint(mode, item); return; }
    if (item.saved) { openPin(item.saved); return; }
    const place = item.place;
    const already = Object.entries(pins).find(([, p]) => p.placeId === place.id);
    if (already) { openPin(already[0]); toast('Already pinned by ' + (already[1].by === auth.currentUser.uid ? 'you' : already[1].byName)); return; }
    let d;
    try { d = await api('/place', { id: place.id, session }); }
    catch (e) { toast(e.message === 'limit' ? 'Search is paused for today.' : 'Couldn’t open that place.'); return; }
    session = crypto.randomUUID();
    if (!map || typeof d.lat !== 'number') return;
    const pos = { lat: d.lat, lng: d.lng };
    showTemp(pos);
    pinForm({
        title: 'New pin', name: place.name, cat: 'food', note: '', submit: 'Add Pin',
        link: placeLink({ name: place.name, placeId: place.id }),
        onSave: async v => {
            const r = push(ref(db, 'pins'));
            const pin = {
                name: v.name, cat: v.cat, lat: pos.lat, lng: pos.lng, placeId: place.id, address: d.address || place.address || '',
                by: auth.currentUser.uid, byName: myName || 'Someone', at: serverTimestamp()
            };
            if (v.note) pin.note = v.note;
            await set(r, pin);
            cardClose = null;
            hideTemp();
            hideCard();
            toast('Pin added');
        },
        onClose: hideTemp,
    });
    frame(pos, 16);
}

// ---------- City jump menu ----------
const citiesOpen = () => $('cities').classList.contains('open');
function openCities(open) {
    $('cities').classList.toggle('open', open);
    $('actionDim').classList.toggle('open', open);
    syncHistory();
}
$('citiesBtn').addEventListener('click', () => openCities(true));
$('citiesCancel').addEventListener('click', () => openCities(false));
$('actionDim').addEventListener('click', () => openCities(false));
document.querySelectorAll('[data-city]').forEach(b => b.addEventListener('click', () => {
    openCities(false);
    const [[s, w], [n, e]] = AREAS[b.dataset.city];
    fitTo([{ lat: s, lng: w }, { lat: n, lng: e }]);
}));

// ---------- My location ----------
let me = null, meWatch = null, meWanted = false, meDot = null, meHalo = null, meWaiters = [], centreOnFix = false;

function watchMe() {
    if (!navigator.geolocation) { toast('Location isn’t available on this device.'); return false; }
    meWanted = true;
    if (meWatch !== null) return true;
    meWatch = navigator.geolocation.watchPosition(p => {
        me = { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy };
        drawMe();
        meWaiters.splice(0).forEach(f => f(me));
        if (centreOnFix) { centreOnFix = false; frame(ll(me), 15); }
    }, err => {
        stopWatch();
        meWanted = false;
        $('locateBtn').classList.remove('on');
        meWaiters.splice(0).forEach(f => f(null));
        toast(err.code === 1 ? 'Location is blocked. Allow it for this site in your browser settings.' : 'Couldn’t find your location.');
    }, { enableHighAccuracy: true, maximumAge: 15000, timeout: 30000 });
    return true;
}
function stopWatch() {
    if (meWatch !== null) { navigator.geolocation.clearWatch(meWatch); meWatch = null; }
}
function getMe() {
    if (me) return Promise.resolve(me);
    if (!watchMe()) return Promise.resolve(null);
    return new Promise(resolve => { meWaiters.push(resolve); setTimeout(() => resolve(me), 20000); });
}
// Stop using GPS while the app is in the background, to save battery
document.addEventListener('visibilitychange', () => { if (document.hidden) stopWatch(); else if (meWanted) watchMe(); });

$('locateBtn').addEventListener('click', () => {
    $('locateBtn').classList.add('on');
    if (me) frame(ll(me), 15);
    else { centreOnFix = true; watchMe(); }
});

function drawMe() {
    if (!map || !me) return;
    if (!meDot) {
        const el = document.createElement('div');
        el.className = 'me';
        meDot = new Pin(ll(me), el);
        meHalo = new google.maps.Circle({ map, center: ll(me), radius: me.acc, fillColor: BLUE, fillOpacity: .1, strokeOpacity: 0, clickable: false });
    } else {
        meDot.pos = ll(me);
        meDot.draw();
        meHalo.setCenter(ll(me));
        meHalo.setRadius(me.acc);
    }
}

// ---------- Compare ----------
const ROUTE_COLORS = ['#FF9500', '#34C759', '#AF52DE', '#FF2D55', '#5AC8FA', '#A2845E'];
const MODES = { walk: { icon: ICON.walk, label: 'Walk' }, car: { icon: ICON.car, label: 'Car' }, bike: { icon: ICON.bike, label: 'Motorbike' } };
const FRESH = 15 * 60e3; // results are reused for 15 minutes
let comparing = false, cmp = saved('compare') || [], cmpDrawn = [];
cmp.forEach(r => { r.loading = false; r.res = Object.fromEntries(Object.entries(r.res || {}).filter(([, v]) => v && !v.loading)); });
const keepCompare = () => keep('compare', cmp);

function fmtDur(s) {
    const m = Math.max(1, Math.round(s / 60));
    return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + (m % 60) + ' min' : '');
}
function fmtDist(m) { return m < 1000 ? Math.round(m / 10) * 10 + ' m' : (m / 1000).toFixed(m < 10000 ? 1 : 0) + ' km'; }
function metres(a, b) { // straight-line distance
    const r = Math.PI / 180, x = (b.lng - a.lng) * r * Math.cos((a.lat + b.lat) * r / 2), y = (b.lat - a.lat) * r;
    return Math.sqrt(x * x + y * y) * 6371e3;
}

function enterCompare() {
    if (cardOpen()) hideCard();
    comparing = true;
    document.body.classList.add('comparing');
    $('dayHead').hidden = true; chipsEl.hidden = true; $('cmpHead').hidden = false;
    $('dayView').hidden = true; $('compareView').hidden = false;
    measure();
    if (!wide()) springTo('half');
    drawDay(false);
    if (!cmp.length) addRoute();
    else { renderCompare(); cmp.forEach(r => compute(r)); drawCompare(true); }
    syncHistory();
}

function exitCompare() {
    comparing = false;
    document.body.classList.remove('comparing');
    $('dayHead').hidden = false; chipsEl.hidden = false; $('cmpHead').hidden = true;
    $('dayView').hidden = false; $('compareView').hidden = true;
    cmpDrawn.forEach(o => o.setMap(null)); cmpDrawn = [];
    measure();
    setY(snaps[state]);
    drawDay(true);
    syncHistory();
}
$('compareBtn').addEventListener('click', () => comparing ? exitCompare() : enterCompare());
$('compareDone').addEventListener('click', exitCompare);
$('compareRefresh').addEventListener('click', () => cmp.forEach(r => compute(r, true)));

function hotelOfDay() {
    const h = trip && trip.days[dayIndex].stops.find(s => s.kind === 'hotel' && located(s));
    return h ? { name: h.name, lat: h.lat, lng: h.lng } : null;
}

// From starts as the last start you used, so five restaurants from the hotel means choosing the hotel once.
function addRoute() {
    const from = saved('lastFrom') || (me ? { me: true, name: 'My Location' } : hotelOfDay());
    const r = { id: Date.now().toString(36), from, to: null, sel: 'car', res: {} };
    cmp.push(r);
    keepCompare();
    renderCompare();
    openSearch({ id: r.id, end: 'to' });
}

async function endpointFrom(item) {
    if (item.me) return { me: true, name: 'My Location' };
    if (item.stop) return { name: item.stop.name, lat: item.stop.lat, lng: item.stop.lng };
    if (item.saved) { const p = pins[item.saved]; return p ? { name: p.name, lat: p.lat, lng: p.lng, placeId: p.placeId } : null; }
    if (item.place) {
        try {
            const d = await api('/place', { id: item.place.id, session });
            session = crypto.randomUUID();
            return typeof d.lat === 'number' ? { name: item.place.name, lat: d.lat, lng: d.lng, placeId: item.place.id } : null;
        } catch (e) {
            toast(e.message === 'limit' ? 'Search is paused for today.' : 'Couldn’t open that place.');
        }
    }
    return null;
}

async function setEndpoint(mode, item) {
    const r = cmp.find(x => x.id === mode.id);
    if (!r) return;
    const ep = await endpointFrom(item);
    if (!ep) return;
    r[mode.end] = ep;
    r.res = {}; r.at = 0; r.userSel = false;
    if (mode.end === 'from') keep('lastFrom', ep);
    keepCompare();
    renderCompare();
    compute(r);
}

async function coords(ep) {
    if (!ep) return null;
    if (!ep.me) return { lat: ep.lat, lng: ep.lng };
    const m = await getMe();
    if (!m) { toast('Turn on location to use My Location.'); return null; }
    return ll(m);
}
const epPoint = ep => ep && (ep.me ? (me ? ll(me) : null) : { lat: ep.lat, lng: ep.lng });

async function routeMode(r, mode, a, b) {
    try {
        const d = await api('/route', { mode, from: a, to: b, traffic: mode !== 'walk' });
        r.res[mode] = d.none ? { none: true } : d;
    } catch (e) {
        r.res[mode] = { error: e.message === 'limit' ? 'limit' : 'error' };
    }
}

// Walk and car come straight away; motorbike only on tap, because it has a small free allowance.
async function compute(r, force = false) {
    if (!r.from || !r.to) return;
    if (!force && r.at && Date.now() - r.at < FRESH && r.res.car) { renderCompare(); drawCompare(false); return; }
    const a = await coords(r.from), b = await coords(r.to);
    if (!a || !b) return;
    r.res = {}; r.loading = true;
    renderCompare();
    const jobs = [routeMode(r, 'car', a, b)];
    if (metres(a, b) <= 15000) jobs.push(routeMode(r, 'walk', a, b)); else r.res.walk = { none: true };
    await Promise.all(jobs);
    r.loading = false; r.at = Date.now();
    if (!r.userSel || !(r.res[r.sel] && r.res[r.sel].line)) {
        r.sel = r.res.walk && r.res.walk.seconds && r.res.walk.seconds <= 1200 ? 'walk' : 'car';
    }
    keepCompare();
    renderCompare();
    drawCompare(true);
}

async function chooseMode(r, m) {
    const res = r.res[m];
    if (res && res.line) { r.sel = m; r.userSel = true; keepCompare(); renderCompare(); drawCompare(false); return; }
    if (r.loading || (res && (res.loading || res.none || res.error === 'limit'))) return;
    const a = await coords(r.from), b = await coords(r.to);
    if (!a || !b) return;
    r.res[m] = { loading: true };
    renderCompare();
    await routeMode(r, m, a, b);
    if (r.res[m] && r.res[m].line) { r.sel = m; r.userSel = true; }
    keepCompare();
    renderCompare();
    drawCompare(false);
}

function modeChip(r, m) {
    const res = r.res[m];
    let txt;
    if ((r.loading && m !== 'bike') || (res && res.loading)) txt = '…';
    else if (!res) txt = m === 'bike' ? 'Show' : '…';
    else if (res.error === 'limit') txt = 'Paused';
    else if (res.error) txt = 'Retry';
    else if (res.none) txt = '—';
    else txt = fmtDur(res.seconds) + '<small>' + fmtDist(res.meters) + '</small>';
    return '<button class="mode' + (r.sel === m && res && res.line ? ' on' : '') + '" data-act="mode" data-m="' + m + '" aria-label="' + MODES[m].label + '">' +
        MODES[m].icon + '<span>' + txt + '</span></button>';
}

function renderCompare() {
    if (!comparing) return;
    $('compareView').innerHTML = cmp.map((r, i) => {
        const col = ROUTE_COLORS[i % ROUTE_COLORS.length];
        return '<ul class="list cmp" data-id="' + r.id + '">' +
            '<li class="row tap" data-act="from"><span class="dot" style="background:' + col + '"></span>' +
            '<div class="txt"><div class="meta">From</div><div class="name' + (r.from ? '' : ' muted') + '">' + esc(r.from ? r.from.name : 'Choose start') + '</div></div>' +
            '<button class="x" data-act="remove" aria-label="Remove route">×</button></li>' +
            '<li class="row tap" data-act="to"><span class="dot hollow" style="border-color:' + col + '"></span>' +
            '<div class="txt"><div class="meta">To</div><div class="name' + (r.to ? '' : ' muted') + '">' + esc(r.to ? r.to.name : 'Choose destination') + '</div></div></li>' +
            (r.from && r.to ? '<li class="row modes">' + ['walk', 'car', 'bike'].map(m => modeChip(r, m)).join('') + '</li>' : '') +
            '</ul>';
    }).join('') +
        '<button class="add-route" id="addRoute">+ Add route</button>' +
        '<p class="foot">Tap 🚶 🚗 🛵 to show that route on the map. Motorbike times use a small daily allowance, so they load on tap.</p>';
}

$('compareView').addEventListener('click', e => {
    if (e.target.closest('#addRoute')) { addRoute(); return; }
    const a = e.target.closest('[data-act]'), grp = e.target.closest('[data-id]');
    if (!a || !grp) return;
    const r = cmp.find(x => x.id === grp.dataset.id);
    if (!r) return;
    const act = a.dataset.act;
    if (act === 'remove') { cmp = cmp.filter(x => x !== r); keepCompare(); renderCompare(); drawCompare(false); }
    else if (act === 'from' || act === 'to') openSearch({ id: r.id, end: act });
    else if (act === 'mode') chooseMode(r, a.dataset.m);
});

function drawCompare(fit) {
    cmpDrawn.forEach(o => o.setMap(null));
    cmpDrawn = [];
    if (!map || !comparing) return;
    const pts = [];
    cmp.forEach((r, i) => {
        const col = ROUTE_COLORS[i % ROUTE_COLORS.length], res = r.res[r.sel];
        if (res && res.line) {
            const path = geo.encoding.decodePath(res.line);
            cmpDrawn.push(new google.maps.Polyline({ path, map, clickable: false, strokeColor: '#FFFFFF', strokeWeight: 8, zIndex: 5 }));
            cmpDrawn.push(new google.maps.Polyline({ path, map, clickable: false, strokeColor: col, strokeWeight: 4.5, zIndex: 6 }));
        }
        [r.from, r.to].forEach((ep, k) => {
            const p = epPoint(ep);
            if (!p) return;
            const el = document.createElement('div');
            el.className = 'cmp-dot' + (k ? ' end' : '');
            el.style.setProperty('--c', col);
            cmpDrawn.push(new Pin(p, el));
            pts.push(p);
        });
    });
    if (fit && pts.length) fitTo(pts);
}

// ---------- Back button ----------
// Back closes whatever is on top (alert, search, card, menu, raised sheet) instead of leaving the app.
// Chrome ignores history entries added before the first tap, so nothing is added until then.
let pushed = false, skipPop = false, touched = false;
addEventListener('pointerup', () => { touched = true; syncHistory(); }, { capture: true });
const layersOpen = () => searchOpen() || cardOpen() || citiesOpen() || comparing || (!wide() && state !== 'peek');
function syncHistory() {
    if (!touched) return;
    try {
        if (layersOpen() && !pushed) { history.pushState({ travlog: 1 }, ''); pushed = true; }
        else if (!layersOpen() && pushed) { pushed = false; skipPop = true; history.back(); }
    } catch (e) { }
}
addEventListener('popstate', () => {
    if (skipPop) { skipPop = false; return; }
    pushed = false;
    if ($('alert').classList.contains('open')) closeAlert(false);
    else if (searchOpen()) closeSearch();
    else if (cardOpen()) hideCard();
    else if (citiesOpen()) openCities(false);
    else if (comparing) exitCompare();
    else if (!wide() && state !== 'peek') springTo('peek');
    syncHistory();
});

// ---------- Bottom sheet (phone) ----------
let H = 0, snaps = {}, state = 'half', y = 0, anim = 0;
const ORDER = ['full', 'half', 'peek'];
function wide() { return matchMedia('(min-width: 768px)').matches; }

function measure() {
    const probe = getComputedStyle($('probe'));
    const top = parseFloat(probe.paddingTop) || 0, bottom = parseFloat(probe.paddingBottom) || 0;
    H = innerHeight;
    snaps = { full: top + 10, half: Math.round(H * 0.5), peek: H - head.offsetHeight - bottom - 4 };
    sheet.style.height = wide() ? '' : (H - snaps.full) + 'px';
}

const band = d => (1 - 1 / (d * 0.55 / H + 1)) * H;
function rubber(v) {
    if (v < snaps.full) return snaps.full - band(snaps.full - v);
    if (v > snaps.peek) return snaps.peek + band(v - snaps.peek);
    return v;
}

function setY(v) {
    y = v;
    if (wide()) {
        sheet.style.transform = '';
        [fabs, searchBar].forEach(el => { el.style.opacity = 1; el.style.pointerEvents = 'auto'; });
        return;
    }
    sheet.style.transform = 'translate3d(0,' + v + 'px,0)';
    const p = Math.min(1, Math.max(0, (snaps.half - v) / (snaps.half - snaps.full)));
    dim.style.opacity = (p * 0.12).toFixed(3);
    dim.style.pointerEvents = p > 0.5 ? 'auto' : 'none';
    const fabBottom = fabs.offsetTop + fabs.offsetHeight + 12;
    const f = Math.min(1, Math.max(0, (v - fabBottom) / 40));
    [fabs, searchBar].forEach(el => { el.style.opacity = f; el.style.pointerEvents = f > 0.5 ? 'auto' : 'none'; });
}

function springTo(name, v0 = 0) {
    cancelAnimationFrame(anim);
    state = name;
    syncHistory();
    if (wide()) { settled(); return; }
    const target = snaps[name], k = 320, c = 2 * 0.86 * Math.sqrt(k);
    let x = y, v = v0, last = performance.now();
    const step = now => {
        const dt = Math.min(0.064, (now - last) / 1000); last = now;
        const n = Math.max(1, Math.ceil(dt * 240)), h = dt / n;
        for (let i = 0; i < n; i++) { v += (-k * (x - target) - c * v) * h; x += v * h; }
        if (Math.abs(v) < 4 && Math.abs(x - target) < 0.4) { anim = 0; setY(target); settled(); return; }
        setY(x);
        anim = requestAnimationFrame(step);
    };
    anim = requestAnimationFrame(step);
}

function settled() {
    scroller.classList.toggle('free', wide() || state === 'full');
    if (!wide() && state !== 'full') scroller.scrollTop = 0;
}

function release(v) {
    const projected = y + v * 200;
    let target = ORDER.reduce((a, b) => Math.abs(snaps[b] - projected) < Math.abs(snaps[a] - projected) ? b : a);
    if (v < -0.3 && snaps[target] > y) target = ORDER.slice().reverse().find(k => snaps[k] < y - 1) || 'full';
    if (v > 0.3 && snaps[target] < y) target = ORDER.find(k => snaps[k] > y + 1) || 'peek';
    springTo(target, v * 1000);
}

let g = null, lastTouch = 0;
function down(x, fy, t, target) {
    if (wide()) return;
    const wasMoving = !!anim;
    cancelAnimationFrame(anim); anim = 0;
    g = { x0: x, y0: fy, startY: y, mode: null, wasMoving, inScroll: scroller.contains(target), samples: [{ t, y: fy }] };
}
function move(x, fy, t, e) {
    if (!g) return;
    const dx = x - g.x0, dy = fy - g.y0;
    if (!g.mode) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        if (Math.abs(dx) > Math.abs(dy)) g.mode = 'none';
        else if (scroller.classList.contains('free') && g.inScroll && !(dy > 0 && scroller.scrollTop <= 0)) g.mode = 'scroll';
        else g.mode = 'sheet';
        if (g.mode === 'sheet') { g.y0 = fy; g.startY = y; }
    }
    if (g.mode === 'scroll' && dy > 0 && scroller.scrollTop <= 0 && e.cancelable) { g.mode = 'sheet'; g.y0 = fy; g.startY = y; }
    if (g.mode !== 'sheet') return;
    if (e.cancelable) e.preventDefault();
    scroller.classList.remove('free');
    setY(rubber(g.startY + (fy - g.y0)));
    g.samples.push({ t, y: fy });
    while (g.samples.length > 2 && t - g.samples[0].t > 100) g.samples.shift();
}
function up(t) {
    if (!g) return;
    if (g.mode === 'sheet') {
        const s = g.samples, a = s[0], b = s[s.length - 1];
        const v = t - b.t > 80 || b.t === a.t ? 0 : (b.y - a.y) / (b.t - a.t);
        release(v);
    } else if (g.wasMoving || Math.abs(y - snaps[state]) > 0.5) {
        springTo(state);
    }
    g = null;
}

function initSheet() {
    sheet.addEventListener('touchstart', e => {
        lastTouch = Date.now();
        if (e.touches.length > 1) { up(e.timeStamp); return; }
        const p = e.touches[0]; down(p.clientX, p.clientY, e.timeStamp, e.target);
    }, { passive: true });
    sheet.addEventListener('touchmove', e => {
        if (e.touches.length > 1) return;
        const p = e.touches[0]; move(p.clientX, p.clientY, e.timeStamp, e);
    }, { passive: false });
    sheet.addEventListener('touchend', e => { lastTouch = Date.now(); up(e.timeStamp); });
    sheet.addEventListener('touchcancel', e => up(e.timeStamp));
    sheet.addEventListener('mousedown', e => { if (Date.now() - lastTouch > 800) down(e.clientX, e.clientY, e.timeStamp, e.target); });
    addEventListener('mousemove', e => { if (g && Date.now() - lastTouch > 800) move(e.clientX, e.clientY, e.timeStamp, e); });
    addEventListener('mouseup', e => { if (Date.now() - lastTouch > 800) up(e.timeStamp); });
    dim.addEventListener('click', () => springTo('half'));
    document.addEventListener('gesturestart', e => e.preventDefault());
    addEventListener('resize', () => { cancelAnimationFrame(anim); anim = 0; measure(); setY(snaps[state]); settled(); });

    measure();
    setY(snaps.peek);
    requestAnimationFrame(() => springTo('half'));
}
