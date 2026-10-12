const zlib = require('zlib');

const SAMPLE_JZB = 'eJxtU11v2jwU_ivIlwgIJGkakKatG2X9WlvYWlWtqsjYJ8El2OmxE15W8d97HLh4L3aHn_PxfBzy8sHcrgI2YQ65WLMeW6LZWsDMqQ3Bo9N0HKWjNI7G0ajHGmWVM5gpSRPIGyUNfqtASzNQhoa5EKbW7lBv8b7SDlDzkqo1lgSvnKvsJAh4VQ0OLRuzVCX0i1pJsEdMQjMQZhPYIAlP4ugkDcM0SsbxMA3M8g2Es18bQKuM_nJ2f98fJadJMiSOCk1l2eSDSWWrku9uubfB3mvjoKPpMQojaiMm7VSuAGcKSq-27biUVCMRAlXlaDfhcl3m2sreIJe6kIdpMrKoSyCeFxYE3aBUxcpppYsAg7nfE3QbXtbQDbpd9tpjdq2qRw_4CXpnmS2yzKs8BroBxyV33EO8IGlZliu0zgsmDQvONddsv9-TQY5U_8OXpHWi67LsMXd4sFCfzy_VdCbWz9txtJ6S0hxpQ1u8TcZ_0STDmzB82uY__LXak2fQeL4j012bbeeMDrZzSthOv3OEBAJ34POxYH3u7daHKL8p5Nt1MXuKks2vxIfjNt6GWHGtwR98ATkgtv8AbH8CEloot6qX_saMXCEIg5ISbLfGMJ3POLq36-FW3-9cO3ls-P0_9n_0WSg25GdW8sJecLvyGsWof3dz0X84l9o9o3g8aXSmrur_dk_z0F5NF_HPs_e7avi9jNsF7zVoQWHECX0NO-ePdjpO96-fmeoPRQ';

function toBase64Url (buffer) {
    return buffer
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
}

function buildWrappedJzb (payload) {
    const deflated = zlib.deflateSync(JSON.stringify(payload));
    const wrapped = Buffer.concat([
        Buffer.from([ 0x78, 0x01 ]),
        deflated,
        Buffer.from([ 0, 0, 0, 0 ])
    ]);

    return toBase64Url(wrapped);
}

function buildDeflatedJzb (text) {
    return toBase64Url(zlib.deflateSync(Buffer.from(text, 'utf8')));
}

function buildSampleCurl (jzb = SAMPLE_JZB) {
    return `curl 'https://example.com/beacon?jzb=${jzb}&type=track'`;
}

module.exports = {
    SAMPLE_JZB,
    toBase64Url,
    buildWrappedJzb,
    buildDeflatedJzb,
    buildSampleCurl
};
