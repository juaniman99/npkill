export interface IConfig {
  backgroundColor: string;
  warningColor: string;
  checkUpdates: boolean;
  deleteAll: boolean;
  folderSizeInGB: boolean;
  maxSimultaneousSearch: number;
  showErrors: boolean;
  sortBy: string;
  targetFolder: string;
  exclude: string[];
  excludeHiddenDirectories: boolean;
}
