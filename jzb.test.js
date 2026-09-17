const assert = require('assert');
const zlib = require('zlib');

global.self = global;
require('./jzb.js');

const SAMPLE_JZB = 'eJxtU11v2jwU_ivIlwgIJGkakKatG2X9WlvYWlWtqsjYJ8El2OmxE15W8d97HLh4L3aHn_PxfBzy8sHcrgI2YQ65WLMeW6LZWsDMqQ3Bo9N0HKWjNI7G0ajHGmWVM5gpSRPIGyUNfqtASzNQhoa5EKbW7lBv8b7SDlDzkqo1lgSvnKvsJAh4VQ0OLRuzVCX0i1pJsEdMQjMQZhPYIAlP4ugkDcM0SsbxMA3M8g2Es18bQKuM_nJ2f98fJadJMiSOCk1l2eSDSWWrku9uubfB3mvjoKPpMQojaiMm7VSuAGcKSq-27biUVCMRAlXlaDfhcl3m2sreIJe6kIdpMrKoSyCeFxYE3aBUxcpppYsAg7nfE3QbXtbQDbpd9tpjdq2qRw_4CXpnmS2yzKs8BroBxyV33EO8IGlZliu0zgsmDQvONddsv9-TQY5U_8OXpHWi67LsMXd4sFCfzy_VdCbWz9txtJ6S0hxpQ1u8TcZ_0STDmzB82uY__LXak2fQeL4j012bbeeMDrZzSthOv3OEBAJ34POxYH3u7daHKL8p5Nt1MXuKks2vxIfjNt6GWHGtwR98ATkgtv8AbH8CEloot6qX_saMXCEIg5ISbLfGMJ3POLq36-FW3-9cO3ls-P0_9n_0WSg25GdW8sJecLvyGsWof3dz0X84l9o9o3g8aXSmrur_dk_z0F5NF_HPs_e7avi9jNsF7zVoQWHECX0NO-ePdjpO96-fmeoPRQ';
const GUIDE_JZB = 'eJx9lNtzokgUh_8XnkOkrzS-4QXviCY4mq0tCgGRgIA0F-PW_O_TZmazVVuEF4o6nvP9vjp2849URzwqs2LmS33JscbmaO28OlacX28fgwAsDOlJcj0vq9Ly0ZJWSfIkVUUius9lmfN-r9c0zXMepH72HGU90Z4l_u4_6O-JMroE9ywN1qcTD0qpLwOmPEmXoHR9t3Sl_pfH4zXqcEncNKzcMBAdQSr9_JL7d-4RJ6q5WwRpqX_9Jkoi6DEF1J6i9aACqaDVQcGjLBVl-IwweFacvMh8OcoeZM_1zoE_qSI_4FL_rz9egMZ0NJxcrenptjThj9yeFXhRLa2t96nHSzt_RPm6yAUqYoxCDAhF4H_ysv0iUv5QhyGDmp9veLM9669XbFmJdTgviXb-nqoRxCDqoo60eHmtt95GX72Hr1VuzIl5HBZob-ptVIURRDWoCd8u6szIqx9yNDAzebLSmONp09C_W-_mmLVRKWQAEkXBKu6irqZH_mEvoomLZ7lrj3E4XczXW2WttVIJpABCSjSVdVFNVLjvo3C3iQ0gp80IurUx4dSdD8etVBUjBSIVgc69vil3cvN0z5i4PnfHpFaafKnT5TtbfftvQRUCDLuoHpm-zdEUGjuTkpqnAb9cNPNufiStrp9UpGIA1C7qeW-EzWq-bhYlg77t83rlHNVw6qxb9_r7vGIqnl3UiFf3wYtdJ9Z5BxoWI7Zno-Npa-qtG2CAEEW4Etx5BuLEm8nxYVTOB8ppvPQGvjPYJWXG1lm7q6ooACNItS5qwWaTRTYfngZvo7v7or-e-MaTHaXS-fd7hUCD4gv1PbUqjld2uA3PkYm3vEny_fV43xjH9SFuo6pClKiaSrtdb2iHdjS-TG26vzX2ZVLr13wIVvLh0Hq3sLheAGOISBv175-_ADJ7z-M';

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
    const {
        extractJzbFromUrl,
        extractJzbFromCurl,
        normalizeCurlText,
        extractUrlsFromCurl,
        summarizePayload,
        buildRequestLabel,
        highlightJson
    } = localThis.JzbDecoder;

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

    const guideCurl = `curl --url 'https://app.pendo.io/data/guide.js/50ff22c7-59c1-450a-68d3-f097e9eaa74c?id=37&jzb=${GUIDE_JZB}&v=2.341.0_prod-io'`;
    assert.equal(extractJzbFromCurl(guideCurl), GUIDE_JZB);

    const guidePayload = decodeJzbNode(GUIDE_JZB);
    const guideSummary = summarizePayload(guidePayload);
    assert.equal(guideSummary.length, 1);
    assert.equal(guideSummary[0].type, 'guide-config');
    assert.equal(guideSummary[0].visitorId, '_PENDO_T_PkpqxyBe1KF');
    assert.equal(guideSummary[0].guideCount, guidePayload.cachedGuides.length);
    assert.equal(
        buildRequestLabel(guideSummary, 'https://app.pendo.io/data/guide.js/50ff22c7-59c1-450a-68d3-f097e9eaa74c'),
        `guide config (${guidePayload.cachedGuides.length} guides)`
    );

    assert.deepEqual(summarizePayload(null), []);
    assert.deepEqual(summarizePayload(undefined), []);

    const highlighted = highlightJson(payload);
    assert.match(highlighted, /<span class="json-key">&quot;track_event_name&quot;<\/span>/);
    assert.match(highlighted, /<span class="json-value json-value-visitor_id">/);
    assert.match(highlighted, /&quot;Object Analytics - Object created&quot;/);

    console.log('jzb decoder tests passed');
}).call(global);
