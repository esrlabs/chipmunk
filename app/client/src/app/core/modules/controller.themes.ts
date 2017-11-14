import { localSettings, KEYs            } from '../modules/controller.localsettings';
import { events as Events               } from '../modules/controller.events';
import { configuration as Configuration } from '../modules/controller.config';
import { popupController                } from '../components/common/popup/controller';
import { DialogThemesList               } from '../components/common/dialogs/themes.list/component';
import { DialogMessage                  } from '../components/common/dialogs/dialog-message/component';


class ControllerThemes {

    defaults(){
        return Configuration.sets.THEMES.default;
    }

    load(){
        let settings = localSettings.get();
        if (settings !== null && settings[KEYs.themes] !== void 0 && settings[KEYs.themes] !== null && settings[KEYs.themes].current !== void 0){
            return settings[KEYs.themes].current;
        } else {
            return this.defaults();
        }
    }

    save(theme: string){
        if (typeof theme === 'string' && theme.trim() !== ''){
            localSettings.set({
                [KEYs.themes] : {
                    current : theme
                }
            });
        }
    }

    init() {
        let current = this.load();
        let link = document.createElement('LINK');
        link.setAttribute('rel', 'stylesheet');
        link.setAttribute('href', `./app/css/${current}`);
        document.head.appendChild(link);
    }

    oneSelectThemeDialog(){
        let GUID = Symbol();
        popupController.open({
            content : {
                factory     : null,
                component   : DialogThemesList,
                params      : {
                    themes  : Configuration.sets.THEMES.LIST,
                    handler : function (GUID: symbol, file: string, settings: boolean) {
                        popupController.close(GUID);
                        this.save(file);
                        this.confirmRestart();
                    }.bind(this, GUID)
                }
            },
            title   : _('Available themes'),
            settings: {
                move            : true,
                resize          : true,
                width           : '20rem',
                height          : '10rem',
                close           : true,
                addCloseHandle  : true,
                css             : ''
            },
            buttons         : [],
            titlebuttons    : [],
            GUID            : GUID
        });
    }

    confirmRestart(){
        let popup   = Symbol();
        popupController.open({
            content : {
                factory     : null,
                component   : DialogMessage,
                params      : {
                    message : 'To apply changes you should restart application.',
                    buttons : [
                        { caption: 'Yes, restart it',       handle: ()=>{ window.location.reload(); popupController.close(popup); }},
                        { caption: 'No, do it later it',    handle: ()=>{ popupController.close(popup); }},

                    ]
                }
            },
            title   : _('Confirmation'),
            settings: {
                move            : true,
                resize          : true,
                width           : '30rem',
                height          : '10rem',
                close           : true,
                addCloseHandle  : true,
                css             : ''
            },
            buttons         : [],
            titlebuttons    : [],
            GUID            : popup
        });
    }

}

const controllerThemes = new ControllerThemes();

export { controllerThemes };