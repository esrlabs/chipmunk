import { RustChannelRequiered } from './native.channel.required';
import { RustMergeOperationChannelNoType } from './native';

// Create abstract class to declare available methods
export abstract class RustMergeOperationChannel extends RustChannelRequiered {
    public abstract merge(session: string, files: any[]): void;
}

// Create a type for constructor, because abstract class doesn't have constructor
export type RustMergeOperationChannelConstructorImpl = new () => RustMergeOperationChannel;

// Assing type
export const RustMergeOperationChannelConstructor: RustMergeOperationChannelConstructorImpl = RustMergeOperationChannelNoType;
