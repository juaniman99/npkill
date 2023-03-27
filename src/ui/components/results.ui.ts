import {
  DECIMALS_SIZE,
  DEFAULT_CONFIG,
  MARGINS,
  OVERFLOW_CUT_FROM,
} from '../../constants/main.constants.js';

import { InteractiveUi } from '../base.ui.js';
import { HeavyUi } from '../heavy.ui.js';

import { ConsoleService } from '../../services/console.service.js';
import { FileService } from '../../services/index.js';
import { IConfig } from '../../interfaces/config.interface.js';
import { IFolder } from '../../interfaces/folder.interface.js';
import { IKeyPress } from 'src/interfaces/key-press.interface.js';
import { INFO_MSGS } from '../../constants/messages.constants.js';
import { ResultsService } from '../../services/results.service.js';
import { Subject } from 'rxjs';
import colors from 'colors';

export class ResultsUi extends HeavyUi implements InteractiveUi {
  resultIndex = 0;
  previousIndex = 0;
  scroll: number = 0;
  private haveResultsAfterCompleted = true;

  readonly delete$ = new Subject<IFolder>();
  readonly showErrors$ = new Subject<null>();

  private config: IConfig = DEFAULT_CONFIG;
  private KEYS = {
    up: () => this.cursorUp(),
    down: () => this.cursorDown(),
    space: () => this.delete(),
    j: () => this.cursorDown(),
    k: () => this.cursorUp(),
    h: () => this.cursorPageDown(),
    l: () => this.cursorPageUp(),
    d: () => this.cursorPageDown(),
    u: () => this.cursorPageUp(),
    pageup: () => this.cursorPageUp(),
    pagedown: () => this.cursorPageDown(),
    home: () => this.cursorFirstResult(),
    end: () => this.cursorLastResult(),
    e: () => this.showErrorsPopup(),
  };

  constructor(
    private resultsService: ResultsService,
    private consoleService: ConsoleService,
    private fileService: FileService,
  ) {
    super();
  }

  onKeyInput({ name }: IKeyPress): void {
    const action = this.KEYS[name];
    if (!action) {
      return;
    }
    action();
    this.render();
  }

  render(): void {
    if (!this.haveResultsAfterCompleted) {
      this.noResults();
      return;
    }

    this.printResults();
    this.flush();
  }

  clear(): void {
    for (let row = MARGINS.ROW_RESULTS_START; row < this.terminal.rows; row++) {
      this.clearLine(row);
    }
  }

  completeSearch(): void {
    if (this.resultsService.results.length === 0) {
      this.haveResultsAfterCompleted = false;
      this.render();
    }
  }

  private printResults(): void {
    const visibleFolders = this.getVisibleScrollFolders();

    visibleFolders.map((folder: IFolder, index: number) => {
      const row = MARGINS.ROW_RESULTS_START + index;
      this.printFolderRow(folder, row);
    });
  }

  private noResults(): void {
    const message = `No ${colors[DEFAULT_CONFIG.warningColor](
      this.config.targetFolder,
    )} found!`;
    this.printAt(message, {
      x: Math.floor(this.terminal.columns / 2 - message.length / 2),
      y: MARGINS.ROW_RESULTS_START + 2,
    });
  }

  private printFolderRow(folder: IFolder, row: number): void {
    this.clearLine(row);
    let { path, lastModification, size } = this.getFolderTexts(folder);
    const isRowSelected = row === this.getRealCursorPosY();

    lastModification = colors.gray(lastModification);
    if (isRowSelected) {
      path = colors[this.config.backgroundColor](path);
      size = colors[this.config.backgroundColor](size);
      lastModification = colors[this.config.backgroundColor](lastModification);

      this.paintBgRow(row);
    }

    if (folder.isDangerous)
      path = colors[DEFAULT_CONFIG.warningColor](path + '⚠️');

    this.printAt(path, {
      x: MARGINS.FOLDER_COLUMN_START,
      y: row,
    });
    this.printAt(lastModification, {
      x: this.terminal.columns - MARGINS.FOLDER_SIZE_COLUMN - 6,
      y: row,
    });
    this.printAt(size, {
      x: this.terminal.columns - MARGINS.FOLDER_SIZE_COLUMN,
      y: row,
    });
  }

  private getFolderTexts(folder: IFolder): {
    path: string;
    size: string;
    lastModification: string;
  } {
    const folderText = this.getFolderPathText(folder);
    let folderSize = `${folder.size.toFixed(DECIMALS_SIZE)} GB`;
    let daysSinceLastModification =
      folder.modificationTime !== null && folder.modificationTime > 0
        ? Math.floor(
            (new Date().getTime() / 1000 - folder.modificationTime) / 86400,
          ) + 'd'
        : '--';

    if (folder.isDangerous) daysSinceLastModification = 'xx';

    // Align to right
    const alignMargin = 4 - daysSinceLastModification.length;
    daysSinceLastModification =
      ' '.repeat(alignMargin > 0 ? alignMargin : 0) + daysSinceLastModification;

    if (!this.config.folderSizeInGB) {
      const size = this.fileService.convertGBToMB(folder.size);
      const sizeText = size.toFixed(DECIMALS_SIZE);
      const space = ' '.repeat(6 - sizeText.length);
      folderSize = `${space}${size.toFixed(DECIMALS_SIZE)} MB`;
    }

    const folderSizeText = folder.size ? folderSize : '--';

    return {
      path: folderText,
      size: folderSizeText,
      lastModification: daysSinceLastModification,
    };
  }

  cursorUp(): void {
    this.moveCursor(-1);
  }

  cursorDown(): void {
    this.moveCursor(1);
  }

  cursorPageUp(): void {
    const resultsInPage = this.getRowsAvailable();
    this.moveCursor(-(resultsInPage - 2));
  }

