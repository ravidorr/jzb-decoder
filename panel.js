const port = chrome.runtime.connect({ name: 'jzb-panel' });
let portConnected = true;

function normalizeThemeName (theme) {
    const raw = typeof theme === 'string'
        ? theme
        : theme?.themeName ?? chrome.devtools.panels.themeName ?? 'default';

    if (raw === 'dark') {
        return 'dark';
    }

    return 'default';
}

function applyDevToolsTheme (theme) {
    document.documentElement.dataset.theme = normalizeThemeName(theme);
}

function registerThemeChangeHandler () {
    const panels = chrome.devtools.panels;

    if (typeof panels.setThemeChangeHandler === 'function') {
        panels.setThemeChangeHandler(applyDevToolsTheme);
        return;
    }

    panels.onThemeChanged?.addListener?.(applyDevToolsTheme);
}

applyDevToolsTheme();
registerThemeChangeHandler();

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
const HIGHLIGHTED_META_LABELS = new Set([ 'Track event', 'Visitor', 'Account', 'Event type' ]);
let selectedId = null;
let renderedDetailId = null;
let searchQuery = '';
let copyStatusTimeout = null;

initLayoutResizer();

port.onDisconnect.addListener(() => {
    portConnected = false;
    showConnectionLostMessage();
});

port.onMessage.addListener((message) => {
    if (!message || typeof message !== 'object' || typeof message.type !== 'string') {
        return;
    }

    if (message.type === 'init') {
        if (!Array.isArray(message.requests)) {
            return;
        }

        message.requests.filter(JzbDecoder.isCapturedItem).forEach(addRequest);
        renderList();
        return;
    }

    if (message.type === 'request') {
        if (!JzbDecoder.isCapturedItem(message.item)) {
            return;
        }

        addRequest(message.item);
        selectedId = message.item.id;
        renderList({ syncSelection: false });
        return;
    }

    if (message.type === 'cleared') {
        requests.clear();
        selectedId = null;
        hidePasteError();
        hidePasteHint();
        renderList();
        return;
    }

    if (message.type === 'decode-error' && typeof message.error === 'string') {
        showPasteError(message.error);
    }

});

document.getElementById('clear-requests').addEventListener('click', () => {
    postToDevtools({ type: 'clear' });
});

pasteToggleEl.addEventListener('click', () => {
    const isHidden = pastePanelEl.classList.toggle('hidden');
    pasteToggleEl.setAttribute('aria-expanded', String(!isHidden));

    if (isHidden) {
        return;
    }

    hidePasteHint();
    hidePasteError();
    curlInputEl.focus();

    if (!tryPasteIntoTextarea(curlInputEl)) {
        showPasteHint('Clipboard paste unavailable. Paste manually with ⌘V / Ctrl+V.');
    }
});

document.getElementById('decode-curl').addEventListener('click', () => {
    hidePasteHint();

    if (JzbDecoder.isCurlTextTooLarge(curlInputEl.value)) {
        showPasteError(JzbDecoder.getCurlTextTooLargeError());
        return;
    }

    hidePasteError();
    postToDevtools({
        type: 'decode-curl',
        curl: curlInputEl.value
    });
});

document.getElementById('clear-curl').addEventListener('click', () => {
    curlInputEl.value = '';
    hidePasteHint();
    hidePasteError();
    curlInputEl.focus();
});

