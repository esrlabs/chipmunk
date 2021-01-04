export enum EErrorSeverity {
    warn = 'warn',
    error = 'error',
    logs = 'logs',
}

export interface IGeneralError {
    severity: EErrorSeverity;
    message: string;
}
