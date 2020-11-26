import { RustChannelRequiered } from './native.channel.required';
import { RustTimeFormatExtractOperationChannelNoType } from './native';
import { RustChannelConstructorImpl } from './native';

// Create abstract class to declare available methods
export abstract class RustTimeFormatExtractOperationChannel extends RustChannelRequiered {
    public abstract extract(session: string): void;
}

// Assing type
export const RustTimeFormatExtractOperationChannelConstructor: RustChannelConstructorImpl<RustTimeFormatExtractOperationChannel> = RustTimeFormatExtractOperationChannelNoType;
