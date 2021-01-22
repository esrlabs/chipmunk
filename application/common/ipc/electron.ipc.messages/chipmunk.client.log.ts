import { ELogLevels } from './chipmunk.loglevel.response';

export interface IChipmunkClientLog {
    msg: string;
    level: ELogLevels;
}

export class ChipmunkClientLog {
    public static signature: string = 'ChipmunkClientLog';
    public signature: string = ChipmunkClientLog.signature;
    public msg: string;
    public level: ELogLevels;

    constructor(params: IChipmunkClientLog) {
        if (typeof params.msg !== 'string' || params.msg.trim() === '') {
            throw new Error(`Property msg should be string type`);
        }
        if (typeof params.level !== 'string' || params.level.trim() === '') {
            throw new Error(`Property level should be ELogLevels type`);
        }
        this.msg = params.msg;
        this.level = params.level;
    }
}
