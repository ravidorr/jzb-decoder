const capturedRequests = [];
let panelPort = null;
let captureGeneration = 0;

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

function addCapturedItem (item, generation = captureGeneration) {
    if (generation !== captureGeneration) {
        return;
    }

    capturedRequests.unshift(item);
    JzbDecoder.trimCapturedRequestArray(capturedRequests);
    safePostMessage(panelPort, { type: 'request', item });
}

function isPanelMessage (message) {
    if (!message || typeof message !== 'object' || typeof message.type !== 'string') {
        return false;
    }

    if (message.type === 'clear') {
        return true;
    }

    if (message.type === 'decode-curl') {
        return typeof message.curl === 'string';
    }

    return false;
}

async function buildItemFromJzb ({ requestUrl, method, jzb }) {
    try {
        const payload = await JzbDecoder.decodeJzb(jzb);

        return JzbDecoder.buildCapturedItem({
            requestUrl,
            method,
            payload,
            jzb
        });
    } catch (error) {
        return JzbDecoder.buildErrorCapturedItem({
            requestUrl,
            method,
            error
        });
    }
}

chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== 'jzb-panel') return;

    panelPort = port;
    safePostMessage(port, {
        type: 'init',
        requests: capturedRequests
    });

    port.onMessage.addListener(async (message) => {
        if (!isPanelMessage(message)) {
            return;
        }

        if (message.type === 'clear') {
            captureGeneration += 1;
            capturedRequests.length = 0;
            safePostMessage(port, { type: 'cleared' });
            return;
        }

        if (message.type === 'decode-curl') {
            if (JzbDecoder.isCurlTextTooLarge(message.curl)) {
                safePostMessage(port, {
                    type: 'decode-error',
                    error: JzbDecoder.getCurlTextTooLargeError()
                });
                return;
            }

            const source = JzbDecoder.extractJzbSourceFromCurl(message.curl);

            if (!source) {
                safePostMessage(port, {
                    type: 'decode-error',
                    error: 'No jzb= parameter found in the pasted curl.'
                });
                return;
            }

            const generation = captureGeneration;
            const item = await buildItemFromJzb({
                requestUrl: source.requestUrl,
                method: 'PASTE',
                jzb: source.jzb
            });

            if (item.error) {
                safePostMessage(port, {
                    type: 'decode-error',
                    error: item.error
                });
                return;
            }

            addCapturedItem(item, generation);
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

    const generation = captureGeneration;
    const item = await buildItemFromJzb({
        requestUrl,
        method: request.request.method,
        jzb
    });

    addCapturedItem(item, generation);
});
