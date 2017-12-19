import { fileLoaderController           } from '../components/common/fileloader/controller';
import { popupController                } from '../components/common/popup/controller';
import { ProgressBarCircle              } from '../components/common/progressbar.circle/component';

import { events as Events               } from '../modules/controller.events';
import { configuration as Configuration } from '../modules/controller.config';

import { OpenRemoteFileStream           } from '../handles/handle.open.remote.file.stream';
import { OpenSerialStream               } from '../handles/handle.open.serial.stream';
import { OpenADBLogcatStream            } from '../handles/handle.open.adblogcat.stream';
import { OpenTerminalStream             } from '../handles/handle.open.terminal.stream';

import { AddView                        } from '../handles/handle.add.view';
import { APISettings                    } from '../handles/handle.api.settings';
import { controllerThemes               } from '../modules/controller.themes';

class TopBarMenuHandles{

    constructor() {

    }

    openLocalFile(){
        function ShowWaitPopup(){
            GUID = Symbol();
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
                GUID            : GUID
            });
        }

        let GUID : any = null;
        fileLoaderController.open(Symbol(), {
            load    : (data : string, files: Array<File>)=>{
                if (files instanceof FileList){
                    let description = '';
                    Array.prototype.forEach.call(files, (file : File)=>{
                        description += (description !== '' ? '; ' : '') + file.name + ' (' + Math.round(file.size / 1024) + ' kB)';
                    });
                    description = 'Files: ' + description;
                    Events.trigger(Configuration.sets.SYSTEM_EVENTS.DESCRIPTION_OF_STREAM_UPDATED, description);
                }
                GUID === null && ShowWaitPopup();
                Events.trigger(Configuration.sets.SYSTEM_EVENTS.TXT_DATA_COME, data, ()=>{
                    Events.trigger(Configuration.sets.SYSTEM_EVENTS.REMOVE_FROM_ROOT_HOLDER, GUID);
                });
            },
            error   :(event : Event)=>{

            },
            reading :(file : File)=>{
                ShowWaitPopup();
            }
        });
    }

    openRemoteFileStream(){
        let openRemoteFileStream = new OpenRemoteFileStream();
        openRemoteFileStream.dialog();
    }

    openSerialStream(){
        let openSerialStream = new OpenSerialStream();
        openSerialStream.start();
    }

    openADBLogcatStream(){
        let openADBLogcatStream = new OpenADBLogcatStream();
        openADBLogcatStream.start();
    }

    openTerminalCommand(){
        let openTerminalStream = new OpenTerminalStream();
        openTerminalStream.start();
    }

    connectionSettings(){
        let APIsettings = new APISettings();
        APIsettings.dialog();
    }

    changeThemeSettings(){
        controllerThemes.oneSelectThemeDialog();
    }

    addView(){
        let addView = new AddView();
        addView.start();
    }

    openProgressBar(){

    }

}

let topbarMenuHandles = new TopBarMenuHandles();

export { topbarMenuHandles };