searchInputEl.addEventListener('input', () => {
    searchQuery = searchInputEl.value.trim();
    renderList({ updateDetail: false });
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
    showPasteError('Connection lost. Close and reopen the Decipher JZB panel.');
}

function setElementMessage (element, message) {
    element.textContent = message || '';

    if (message) {
        element.classList.remove('hidden');
    } else {
        element.classList.add('hidden');
    }
}

function showPasteError (message) {
    setElementMessage(pasteErrorEl, message);
}

function hidePasteError () {
    setElementMessage(pasteErrorEl, '');
}

function showPasteHint (message) {
    setElementMessage(pasteHintEl, message);
}

function hidePasteHint () {
    setElementMessage(pasteHintEl, '');
}

function addRequest (item) {
    requests.set(item.id, item);
    trimRequests();
}

function trimRequests () {
    JzbDecoder.trimCapturedRequestMap(requests);

    if (selectedId && !requests.has(selectedId)) {
        selectedId = null;
    }
}

function getFilteredRequests () {
    return [ ...requests.values() ]
        .sort((left, right) => right.capturedAt - left.capturedAt)
        .filter((item) => JzbDecoder.matchesCapturedRequestSearch(item, searchQuery));
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

function shouldUpdateDetail (updateDetail, previousSelectedId) {
    return updateDetail || selectedId !== previousSelectedId || selectedId !== renderedDetailId;
}

function createRequestItemButton (item) {
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
        : `${item.method} · ${JzbDecoder.formatTimestamp(item.capturedAt, { timeOnly: true })} · ${item.requestUrl}`;

    button.append(label, subtitle);
    button.addEventListener('click', () => selectRequest(item.id));

    return button;
}

function renderList ({ updateDetail = true, syncSelection = true } = {}) {
    const previousSelectedId = selectedId;

    requestListEl.querySelectorAll('.request-item, .filter-empty').forEach((node) => node.remove());

    const filteredRequests = getFilteredRequests();

    if (!requests.size) {
        emptyStateEl.classList.remove('hidden');
    } else {
        emptyStateEl.classList.add('hidden');

        if (!filteredRequests.length) {
            if (syncSelection) {
                syncSelectionToFilter(filteredRequests);
            }

            const message = document.createElement('div');
            message.className = 'filter-empty';
            message.textContent = `No requests match "${searchQuery}".`;
            requestListEl.appendChild(message);
        } else {
            if (syncSelection) {
                syncSelectionToFilter(filteredRequests);
            }

            filteredRequests.forEach((item) => {
                requestListEl.appendChild(createRequestItemButton(item));
            });
        }
    }

    if (shouldUpdateDetail(updateDetail, previousSelectedId)) {
        renderDetail();
    }
}

function selectRequest (id) {
    if (selectedId === id) {
        return;
    }

    const previousButton = selectedId
        ? requestListEl.querySelector(`.request-item[data-id="${selectedId}"]`)
        : null;
    const nextButton = requestListEl.querySelector(`.request-item[data-id="${id}"]`);

    previousButton?.classList.remove('selected');
    nextButton?.classList.add('selected');
    selectedId = id;
    renderDetail();
}

function renderDetail () {
    const item = selectedId ? requests.get(selectedId) : null;
    hideCopyStatus();
    renderedDetailId = item?.id ?? null;

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
        [ 'Captured', JzbDecoder.formatTimestamp(item.capturedAt) ],
        [ 'Event type', summary.type || '—' ],
        [ 'Track event', summary.trackEventName || '—' ],
        [ 'Visitor', summary.visitorId || '—' ],
        [ 'Account', summary.accountId || '—' ],
        [ 'Browser time', JzbDecoder.formatTimestamp(summary.browserTime) || '—' ],
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
        valueEl.className = `meta-value${HIGHLIGHTED_META_LABELS.has(label) ? ' meta-value-highlight' : ''}`;
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

function getLayoutEl () {
    return document.querySelector('.layout');
}

function getSidebarWidth () {
    const layout = getLayoutEl();
    const width = layout ? Number.parseInt(getComputedStyle(layout).getPropertyValue('--sidebar-width'), 10) : NaN;

    return Number.isFinite(width) ? width : DEFAULT_SIDEBAR_WIDTH;
}

function getMaxSidebarWidth () {
    return Math.floor(window.innerWidth * MAX_SIDEBAR_WIDTH_RATIO);
}

function setSidebarWidth (width) {
    const maxWidth = getMaxSidebarWidth();
    const clamped = Math.max(MIN_SIDEBAR_WIDTH, Math.min(width, maxWidth));
    const layout = getLayoutEl();

    if (!layout) {
        return clamped;
    }

    layout.style.setProperty('--sidebar-width', `${clamped}px`);
    layoutResizerEl.setAttribute('aria-valuenow', String(clamped));
    layoutResizerEl.setAttribute('aria-valuemax', String(maxWidth));

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
