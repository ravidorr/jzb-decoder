const assert = require('assert');
const zlib = require('zlib');

global.self = global;
require('./jzb.js');

const SAMPLE_JZB = 'eJxtU11v2jwU_ivIlwgIJGkakKatG2X9WlvYWlWtqsjYJ8El2OmxE15W8d97HLh4L3aHn_PxfBzy8sHcrgI2YQ65WLMeW6LZWsDMqQ3Bo9N0HKWjNI7G0ajHGmWVM5gpSRPIGyUNfqtASzNQhoa5EKbW7lBv8b7SDlDzkqo1lgSvnKvsJAh4VQ0OLRuzVCX0i1pJsEdMQjMQZhPYIAlP4ugkDcM0SsbxMA3M8g2Es18bQKuM_nJ2f98fJadJMiSOCk1l2eSDSWWrku9uubfB3mvjoKPpMQojaiMm7VSuAGcKSq-27biUVCMRAlXlaDfhcl3m2sreIJe6kIdpMrKoSyCeFxYE3aBUxcpppYsAg7nfE3QbXtbQDbpd9tpjdq2qRw_4CXpnmS2yzKs8BroBxyV33EO8IGlZliu0zgsmDQvONddsv9-TQY5U_8OXpHWi67LsMXd4sFCfzy_VdCbWz9txtJ6S0hxpQ1u8TcZ_0STDmzB82uY__LXak2fQeL4j012bbeeMDrZzSthOv3OEBAJ34POxYH3u7daHKL8p5Nt1MXuKks2vxIfjNt6GWHGtwR98ATkgtv8AbH8CEloot6qX_saMXCEIg5ISbLfGMJ3POLq36-FW3-9cO3ls-P0_9n_0WSg25GdW8sJecLvyGsWof3dz0X84l9o9o3g8aXSmrur_dk_z0F5NF_HPs_e7avi9jNsF7zVoQWHECX0NO-ePdjpO96-fmeoPRQ';

function base64UrlToBytes (jzb) {
    const padded = jzb + '=='.slice((jzb.length + 3) % 4);
    const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');

    return Buffer.from(base64, 'base64');
}

function decodeJzbNode (jzb) {
    const bytes = base64UrlToBytes(jzb);
    const json = zlib.inflateSync(bytes).toString('utf8');

    return JSON.parse(json);
}

(function runTests () {
    const localThis = this;
    const { extractJzbFromUrl, extractJzbFromCurl, normalizeCurlText, extractUrlsFromCurl, highlightJson } = localThis.JzbDecoder;

    const payload = decodeJzbNode(SAMPLE_JZB);

    assert.equal(Array.isArray(payload), true);
    assert.equal(payload[0].type, 'track');
    assert.equal(payload[0].track_event_name, 'Object Analytics - Object created');
    assert.equal(payload[0].visitor_id, 'ravidor@pendo.io');

    const url = `https://data.pendo.io/data/ptm.gif/key?v=1&jzb=${SAMPLE_JZB}`;
    assert.equal(extractJzbFromUrl(url), SAMPLE_JZB);

    const curl = `curl 'https://data.pendo.io/data/ptm.gif/key?jzb=${SAMPLE_JZB}&type=track'`;
    assert.equal(extractJzbFromCurl(curl), SAMPLE_JZB);

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

    assert.deepEqual(
        extractUrlsFromCurl('curl \'https://example.com/a\' --url "https://example.com/b"'),
        [ 'https://example.com/a', 'https://example.com/b' ]
    );

    assert.equal(
        normalizeCurlText('curl \\\n  "https://example.com"'),
        'curl "https://example.com"'
    );

    assert.equal(extractJzbFromCurl('curl https://example.com/no-jzb-here'), null);

    const highlighted = highlightJson(payload);
    assert.match(highlighted, /<span class="json-key">&quot;track_event_name&quot;<\/span>/);
    assert.match(highlighted, /<span class="json-value json-value-visitor_id">/);
    assert.match(highlighted, /&quot;Object Analytics - Object created&quot;/);

    console.log('jzb decoder tests passed');
}).call(global);
