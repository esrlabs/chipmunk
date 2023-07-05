import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';

import { TextGeneralConfiguration } from './component';

@NgModule({
    imports: [CommonModule, MatCardModule, MatDividerModule],
    declarations: [TextGeneralConfiguration],
    exports: [TextGeneralConfiguration],
    bootstrap: [TextGeneralConfiguration],
})
export class TextGeneralConfigurationModule {}
