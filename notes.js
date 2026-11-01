// Travlog: shared checklists ("Food to try", "Things to buy"). Anyone can add and tick items;
// only the person who made a note can delete the whole note.
import { getApp } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js';
import { getDatabase, ref, onValue, set, update, remove, push, serverTimestamp } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-database.js';
import { DB_URL } from './config.js';

const db = getDatabase(getApp(), DB_URL), auth = getAuth(getApp());
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const TICK = '<svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';
const panel = $('notePanel'), body = $('noteBody');
const myName = () => localStorage.getItem('travlog.name') || 'Someone';

let notes = {}, openId = null, subscribed = false;
const saved = () => { try { return JSON.parse(localStorage.getItem('travlog.notes')) || {}; } catch (e) { return {}; } };

// Start listening once the trip has opened (the database only answers people who have joined)
function subscribe() {
    if (subscribed || !document.body.classList.contains('ready')) return;
    subscribed = true;
    notes = saved();
    renderEntry();
    onValue(ref(db, 'notes'), s => {
        notes = s.val() || {};
        try { localStorage.setItem('travlog.notes', JSON.stringify(notes)); } catch (e) { }
        renderEntry();
        if (openId) { if (notes[openId]) renderNote(); else close(false); }
    }, () => { subscribed = false; });
}
new MutationObserver(subscribe).observe(document.body, { attributes: true, attributeFilter: ['class'] });
subscribe();

const items = n => Object.entries((n && n.items) || {}).map(([id, it]) => ({ id, ...it })).sort((a, b) => (a.at || 0) - (b.at || 0));

// ---------- Notes list, under the itinerary ----------
function renderEntry() {
    const list = Object.entries(notes).sort((a, b) => (a[1].at || 0) - (b[1].at || 0));
    $('notesEntry').innerHTML = '<p class="section" style="margin-top:22px">Notes</p><ul class="list">' +
        list.map(([id, n]) => {
            const its = items(n), done = its.filter(i => i.done).length;
            return '<li class="row tap" data-note="' + esc(id) + '"><div class="txt"><div class="name">' + esc(n.title || 'Untitled') + '</div>' +
                '<div class="meta">' + (its.length ? done + ' of ' + its.length + ' done' : 'Empty') + ' · ' + esc(n.byName) + '</div></div></li>';
        }).join('') +
        '<li class="row tap" id="newNote"><div class="txt"><div class="name" style="color:var(--blue)">+ New note</div></div></li></ul>';
}

$('notesEntry').addEventListener('click', async e => {
    if (e.target.closest('#newNote')) {
        const r = push(ref(db, 'notes'));
        try {
            await set(r, { title: 'New note', by: auth.currentUser.uid, byName: myName(), at: serverTimestamp() });
            openNote(r.key, true);
        } catch (x) { alert('Couldn’t create the note. Check your connection.'); }
        return;
    }
    const row = e.target.closest('[data-note]');
    if (row) openNote(row.dataset.note);
});

// ---------- One note ----------
let pushedHere = false, skipPop = false;
function openNote(id, fresh) {
    openId = id;
    renderNote();
    panel.classList.add('open');
    try { history.pushState({ travlog: 'note' }, ''); pushedHere = true; } catch (e) { }
    if (fresh) { const t = $('noteTitle'); t.focus(); t.select(); }
}
function close(fromBack) {
    panel.classList.remove('open');
    document.activeElement && document.activeElement.blur && document.activeElement.blur();
    openId = null;
    if (!fromBack && pushedHere) { pushedHere = false; skipPop = true; history.back(); }
}
addEventListener('popstate', e => {
    if (skipPop) { skipPop = false; e.stopImmediatePropagation(); return; }
    if (!panel.classList.contains('open')) return;
    e.stopImmediatePropagation();
    pushedHere = false;
    close(true);
}, { capture: true });
$('noteDone').addEventListener('click', () => { saveTitle(); close(false); });

function saveTitle() {
    const t = $('noteTitle'), n = openId && notes[openId];
    if (!t || !n) return;
    const title = t.value.trim().slice(0, 60) || 'Untitled';
    if (title !== n.title) update(ref(db, 'notes/' + openId), { title }).catch(() => { });
}

function renderNote() {
    const n = notes[openId];
    if (!n) return;
    // Keep what's being typed if someone else changes the note meanwhile
    const typing = document.activeElement && body.contains(document.activeElement) ? document.activeElement.id : null;
    const draft = $('newItem') ? $('newItem').value : '';
    const title = typing === 'noteTitle' ? $('noteTitle').value : n.title;
    const mine = auth.currentUser && n.by === auth.currentUser.uid;
    body.innerHTML =
        '<input class="note-title" id="noteTitle" maxlength="60" value="' + esc(title) + '" placeholder="Title">' +
        '<ul class="list">' + items(n).map(it =>
            '<li class="row item' + (it.done ? ' done' : '') + '" data-item="' + esc(it.id) + '">' +
            '<button class="check' + (it.done ? ' on' : '') + '" data-act="tick" aria-label="Done">' + TICK + '</button>' +
            '<div class="txt"><div class="name">' + esc(it.text) + '</div><div class="meta">' + esc(it.byName) + '</div></div>' +
            '<button class="x" data-act="del" aria-label="Remove">×</button></li>').join('') +
        '<li class="row add-item"><span class="check"></span><input id="newItem" maxlength="200" placeholder="Add an item" enterkeyhint="done" autocomplete="off"></li></ul>' +
        '<p class="foot">Made by ' + esc(mine ? 'you' : n.byName) + '. Everyone can add and tick items.</p>' +
        (mine ? '<button class="danger-link" id="deleteNote">Delete note</button>' : '');
    $('newItem').value = draft;
    if (typing && $(typing)) $(typing).focus();

    $('noteTitle').addEventListener('change', saveTitle);
    $('newItem').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } });
    if (mine) $('deleteNote').addEventListener('click', deleteNote);
}

function addItem() {
    const input = $('newItem'), text = input.value.trim().slice(0, 200);
    if (!text) return;
    input.value = '';
    set(push(ref(db, 'notes/' + openId + '/items')), { text, by: auth.currentUser.uid, byName: myName(), done: false, at: serverTimestamp() })
        .catch(() => alert('Couldn’t add that. Check your connection.'));
}

body.addEventListener('click', e => {
    const a = e.target.closest('[data-act]'), row = e.target.closest('[data-item]');
    if (!a || !row || !openId) return;
    const it = (notes[openId].items || {})[row.dataset.item];
    if (!it) return;
    const p = 'notes/' + openId + '/items/' + row.dataset.item;
    if (a.dataset.act === 'tick') update(ref(db, p), { done: !it.done }).catch(() => { });
    else remove(ref(db, p)).catch(() => { });
});

let deleteArmed = 0;
async function deleteNote() {
    const btn = $('deleteNote');
    if (Date.now() - deleteArmed > 3000) {
        deleteArmed = Date.now();
        btn.textContent = 'Tap again to delete';
        setTimeout(() => { if (btn.isConnected) btn.textContent = 'Delete note'; }, 3000);
        return;
    }
    const id = openId;
    close(false);
    remove(ref(db, 'notes/' + id)).catch(() => alert('Couldn’t delete. Check your connection.'));
}