import Logger from '../tools/env.logger';
import ServiceProduction from './service.production';
import { IService } from '../interfaces/interface.service';

const CSettings = {
    delay: 10000,
};

/**
 * @class ServiceAppState
 * @description Log information about state of application
 */

class ServiceAppState implements IService {

    private _logger: Logger = new Logger('ServiceAppState');
    private _timer: any = -1;
    private _memory: {
        prev: number,
    } = {
        prev: 0,
    };

    /**
     * Initialization function
     * @returns Promise<void>
     */
    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            this._check();
            resolve();
        });
    }

    public destroy(): Promise<void> {
        return new Promise((resolve) => {
            resolve();
        });
    }

    public getName(): string {
        return 'ServiceAppState';
    }

    private _check() {
        if (ServiceProduction.isProduction()) {
            return;
        }
        this._timer = setTimeout(() => {
            const mem = process.memoryUsage();
            const change = mem.heapUsed - this._memory.prev;
            this._memory.prev = mem.heapUsed;
            this._logger.env(`memory usage: ${(mem.heapUsed / 1024 / 1024).toFixed(2)} / ${(mem.heapTotal / 1024 / 1024).toFixed(2)} Mb (${change > 0 ? '↑' : '↓'} ${(change / 1024 / 1024).toFixed(2)} Mb)`);
            this._check();
        }, CSettings.delay);
    }

}

export default (new ServiceAppState());
