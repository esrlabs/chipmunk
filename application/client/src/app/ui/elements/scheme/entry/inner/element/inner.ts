import { Value } from '@platform/types/bindings';
import { Element } from './index';
import { SchemeProvider } from '@ui/elements/scheme/provider';
import { Subscriber } from '@platform/env/subscription';

export enum FieldCategory {
    Block = 'block',
    Inline = 'inline',
    Row = 'row',
}
export abstract class ElementInner extends Subscriber {
    public abstract getValue(): Value;
    public abstract getInnerValue(): any;
    public abstract setValue(value: any): void;
    public abstract getFieldCategory(): FieldCategory;
    public destroy(): void {
        this.unsubscribe();
        // This method is optional. That's why it has default implementation.
    }
    public setParentRef(_parent: Element): void {
        // This method is optional. That's why it has default implementation.
    }
    public setProviderRef(_provider: SchemeProvider): void {
        // This method is optional. That's why it has default implementation.
    }
}
