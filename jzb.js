const JzbDecoder = (() => {
    function padBase64Url (jzb) {
        const remainder = jzb.length % 4;

        if (remainder === 1) {
            throw new Error('jzb parameter looks truncated or malformed');
        }

        return jzb + '='.repeat((4 - remainder) % 4);
    }

    function base64UrlToBytes (jzb) {
        if (!jzb) {
            throw new Error('Missing jzb parameter');
        }

        const trimmed = jzb.trim();
        const padded = padBase64Url(trimmed);
        const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
        const binary = atob(base64);

        return Uint8Array.from(binary, (char) => char.charCodeAt(0));
    }

    async function inflateBytes (bytes) {
        const attempts = [
            bytes,
            bytes.slice(2, -4)
        ];

        let lastError;

        for (const attempt of attempts) {
            try {
                const stream = new Blob([ attempt ]).stream().pipeThrough(new DecompressionStream('deflate'));
                const text = await new Response(stream).text();

                return JSON.parse(text);
            } catch (error) {
                lastError = error;
            }
        }

        throw lastError || new Error('Failed to decompress jzb payload');
    }

    async function decodeJzb (jzb) {
        const bytes = base64UrlToBytes(jzb);

        return inflateBytes(bytes);
    }

    function extractJzbFromUrl (url) {
        try {
            const parsed = new URL(url);

            return parsed.searchParams.get('jzb');
        } catch {
            return null;
        }
    }

    function normalizeCurlText (curlText) {
        return curlText
            .replace(/\\\r?\n/g, '')
            .replace(/\r?\n/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function decodeJzbParam (value) {
        if (!value) return null;

        const trimmed = value.replace(/[\\'"`,]+$/g, '').replace(/^[\\'"`,]+/g, '');

        try {
            return decodeURIComponent(trimmed);
        } catch {
            return trimmed;
        }
    }

    function extractJzbFromText (text) {
        if (!text) return null;

        const directMatch = text.match(/[?&]jzb=([^&\s'"\\]+)/);

        if (directMatch) {
            return decodeJzbParam(directMatch[1]);
        }

        return null;
    }

    function unquoteCurlValue (value) {
        if (!value) return value;

        const trimmed = value.trim();

        if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
            (trimmed.startsWith('\'') && trimmed.endsWith('\''))) {
            return trimmed.slice(1, -1);
        }

        return trimmed;
    }

    function extractUrlsFromCurl (curlText) {
        const normalized = normalizeCurlText(curlText);
        const urls = new Set();

        const patterns = [
            /\bcurl\b(?:\s+[^'"]*)?\s+(['"])(https?:\/\/[^'"]+)\1/gi,
            /(?:--url|-url)\s+(['"]?)(https?:\/\/[^\s'"]+)\1/gi,
            /(?:--get|-G)\s+(['"]?)(https?:\/\/[^\s'"]+)\1/gi,
            /(?:^|\s)(['"])(https?:\/\/[^'"]+)\1/g
        ];

        patterns.forEach((pattern) => {
            let match;

            while ((match = pattern.exec(normalized)) !== null) {
                const url = unquoteCurlValue(match[match.length - 1]);

                if (url.startsWith('http')) {
                    urls.add(url);
                }
            }
        });

        return [ ...urls ];
    }

    function extractJzbFromCurl (curlText) {
        if (!curlText) return null;

        const normalized = normalizeCurlText(curlText);
        const direct = extractJzbFromText(normalized);

        if (direct) return direct;

        for (const url of extractUrlsFromCurl(curlText)) {
            const fromUrl = extractJzbFromUrl(url);

            if (fromUrl) return fromUrl;
        }

        return null;
    }

    function summarizePayload (payload) {
        if (payload == null) {
            return [];
        }

        const events = Array.isArray(payload) ? payload : [ payload ];

        return events.filter((event) => event != null).map((event) => ({
            type: event.type,
            trackEventName: event.track_event_name || event.trackEventName,
            visitorId: event.visitor_id || event.visitorId || event.metadata?.visitor?.id,
            accountId: event.account_id || event.accountId || event.metadata?.account?.id,
            browserTime: event.browser_time || event.browserTime,
            url: event.url,
            sequence: event.sequence,
            eventCount: events.length
        }));
    }

    function formatTimestamp (ms) {
        if (!ms) return '';

        try {
            return new Date(ms).toLocaleString();
        } catch {
            return String(ms);
        }
    }

    function buildRequestLabel (summary, requestUrl) {
        const first = summary[0] || {};

        if (first.trackEventName) {
            return first.trackEventName;
        }

        if (first.type) {
            return first.type;
        }

        try {
            const pathname = new URL(requestUrl).pathname;

            return pathname.split('/').filter(Boolean).slice(-2).join('/') || requestUrl;
        } catch {
            return requestUrl;
        }
    }

    function buildCapturedItem ({ requestUrl, method, payload, jzb, id, capturedAt }) {
        const summary = summarizePayload(payload);

        return {
            id: id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            capturedAt: capturedAt || Date.now(),
            requestUrl,
            method,
            jzbLength: jzb.length,
            payload,
            summary,
            label: buildRequestLabel(summary, requestUrl),
            error: null
        };
    }

    const HIGHLIGHT_JSON_KEYS = new Set([
        'track_event_name',
        'props',
        'visitor_id',
        'account_id',
        'type'
    ]);

    function escapeHtml (value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function highlightJson (payload) {
        const json = JSON.stringify(payload, null, 2);

        return json.split('\n').map((line) => {
            const keyMatch = line.match(/^(\s*)("(?:track_event_name|props|visitor_id|account_id|type)")(\s*:\s*)(.*)$/);

            if (!keyMatch) {
                return escapeHtml(line);
            }

            const [ , indent, key, separator, value ] = keyMatch;
            const keyName = key.slice(1, -1);

            if (!HIGHLIGHT_JSON_KEYS.has(keyName)) {
                return escapeHtml(line);
            }

            return `${escapeHtml(indent)}<span class="json-key">${escapeHtml(key)}</span>${escapeHtml(separator)}<span class="json-value json-value-${keyName}">${escapeHtml(value)}</span>`;
        }).join('\n');
    }

    return {
        base64UrlToBytes,
        decodeJzb,
        extractJzbFromUrl,
        extractJzbFromCurl,
        normalizeCurlText,
        extractUrlsFromCurl,
        summarizePayload,
        formatTimestamp,
        buildRequestLabel,
        buildCapturedItem,
        highlightJson
    };
})();

if (typeof self !== 'undefined') {
    self.JzbDecoder = JzbDecoder;
}
