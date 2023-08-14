export enum Level {
    'INFO' = 'INFO',
    'DEBUG' = 'DEBUG',
    'WARNING' = 'WARNING',
    'VERBOS' = 'VERBOS',
    'ERROR' = 'ERROR',
    'WTF' = 'WTF',
}

export const NumericLevel: { [key: number]: Level } = {
    1: Level.ERROR,
    2: Level.WARNING,
    3: Level.INFO,
    4: Level.DEBUG,
    5: Level.VERBOS,
    6: Level.WTF,
};

export const LOGS_LEVEL_TABLE = {
    VERBOS: [Level.VERBOS, Level.DEBUG, Level.INFO, Level.WARNING, Level.ERROR],
    DEBUG: [Level.DEBUG, Level.INFO, Level.WARNING, Level.ERROR],
    INFO: [Level.INFO, Level.WARNING, Level.ERROR],
    WARNING: [Level.WARNING, Level.ERROR],
    ERROR: [Level.ERROR],
    WTF: [Level.WTF],
};

export function isValid(level: Level): boolean {
    return LOGS_LEVEL_TABLE[level] !== undefined;
}
