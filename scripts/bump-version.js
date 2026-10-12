const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const bumpType = process.argv[2];

const validTypes = new Set([ 'patch', 'minor', 'major' ]);

if (!validTypes.has(bumpType)) {
    console.error('Usage: node scripts/bump-version.js <patch|minor|major>');
    process.exit(1);
}

function readJson (filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson (filePath, value) {
    fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

const manifestPath = path.join(root, 'manifest.json');
const packagePath = path.join(root, 'package.json');
const manifest = readJson(manifestPath);
const packageJson = readJson(packagePath);
const parts = manifest.version.split('.').map(Number);

if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
    console.error(`Invalid current version: ${manifest.version}`);
    process.exit(1);
}

const [ major, minor, patch ] = parts;
let nextVersion;

switch (bumpType) {
    case 'major':
        nextVersion = `${major + 1}.0.0`;
        break;
    case 'minor':
        nextVersion = `${major}.${minor + 1}.0`;
        break;
    case 'patch':
        nextVersion = `${major}.${minor}.${patch + 1}`;
        break;
    default:
        process.exit(1);
}

manifest.version = nextVersion;
packageJson.version = nextVersion;

writeJson(manifestPath, manifest);
writeJson(packagePath, packageJson);

console.log(`Bumped version to ${nextVersion}`);
console.log('Update CHANGELOG.md before committing the release.');
