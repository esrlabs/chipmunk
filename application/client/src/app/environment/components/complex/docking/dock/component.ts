import { Component, Input, AfterViewInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { DockDef, DocksService } from '../service';
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
    selector: 'app-docking-dock',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class DockComponent implements AfterViewInit, OnDestroy {

    @Input() public dock: DockDef.IDock;

    constructor(private _cdRef: ChangeDetectorRef) {

    }

    ngOnDestroy() {

    }

    ngAfterViewInit() {

    }

}
