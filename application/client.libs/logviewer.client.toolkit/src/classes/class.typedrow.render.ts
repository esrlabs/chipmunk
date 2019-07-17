import { ETypedRowRenders } from '../consts/enums';

export abstract class ATypedRowRender<T> {

    public abstract isTypeMatch(sourceName: string): boolean;
    public abstract getType(): ETypedRowRenders;
    public abstract getAPI(): T;

}
