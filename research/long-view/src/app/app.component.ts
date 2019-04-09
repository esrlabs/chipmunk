import { Component } from '@angular/core';
import { IDataAPI, IRange, IStorageInformation, IRow, IRowsPacket } from './long/component';
import { Observable, Subject } from 'rxjs';
import { RowComponent } from './row/component';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.less']
})

export class AppComponent {
  title = 'long-view';
  public _ng_api: IDataAPI;
  private _requestedRange: IRange | undefined;
  private _requestTimer: any;

  constructor() {
    this._ng_api = {
      getComponentFactory: this._getComponentFactory.bind(this),
      getRange: this._getRange.bind(this),
      getStorageInfo: this._getStorageInfo.bind(this),
      updatingDone: this._onUpdatingDone.bind(this),
      onStorageUpdated: new Subject<IStorageInformation>(),
      onRowsDelivered: new Subject<IRowsPacket>(),
      onScrollTo: new Subject<number>(),
      getItemHeight: () => 12
    };
    /*
    setTimeout(() => {
      this._ng_api.onStorageUpdated.next({ count: 6000004 });
    }, 3000);
    */
    /*
    setTimeout(() => {
      this._ng_api.onScrollTo.next(49);
      setTimeout(() => {
        this._ng_api.onScrollTo.next(0);
        setTimeout(() => {
          this._ng_api.onScrollTo.next(24999999);
        }, 3000);
      }, 3000);
    }, 3000);
    */
  }

  private _getComponentFactory(): any {
    return RowComponent;
  }

  private _onUpdatingDone(range: IRange) {
    clearTimeout(this._requestTimer);
    this._requestTimer = setTimeout(() => {
      const rows = this._generateRange(range.start, range.end - range.start + 1, true);
      this._ng_api.onRowsDelivered.next({ range: range, rows: rows });
    }, 550);
  }

  private _getRange(range: IRange): IRowsPacket {
    this._requestedRange = Object.assign({}, range);
    return {
      range: range,
      rows: this._generateRange(range.start, range.end - range.start + 1, false),
    };
  }

  private _getStorageInfo(): IStorageInformation {
    return {
      count: 5000000
    };
  }

  private _generateRange(start: number, count: number, data: boolean = false): IRow[] {
    if (data) {
      return Array.from({ length: count }).map((_, i) => {
        return {
          index: i + start,
          row: Date.now().toString() + (Math.random() * 1000000000000).toFixed(0).repeat(Math.round(Math.random() * 5))
      };
      });
    } else {
      return Array.from({ length: count }).map((_, i) => {
        return {
          index: i + start,
        };
      });
    }
  }

}
