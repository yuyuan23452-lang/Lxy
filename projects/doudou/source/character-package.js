const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const AdmZip = require('adm-zip');

const PACKAGE_FORMAT = 'doudou-character-package';
const PACKAGE_VERSION = 1;
const PACKAGE_EXTENSION = '.doudoupet';
const MAX_PACKAGE_BYTES = 1024 * 1024 * 1024;
const MAX_PROFILE_BYTES = 2 * 1024 * 1024;
const MAX_MEDIA_FILE_BYTES = 512 * 1024 * 1024;
const MAX_MEDIA_FILES = 500;
const ALLOWED_MEDIA_EXTENSIONS = new Set([
  '.png',
  '.webm',
  '.mp4',
  '.mp3',
  '.wav',
  '.ogg',
  '.m4a',
  '.aac',
  '.flac',
]);

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function isSafeMediaName(value) {
  return (
    typeof value === 'string' &&
    /^[a-z0-9][a-z0-9._-]{0,159}$/i.test(value) &&
    ALLOWED_MEDIA_EXTENSIONS.has(path.extname(value).toLowerCase())
  );
}

function packageMediaSource(fileName) {
  if (!isSafeMediaName(fileName)) throw new Error('Invalid package media name');
  return `package://media/${fileName}`;
}

function parsePackageMediaSource(source) {
  if (typeof source !== 'string' || !source.startsWith('package://media/')) return null;
  const fileName = source.slice('package://media/'.length);
  return isSafeMediaName(fileName) ? fileName : null;
}

function assertSafeEntryName(entryName) {
  if (
    typeof entryName !== 'string' ||
    !entryName ||
    entryName.includes('\\') ||
    entryName.includes('\0') ||
    entryName.startsWith('/') ||
    /^[a-z]:/i.test(entryName)
  ) {
    throw new Error('角色包包含无效路径。');
  }
  const normalized = path.posix.normalize(entryName);
  if (normalized !== entryName || normalized === '..' || normalized.startsWith('../')) {
    throw new Error('角色包包含越界路径。');
  }
}

function validateEntryList(entries) {
  if (entries.length > MAX_MEDIA_FILES + 2) throw new Error('角色包文件数量过多。');
  let totalSize = 0;
  const seen = new Set();
  for (const entry of entries) {
    assertSafeEntryName(entry.entryName);
    if (seen.has(entry.entryName)) throw new Error('角色包包含重复文件。');
    seen.add(entry.entryName);
    if (entry.isDirectory) throw new Error('角色包不允许包含额外目录项。');
    const size = Number(entry.header?.size || 0);
    if (!Number.isFinite(size) || size < 0) throw new Error('角色包文件大小无效。');
    totalSize += size;
    if (totalSize > MAX_PACKAGE_BYTES) throw new Error('角色包解压后不能超过 1GB。');
    if (
      entry.entryName !== 'manifest.json' &&
      entry.entryName !== 'profile.json' &&
      !/^media\/[a-z0-9][a-z0-9._-]{0,159}$/i.test(entry.entryName)
    ) {
      throw new Error('角色包中存在不允许的文件。');
    }
    if (entry.entryName.startsWith('media/')) {
      const fileName = entry.entryName.slice('media/'.length);
      if (!isSafeMediaName(fileName)) throw new Error('角色包中存在不支持的素材格式。');
      if (size > MAX_MEDIA_FILE_BYTES) throw new Error('角色包中的单个素材不能超过 512MB。');
    }
  }
  if (!seen.has('manifest.json') || !seen.has('profile.json')) {
    throw new Error('角色包缺少必要配置文件。');
  }
}

function parseJsonEntry(entry, maximumBytes, label) {
  const declaredSize = Number(entry.header?.size || 0);
  if (declaredSize > maximumBytes) throw new Error(`${label}过大。`);
  const data = entry.getData();
  if (data.length > maximumBytes) throw new Error(`${label}过大。`);
  try {
    return JSON.parse(data.toString('utf8'));
  } catch (_error) {
    throw new Error(`${label}不是有效的 JSON。`);
  }
}

