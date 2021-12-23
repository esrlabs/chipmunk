export enum EStoreKeys {
    filters = 'filters',
    charts = 'charts',
    ranges = 'ranges',
    disabled = 'disabled',
}

export interface IStoreData {
    [key: string]: any;
}

export interface IStore<T> {
    store(): {
        key(): EStoreKeys;
        extract(): IStoreData;
        upload(data: T, append: boolean): Error | undefined;
        getItemsCount(): number;
    };
}
