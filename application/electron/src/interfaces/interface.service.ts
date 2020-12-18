import { IApplication } from './interface.app';

export interface IService {
    init: (main: IApplication) => Promise<void>;
    destroy: () => Promise<void>;
    getName: () => string;
    afterAppInit?: () => Promise<void>;
}
