import { IGeneralError } from '../interfaces/errors';
/*
export interface IProviderError extends IGeneralError {
    row?: number;
    filename?: string;
}
*/

export enum EErrorSeverity {
    warn = 'warn',
    error = 'error',
    logs = 'logs',
}

export enum EErrorKind {
    something = 'something',
}