import { Component, Input, ViewContainerRef, OnInit, ComponentRef, OnDestroy, ChangeDetectorRef } from '@angular/core';

@Component({
    selector        : 'tab-item',
    template        : '',
})

export class TabItem implements OnInit, OnDestroy{
    @Input() tab    : any;

    private ref     : ComponentRef<any>;

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
        this.ref = this.container.createComponent(this.tab.factory);
        if (this.tab.params !== void 0){
            Object.keys(this.tab.params).forEach((key)=>{
                this.ref.instance[key] = this.tab.params[key];
            });
        }
        typeof this.tab.callback === 'function' && this.tab.callback(this.ref.instance);
        this.tab.forceUpdate = this.update.bind(this);
    }

    ngOnDestroy(){
        this.ref.destroy();
    }
}
