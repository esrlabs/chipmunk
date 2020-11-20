import { RustChannelRequiered } from './native.channel.required';
import { RustExportOperationChannelNoType } from './native';

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

// Create a type for constructor, because abstract class doesn't have constructor
export type RustExportOperationChannelConstructorImpl = new () => RustExportOperationChannel;

// Assing type
export const RustExportOperationChannelConstructor: RustExportOperationChannelConstructorImpl = RustExportOperationChannelNoType;
