import {Component, ComponentFactoryResolver, ViewContainerRef, ChangeDetectorRef, ViewChild, OnInit, AfterViewChecked, OnDestroy } from '@angular/core';
import {DomSanitizer                            } from '@angular/platform-browser';

import { dataController                         } from '../../../core/modules/controller.data';
import { Logs, TYPES as LogTypes                } from '../../../core/modules/tools.logs';
import { events as Events                       } from '../../../core/modules/controller.events';
import { configuration as Configuration         } from '../../../core/modules/controller.config';
import { GUID                                   } from '../../../core/modules/tools.guid';

import { ViewInterface                          } from '../../../core/interfaces/interface.view';
import { DataRow                                } from '../../../core/interfaces/interface.data.row';
import { EVENT_DATA_IS_UPDATED                  } from '../../../core/interfaces/events/DATA_IS_UPDATE';

import { ViewClass                              } from '../../../core/services/class.view';
import { ViewSizeClassInt as Size               } from '../../../core/services/class.view.size';

import { Manager                                } from '../../../core/modules/parsers/controller.data.parsers.tracker.manager';
import { ParsedResultIndexes                    } from '../../../core/modules/parsers/controller.data.parsers.tracker.inerfaces';
import { TabController                          } from '../class.tab.controller';

import { popupController                        } from '../../../core/components/common/popup/controller';
import { ChartEditColorDialog                   } from '../../../core/components/common/dialogs/charts.edit.colors/component';
import { ChartEditRulesHooksDialog              } from '../../../core/components/common/dialogs/charts.edit.rules.hooks/component';
import { ChartEditRulesSegmentsDialog           } from '../../../core/components/common/dialogs/charts.edit.rules.segments/component';
import { ChartEditRulesNumericDialog            } from '../../../core/components/common/dialogs/charts.edit.rules.numeric/component';
import { ChartEditTypeDialog                    } from '../../../core/components/common/dialogs/charts.edit.type/component';

import { DialogMessage                          } from '../../../core/components/common/dialogs/dialog-message/component';
import { ImageDialog                            } from '../../../core/components/common/dialogs/image/component';


import { fileLoaderController                   } from '../../../core/components/common/fileloader/controller';
import { ProgressBarCircle                      } from '../../../core/components/common/progressbar.circle/component';

const
    CHART_TYPES  = {
        hooks       : 'hooks',
        segments    : 'segments',
        numeric     : 'numeric'
    };

const
    CHART_SCHEMES  = {
        hooks       : 'app/images/view.charts/charts.hooks.png',
        segments    : 'app/images/view.charts/charts.segments.png',
        numeric     : 'app/images/view.charts/charts.numeric.png',
    };

@Component({
    selector        : 'view-controller-chart-manager',
    templateUrl     : './template.html',
})

export class ViewControllerTabChartManager extends TabController implements ViewInterface, OnInit, AfterViewChecked, OnDestroy {

    @ViewChild ('exporturl', { read: ViewContainerRef}) exportURLNode: ViewContainerRef;

    private manager         : Manager           = new Manager();
    private sets            : any               = null;
    private outdata         : Array<any>        = [];

    public exportdata       : {
        url         : any,
        filename    : string
    } = {
        url         : null,
        filename    : ''
    };

    ngOnInit(){
        //this.viewParams !== null && super.setGUID(this.viewParams.GUID);
        this.onSelect   .subscribe(this.onTabSelected);
        this.onDeselect .subscribe(this.onTabDeselected);
        this.onResize   .subscribe(this.onResizeHandle);
    }

    ngAfterViewChecked(){
        if (this.exportdata.url !== null && this.exportURLNode !== null){
            this.exportURLNode.element.nativeElement.click();
            this.exportdata.url         = null;
            this.exportdata.filename    = '';
        }
    }

    ngOnDestroy(){
        [   Configuration.sets.EVENTS_VIEWS.CHART_VIEW_ADD_NEW_CHART,
            Configuration.sets.EVENTS_VIEWS.CHART_VIEW_CHARTS_UPDATED].forEach((handle)=>{
            Events.unbind(handle, this['on' + handle]);
        });
    }

