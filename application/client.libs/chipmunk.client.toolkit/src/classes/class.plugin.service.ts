import { IAPI } from '../interfaces/api';
import Subject from '../tools/tools.subject';

const CSignature = 'PluginService';

/**
 * Service which can be used to get access to plugin API
 * Plugin API has a collection of methods to listen to major core events and
 * communicate between render and host of plugin.
 * Into plugin's Angular components (like tabs, panels, and dialogs) API object will be
 * delivered via inputs of a component. But to have global access to API developer can
 * create an instance of this class.
 *
 * Note: an instance of this class should be exported with PluginNgModule (for Angular plugins) or
 * with APluginServiceGate.setPluginExports (for none-Angular plugins)
 *
 * @usecases Create global (in the scope of plugin) service with access to plugin's API and core's API
 * @class PluginService
 */
export abstract class PluginService {
    private _apiGetter!: () => IAPI | undefined;

    /**
     * @property {Subject<boolean>} onAPIReady subject will be emitted on API is ready to use
     */
    public onAPIReady: Subject<boolean> = new Subject();

    /**
     * Internal usage
     */
    public static getClassSignature(): string {
        return CSignature;
    }

    /**
     * Internal usage
     */
    public getClassSignature(): string {
        return CSignature;
    }

    /**
     * Internal usage
     */
    public static isInstance(smth: any): boolean {
        if (smth === undefined || smth === null) {
            return false;
        }
        if (typeof smth.getClassSignature !== 'function') {
            return false;
        }
        return smth.getClassSignature() === CSignature;
    }

    /**
     * Internal usage
     */
    public setAPIGetter(getter: () => IAPI | undefined) {
        this._apiGetter = getter;
        this.onAPIReady.emit(true);
    }

    /**
     * Should be used to get access to API of plugin and core.
     * Note: will return undefined before onAPIReady will be emitted
     * @returns {API | undefined} returns an instance of API or undefined if API isn't ready to use
     */
    public getAPI(): IAPI | undefined {
        return this._apiGetter === undefined ? undefined : this._apiGetter();
    }
}

// Back compatibility (from 0.0.87)
export { PluginService as APluginService };
