
export interface IClient {
    indexHtml: string;
}

export interface ISettings {
    client: IClient;
}

export const defaults: ISettings = {
    client: {
        indexHtml: 'client/index.html',
    },
};
