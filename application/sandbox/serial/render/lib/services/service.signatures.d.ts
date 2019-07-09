export interface ISignature {
    title: string;
    color: string;
    clean: string;
}
export declare const CDelimiters: {
    signature: string;
};
declare class ServiceSignatures {
    private _colors;
    getSignature(str: string): ISignature;
    private _getColor;
}
declare const _default: ServiceSignatures;
export default _default;
