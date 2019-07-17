export interface IComponentInjection {
    id: string;
    factory: any;
    resolved?: boolean;
    inputs: { [key: string]: any };
}
