import { SetupService, Interface, Implementation, register } from 'platform/entity/service';
import { envvars } from '@loader/envvars';
import { Level } from 'platform/log';

import { services } from '@register/services';

@SetupService(services['production'])
export class Service extends Implementation {
    private _production = true;
    private _logLevel: Level = Level.ERROR;

    public override init(): Promise<void> {
        return new Promise((resolve) => {
            if (envvars.get().CHIPMUNK_DEVELOPING_MODE) {
                this._production = false;
            } else {
                this._production = true;
            }
            this.log().debug(`Production is: ${this._production ? 'ON' : 'OFF'}`);
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
