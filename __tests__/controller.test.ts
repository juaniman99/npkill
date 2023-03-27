import { jest } from '@jest/globals';
import { StartParameters } from '../src/models/start-parameters.model.js';

jest.mock('../src/dirname.js', () => {
  return {};
});

jest.unstable_mockModule('../src/ui/components/header/header.ui.js', () => ({
  HeaderUi: jest.fn(),
}));
jest.unstable_mockModule('../src/ui/components/header/stats.ui.js', () => ({
  StatsUi: jest.fn(),
}));
jest.unstable_mockModule('../src/ui/components/header/status.ui.js', () => ({
  StatusUi: jest.fn(() => ({
    start: jest.fn(),
  })),
}));
jest.unstable_mockModule('../src/ui/components/general.ui.js', () => ({
  GeneralUi: jest.fn(),
}));
jest.unstable_mockModule('../src/ui/components/help.ui.js', () => ({
  HelpUi: jest.fn(),
}));
jest.unstable_mockModule('../src/ui/components/results.ui.js', () => ({
  ResultsUi: jest.fn(() => ({
    delete$: { subscribe: jest.fn() },
    showErrors$: { subscribe: jest.fn() },
  })),
}));
jest.unstable_mockModule('../src/ui/components/logs.ui.js', () => ({
  LogsUi: jest.fn(() => ({
    close$: { subscribe: jest.fn() },
  })),
}));
jest.unstable_mockModule('../src/ui/base.ui.js', () => ({
  BaseUi: { setVisible: jest.fn() },
}));
jest.unstable_mockModule('../src/ui/heavy.ui.js', () => ({
  HeavyUi: {},
}));

const ControllerConstructor = //@ts-ignore
  (await import('../src/controller.js')).Controller;
class Controller extends ControllerConstructor {}

describe('Controller test', () => {
  let controller;
  const linuxFilesServiceMock: any = {
    getFileContent: jest.fn().mockReturnValue('{}'),
    isValidRootFolder: jest.fn().mockReturnValue('true'),
  };
  const spinnerServiceMock: any = jest.fn();
  const UpdateServiceMock: any = jest.fn();
  const resultServiceMock: any = jest.fn();
  const searchStatusMock: any = jest.fn();
  const loggerServiceMock: any = {
    info: () => {},
    error: () => {},
    getSuggestLogfilePath: () => {},
    saveToFile: () => {},
  };
  const uiServiceMock: any = {
    add: () => {},
    print: () => {},
    setRawMode: () => {},
    setCursorVisible: () => {},
  };
  const consoleService: any = {
    getParameters: () => new StartParameters(),
    isRunningBuild: () => false,
    startListenKeyEvents: jest.fn(),
  };

  ////////// mocked Controller Methods
  let parseArgumentsSpy;
  let showHelpSpy;
  let prepareScreenSpy;
  let setupEventsListenerSpy;
  let initializeLoadingStatusSpy;
  let scanSpy;
  let checkVersionSpy;
  let exitSpy;
  ///////////////////////////////////

  beforeEach(() => {
    exitSpy = jest.spyOn(process, 'exit').mockImplementation((number) => {
      throw new Error('process.exit: ' + number);
    });
    controller = new Controller(
      loggerServiceMock,
      searchStatusMock,
      linuxFilesServiceMock,
      spinnerServiceMock,
      consoleService,
      UpdateServiceMock,
      resultServiceMock,
      uiServiceMock,
    );

    Object.defineProperty(process.stdout, 'columns', { value: 80 });
    Object.defineProperty(process.stdout, 'isTTY', { value: true });

    parseArgumentsSpy = jest.spyOn(controller, 'parseArguments');
    showHelpSpy = jest
      .spyOn(controller, 'showHelp')
      .mockImplementation(() => ({}));
    prepareScreenSpy = jest
      .spyOn(controller, 'prepareScreen')
      .mockImplementation(() => ({}));
    setupEventsListenerSpy = jest
      .spyOn(controller, 'setupEventsListener')
      .mockImplementation(() => ({}));
    scanSpy = jest.spyOn(controller, 'scan').mockImplementation(() => ({}));
    checkVersionSpy = jest
      .spyOn(controller, 'checkVersion')
      .mockImplementation(() => ({}));
  });

  it('#init normal start should call some methods', () => {
    controller.init();
    expect(showHelpSpy).toHaveBeenCalledTimes(0);
    expect(setupEventsListenerSpy).toHaveBeenCalledTimes(1);
    expect(scanSpy).toHaveBeenCalledTimes(1);
    expect(checkVersionSpy).toHaveBeenCalledTimes(1);
  });

  describe('#getArguments', () => {
    const mockParameters = (parameters: Object) => {
      consoleService.getParameters = () => {
        const startParameters = new StartParameters();
        Object.keys(parameters).forEach((key) => {
          startParameters.add(key, parameters[key]);
        });
        return startParameters;
      };
      /*  jest
      .spyOn(consoleService, 'getParameters')
      .mockImplementation((rawArgv) => {
        return parameters;
      }); */
    };

    const spyMethod = (method, fn = () => {}) => {
      return jest.spyOn(controller, method).mockImplementation(fn);
    };

    afterEach(() => {
      jest.spyOn(process, 'exit').mockReset();
    });

    it('#showHelp should called if --help flag is present and exit', () => {
      mockParameters({ help: true });
      expect(() => controller.init()).toThrow();
      expect(showHelpSpy).toHaveBeenCalledTimes(1);
      expect(exitSpy).toHaveBeenCalledTimes(1);
    });

    it('#showProgramVersion should called if --version flag is present and exit', () => {
      mockParameters({ version: true });
      const functionSpy = jest
        .spyOn(controller, 'showProgramVersion')
        .mockImplementation(() => ({}));
      expect(() => controller.init()).toThrow();
      expect(functionSpy).toHaveBeenCalledTimes(1);
      expect(exitSpy).toHaveBeenCalledTimes(1);
    });

    it('#showProgramVersion should called if --delete-all flag is present and exit', () => {
      mockParameters({ 'delete-all': true });
      const functionSpy = spyMethod('showObsoleteMessage');
      expect(() => controller.init()).toThrow();
      expect(functionSpy).toHaveBeenCalledTimes(1);
      expect(exitSpy).toHaveBeenCalledTimes(1);
    });

    it('#checkVersionn should not be called if --no-check-updates is given', () => {
      mockParameters({ 'no-check-updates': true });
      const functionSpy = spyMethod('checkVersion');
      controller.init();
      expect(functionSpy).toHaveBeenCalledTimes(0);
    });

    describe('--sort-by parameter   ', () => {
      it('Should detect if option is invalid', () => {
        mockParameters({ 'sort-by': 'novalid' });
        spyMethod('isValidSortParam', () => false);
        const functionSpy = spyMethod('invalidSortParam');
        controller.init();
        expect(functionSpy).toHaveBeenCalledTimes(1);
      });

      // TODO test that check sortBy property is changed
    });
  });
});
