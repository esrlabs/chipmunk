import { Value } from '@platform/types/bindings';
import { Element } from './index';

export abstract class ElementInner {
    public abstract getValue(): Value;
    public abstract getInnerValue(): any;
    public abstract setValue(value: any): void;
    public abstract isField(): boolean;
    public setParentRef(_parent: Element): void {
        // This method is optional. That's why it has default implementation.
    }
}
