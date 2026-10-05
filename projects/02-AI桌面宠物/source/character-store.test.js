const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  MAX_CHARACTERS,
  addRoleMetadata,
  getCharacterRegistrySnapshot,
  getRoleProfilePath,
  initializeCharacterStore,
  removeRoleMetadata,
  setDefaultRole,
  updateRoleMetadata,
} = require('./character-store');

function makeTemporaryUserData() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'doudou-character-store-'));
}

test('first migration keeps the doudou profile and creates a backup plus registry', () => {
  const userDataPath = makeTemporaryUserData();
  const profilePath = getRoleProfilePath(userDataPath, 'doudou');
  fs.mkdirSync(path.dirname(profilePath), { recursive: true });
  fs.writeFileSync(profilePath, '{"appearance":{"scale":1.2}}\n', 'utf8');

  const result = initializeCharacterStore({
    userDataPath,
    roleName: '豆豆',
    now: new Date('2026-07-26T00:00:00.000Z'),
  });

  assert.equal(result.created, true);
  assert.equal(result.index.defaultRoleId, 'doudou');
  assert.equal(result.index.roles.length, 1);
  assert.equal(result.index.roles[0].category, 'pet');
  assert.equal(fs.readFileSync(profilePath, 'utf8'), '{"appearance":{"scale":1.2}}\n');
  assert.ok(result.index.migration.legacyDoudouProfileBackup);
  assert.ok(
    fs.existsSync(
      path.join(
        userDataPath,
        result.index.migration.legacyDoudouProfileBackup.replaceAll('/', path.sep),
      ),
    ),
  );
});

test('later startup reuses the existing index without creating another migration', () => {
  const userDataPath = makeTemporaryUserData();
  const first = initializeCharacterStore({ userDataPath, roleName: '豆豆' });
  const second = initializeCharacterStore({ userDataPath, roleName: '豆豆' });

  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(second.index.defaultRoleId, 'doudou');
});

test('registry snapshot contains metadata only and enforces the 30 role limit', () => {
  const userDataPath = makeTemporaryUserData();
  const initial = initializeCharacterStore({ userDataPath, roleName: '豆豆' });
  const oversized = {
    ...initial.index,
    roles: Array.from({ length: 35 }, (_value, index) => ({
      id: `role-${index + 1}`,
      name: `角色${index + 1}`,
      category: index % 2 === 0 ? 'person' : 'other',
      createdAt: new Date(2026, 0, index + 1).toISOString(),
      updatedAt: new Date(2026, 0, index + 1).toISOString(),
    })),
    defaultRoleId: 'role-31',
  };
  fs.writeFileSync(
    initial.indexPath,
    `${JSON.stringify(oversized, null, 2)}\n`,
    'utf8',
  );

  const reloaded = initializeCharacterStore({ userDataPath, roleName: '豆豆' });
  const snapshot = getCharacterRegistrySnapshot(reloaded.index);

  assert.equal(snapshot.roles.length, MAX_CHARACTERS);
  assert.equal(snapshot.defaultRoleId, snapshot.roles[0].id);
  assert.equal('profile' in snapshot.roles[0], false);
  assert.deepEqual(
    snapshot.categories.map((category) => category.id),
    ['pet', 'person', 'other'],
  );
});

test('a corrupt index is backed up and rebuilt without deleting the profile', () => {
  const userDataPath = makeTemporaryUserData();
  const profilePath = getRoleProfilePath(userDataPath, 'doudou');
  fs.mkdirSync(path.dirname(profilePath), { recursive: true });
  fs.writeFileSync(profilePath, '{"safe":true}\n', 'utf8');
  const first = initializeCharacterStore({ userDataPath, roleName: '豆豆' });
  fs.writeFileSync(first.indexPath, '{broken json', 'utf8');

  const recovered = initializeCharacterStore({
    userDataPath,
    roleName: '豆豆',
    now: new Date('2026-07-26T01:00:00.000Z'),
  });

  assert.equal(recovered.index.defaultRoleId, 'doudou');
  assert.equal(recovered.index.migration.recoveredCorruptIndex, true);
  assert.equal(fs.readFileSync(profilePath, 'utf8'), '{"safe":true}\n');
  assert.ok(
    fs
      .readdirSync(path.dirname(first.indexPath))
      .some((name) => name.startsWith('index.json.corrupt-')),
  );
});

test('role metadata can be created, edited, selected as default, and safely removed', () => {
  const userDataPath = makeTemporaryUserData();
  const { index } = initializeCharacterStore({ userDataPath, roleName: '豆豆' });
  const created = addRoleMetadata(
    index,
    {
      id: 'role-xiaobai',
      name: '小白',
      category: 'pet',
      thumbnail: 'pet://media/role-xiaobai/main.png',
    },
    new Date('2026-07-26T02:00:00.000Z'),
  );
  assert.equal(created.name, '小白');
  assert.equal(index.roles.length, 2);

  updateRoleMetadata(
    index,
    'role-xiaobai',
    { name: '小白白', category: 'other' },
    new Date('2026-07-26T03:00:00.000Z'),
  );
  assert.equal(created.name, '小白白');
  assert.equal(created.category, 'other');

  setDefaultRole(index, 'role-xiaobai');
  assert.equal(index.defaultRoleId, 'role-xiaobai');
  assert.throws(() => removeRoleMetadata(index, 'role-xiaobai'), /default/i);

  setDefaultRole(index, 'doudou');
  const removed = removeRoleMetadata(index, 'role-xiaobai');
  assert.equal(removed.id, 'role-xiaobai');
  assert.equal(index.roles.length, 1);
});

test('role limit, duplicate ids, and last-role deletion are protected', () => {
  const userDataPath = makeTemporaryUserData();
  const { index } = initializeCharacterStore({ userDataPath, roleName: '豆豆' });
  assert.throws(
    () => addRoleMetadata(index, { id: 'doudou', name: '重复豆豆', category: 'pet' }),
    /exists/i,
  );
  assert.throws(() => removeRoleMetadata(index, 'doudou'), /last/i);
  for (let position = 1; position < MAX_CHARACTERS; position += 1) {
    addRoleMetadata(index, {
      id: `role-${position}`,
      name: `角色${position}`,
      category: 'other',
    });
  }
  assert.throws(
    () => addRoleMetadata(index, { id: 'role-overflow', name: '超限', category: 'other' }),
    /limit/i,
  );
});
