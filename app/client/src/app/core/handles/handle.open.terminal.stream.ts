import { MenuHandleInterface            } from './handle.interface';
import { popupController                } from '../components/common/popup/controller';
import { ProgressBarCircle              } from '../components/common/progressbar.circle/component';
import { SimpleText                     } from '../components/common/text/simple/component';

import { events as Events               } from '../modules/controller.events';
import { configuration as Configuration } from '../modules/controller.config';

import { APIProcessor                   } from '../api/api.processor';
import { APICommands                    } from '../api/api.commands';
import { APIResponse                    } from '../api/api.response.interface';
import { DialogTerminalStreamOpen       } from '../components/common/dialogs/terminal.open/component';

interface Entry {
    original: string
}

interface IncomeData{
    stream  : string,
    entries : Array<Entry>
}

interface StreamParameters {
    alias       : string,
    parameters  : Array<string>,
    keywords    : Array<string>
}

const STREAM_STATE = {
    WORKING : Symbol(),
    STOPPED : Symbol(),
    PAUSED  : Symbol(),
};

const BUTTONS_ICONS = {
    STOP    : 'fa-stop-circle-o',
    PLAY    : 'fa-play-circle-o',
    PAUSE   : 'fa-pause-circle-o',
};

const BUTTONS_CAPTIONS = {
    STOP    : 'stop stream',
    PLAY    : 'restore stream',
    PAUSE   : 'pause stream',
};

const ERRORS = {
    EXECUTING_ERROR : 'EXECUTING_ERROR'
};

class TerminalStream {
    private state       : symbol                = STREAM_STATE.WORKING;
    private buffer      : string                = '';
    private stream      : string                = null;
    private buttons     = {
        STOP        : Symbol(),
        PLAYPAUSE   : Symbol(),
        SETTINGS    : Symbol()
    };

    constructor (stream: string){
        this.stream             = stream;
        this.onData             = this.onData.bind(this);
        this.onClose            = this.onClose.bind(this);
        this.onStop             = this.onStop.bind(this);
        this.onPause            = this.onPause.bind(this);
        this.onStreamReset      = this.onStreamReset.bind(this);
        this.onLostConnection   = this.onLostConnection.bind(this);
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.DESCRIPTION_OF_STREAM_UPDATED,  'Terminal stream');
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.TXT_DATA_COME,                  '');
        Events.bind(Configuration.sets.SYSTEM_EVENTS.TERM_PROCESS_DATA_COME,            this.onData);
        Events.bind(Configuration.sets.SYSTEM_EVENTS.TERM_PROCESS_CLOSED,               this.onClose);
        Events.bind(Configuration.sets.SYSTEM_EVENTS.TXT_DATA_COME,                     this.onStreamReset);
        Events.bind(Configuration.sets.SYSTEM_EVENTS.WS_DISCONNECTED,                   this.onLostConnection);
        this.addButtonsInToolBar();
    }

    addButtonsInToolBar(){
        Events.trigger(Configuration.sets.EVENTS_TOOLBAR.ADD_BUTTON, [
            { id : this.buttons.STOP,       icon: BUTTONS_ICONS.STOP,       caption : BUTTONS_CAPTIONS.STOP,        handle: this.onStop,        enable: true},
            { id : this.buttons.PLAYPAUSE,  icon: BUTTONS_ICONS.PAUSE,      caption : BUTTONS_CAPTIONS.PAUSE,       handle: this.onPause,       enable: true},
        ]);
    }

    destroy(){
        //Unbind events
        Events.unbind(Configuration.sets.SYSTEM_EVENTS.TERM_PROCESS_DATA_COME,  this.onData);
        Events.unbind(Configuration.sets.SYSTEM_EVENTS.TERM_PROCESS_CLOSED,     this.onClose);
        Events.unbind(Configuration.sets.SYSTEM_EVENTS.TXT_DATA_COME,           this.onStreamReset);
        Events.unbind(Configuration.sets.SYSTEM_EVENTS.WS_DISCONNECTED,         this.onLostConnection);
        //Kill buttons
        Object.keys(this.buttons).forEach((button)=>{
            Events.trigger(Configuration.sets.EVENTS_TOOLBAR.REMOVE_BUTTON, this.buttons[button]);
        });
        //Reset titles
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.DESCRIPTION_OF_STREAM_UPDATED, _('No active stream or file opened'));
    }

    onClose(params : IncomeData){
        if (this.stream === params.stream){
            this.onStopped(null);
        }
    }

    onStop(){
        if (this.state !== STREAM_STATE.STOPPED){
            let processor   = APIProcessor;
            this.state      = STREAM_STATE.STOPPED;
            processor.send(
                APICommands.closeProcessStream,
                {
                    stream      : this.stream
                },
                this.onStopped.bind(this)
            );
        }
    }

    onStopped(response : APIResponse){
        this.destroy();
    }

    onPause(){
        let alias = null;
        switch (this.state){
            case STREAM_STATE.WORKING:
                this.state  = STREAM_STATE.PAUSED;
                alias       = 'PLAY';
                break;
            case STREAM_STATE.PAUSED:
                this.state  = STREAM_STATE.WORKING;
                alias       = 'PAUSE';
                this.onData({
                    stream  : this.stream,
                    entries : []
                });
                break;
        }
        alias !== null && Events.trigger(Configuration.sets.EVENTS_TOOLBAR.UPDATE_BUTTON, {
            id      : this.buttons.PLAYPAUSE,
            icon    : BUTTONS_ICONS     [alias],
            caption : BUTTONS_CAPTIONS  [alias]
        });
    }

    onStreamReset(){
        this.onStop();
    }

    onData(params : IncomeData){
        if (this.stream === params.stream){
            switch (this.state){
                case STREAM_STATE.WORKING:
                    this.buffer += params.entries.map((entry) => { return entry.original;}).join('\n') + '\n';
                    Events.trigger(Configuration.sets.SYSTEM_EVENTS.STREAM_DATA_UPDATE, this.buffer);
                    this.buffer = '';
                    break;
                case STREAM_STATE.PAUSED:
                    this.buffer += params.entries.map((entry) => { return entry.original;}).join('\n');
                    break;
                case STREAM_STATE.STOPPED:
                    break;
            }
        }
    }

    onLostConnection(){
        this.destroy();
    }

}

