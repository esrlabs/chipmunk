const CSignature = 'PluginNgModule';

/**
 * Root module class for Angular plugin. Should be used by the developer of a plugin (based on Angular) to
 * let core know, which module is a root module of plugin.
 * One plugin can have only one instance of this module.
 * @usecases views, complex components, addition tabs, Angular components
 * @requirements Angular, TypeScript
 * @class PluginNgModule
 */
export class PluginNgModule {

    private _name: string;
    private _description: string;

    constructor(name: string, description: string) {
        this._name = name;
        this._description = description;
    }

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

}
