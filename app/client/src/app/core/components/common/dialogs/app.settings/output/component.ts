import {
    Component, Input, Output, ViewChild, AfterContentInit, OnInit, ViewContainerRef,
    ComponentFactoryResolver, ChangeDetectorRef, OnDestroy, EventEmitter
} from '@angular/core';
import { SimpleCheckbox     } from '../../../checkboxes/simple/component';
import { TabController      } from '../../../../common/tabs/tab/class.tab.controller';
import { IOutputSettings    } from '../../../../../modules/controller.settings';


@Component({
    selector    : 'dialog-output-settings-tab',
    templateUrl : './template.html',
})

export class DialogOutputSettingTab extends TabController implements OnDestroy, AfterContentInit, OnInit{

    @Input() output : IOutputSettings = {
        remove_empty_rows_from_stream: true
    };

    @Input() register   : Function  = null;
    @Input() active     : boolean   = false;

    @Output() getData() : IOutputSettings {
        return {
            remove_empty_rows_from_stream : this._remove_empty_rows_from_stream.getValue()
        };
    };

    private registered: boolean = false;

    @ViewChild('_remove_empty_rows_from_stream') _remove_empty_rows_from_stream: SimpleCheckbox;


    constructor(private componentFactoryResolver    : ComponentFactoryResolver,
                private viewContainerRef            : ViewContainerRef,
                private changeDetectorRef           : ChangeDetectorRef) {
        super();
        this.onTabSelected              = this.onTabSelected.           bind(this);
        this.onTabDeselected            = this.onTabDeselected.         bind(this);
    }

    ngOnInit(){
        this.onSelect   .subscribe(this.onTabSelected);
        this.onDeselect .subscribe(this.onTabDeselected);
    }

    ngOnDestroy(){
        this.onSelect.      unsubscribe();
        this.onDeselect.    unsubscribe();
    }

    ngAfterContentInit(){
        if (this.register !== null && !this.registered && this.active) {
            this.register({
                getData: this.getData.bind(this),
                section: 'output'
            });
            this.registered = true;
        }
    }

    onTabSelected(){
        this.register({
            getData: this.getData.bind(this),
            section: 'output'
        });
    }

    onTabDeselected(){

    }

    forceUpdate(){
        this.changeDetectorRef.detectChanges();
    }

}
