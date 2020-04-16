export enum ELogLevels {
    INFO = "INFO",
    DEBUG = "DEBUG",
    WARNING = "WARNING",
    VERBOS = "VERBOS",
    ERROR = "ERROR",
    ENV = "ENV",
}

export interface IChipmunkLogLevelResponse {
    level: ELogLevels;
}

export class ChipmunkLogLevelResponse {
    public static signature: string = 'ChipmunkLogLevelResponse';
    public signature: string = ChipmunkLogLevelResponse.signature;
    public level: ELogLevels;

    constructor(params: IChipmunkLogLevelResponse) {
        if (typeof params.level !== 'string' || params.level.trim() === '') {
            throw new Error(`Property mode should be ELogLevels type`);
        }
        this.level = params.level;
    }
}
