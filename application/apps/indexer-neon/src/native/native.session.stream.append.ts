import { RustChannelRequiered } from './native.channel.required';
import { RustAppendOperationChannelNoType } from './native';
import { RustChannelConstructorImpl } from './native';

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

// Assing type
export const RustAppendOperationChannelConstructor: RustChannelConstructorImpl<RustAppendOperationChannel> = RustAppendOperationChannelNoType;
