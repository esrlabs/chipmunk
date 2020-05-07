import { IStore } from './store';

export abstract class ControllerIO<T> {

    constructor(store: IStore) {
        this.read(store);
    }

    public abstract read(store: IStore);
    public abstract write(store: IStore): IStore;
    public abstract get(): T;
    public abstract set(value: T);

}
