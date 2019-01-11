import { Component, Input, AfterViewInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { DockDef, DocksService } from '../../../services/service.docks';
import { Subscription } from 'rxjs';
import { Observable } from 'rxjs';
import { IDocksAreaSize } from '../component';

const DIRECTIONS = {
    top: 'top',
    left: 'left',
    bottom: 'bottom',
    right: 'right',
    move: 'move'
};

@Component({
    selector: 'app-layout-docking-dock',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class LayoutDockComponent implements AfterViewInit, OnDestroy {

    @Input() public dock: DockDef.IDock;

    constructor(private _cdRef: ChangeDetectorRef) {

    }

    ngOnDestroy() {

    }

    ngAfterViewInit() {

    }

}
