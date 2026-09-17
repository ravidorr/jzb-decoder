const path = require('path');

function createClassList () {
    const classes = new Set();

    return {
        add (className) {
            classes.add(className);
        },
        remove (className) {
            classes.delete(className);
        },
        toggle (className) {
            if (classes.has(className)) {
                classes.delete(className);
                return false;
            }

            classes.add(className);
            return true;
        },
        contains (className) {
            return classes.has(className);
        },
        clear () {
            classes.clear();
        }
    };
}

function createElement (id, tag = 'div') {
    const classList = createClassList();
    const element = {
        id,
        tagName: tag.toUpperCase(),
        classList,
        dataset: {},
        style: {
            _props: {},
            setProperty (name, value) {
                this._props[ name ] = value;
            },
            getPropertyValue (name) {
                return this._props[ name ] ?? '';
            }
        },
        textContent: '',
        innerHTML: '',
        value: '',
        children: [],
        disabled: false,
        _attrs: {},
        _listeners: {},
        _parent: null,
        append (...nodes) {
            nodes.forEach((node) => this.appendChild(node));
        },
        appendChild (node) {
            if (node._parent && node._parent !== this) {
                node.remove();
            }

            this.children.push(node);
            node._parent = this;
            return node;
        },
        setAttribute (name, value) {
            this._attrs[ name ] = value;
        },
        getAttribute (name) {
            return this._attrs[ name ] ?? null;
        },
        focus () {},
        select () {},
        remove () {
            if (!this._parent) {
                return;
            }

            this._parent.children = this._parent.children.filter((child) => child !== this);
            this._parent = null;
        },
        addEventListener (type, listener) {
            if (!this._listeners[ type ]) {
                this._listeners[ type ] = [];
            }

            this._listeners[ type ].push(listener);
        },
        click (event = {}) {
            (this._listeners.click || []).forEach((listener) => listener(event));
        },
        dispatchEvent (event) {
            const type = event.type || event;
            (this._listeners[ type ] || []).forEach((listener) => listener(event));
        }
    };

    Object.defineProperty(element, 'className', {
        get () {
            return [ ...classList ].join(' ');
        },
        set (value) {
            classList.clear();
            String(value).split(/\s+/).filter(Boolean).forEach((className) => classList.add(className));
        }
    });

    return element;
}

function matchesSelector (element, selector) {
    if (selector === '.request-item') {
        return element.classList.contains('request-item');
    }

    if (selector === '.filter-empty') {
        return element.classList.contains('filter-empty');
    }

    if (selector.startsWith('.request-item[data-id="')) {
        const id = selector.slice('.request-item[data-id="'.length, -2);
        return element.classList.contains('request-item') && element.dataset.id === id;
    }

    if (selector === '.layout') {
        return element.classList.contains('layout');
    }

    return false;
}

function querySelectorAll (root, selector) {
    const matches = [];
    const seen = new Set();
    const selectors = selector.split(',').map((part) => part.trim()).filter(Boolean);

    function walk (node, singleSelector) {
        if (matchesSelector(node, singleSelector) && !seen.has(node)) {
            seen.add(node);
            matches.push(node);
        }

        (node.children || []).forEach((child) => walk(child, singleSelector));
    }

    selectors.forEach((singleSelector) => walk(root, singleSelector));
    return matches;
}

function querySelector (root, selector) {
    return querySelectorAll(root, selector)[ 0 ] ?? null;
}

function createDom ({ execCommandImpl } = {}) {
    const elements = {
        'request-list': createElement('request-list'),
        'empty-state': createElement('empty-state'),
        'detail-empty': createElement('detail-empty'),
        'detail-content': createElement('detail-content'),
        'detail-meta': createElement('detail-meta'),
        'detail-json': createElement('detail-json', 'pre'),
        'paste-panel': createElement('paste-panel'),
        'paste-toggle': createElement('paste-toggle', 'button'),
        'paste-error': createElement('paste-error'),
        'paste-hint': createElement('paste-hint'),
        'curl-input': createElement('curl-input', 'textarea'),
        search: createElement('search', 'input'),
        'copy-json': createElement('copy-json', 'button'),
        'copy-status': createElement('copy-status'),
        'layout-resizer': createElement('layout-resizer'),
        'clear-requests': createElement('clear-requests', 'button'),
        'decode-curl': createElement('decode-curl', 'button'),
        'clear-curl': createElement('clear-curl', 'button')
    };

    elements[ 'paste-panel' ].classList.add('hidden');
    elements[ 'detail-content' ].classList.add('hidden');
    elements[ 'copy-status' ].classList.add('hidden');
    elements[ 'paste-error' ].classList.add('hidden');
    elements[ 'paste-hint' ].classList.add('hidden');

    const layoutEl = createElement('layout');
    layoutEl.classList.add('layout');

    const documentListeners = {};
    const windowListeners = {};
    let execCommand = execCommandImpl || (() => false);

    function addListener (listeners, type, listener) {
        if (!listeners[ type ]) {
            listeners[ type ] = [];
        }

        listeners[ type ].push(listener);
    }

    function removeListener (listeners, type, listener) {
        if (!listeners[ type ]) {
            return;
        }

        listeners[ type ] = listeners[ type ].filter((registered) => registered !== listener);
    }

    const document = {
        documentElement: { dataset: {} },
        body: {
            classList: createClassList(),
            appendChild () {},
            removeChild () {}
        },
        getElementById (id) {
            return elements[ id ] || null;
        },
        querySelector (selector) {
            if (selector === '.layout') {
                return layoutEl;
            }

            return null;
        },
        createElement (tag) {
            return createElement(tag, tag);
        },
        execCommand (command) {
            return execCommand(command);
        },
        addEventListener (type, listener) {
            addListener(documentListeners, type, listener);
        },
        removeEventListener (type, listener) {
            removeListener(documentListeners, type, listener);
        }
    };

    const window = {
        innerWidth: 1200,
        addEventListener (type, listener) {
            windowListeners[ type ] = listener;
        },
        dispatchEvent (type) {
            windowListeners[ type ]?.({});
        }
    };

    global.window = window;

    const localStorage = {
        _values: {},
        getItem (key) {
            return this._values[ key ] ?? null;
        },
        setItem (key, value) {
            this._values[ key ] = String(value);
        }
    };

    return {
        elements,
        layoutEl,
        document,
        window,
        localStorage,
        querySelectorAll,
        querySelector,
        setExecCommand (impl) {
            execCommand = impl;
        },
        triggerDocumentEvent (type, event = {}) {
            (documentListeners[ type ] || []).forEach((listener) => listener(event));
        }
    };
}

