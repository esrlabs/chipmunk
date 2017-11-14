import {Component, ComponentFactoryResolver, ViewContainerRef, ChangeDetectorRef, ViewChild, OnInit, AfterViewChecked, OnDestroy, Input } from '@angular/core';

import { dataController                         } from '../../../../core/modules/controller.data';
import { Logs, TYPES as LogTypes                } from '../../../../core/modules/tools.logs';
import { events as Events                       } from '../../../../core/modules/controller.events';
import { configuration as Configuration         } from '../../../../core/modules/controller.config';
import { GUID                                   } from '../../../../core/modules/tools.guid';

import { ViewInterface                          } from '../../../../core/interfaces/interface.view';
import { DataRow                                } from '../../../../core/interfaces/interface.data.row';
import { EVENT_DATA_IS_UPDATED                  } from '../../../../core/interfaces/events/DATA_IS_UPDATE';

import { ViewClass                              } from '../../../../core/services/class.view';
import { ViewSizeClassInt as Size                                       } from '../../../../core/services/class.view.size';

import { Manager                                                        } from '../../../../core/modules/parsers/controller.data.parsers.tracker.manager';
import { ParserClass, ParserData, ParserDataIndex, ParsedResultIndexes  } from '../../../../core/modules/parsers/controller.data.parsers.tracker.inerfaces';

import { popupController                        } from '../../../../core/components/common/popup/controller';
import { ChartEditColorDialog                   } from '../../../../core/components/common/dialogs/charts.edit.colors/component';
import { ChartEditRulesHooksDialog              } from '../../../../core/components/common/dialogs/charts.edit.rules.hooks/component';
import { ChartEditRulesSegmentsDialog           } from '../../../../core/components/common/dialogs/charts.edit.rules.segments/component';


@Component({
    selector        : 'view-controller-chart-manager-set',
    templateUrl     : './template.html',
})

export class ViewControllerTabChartManagerSet implements OnInit, AfterViewChecked, OnDestroy {
    @Input() GUID               : string    = null;
    @Input() removeCallback     : Function  = null;


    private set         : ParserData    = null;
    private sets        : any           = null;
    private manager     : Manager       = new Manager();
    private isDblClick  : boolean       = false;

    ngOnInit(){
        if (this.GUID !== null && this.sets[this.GUID] !== void 0){
            this.set = this.sets[this.GUID];
        }
    }

    ngAfterViewChecked(){

    }

    ngOnDestroy(){

    }

    constructor(
        private componentFactoryResolver    : ComponentFactoryResolver,
        private viewContainerRef            : ViewContainerRef,
        private changeDetectorRef           : ChangeDetectorRef
    ){
        [   /*Configuration.sets.SYSTEM_EVENTS.DATA_IS_UPDATED,
            Configuration.sets.SYSTEM_EVENTS.ROW_IS_SELECTED,
            Configuration.sets.SYSTEM_EVENTS.DATA_FILTER_IS_UPDATED,
            Configuration.sets.SYSTEM_EVENTS.DATA_IS_MODIFIED*/].forEach((handle)=>{
            this['on' + handle] = this['on' + handle].bind(this);
            Events.bind(handle, this['on' + handle]);
        });

        //Load available sets
        this.sets = this.manager.load();
        this.sets = this.sets !== null ? (typeof this.sets === 'object' ? this.sets : {}) : {};
    }

    onClickTrigger(){
        this.set.active = !this.set.active;
        this.onChangeState();
    }

    onClickTriggerSafe(){
        setTimeout(()=>{
            if (!this.isDblClick){
                this.set.active = !this.set.active;
                this.onChangeState();
            }
            this.isDblClick && setTimeout(()=>{
                this.isDblClick = false;
            }, 200);
        }, 300);
    }

    onChangeState(){
        this.manager.update(this.GUID, Object.assign({}, this.set), false);
    }

    onClickRemove(){
        typeof this.removeCallback === 'function' && this.removeCallback();
    }

    onClickColor(){
        let popup = Symbol();
        this.isDblClick = true;
        popupController.open({
            content : {
                factory     : null,
                component   : ChartEditColorDialog,
                params      : {
                    hook                : this.GUID,
                    foregroundColor     : this.set.textColor,
                    backgroundColor     : this.set.lineColor,
                    callback            : function(request: Object){
                        this.set.textColor = request['foregroundColor'];
                        this.set.lineColor = request['backgroundColor'];
                        this.manager.update(this.GUID, Object.assign({}, this.set), false);
                        popupController.close(popup);
                    }.bind(this)
                }
            },
            title   : _('Change chart color'),
            settings: {
                move            : true,
                resize          : true,
                width           : '40rem',
                height          : '23rem',
                close           : true,
                addCloseHandle  : true,
                css             : ''
            },
            buttons         : [],
            titlebuttons    : [],
            GUID            : popup
        });
    }

    getTypeOfRules(GUID: string){
        if (this.sets[this.GUID] !== void 0){
            if (this.sets[this.GUID].segments !== void 0){
                return ChartEditRulesSegmentsDialog;
            } else if (this.sets[this.GUID].tests !== void 0){
                return ChartEditRulesHooksDialog;
            }
        }
        return null;
    }

    onClickEdit(){
        let popup   = Symbol(),
            dialog  = this.getTypeOfRules(this.GUID);
        this.isDblClick = true;
        popupController.open({
            content : {
                factory     : null,
                component   : dialog,
                params      : {
                    GUID                : this.GUID,
                    callback            : function(updated: Object){
                        this.set = updated;
                        this.manager.update(this.GUID, Object.assign({}, this.set));
                        popupController.close(popup);
                    }.bind(this)
                }
            },
            title   : _('Change rules'),
            settings: {
                move            : true,
                resize          : true,
                width           : '40rem',
                height          : '70%',
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