function writeCharacterPackage({
  outputPath,
  appVersion,
  role,
  profile,
  mediaFiles,
  createdAt = new Date().toISOString(),
}) {
  if (!outputPath || path.extname(outputPath).toLowerCase() !== PACKAGE_EXTENSION) {
    throw new Error(`角色包文件必须使用 ${PACKAGE_EXTENSION} 扩展名。`);
  }
  if (!role || typeof role.name !== 'string' || !role.name.trim()) {
    throw new Error('角色信息无效。');
  }
  if (!Array.isArray(mediaFiles) || mediaFiles.length === 0) {
    throw new Error('角色包至少需要一张角色主图。');
  }
  if (mediaFiles.length > MAX_MEDIA_FILES) throw new Error('角色包素材数量过多。');

  const zip = new AdmZip();
  const fileRecords = [];
  const usedNames = new Set();
  for (const file of mediaFiles) {
    if (!isSafeMediaName(file.name) || usedNames.has(file.name)) {
      throw new Error('角色包素材名称无效或重复。');
    }
    usedNames.add(file.name);
    const stats = fs.statSync(file.path);
    if (!stats.isFile() || stats.size <= 0) throw new Error(`素材 ${file.name} 无效。`);
    if (stats.size > MAX_MEDIA_FILE_BYTES) throw new Error(`素材 ${file.name} 超过 512MB。`);
    const data = fs.readFileSync(file.path);
    fileRecords.push({
      path: `media/${file.name}`,
      size: data.length,
      sha256: sha256(data),
    });
    zip.addFile(`media/${file.name}`, data);
  }

  const manifest = {
    format: PACKAGE_FORMAT,
    packageVersion: PACKAGE_VERSION,
    createdAt,
    appVersion: String(appVersion || ''),
    role: {
      originalId: String(role.id || ''),
      name: role.name.trim().slice(0, 40),
      category: ['pet', 'person', 'other'].includes(role.category) ? role.category : 'other',
    },
    files: fileRecords,
  };
  zip.addFile('profile.json', Buffer.from(`${JSON.stringify(profile, null, 2)}\n`, 'utf8'));
  zip.addFile('manifest.json', Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8'));

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const temporaryPath = `${outputPath}.${process.pid}.${Date.now()}.tmp`;
  try {
    zip.writeZip(temporaryPath);
    const stats = fs.statSync(temporaryPath);
    if (stats.size > MAX_PACKAGE_BYTES) throw new Error('角色包不能超过 1GB。');
    fs.rmSync(outputPath, { force: true });
    fs.renameSync(temporaryPath, outputPath);
  } catch (error) {
    fs.rmSync(temporaryPath, { force: true });
    throw error;
  }
  return manifest;
}

function readCharacterPackage(inputPath) {
  const stats = fs.statSync(inputPath);
  if (!stats.isFile() || stats.size <= 0) throw new Error('角色包文件为空。');
  if (stats.size > MAX_PACKAGE_BYTES) throw new Error('角色包不能超过 1GB。');
  const zip = new AdmZip(inputPath);
  const entries = zip.getEntries();
  validateEntryList(entries);
  const entryMap = new Map(entries.map((entry) => [entry.entryName, entry]));
  const manifest = parseJsonEntry(entryMap.get('manifest.json'), MAX_PROFILE_BYTES, '角色包清单');
  const profile = parseJsonEntry(entryMap.get('profile.json'), MAX_PROFILE_BYTES, '角色配置');
  if (
    manifest?.format !== PACKAGE_FORMAT ||
    manifest?.packageVersion !== PACKAGE_VERSION ||
    !manifest?.role ||
    !Array.isArray(manifest?.files)
  ) {
    throw new Error('不是受支持的豆豆角色包。');
  }
  if (manifest.files.length > MAX_MEDIA_FILES) throw new Error('角色包素材数量过多。');

  const declaredPaths = new Set();
  const mediaFiles = [];
  let totalActualSize = 0;
  for (const record of manifest.files) {
    if (
      !record ||
      typeof record.path !== 'string' ||
      !record.path.startsWith('media/') ||
      declaredPaths.has(record.path)
    ) {
      throw new Error('角色包素材清单无效。');
    }
    assertSafeEntryName(record.path);
    const fileName = record.path.slice('media/'.length);
    if (!isSafeMediaName(fileName)) throw new Error('角色包中存在不支持的素材格式。');
    const entry = entryMap.get(record.path);
    if (!entry) throw new Error(`角色包缺少素材：${fileName}`);
    const data = entry.getData();
    totalActualSize += data.length;
    if (data.length > MAX_MEDIA_FILE_BYTES || totalActualSize > MAX_PACKAGE_BYTES) {
      throw new Error('角色包素材体积超过限制。');
    }
    if (data.length !== Number(record.size) || sha256(data) !== record.sha256) {
      throw new Error(`角色包素材校验失败：${fileName}`);
    }
    declaredPaths.add(record.path);
    mediaFiles.push({ name: fileName, data });
  }

  const actualMediaPaths = entries
    .map((entry) => entry.entryName)
    .filter((entryName) => entryName.startsWith('media/'));
  if (actualMediaPaths.some((entryName) => !declaredPaths.has(entryName))) {
    throw new Error('角色包包含未登记素材。');
  }
  return { manifest, profile, mediaFiles };
}

module.exports = {
  ALLOWED_MEDIA_EXTENSIONS,
  PACKAGE_EXTENSION,
  PACKAGE_FORMAT,
  PACKAGE_VERSION,
  isSafeMediaName,
  packageMediaSource,
  parsePackageMediaSource,
  readCharacterPackage,
  writeCharacterPackage,
};
