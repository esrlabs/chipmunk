import { Component, OnDestroy, OnInit } from '@angular/core';
import { ShellService } from './services/service';

@Component({
    selector: 'app-sidebar-app-shell',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
export class SidebarAppShellComponent implements OnInit, OnDestroy {
    public _ng_service!: ShellService;

    constructor() {}

    public ngOnInit() {
        this._ng_service = new ShellService();
    }

    public ngOnDestroy() {
        if (this._ng_service !== undefined) {
            this._ng_service.destroy();
        }
    }
}
