// Travlog: keeps an offline copy of the app and offers "add to home screen".
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => { });

const $ = id => document.getElementById(id);
const bar = $('install'), guide = $('installGuide');
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
const android = /Android/.test(navigator.userAgent);
let prompt = null, offered = false;

const STEPS = ios ? [
    'Tap the <b>Share</b> button next to Chrome’s address bar.',
    'Tap <b>Add to Home Screen</b>, then <b>Add</b>.',
    'Open Travlog from your home screen and join once more with the passcode.',
] : [
    'Tap <b>⋮</b> at the top right of Chrome.',
    'Tap <b>Install app</b> or <b>Add to home screen</b>.',
    'Open Travlog from your home screen.',
];

addEventListener('beforeinstallprompt', e => { e.preventDefault(); prompt = e; offer(); });
addEventListener('appinstalled', () => { prompt = null; bar.classList.remove('show'); });

// Offer it once the trip has opened, unless it's already installed or was dismissed
function offer() {
    if (standalone() || localStorage.getItem('travlog.noInstall')) return;
    if (!document.body.classList.contains('ready')) return;
    if (!prompt && !ios && !android) return;
    if (offered && !prompt) return;
    offered = true;
    $('installBtn').textContent = prompt ? 'Install' : 'How';
    bar.classList.add('show');
}
new MutationObserver(() => setTimeout(offer, 1500)).observe(document.body, { attributes: true, attributeFilter: ['class'] });

$('installBtn').addEventListener('click', async () => {
    if (prompt) {
        prompt.prompt();
        const { outcome } = await prompt.userChoice;
        prompt = null;
        if (outcome === 'accepted') bar.classList.remove('show');
        else $('installBtn').textContent = 'How';
        return;
    }
    $('guideSteps').innerHTML = STEPS.map((s, i) => '<li><span class="badge">' + (i + 1) + '</span><div class="txt">' + s + '</div></li>').join('');
    guide.classList.add('open');
});
$('installX').addEventListener('click', () => { localStorage.setItem('travlog.noInstall', '1'); bar.classList.remove('show'); });
$('guideDone').addEventListener('click', () => guide.classList.remove('open'));