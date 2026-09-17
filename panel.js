const port = chrome.runtime.connect({ name: 'jzb-panel' });

const requestListEl = document.getElementById('request-list');
const emptyStateEl = document.getElementById('empty-state');
const detailEmptyEl = document.getElementById('detail-empty');
const detailContentEl = document.getElementById('detail-content');
const detailMetaEl = document.getElementById('detail-meta');
const detailJsonEl = document.getElementById('detail-json');
const pastePanelEl = document.getElementById('paste-panel');
const pasteErrorEl = document.getElementById('paste-error');
const curlInputEl = document.getElementById('curl-input');
const searchInputEl = document.getElementById('search');
const copyJsonButtonEl = document.getElementById('copy-json');
const copyStatusEl = document.getElementById('copy-status');

const requests = new Map();
let selectedId = null;
let searchQuery = '';
let copyStatusTimeout = null;

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
        renderDetail();
        return;
    }

    if (message.type === 'decode-error') {
        pasteErrorEl.textContent = message.error;
        pasteErrorEl.classList.remove('hidden');
    }
});

document.getElementById('clear').addEventListener('click', () => {
    port.postMessage({ type: 'clear' });
});

document.getElementById('paste-toggle').addEventListener('click', () => {
    pastePanelEl.classList.toggle('hidden');
});

document.getElementById('decode-curl').addEventListener('click', () => {
    pasteErrorEl.classList.add('hidden');
    port.postMessage({
        type: 'decode-curl',
        curl: curlInputEl.value
    });
});

searchInputEl.addEventListener('input', () => {
    searchQuery = searchInputEl.value.trim().toLowerCase();
    renderList();
});

copyJsonButtonEl.addEventListener('click', async () => {
    const item = selectedId ? requests.get(selectedId) : null;

    if (!item || item.error || !item.payload) {
        return;
    }

    const text = JSON.stringify(item.payload, null, 2);

    try {
        await navigator.clipboard.writeText(text);
        showCopyStatus('Copied');
    } catch {
        showCopyStatus('Copy failed');
    }
});

function addRequest (item) {
    requests.set(item.id, item);
}

function getFilteredRequests () {
    if (!searchQuery) {
        return [...requests.values()];
    }

    return [...requests.values()].filter((item) => matchesSearch(item, searchQuery));
}

function matchesSearch (item, query) {
    const haystack = [
        item.label,
        item.method,
        item.requestUrl,
        item.error,
        ...(item.summary || []).flatMap((summary) => [
            summary.type,
            summary.trackEventName,
            summary.visitorId,
            summary.accountId,
            summary.url
        ])
    ].filter(Boolean).join(' ').toLowerCase();

    return haystack.includes(query);
}

function renderList () {
    requestListEl.querySelectorAll('.request-item').forEach((node) => node.remove());
    requestListEl.querySelectorAll('.filter-empty').forEach((node) => node.remove());

    const filteredRequests = getFilteredRequests();

    if (!requests.size) {
        emptyStateEl.classList.remove('hidden');
        emptyStateEl.innerHTML = 'Listening for network requests with <code>jzb=</code> in the URL.';
        return;
    }

    emptyStateEl.classList.add('hidden');

    if (!filteredRequests.length) {
        const message = document.createElement('div');
        message.className = 'filter-empty';
        message.textContent = `No requests match "${searchQuery}".`;
        requestListEl.appendChild(message);
        return;
    }

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
            : `${item.method} · ${formatTime(item.capturedAt)} · ${truncate(item.requestUrl, 80)}`;

        button.append(label, subtitle);
        button.addEventListener('click', () => selectRequest(item.id));
        requestListEl.appendChild(button);
    });
}

function selectRequest (id) {
    selectedId = id;
    renderList();
    renderDetail();
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

function truncate (value, max) {
    if (!value || value.length <= max) return value || '';

    return `${value.slice(0, max - 1)}…`;
}
