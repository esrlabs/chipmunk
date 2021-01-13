import { IGeneralError } from '../interfaces/errors';

export interface IProviderError extends IGeneralError {
    row?: number;
    filename?: string;
}
