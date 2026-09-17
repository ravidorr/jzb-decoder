const js = require('@eslint/js');
const globals = require('globals');
const stylistic = require('@stylistic/eslint-plugin');

const stylisticRules = {
    '@stylistic/indent': [ 'error', 4 ],
    '@stylistic/quotes': [ 'error', 'single' ],
    '@stylistic/semi': [ 'error', 'always' ],
    '@stylistic/space-before-function-paren': [ 'error', 'always' ],
    '@stylistic/comma-dangle': [ 'error', 'never' ],
    '@stylistic/array-bracket-spacing': [ 'error', 'always' ],
    '@stylistic/object-curly-spacing': [ 'error', 'always' ]
};

module.exports = [
    js.configs.recommended,
    {
        ignores: [
            'dist/**',
            'node_modules/**'
        ]
    },
    {
        files: [ 'jzb.js' ],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'script',
            globals: {
                ...globals.browser
            }
        },
        plugins: {
            '@stylistic': stylistic
        },
        rules: {
            ...stylisticRules
        }
    },
    {
        files: [
            'devtools.js',
            'panel.js'
        ],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'script',
            globals: {
                ...globals.browser,
                chrome: 'readonly',
                JzbDecoder: 'readonly'
            }
        },
        plugins: {
            '@stylistic': stylistic
        },
        rules: {
            ...stylisticRules
        }
    },
    {
        files: [
            'scripts/**/*.js',
            'test/**/*.js',
            'eslint.config.js'
        ],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            globals: {
                ...globals.node
            }
        },
        plugins: {
            '@stylistic': stylistic
        },
        rules: {
            ...stylisticRules
        }
    }
];
