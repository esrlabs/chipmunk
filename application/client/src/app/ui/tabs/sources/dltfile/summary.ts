import { StatEntity } from './structure/statentity';

export class Summary {
    public fatal: number = 0;
    public error: number = 0;
    public warning: number = 0;
    public info: number = 0;
    public debug: number = 0;
    public verbose: number = 0;
    public invalid: number = 0;
    public total: number = 0;
    public count: number = 0;

    private _loaded: boolean = false;

    public isLoaded(): boolean {
        return this._loaded;
    }

    public inc(entity: StatEntity) {
        this.fatal += entity.log_fatal;
        this.error += entity.log_error;
        this.warning += entity.log_warning;
        this.info += entity.log_info;
        this.debug += entity.log_debug;
        this.verbose += entity.log_verbose;
        this.invalid += entity.log_invalid;
        this.total +=
            entity.log_fatal +
            entity.log_error +
            entity.log_warning +
            entity.log_info +
            entity.log_debug +
            entity.log_verbose +
            entity.log_invalid;
        this.count += 1;
    }

    public reset() {
        this._loaded = true;
        this.fatal = 0;
        this.error = 0;
        this.warning = 0;
        this.info = 0;
        this.debug = 0;
        this.verbose = 0;
        this.invalid = 0;
        this.total = 0;
        this.count = 0;
    }
}
