export declare const customTypedRowRender: {
    isTypeMatch: (sourceName: string) => boolean;
    type: string;
    api: {
        getHeaders: () => string[];
        getColumns: (str: string) => string[];
        getDefaultWidths: () => {
            width: number;
            min: number;
        }[];
    };
};
export * from './lib/module';
