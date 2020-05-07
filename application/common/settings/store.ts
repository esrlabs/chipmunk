export interface IStore {
    [key: string]: string | boolean | number | IStore;
}
