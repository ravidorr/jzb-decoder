const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const semverPattern = /^\d+\.\d+\.\d+$/;

function readJson (filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function fail (message) {
    console.error(message);
    process.exit(1);
}

const manifest = readJson(path.join(root, 'manifest.json'));
const packageJson = readJson(path.join(root, 'package.json'));

if (!semverPattern.test(manifest.version)) {
    fail(`manifest.json version must use MAJOR.MINOR.PATCH format: ${manifest.version}`);
}

if (!semverPattern.test(packageJson.version)) {
    fail(`package.json version must use MAJOR.MINOR.PATCH format: ${packageJson.version}`);
}

if (manifest.version !== packageJson.version) {
    fail(
        `Version mismatch: manifest.json is ${manifest.version}, package.json is ${packageJson.version}. ` +
        'Run npm run version:patch|minor|major to bump both files together.'
    );
}

const gecko = manifest.browser_specific_settings?.gecko;

if (!gecko?.id) {
    fail('manifest.json must include browser_specific_settings.gecko.id for Firefox AMO publishing.');
}

const dataCollectionPermissions = gecko.data_collection_permissions?.required;

if (!Array.isArray(dataCollectionPermissions) || !dataCollectionPermissions.includes('none')) {
    fail('manifest.json must set browser_specific_settings.gecko.data_collection_permissions.required to include "none".');
}

console.log(`Version check passed: ${manifest.version}`);
