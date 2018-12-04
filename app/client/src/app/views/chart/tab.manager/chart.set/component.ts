import {Component, ComponentFactoryResolver, ViewContainerRef, ChangeDetectorRef, ViewChild, OnInit, AfterViewChecked, OnDestroy, Input } from '@angular/core';

import { events as Events                       } from '../../../../core/modules/controller.events';

import { Manager                                                        } from '../../../../core/modules/parsers/controller.data.parsers.tracker.manager';
import { ParserClass, ParserData, ParserDataIndex, ParsedResultIndexes  } from '../../../../core/modules/parsers/controller.data.parsers.tracker.inerfaces';

import { popupController                        } from '../../../../core/components/common/popup/controller';
import { MarkersEditDialog                      } from '../../../../core/components/common/dialogs/markers.edit/component';
import { ChartEditRulesHooksDialog              } from '../../../../core/components/common/dialogs/charts.edit.rules.hooks/component';
import { ChartEditRulesSegmentsDialog           } from '../../../../core/components/common/dialogs/charts.edit.rules.segments/component';
import { ChartEditRulesNumericDialog            } from '../../../../core/components/common/dialogs/charts.edit.rules.numeric/component';


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
                component   : MarkersEditDialog,
                params      : {
                    hook                : this.GUID,
                    foregroundColor     : this.set.textColor,
                    backgroundColor     : this.set.lineColor,
                    noTypeChoose        : true,
                    noHook              : true,
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
            } else if (this.sets[this.GUID].targets !== void 0){
                return ChartEditRulesNumericDialog;
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
