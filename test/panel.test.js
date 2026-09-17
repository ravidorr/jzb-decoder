const assert = require('assert');
const { SAMPLE_JZB, buildSampleCurl } = require('./fixtures');
const {
    resetExtensionModules,
    loadPanel
} = require('./browser-harness');

function buildCapturedItem () {
    return global.JzbDecoder.buildCapturedItem({
        requestUrl: 'https://example.com/beacon',
        method: 'GET',
        payload: [ { type: 'track', track_event_name: 'Example Event' } ],
        jzb: SAMPLE_JZB,
        id: 'panel-test-item',
        capturedAt: 1_700_000_000_000
    });
}

async function runPanelTests () {
    const localThis = this;

    localThis.test('ignores invalid devtools messages', async () => {
        resetExtensionModules();
        const { panelPort, dom } = loadPanel();

        await panelPort.send(null);
        await panelPort.send({ type: 'init', requests: 'not-an-array' });
        await panelPort.send({ type: 'request', item: { id: 'bad' } });

        assert.equal(dom.elements[ 'request-list' ].children.length, 0);
    });

    localThis.test('renders init and request messages', async () => {
        resetExtensionModules();
        const { panelPort, dom } = loadPanel();
        const item = buildCapturedItem();

        await panelPort.send({ type: 'init', requests: [ item ] });
        assert.ok(dom.elements[ 'request-list' ].querySelector('.request-item'));

        await panelPort.send({ type: 'request', item: { ...item, id: 'second-item' } });
        assert.equal(dom.elements[ 'request-list' ].querySelectorAll('.request-item').length, 2);
    });

    localThis.test('shows decode-error feedback from devtools', async () => {
        resetExtensionModules();
        const { panelPort, dom } = loadPanel();

        await panelPort.send({
            type: 'decode-error',
            error: 'No jzb= parameter found in the pasted curl.'
        });

        assert.equal(dom.elements[ 'paste-error' ].textContent, 'No jzb= parameter found in the pasted curl.');
        assert.equal(dom.elements[ 'paste-error' ].classList.contains('hidden'), false);
    });

    localThis.test('shows local feedback for oversized pasted cURL', async () => {
        resetExtensionModules();
        const { dom, postedToDevtools } = loadPanel();
        const { MAX_CURL_TEXT_LENGTH, getCurlTextTooLargeError } = global.JzbDecoder;

        dom.elements[ 'curl-input' ].value = 'a'.repeat(MAX_CURL_TEXT_LENGTH + 1);
        dom.elements[ 'decode-curl' ].click();

        assert.equal(dom.elements[ 'paste-error' ].textContent, getCurlTextTooLargeError());
        assert.equal(postedToDevtools.length, 0);
    });

    localThis.test('posts decode-curl for valid pasted cURL', async () => {
        resetExtensionModules();
        const { dom, postedToDevtools } = loadPanel();

        dom.elements[ 'curl-input' ].value = buildSampleCurl();
        dom.elements[ 'decode-curl' ].click();

        assert.equal(postedToDevtools.length, 1);
        assert.equal(postedToDevtools[ 0 ].type, 'decode-curl');
    });

    localThis.test('clears paste feedback when the request list is cleared', async () => {
        resetExtensionModules();
        const { panelPort, dom } = loadPanel();

        await panelPort.send({ type: 'decode-error', error: 'Decode failed' });
        await panelPort.send({ type: 'cleared' });

        assert.equal(dom.elements[ 'paste-error' ].textContent, '');
        assert.equal(dom.elements[ 'paste-error' ].classList.contains('hidden'), true);
        assert.equal(dom.elements[ 'paste-hint' ].classList.contains('hidden'), true);
    });

    localThis.test('keeps new capture selected when a filter would hide it', async () => {
        resetExtensionModules();
        const { panelPort, dom } = loadPanel();
        const visibleItem = buildCapturedItem();
        const hiddenItem = global.JzbDecoder.buildCapturedItem({
            requestUrl: 'https://example.com/hidden',
            method: 'GET',
            payload: [ { type: 'load' } ],
            jzb: SAMPLE_JZB,
            id: 'hidden-item',
            capturedAt: 1_700_000_000_001
        });

        await panelPort.send({ type: 'init', requests: [ visibleItem ] });
        dom.elements.search.value = 'load';
        dom.elements.search.dispatchEvent({ type: 'input' });

        await panelPort.send({ type: 'request', item: hiddenItem });

        assert.equal(dom.elements[ 'detail-meta' ].children.length > 0, true);
        assert.match(dom.elements[ 'detail-json' ].innerHTML, /load/);
    });

    localThis.test('filters the request list and renders request detail', async () => {
        resetExtensionModules();
        const { panelPort, dom } = loadPanel();
        const item = buildCapturedItem();

        await panelPort.send({ type: 'init', requests: [ item ] });
        dom.elements[ 'request-list' ].querySelector('.request-item').click();
        dom.elements.search.value = 'Example Event';
        dom.elements.search.dispatchEvent({ type: 'input' });

        assert.equal(dom.elements[ 'request-list' ].querySelectorAll('.request-item').length, 1);
        assert.match(dom.elements[ 'detail-json' ].innerHTML, /Example Event/);
    });

    localThis.test('copies decoded JSON to the clipboard', async () => {
        resetExtensionModules();
        const { panelPort, dom } = loadPanel({
            execCommandImpl (command) {
                return command === 'copy';
            }
        });
        const item = buildCapturedItem();

        await panelPort.send({ type: 'init', requests: [ item ] });
        dom.elements[ 'request-list' ].querySelector('.request-item').click();
        dom.elements[ 'copy-json' ].click();

        assert.equal(dom.elements[ 'copy-status' ].textContent, 'Copied');
    });

    localThis.test('shows connection lost feedback and blocks further posts', async () => {
        resetExtensionModules();
        const { panelPort, dom, postedToDevtools } = loadPanel();

        panelPort.disconnect();
        dom.elements[ 'clear-requests' ].click();

        assert.match(dom.elements[ 'paste-error' ].textContent, /Connection lost/);
        assert.equal(postedToDevtools.length, 0);
    });

    localThis.test('supports sidebar resize interactions', async () => {
        resetExtensionModules();
        const { dom } = loadPanel();

        dom.elements[ 'layout-resizer' ].dispatchEvent({
            type: 'pointerdown',
            preventDefault () {},
            clientX: 100
        });
        dom.triggerDocumentEvent('pointermove', { clientX: 140 });
        dom.triggerDocumentEvent('pointerup', {});

        dom.elements[ 'layout-resizer' ].dispatchEvent({
            type: 'keydown',
            key: 'ArrowRight',
            shiftKey: false,
            preventDefault () {}
        });

        global.window.dispatchEvent('resize');

        assert.equal(dom.layoutEl.style.getPropertyValue('--sidebar-width'), '336px');
    });

    localThis.test('closes the paste panel without focusing the curl input', async () => {
        resetExtensionModules();
        const { dom } = loadPanel();

        dom.elements[ 'paste-toggle' ].click();
        dom.elements[ 'paste-toggle' ].click();

        assert.equal(dom.elements[ 'paste-panel' ].classList.contains('hidden'), true);
    });

    localThis.test('toggles paste panel and clears curl input', async () => {
        resetExtensionModules();
        const { dom } = loadPanel({
            execCommandImpl (command) {
                if (command === 'paste') {
                    dom.elements[ 'curl-input' ].value = buildSampleCurl();
                    return true;
                }

                return false;
            }
        });

        dom.elements[ 'paste-toggle' ].click();
        assert.equal(dom.elements[ 'paste-panel' ].classList.contains('hidden'), false);

        dom.elements[ 'clear-curl' ].click();
        assert.equal(dom.elements[ 'curl-input' ].value, '');
    });

    localThis.test('shows paste hint when clipboard paste is unavailable', async () => {
        resetExtensionModules();
        const { dom } = loadPanel({
            execCommandImpl () {
                return false;
            }
        });

        dom.elements[ 'paste-toggle' ].click();

        assert.match(dom.elements[ 'paste-hint' ].textContent, /Clipboard paste unavailable/);
    });

    localThis.test('applies devtools theme changes', async () => {
        resetExtensionModules();
        const { dom, triggerThemeChange } = loadPanel();

        triggerThemeChange('dark');
        assert.equal(dom.document.documentElement.dataset.theme, 'dark');
    });

    localThis.test('applies devtools theme changes via onThemeChanged', async () => {
        resetExtensionModules();
        const { dom, triggerThemeChange } = loadPanel({ themeApi: 'firefox' });

        triggerThemeChange('dark');
        assert.equal(dom.document.documentElement.dataset.theme, 'dark');

        triggerThemeChange('light');
        assert.equal(dom.document.documentElement.dataset.theme, 'default');

        triggerThemeChange('firebug');
        assert.equal(dom.document.documentElement.dataset.theme, 'default');
    });

    localThis.test('renders filter-empty state and reselects visible requests', async () => {
        resetExtensionModules();
        const { panelPort, dom } = loadPanel();
        const item = buildCapturedItem();

        await panelPort.send({ type: 'init', requests: [ item ] });
        dom.elements.search.value = 'does-not-match';
        dom.elements.search.dispatchEvent({ type: 'input' });

        assert.match(dom.elements[ 'request-list' ].children[ 0 ].textContent, /No requests match/);

        dom.elements.search.value = '';
        dom.elements.search.dispatchEvent({ type: 'input' });
        assert.equal(dom.elements[ 'request-list' ].querySelectorAll('.request-item').length, 1);
    });

    localThis.test('renders decode errors in the request detail', async () => {
        resetExtensionModules();
        const { panelPort, dom } = loadPanel();
        const errorItem = global.JzbDecoder.buildErrorCapturedItem({
            requestUrl: 'https://example.com/beacon?jzb=bad',
            method: 'GET',
            error: new Error('decode failed')
        });

        await panelPort.send({ type: 'init', requests: [ errorItem ] });
        dom.elements[ 'request-list' ].querySelector('.request-item').click();

        assert.equal(dom.elements[ 'detail-json' ].textContent, 'decode failed');
        assert.equal(dom.elements[ 'copy-json' ].disabled, true);
    });

    localThis.test('selects requests from the list and skips duplicate selection', async () => {
        resetExtensionModules();
        const { panelPort, dom } = loadPanel();
        const firstItem = buildCapturedItem();
        const secondItem = { ...buildCapturedItem(), id: 'second-item', label: 'Second item' };

        await panelPort.send({ type: 'init', requests: [ firstItem, secondItem ] });

        const buttons = dom.elements[ 'request-list' ].querySelectorAll('.request-item');
        buttons[ 1 ].click();
        assert.match(dom.elements[ 'detail-json' ].innerHTML, /track/);

        buttons[ 1 ].click();
        assert.match(dom.elements[ 'detail-json' ].innerHTML, /track/);
    });

    localThis.test('shows copy failed feedback when clipboard copy is unavailable', async () => {
        resetExtensionModules();
        const { panelPort, dom } = loadPanel({
            execCommandImpl () {
                return false;
            }
        });
        const item = buildCapturedItem();

        await panelPort.send({ type: 'init', requests: [ item ] });
        dom.elements[ 'request-list' ].querySelector('.request-item').click();
        dom.elements[ 'copy-json' ].click();

        assert.equal(dom.elements[ 'copy-status' ].textContent, 'Copy failed');
    });

    localThis.test('hides copy status after the timeout', async () => {
        resetExtensionModules();
        const { panelPort, dom } = loadPanel({
            execCommandImpl (command) {
                return command === 'copy';
            }
        });
        const item = buildCapturedItem();

        await panelPort.send({ type: 'init', requests: [ item ] });
        dom.elements[ 'request-list' ].querySelector('.request-item').click();
        dom.elements[ 'copy-json' ].click();
        dom.elements[ 'copy-json' ].click();

        await new Promise((resolve) => setTimeout(resolve, 1600));

        assert.equal(dom.elements[ 'copy-status' ].classList.contains('hidden'), true);
    });

    localThis.test('posts clear requests to devtools', async () => {
        resetExtensionModules();
        const { dom, postedToDevtools } = loadPanel();

        dom.elements[ 'clear-requests' ].click();

        assert.equal(postedToDevtools.length, 1);
        assert.equal(postedToDevtools[ 0 ].type, 'clear');
    });

    localThis.test('restores saved sidebar width from localStorage', async () => {
        resetExtensionModules();
        const { dom } = loadPanel({
            localStorageValues: {
                'jzb-decoder-sidebar-width': '320'
            }
        });

        assert.equal(dom.layoutEl.style.getPropertyValue('--sidebar-width'), '320px');
    });

    localThis.test('ignores unrelated keyboard events on the resizer', async () => {
        resetExtensionModules();
        const { dom } = loadPanel();

        dom.elements[ 'layout-resizer' ].dispatchEvent({
            type: 'keydown',
            key: 'Enter',
            preventDefault () {}
        });

        assert.equal(dom.layoutEl.style.getPropertyValue('--sidebar-width'), '280px');
    });

    localThis.test('supports keyboard resize with shift', async () => {
        resetExtensionModules();
        const { dom } = loadPanel();

        dom.elements[ 'layout-resizer' ].dispatchEvent({
            type: 'keydown',
            key: 'ArrowLeft',
            shiftKey: true,
            preventDefault () {}
        });

        assert.equal(dom.layoutEl.style.getPropertyValue('--sidebar-width'), '240px');
    });

    localThis.test('uses the default sidebar width when localStorage is empty', async () => {
        resetExtensionModules();
        const { dom } = loadPanel();

        assert.equal(dom.layoutEl.style.getPropertyValue('--sidebar-width'), '280px');
    });

    localThis.test('reselects the first visible request when the selection is filtered out', async () => {
        resetExtensionModules();
        const { panelPort, dom } = loadPanel();
        const firstItem = buildCapturedItem();
        const secondItem = {
            ...buildCapturedItem(),
            id: 'second-item',
            label: 'Second item',
            capturedAt: 1_700_000_000_001
        };

        await panelPort.send({ type: 'init', requests: [ firstItem, secondItem ] });
        dom.elements[ 'request-list' ].querySelector('.request-item').click();
        dom.elements.search.value = 'Second item';
        dom.elements.search.dispatchEvent({ type: 'input' });

        assert.match(dom.elements[ 'detail-json' ].innerHTML, /Second item|track/);
    });

    localThis.test('skips copying when no payload is selected', async () => {
        resetExtensionModules();
        const { dom } = loadPanel();

        dom.elements[ 'copy-json' ].click();

        assert.equal(dom.elements[ 'copy-status' ].textContent, '');
    });

    localThis.test('clears selection when a trimmed request was selected', async () => {
        resetExtensionModules();
        const { panelPort, dom } = loadPanel();
        const { MAX_CAPTURED_REQUESTS } = global.JzbDecoder;
        const requests = Array.from({ length: MAX_CAPTURED_REQUESTS }, (_, index) => (
            global.JzbDecoder.buildCapturedItem({
                requestUrl: `https://example.com/${index + 1}`,
                method: 'GET',
                payload: [ { type: 'track', track_event_name: `Event ${index + 1}` } ],
                jzb: SAMPLE_JZB,
                id: `item-${index + 1}`,
                capturedAt: index + 1
            })
        ));

        await panelPort.send({ type: 'init', requests });
        dom.elements[ 'request-list' ].querySelector('.request-item[data-id="item-1"]').click();

        await panelPort.send({
            type: 'request',
            item: global.JzbDecoder.buildCapturedItem({
                requestUrl: 'https://example.com/new',
                method: 'GET',
                payload: [ { type: 'track', track_event_name: 'New event' } ],
                jzb: SAMPLE_JZB,
                id: 'item-new',
                capturedAt: MAX_CAPTURED_REQUESTS + 1
            })
        });

        assert.equal(dom.elements[ 'request-list' ].querySelector('.request-item[data-id="item-1"]'), null);
    });

    localThis.test('keeps the current selection when it still matches the filter', async () => {
        resetExtensionModules();
        const { panelPort, dom } = loadPanel();
        const item = buildCapturedItem();

        await panelPort.send({ type: 'init', requests: [ item ] });
        dom.elements[ 'request-list' ].querySelector('.request-item').click();
        dom.elements.search.value = 'Example Event';
        dom.elements.search.dispatchEvent({ type: 'input' });

        assert.match(dom.elements[ 'detail-json' ].innerHTML, /Example Event/);
    });

    localThis.test('ignores sidebar width updates when layout is missing', async () => {
        resetExtensionModules();
        const { dom } = loadPanel();
        const originalQuerySelector = dom.document.querySelector.bind(dom.document);

        dom.document.querySelector = () => null;
        global.window.dispatchEvent('resize');
        dom.document.querySelector = originalQuerySelector;

        assert.equal(dom.layoutEl.style.getPropertyValue('--sidebar-width'), '280px');
    });

    localThis.test('skips copying for error items', async () => {
        resetExtensionModules();
        const { panelPort, dom } = loadPanel({
            execCommandImpl (command) {
                return command === 'copy';
            }
        });
        const errorItem = global.JzbDecoder.buildErrorCapturedItem({
            requestUrl: 'https://example.com/beacon?jzb=bad',
            method: 'GET',
            error: new Error('decode failed')
        });

        await panelPort.send({ type: 'init', requests: [ errorItem ] });
        dom.elements[ 'request-list' ].querySelector('.request-item').click();
        dom.elements[ 'copy-json' ].click();

        assert.equal(dom.elements[ 'copy-status' ].textContent, '');
    });

    localThis.test('shows empty detail when nothing is selected', async () => {
        resetExtensionModules();
        const { panelPort, dom } = loadPanel();
        const item = buildCapturedItem();

        await panelPort.send({ type: 'init', requests: [ item ] });
        await panelPort.send({ type: 'cleared' });

        assert.equal(dom.elements[ 'detail-empty' ].classList.contains('hidden'), false);
        assert.equal(dom.elements[ 'detail-content' ].classList.contains('hidden'), true);
    });

    localThis.test('trims selected request when it falls out of the retained list', async () => {
        resetExtensionModules();
        const { panelPort, dom } = loadPanel();
        const { MAX_CAPTURED_REQUESTS } = global.JzbDecoder;
        const requests = Array.from({ length: MAX_CAPTURED_REQUESTS + 1 }, (_, index) => (
            global.JzbDecoder.buildCapturedItem({
                requestUrl: `https://example.com/${index}`,
                method: 'GET',
                payload: [ { type: 'track', track_event_name: `Event ${index}` } ],
                jzb: SAMPLE_JZB,
                id: `item-${index}`,
                capturedAt: index
            })
        ));

        await panelPort.send({ type: 'init', requests: requests.slice(0, MAX_CAPTURED_REQUESTS) });
        await panelPort.send({ type: 'request', item: requests.at(-1) });

        assert.equal(dom.elements[ 'request-list' ].querySelectorAll('.request-item').length, MAX_CAPTURED_REQUESTS);
    });

    localThis.test('shows connection lost when postMessage throws', async () => {
        resetExtensionModules();
        const {
            createDom,
            createChromeMock,
            createMockPort,
            loadJzbDecoder
        } = require('./browser-harness');
        const dom = createDom();
        const panelPort = createMockPort('jzb-panel');

        panelPort.postMessage = () => {
            throw new Error('post failed');
        };

        const chromeHarness = createChromeMock();
        chromeHarness.chrome.runtime.connect = () => panelPort;
        global.chrome = chromeHarness.chrome;
        global.document = dom.document;
        global.window = dom.window;
        global.localStorage = dom.localStorage;
        global.getComputedStyle = (element) => ({
            getPropertyValue (name) {
                const inlineValue = element?.style?.getPropertyValue?.(name);

                if (inlineValue) {
                    return inlineValue;
                }

                return name === '--sidebar-width' ? '280px' : '';
            }
        });

        loadJzbDecoder();
        require('../panel.js');

        dom.elements[ 'clear-requests' ].click();

        assert.match(dom.elements[ 'paste-error' ].textContent, /Connection lost/);
    });

    console.log('panel tests passed');
}

module.exports = runPanelTests;

if (require.main === module) {
    runPanelTests.call({
        test (_name, fn) {
            return fn();
        }
    }).catch((error) => {
        console.error(error);
        process.exit(1);
    });
}
