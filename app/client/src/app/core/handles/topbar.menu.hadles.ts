import { fileLoaderController           } from '../components/common/fileloader/controller';
import { popupController                } from '../components/common/popup/controller';
import { ProgressBarCircle              } from '../components/common/progressbar.circle/component';

import { events as Events               } from '../modules/controller.events';
import { configuration as Configuration } from '../modules/controller.config';
import { localSettings                  } from "../modules/controller.localsettings";

import { OpenRemoteFileStream           } from '../handles/handle.open.remote.file.stream';
import { OpenSerialStream               } from '../handles/handle.open.serial.stream';
import { OpenTelnetStream               } from '../handles/handle.open.telnet.stream';
import { OpenADBLogcatStream            } from '../handles/handle.open.adblogcat.stream';
import { OpenTerminalStream             } from '../handles/handle.open.terminal.stream';
import { MonitorManager                 } from '../handles/hanlde.open.monitor.manager';
import { ApplicationSettingsManager     } from '../handles/hanlde.settings.manager';
import { UpdateChecks                   } from '../handles/handle.update.checks';
import { DeveloperConsole               } from '../handles/handle.developer.console';

import { AddView                        } from '../handles/handle.add.view';
import { APISettings                    } from '../handles/handle.api.settings';
import { controllerThemes               } from '../modules/controller.themes';
import { OpenMarkersManager             } from '../handles/handle.open.markers.manager';
import { BugReport                      } from '../handles/handle.bug.report';
import {DIRECTIONS, Method, Request as AJAXRequest} from "../modules/tools.ajax";
import {DialogA} from "../components/common/dialogs/dialog-a/component";


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
                function onDATA_IS_UPDATED(){
                    Events.trigger(Configuration.sets.SYSTEM_EVENTS.REMOVE_FROM_ROOT_HOLDER, GUID);
                    Events.unbind(Configuration.sets.SYSTEM_EVENTS.DATA_IS_UPDATED, onDATA_IS_UPDATED);
                };
                if (files instanceof FileList){
                    let description = '';
                    Array.prototype.forEach.call(files, (file : File)=>{
                        description += (description !== '' ? '; ' : '') + file.name + ' (' + Math.round(file.size / 1024) + ' kB)';
                    });
                    description = 'Files: ' + description;
                    Events.trigger(Configuration.sets.SYSTEM_EVENTS.DESCRIPTION_OF_STREAM_UPDATED, description);
                }
                GUID === null && ShowWaitPopup();
                Events.bind(Configuration.sets.SYSTEM_EVENTS.DATA_IS_UPDATED, onDATA_IS_UPDATED);
                Events.trigger(Configuration.sets.SYSTEM_EVENTS.TXT_DATA_COME, data);
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

    openTelnetStream(){
        let openTelnetStream = new OpenTelnetStream();
        openTelnetStream.start();
    }

    openADBLogcatStream(){
        let openADBLogcatStream = new OpenADBLogcatStream();
        openADBLogcatStream.start();
    }

    setupAndOpenADBLogcatStream(){
        let openADBLogcatStream = new OpenADBLogcatStream();
        openADBLogcatStream.setupAndOpen();
    }

    setupADBLogcatStream(){
        let openADBLogcatStream = new OpenADBLogcatStream();
        openADBLogcatStream.setupSettings();
    }

    openTerminalCommand(){
        let openTerminalStream = new OpenTerminalStream();
        openTerminalStream.start();
    }

    openMonitorManager(){
        MonitorManager.start();
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

    resetViewsSettings(){
        localSettings.reset('views', 'Initialized by user');
        location.reload();
    }

    openProgressBar(){

    }

    checkUpdates(){
        let updater = new UpdateChecks();
        updater.start();
    }

    openDevConsole(){
        let developerConsole = new DeveloperConsole();
        developerConsole.start();
    }

    openApplicationSettings(){
        ApplicationSettingsManager.start();
    }

    openMarkersManager(){
        let openMarkersManager = new OpenMarkersManager();
        openMarkersManager.start();
    }

    openBugReportDialog(){
        let bugReport = new BugReport();
        bugReport.start();
    }

    openLocalFileByURL(){
        const guid = Symbol();
        popupController.open({
            content : {
                factory     : null,
                component   : DialogA,
                params      : {
                    caption: 'Type URL of source of data',
                    value: '',
                    type: 'test',
                    placeholder: 'Type source URL',
                    buttons: [
                        {
                            caption: 'Download',
                            handle : (url: string)=>{
                                popupController.close(guid);
                                if (url.trim() === '') {
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
                        },
                        {
                            caption: 'Cancel',
                            handle : ()=>{
                                popupController.close(guid);
                            }
                        }
                    ]
                }
            },
            title   : 'Get logs by URL',
            settings: {
                move            : true,
                resize          : true,
                width           : '40rem',
                height          : '12rem',
                close           : true,
                addCloseHandle  : false,
                css             : ''
            },
            buttons         : [],
            titlebuttons    : [],
            GUID            : guid
        });
    }

}

let topbarMenuHandles = new TopBarMenuHandles();

export { topbarMenuHandles };
