const port = chrome.runtime.connect({ name: 'jzb-panel' });
let portConnected = true;

function applyDevToolsTheme (theme) {
    const themeName = theme || chrome.devtools.panels.themeName || 'default';
    document.documentElement.dataset.theme = themeName;
}

applyDevToolsTheme();
chrome.devtools.panels.setThemeChangeHandler(applyDevToolsTheme);

const requestListEl = document.getElementById('request-list');
const emptyStateEl = document.getElementById('empty-state');
const detailEmptyEl = document.getElementById('detail-empty');
const detailContentEl = document.getElementById('detail-content');
const detailMetaEl = document.getElementById('detail-meta');
const detailJsonEl = document.getElementById('detail-json');
const pastePanelEl = document.getElementById('paste-panel');
const pasteToggleEl = document.getElementById('paste-toggle');
const pasteErrorEl = document.getElementById('paste-error');
const pasteHintEl = document.getElementById('paste-hint');
const curlInputEl = document.getElementById('curl-input');
const searchInputEl = document.getElementById('search');
const copyJsonButtonEl = document.getElementById('copy-json');
const copyStatusEl = document.getElementById('copy-status');
const layoutResizerEl = document.getElementById('layout-resizer');

const SIDEBAR_WIDTH_KEY = 'jzb-decoder-sidebar-width';
const MIN_SIDEBAR_WIDTH = 200;
const MAX_SIDEBAR_WIDTH_RATIO = 0.7;
const DEFAULT_SIDEBAR_WIDTH = 280;

const requests = new Map();
let selectedId = null;
let searchQuery = '';
let copyStatusTimeout = null;

initLayoutResizer();

port.onDisconnect.addListener(() => {
    portConnected = false;
    showConnectionLostMessage();
});

port.onMessage.addListener((message) => {
    if (message.type === 'init') {
        message.requests.forEach(addRequest);
        renderList();
        return;
    }

    if (message.type === 'request') {
        addRequest(message.item);
        renderList();
        selectRequest(message.item.id);
        return;
    }

    if (message.type === 'cleared') {
        requests.clear();
        selectedId = null;
        renderList();
        return;
    }

    if (message.type === 'decode-error') {
        pasteErrorEl.textContent = message.error;
        pasteErrorEl.classList.remove('hidden');
    }

});

document.getElementById('clear-requests').addEventListener('click', () => {
    postToDevtools({ type: 'clear' });
});

pasteToggleEl.addEventListener('click', () => {
    const wasHidden = pastePanelEl.classList.contains('hidden');
    const isHidden = pastePanelEl.classList.toggle('hidden');
    pasteToggleEl.setAttribute('aria-expanded', String(!isHidden));

    if (!wasHidden || isHidden) {
        return;
    }

    hidePasteHint();
    pasteErrorEl.textContent = '';
    pasteErrorEl.classList.add('hidden');
    curlInputEl.focus();

    if (!tryPasteIntoTextarea(curlInputEl)) {
        showPasteHint('Clipboard paste unavailable. Paste manually with ⌘V / Ctrl+V.');
    }
});

document.getElementById('decode-curl').addEventListener('click', () => {
    hidePasteHint();
    pasteErrorEl.classList.add('hidden');
    postToDevtools({
        type: 'decode-curl',
        curl: curlInputEl.value
    });
});

document.getElementById('clear-curl').addEventListener('click', () => {
    curlInputEl.value = '';
    hidePasteHint();
    pasteErrorEl.textContent = '';
    pasteErrorEl.classList.add('hidden');
    curlInputEl.focus();
});

searchInputEl.addEventListener('input', () => {
    searchQuery = searchInputEl.value.trim().toLowerCase();
    renderList();
});

copyJsonButtonEl.addEventListener('click', () => {
    const item = selectedId ? requests.get(selectedId) : null;

    if (!item || item.error || !item.payload) {
        return;
    }

    const text = JSON.stringify(item.payload, null, 2);

    if (copyTextToClipboard(text)) {
        showCopyStatus('Copied');
    } else {
        showCopyStatus('Copy failed');
    }
});

function tryPasteIntoTextarea (textarea) {
    const before = textarea.value;

    textarea.focus();

    if (!document.execCommand('paste')) {
        return false;
    }

    return textarea.value !== before || Boolean(textarea.value.trim());
}

function copyTextToClipboard (text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);

    return copied;
}

