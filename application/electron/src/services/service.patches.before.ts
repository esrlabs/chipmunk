import { IService } from '../interfaces/interface.service';
import Logger from '../tools/env.logger';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

const CPatches: Array<(logger: Logger) => Promise<void>> = [

    // Home folder patch
    (logger: Logger): Promise<void> => {
        return new Promise((resolve) => {
            const oldHome: string = path.resolve(os.homedir(), '.logviewer');
            const newHome: string = path.resolve(os.homedir(), '.chipmunk');
            if (!fs.existsSync(oldHome)) {
                return resolve();
            }
            fs.rename(oldHome, newHome, (err: NodeJS.ErrnoException | null) => {
                if (err) {
                    logger.error(`Fail to rename "${oldHome}" into "${newHome}"`);
                }
                resolve();
            });
        });
    },

];

/**
 * @class ServicePatchesBefore
 * @description Here we can define some patches, which should be inited before all
 */

class ServicePatchesBefore implements IService {

    private _logger: Logger = new Logger('ServicePatchesBefore');

    /**
     * Initialization function
     * @returns Promise<void>
     */
    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            Promise.all(CPatches.map((patch: (logger: Logger) => Promise<void>) => {
                return patch(this._logger);
            })).catch((err: Error) => {
                this._logger.error(`Error during apply patches: ${err.message}`);
            }).finally(() => {
                resolve();
            });
        });
    }

    public destroy(): Promise<void> {
        return new Promise((resolve) => {
            resolve();
        });
    }

    public getName(): string {
        return 'ServicePatchesBefore';
    }

}

export default (new ServicePatchesBefore());