  cursorPageDown(): void {
    const resultsInPage = this.getRowsAvailable();
    this.moveCursor(resultsInPage - 2);
  }

  cursorFirstResult(): void {
    this.moveCursor(-this.resultIndex);
  }

  cursorLastResult(): void {
    this.moveCursor(this.resultsService.results.length - 1);
  }

  fitScroll(): void {
    const shouldScrollUp =
      this.getRow(this.resultIndex) <
      MARGINS.ROW_RESULTS_START + this.scroll + 1;

    const shouldScrollDown =
      this.getRow(this.resultIndex) > this.terminal.rows + this.scroll - 2;

    const isOnBotton =
      this.resultIndex === this.resultsService.results.length - 1;

    let scrollRequired = 0;

    if (shouldScrollUp)
      scrollRequired =
        this.getRow(this.resultIndex) -
        MARGINS.ROW_RESULTS_START -
        this.scroll -
        1;
    else if (shouldScrollDown) {
      scrollRequired =
        this.getRow(this.resultIndex) - this.terminal.rows - this.scroll + 2;

      if (isOnBotton) {
        scrollRequired -= 1;
      }
    }

    if (scrollRequired) {
      this.scrollFolderResults(scrollRequired);
    }
  }

  scrollFolderResults(scrollAmount: number): void {
    const virtualFinalScroll = this.scroll + scrollAmount;
    this.scroll = this.clamp(
      virtualFinalScroll,
      0,
      this.resultsService.results.length,
    );
    this.clear();
  }

  private moveCursor(index: number): void {
    this.previousIndex = this.resultIndex;
    this.resultIndex += index;

    // Upper limit
    if (this.isCursorInLowerLimit()) {
      this.resultIndex = 0;
    }

    // Lower limit
    if (this.isCursorInUpperLimit()) {
      this.resultIndex = this.resultsService.results.length - 1;
    }

    this.fitScroll();
  }

  private getFolderPathText(folder: IFolder): string {
    let cutFrom = OVERFLOW_CUT_FROM;
    let text = folder.path;
    const ACTIONS = {
      // tslint:disable-next-line: object-literal-key-quotes
      deleted: () => {
        cutFrom += INFO_MSGS.DELETED_FOLDER.length;
        text = INFO_MSGS.DELETED_FOLDER + text;
      },
      // tslint:disable-next-line: object-literal-key-quotes
      deleting: () => {
        cutFrom += INFO_MSGS.DELETING_FOLDER.length;
        text = INFO_MSGS.DELETING_FOLDER + text;
      },
      'error-deleting': () => {
        cutFrom += INFO_MSGS.ERROR_DELETING_FOLDER.length;
        text = INFO_MSGS.ERROR_DELETING_FOLDER + text;
      },
    };

    if (ACTIONS[folder.status]) ACTIONS[folder.status]();

    text = this.consoleService.shortenText(
      text,
      this.terminal.columns - MARGINS.FOLDER_COLUMN_END,
      cutFrom,
    );

    // This is necessary for the coloring of the text, since
    // the shortener takes into ansi-scape codes invisible
    // characters and can cause an error in the cli.
    text = this.paintStatusFolderPath(text, folder.status);

    return text;
  }

  private paintStatusFolderPath(folderString: string, action: string): string {
    const TRANSFORMATIONS = {
      // tslint:disable-next-line: object-literal-key-quotes
      deleted: (text) =>
        text.replace(
          INFO_MSGS.DELETED_FOLDER,
          colors.green(INFO_MSGS.DELETED_FOLDER),
        ),
      // tslint:disable-next-line: object-literal-key-quotes
      deleting: (text) =>
        text.replace(
          INFO_MSGS.DELETING_FOLDER,
          colors.yellow(INFO_MSGS.DELETING_FOLDER),
        ),
      'error-deleting': (text) =>
        text.replace(
          INFO_MSGS.ERROR_DELETING_FOLDER,
          colors.red(INFO_MSGS.ERROR_DELETING_FOLDER),
        ),
    };

    return TRANSFORMATIONS[action]
      ? TRANSFORMATIONS[action](folderString)
      : folderString;
  }

  private isCursorInLowerLimit(): boolean {
    return this.resultIndex < 0;
  }

  private isCursorInUpperLimit(): boolean {
    return this.resultIndex >= this.resultsService.results.length;
  }

  private getRealCursorPosY(): number {
    return this.getRow(this.resultIndex) - this.scroll;
  }

  private getVisibleScrollFolders(): IFolder[] {
    return this.resultsService.results.slice(
      this.scroll,
      this.getRowsAvailable() + this.scroll,
    );
  }

  private paintBgRow(row: number): void {
    const startPaint = MARGINS.FOLDER_COLUMN_START;
    const endPaint = this.terminal.columns - MARGINS.FOLDER_SIZE_COLUMN;
    let paintSpaces = '';

    for (let i = startPaint; i < endPaint; ++i) {
      paintSpaces += ' ';
    }

    this.printAt(colors[this.config.backgroundColor](paintSpaces), {
      x: startPaint,
      y: row,
    });
  }

  private delete(): void {
    const folder = this.resultsService.results[this.resultIndex];

    if (!folder) {
      return;
    }

    this.delete$.next(folder);
  }

  /** Returns the number of results that can be displayed. */
  private getRowsAvailable(): number {
    return this.terminal.rows - MARGINS.ROW_RESULTS_START;
  }

  /** Returns the row to which the index corresponds. */
  private getRow(index: number): number {
    return index + MARGINS.ROW_RESULTS_START;
  }

  private showErrorsPopup(): void {
    this.showErrors$.next(null);
  }

  private clamp(num: number, min: number, max: number): number {
    return Math.min(Math.max(num, min), max);
  }
}
