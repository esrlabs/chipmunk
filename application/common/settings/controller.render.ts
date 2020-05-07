import { IStore } from './store';

export enum ESettingsFieldControll {
    checkbox = 'checkbox',
    dropdown = 'dropdown',
    list = 'list',
    textinput = 'textinput',
    numinput = 'numinput',
}

export abstract class ControllerRender<T> {

    constructor(store: IStore) {
        this.read(store);
    }

    public abstract read(store: IStore);
    public abstract write(store: IStore): IStore;
    public abstract getControll(): ESettingsFieldControll;
    public abstract set(value: T);
    public abstract getDefault(): T;

}
