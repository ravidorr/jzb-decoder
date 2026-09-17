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
    JzbDecoder.trimCapturedRequestArray(capturedRequests);
}

function addCapturedItem (item) {
    capturedRequests.unshift(item);
    trimCapturedRequests();
    safePostMessage(panelPort, { type: 'request', item });
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
                    error: JzbDecoder.formatError(error)
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
    const requestUrl = request.request.url;

    if (!requestUrl.includes('jzb=')) return;

    const jzb = JzbDecoder.extractJzbFromUrl(requestUrl);

    if (!jzb) return;

    let item;

    try {
        const payload = await JzbDecoder.decodeJzb(jzb);
        item = JzbDecoder.buildCapturedItem({
            requestUrl,
            method: request.request.method,
            payload,
            jzb
        });
    } catch (error) {
        item = JzbDecoder.buildErrorCapturedItem({
            requestUrl,
            method: request.request.method,
            error
        });
    }

    addCapturedItem(item);
});
