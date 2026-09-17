const assert = require('assert');
const {
    SAMPLE_JZB,
    toBase64Url,
    buildWrappedJzb,
    buildDeflatedJzb
} = require('./fixtures');

global.self = global;
require('../jzb.js');

const GUIDE_JZB = 'eJx9lNtzokgUh_8XnkOkrzS-4QXviCY4mq0tCgGRgIA0F-PW_O_TZmazVVuEF4o6nvP9vjp2849URzwqs2LmS33JscbmaO28OlacX28fgwAsDOlJcj0vq9Ly0ZJWSfIkVUUius9lmfN-r9c0zXMepH72HGU90Z4l_u4_6O-JMroE9ywN1qcTD0qpLwOmPEmXoHR9t3Sl_pfH4zXqcEncNKzcMBAdQSr9_JL7d-4RJ6q5WwRpqX_9Jkoi6DEF1J6i9aACqaDVQcGjLBVl-IwweFacvMh8OcoeZM_1zoE_qSI_4FL_rz9egMZ0NJxcrenptjThj9yeFXhRLa2t96nHSzt_RPm6yAUqYoxCDAhF4H_ysv0iUv5QhyGDmp9veLM9669XbFmJdTgviXb-nqoRxCDqoo60eHmtt95GX72Hr1VuzIl5HBZob-ptVIURRDWoCd8u6szIqx9yNDAzebLSmONp09C_W-_mmLVRKWQAEkXBKu6irqZH_mEvoomLZ7lrj3E4XczXW2WttVIJpABCSjSVdVFNVLjvo3C3iQ0gp80IurUx4dSdD8etVBUjBSIVgc69vil3cvN0z5i4PnfHpFaafKnT5TtbfftvQRUCDLuoHpm-zdEUGjuTkpqnAb9cNPNufiStrp9UpGIA1C7qeW-EzWq-bhYlg77t83rlHNVw6qxb9_r7vGIqnl3UiFf3wYtdJ9Z5BxoWI7Zno-Npa-qtG2CAEEW4Etx5BuLEm8nxYVTOB8ppvPQGvjPYJWXG1lm7q6ooACNItS5qwWaTRTYfngZvo7v7or-e-MaTHaXS-fd7hUCD4gv1PbUqjld2uA3PkYm3vEny_fV43xjH9SFuo6pClKiaSrtdb2iHdjS-TG26vzX2ZVLr13wIVvLh0Hq3sLheAGOISBv175-_ADJ7z-M';
const SEGMENTFLAG_JZB = 'eJx9jcGuwiAQRf9l1hXaajSvO42aGBNfF-4JKaQScUAKrcb03wsLu3Q3ufeeMx_oVae8cScBFbD6cNn_syur7_b5eu9kcT5CBrxpTECfJhi0zuAhPRfcc6hmPp3qh0NzbANvZVxIhHGWfrkkjqnlTqLfzl2M4qNEFRua_9EyL9fR1kvXKYMxLslyVZCcWWfEQplkDk7H4ua97SpKh2EgVqIwRBkK4wTQ1k6O';
const LOAD_JZB = 'eJzdVVtTGj8U_ypOnkHYcnH1TQWmyFRptf9qO_9hstnDkiGbrMlZYXX47p7NokWmOtqpfSg8kOy5_C45ZH_cMSwyYAdMGR6zGousWTiwE5QpPQ32wv1up9Vqt4Juu8ZupJNo7ETGVDAZ9097Z5OLyXieXS-LIwhGA2rAhTC5Rp-jc6VqLLeK0meImTtoNBaLxW4GOja70jQoP7Mmc-zgzhNYw4bNcEURbkHjBY-Gj62w2rBgfjIetO3gCs6jzugopD5Ty1PwwbacHo4uo-vTfnscC7GgoAPnpNE-fLrsqe5tES-_3wb5UPUpnGNaMhAzrjWUZHvSgkBGJBwkKbEYKJ64j9zNKKiH1lyehXEwhONvXz7hKCw6YXL-Ify8d3I-t12IZNY8vom6X42Hvs5BC1LVJHcLBBLb6nZWtUfnp0bk7gXr6fvO1iO3CWC1SqjgkIIeiH6FohRmsC6MmUuoZ0ZJUdSV1HOKokRFZCs0jmh9v5mF6XO4ChKuGlWzqlej9DkthjqGJekmyJlU8XpLpuGSqLFjX7Ez9iUleT8dfQX-6CreveF_D8yNBrS5wwe-CNTlQc1zxDd5EPAWj7chvglsSzRtXwuWWJNndDYaudRgNw_MxfM6yGSGO-uNMCpPdTlqf179NjDN8l_B2VT-jmjvOzFRee_YUs-GPLpycCcyiCYtD3Bh6p5BuY5yeqpdffqsx-VNKSserPnS_-sNo0ZWO0p8QvNVw91sPcUM938NenTWu_ot57c1rX5-_r3XCIldv0aCzn579f893ZaGgA';

