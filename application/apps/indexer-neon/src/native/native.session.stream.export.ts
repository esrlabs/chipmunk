import { RustChannelRequiered } from './native.channel.required';
import { RustExportOperationChannelNoType } from './native';
import { RustChannelConstructorImpl } from './native';

export interface IExportOptions {
    from: number;
    to: number;
    destFilename: string;
    keepFormat: boolean;
}

// Create abstract class to declare available methods
export abstract class RustExportOperationChannel extends RustChannelRequiered {
    public abstract export(session: string, options: IExportOptions): void;
}

// Assing type
export const RustExportOperationChannelConstructor: RustChannelConstructorImpl<RustExportOperationChannel> = RustExportOperationChannelNoType;
