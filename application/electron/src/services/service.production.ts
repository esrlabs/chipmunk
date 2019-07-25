import Logger from '../tools/env.logger';

import { IService } from '../interfaces/interface.service';

/**
 * @class ServiceProduction
 * @description Just keep information about build type
 */

class ServiceProduction implements IService {

    private _logger: Logger = new Logger('ServiceProduction');
    // Should detect by executable file
    private _production: boolean = false;

    /**
     * Initialization function
     * @returns Promise<void>
     */
    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            resolve();
        });
    }

    public destroy(): Promise<void> {
        return new Promise((resolve) => {
            resolve();
        });
    }

    public getName(): string {
        return 'ServiceProduction';
    }

    public isProduction(): boolean {
        return this._production;
    }

}

export default (new ServiceProduction());
