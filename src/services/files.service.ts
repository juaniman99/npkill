import {
  IFileStat,
  IFileService,
  IListDirParams,
} from '../interfaces/index.js';

import { Observable } from 'rxjs';
import { readFileSync, statSync } from 'fs';
import { readdir, stat } from 'fs/promises';

export abstract class FileService implements IFileService {
  abstract getFolderSize(path: string): Observable<any>;
  abstract listDir(params: IListDirParams): Observable<Buffer>;
  abstract deleteDir(path: string): Promise<{}>;

  convertKbToGB(kb: number): number {
    const factorKBtoGB = 1048576;
    return kb / factorKBtoGB;
  }

  convertBytesToKB(bytes: number): number {
    const factorBytestoKB = 1024;
    return bytes / factorBytestoKB;
  }

  convertGBToMB(gb: number) {
    const factorGBtoMB = 1024;
    return gb * factorGBtoMB;
  }

  getFileContent(path: string): string {
    const encoding = 'utf8';
    return readFileSync(path, encoding);
  }

  isSafeToDelete(path: string, targetFolder: string): boolean {
    return path.includes(targetFolder);
  }

  /** We consider a directory to be dangerous if it is hidden.
   *
   * > Why dangerous?
   * It is probable that if the node_module is included in some hidden directory, it is
   * required by some application like "spotify", "vscode" or "Discord" and deleting it
   * would imply breaking the application (until the dependencies are reinstalled).
   */
  isDangerous(path: string): boolean {
    const hiddenFilePattern = /(^|\/)\.[^\/\.]/g;
    return hiddenFilePattern.test(path);
  }

  async getRecentModificationInDir(path: string): Promise<number> {
    const files = await this.getFileStatsInDir(path);
    const sorted = files.sort(
      (a, b) => b.modificationTime - a.modificationTime,
    );
    return sorted[0]?.modificationTime || null;
  }

  async getFileStatsInDir(dirname: string): Promise<IFileStat[]> {
    let files: IFileStat[] = [];
    const items = await readdir(dirname, { withFileTypes: true });

    for (const item of items) {
      try {
        if (item.isDirectory()) {
          if (item.name === 'node_modules') continue;
          files = [
            ...files,
            ...(await this.getFileStatsInDir(`${dirname}/${item.name}`)),
          ];
        } else {
          const path = `${dirname}/${item.name}`;
          const fileStat = await stat(path);

          files.push({ path, modificationTime: fileStat.mtimeMs / 1000 });
        }
      } catch (error) {}
    }

    return files;
  }
}
