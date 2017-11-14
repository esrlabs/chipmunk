import {Component, Input, Output, OnDestroy, OnChanges, AfterContentChecked, EventEmitter, ChangeDetectorRef} from '@angular/core';

import { Indicate, IndicateState                } from '../../statemonitor.monitor/item/interface';

import { events as Events                       } from '../../../../core/modules/controller.events';
import { configuration as Configuration         } from '../../../../core/modules/controller.config';

import { popupController                        } from '../../../../core/components/common/popup/controller';
import { StateMonitorStateEditDialog            } from '../../../../core/components/common/dialogs/statemonitor.state.edit/component';
import { DialogStatemonitorIndicateEdit         } from '../../../../core/components/common/dialogs/statemonitor.indicate.edit/component';


@Component({
  selector      : 'view-controller-state-manager-item',
  templateUrl   : './template.html'
})

export class ViewControllerStateManagerItem implements OnDestroy, OnChanges, AfterContentChecked{
    @Input() indicate               : Indicate = null;
    @Input() onIndicateRemoveHandle : Function = null;
    @Input() onIndicateUpdateHandle : Function = null;

    constructor(private changeDetectorRef : ChangeDetectorRef){
        this.changeDetectorRef      = changeDetectorRef;
        this.onIndicateEdit         = this.onIndicateEdit.bind(this);
    }

    ngOnDestroy(){
    }

    ngAfterContentChecked(){
    }

    ngOnChanges(){
    }

    forceUpdate(){
        this.changeDetectorRef.detectChanges();
    }

    onChangeDefaults(state: IndicateState, stateIndex: number, defaults: boolean, setValue: Function){
        if (defaults){
            this.indicate.states = this.indicate.states.map((state, index) => {
                index !== stateIndex && (state.defaults = false);
                index === stateIndex && (state.defaults = true);
                return state;
            });
            this.save();
        } else {
            setValue(true);

        }
        this.forceUpdate();
    }

    onEdit(state: IndicateState, index: number){
        let popup = Symbol();
        popupController.open({
            content : {
                factory     : null,
                component   : StateMonitorStateEditDialog,
                params      : {
                    state               : state,
                    indicate            : this.indicate,
                    callback            : function(state: IndicateState){
                        if (state !== null){
                            if (index !== -1){
                                //Existing state
                                this.indicate.states[index] = state;
                                this.forceUpdate();
                                this.save();
                                popupController.close(popup);
                            } else {
                                //New state
                                if (state.label !== '' && state.hook !== ''){
                                    this.indicate.states.length === 0 && (state.defaults = true);
                                    this.indicate.states.push(state);
                                    this.forceUpdate();
                                    this.save();
                                    popupController.close(popup);
                                }
                            }
                        } else {
                            popupController.close(popup);
                        }
                    }.bind(this)
                }
            },
            title   : _('Edit State Settings'),
            settings: {
                move            : true,
                resize          : true,
                width           : '40rem',
                height          : '80%',
                close           : true,
                addCloseHandle  : true,
                css             : ''
            },
            buttons         : [ ],
            titlebuttons    : [],
            GUID            : popup
        });
    }

    onIndicateEdit(){
        let popup = Symbol();
        popupController.open({
            content : {
                factory     : null,
                component   : DialogStatemonitorIndicateEdit,
                params      : {
                    name                : this.indicate.name,
                    callback            : function(name: string){
                        if (typeof name === 'string' && name.trim() !== ''){
                            this.indicate.name  = name;
                            this.indicate.label = name;
                            this.forceUpdate();
                            this.save();
                            popupController.close(popup);
                        }
                    }.bind(this)
                }
            },
            title   : _('Add New Indicate'),
            settings: {
                move            : true,
                resize          : false,
                width           : '40rem',
                height          : '7.5rem',
                close           : true,
                addCloseHandle  : true,
                css             : ''
            },
            buttons         : [ ],
            titlebuttons    : [],
            GUID            : popup
        });
    }

    onIndicateRemove(){
        typeof this.onIndicateRemoveHandle === 'function' && this.onIndicateRemoveHandle();
    }

    onRemove(state: IndicateState, index: number){
        index >= 0 && this.indicate.states.splice(index, 1);
        !this.isDefaultSetup() && (this.indicate.states[0].defaults = true);
        this.save();
        this.forceUpdate();
    }

    isDefaultSetup(): boolean{
        let result = false;
        this.indicate.states.forEach((state: IndicateState)=>{
            state.defaults && (result = true);
        });
        return result;
    }

    onAddNewState(){
        this.onEdit({
            css     : '',
            label   : '',
            color   : '',
            hook    : '',
            event   : [],
            icon    : 'fa fa-question-circle-o',
            defaults: false
        }, -1);
    }

    save(){
        typeof this.onIndicateUpdateHandle === 'function' && this.onIndicateUpdateHandle(Object.assign({}, this.indicate));
    }

}
