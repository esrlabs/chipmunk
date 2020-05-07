export enum EElement {
    checkbox = 'checkbox',
    dropdown = 'dropdown',
    list = 'list',
    textinput = 'textinput',
    numinput = 'numinput',
}

export abstract class Element<T> {

    public abstract getValue(): T;
    public abstract setValue(value: T);

}
