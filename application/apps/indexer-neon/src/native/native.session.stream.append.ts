import { RustChannelRequiered } from './native.channel.required';
import { RustAppendOperationChannelNoType } from './native';

// Create abstract class to declare available methods
export abstract class RustAppendOperationChannel extends RustChannelRequiered {
    public abstract append(session: string, filename: string): void;
}

// Create a type for constructor, because abstract class doesn't have constructor
export type RustAppendOperationChannelConstructorImpl = new () => RustAppendOperationChannel;

// Assing type
export const RustAppendOperationChannelConstructor: RustAppendOperationChannelConstructorImpl = RustAppendOperationChannelNoType;
