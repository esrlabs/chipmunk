import { RustChannelRequiered } from './native.channel.required';
import { RustConcatOperationChannelNoType } from './native';
import { RustChannelConstructorImpl } from './native';

// Create abstract class to declare available methods
export abstract class RustConcatOperationChannel extends RustChannelRequiered {
    public abstract concat(session: string, files: any[]): void;
}

// Assing type
export const RustConcatOperationChannelConstructor: RustChannelConstructorImpl<RustConcatOperationChannel> = RustConcatOperationChannelNoType;
