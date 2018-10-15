import { popupController    } from '../components/common/popup/controller';
import { DialogMessage      } from '../components/common/dialogs/dialog-message/component';

interface IStreamDescription {
    name: string,
    closer: () => Promise<void>
}

class StreamController {

    private _stream: IStreamDescription | null = null;

    // Register current stream
    register(stream: IStreamDescription): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this._stream === null) {
                this._stream = stream;
                return resolve();
            }
            this._dialog(stream, resolve, reject);
        });
    }

    confirm(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this._stream === null) {
                return resolve();
            }
            this._dialog(null, resolve, reject);
        });
    }

    reset() {
        this._stream = null;
    }

    private _dialog(stream: IStreamDescription | null, resolve: any, reject: any){
        const dialogGUID = Symbol();
        popupController.open({
            content : {
                factory     : null,
                component   : DialogMessage,
                params      : {
                    message: `Note: you already have an active stream "${this._stream.name}". To open new stream you have to close this. Should it be closed?`,
                    buttons: [
                        {
                            caption: 'Yes, close and open new',
                            handle : () => {
                                popupController.close(dialogGUID);
                                this._stream.closer().then(() => {
                                    this._stream = stream;
                                    return resolve();
                                }).catch(reject);
                            }
                        },
                        {
                            caption: 'No, keep it',
                            handle : ()=>{
                                popupController.close(dialogGUID);
                                reject();
                            }
                        }
                    ]
                }
            },
            title   : 'Notification',
            settings: {
                move            : true,
                resize          : true,
                width           : '30rem',
                height          : '15rem',
                close           : true,
                addCloseHandle  : true,
                css             : ''
            },
            buttons         : [],
            titlebuttons    : [],
            GUID            : dialogGUID
        });
    }


}

export default (new StreamController());