import { IMainApp } from './interface.main';

export interface IService {
    init: (main?: IMainApp) => Promise<void>;
    destroy: () => Promise<void>;
    getName: () => string;
}
