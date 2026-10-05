const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const AdmZip = require('adm-zip');
const {
  packageMediaSource,
  parsePackageMediaSource,
  readCharacterPackage,
  writeCharacterPackage,
} = require('./character-package');

function createFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'doudou-character-package-'));
  const imagePath = path.join(root, 'main.png');
  fs.writeFileSync(imagePath, Buffer.from('fake-png-for-container-test'));
  const outputPath = path.join(root, '测试角色.doudoupet');
  const profile = {
    identity: { id: 'test-role', name: '测试角色', category: 'pet' },
    appearance: { mainImageSource: packageMediaSource('001-main.png') },
    userSkills: [],
  };
  return { root, imagePath, outputPath, profile };
}

test('writes and reads a verified character package', () => {
  const fixture = createFixture();
  try {
    writeCharacterPackage({
      outputPath: fixture.outputPath,
      appVersion: '0.9.0',
      role: { id: 'test-role', name: '测试角色', category: 'pet' },
      profile: fixture.profile,
      mediaFiles: [{ name: '001-main.png', path: fixture.imagePath }],
    });
    const result = readCharacterPackage(fixture.outputPath);
    assert.equal(result.manifest.role.name, '测试角色');
    assert.equal(result.mediaFiles.length, 1);
    assert.equal(result.profile.appearance.mainImageSource, 'package://media/001-main.png');
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('rejects executable files even when placed in media', () => {
  const fixture = createFixture();
  try {
    const zip = new AdmZip();
    zip.addFile('manifest.json', Buffer.from(JSON.stringify({
      format: 'doudou-character-package',
      packageVersion: 1,
      role: { name: '测试', category: 'pet' },
      files: [],
    })));
    zip.addFile('profile.json', Buffer.from('{}'));
    zip.addFile('media/run.exe', Buffer.from('MZ'));
    zip.writeZip(fixture.outputPath);
    assert.throws(() => readCharacterPackage(fixture.outputPath), /不支持|不允许/);
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('parses only safe package media references', () => {
  assert.equal(parsePackageMediaSource('package://media/001-main.png'), '001-main.png');
  assert.equal(parsePackageMediaSource('package://media/../run.exe'), null);
  assert.equal(parsePackageMediaSource('pet://media/test/main.png'), null);
});
