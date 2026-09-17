const capturedRequests = [];
let panelPort = null;

chrome.devtools.panels.create('Decipher JZB', '', 'panel.html', () => {});

chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== 'jzb-panel') return;

    panelPort = port;
    port.postMessage({
        type: 'init',
        requests: capturedRequests
    });

    port.onMessage.addListener(async (message) => {
        if (message.type === 'clear') {
            capturedRequests.length = 0;
            port.postMessage({ type: 'cleared' });
            return;
        }

        if (message.type === 'decode-curl') {
            const jzb = JzbDecoder.extractJzbFromCurl(message.curl);

            if (!jzb) {
                port.postMessage({
                    type: 'decode-error',
                    error: 'No jzb= parameter found in the pasted curl.'
                });
                return;
            }

            try {
                const payload = await JzbDecoder.decodeJzb(jzb);
                const item = buildCapturedRequest({
                    request: {
                        url: '(pasted curl)',
                        method: 'PASTE'
                    },
                    payload,
                    jzb
                });

                capturedRequests.unshift(item);
                port.postMessage({ type: 'request', item });
            } catch (error) {
                port.postMessage({
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

    try {
        const payload = await JzbDecoder.decodeJzb(jzb);
        const item = buildCapturedRequest(request, payload, jzb);

        capturedRequests.unshift(item);

        if (capturedRequests.length > 200) {
            capturedRequests.length = 200;
        }

        if (panelPort) {
            panelPort.postMessage({ type: 'request', item });
        }
    } catch (error) {
        const item = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            capturedAt: Date.now(),
            requestUrl: request.request.url,
            method: request.request.method,
            error: error.message || String(error),
            payload: null,
            summary: [],
            label: 'Decode failed'
        };

        capturedRequests.unshift(item);

        if (panelPort) {
            panelPort.postMessage({ type: 'request', item });
        }
    }
});

function buildCapturedRequest (request, payload, jzb) {
    const summary = JzbDecoder.summarizePayload(payload);

    return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        capturedAt: Date.now(),
        requestUrl: request.request.url,
        method: request.request.method,
        jzbLength: jzb.length,
        payload,
        summary,
        label: JzbDecoder.buildRequestLabel(summary, request.request.url),
        error: null
    };
}
