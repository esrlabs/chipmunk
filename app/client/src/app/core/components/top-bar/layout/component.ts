import { Component, OnDestroy                   } from '@angular/core';
import { events as Events                       } from '../../../../core/modules/controller.events';
import { configuration as Configuration         } from '../../../../core/modules/controller.config';

@Component({
    selector    : 'top-bar',
    templateUrl : './template.html',
})

export class TopBar implements OnDestroy{

    constructor( ){
    }

    ngOnDestroy(){
    }

}
