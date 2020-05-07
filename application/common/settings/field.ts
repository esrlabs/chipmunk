export enum ESettingsFieldControll {
    checkbox = 'checkbox',
    dropdown = 'dropdown',
    list = 'list',
    textinput = 'textinput',
    numinput = 'numinput',
}

export interface ISettingsField<T> {
    name: string;
    description: string;
    element: ESettingsFieldControll;
    value: T;
    default: T;
    values: T[];
}
