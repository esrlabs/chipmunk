import { RustChannelRequiered } from './native.channel.required';
import { RustTimeFormatDetectOperationChannelNoType } from './native';

// Create abstract class to declare available methods
export abstract class RustTimeFormatDetectOperationChannel extends RustChannelRequiered {
    public abstract detect(session: string): void;
}

// Create a type for constructor, because abstract class doesn't have constructor
export type RustTimeFormatDetectOperationChannelConstructorImpl = new () => RustTimeFormatDetectOperationChannel;

// Assing type
export const RustTimeFormatDetectOperationChannelConstructor: RustTimeFormatDetectOperationChannelConstructorImpl = RustTimeFormatDetectOperationChannelNoType;
