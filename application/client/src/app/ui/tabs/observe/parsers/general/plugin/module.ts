import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';

import { ParserPluginGeneralConfiguration } from './component';

@NgModule({
    imports: [CommonModule, MatCardModule, MatDividerModule],
    declarations: [ParserPluginGeneralConfiguration],
    exports: [ParserPluginGeneralConfiguration],
    bootstrap: [ParserPluginGeneralConfiguration],
})
export class ParserPluginGeneralConfigurationModule {}
