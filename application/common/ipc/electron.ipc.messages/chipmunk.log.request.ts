import { ELogLevels } from './chipmunk.loglevel.response';

export interface IChipmunkLogRequest {
    msg: string;
    level: ELogLevels;
}

export class ChipmunkLogRequest {
    public static signature: string = 'ChipmunkLogRequest';
    public signature: string = ChipmunkLogRequest.signature;
    public msg: string;
    public level: ELogLevels;

    constructor(params: IChipmunkLogRequest) {
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
