import { NoParamCallback, rmdir } from 'fs';

import { RM_NODE_VERSION_SUPPORT } from '@core/constants/recursive-rmdir-node-support.constants';
import { WindowsStrategy } from './windows-strategy.abstract';

export class WindowsNode14Strategy extends WindowsStrategy {
  remove(path: string, callback: NoParamCallback): boolean {
    if (this.isSupported()) {
      console.log('Node 14');
      rmdir(path, { recursive: true }, callback);
      return true;
    }
    return this.checkNext(path, callback);
  }

  isSupported(): boolean {
    return (
      this.major > RM_NODE_VERSION_SUPPORT.major ||
      (this.major === RM_NODE_VERSION_SUPPORT.major &&
        this.minor > RM_NODE_VERSION_SUPPORT.minor)
    );
  }
}
