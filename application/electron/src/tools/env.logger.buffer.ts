import { ELogLevels } from './env.logger.parameters';
import { Lock } from './env.lock';

export interface IBufferLogRecord {
    level: ELogLevels;
    msg: string;
}

class LoggerLock extends Lock {

    private _buffer: IBufferLogRecord[] = [];

    constructor() {
        super(true);
    }

    public buffer(level: ELogLevels, msg: string) {
        if (!this.isLocked()) {
            return;
        }
        this._buffer.push({
            level: level,
            msg: msg,
        });
    }

    public apply(allowed: {[key: string]: boolean}) {
        if (!this.isLocked()) {
            return;
        }
        this._buffer.forEach((record: IBufferLogRecord) => {
            if (!allowed[record.level]) {
                return;
            }
            // tslint:disable-next-line: no-console
            console.log(record.msg);
        });
        this._buffer = [];
        this.unlock();
    }

}

export default (new LoggerLock());
