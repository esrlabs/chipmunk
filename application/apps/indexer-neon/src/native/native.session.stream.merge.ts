import { RustChannelRequiered } from './native.channel.required';
import { RustMergeOperationChannelNoType } from './native';
import { RustChannelConstructorImpl } from './native';

// Create abstract class to declare available methods
export abstract class RustMergeOperationChannel extends RustChannelRequiered {
    public abstract merge(session: string, files: any[]): void;
}

// Assing type
export const RustMergeOperationChannelConstructor: RustChannelConstructorImpl<RustMergeOperationChannel> = RustMergeOperationChannelNoType;
