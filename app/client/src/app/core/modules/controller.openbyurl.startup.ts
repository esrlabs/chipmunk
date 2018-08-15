import {events as Events} from "./controller.events";
import {configuration as Configuration} from "./controller.config";
import {ProgressBarCircle} from "../components/common/progressbar.circle/component";
import {DIRECTIONS, Method, Request as AJAXRequest} from "./tools.ajax";
import {popupController} from "../components/common/popup/controller";

export class OpenByURLOnStartUp {

    constructor(){
        Events.bind(Configuration.sets.SYSTEM_EVENTS.DATA_WORKER_IS_READY, this.onDATA_WORKER_IS_READY.bind(this));
    }

    onDATA_WORKER_IS_READY(){
        if (typeof location.href !== 'string' || location.href.trim() === '') {
            return;
        }
        const params: any = location.href.split('?')[1];
        if (typeof params !== 'string') {
            return;
        }
        let url = '';
        params.split('&').forEach((str: string) => {
            const pair = str.split('=');
            if (pair.length !== 2) {
                return;
            }
            if (pair[0] !== 'openbyurl'){
                return;
            }
            if (pair[1].trim() === '') {
                return;
            }
            url = decodeURIComponent(pair[1]);
        });
        if (url === '') {
            return;
        }
        const progress = Symbol();
        popupController.open({
            content : {
                factory     : null,
                component   : ProgressBarCircle,
                params      : {}
            },
            title   : 'Please, wait...',
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
            GUID            : progress
        });
        let request = new AJAXRequest({
            url         : url,
            method      : new Method(DIRECTIONS.GET)
        }).then((response : any)=>{
            popupController.close(progress);
            if (typeof response === 'object' && response !== null) {
                response = JSON.stringify(response);
            } else if (typeof response !== 'string'){
                return false;
            }
            Events.trigger(Configuration.sets.SYSTEM_EVENTS.DESCRIPTION_OF_STREAM_UPDATED, url);
            Events.trigger(Configuration.sets.SYSTEM_EVENTS.TXT_DATA_COME, response);
        }).catch((error : Error)=>{
            popupController.close(progress);
        });
        request.send();
    }
}

