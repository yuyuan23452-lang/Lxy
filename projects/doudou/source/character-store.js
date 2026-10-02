const fs = require('node:fs');
const path = require('node:path');

const CHARACTER_INDEX_SCHEMA_VERSION = 1;
const CHARACTER_PROFILE_SCHEMA_VERSION = 2;
const MAX_CHARACTERS = 30;
const DEFAULT_ROLE_ID = 'doudou';
const CHARACTER_CATEGORIES = Object.freeze([
  { id: 'pet', name: '宠物', order: 10 },
  { id: 'person', name: '人物', order: 20 },
  { id: 'other', name: '其他', order: 30 },
]);
const CATEGORY_IDS = new Set(CHARACTER_CATEGORIES.map((item) => item.id));

function isSafeRoleId(value) {
  return (
    typeof value === 'string' &&
    /^[a-z0-9][a-z0-9_-]{0,63}$/i.test(value)
  );
}

function safeDate(value, fallback) {
  if (typeof value !== 'string') return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

function safeText(value, fallback, maximumLength = 40) {
  const text = typeof value === 'string' ? value.trim() : '';
  return (text || fallback).slice(0, maximumLength);
}

function getCharactersDirectory(userDataPath) {
  return path.join(userDataPath, 'characters');
}

function getCharacterIndexPath(userDataPath) {
  return path.join(getCharactersDirectory(userDataPath), 'index.json');
}

function getRoleDirectoryPath(userDataPath, roleId) {
  if (!isSafeRoleId(roleId)) throw new Error('Invalid role id');
  return path.join(getCharactersDirectory(userDataPath), roleId);
}

function getRoleMediaDirectoryPath(userDataPath, roleId) {
  return path.join(getRoleDirectoryPath(userDataPath, roleId), 'media');
}

function getRoleProfilePath(userDataPath, roleId) {
  return path.join(getRoleDirectoryPath(userDataPath, roleId), 'profile.json');
}

function writeJsonAtomic(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  const backupPath = `${filePath}.bak`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');

  let madeBackup = false;
  try {
    if (fs.existsSync(filePath)) {
      fs.copyFileSync(filePath, backupPath);
      madeBackup = true;
      fs.rmSync(filePath, { force: true });
    }
    fs.renameSync(temporaryPath, filePath);
  } catch (error) {
    fs.rmSync(temporaryPath, { force: true });
    if (!fs.existsSync(filePath) && madeBackup && fs.existsSync(backupPath)) {
      fs.copyFileSync(backupPath, filePath);
    }
    throw error;
  }
}

function normalizeRoleMetadata(role, fallbackTimestamp) {
  if (!role || !isSafeRoleId(role.id)) return null;
  const createdAt = safeDate(role.createdAt, fallbackTimestamp);
  return {
    id: role.id,
    name: safeText(role.name, role.id),
    category: CATEGORY_IDS.has(role.category) ? role.category : 'other',
    thumbnail:
      typeof role.thumbnail === 'string' && role.thumbnail.length <= 260
        ? role.thumbnail
        : null,
    createdAt,
    updatedAt: safeDate(role.updatedAt, createdAt),
    builtIn: role.builtIn === true,
  };
}

function createDoudouMetadata({ roleName, thumbnail, timestamp }) {
  return {
    id: DEFAULT_ROLE_ID,
    name: safeText(roleName, '豆豆'),
    category: 'pet',
    thumbnail: typeof thumbnail === 'string' ? thumbnail : 'assets/dog.png',
    createdAt: timestamp,
    updatedAt: timestamp,
    builtIn: true,
  };
}

function normalizeCharacterIndex(parsed, defaults) {
  const timestamp = defaults.timestamp;
  const seen = new Set();
  const roles = (Array.isArray(parsed?.roles) ? parsed.roles : [])
    .map((role) => normalizeRoleMetadata(role, timestamp))
    .filter((role) => {
      if (!role || seen.has(role.id)) return false;
      seen.add(role.id);
      return true;
    })
    .slice(0, MAX_CHARACTERS);

  if (roles.length === 0) {
    roles.push(createDoudouMetadata(defaults));
  }

  const requestedDefaultRoleId = isSafeRoleId(parsed?.defaultRoleId)
    ? parsed.defaultRoleId
    : null;
  const defaultRoleId = roles.some((role) => role.id === requestedDefaultRoleId)
    ? requestedDefaultRoleId
    : roles[0].id;

  return {
    schemaVersion: CHARACTER_INDEX_SCHEMA_VERSION,
    maxCharacters: MAX_CHARACTERS,
    categories: CHARACTER_CATEGORIES.map((item) => ({ ...item })),
    defaultRoleId,
    roles,
    migration:
      parsed?.migration && typeof parsed.migration === 'object'
        ? { ...parsed.migration }
        : {},
  };
}

function timestampForFileName(date) {
  return date.toISOString().replaceAll(':', '-').replaceAll('.', '-');
}

function backupLegacyProfile(userDataPath, date) {
  const sourcePath = getRoleProfilePath(userDataPath, DEFAULT_ROLE_ID);
  if (!fs.existsSync(sourcePath)) return null;

  const backupDirectory = path.join(
    userDataPath,
    'backups',
    `character-registry-v1-${timestampForFileName(date)}`,
  );
  const backupPath = path.join(backupDirectory, 'doudou-profile.json');
  fs.mkdirSync(backupDirectory, { recursive: true });
  fs.copyFileSync(sourcePath, backupPath, fs.constants.COPYFILE_EXCL);
  return path.relative(userDataPath, backupPath).replaceAll('\\', '/');
}

function initializeCharacterStore({
  userDataPath,
  roleName = '豆豆',
  thumbnail = 'assets/dog.png',
  now = new Date(),
}) {
  const charactersDirectory = getCharactersDirectory(userDataPath);
  const indexPath = getCharacterIndexPath(userDataPath);
  const timestamp = now.toISOString();
  fs.mkdirSync(charactersDirectory, { recursive: true });

  let parsed = null;
  let recoveredCorruptIndex = false;
  if (fs.existsSync(indexPath)) {
    try {
      parsed = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    } catch (_error) {
      const corruptBackupPath = `${indexPath}.corrupt-${timestampForFileName(now)}`;
      fs.copyFileSync(indexPath, corruptBackupPath);
      recoveredCorruptIndex = true;
    }
  }

  const defaults = { roleName, thumbnail, timestamp };
  const index = normalizeCharacterIndex(parsed, defaults);
  let created = false;

  if (!parsed) {
    created = true;
    const profileBackup = backupLegacyProfile(userDataPath, now);
    index.migration = {
      ...index.migration,
      legacyDoudouMigratedAt: timestamp,
      legacyDoudouProfileBackup: profileBackup,
      recoveredCorruptIndex,
    };
  }

  fs.mkdirSync(getRoleMediaDirectoryPath(userDataPath, index.defaultRoleId), {
    recursive: true,
  });
  writeJsonAtomic(indexPath, index);

  return {
    index,
    created,
    indexPath,
    charactersDirectory,
  };
}

function saveCharacterIndex(userDataPath, index) {
  const normalized = normalizeCharacterIndex(index, {
    roleName: '豆豆',
    thumbnail: 'assets/dog.png',
    timestamp: new Date().toISOString(),
  });
  writeJsonAtomic(getCharacterIndexPath(userDataPath), normalized);
  return normalized;
}

function markRoleUpdated(index, roleId, updatedAt = new Date().toISOString()) {
  const role = index.roles.find((item) => item.id === roleId);
  if (role) role.updatedAt = updatedAt;
  return index;
}

function addRoleMetadata(index, role, now = new Date()) {
  if (!index || !Array.isArray(index.roles)) throw new Error('Invalid character index');
  if (index.roles.length >= MAX_CHARACTERS) throw new Error('Character limit reached');
  if (!role || !isSafeRoleId(role.id)) throw new Error('Invalid role id');
  if (index.roles.some((item) => item.id === role.id)) throw new Error('Role already exists');
  const timestamp = now.toISOString();
  const normalized = normalizeRoleMetadata(
    {
      ...role,
      createdAt: role.createdAt || timestamp,
      updatedAt: role.updatedAt || timestamp,
    },
    timestamp,
  );
  if (!normalized) throw new Error('Invalid role metadata');
  index.roles.push(normalized);
  return normalized;
}

function updateRoleMetadata(index, roleId, changes, now = new Date()) {
  if (!index || !Array.isArray(index.roles)) throw new Error('Invalid character index');
  const role = index.roles.find((item) => item.id === roleId);
  if (!role) throw new Error('Role not found');
  if (Object.prototype.hasOwnProperty.call(changes || {}, 'name')) {
    role.name = safeText(changes.name, role.name);
  }
  if (CATEGORY_IDS.has(changes?.category)) role.category = changes.category;
  if (Object.prototype.hasOwnProperty.call(changes || {}, 'thumbnail')) {
    role.thumbnail =
      typeof changes.thumbnail === 'string' && changes.thumbnail.length <= 260
        ? changes.thumbnail
        : null;
  }
  role.updatedAt = now.toISOString();
  return role;
}

function setDefaultRole(index, roleId) {
  if (!index?.roles?.some((role) => role.id === roleId)) {
    throw new Error('Role not found');
  }
  index.defaultRoleId = roleId;
  return index;
}

function removeRoleMetadata(index, roleId) {
  if (!index || !Array.isArray(index.roles)) throw new Error('Invalid character index');
  if (index.roles.length <= 1) throw new Error('Cannot remove the last role');
  if (index.defaultRoleId === roleId) throw new Error('Cannot remove the default role');
  const position = index.roles.findIndex((role) => role.id === roleId);
  if (position < 0) throw new Error('Role not found');
  return index.roles.splice(position, 1)[0];
}

function getCharacterRegistrySnapshot(index) {
  return {
    schemaVersion: index.schemaVersion,
    maxCharacters: MAX_CHARACTERS,
    categories: index.categories.map((item) => ({ ...item })),
    defaultRoleId: index.defaultRoleId,
    roles: index.roles.map((role) => ({ ...role })),
  };
}

module.exports = {
  CHARACTER_PROFILE_SCHEMA_VERSION,
  MAX_CHARACTERS,
  addRoleMetadata,
  getCharacterRegistrySnapshot,
  getRoleDirectoryPath,
  getRoleMediaDirectoryPath,
  getRoleProfilePath,
  initializeCharacterStore,
  isSafeRoleId,
  markRoleUpdated,
  removeRoleMetadata,
  saveCharacterIndex,
  setDefaultRole,
  updateRoleMetadata,
  writeJsonAtomic,
};