    /* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
     * Tab functions
     * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
    onTabSelected(){
        this.forceUpdate();
    }

    onTabDeselected(){
    }

    onResizeHandle(){
        this.forceUpdate();
    }

    forceUpdate(){
        this.changeDetectorRef.detectChanges();
    }


    constructor(
        private componentFactoryResolver    : ComponentFactoryResolver,
        private viewContainerRef            : ViewContainerRef,
        private changeDetectorRef           : ChangeDetectorRef,
        private sanitizer                   : DomSanitizer
    ){
        super();
        this.onTabSelected      = this.onTabSelected.   bind(this);
        this.onTabDeselected    = this.onTabDeselected. bind(this);
        this.onResizeHandle     = this.onResizeHandle.  bind(this);
        this.onExportSets       = this.onExportSets.  bind(this);
        this.onImportSets       = this.onImportSets.  bind(this);

        [   Configuration.sets.EVENTS_VIEWS.CHART_VIEW_ADD_NEW_CHART,
            Configuration.sets.EVENTS_VIEWS.CHART_VIEW_CHARTS_UPDATED].forEach((handle)=>{
            this['on' + handle] = this['on' + handle].bind(this);
            Events.bind(handle, this['on' + handle]);
        });
        //Load available sets
        this.loadSets();
    }

    loadSets(){
        this.sets   = this.manager.load();
        this.sets   = this.sets !== null ? (typeof this.sets === 'object' ? this.sets : {}) : {};
        this.initializeSetsParameters();
    }

    initializeSetsParameters(){
        this.outdata = Object.keys(this.sets).map((GUID) => {
            return {
                GUID    : GUID,
                remove  : this.onRemoveSet.bind(this, GUID)
            }

        });
    }

    onRemoveSet(GUID: string){
        if (this.sets[GUID] !== void 0){
            let popup   = Symbol();
            popupController.open({
                content : {
                    factory     : null,
                    component   : DialogMessage,
                    params      : {
                        message : 'Are you sure that you want to remove this sets for charts? It will be impossible to restore.',
                        buttons : [
                            { caption: 'Yes, remove it',    handle: ()=>{ this.manager.remove(GUID); popupController.close(popup); }},
                            { caption: 'No, leave it',      handle: ()=>{ popupController.close(popup); }},

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

    popupSelectType(){
        let popup   = Symbol();
        popupController.open({
            content : {
                factory     : null,
                component   : ChartEditTypeDialog,
                params      : {
                    types               : [
                        {
                            id          : CHART_TYPES.numeric,
                            name        : 'By targets',
                            description : 'This type of parser better to use target, which already has numeric values inside.',
                            scheme      : CHART_SCHEMES.numeric
                        },
                        {
                            id          : CHART_TYPES.segments,
                            name        : 'By segments',
                            description : 'This type of parser better to use with values, which has very similar format.',
                            scheme      : CHART_SCHEMES.segments
                        },
                        {
                            id          : CHART_TYPES.hooks,
                            name        : 'By hooks',
                            description : 'This type of parser better to use with values without any common format or structure.',
                            scheme      : CHART_SCHEMES.hooks
                        }
                    ],
                    onSelect            : function(type: string){
                        switch (type){
                            case CHART_TYPES.segments:
                                this.popupCreateNewOfType(ChartEditRulesSegmentsDialog, this.popupShowScheme.bind(this, CHART_SCHEMES.segments));
                                break;
                            case CHART_TYPES.hooks:
                                this.popupCreateNewOfType(ChartEditRulesHooksDialog, this.popupShowScheme.bind(this, CHART_SCHEMES.hooks));
                                break;
                            case CHART_TYPES.numeric:
                                this.popupCreateNewOfType(ChartEditRulesNumericDialog, this.popupShowScheme.bind(this, CHART_SCHEMES.numeric));
                                break;
                        }
                        popupController.close(popup);
                    }.bind(this)
                }
            },
            title   : _('Select type of chart\'s data parser.'),
            settings: {
                move            : true,
                resize          : true,
                width           : '60rem',
                height          : '16rem',
                close           : true,
                addCloseHandle  : true,
                css             : ''
            },
            buttons         : [],
            titlebuttons    : [ ],
            GUID            : popup
        });
    }

    popupCreateNewOfType(dialog: any, openScheme: Function){
        let popup   = Symbol();
        popupController.open({
            content : {
                factory     : null,
                component   : dialog,
                params      : {
                    GUID                : null,
                    callback            : function(set: Object){
                        this.manager.add(set);
                        popupController.close(popup);
                    }.bind(this)
                }
            },
            title   : _('New Chart'),
            settings: {
                move            : true,
                resize          : true,
                width           : '40rem',
                height          : '70%',
                close           : true,
                addCloseHandle  : false,
                css             : ''
            },
            buttons         : [],
            titlebuttons    : [
                {
                    icon    : 'fa-question-circle-o',
                    hint    : 'More about this type of data parser',
                    handle  : openScheme
                }
            ],
            GUID            : popup
        });
    }

    popupShowScheme(url: string){
        let popup   = Symbol();
        popupController.open({
            content : {
                factory     : null,
                component   : ImageDialog,
                params      : {
                    url: url
                }
            },
            title   : _('Scheme of type'),
            settings: {
                move            : true,
                resize          : true,
                width           : '95%',
                height          : '95%',
                close           : true,
                addCloseHandle  : true,
                css             : ''
            },
            buttons         : [],
            titlebuttons    : [],
            GUID            : popup
        });
    }

    onCHART_VIEW_ADD_NEW_CHART(){
        this.popupSelectType();
    }

    onCHART_VIEW_CHARTS_UPDATED(){
        this.loadSets();
        this.forceUpdate();
    }

    showErrorMessage(title: string, message: string){
        let popup   = Symbol();
        popupController.open({
            content : {
                factory     : null,
                component   : DialogMessage,
                params      : {
                    message : message,
                    buttons : [
                        { caption: 'OK',    handle: ()=>{ popupController.close(popup); }},
                    ]
                }
            },
            title   : title,
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

    validateImportData(data: Object){
        if (typeof data === 'object' && data !== null){
            let spaces = {
                    common      : ['name', 'lineColor', 'textColor', 'active', 'indexes'],
                    segments    : ['segments', 'values', 'clearing'],
                    hooks       : ['tests']
                },
                result = true;
            Object.keys(data).forEach((ID: string)=>{
                let results = {
                    common      : true,
                    segments    : true,
                    hooks       : true
                };
                ['common', 'segments', 'hooks'].forEach((segment)=>{
                    if (results[segment]){
                        spaces[segment].forEach((field: string)=>{
                            if (typeof data[ID] === 'object' && data[ID] !== null){
                                data[ID][field] === void 0 && (results[segment] = false);
                            } else {
                                results[segment] = false;
                            }
                        });
                    }
                });
                if (!results.common){
                    result = false;
                }
                if (!results.segments && !results.hooks){
                    result = false;
                }
            });
            return result;
        }
        return false;
    }

    onImportSets(){
        let GUID = Symbol();
        fileLoaderController.open(Symbol(), {
            load    : (data : string, files: Array<File>)=>{
                popupController.close(GUID);
                if (typeof data === 'string') {
                    try{
                        let result = JSON.parse(data);
                        if (this.validateImportData(result)){
                            this.sets = result;
                            this.manager.save(this.sets, true);
                        } else {
                            this.showErrorMessage('Wrong format', 'Basically JSON format is okay. But we\'ve tried to parse content and didn\'t find data, which can be used for charts. Or impoerted data has some incorrect /corrupted format.');
                        }
                    }catch (e){
                        this.showErrorMessage('Wrong JSON format', 'Cannot parse content of file. Expected format is JSON.');
                    }
                }
            },
            error   :(event : Event)=>{

            },
            reading :(file : File)=>{
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
        });
    }

    onExportSets(){
        if (Object.keys(this.sets).length > 0){
            let str     = JSON.stringify(this.sets),
                blob    = new Blob([str], {type: 'text/plain'}),
                url     = URL.createObjectURL(blob);
            this.exportdata.url         = this.sanitizer.bypassSecurityTrustUrl(url);
            this.exportdata.filename    = 'export_chats_sets' + (new Date()).getTime() + '.json';
        }
    }

}
