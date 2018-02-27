import {Component, OnInit, ComponentFactoryResolver, ViewContainerRef, ChangeDetectorRef, ViewChild, EventEmitter, Input, OnDestroy, AfterViewInit } from '@angular/core';

import { popupController                        } from '../../../core/components/common/popup/controller';
import { MarkersEditDialog                      } from '../../../core/components/common/dialogs/markers.edit/component';
import { MODES                                  } from '../../../core/modules/controller.data.search.modes';

@Component({
    selector        : 'view-request-item',
    templateUrl     : './template.html'
})

export class ViewRequestItem implements OnInit, OnDestroy, AfterViewInit {
    @Input() active             : boolean       = true;
    @Input() value              : string        = '';
    @Input() count              : number        = 0;
    @Input() type               : string        = MODES.REG;
    @Input() foregroundColor    : string        = '';
    @Input() backgroundColor    : string        = '';
    @Input() onChangeColor      : Function      = null;
    @Input() onRemove           : Function      = null;
    @Input() onChangeState      : Function      = null;
    @Input() onChange           : Function      = null;
    @Input() onChangeVisibility : Function      = null;
    @Input() passive            : boolean       = true;
    @Input() visibility         : boolean       = true;

    private isDblClick      : boolean       = false;

    ngOnInit(){
    }

    ngOnDestroy(){
    }

    ngAfterViewInit(){
    }


    forceUpdate(){
        this.changeDetectorRef.detectChanges();
    }

    constructor(
        private componentFactoryResolver    : ComponentFactoryResolver,
        private viewContainerRef            : ViewContainerRef,
        private changeDetectorRef           : ChangeDetectorRef
    ){
        this.componentFactoryResolver   = componentFactoryResolver;
        this.viewContainerRef           = viewContainerRef;
        this.changeDetectorRef          = changeDetectorRef;
    }

    onClickTrigger(){
        this.active = !this.active;
        typeof this.onChangeState === 'function' && this.onChangeState(this.active);
    }

    onClickTriggerSafe(){
        setTimeout(()=>{
            if (!this.isDblClick){
                this.active = !this.active;
                typeof this.onChangeState === 'function' && this.onChangeState(this.active);
            }
            this.isDblClick && setTimeout(()=>{
                this.isDblClick = false;
            }, 200);
        }, 300);
    }

    onClickRemove(){
        typeof this.onRemove === 'function' && this.onRemove();
    }

    onClickVisibility(){
        this.visibility = !this.visibility;
        typeof this.onChangeVisibility === 'function' && this.onChangeVisibility(this.visibility);
    }

    onClickEdit(){
        let popup = Symbol();
        this.isDblClick = true;
        popupController.open({
            content : {
                factory     : null,
                component   : MarkersEditDialog,
                params      : {
                    hook                : this.value,
                    foregroundColor     : this.foregroundColor,
                    backgroundColor     : this.backgroundColor,
                    isRegExp            : this.type === MODES.REG,
                    callback            : function(request: Object){
                        typeof this.onChange === 'function' && this.onChange(request['hook'], request['foregroundColor'], request['backgroundColor'], request['isRegExp'] ? MODES.REG : MODES.TEXT, this.passive, this.visibility);
                        popupController.close(popup);
                    }.bind(this)
                }
            },
            title   : _('Edit request'),
            settings: {
                move            : true,
                resize          : true,
                width           : '40rem',
                height          : '27rem',
                close           : true,
                addCloseHandle  : true,
                css             : ''
            },
            buttons         : [],
            titlebuttons    : [],
            GUID            : popup
        });
    }

    onClickTriggerState(){
        this.passive = !this.passive;
        typeof this.onChange === 'function' && this.onChange(this.value, this.foregroundColor, this.backgroundColor, this.type, this.passive, this.visibility);
    }

    onActivePassive(passive: boolean){
        this.passive = passive;
        typeof this.onChange === 'function' && this.onChange(this.value, this.foregroundColor, this.backgroundColor, this.type, this.passive, this.visibility);
    }
}
