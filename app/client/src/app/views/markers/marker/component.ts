import {Component, OnInit, ComponentFactoryResolver, ViewContainerRef, ChangeDetectorRef, ViewChild, EventEmitter, Input, OnDestroy, AfterViewInit } from '@angular/core';

import { popupController                        } from '../../../core/components/common/popup/controller';
import { MarkersEditDialog                      } from '../../../core/components/common/dialogs/markers.edit/component';

@Component({
    selector        : 'view-markers-item',
    templateUrl     : './template.html'
})

export class ViewMarkersItem implements OnInit, OnDestroy, AfterViewInit {
    @Input() active         : boolean       = true;
    @Input() value          : string        = '';
    @Input() foregroundColor: string        = '';
    @Input() backgroundColor: string        = '';
    @Input() onChangeColor  : Function      = null;
    @Input() onRemove       : Function      = null;
    @Input() onChangeState  : Function      = null;
    @Input() onChange       : Function      = null;

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
                    callback            : function(marker: Object){
                        typeof this.onChange === 'function' && this.onChange(marker['hook'], marker['foregroundColor'], marker['backgroundColor']);
                        popupController.close(popup);
                    }.bind(this)
                }
            },
            title   : _('Edit marker'),
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
}