function postToDevtools (message) {
    if (!portConnected) {
        showConnectionLostMessage();
        return false;
    }

    try {
        port.postMessage(message);
        return true;
    } catch {
        portConnected = false;
        showConnectionLostMessage();
        return false;
    }
}

function showConnectionLostMessage () {
    pasteErrorEl.textContent = 'Connection lost. Close and reopen the Decipher JZB panel.';
    pasteErrorEl.classList.remove('hidden');
}

function showPasteHint (message) {
    pasteHintEl.textContent = message;
    pasteHintEl.classList.remove('hidden');
}

function hidePasteHint () {
    pasteHintEl.textContent = '';
    pasteHintEl.classList.add('hidden');
}

function addRequest (item) {
    requests.set(item.id, item);
    trimRequests();
}

function trimRequests () {
    if (requests.size <= JzbDecoder.MAX_CAPTURED_REQUESTS) {
        return;
    }

    const sorted = [ ...requests.values() ].sort((left, right) => right.capturedAt - left.capturedAt);
    const keepIds = new Set(
        sorted.slice(0, JzbDecoder.MAX_CAPTURED_REQUESTS).map((item) => item.id)
    );

    for (const id of requests.keys()) {
        if (!keepIds.has(id)) {
            requests.delete(id);
        }
    }

    if (selectedId && !requests.has(selectedId)) {
        selectedId = null;
    }
}

function getFilteredRequests () {
    return [ ...requests.values() ].filter((item) => (
        JzbDecoder.matchesCapturedRequestSearch(item, searchQuery)
    ));
}

function syncSelectionToFilter (filteredRequests) {
    if (!selectedId) {
        return;
    }

    if (filteredRequests.some((item) => item.id === selectedId)) {
        return;
    }

    selectedId = filteredRequests[0]?.id ?? null;
}

function renderList () {
    requestListEl.querySelectorAll('.request-item').forEach((node) => node.remove());
    requestListEl.querySelectorAll('.filter-empty').forEach((node) => node.remove());

    const filteredRequests = getFilteredRequests();

    if (!requests.size) {
        emptyStateEl.classList.remove('hidden');
        emptyStateEl.innerHTML = 'Listening for network requests with <code>jzb=</code> in the URL.';
        renderDetail();
        return;
    }

    emptyStateEl.classList.add('hidden');

    if (!filteredRequests.length) {
        syncSelectionToFilter(filteredRequests);
        const message = document.createElement('div');
        message.className = 'filter-empty';
        message.textContent = `No requests match "${searchQuery}".`;
        requestListEl.appendChild(message);
        renderDetail();
        return;
    }

    syncSelectionToFilter(filteredRequests);

    filteredRequests.forEach((item) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `request-item${item.error ? ' error' : ''}${item.id === selectedId ? ' selected' : ''}`;
        button.dataset.id = item.id;

        const label = document.createElement('div');
        label.className = 'request-label';
        label.textContent = item.label;

        const subtitle = document.createElement('div');
        subtitle.className = 'request-subtitle';
        subtitle.textContent = item.error
            ? item.error
            : `${item.method} · ${formatTime(item.capturedAt)} · ${item.requestUrl}`;

        button.append(label, subtitle);
        button.addEventListener('click', () => selectRequest(item.id));
        requestListEl.appendChild(button);
    });

    renderDetail();
}

function selectRequest (id) {
    selectedId = id;
    renderList();
}

function renderDetail () {
    const item = selectedId ? requests.get(selectedId) : null;
    hideCopyStatus();

    if (!item) {
        detailEmptyEl.classList.remove('hidden');
        detailContentEl.classList.add('hidden');
        return;
    }

    detailEmptyEl.classList.add('hidden');
    detailContentEl.classList.remove('hidden');
    detailMetaEl.innerHTML = '';

    const summary = item.summary[0] || {};
    const rows = [
        [ 'Label', item.label ],
        [ 'Method', item.method ],
        [ 'Captured', formatTime(item.capturedAt) ],
        [ 'Event type', summary.type || '—' ],
        [ 'Track event', summary.trackEventName || '—' ],
        [ 'Visitor', summary.visitorId || '—' ],
        [ 'Account', summary.accountId || '—' ],
        [ 'Browser time', summary.browserTime ? new Date(summary.browserTime).toLocaleString() : '—' ],
        [ 'Sequence', summary.sequence ?? '—' ],
        [ 'Request URL', item.requestUrl ]
    ];

    rows.forEach(([ label, value ]) => {
        const row = document.createElement('div');
        row.className = 'meta-row';

        const labelEl = document.createElement('div');
        labelEl.className = 'meta-label';
        labelEl.textContent = label;

        const valueEl = document.createElement('div');
        valueEl.className = `meta-value${isHighlightedMetaLabel(label) ? ' meta-value-highlight' : ''}`;
        valueEl.textContent = value ?? '—';

        row.append(labelEl, valueEl);
        detailMetaEl.appendChild(row);
    });

    copyJsonButtonEl.disabled = Boolean(item.error || !item.payload);

    if (item.error) {
        detailJsonEl.textContent = item.error;
        return;
    }

    detailJsonEl.innerHTML = JzbDecoder.highlightJson(item.payload);
}

