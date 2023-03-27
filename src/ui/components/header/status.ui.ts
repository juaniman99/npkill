import { BaseUi } from '../../base.ui.js';
import colors from 'colors';
import { SpinnerService } from '../../../services/spinner.service.js';
import { interval, Subject, takeUntil } from 'rxjs';
import { INFO_MSGS } from '../../../constants/messages.constants.js';
import {
  SPINNERS,
  SPINNER_INTERVAL,
} from '../../../constants/spinner.constants.js';
import { UI_POSITIONS } from '../../../constants/main.constants.js';
import { SearchStatus } from '../../../models/search-state.model.js';
import { BAR_PARTS, BAR_WIDTH } from '../../../constants/status.constants.js';

export class StatusUi extends BaseUi {
  private text = '';
  private barNormalizedWidth = 0;
  private barClosing = false;
  private readonly searchEnd$ = new Subject();
  private readonly SEARCH_STATES = {
    stopped: () => this.startingSearch(),
    scanning: () => this.continueSearching(),
    dead: () => this.fatalError(),
    finished: () => this.continueFinishing(),
  };

  constructor(
    private readonly spinnerService: SpinnerService,
    private readonly searchStatus: SearchStatus,
  ) {
    super();
  }

  start(): void {
    this.spinnerService.setSpinner(SPINNERS.W10);
    interval(SPINNER_INTERVAL)
      .pipe(takeUntil(this.searchEnd$))
      .subscribe(() => {
        this.SEARCH_STATES[this.searchStatus.workerStatus]();
      });

    this.animateProgressBar();
  }

  completeSearch(duration: number): void {
    this.searchEnd$.next(true);
    this.searchEnd$.complete();

    this.text =
      colors.green(INFO_MSGS.SEARCH_COMPLETED) + colors.gray(`${duration}s`);
    this.render();
    setTimeout(() => this.animateClose(), 2000);
  }

  render(): void {
    this.printAt(this.text, UI_POSITIONS.STATUS);
    this.renderProgressBar();
  }

  private renderProgressBar(): void {
    const {
      pendingSearchTasks,
      completedSearchTasks,
      completedStatsCalculation,
      pendingStatsCalculation,
    } = this.searchStatus;

    const proportional = (a: number, b: number, c: number): number => {
      if (c === 0) {
        return 0;
      }
      return (a * b) / c;
    };

    const modifier =
      this.barNormalizedWidth === 1
        ? 1
        : // easeInOut formula
          -(Math.cos(Math.PI * this.barNormalizedWidth) - 1) / 2;

    const barSearchMax = pendingSearchTasks + completedSearchTasks;
    const barStatsMax = completedStatsCalculation + pendingStatsCalculation;

    let barLenght = proportional(barSearchMax, BAR_WIDTH, barSearchMax);
    if (barLenght === 0) {
      barLenght = BAR_WIDTH;
    }
    barLenght = Math.floor(barLenght * modifier);

    let searchBarLenght = proportional(
      completedSearchTasks,
      BAR_WIDTH,
      barSearchMax,
    );
    searchBarLenght = Math.floor(searchBarLenght * modifier);

    let doneBarLenght = proportional(
      completedStatsCalculation,
      searchBarLenght,
      barStatsMax,
    );
    doneBarLenght = Math.floor(doneBarLenght * modifier);

    barLenght -= searchBarLenght;
    searchBarLenght -= doneBarLenght;

    // Debug
    // this.printAt(
    //   `V: ${barSearchMax},T: ${barLenght},C: ${searchBarLenght},D:${doneBarLenght}   `,
    //   { x: 60, y: 5 },
    // );

    const progressBar =
      BAR_PARTS.completed.repeat(doneBarLenght) +
      BAR_PARTS.searchTask.repeat(searchBarLenght) +
      BAR_PARTS.bg.repeat(barLenght);

    this.printProgressBar(progressBar);
  }

  private animateProgressBar(): void {
    if (this.barNormalizedWidth > 1) {
      this.barNormalizedWidth = 1;
      return;
    }
    this.barNormalizedWidth += 0.05;

    this.renderProgressBar();
    setTimeout(() => this.animateProgressBar(), SPINNER_INTERVAL);
  }

  private animateClose(): void {
    this.barClosing = true;
    if (this.barNormalizedWidth < 0) {
      this.barNormalizedWidth = 0;
      return;
    }
    this.barNormalizedWidth -= 0.05;

    this.renderProgressBar();
    setTimeout(() => this.animateClose(), SPINNER_INTERVAL);
  }

  private printProgressBar(progressBar: string): void {
    if (this.barClosing) {
      const postX = Math.round(
        UI_POSITIONS.STATUS_BAR.x +
          (BAR_WIDTH / 2) * (1 - this.barNormalizedWidth),
      );
      // Clear previus bar
      this.printAt(' '.repeat(BAR_WIDTH), UI_POSITIONS.STATUS_BAR);

      this.printAt(progressBar, {
        x: postX,
        y: UI_POSITIONS.STATUS_BAR.y,
      });
    } else {
      this.printAt(progressBar, UI_POSITIONS.STATUS_BAR);
    }
  }

  private startingSearch(): void {
    this.text = INFO_MSGS.STARTING;
    this.render();
  }

  private continueSearching(): void {
    this.text = INFO_MSGS.SEARCHING + this.spinnerService.nextFrame();
    this.render();
  }

  private fatalError(): void {
    this.text = colors.red(INFO_MSGS.FATAL_ERROR);
    this.searchEnd$.next(true);
    this.searchEnd$.complete();
    this.render();
  }

  private continueFinishing(): void {
    this.text = INFO_MSGS.CALCULATING_STATS + this.spinnerService.nextFrame();
    this.render();
  }
}
