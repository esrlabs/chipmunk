import { IAPI } from '../interfaces/api';

export type TAPIGetter = () => IAPI | undefined;

const CSignature = 'APluginService';

export abstract class APluginService {

    private _apiGetter: TAPIGetter;

    public getClassSignature(): string {
        return CSignature;
    }

    public static isInstance(smth: any): boolean {
        if (typeof smth !== 'object' || smth === null) {
            return false;
        }
        if (typeof smth.getClassSignature !== 'function') {
            return false;
        }
        return smth.getClassSignature() === CSignature;
    }

    public setAPIGetter(getter: TAPIGetter) {
        this._apiGetter = getter;
    }

    public getAPI(): IAPI | undefined {
        return this._apiGetter === undefined ? undefined : this._apiGetter();
    }

}
