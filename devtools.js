const capturedRequests = [];
let panelPort = null;

chrome.devtools.panels.create('Decipher JZB', '', 'panel.html', () => {});

function safePostMessage (port, message) {
    if (!port) {
        return false;
    }

    try {
        port.postMessage(message);
        return true;
    } catch (error) {
        console.error('Failed to notify panel:', error);
        return false;
    }
}

function trimCapturedRequests () {
    if (capturedRequests.length > JzbDecoder.MAX_CAPTURED_REQUESTS) {
        capturedRequests.length = JzbDecoder.MAX_CAPTURED_REQUESTS;
    }
}

function addCapturedItem (item) {
    capturedRequests.unshift(item);
    trimCapturedRequests();
    safePostMessage(panelPort, { type: 'request', item });
}

function buildDecodeErrorItem (request, error) {
    return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        capturedAt: Date.now(),
        requestUrl: request.request.url,
        method: request.request.method,
        error: error.message || String(error),
        payload: null,
        summary: [],
        label: 'Decode failed'
    };
}

chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== 'jzb-panel') return;

    panelPort = port;
    safePostMessage(port, {
        type: 'init',
        requests: capturedRequests
    });

    port.onMessage.addListener(async (message) => {
        if (message.type === 'clear') {
            capturedRequests.length = 0;
            safePostMessage(port, { type: 'cleared' });
            return;
        }

        if (message.type === 'decode-curl') {
            const jzb = JzbDecoder.extractJzbFromCurl(message.curl);

            if (!jzb) {
                safePostMessage(port, {
                    type: 'decode-error',
                    error: 'No jzb= parameter found in the pasted curl.'
                });
                return;
            }

            try {
                const payload = await JzbDecoder.decodeJzb(jzb);
                const urls = JzbDecoder.extractUrlsFromCurl(message.curl);
                const requestUrl = urls[0] || '(pasted curl)';
                const item = JzbDecoder.buildCapturedItem({
                    requestUrl,
                    method: 'PASTE',
                    payload,
                    jzb
                });

                addCapturedItem(item);
            } catch (error) {
                safePostMessage(port, {
                    type: 'decode-error',
                    error: error.message || String(error)
                });
            }
        }
    });

    port.onDisconnect.addListener(() => {
        if (panelPort === port) {
            panelPort = null;
        }
    });
});

chrome.devtools.network.onRequestFinished.addListener(async (request) => {
    const jzb = JzbDecoder.extractJzbFromUrl(request.request.url);

    if (!jzb) return;

    let item;

    try {
        const payload = await JzbDecoder.decodeJzb(jzb);
        item = JzbDecoder.buildCapturedItem({
            requestUrl: request.request.url,
            method: request.request.method,
            payload,
            jzb
        });
    } catch (error) {
        item = buildDecodeErrorItem(request, error);
    }

    addCapturedItem(item);
});
