import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';

import { TopBar                                 } from '../../components/top-bar/layout/component';
import { TopBarSpaceHolder                      } from '../../components/top-bar/space.holder/component';
import { TopBarDropDownMenu                     } from '../../components/top-bar/dropdown-menu/component';
import { Components as ComponentsCommmon        } from '../../components/common/components';



@NgModule({
    imports     : [ CommonModule, ComponentsCommmon ],
    declarations: [ TopBar, TopBarSpaceHolder, TopBarDropDownMenu ],
    exports     : [ TopBar, TopBarSpaceHolder, TopBarDropDownMenu ]
})

export class TopBarModule {
    constructor(){
    }
}