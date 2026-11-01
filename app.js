import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js';
import { getDatabase, ref, get, set, onValue, serverTimestamp } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-database.js';

// ===== Paste your Firebase settings below (Project settings → General → Your apps → Config) =====
const firebaseConfig = {
  apiKey: "AIzaSyD0H7UHwtKSrwduZMX1O3mgbpr_OQf18HA",
  authDomain: "travlog-33ddf.firebaseapp.com",
  databaseURL: "https://travlog-33ddf-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "travlog-33ddf",
  storageBucket: "travlog-33ddf.firebasestorage.app",
  messagingSenderId: "694631578892",
  appId: "1:694631578892:web:63173c87ebc04852861d29"
};
// ===== Paste your Realtime Database link below (no / at the end) =====
const DB_URL = 'https://travlog-33ddf-default-rtdb.asia-southeast1.firebasedatabase.app';
// ==================================================================================================

const API = 'https://travlog-api.mannmshah143.workers.dev';

const fb = initializeApp(firebaseConfig);
const auth = getAuth(fb);
const db = getDatabase(fb, DB_URL);

const $ = id => document.getElementById(id);
const sheet = $('sheet'), head = $('head'), scroller = $('scroll'), chipsEl = $('chips');
const dim = $('dim'), fabs = $('fabs');

const ICON = {
    plane: '<svg viewBox="0 0 24 24"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/></svg>',
    bed: '<svg viewBox="0 0 24 24"><path d="M3 7v12h2v-3h14v3h2v-7a3 3 0 0 0-3-3h-7v5H5V7zm4.5 5a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/></svg>',
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

let toastTimer = 0;
function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}

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

