#!/usr/bin/env node

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const COVERAGE_FILE = path.join(ROOT, 'coverage', 'coverage-summary.json');
const COVERAGE_FILES = [
    'jzb.js',
    'panel.js',
    'devtools.js'
];
const METRICS = [ 'statements', 'branches', 'functions', 'lines' ];
const MIN_COVERAGE = 90;

function runCoverage () {
    const c8Bin = path.join(ROOT, 'node_modules', 'c8', 'bin', 'c8.js');
    const result = spawnSync(
        process.execPath,
        [
            c8Bin,
            '--config',
            path.join(ROOT, '.c8rc.json'),
            'node',
            path.join(ROOT, 'scripts', 'run-tests.js')
        ],
        {
            cwd: ROOT,
            stdio: 'inherit',
            env: {
                ...process.env,
                FORCE_COLOR: '1'
            }
        }
    );

    if (result.status !== 0) {
        process.exit(result.status ?? 1);
    }
}

function checkCoverageThresholds () {
    if (!fs.existsSync(COVERAGE_FILE)) {
        console.error(`Coverage summary not found at ${COVERAGE_FILE}`);
        process.exit(1);
    }

    const summary = JSON.parse(fs.readFileSync(COVERAGE_FILE, 'utf8'));
    const failures = [];

    for (const file of COVERAGE_FILES) {
        const metrics = summary[ path.join(ROOT, file) ] || summary[ file ];

        if (!metrics) {
            failures.push(`${file}: missing from coverage summary`);
            continue;
        }

        for (const metric of METRICS) {
            const pct = metrics[ metric ]?.pct;

            if (typeof pct !== 'number' || pct < MIN_COVERAGE) {
                failures.push(`${file}: ${metric} ${pct ?? 'n/a'}% is below ${MIN_COVERAGE}%`);
            }
        }
    }

    if (failures.length) {
        console.error('Coverage thresholds not met:');
        failures.forEach((failure) => console.error(`- ${failure}`));
        process.exit(1);
    }

    console.log(`Coverage check passed: all tracked files are at or above ${MIN_COVERAGE}%`);
}

runCoverage();
checkCoverageThresholds();
