import fs from 'node:fs/promises';
import path from 'node:path';

export class StorageProvider {
  async save(_key, _buffer) { throw new Error('StorageProvider.save no implementado'); }
  async read(_key) { throw new Error('StorageProvider.read no implementado'); }
  async delete(_key) { throw new Error('StorageProvider.delete no implementado'); }
}

export class LocalDiskStorage extends StorageProvider {
  constructor(root = process.env.DOCUMENT_STORAGE_PATH || '/data/uploads') {
    super();
    this.root = path.resolve(root);
  }

  resolve(key) {
    const resolved = path.resolve(this.root, key);
    if (resolved !== this.root && !resolved.startsWith(`${this.root}${path.sep}`)) throw new Error('Clave de almacenamiento inválida');
    return resolved;
  }

  async save(key, buffer) {
    const target = this.resolve(key);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, buffer, { flag: 'wx' });
    return key;
  }

  read(key) { return fs.readFile(this.resolve(key)); }
  delete(key) { return fs.rm(this.resolve(key), { force: true }); }
}

export const storage = new LocalDiskStorage();
