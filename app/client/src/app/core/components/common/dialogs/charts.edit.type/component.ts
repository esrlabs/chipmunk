import {Component, Input, ChangeDetectorRef     } from '@angular/core';
import { ImageDialog                            } from '../image/component';
import { popupController                        } from '../../../common/popup/controller';

@Component({
    selector    : 'chart-edit-type-dialog',
    templateUrl : './template.html',
})

export class ChartEditTypeDialog {
    @Input() onSelect           : Function      = null;
    @Input() types              : Array<any>    = [];

    constructor(private changeDetectorRef : ChangeDetectorRef) {
        this.changeDetectorRef          = changeDetectorRef;

    }

    forceUpdate(){
        this.changeDetectorRef.detectChanges();
    }

    onMoreInfo(url: string){
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

    onSelectType(id: any){
        typeof this.onSelect === 'function' && this.onSelect(id);
    }

}
