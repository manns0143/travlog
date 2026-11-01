// Travlog: keeps the field you're typing in on screen when the phone keyboard opens.
const root = document.documentElement, vv = window.visualViewport;
const isField = el => !!el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && el.type !== 'button'));
let typing = false, endTimer = 0;

// Where the visible part of the page starts, once the phone has nudged it up for the keyboard
function place() { if (vv) root.style.setProperty('--vvtop', vv.offsetTop + 'px'); }
if (vv) { vv.addEventListener('resize', place); vv.addEventListener('scroll', place); }
place();

document.addEventListener('focusin', e => {
    const el = e.target;
    if (!isField(el) || el.closest('#welcome')) return;
    clearTimeout(endTimer);
    typing = true;
    document.body.classList.add('typing');
    // In the full-screen panels, scroll the field to the middle of what's still visible
    const box = el.closest('.panel-body');
    if (box) setTimeout(() => { if (document.activeElement === el) el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 350);
});

document.addEventListener('focusout', () => {
    clearTimeout(endTimer);
    endTimer = setTimeout(() => {
        if (isField(document.activeElement)) return; // moved to another field
        typing = false;
        document.body.classList.remove('typing');
        dispatchEvent(new Event('resize')); // keyboard gone: let the sheet re-measure the full screen
    }, 250);
});

// While the keyboard is up the screen "shrinks"; stop the sheet jumping to fit it.
// This runs before the sheet's own listener because this file loads first.
addEventListener('resize', e => { if (typing) e.stopImmediatePropagation(); });