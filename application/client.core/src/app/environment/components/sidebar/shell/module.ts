import { NgModule                               } from '@angular/core';
import { CommonModule                           } from '@angular/common';
import { AppDirectiviesModule                   } from '../../../directives/module';
import { EnvironmentCommonModule                } from '../../common/module';
import { PrimitiveModule, ContainersModule      } from 'chipmunk-client-material';

import { SidebarAppShellComponent               } from './component';
import { SidebarAppShellInputComponent          } from './input/component';
import { SidebarAppShellRunningComponent        } from './running/component';
import { SidebarAppShellInformationComponent    } from './information/component';

import { MatIconModule                          } from '@angular/material/icon';
import { MatInputModule                         } from '@angular/material/input';
import { MatButtonModule                        } from '@angular/material/button';
import { MatTooltipModule                       } from '@angular/material/tooltip';
import { MatExpansionModule                     } from '@angular/material/expansion';
import { MatFormFieldModule                     } from '@angular/material/form-field';
import { MatAutocompleteModule                  } from '@angular/material/autocomplete';
import { MatProgressSpinnerModule               } from '@angular/material/progress-spinner';
import { FormsModule, ReactiveFormsModule       } from '@angular/forms';

const entryComponents = [
    SidebarAppShellComponent,
    SidebarAppShellRunningComponent,
    SidebarAppShellInputComponent,
    SidebarAppShellInformationComponent,
];

const modules = [
    FormsModule,
    CommonModule,
    PrimitiveModule,
    ContainersModule,
    ReactiveFormsModule,
    AppDirectiviesModule,
    EnvironmentCommonModule,
    MatIconModule,
    MatInputModule,
    MatButtonModule,
    MatTooltipModule,
    MatFormFieldModule,
    MatExpansionModule,
    MatAutocompleteModule,
    MatProgressSpinnerModule,
];

@NgModule({
    entryComponents : [ ...entryComponents ],
    imports         : [ ...modules ],
    declarations    : [ ...entryComponents ],
    exports         : [ ...entryComponents ]
})

export class SidebarAppShellModule {
    constructor() {
    }
}