class OpenTerminalStream implements MenuHandleInterface{
    private GUID            : symbol                = Symbol();
    private progressGUID    : symbol                = Symbol();
    private processor       : any                   = APIProcessor;
    private listening       : boolean               = false;
    private stream          : TerminalStream        = null;

    constructor(){
        /*
        this.onShortcutOpen = this.onShortcutOpen.bind(this);
        Events.bind(Configuration.sets.EVENTS_SHORTCUTS.SHORTCUT_TERMINAL_COMMAND,  this.onShortcutOpen);
        */
    }

    onShortcutOpen(){
        this.showOpen();
    }

    start(){
        this.showOpen();
    }

    openStream(params: StreamParameters){
        this.showProgress(_('Please wait... Opening...'));
        this.closeStream();
        this.processor.send(
            APICommands.openProcessStream,
            {
                alias       : params.alias,
                parameters  : params.parameters,
                keywords    : params.keywords
            },
            this.onStreamOpened.bind(this)
        );
    }

    onStreamOpened(response : APIResponse, error: Error){
        this.hidePopup(this.progressGUID);
        if (error === null){
            if (response.code === 0 && typeof response.output === 'string'){
                //Everything is cool.
                this.listening = true;
                this.attachStream(response.output);
            } else{
                this.showMessage(_('Error'), _('Server returned failed result. Code of error: ') + response.code + _('. Addition data: ') + this.outputToString(response.output));
            }
        } else {
            this.showMessage(_('Error'), error.message);
        }
    }

    closeStream(){
        if (this.stream !== null) {
            this.stream.onStop();
            this.stream = null;
        }
    }

    attachStream(stream: string){
        this.stream = new TerminalStream(stream);
    }

    outputToString(output: any){
        if (typeof output === 'string') {
            return output;
        } else if (typeof output === 'number'){
            return output.toString();
        } else if (typeof output === 'object'){
            return JSON.stringify(output);
        }
    }

    showMessage(title: string, message: string){
        popupController.open({
            content : {
                factory     : null,
                component   : SimpleText,
                params      : {
                    text: message
                }
            },
            title   : title,
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
            GUID            : Symbol()
        });
    }

    showProgress(caption : string){
        this.progressGUID = Symbol();
        popupController.open({
            content : {
                factory     : null,
                component   : ProgressBarCircle,
                params      : {}
            },
            title   : caption,
            settings: {
                move            : false,
                resize          : false,
                width           : '20rem',
                height          : '10rem',
                close           : false,
                addCloseHandle  : false,
                css             : ''
            },
            buttons         : [],
            titlebuttons    : [],
            GUID            : this.progressGUID
        });
    }

    showOpen(){
        let GUID        = Symbol();
        popupController.open({
            content : {
                factory     : null,
                component   : DialogTerminalStreamOpen,
                params      : {
                    alias   : '',
                    path    : '',
                    keywords: '',
                    proceed : this.onApplyOpen.bind(this, GUID),
                    cancel  : this.onCancelOpen.bind(this, GUID)
                }
            },
            title   : _('Opening terminal stream: '),
            settings: {
                move            : true,
                resize          : true,
                width           : '40rem',
                height          : '35rem',
                close           : true,
                addCloseHandle  : true,
                css             : ''
            },
            buttons         : [],
            titlebuttons    : [],
            GUID            : GUID
        });
    }

    onApplyOpen(GUID: symbol, data: any){
        this.hidePopup(GUID);
        let parts = data.alias.split(' ');
        if (parts.length === 0) {
            return false;
        }
        let params : StreamParameters = {
            alias       : parts[0],
            parameters  : parts.length > 1 ? parts.splice(1, parts.length) : [],
            keywords    : data.keywords.split(';')
        };
        if (params.alias.trim() === '') {
            return false;
        }
        this.openStream(params);
    }

    onCancelOpen(GUID: symbol){
        this.hidePopup(GUID);
    }

    hidePopup(GUID: symbol){
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.REMOVE_FROM_ROOT_HOLDER, GUID);
    }

}

export { OpenTerminalStream };
