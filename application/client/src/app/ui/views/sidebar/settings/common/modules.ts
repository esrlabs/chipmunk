import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Theme } from './theme/component';

const entryComponents = [Theme];
const components = [...entryComponents];

@NgModule({
    imports: [CommonModule],
    declarations: [...components],
    exports: [...components]
})
export class CommonSettingsModule {}