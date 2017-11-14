import { Component, Input, ViewContainerRef, OnInit, ComponentRef, OnDestroy, ChangeDetectorRef } from '@angular/core';

@Component({
    selector        : 'long-list-item',
    template        : '',
})

export class LongListItem implements OnInit, OnDestroy{
    @Input() component  : any;

    private ref         : ComponentRef<any>;

    public update(params : Object){
        Object.keys(params).forEach((key)=>{
            this.ref.instance[key] = params[key];
        });
        this.changeDetectorRef.detectChanges();
    }

    constructor(private container           : ViewContainerRef,
                private changeDetectorRef   : ChangeDetectorRef
    ){ }

    ngOnInit(){
        this.ref = this.container.createComponent(this.component.factory);
        if (this.component.params !== void 0){
            Object.keys(this.component.params).forEach((key)=>{
                this.ref.instance[key] = this.component.params[key];
            });
        }
        typeof this.component.callback === 'function' && this.component.callback(this.ref.instance);
        this.component.forceUpdate = this.update.bind(this);
    }

    ngOnDestroy(){
        this.ref.destroy();
    }
}
