import { RustChannelRequiered } from './native.channel.required';
import { RustTimeFormatExtractOperationChannelNoType } from './native';

// Create abstract class to declare available methods
export abstract class RustTimeFormatExtractOperationChannel extends RustChannelRequiered {
    public abstract extract(session: string): void;
}

// Create a type for constructor, because abstract class doesn't have constructor
export type RustTimeFormatExtractOperationChannelConstructorImpl = new () => RustTimeFormatExtractOperationChannel;

// Assing type
export const RustTimeFormatExtractOperationChannelConstructor: RustTimeFormatExtractOperationChannelConstructorImpl = RustTimeFormatExtractOperationChannelNoType;
