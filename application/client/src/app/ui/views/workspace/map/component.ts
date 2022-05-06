import {
    Component,
    OnDestroy,
    ChangeDetectorRef,
    Input,
    AfterContentInit,
    AfterViewInit,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { Session } from '@service/session';
import { INotification } from '@ui/service/notifications';
import { Ilc, IlcInterface, Declarations } from '@env/decorators/component';

@Component({
    selector: 'app-views-content-map',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class ViewContentMapComponent {}
export interface ViewContentMapComponent extends IlcInterface {}
