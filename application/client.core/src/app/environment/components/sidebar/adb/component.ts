import { Component, OnInit, OnDestroy } from '@angular/core';
import { SidebarAppAdbService } from './services/service';

@Component({
    selector: 'app-sidebar-app-adb',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
export class SidebarAppAdbComponent implements OnInit, OnDestroy {
    public _ng_service!: SidebarAppAdbService;

    constructor() {}

    public ngOnInit() {
        this._ng_service = new SidebarAppAdbService();
    }

    public ngOnDestroy() {
        this._ng_service.destroy();
    }
}
