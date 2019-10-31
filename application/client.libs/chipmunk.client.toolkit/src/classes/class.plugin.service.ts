import { IAPI } from '../interfaces/api';
import Subject from '../tools/tools.subject';

const CSignature = 'APluginService';

export abstract class APluginService {

    private _apiGetter: () => IAPI | undefined;

    public onAPIReady: Subject<boolean> = new Subject();

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

    public setAPIGetter(getter: () => IAPI | undefined) {
        this._apiGetter = getter;
        this.onAPIReady.emit(true);
    }

    public getAPI(): IAPI | undefined {
        return this._apiGetter === undefined ? undefined : this._apiGetter();
    }

}
