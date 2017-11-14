import { configuration as Configuration } from '../modules/controller.config';
import { events as Events               } from '../modules/controller.events';
import { popupController                } from '../components/common/popup/controller';
import { ShortcutsList                  } from '../components/common/dialogs/shortcuts.list/component';
import { topbarMenuHandles              } from '../handles/topbar.menu.hadles';

interface Key{
    key     : string;
    code    : number;
    ctrl    : boolean;
    shift   : boolean;
    alt     : boolean;
}

class ShortcutController{
    private delay       : number        = 200;
    private keys        : Array<Key>    = [];
    private timer       : any           = null;
    private listening   : boolean       = true;
    private delayed     : Array<string> = [];

    constructor(){
        window.addEventListener('keypress', this.onKeyPress.bind(this));
        this.accept = this.accept.bind(this);
        [   Configuration.sets.EVENTS_SHORTCUTS.SHORTCUT_HELP,
            Configuration.sets.EVENTS_SHORTCUTS.SHORTCUT_OPEN_FILE,
            Configuration.sets.SYSTEM_EVENTS.SHORTCUTS_SILENCE_ON,
            Configuration.sets.SYSTEM_EVENTS.SHORTCUTS_SILENCE_OFF
        ].forEach((handle: string)=>{
            this['on' + handle] = this['on' + handle].bind(this);
            Events.bind(handle, this['on' + handle]);
        });
        this.getDelayed();
    }

    destroy(){
        [   Configuration.sets.EVENTS_SHORTCUTS.SHORTCUT_HELP,
            Configuration.sets.EVENTS_SHORTCUTS.SHORTCUT_OPEN_FILE,
            Configuration.sets.SYSTEM_EVENTS.SHORTCUTS_SILENCE_ON,
            Configuration.sets.SYSTEM_EVENTS.SHORTCUTS_SILENCE_OFF
        ].forEach((handle: string)=>{
            Events.unbind(handle, this['on' + handle]);
        });
    }

    getDelayed(){
        let RULES = Configuration.sets.KEYS_SHORTCUTS;
        Object.keys(RULES).forEach((key)=>{
            RULES[key].keys.length > 1 && this.delayed.push(RULES[key].keys[0].key);
        });
    }

    onSHORTCUTS_SILENCE_ON(){
        this.listening = false;
    }

    onSHORTCUTS_SILENCE_OFF(){
        this.listening = true;
    }

    onKeyPress(event: KeyboardEvent){
        if (this.listening){
            let multiple = this.keys.length === 0 ? (~this.delayed.indexOf(event.key) ? true : false) : true;
            this.keys.push({
                key     : event.key,
                code    : event.keyCode,
                ctrl    : event.ctrlKey,
                shift   : event.shiftKey,
                alt     : event.altKey
            });
            this.timer !== null && clearTimeout(this.timer);
            if (multiple){
                this.timer = setTimeout(this.accept, this.delay);
            } else {
                this.accept();
            }
        }
    }

    isKeyIn(key : Key){
        let result = false;
        this.keys.forEach((_key: Key)=>{
            let res = true;
            Object.keys(key).forEach((prop)=>{
                if (_key[prop] === void 0 || _key[prop] !== key[prop]){
                    res = false;
                }
            });
            res && (result = true);
        });
        return result;
    }

    accept(){
        if (this.keys.length > 0){
            let sets : any  = null,
                RULES       = Configuration.sets.KEYS_SHORTCUTS;
            Object.keys(RULES).forEach((event)=>{
                if (sets === null){
                    sets = {
                        rules : RULES[event],
                        event : event
                    };
                    RULES[event].keys.forEach((key: Key)=>{
                        !this.isKeyIn(key) && (sets = null);
                    });
                }

            });
            if (sets !== null){
                if (sets.rules.asynch !== void 0 && sets.rules.asynch){
                    setTimeout(()=>{
                        Events.trigger(sets.event);
                    }, 10);
                } else {
                    Events.trigger(sets.event);
                }
            }
            this.keys = [];
        }
    }

    onSHORTCUT_HELP(){
        let popupGUID = Symbol();
        popupController.open({
            content : {
                factory     : null,
                component   : ShortcutsList,
                params      : {
                    popupGUID : popupGUID
                }
            },
            title   : _('Shortcuts map'),
            settings: {
                move            : true,
                resize          : true,
                width           : '30rem',
                height          : '20rem',
                close           : true,
                addCloseHandle  : true,
                css             : ''
            },
            buttons         : [],
            titlebuttons    : [],
            GUID            : popupGUID
        });
    }

    onSHORTCUT_OPEN_FILE(){
        topbarMenuHandles.openLocalFile();
    }

}

export { ShortcutController }
