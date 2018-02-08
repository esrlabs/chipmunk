import { ISettings } from './controller.settings';

const VERSION_ALIAS = 'version';

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

    reset(){
        if (typeof window === 'undefined') {
            return null;
        }
        return window.localStorage.clear();
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
