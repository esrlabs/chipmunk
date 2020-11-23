import { RustChannelRequiered } from './native.channel.required';
import { RustAppendOperationChannelNoType } from './native';

export enum EFileOptionsRequirements {
    DLTOptions = 'DLTOptions',
    NoOptionsRequired = 'NoOptionsRequires',
}

export type TFileOptions = IFileOptionsDLT | undefined;

export interface IFileOptionsDLT {

}

// Create abstract class to declare available methods
export abstract class RustAppendOperationChannel extends RustChannelRequiered {
    public abstract append(session: string, filename: string, options: IFileOptionsDLT | undefined): void;
}

// Create a type for constructor, because abstract class doesn't have constructor
export type RustAppendOperationChannelConstructorImpl = new () => RustAppendOperationChannel;

// Assing type
export const RustAppendOperationChannelConstructor: RustAppendOperationChannelConstructorImpl = RustAppendOperationChannelNoType;
