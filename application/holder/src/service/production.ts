import {
    SetupService,
    Interface,
    Implementation,
    DependOn,
    register,
} from '@platform/entity/service';
import { environment } from '@service/environment';
import { settings } from '@env/logs/settings';
import { Level, isValidLevel, strToLogLevel } from '@platform/env/logger';

import { services } from '@register/services';

const CDEV_ENV_VAR_VALUE = 'ON';

@DependOn(environment)
@SetupService(services['production'])
export class Service extends Implementation {
    private _production = true;
    private _logLevel: Level = Level.ERROR;

    public override init(): Promise<void> {
        return new Promise((resolve) => {
            if (environment.get().CHIPMUNK_DEVELOPING_MODE === CDEV_ENV_VAR_VALUE) {
                this._production = false;
            } else {
                this._production = true;
            }
            this.log().debug(`Production is: ${this._production ? 'ON' : 'OFF'}`);
            const logLevel: string | undefined = environment.get().CHIPMUNK_DEV_LOGLEVEL;
            if (logLevel !== undefined && isValidLevel(logLevel)) {
                this._logLevel = strToLogLevel(logLevel);
            } else if (this._production) {
                this._logLevel = Level.ERROR;
            } else {
                this._logLevel = Level.INFO;
            }
            settings.setLevel(this._logLevel);
            resolve();
        });
    }

    public isProduction(): boolean {
        return this._production;
    }

    public getLogLevel(): Level {
        return this._logLevel;
    }
}
export interface Service extends Interface {}
export const production = register(new Service());