function createMockPort (name = 'jzb-panel', { throwOnPost = false } = {}) {
    let messageListener = null;
    let disconnectListener = null;
    const messages = [];

    return {
        name,
        messages,
        postMessage (message) {
            if (throwOnPost) {
                throw new Error('postMessage failed');
            }

            messages.push(message);
        },
        onMessage: {
            addListener (listener) {
                messageListener = listener;
            }
        },
        onDisconnect: {
            addListener (listener) {
                disconnectListener = listener;
            }
        },
        async send (message) {
            if (messageListener) {
                await messageListener(message);
            }
        },
        disconnect () {
            disconnectListener?.();
        }
    };
}

function createChromeMock ({ themeApi = 'chrome' } = {}) {
    const connectListeners = [];
    const networkListeners = [];
    let themeChangeHandler = null;
    const themeChangedListeners = [];

    const panels = {
        themeName: 'default',
        create () {},
        onThemeChanged: {
            addListener (listener) {
                themeChangedListeners.push(listener);
            }
        }
    };

    if (themeApi === 'chrome') {
        panels.setThemeChangeHandler = (handler) => {
            themeChangeHandler = handler;
        };
    }

    const chrome = {
        devtools: {
            panels,
            network: {
                onRequestFinished: {
                    addListener (listener) {
                        networkListeners.push(listener);
                    }
                }
            }
        },
        runtime: {
            onConnect: {
                addListener (listener) {
                    connectListeners.push(listener);
                }
            },
            connect () {
                throw new Error('chrome.runtime.connect must be overridden for panel tests');
            }
        }
    };

    return {
        chrome,
        connectListeners,
        networkListeners,
        triggerThemeChange (theme) {
            if (themeChangeHandler) {
                themeChangeHandler(theme);
                return;
            }

            for (const listener of themeChangedListeners) {
                listener(theme);
            }
        }
    };
}

function resetExtensionModules () {
    delete global.JzbDecoder;
    delete require.cache[ require.resolve(path.join(__dirname, '..', 'jzb.js')) ];
    delete require.cache[ require.resolve(path.join(__dirname, '..', 'devtools.js')) ];
    delete require.cache[ require.resolve(path.join(__dirname, '..', 'panel.js')) ];
}

function loadJzbDecoder () {
    global.self = global;
    require(path.join(__dirname, '..', 'jzb.js'));
    return global.JzbDecoder;
}

function loadDevtools () {
    const harness = createChromeMock();
    global.chrome = harness.chrome;
    loadJzbDecoder();
    require(path.join(__dirname, '..', 'devtools.js'));

    return harness;
}

function loadPanel ({ execCommandImpl, localStorageValues, themeApi } = {}) {
    const harness = createChromeMock({ themeApi });
    const dom = createDom({ execCommandImpl });
    const panelPort = createMockPort('jzb-panel');
    const postedToDevtools = [];

    if (localStorageValues) {
        Object.entries(localStorageValues).forEach(([ key, value ]) => {
            dom.localStorage.setItem(key, String(value));
        });
    }

    panelPort.postMessage = (message) => {
        postedToDevtools.push(message);
    };

    harness.chrome.runtime.connect = () => panelPort;
    global.chrome = harness.chrome;
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
    require(path.join(__dirname, '..', 'panel.js'));

    dom.elements[ 'request-list' ].querySelectorAll = (selector) => querySelectorAll(dom.elements[ 'request-list' ], selector);
    dom.elements[ 'request-list' ].querySelector = (selector) => querySelector(dom.elements[ 'request-list' ], selector);

    return {
        dom,
        panelPort,
        postedToDevtools,
        triggerThemeChange: harness.triggerThemeChange
    };
}

module.exports = {
    createMockPort,
    createChromeMock,
    createDom,
    resetExtensionModules,
    loadJzbDecoder,
    loadDevtools,
    loadPanel
};
