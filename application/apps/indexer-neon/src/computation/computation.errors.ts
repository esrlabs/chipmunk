import { IGeneralError } from '../interfaces/errors';

export interface IComputationError extends IGeneralError {
    row?: number;
    filename?: string;
}