function isHighlightedMetaLabel (label) {
    return [ 'Track event', 'Visitor', 'Account', 'Event type' ].includes(label);
}

function showCopyStatus (message) {
    copyStatusEl.textContent = message;
    copyStatusEl.classList.remove('hidden');

    if (copyStatusTimeout) {
        clearTimeout(copyStatusTimeout);
    }

    copyStatusTimeout = setTimeout(() => {
        hideCopyStatus();
    }, 1500);
}

function hideCopyStatus () {
    copyStatusEl.classList.add('hidden');

    if (copyStatusTimeout) {
        clearTimeout(copyStatusTimeout);
        copyStatusTimeout = null;
    }
}

function formatTime (timestamp) {
    return new Date(timestamp).toLocaleTimeString();
}

function getSidebarWidth () {
    const layout = document.querySelector('.layout');
    const width = layout ? Number.parseInt(getComputedStyle(layout).getPropertyValue('--sidebar-width'), 10) : NaN;

    return Number.isFinite(width) ? width : DEFAULT_SIDEBAR_WIDTH;
}

function getMaxSidebarWidth () {
    return Math.floor(window.innerWidth * MAX_SIDEBAR_WIDTH_RATIO);
}

function setSidebarWidth (width) {
    const clamped = Math.max(MIN_SIDEBAR_WIDTH, Math.min(width, getMaxSidebarWidth()));
    const layout = document.querySelector('.layout');

    if (!layout) {
        return clamped;
    }

    layout.style.setProperty('--sidebar-width', `${clamped}px`);
    layoutResizerEl.setAttribute('aria-valuenow', String(clamped));
    layoutResizerEl.setAttribute('aria-valuemax', String(getMaxSidebarWidth()));

    return clamped;
}

function initLayoutResizer () {
    const savedWidth = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY));

    if (Number.isFinite(savedWidth) && savedWidth > 0) {
        setSidebarWidth(savedWidth);
    } else {
        setSidebarWidth(DEFAULT_SIDEBAR_WIDTH);
    }

    let startX = 0;
    let startWidth = DEFAULT_SIDEBAR_WIDTH;

    function stopResize () {
        layoutResizerEl.classList.remove('is-dragging');
        document.body.classList.remove('is-resizing');
        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerup', stopResize);
        localStorage.setItem(SIDEBAR_WIDTH_KEY, String(getSidebarWidth()));
    }

    function onPointerMove (event) {
        setSidebarWidth(startWidth + (event.clientX - startX));
    }

    layoutResizerEl.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        startX = event.clientX;
        startWidth = getSidebarWidth();
        layoutResizerEl.classList.add('is-dragging');
        document.body.classList.add('is-resizing');
        document.addEventListener('pointermove', onPointerMove);
        document.addEventListener('pointerup', stopResize);
    });

    layoutResizerEl.addEventListener('keydown', (event) => {
        let nextWidth = getSidebarWidth();

        if (event.key === 'ArrowLeft') {
            nextWidth -= event.shiftKey ? 40 : 16;
        } else if (event.key === 'ArrowRight') {
            nextWidth += event.shiftKey ? 40 : 16;
        } else {
            return;
        }

        event.preventDefault();
        setSidebarWidth(nextWidth);
        localStorage.setItem(SIDEBAR_WIDTH_KEY, String(getSidebarWidth()));
    });

    window.addEventListener('resize', () => {
        setSidebarWidth(getSidebarWidth());
    });
}
