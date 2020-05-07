export enum ESettingController {
    checkbox = 'checkbox',
    dropdown = 'dropdown',
    list = 'list',
    textinput = 'textinput',
    numinput = 'numinput',
}

export enum ESettingKey {
    GlobalGroup = 'global',
    UpdateGroup = 'global.updates',
}

export interface IEntry {
    key: string;
    path: string;
    name: string;
    desc: string;
}

export interface IGroup extends IEntry {
    // We need it just for naming
}

export interface IField<T> extends IEntry {
    controller: ESettingController;
    value: T;
    validate: (value: T) => boolean;
    default: T;
    options: T[];
}

export interface IStore {
    [key: string]: IField<any> | IGroup;
}

interface IEntryDesc {
    name: string;
    type: string;
}

const CEntryProps: IEntryDesc[] = [
    { name: 'key', type: 'string' },
    { name: 'path', type: 'string' },
    { name: 'name', type: 'string' },
    { name: 'desc', type: 'string' },
];

export function validate(entry: IEntry): Error | undefined {
    if (typeof entry !== 'object' || entry === null) {
        return new Error(`"entry" is not valid.`);
    }
    let error: Error | undefined;
    CEntryProps.forEach((_entry: IEntryDesc) => {
        if (error !== undefined) {
            return;
        }
        if (typeof entry[_entry.name] !== typeof _entry.type) {
            error = new Error(`Key "${_entry.name}" has wrong type "${typeof entry[_entry.name]}", but expected "${_entry.type}"`);
        }
    });
    return error;
}

export function register(store: IStore, entry: IEntry): void {
    
};

export function find(store: IStore, entry: IEntry): IStore | Error {
    if (typeof store !== 'object' || store === null) {
        return new Error(`"store" is not valid.`);
    }
    if (typeof entry !== 'object' || entry === null) {
        return new Error(`"entry" is not valid.`);
    }
    if (entry.path === '') {

    }
};

