const assert = require('assert');
const { SAMPLE_JZB, buildSampleCurl } = require('./fixtures');
const {
    resetExtensionModules,
    loadIntegration
} = require('./browser-harness');

async function waitFor (predicate, attempts = 50) {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
        if (predicate()) {
            return;
        }

        await new Promise((resolve) => setImmediate(resolve));
    }

    throw new Error('Timed out waiting for condition');
}

async function runIntegrationTests () {
    const localThis = this;

    localThis.test('captures pasted cURL end to end through devtools and panel', async () => {
        resetExtensionModules();
        const { dom, channel } = loadIntegration();

        dom.elements[ 'curl-input' ].value = buildSampleCurl();
        dom.elements[ 'decode-curl' ].click();

        await waitFor(() => channel.messagesToDevtools.length === 1);
        await waitFor(() => dom.elements[ 'request-list' ].querySelectorAll('.request-item').length === 1);

        assert.equal(channel.messagesToDevtools.length, 1);
        assert.equal(channel.messagesToDevtools[ 0 ].type, 'decode-curl');
        assert.equal(dom.elements[ 'request-list' ].querySelectorAll('.request-item').length, 1);
        assert.equal(dom.elements[ 'decode-curl' ].disabled, false);
        assert.match(dom.elements[ 'detail-json' ].innerHTML, /Object Analytics - Object created/);
    });

    localThis.test('captures network requests end to end through devtools and panel', async () => {
        resetExtensionModules();
        const { dom, harness } = loadIntegration();

        await harness.networkListeners[ 0 ]({
            request: {
                url: `https://example.com/beacon?jzb=${SAMPLE_JZB}`,
                method: 'GET'
            }
        });

        await waitFor(() => dom.elements[ 'request-list' ].querySelectorAll('.request-item').length === 1);

        assert.equal(dom.elements[ 'request-list' ].querySelectorAll('.request-item').length, 1);
        assert.match(dom.elements[ 'detail-json' ].innerHTML, /Object Analytics - Object created/);
    });

    localThis.test('clears captured requests end to end through devtools and panel', async () => {
        resetExtensionModules();
        const { dom, harness } = loadIntegration();

        await harness.networkListeners[ 0 ]({
            request: {
                url: `https://example.com/beacon?jzb=${SAMPLE_JZB}`,
                method: 'GET'
            }
        });

        await waitFor(() => dom.elements[ 'request-list' ].querySelectorAll('.request-item').length === 1);
        dom.elements[ 'clear-requests' ].click();
        await waitFor(() => dom.elements[ 'request-list' ].querySelectorAll('.request-item').length === 0);

        assert.equal(dom.elements[ 'request-list' ].querySelectorAll('.request-item').length, 0);
        assert.equal(dom.elements[ 'detail-empty' ].classList.contains('hidden'), false);
    });

    localThis.test('shows connection lost when devtools cannot notify the panel', async () => {
        resetExtensionModules();
        const { dom, harness, channel } = loadIntegration();

        channel.portForDevtools.postMessage = () => {
            throw new Error('postMessage failed');
        };

        await harness.networkListeners[ 0 ]({
            request: {
                url: `https://example.com/beacon?jzb=${SAMPLE_JZB}`,
                method: 'GET'
            }
        });

        await waitFor(() => /Connection lost/.test(dom.elements[ 'paste-error' ].textContent));

        assert.match(dom.elements[ 'paste-error' ].textContent, /Connection lost/);
    });

    console.log('integration tests passed');
}

module.exports = runIntegrationTests;

if (require.main === module) {
    runIntegrationTests.call({
        test (_name, fn) {
            return fn();
        }
    }).catch((error) => {
        console.error(error);
        process.exit(1);
    });
}
