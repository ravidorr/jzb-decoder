const assert = require('assert');
const { SAMPLE_JZB, buildSampleCurl } = require('./fixtures');
const {
    createMockPort,
    resetExtensionModules,
    loadDevtools
} = require('./browser-harness');

async function runDevtoolsTests () {
    const localThis = this;

    localThis.test('rejects invalid panel messages', async () => {
        resetExtensionModules();
        const harness = loadDevtools();
        const port = createMockPort('jzb-panel');
        harness.connectListeners[ 0 ](port);

        await port.send(null);
        await port.send({ type: 'unknown' });
        await port.send({ type: 'decode-curl', curl: 123 });
        assert.equal(port.messages.length, 1);
        assert.equal(port.messages[ 0 ].type, 'init');
    });

    localThis.test('clears captured requests and notifies the panel', async () => {
        resetExtensionModules();
        const harness = loadDevtools();
        const port = createMockPort('jzb-panel');
        harness.connectListeners[ 0 ](port);

        await port.send({ type: 'clear' });
        assert.equal(port.messages.at(-1).type, 'cleared');
    });

    localThis.test('returns decode-error for oversized pasted cURL', async () => {
        resetExtensionModules();
        const harness = loadDevtools();
        const { MAX_CURL_TEXT_LENGTH, getCurlTextTooLargeError } = global.JzbDecoder;
        const port = createMockPort('jzb-panel');
        harness.connectListeners[ 0 ](port);

        await port.send({
            type: 'decode-curl',
            curl: 'a'.repeat(MAX_CURL_TEXT_LENGTH + 1)
        });

        const decodeError = port.messages.find((message) => message.type === 'decode-error');
        assert.ok(decodeError);
        assert.equal(decodeError.error, getCurlTextTooLargeError());
    });

    localThis.test('decodes pasted cURL and captures the request', async () => {
        resetExtensionModules();
        const harness = loadDevtools();
        const port = createMockPort('jzb-panel');
        harness.connectListeners[ 0 ](port);

        await port.send({
            type: 'decode-curl',
            curl: buildSampleCurl()
        });

        const captured = port.messages.find((message) => message.type === 'request');
        assert.ok(captured);
        assert.equal(captured.item.method, 'PASTE');
        assert.equal(captured.item.requestUrl, `https://example.com/beacon?jzb=${SAMPLE_JZB}&type=track`);
        assert.ok(captured.item.payload);
    });

    localThis.test('ignores stale decode-error after clear', async () => {
        resetExtensionModules();
        const harness = loadDevtools();
        let rejectDecode;
        const decodePromise = new Promise((_, reject) => {
            rejectDecode = reject;
        });

        global.JzbDecoder.decodeJzb = () => decodePromise;

        const port = createMockPort('jzb-panel');
        harness.connectListeners[ 0 ](port);

        void port.send({
            type: 'decode-curl',
            curl: buildSampleCurl()
        });

        await new Promise((resolve) => setImmediate(resolve));
        await port.send({ type: 'clear' });
        rejectDecode(new Error('decode failed'));
        await decodePromise.catch(() => {});
        await new Promise((resolve) => setImmediate(resolve));

        assert.equal(port.messages.filter((message) => message.type === 'decode-error').length, 0);
    });

    localThis.test('ignores stale decodes after clear', async () => {
        resetExtensionModules();
        const harness = loadDevtools();
        const { decodeJzb } = global.JzbDecoder;
        const originalDecode = decodeJzb;
        let resolveDecode;
        const decodePromise = new Promise((resolve) => {
            resolveDecode = resolve;
        });

        global.JzbDecoder.decodeJzb = () => decodePromise;

        const port = createMockPort('jzb-panel');
        harness.connectListeners[ 0 ](port);

        void port.send({
            type: 'decode-curl',
            curl: buildSampleCurl()
        });

        await new Promise((resolve) => setImmediate(resolve));
        await port.send({ type: 'clear' });
        resolveDecode(await originalDecode(SAMPLE_JZB));
        await decodePromise;
        await new Promise((resolve) => setImmediate(resolve));

        assert.equal(port.messages.filter((message) => message.type === 'request').length, 0);
        global.JzbDecoder.decodeJzb = originalDecode;
    });

    localThis.test('ignores duplicate decode-curl while a decode is in flight', async () => {
        resetExtensionModules();
        const harness = loadDevtools();
        const { decodeJzb } = global.JzbDecoder;
        const originalDecode = decodeJzb;
        let resolveDecode;
        const decodePromise = new Promise((resolve) => {
            resolveDecode = resolve;
        });

        global.JzbDecoder.decodeJzb = () => decodePromise;

        const port = createMockPort('jzb-panel');
        harness.connectListeners[ 0 ](port);

        void port.send({
            type: 'decode-curl',
            curl: buildSampleCurl()
        });
        void port.send({
            type: 'decode-curl',
            curl: buildSampleCurl()
        });

        await new Promise((resolve) => setImmediate(resolve));
        resolveDecode(await originalDecode(SAMPLE_JZB));
        await decodePromise;
        await new Promise((resolve) => setImmediate(resolve));

        assert.equal(port.messages.filter((message) => message.type === 'request').length, 1);
        global.JzbDecoder.decodeJzb = originalDecode;
    });

    localThis.test('ignores stale network captures after clear', async () => {
        resetExtensionModules();
        const harness = loadDevtools();
        const { decodeJzb } = global.JzbDecoder;
        const originalDecode = decodeJzb;
        let resolveDecode;
        const decodePromise = new Promise((resolve) => {
            resolveDecode = resolve;
        });

        global.JzbDecoder.decodeJzb = () => decodePromise;

        const port = createMockPort('jzb-panel');
        harness.connectListeners[ 0 ](port);

        void harness.networkListeners[ 0 ]({
            request: {
                url: `https://example.com/beacon?jzb=${SAMPLE_JZB}`,
                method: 'GET'
            }
        });

        await new Promise((resolve) => setImmediate(resolve));
        await port.send({ type: 'clear' });
        resolveDecode(await originalDecode(SAMPLE_JZB));
        await decodePromise;
        await new Promise((resolve) => setImmediate(resolve));

        assert.equal(port.messages.filter((message) => message.type === 'request').length, 0);
        global.JzbDecoder.decodeJzb = originalDecode;
    });

    localThis.test('captures finished network requests with jzb=', async () => {
        resetExtensionModules();
        const harness = loadDevtools();
        const port = createMockPort('jzb-panel');
        harness.connectListeners[ 0 ](port);

        await harness.networkListeners[ 0 ]({
            request: {
                url: `https://example.com/beacon?jzb=${SAMPLE_JZB}`,
                method: 'GET'
            }
        });

        const captured = port.messages.find((message) => message.type === 'request');
        assert.ok(captured);
        assert.equal(captured.item.method, 'GET');
    });

    localThis.test('skips network requests without jzb=', async () => {
        resetExtensionModules();
        const harness = loadDevtools();
        const port = createMockPort('jzb-panel');
        harness.connectListeners[ 0 ](port);

        await harness.networkListeners[ 0 ]({
            request: {
                url: 'https://example.com/beacon?foo=bar',
                method: 'GET'
            }
        });

        assert.equal(port.messages.filter((message) => message.type === 'request').length, 0);
    });

    localThis.test('returns decode-error when pasted cURL has no jzb parameter', async () => {
        resetExtensionModules();
        const harness = loadDevtools();
        const port = createMockPort('jzb-panel');
        harness.connectListeners[ 0 ](port);

        await port.send({
            type: 'decode-curl',
            curl: 'curl \'https://example.com/beacon?foo=bar\''
        });

        const decodeError = port.messages.find((message) => message.type === 'decode-error');
        assert.ok(decodeError);
        assert.match(decodeError.error, /No jzb= parameter found/);
    });

    localThis.test('returns decode-error when pasted cURL contains invalid jzb', async () => {
        resetExtensionModules();
        const harness = loadDevtools();
        const port = createMockPort('jzb-panel');
        harness.connectListeners[ 0 ](port);

        await port.send({
            type: 'decode-curl',
            curl: 'curl \'https://example.com/beacon?jzb=not-valid\''
        });

        const decodeError = port.messages.find((message) => message.type === 'decode-error');
        assert.ok(decodeError);
        assert.ok(decodeError.error);
    });

    localThis.test('captures network requests with decode errors', async () => {
        resetExtensionModules();
        const harness = loadDevtools();
        const port = createMockPort('jzb-panel');
        harness.connectListeners[ 0 ](port);

        await harness.networkListeners[ 0 ]({
            request: {
                url: 'https://example.com/beacon?jzb=not-valid',
                method: 'GET'
            }
        });

        const captured = port.messages.find((message) => message.type === 'request');
        assert.ok(captured);
        assert.ok(captured.item.error);
    });

    localThis.test('handles network capture when the panel is disconnected', async () => {
        resetExtensionModules();
        const harness = loadDevtools();

        await harness.networkListeners[ 0 ]({
            request: {
                url: `https://example.com/beacon?jzb=${SAMPLE_JZB}`,
                method: 'GET'
            }
        });
    });

    localThis.test('clears panelPort on disconnect', async () => {
        resetExtensionModules();
        const harness = loadDevtools();
        const port = createMockPort('jzb-panel');
        harness.connectListeners[ 0 ](port);

        port.disconnect();

        await harness.networkListeners[ 0 ]({
            request: {
                url: `https://example.com/beacon?jzb=${SAMPLE_JZB}`,
                method: 'GET'
            }
        });
    });

    localThis.test('trims captured requests at the devtools cap', async () => {
        resetExtensionModules();
        const harness = loadDevtools();
        const { MAX_CAPTURED_REQUESTS } = global.JzbDecoder;
        const port = createMockPort('jzb-panel');
        harness.connectListeners[ 0 ](port);

        for (let index = 0; index < MAX_CAPTURED_REQUESTS + 1; index += 1) {
            await harness.networkListeners[ 0 ]({
                request: {
                    url: `https://example.com/beacon?jzb=${SAMPLE_JZB}&i=${index}`,
                    method: 'GET'
                }
            });
        }

        const captured = port.messages.filter((message) => message.type === 'request');
        assert.equal(captured.length, MAX_CAPTURED_REQUESTS + 1);

        const initMessage = port.messages.find((message) => message.type === 'init');
        await port.send({ type: 'clear' });
        assert.equal(initMessage.requests.length, 0);
    });

    localThis.test('survives postMessage failures from the panel port', async () => {
        resetExtensionModules();
        const harness = loadDevtools();
        const port = createMockPort('jzb-panel', { throwOnPost: true });
        harness.connectListeners[ 0 ](port);

        await port.send({ type: 'clear' });
    });

    localThis.test('survives disconnect failures after postMessage errors', async () => {
        resetExtensionModules();
        const harness = loadDevtools();
        const port = createMockPort('jzb-panel', { throwOnPost: true, throwOnDisconnect: true });
        harness.connectListeners[ 0 ](port);

        await port.send({ type: 'clear' });
    });

    console.log('devtools tests passed');
}

module.exports = runDevtoolsTests;

if (require.main === module) {
    runDevtoolsTests.call({
        test (_name, fn) {
            return fn();
        }
    }).catch((error) => {
        console.error(error);
        process.exit(1);
    });
}
