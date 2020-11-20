import { RustChannelRequiered } from './native.channel.required';
import { RustConcatOperationChannelNoType } from './native';

// Create abstract class to declare available methods
export abstract class RustConcatOperationChannel extends RustChannelRequiered {
    public abstract concat(session: string, files: any[]): void;
}

// Create a type for constructor, because abstract class doesn't have constructor
export type RustConcatOperationChannelConstructorImpl = new () => RustConcatOperationChannel;

// Assing type
export const RustConcatOperationChannelConstructor: RustConcatOperationChannelConstructorImpl = RustConcatOperationChannelNoType;
