import { RustChannelRequiered } from './native.channel.required';
import { RustTimeFormatDetectOperationChannelNoType } from './native';
import { RustChannelConstructorImpl } from './native';

// Create abstract class to declare available methods
export abstract class RustTimeFormatDetectOperationChannel extends RustChannelRequiered {
    public abstract detect(session: string): void;
}

// Assing type
export const RustTimeFormatDetectOperationChannelConstructor: RustChannelConstructorImpl<RustTimeFormatDetectOperationChannel> = RustTimeFormatDetectOperationChannelNoType;
