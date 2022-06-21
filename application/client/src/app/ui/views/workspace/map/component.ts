import { Component } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';

@Component({
    selector: 'app-views-content-map',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class ViewContentMapComponent {}
export interface ViewContentMapComponent extends IlcInterface {}
