// Travlog: photos, rating, opening hours and reviews for a place, shown inside its card.
// Nothing loads until someone taps "Photos, reviews and hours", because these use a small free allowance.
import { getApp } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js';
import { getDatabase, ref, update } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-database.js';
import { DB_URL } from './config.js';

const API = 'https://travlog-api.mannmshah143.workers.dev';
const db = getDatabase(getApp(), DB_URL), auth = getAuth(getApp());
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Kept only while the app is open, so looking at the same place twice doesn't use the allowance twice
const infoCache = {}, photoCache = {};

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

const problem = e => e.message === 'limit' ? 'Photos and reviews are paused for now' : e.message === 'none' ? 'Couldn’t find this place on Google' : 'Couldn’t load. Tap to try again';

// Itinerary stops from the PDF have no Google place ID yet: find it once by name, and save it on the stop
async function findId(name, lat, lng, path) {
    const near = isFinite(lat) && isFinite(lng) ? { lat, lng } : undefined;
    const r = await api('/autocomplete', { input: name, near });
    const id = r.places && r.places[0] && r.places[0].id;
    if (id && path) update(ref(db, path), { placeId: id }).catch(() => { });
    return id;
}

document.addEventListener('click', async e => {
    const b = e.target.closest('[data-info]');
    if (!b || b.disabled) return;
    const box = b.nextElementSibling;
    if (!box || !box.classList.contains('info')) return;
    b.disabled = true;
    b.textContent = 'Loading…';
    try {
        let id = b.dataset.info;
        if (!id) id = await findId(b.dataset.name, parseFloat(b.dataset.lat), parseFloat(b.dataset.lng), b.dataset.path);
        if (!id) throw new Error('none');
        const d = infoCache[id] || (infoCache[id] = await api('/details', { id }));
        b.remove();
        render(box, d);
    } catch (err) {
        b.disabled = false;
        b.textContent = problem(err);
    }
});

function stars(r) {
    return '<span class="stars"><span style="width:' + Math.round((r / 5) * 100) + '%">★★★★★</span>★★★★★</span>';
}

function render(box, d) {
    const today = (new Date(Date.now() + 7 * 3600e3).getUTCDay() + 6) % 7; // Google lists Monday first; Vietnam time
    const status = d.openNow === true ? '<span class="open">Open now</span>' : d.openNow === false ? '<span class="closed">Closed now</span>' : '';
    box.innerHTML =
        (d.photos.length ? '<div class="ph-strip">' + d.photos.map(p =>
            '<button class="ph" data-photo="' + esc(p.name) + '">' +
            (p.by.length ? '<span class="ph-by">' + esc(p.by[0].name) + '</span>' : '') + '</button>').join('') + '</div>' : '') +
        (d.rating ? '<div class="rate"><b>' + d.rating.toFixed(1) + '</b>' + stars(d.rating) +
            '<span class="meta">(' + d.count.toLocaleString('en') + ')' + (status ? ' · ' : '') + '</span>' + status + '</div>' :
            (status ? '<div class="rate">' + status + '</div>' : '')) +
        (d.hours.length ? '<details class="hours"><summary>' + esc(d.hours[today] || d.hours[0]) + '</summary>' +
            d.hours.map((h, i) => '<p' + (i === today ? ' class="today"' : '') + '>' + esc(h) + '</p>').join('') + '</details>' : '') +
        (d.reviews.length ? '<div class="reviews">' + d.reviews.map(r =>
            '<div class="rev"><div class="rev-head"><b>' + esc(r.author) + '</b>' + stars(r.rating) + '<span class="meta">' + esc(r.when) + '</span></div>' +
            '<p class="rev-text">' + esc(r.text) + '</p></div>').join('') + '</div>' : '') +
        '<p class="attr">From Google Maps' + (d.mapsUri ? ' · <a href="' + esc(d.mapsUri) + '" target="_blank" rel="noopener">See all on Google Maps ›</a>' : '') + '</p>';
    box.querySelectorAll('.rev-text').forEach(t => t.addEventListener('click', () => t.classList.toggle('full')));
    lazyPhotos(box.querySelector('.ph-strip'));
}

// Photos load only when they scroll into view in the strip
function lazyPhotos(strip) {
    if (!strip) return;
    const io = new IntersectionObserver(entries => entries.forEach(en => {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        loadPhoto(en.target);
    }), { root: strip, rootMargin: '0px 40px' });
    strip.querySelectorAll('.ph').forEach(el => {
        io.observe(el);
        el.addEventListener('click', () => { if (el.dataset.uri) view(el.dataset.uri, el.querySelector('.ph-by')); else if (el.dataset.failed) loadPhoto(el); });
    });
}

async function loadPhoto(el) {
    const name = el.dataset.photo;
    delete el.dataset.failed;
    el.classList.remove('err');
    try {
        const uri = photoCache[name] || (photoCache[name] = (await api('/photo', { name })).uri);
        if (!uri) throw new Error('none');
        el.dataset.uri = uri;
        el.style.backgroundImage = 'url("' + uri.replace(/"/g, '%22') + '")';
        el.classList.add('loaded');
    } catch (e) {
        el.dataset.failed = '1';
        el.classList.add('err');
        el.setAttribute('aria-label', e.message === 'limit' ? 'Photos paused' : 'Tap to retry');
    }
}

// Full-screen photo; tap anywhere to close
let viewer = null;
function view(uri, by) {
    if (!viewer) {
        viewer = document.createElement('div');
        viewer.className = 'ph-view';
        viewer.addEventListener('click', () => viewer.classList.remove('open'));
        document.body.appendChild(viewer);
    }
    viewer.innerHTML = '<img src="' + esc(uri) + '" alt="">' + (by ? '<span class="ph-by">' + esc(by.textContent) + '</span>' : '');
    viewer.classList.add('open');
}