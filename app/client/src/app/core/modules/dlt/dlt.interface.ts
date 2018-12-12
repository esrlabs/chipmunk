export enum ELogLevel {
    inherit = 'inherit',
    off = 'off',
    fatal = 'fatal',
    error = 'error',
    warn = 'warn',
    info = 'info',
    debug = 'debug',
    verbose = 'verbose'
}

export enum ETraceStatus {
    inherit = 'inherit',
    off = 'off',
    on = 'on',    
}

export enum EType {
    log = 'log',
    request = 'request',
};

export enum ESubtype {
    off = 'off',
    fatal = 'fatal',
    error = 'error',
    warn = 'warn',
    info = 'info',
    debug = 'debug',
    verbose = 'verbose',
};

export interface IEntry {
    index?: number;
    time?: string;
    timestamp?: string;
    count?: string;
    ecuid?: string;
    apid?: string;
    ctid?: string;
    sessionid?: string;
    type?: string | EType;
    subtype?: string | ESubtype;
    mode?: string;
    args?: string;
    payload?: string;
};

export const CExpectedEntries = {
    index: 'index',
    time: 'time',
    timestamp: 'timestamp',
    count: 'count',
    ecuid: 'ecuid',
    apid: 'apid',
    ctid: 'ctid',
    sessionid: 'sessionid',
    type: 'type',
    subtype: 'subtype',
    mode: 'mode',
    args: 'args',
    payload: 'payload',
};

export const CObligatoryEntries = {
    timestamp: 'timestamp',
    ecuid: 'ecuid',
    apid: 'apid',
    ctid: 'ctid',
    type: 'type',
    subtype: 'subtype',
    payload: 'payload',
};

export type TAppId = string;
export type TEduId = string;
export type TContextId = string;
export type IStructureSettings = {
    logLevel: ELogLevel,
    traceStatus: ETraceStatus,
    description: string,
};
export type TStructureContextEntry = {
    setting: IStructureSettings,
    id: string,
    count: number
};
export type TContextMap = Map<TContextId, TStructureContextEntry>;
export type TStructureAppEntry = {
    setting: IStructureSettings,
    map: TContextMap,
    id: string,
    count: number
};
export type TEduStructure = Map<TAppId, TStructureAppEntry>;
export type TStructureEduEntry = {
    setting: IStructureSettings,
    map: TEduStructure,
    id: string,
    count: number
};
export type TStructure = Map<TEduId, TStructureEduEntry>;

export type TDecodeResult = { entryNames: string[], rows: string[], entries: IEntry[] };

export type TStructureDescription = {
    apps: Map<TAppId, string>,
    contexts: Map<TContextId, Map<TAppId, string>>
};