export enum EErrorSeverity {
    warn = 'warn',
    error = 'error',
    logs = 'logs',
}

export interface IGeneralError {
    severity: EErrorSeverity;
    message: string;
}

export function getErrorFrom<T>(smth: IGeneralError | T): Error | T {
    if (
        typeof smth === 'object' &&
        smth !== null &&
        typeof (smth as IGeneralError).severity === 'string' &&
        typeof (smth as IGeneralError).message === 'string'
    ) {
        return new Error((smth as IGeneralError).message);
    } else {
        return smth as T;
    }
}