async function runJzbTests () {
    const {
        MAX_CAPTURED_REQUESTS,
        MAX_JZB_BASE64_LENGTH,
        MAX_COMPRESSED_BYTES,
        MAX_DECOMPRESSED_CHARS,
        MAX_CURL_TEXT_LENGTH,
        base64UrlToBytes,
        decodeJzb,
        extractJzbFromUrl,
        extractJzbFromCurl,
        extractJzbSourceFromCurl,
        normalizeCurlText,
        extractUrlsFromCurl,
        summarizePayload,
        formatTimestamp,
        buildRequestLabel,
        buildCapturedItem,
        buildErrorCapturedItem,
        formatError,
        trimCapturedRequestArray,
        trimCapturedRequestMap,
        matchesCapturedRequestSearch,
        highlightJson,
        isCapturedItem,
        isCurlTextTooLarge,
        getCurlTextTooLargeError
    } = global.JzbDecoder;

    assert.equal(MAX_CAPTURED_REQUESTS, 200);

    const payload = await decodeJzb(SAMPLE_JZB);
    assert.equal(Array.isArray(payload), true);
    assert.equal(payload[0].type, 'track');
    assert.equal(payload[0].track_event_name, 'Object Analytics - Object created');
    assert.equal(payload[0].visitor_id, 'ravidor@pendo.io');

    const wrappedJzb = buildWrappedJzb([ { type: 'wrapped' } ]);
    const wrappedPayload = await decodeJzb(wrappedJzb);
    assert.equal(wrappedPayload[ 0 ].type, 'wrapped');

    assert.throws(() => base64UrlToBytes(''), /Missing jzb parameter/);
    assert.throws(() => base64UrlToBytes('a'), /truncated or malformed/);
    await assert.rejects(() => decodeJzb('!!!not-valid!!!'));

    const url = `https://data.pendo.io/data/ptm.gif/key?v=1&jzb=${SAMPLE_JZB}`;
    assert.equal(extractJzbFromUrl(url), SAMPLE_JZB);
    assert.equal(extractJzbFromUrl('not a url'), null);

    const encodedJzbUrl = `https://example.com/beacon?jzb=${encodeURIComponent(SAMPLE_JZB.slice(0, 80))}`;
    assert.equal(extractJzbFromUrl(encodedJzbUrl), SAMPLE_JZB.slice(0, 80));

    const curl = `curl 'https://data.pendo.io/data/ptm.gif/key?jzb=${SAMPLE_JZB}&type=track'`;
    assert.equal(extractJzbFromCurl(curl), SAMPLE_JZB);
    assert.equal(extractJzbFromCurl(''), null);
    assert.equal(extractJzbFromCurl(null), null);

    const doubleQuotedCurl = `curl "https://example.com/beacon?jzb=${SAMPLE_JZB}&v=1"`;
    assert.equal(extractJzbFromCurl(doubleQuotedCurl), SAMPLE_JZB);

    const urlFlagCurl = `curl --url 'https://example.com/beacon?jzb=${SAMPLE_JZB}' -H 'accept: */*'`;
    assert.equal(extractJzbFromCurl(urlFlagCurl), SAMPLE_JZB);

    const multilineCurl = [
        'curl \\',
        `  'https://example.com/beacon?jzb=${SAMPLE_JZB}&type=track' \\`,
        '  -H \'accept: */*\''
    ].join('\n');
    assert.equal(extractJzbFromCurl(multilineCurl), SAMPLE_JZB);

    const jzbOnlyCurl = `curl 'https://example.com/beacon?foo=bar' --get 'https://example.com/other?jzb=${SAMPLE_JZB}'`;
    assert.equal(extractJzbFromCurl(jzbOnlyCurl), SAMPLE_JZB);
    assert.deepEqual(extractJzbSourceFromCurl(jzbOnlyCurl), {
        jzb: SAMPLE_JZB,
        requestUrl: `https://example.com/other?jzb=${SAMPLE_JZB}`
    });

    assert.deepEqual(
        extractUrlsFromCurl('curl \'https://example.com/a\' --url "https://example.com/b"'),
        [ 'https://example.com/a', 'https://example.com/b' ]
    );

    assert.equal(
        normalizeCurlText('curl \\\n  "https://example.com"'),
        'curl "https://example.com"'
    );

    assert.equal(extractJzbFromCurl('curl https://example.com/no-jzb-here'), null);

    const loadPayload = await decodeJzb(LOAD_JZB);
    assert.equal(loadPayload[0].type, 'load');
    assert.equal(loadPayload[0].visitor_id, '_PENDO_T_PkpqxyBe1KF');

    const guideCurl = `curl --url 'https://app.pendo.io/data/guide.js/50ff22c7-59c1-450a-68d3-f097e9eaa74c?id=37&jzb=${GUIDE_JZB}&v=2.341.0_prod-io'`;
    assert.equal(extractJzbFromCurl(guideCurl), GUIDE_JZB);

    const guidePayload = await decodeJzb(GUIDE_JZB);
    const guideSummary = summarizePayload(guidePayload);
    assert.equal(guideSummary.length, 1);
    assert.equal(guideSummary[0].type, undefined);
    assert.equal(guideSummary[0].visitorId, '_PENDO_T_PkpqxyBe1KF');
    assert.equal(
        buildRequestLabel(guideSummary, 'https://app.pendo.io/data/guide.js/50ff22c7-59c1-450a-68d3-f097e9eaa74c'),
        'guide.js/50ff22c7-59c1-450a-68d3-f097e9eaa74c'
    );

    assert.deepEqual(summarizePayload(null), []);
    assert.deepEqual(summarizePayload(undefined), []);
    const sparseSummary = summarizePayload([ null, { type: 'keep' } ]);
    assert.equal(sparseSummary.length, 1);
    assert.equal(sparseSummary[0].type, 'keep');
    assert.equal(sparseSummary[0].eventCount, 2);
    const singleSummary = summarizePayload({ type: 'single' });
    assert.equal(singleSummary.length, 1);
    assert.equal(singleSummary[0].type, 'single');
    assert.equal(singleSummary[0].eventCount, 1);

    const trackSummary = summarizePayload(payload);
    assert.equal(trackSummary[0].trackEventName, 'Object Analytics - Object created');
    assert.equal(trackSummary[0].visitorId, 'ravidor@pendo.io');
    assert.equal(trackSummary[0].eventCount, payload.length);

    const camelSummary = summarizePayload({
        trackEventName: 'Camel Event',
        visitorId: 'visitor-1',
        accountId: 'account-1',
        metadata: {
            visitor: { id: 'metadata-visitor' },
            account: { id: 'metadata-account' }
        }
    });
    assert.equal(camelSummary[0].trackEventName, 'Camel Event');
    assert.equal(camelSummary[0].visitorId, 'visitor-1');
    assert.equal(camelSummary[0].accountId, 'account-1');

    const metadataSummary = summarizePayload({
        metadata: {
            visitor: { id: 'metadata-visitor' },
            account: { id: 'metadata-account' }
        }
    });
    assert.equal(metadataSummary[0].visitorId, 'metadata-visitor');
    assert.equal(metadataSummary[0].accountId, 'metadata-account');

    assert.equal(
        buildRequestLabel(trackSummary, url),
        'Object Analytics - Object created'
    );
    assert.equal(buildRequestLabel([ { type: 'load' } ], url), 'load');
    assert.equal(buildRequestLabel([], 'not-a-url'), 'not-a-url');

    const segmentFlagCurl = `curl --url 'https://app.pendo.io/data/segmentflag.js/50ff22c7-59c1-450a-68d3-f097e9eaa74c?id=34&jzb=${SEGMENTFLAG_JZB}&v=2.341.0_prod-io&ct=1789649537575'`;
    assert.equal(extractJzbFromCurl(segmentFlagCurl), SEGMENTFLAG_JZB);

    const segmentFlagPayload = await decodeJzb(SEGMENTFLAG_JZB);
    const segmentFlagSummary = summarizePayload(segmentFlagPayload);
    assert.equal(segmentFlagSummary.length, 1);
    assert.equal(segmentFlagSummary[0].visitorId, '_PENDO_T_PkpqxyBe1KF');

    const segmentFlagItem = buildCapturedItem({
        requestUrl: 'https://app.pendo.io/data/segmentflag.js/50ff22c7-59c1-450a-68d3-f097e9eaa74c?id=34',
        method: 'PASTE',
        payload: segmentFlagPayload,
        jzb: SEGMENTFLAG_JZB,
        id: 'segment-flag-item',
        capturedAt: 1_700_000_000_000
    });
    assert.equal(segmentFlagItem.id, 'segment-flag-item');
    assert.equal(segmentFlagItem.capturedAt, 1_700_000_000_000);
    assert.equal(segmentFlagItem.jzbLength, SEGMENTFLAG_JZB.length);
    assert.equal(segmentFlagItem.method, 'PASTE');
    assert.equal(segmentFlagItem.summary.length, 1);
    assert.equal(segmentFlagItem.error, null);

    const searchItem = buildCapturedItem({
        requestUrl: 'https://example.com/beacon',
        method: 'GET',
        payload: payload,
        jzb: SAMPLE_JZB
    });
    assert.equal(matchesCapturedRequestSearch(searchItem, ''), true);
    assert.equal(matchesCapturedRequestSearch(searchItem, 'object analytics'), true);
    assert.equal(matchesCapturedRequestSearch(searchItem, 'ravidor@pendo.io'), true);
    assert.equal(matchesCapturedRequestSearch(searchItem, 'missing-value'), false);
    assert.equal(matchesCapturedRequestSearch(searchItem, 'OBJECT ANALYTICS'), true);

    assert.match(formatTimestamp(1_700_000_000_000), /\d/);
    assert.match(formatTimestamp(1_700_000_000_000, { timeOnly: true }), /\d/);
    assert.equal(formatTimestamp(''), '');
    assert.equal(formatTimestamp(null), '');

    const errorItem = buildErrorCapturedItem({
        requestUrl: 'https://example.com/beacon?jzb=bad',
        method: 'GET',
        error: new Error('decode failed')
    });
    assert.equal(errorItem.label, 'Decode failed');
    assert.equal(errorItem.error, 'decode failed');
    assert.equal(errorItem.payload, null);
    assert.equal(formatError(new Error('boom')), 'boom');

    const cappedItems = [
        { id: 'new', capturedAt: 2 },
        { id: 'old', capturedAt: 1 }
    ];
    trimCapturedRequestArray(cappedItems, 1);
    assert.equal(cappedItems.length, 1);
    assert.equal(cappedItems[0].id, 'new');

    const cappedMap = new Map([
        [ 'old', { id: 'old', capturedAt: 1 } ],
        [ 'new', { id: 'new', capturedAt: 2 } ]
    ]);
    trimCapturedRequestMap(cappedMap, 1);
    assert.equal(cappedMap.size, 1);
    assert.equal(cappedMap.has('new'), true);

    const unchangedMap = new Map([
        [ 'only', { id: 'only', capturedAt: 1 } ]
    ]);
    trimCapturedRequestMap(unchangedMap, MAX_CAPTURED_REQUESTS);
    assert.equal(unchangedMap.size, 1);

    const highlighted = highlightJson(payload);
    assert.match(highlighted, /<span class="json-key">&quot;track_event_name&quot;<\/span>/);
    assert.match(highlighted, /<span class="json-value json-value-visitor_id">/);
    assert.match(highlighted, /<span class="json-value json-value-type">/);
    assert.match(highlighted, /&quot;Object Analytics - Object created&quot;/);
    assert.doesNotMatch(highlighted, /<span class="json-key">&quot;sequence&quot;<\/span>/);

    const malicious = [ { track_event_name: '<img onerror=alert(1) src=x>' } ];
    const maliciousHtml = highlightJson(malicious);
    assert.ok(!maliciousHtml.includes('<img'));
    assert.ok(maliciousHtml.includes('&lt;'));
    assert.ok(maliciousHtml.includes('&quot;'));

    const plainLine = highlightJson({ sequence: 1 });
    assert.ok(!plainLine.includes('<span class="json-key">'));
    assert.ok(plainLine.includes('sequence'));

    assert.equal(formatError('plain failure'), 'plain failure');

    assert.deepEqual(
        extractJzbSourceFromCurl(`?jzb=${SAMPLE_JZB}`),
        { jzb: SAMPLE_JZB, requestUrl: '(pasted curl)' }
    );

    assert.deepEqual(
        extractJzbSourceFromCurl('?jzb=%'),
        { jzb: '%', requestUrl: '(pasted curl)' }
    );

    const singleQuotedUrlCurl = `curl --url '${`https://example.com/beacon?jzb=${SAMPLE_JZB}`}'`;
    assert.equal(extractJzbFromCurl(singleQuotedUrlCurl), SAMPLE_JZB);

    await assert.rejects(() => decodeJzb(toBase64Url(Buffer.from([ 0x00, 0x01, 0x02, 0x03, 0x04 ]))));
    await assert.rejects(() => decodeJzb(buildDeflatedJzb('not-json')));

    const originalToLocaleString = Date.prototype.toLocaleString;
    Date.prototype.toLocaleString = () => {
        throw new Error('locale unavailable');
    };
    assert.equal(formatTimestamp(1), '1');
    Date.prototype.toLocaleString = originalToLocaleString;

    const bytes = base64UrlToBytes(SAMPLE_JZB);
    assert.ok(bytes instanceof Uint8Array);

    assert.throws(
        () => base64UrlToBytes('a'.repeat(MAX_JZB_BASE64_LENGTH + 1)),
        /exceeds maximum allowed size/
    );

    assert.equal(extractJzbSourceFromCurl('a'.repeat(MAX_CURL_TEXT_LENGTH + 1)), null);
    assert.equal(isCurlTextTooLarge('a'.repeat(MAX_CURL_TEXT_LENGTH + 1)), true);
    assert.equal(isCurlTextTooLarge('a'.repeat(MAX_CURL_TEXT_LENGTH)), false);
    assert.match(getCurlTextTooLargeError(), /512 KB/);

    assert.equal(isCapturedItem(searchItem), true);
    assert.equal(isCapturedItem(errorItem), true);
    assert.equal(isCapturedItem(null), false);
    assert.equal(isCapturedItem({ id: 'x' }), false);
    assert.equal(isCapturedItem({
        id: '',
        requestUrl: 'https://example.com',
        method: 'GET',
        capturedAt: 1,
        label: 'test',
        summary: [],
        payload: {}
    }), false);
    assert.equal(isCapturedItem({
        id: 'x',
        requestUrl: 123,
        method: 'GET',
        capturedAt: 1,
        label: 'test',
        summary: [],
        payload: {}
    }), false);
    assert.equal(isCapturedItem({
        id: 'x',
        requestUrl: 'https://example.com',
        method: null,
        capturedAt: 1,
        label: 'test',
        summary: [],
        payload: {}
    }), false);
    assert.equal(isCapturedItem({
        id: 'x',
        requestUrl: 'https://example.com',
        method: 'GET',
        capturedAt: 1,
        label: 'test',
        summary: [],
        error: 'failed'
    }), true);
    assert.equal(isCapturedItem({
        id: 'x',
        requestUrl: 'https://example.com',
        method: 'GET',
        capturedAt: 1,
        label: 'test',
        summary: [],
        payload: {},
        error: null
    }), true);
    assert.equal(isCapturedItem({ id: 'x', error: 1 }), false);
    assert.equal(isCapturedItem({
        id: 'x',
        requestUrl: 'https://example.com',
        method: 'GET',
        capturedAt: 1,
        label: 'test',
        summary: [],
        error: false
    }), false);
    assert.equal(isCapturedItem({
        id: 'x',
        requestUrl: 'https://example.com',
        method: 'GET',
        capturedAt: Number.NaN,
        label: 'test',
        summary: []
    }), false);
    assert.equal(isCapturedItem({
        id: 'x',
        requestUrl: 'https://example.com',
        method: 'GET',
        capturedAt: 1,
        label: 1,
        summary: []
    }), false);
    assert.equal(isCapturedItem({
        id: 'x',
        requestUrl: 'https://example.com',
        method: 'GET',
        capturedAt: 1,
        label: 'test',
        summary: 'not-array'
    }), false);
    assert.equal(isCapturedItem({
        id: 'x',
        requestUrl: 'https://example.com',
        method: 'GET',
        capturedAt: 1,
        label: 'test',
        summary: [],
        error: null
    }), false);

    const compressedAtLimit = toBase64Url(Buffer.alloc(MAX_COMPRESSED_BYTES, 1));
    assert.equal(base64UrlToBytes(compressedAtLimit).length, MAX_COMPRESSED_BYTES);
    assert.throws(
        () => base64UrlToBytes(toBase64Url(Buffer.alloc(MAX_COMPRESSED_BYTES + 1, 1))),
        /exceeds maximum allowed size/
    );

    const decompressedAtLimit = buildDeflatedJzb(JSON.stringify('a'.repeat(MAX_DECOMPRESSED_CHARS - 2)));
    await decodeJzb(decompressedAtLimit);
    await assert.rejects(
        () => decodeJzb(buildDeflatedJzb(JSON.stringify('a'.repeat(MAX_DECOMPRESSED_CHARS - 1)))),
        /Decompressed jzb payload exceeds maximum allowed size/
    );

    console.log('jzb decoder tests passed');
}

module.exports = runJzbTests;

if (require.main === module) {
    runJzbTests().catch((error) => {
        console.error(error);
        process.exit(1);
    });
}
