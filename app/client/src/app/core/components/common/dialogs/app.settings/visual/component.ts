import {
    Component, Input, Output, ViewChild, AfterContentInit, OnInit, ViewContainerRef,
    ComponentFactoryResolver, ChangeDetectorRef, OnDestroy, EventEmitter
} from '@angular/core';
import { SimpleCheckbox     } from '../../../checkboxes/simple/component';
import { TabController      } from '../../../../common/tabs/tab/class.tab.controller';
import { IVisualSettings    } from '../../../../../modules/controller.settings';


@Component({
    selector    : 'dialog-visual-settings-tab',
    templateUrl : './template.html',
})

export class DialogVisualSettingTab extends TabController implements OnDestroy, AfterContentInit, OnInit{

    @Input() visual     : IVisualSettings = {
        prevent_ascii_colors_always         : false,
        prevent_ascii_colors_on_highlight   : true
    };

    @Input() register   : Function = null;

    @Output() getData() : IVisualSettings {
        return {
            prevent_ascii_colors_always         : this._prevent_ascii_colors_always.getValue(),
            prevent_ascii_colors_on_highlight   : this._prevent_ascii_colors_on_highlight.getValue()
        };
    };

    private registered: boolean = false;

    @ViewChild('_prevent_ascii_colors_always'       ) _prevent_ascii_colors_always   : SimpleCheckbox;
    @ViewChild('_prevent_ascii_colors_on_highlight' ) _prevent_ascii_colors_on_highlight   : SimpleCheckbox;

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
        if (this.register !== null && !this.registered) {
            this.register({
                getData: this.getData.bind(this),
                section: 'visual'
            });
            this.registered = true;
        }
    }

    onTabSelected(){
        this.register({
            getData: this.getData.bind(this),
            section: 'visual'
        });
    }

    onTabDeselected(){

    }

    forceUpdate(){
        this.changeDetectorRef.detectChanges();
    }

}