// ---------- Sign-in and joining ----------
let started = false;
onAuthStateChanged(auth, async user => {
    if (!user) {
        signInAnonymously(auth).catch(() => showWelcome('Couldn’t connect. Check your internet and reload.'));
        return;
    }
    if (started) return;
    let member = null;
    try { member = (await get(ref(db, 'members/' + user.uid))).val(); } catch (e) { }
    if (member) start(); else showWelcome();
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
let trip = null, dayIndex = 0, routes = {}, chosenDay = false;

function start() {
    started = true;
    document.body.classList.add('ready');
    initSheet();
    onValue(ref(db, 'trip'), snap => {
        trip = normalise(snap.val());
        if (!trip) { $('dayTitle').textContent = 'Travlog'; $('daySub').textContent = 'No itinerary yet'; return; }
        if (!chosenDay) dayIndex = defaultDay();
        dayIndex = Math.min(dayIndex, trip.days.length - 1);
        renderChips();
        renderDay();
        drawDay(true);
    });
    onValue(ref(db, 'routes'), snap => { routes = snap.val() || {}; drawDay(false); });
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

function renderDay() {
    const day = trip.days[dayIndex];
    $('dayTitle').textContent = 'Day ' + (dayIndex + 1);
    $('daySub').textContent = fmtDate(day.date) + ' · ' + day.city;
    let n = 0;
    $('stops').innerHTML = day.stops.length ? day.stops.map(s => {
        if (s.kind === 'stop') n++;
        const meta = [];
        if (s.kind === 'flight' && s.flight) meta.push(s.flight.from + ' → ' + s.flight.to + ' · lands ' + s.flight.arr);
        if (LEG_LABEL[s.leg] && s.leg !== 'flight') meta.push(LEG_LABEL[s.leg]);
        if (s.note) meta.push(s.note);
        const time = s.time ? (s.approx ? '~' : '') + s.time : '';
        return '<li class="row' + (located(s) ? ' tap' : '') + '" data-id="' + esc(s.id) + '">' + badgeFor(s, n) +
            '<div class="txt"><div class="name">' + esc(s.name) + '</div>' +
            (meta.length ? '<div class="meta">' + esc(meta.join(' · ')) + '</div>' : '') + '</div>' +
            '<div class="time">' + esc(time) + '</div></li>';
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

let map = null, geo = null, Pin = null, drawn = [], pinEls = {};
const pending = new Set(), failed = new Set(); // road lines being fetched, or that Google couldn't route this session

async function loadMap() {
    let key;
    try { key = (await api('/map-key')).key; }
    catch (e) { toast(e.message === 'limit' ? 'The map is paused for today. The itinerary still works.' : 'Couldn’t load the map. Check your connection.'); return; }
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
        drawDay(true);
    } catch (e) {
        toast('Couldn’t load the map. Check your connection.');
    }
}

function padding() {
    const wide = matchMedia('(min-width: 768px)').matches;
    if (wide) return { top: 40, right: 80, bottom: 40, left: 420 };
    return { top: (snaps.full || 0) + 60, right: 64, bottom: Math.max(120, H - snaps.half) + 24, left: 40 };
}

function fitTo(points) {
    if (!map || !points.length) return;
    const b = new google.maps.LatLngBounds();
    points.forEach(p => b.extend(p));
    if (points.length === 1) { map.setCenter(points[0]); map.setZoom(15); return; }
    map.fitBounds(b, padding());
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
    if (from === 'map') {
        if (!wide() && state === 'peek') springTo('half');
        if (row) row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    if (map) {
        map.panTo(ll(s));
        if (map.getZoom() < 14) map.setZoom(15);
        if (!wide()) {
            if (state === 'full') springTo('half');
            map.panBy(0, Math.round((H - snaps.half) / 2));
        } else {
            map.panBy(-200, 0);
        }
    }
}

// City jump menu
function openCities(open) {
    $('cities').classList.toggle('open', open);
    $('actionDim').classList.toggle('open', open);
}
$('citiesBtn').addEventListener('click', () => openCities(true));
$('citiesCancel').addEventListener('click', () => openCities(false));
$('actionDim').addEventListener('click', () => openCities(false));
document.querySelectorAll('[data-city]').forEach(b => b.addEventListener('click', () => {
    openCities(false);
    const [[s, w], [n, e]] = AREAS[b.dataset.city];
    fitTo([{ lat: s, lng: w }, { lat: n, lng: e }]);
}));

// ---------- Bottom sheet (phone) ----------
let H = 0, snaps = {}, state = 'half', y = 0, anim = 0;
const ORDER = ['full', 'half', 'peek'];
const wide = () => matchMedia('(min-width: 768px)').matches;

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
    if (wide()) { sheet.style.transform = ''; fabs.style.opacity = 1; fabs.style.pointerEvents = 'auto'; return; }
    sheet.style.transform = 'translate3d(0,' + v + 'px,0)';
    const p = Math.min(1, Math.max(0, (snaps.half - v) / (snaps.half - snaps.full)));
    dim.style.opacity = (p * 0.12).toFixed(3);
    dim.style.pointerEvents = p > 0.5 ? 'auto' : 'none';
    const fabBottom = fabs.offsetTop + fabs.offsetHeight + 12;
    const f = Math.min(1, Math.max(0, (v - fabBottom) / 40));
    fabs.style.opacity = f;
    fabs.style.pointerEvents = f > 0.5 ? 'auto' : 'none';
}

function springTo(name, v0 = 0) {
    cancelAnimationFrame(anim);
    setState(name);
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

// Android Back lowers the sheet instead of leaving the app.
// Chrome ignores history entries added before the first touch, so wait for one.
let pushed = false, skipPop = false, touched = false;
function setState(name) {
    state = name;
    if (!touched || wide()) return;
    try {
        if (name !== 'peek' && !pushed) { history.pushState({ sheet: 1 }, ''); pushed = true; }
        else if (name === 'peek' && pushed) { pushed = false; skipPop = true; history.back(); }
    } catch (e) { }
}
addEventListener('popstate', () => {
    if (skipPop) { skipPop = false; return; }
    pushed = false;
    if ($('cities').classList.contains('open')) { openCities(false); return; }
    if (state !== 'peek') springTo('peek');
});

function release(v) {
    const projected = y + v * 200;
    let target = ORDER.reduce((a, b) => Math.abs(snaps[b] - projected) < Math.abs(snaps[a] - projected) ? b : a);
    if (v < -0.3 && snaps[target] > y) target = ORDER.slice().reverse().find(k => snaps[k] < y - 1) || 'full';
    if (v > 0.3 && snaps[target] < y) target = ORDER.find(k => snaps[k] > y + 1) || 'peek';
    springTo(target, v * 1000);
}

let g = null, lastTouch = 0;
function down(x, fy, t, target) {
    touched = true;
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