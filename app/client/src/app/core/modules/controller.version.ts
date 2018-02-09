import { ISettings } from './controller.settings';

const VERSION_ALIAS = 'version';
const DROP_SETTINGS_ALIAS = 'drop_rules';
const STORAGE_ALIAS = 'logviewer.localstare';

class VersionController {

    private configuration: any = null;

    init(callback: Function){
        this.configuration = require('./controller.config').configuration;
        if (!this.isValid()) {
            this.reset();
            this.save();
        }
        typeof callback === 'function' && callback();
    }

    private getVersion(){
        if (typeof window === 'undefined') {
            return null;
        }
        return window.localStorage.getItem(VERSION_ALIAS);
    }

    getSettings(){
        return this.configuration.sets.SETTINGS as ISettings;
    }

    isValid(){
        const settings = this.getSettings();
        if (typeof settings !== 'object' || settings === null || settings[VERSION_ALIAS] === void 0) {
            return false;
        }
        return this.getVersion() === settings[VERSION_ALIAS];
    }

    private getCurrentStorage(){
        if (typeof window === 'undefined') {
            return null;
        }
        let result = window.localStorage.getItem(STORAGE_ALIAS);
        if (typeof result === 'string'){
            try {
                result = JSON.parse(result);
            } catch (e) {
                result = null;
            }
        } else if (typeof result !== 'object'){
            result = null;
        }
        return result;
    }

    private setCurrentStorage(storage: Object){
        if (typeof window !== 'undefined'){
            window.localStorage.setItem(STORAGE_ALIAS, JSON.stringify(storage));
        }
    }

    reset(){
        if (typeof window === 'undefined') {
            return null;
        }
        let storage         = this.getCurrentStorage();
        let dropSettings    = this.getSettings()[DROP_SETTINGS_ALIAS];
        if (storage !== null && dropSettings instanceof Array){
            dropSettings.forEach((section: string) => {
                storage[section] = null;
            });
            this.setCurrentStorage(storage);
            return true;
        }
        return false;
    }

    save(){
        const settings = this.getSettings();
        if (typeof settings !== 'object' || settings === null || settings[VERSION_ALIAS] === void 0) {
            return false;
        }
        if (typeof window === 'undefined') {
            return null;
        }
        window.localStorage.setItem(VERSION_ALIAS, settings[VERSION_ALIAS]);
    }

}

const versionController = new VersionController();

export { versionController };
