export enum EErrorSeverity {
    warn = 'warn',
    error = 'error',
    logs = 'logs',
}

export interface IGeneralError {
    severity: EErrorSeverity;
    message: string;
}

export interface IComputationError extends IGeneralError {
    row?: number;
    filename?: string;
}
