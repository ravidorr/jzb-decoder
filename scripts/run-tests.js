#!/usr/bin/env node

const runJzbTests = require('../jzb.test.js');
const runDevtoolsTests = require('../devtools.test.js');
const runPanelTests = require('../panel.test.js');

async function runSuite (suiteFn) {
    const tests = [];

    await suiteFn.call({
        test (name, fn) {
            tests.push({ name, fn });
        }
    });

    for (const { name, fn } of tests) {
        try {
            await fn();
        } catch (error) {
            error.message = `${name}: ${error.message}`;
            throw error;
        }
    }
}

async function runAllTests () {
    await runJzbTests();
    await runSuite(runDevtoolsTests);
    await runSuite(runPanelTests);
}

runAllTests().catch((error) => {
    console.error(error);
    process.exit(1);
});
