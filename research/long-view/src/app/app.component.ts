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
  private _rows: IRow[] = [];
  private _range: IRow[] = [];

  constructor() {
    this._ng_api = {
      getComponentFactory: this._getComponentFactory.bind(this),
      getRange: this._getRange.bind(this),
      getStorageInfo: this._getStorageInfo.bind(this),
      updatingDone: this._onUpdatingDone.bind(this),
      onStorageUpdated: new Subject<IStorageInformation>(),
      onRowsDelivered: new Subject<IRowsPacket>(),
      onRangeUpdated: new Subject<IRow[]>(),
      onScrollTo: new Subject<number>(),
      getItemHeight: () => 12,
      onRedraw: new Subject<void>(),
    };
    this._rows = Array.from({ length: 2500 }).map((_, i) => {
      return {
        index: i,
        row: i.toString() + this._randomStr() + '[end]',
      };
    });
    /*
    setTimeout(() => {
      this._range.splice(2, 0, { index : '--I1--', row: 'Injected 1'});
      this._range.splice(3, 0, { index : '--I2--', row: 'Injected 2'});
      this._range.splice(15, 0, { index : '--I3--', row: 'Injected 3'});
      this._ng_api.onRangeUpdated.next(this._range);
    }, 2000);
    */
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

  private _randomStr(): string {
    let str = '';
    const data = 'qw er tyui op asd fgh jkl zx cvb nm Q WER TYU IOP AS DF GHJ KLZ XCV BNM ';
    for (let i = Math.round(Math.random() * 150); i >= 0; i -= 1) {
      str += data.charAt(Math.round(Math.random() * (data.length - 1)));
    }
    return str;
  }

  private _getComponentFactory(): any {
    return RowComponent;
  }

  private _onUpdatingDone(range: IRange) {
    const rows = this._generateRange(range.start, range.end - range.start + 1, true);
    /*
    clearTimeout(this._requestTimer);
    this._requestTimer = setTimeout(() => {
      const rows = this._generateRange(range.start, range.end - range.start + 1, true);
      this._ng_api.onRowsDelivered.next({ range: range, rows: rows });
    }, 550);
    */
  }

  private _getRange(range: IRange): IRowsPacket {
    this._requestedRange = Object.assign({}, range);
    this._range = this._generateRange(range.start, range.end - range.start + 1, true);
    if (range.start <= 15) {
      this._range.splice(2 - range.start, 0, { index : '--I1--', row: 'Injected 1'});
      this._range.splice(3 - range.start, 0, { index : '--I2--', row: 'Injected 2'});
      this._range.splice(4 - range.start, 0, { index : '--I4--', row: 'Injected 2'});
      this._range.splice(5 - range.start, 0, { index : '--I5--', row: 'Injected 2'});
      this._range.splice(6 - range.start, 0, { index : '--I6--', row: 'Injected 2'});
      this._range.splice(15 - range.start, 0, { index : '--I3--', row: 'Injected 3'});
    }
    return {
      range: range,
      rows: this._range.slice(),
    };
  }

  private _getStorageInfo(): IStorageInformation {
    return {
      count: 2500
    };
  }

  private _generateRange(start: number, count: number, data: boolean = false): IRow[] {
    return this._rows.slice(start, start + count);
  }

  /*
  private _generateRange(start: number, count: number, data: boolean = false): IRow[] {
    if (data) {
      return Array.from({ length: count }).map((_, i) => {
        return {
          index: i + start,
          row: (i + start).toString().repeat(Math.round(start / 100)) + 'E',
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
  */
}
