import { Observable, Subject } from 'rxjs';
import * as Tools from '../tools/index';

export class Coor {
    public l: number = 0;
    public t: number = 0;
    public w: number = 0;
    public h: number = 0;
    public c: number = 0;
    public r: number = 0;
    public id: string;

    constructor(id: string, t?: number, l?: number, h?: number, w?: number, c?: number, r?: number) {
        this.id = id;
        if (t !== undefined)  { this.t = t; }
        if (l !== undefined)  { this.l = l; }
        if (h !== undefined)  { this.h = h; }
        if (w !== undefined)  { this.w = w; }
        if (c !== undefined)  { this.c = c; }
        if (r !== undefined)  { this.r = r; }
    }

}

export interface IDock {
    id?: string;
    caption: string;
    coor?: Coor;
}

export interface IPoint {
    t: number;
    l: number;
    h: number;
    w: number;
}

export class CoorcController extends Tools.Emitter {

    public static EVENTS = {
        reordered: Symbol(),
        resized: Symbol(),
        moved: Symbol()
    };

    private _coors: Coor[] = [];
    private _rowsMaxDef: number = 100;
    private _columnsMaxDef: number = 100;
    private _rowsMax: number = 100;
    private _columnsMax: number = 100;
    private _minRows: number = 20;
    private _minColumns: number = 20;

    public add(id: string, coor: Coor | undefined) {
        if (coor === undefined) {
            coor = new Coor(id);
        }
        this._coors.push(coor);
        this._reorder();
    }

    public get(id: string): Coor | null {
        let coor: Coor | null = null;
        this._coors.forEach((storedCoor: Coor) => {
            if (coor !== null) {
                return;
            }
            if (storedCoor.id === id) {
                coor = storedCoor;
            }
        });
        return coor;
    }

    public moved(id: string, t: number, l: number) {
        const tragetIndex: number | null = this._getIndex(id);
        if (tragetIndex === null) {
            return;
        }
        const target: Coor = this._coors[tragetIndex];
        const TYPES = {
            t: 't',
            l: 'l'
        };
        let type: string = '';
        let change: number;
        if (Math.abs(target.t - t) > Math.abs(target.l - l)) {
            type = TYPES.t;
            change = target.t - t;
        } else {
            type = TYPES.l;
            change = target.l - l;
        }
        this._coors[tragetIndex].t = t;
        this._coors[tragetIndex].l = l;
        this._coors.forEach((storedCoor: Coor, index: number) => {
            if (index === tragetIndex) {
                return;
            }
            if (!this._isCross(storedCoor, target)) {
                return;
            }
            switch (type) {
                case TYPES.t:
                    storedCoor.t -= change;
                    break;
                case TYPES.l:
                    storedCoor.l -= change;
                    break;
            }
            this._coors[index] = storedCoor;
            this.emit(CoorcController.EVENTS.moved, storedCoor);
        });
    }

    public isAbleToMove(id: string, t: number, l: number): { byHeight: boolean, byWidth: boolean } {
        const original: Coor = this.get(id);
        if (original === null) {
            return { byHeight: false, byWidth: false };
        }
        const h = original.h;
        const w = original.w;
        let byHeight: boolean = true;
        let byWidth: boolean = true;
        if (l < 0 || (w + l) > this._columnsMax || w < this._minColumns) {
            byWidth = false;
        }
        if (t < 0 || (h + t) > this._rowsMax || h < this._minRows) {
            byHeight = false;
        }
        const target: Coor = new Coor(id);
        target.t = t;
        target.l = l;
        target.h = h;
        target.w = w;
        const TYPES = {
            t: 't',
            l: 'l',
        };
        let type: string = '';
        let change: number;
        if (Math.abs(original.t - t) > Math.abs(original.l - l)) {
            type = TYPES.t;
            change = original.t - t;
        } else {
            type = TYPES.l;
            change = original.l - l;
        }
        this._coors.forEach((storedCoor: Coor) => {
            if (storedCoor.id === target.id) {
                return;
            }
            if (!this._isCross(storedCoor, target)) {
                return;
            }
            switch (type) {
                case TYPES.t:
                    const top = storedCoor.t - change;
                    if (top < 0 || (storedCoor.h + top) > this._rowsMax || storedCoor.h < this._minRows) {
                        byHeight = false;
                    }
                    if (byHeight) {
                        byHeight = !this._isCrossSomeone(new Coor(storedCoor.id, top, storedCoor.l, storedCoor.h, storedCoor.w));
                    }
                    byWidth = false;
                    break;
                case TYPES.l:
                    const left = storedCoor.l - change;
                    if (left < 0 || (storedCoor.w + left) > this._columnsMax || storedCoor.w < this._minColumns) {
                        byWidth = false;
                    }
                    if (byWidth) {
                        byWidth = !this._isCrossSomeone(new Coor(storedCoor.id, storedCoor.t, left, storedCoor.h, storedCoor.w));
                    }
                    byHeight = false;
                    break;
            }
        });
        return { byHeight: byHeight, byWidth: byWidth };
    }

    public resized(id: string, t: number, l: number, w: number, h: number) {
        const tragetIndex: number | null = this._getIndex(id);
        if (tragetIndex === null) {
            return;
        }
        const target: Coor = this._coors[tragetIndex];
        const TYPES = {
            t: 't',
            l: 'l',
            w: 'w',
            h: 'h',
            th: 'th',
            lw: 'lw'
        };
        let type: string = '';
        let change: number;
        if (target.t !== t) { type += TYPES.t; change = target.t - t; }
        if (target.h !== h) { change = (type === '' ? (target.h - h) : change); type += TYPES.h; }
        if (target.l !== l) { type += TYPES.l; change = target.l - l; }
        if (target.w !== w) { change = (type === '' ? (target.w - w) : change); type += TYPES.w; }
        if (type === '') {
            return;
        }
        this._coors[tragetIndex].t = t;
        this._coors[tragetIndex].l = l;
        this._coors[tragetIndex].h = h;
        this._coors[tragetIndex].w = w;
        this._coors.forEach((storedCoor: Coor, index: number) => {
            if (index === tragetIndex) {
                return;
            }
            if (!this._isCross(storedCoor, target)) {
                return;
            }
            switch (type) {
                case TYPES.t:
                case TYPES.th:
                    storedCoor.h -= change;
                    break;
                case TYPES.h:
                    storedCoor.t -= change;
                    storedCoor.h += change;
                    break;
                case TYPES.l:
                case TYPES.lw:
                    storedCoor.w -= change;
                    break;
                case TYPES.w:
                    storedCoor.l -= change;
                    storedCoor.w += change;
                    break;
            }
            this._coors[index] = storedCoor;
            this.emit(CoorcController.EVENTS.resized, storedCoor);
        });
    }

    public isAbleToResize(id: string, t: number, l: number, w: number, h: number): { byHeight: boolean, byWidth: boolean } {
        const original: Coor = this.get(id);
        if (original === null) {
            return { byHeight: false, byWidth: false };
        }
        let byHeight: boolean = true;
        let byWidth: boolean = true;
        if (l < 0 || (w + l) > this._columnsMax || w < this._minColumns) {
            byWidth = false;
        }
        if (t < 0 || (h + t) > this._rowsMax || h < this._minRows) {
            byHeight = false;
        }
        const target: Coor = new Coor(id);
        target.t = t;
        target.l = l;
        target.h = h;
        target.w = w;
        const TYPES = {
            t: 't',
            l: 'l',
            w: 'w',
            h: 'h',
            th: 'th',
            lw: 'lw'
        };
        let type: string = '';
        let change: number;
        if (original.t !== t) { type += TYPES.t; change = original.t - t; }
        if (original.h !== h) { change = (type === '' ? (original.h - h) : change); type += TYPES.h; }
        if (original.l !== l) { type += TYPES.l; change = original.l - l; }
        if (original.w !== w) { change = (type === '' ? (original.w - w) : change); type += TYPES.w; }
        if (type === '') {
            return { byHeight: true, byWidth: true };
        }
        this._coors.forEach((storedCoor: Coor) => {
            if (storedCoor.id === target.id) {
                return;
            }
            if (!this._isCross(storedCoor, target)) {
                return;
            }
            let width: number = -1;
            let height: number = -1;
            let top: number = -1;
            let left: number = -1;
            switch (type) {
                case TYPES.t:
                case TYPES.th:
                    height = storedCoor.h - change;
                    byWidth = false;
                    break;
                case TYPES.h:
                    top = storedCoor.t - change;
                    height = storedCoor.h + change;
                    break;
                case TYPES.l:
                case TYPES.lw:
                    width = storedCoor.w - change;
                    byHeight = false;
                    break;
                case TYPES.w:
                    left = storedCoor.l - change;
                    width = storedCoor.w + change;
                    break;
            }
            if ((width + left) > this._columnsMax || width < this._minColumns) {
                byWidth = false;
            }
            if ((height + top) > this._rowsMax || height < this._minRows) {
                byHeight = false;
            }
        });
        return { byHeight: byHeight, byWidth: byWidth };
    }

    public getFreeSpaceFromPoint(point: IPoint): Coor {
        const scale = {
            h: point.h / this._rowsMax,
            w: point.w / this._columnsMax
        };
        const t0 = Math.floor(point.t / scale.h);
        const l0 = Math.floor(point.l / scale.w);
        let r = l0;
        let l = l0;
        // Detect left / right
        do {
            if (this._isPointBusy(t0, r)) { r -= 1; break; }
            if (r >= this._columnsMax) { break; }
            r += 1;
        } while (true);
        do {
            if (this._isPointBusy(t0, l)) { l += 1; break; }
            if (l <= 0) { break; }
            l -= 1;
        } while (true);
        // Detect top / bottom
        let t = -1;
        let b = -1;
        for (let t1 = t0; t1 >= 0; t1 -= 1) {
            for (let l1 = l; l1 <= r; l1 += 1) {
                if (this._isPointBusy(t1, l1)) {
                    t = t1 + 1;
                    break;
                }
            }
            if (t !== -1) {
                break;
            }
        }
        t = t === -1 ? 0 : t;
        for (let b1 = t0; b1 <= this._rowsMax; b1 += 1) {
            for (let l1 = l; l1 <= r; l1 += 1) {
                if (this._isPointBusy(b1, l1)) {
                    b = b1 - 1;
                    break;
                }
            }
            if (b !== -1) {
                break;
            }
        }
        b = b === -1 ? this._rowsMax : b;
        const coor = new Coor('', t, l, b - t, r - l, this._columnsMax, this._rowsMax);
        return coor;
    }

    private _isCross(coorA: Coor, coorB: Coor): boolean {
        const aX1: number = coorA.l;
        const aY1: number = coorA.t + coorA.h;
        const aX2: number = coorA.l + coorA.w;
        const aY2: number = coorA.t;
        const bX1: number = coorB.l;
        const bY1: number = coorB.t + coorB.h;
        const bX2: number = coorB.l + coorB.w;
        const bY2: number = coorB.t;
        const l: number = Math.max(aX1, bX1);
        const r: number = Math.min(aX2, bX2);
        const b: number = Math.min(aY1, bY1);
        const t: number = Math.max(aY2, bY2);
        if (r - l <= 0 || b - t <= 0) {
            return false;
        }
        return true;
    }

    private _isCrossSomeone(target: Coor): boolean {
        let result = false;
        this._coors.forEach((coor: Coor) => {
            if (result) {
                return;
            }
            if (coor.id === target.id) {
                return;
            }
            result = this._isCross(coor, target);
        });
        return result;
    }

    private _isPointBusy(t: number, l: number): boolean {
        let result = false;
        this._coors.forEach((coor: Coor) => {
            if (result) {
                return;
            }
            if (t > coor.t && t < (coor.t + coor.h) && l > coor.l && l < (coor.l + coor.w)) {
                result = true;
            }
        });
        return result;
    }

    private _reorder() {
        const count: number = this._coors.length;
        const pow: number = Math.pow(count, 1 / 2);
        const byWidth: number = Math.ceil(pow);
        const byHeight: number = Math.floor(pow) * byWidth >= count ? Math.floor(pow) : Math.ceil(pow);
        this._columnsMax = byWidth * Math.ceil(this._columnsMaxDef / byWidth);
        this._rowsMax = byHeight * Math.ceil(this._rowsMaxDef / byHeight);
        let cL: number = 0;
        let cT: number = 0;
        this._coors = this._coors.map((coor: Coor, i: number) => {
            coor.c = this._columnsMax;
            coor.r = this._rowsMax;
            coor.l = cL;
            coor.t = cT;
            coor.w = this._columnsMax / byWidth;
            coor.h = this._rowsMax / byHeight;
            if (i === count - 1) {
                coor.w += (coor.w + coor.l === this._columnsMax) ? 0 : (this._columnsMax - coor.w - coor.l);
                coor.h += (coor.h + coor.t === this._rowsMax) ? 0 : (this._rowsMax - coor.h - coor.t);
            }
            cL += this._columnsMax / byWidth;
            if (cL >= this._columnsMax) {
                cT += this._rowsMax / byHeight;
                cL = 0;
            }
            return coor;
        });
        this.emit(CoorcController.EVENTS.reordered);
    }

    private _getIndex(id: string): number | null {
        let index: number | null = null;
        this._coors.forEach((storedCoor: Coor, i: number) => {
            if (index !== null) {
                return;
            }
            if (storedCoor.id === id) {
                index = i;
            }
        });
        return index;
    }

}

export class DocksService {

    public static EVENTS = {
        startedManipulation: Symbol(),
        finishedManipulation: Symbol(),
    };

    private _subjectDocks = new Subject<IDock>();
    private _subjectCoors = new Subject<Map<string, IDock>>();
    private _subjectResized = new Subject<Coor>();
    private _subjectMoved = new Subject<Coor>();
    private _subjectStartedManipulation = new Subject<string>();
    private _subjectFinishedManipulation = new Subject<string>();
    private _docks: Map<string, IDock> = new Map();
    private _sessionId: string = '';
    private _coors: CoorcController = new CoorcController();

    constructor(sessionId: string, docks: IDock[]) {
        this._sessionId = sessionId;
        this._coors.subscribe(CoorcController.EVENTS.reordered, this._onReordered.bind(this));
        this._coors.subscribe(CoorcController.EVENTS.resized, this._onResized.bind(this));
        this._coors.subscribe(CoorcController.EVENTS.moved, this._onMoved.bind(this));
        if (docks instanceof Array) {
            docks.forEach((dock: IDock) => {
                dock = this._normalize(dock);
                if (dock === null) {
                    return;
                }
                this._docks.set(dock.id, dock);
                this._coors.add(dock.id, dock.coor);
            });
        }
    }

    public destroy() {
        this._coors.unsubscribeAll();
    }

    public get(): Map<string, IDock> {
        return this._docks;
    }

    public add(dock: IDock) {
        dock = this._normalize(dock);
        if (dock === null) {
            return;
        }
        this._docks.set(dock.id, dock);
        this._coors.add(dock.id, dock.coor);
        this._subjectDocks.next(dock);
    }

    public moved(id: string, t: number, l: number) {
        this._coors.moved(id, t, l);
    }

    public isAbleToMove(id: string, t: number, l: number): { byHeight: boolean, byWidth: boolean } {
        return this._coors.isAbleToMove(id, t, l);
    }

    public resized(id: string, t: number, l: number, w: number, h: number) {
        this._coors.resized(id, t, l, w, h);
    }

    public isAbleToResize(id: string, t: number, l: number, w: number, h: number): { byHeight: boolean, byWidth: boolean } {
        return this._coors.isAbleToResize(id, t, l, w, h);
    }

    public clear() {
        this._docks.clear();
        this._subjectDocks.next();
    }

    public getDocksObservable(): Observable<IDock> {
        return this._subjectDocks.asObservable();
    }

    public getCoorsObservable(): Observable<Map<string, IDock>> {
        return this._subjectCoors.asObservable();
    }

    public getResizedObservable(): Observable<Coor> {
        return this._subjectResized.asObservable();
    }

    public getMovedObservable(): Observable<Coor> {
        return this._subjectMoved.asObservable();
    }

    public getStartedManipulationObservable(): Observable<string> {
        return this._subjectStartedManipulation.asObservable();
    }

    public getFinishedManipulationObservable(): Observable<string> {
        return this._subjectFinishedManipulation.asObservable();
    }

    public getSessionId(): string {
        return this._sessionId;
    }

    public startedManipulation(id: string) {
        this._subjectStartedManipulation.next(id);
    }

    public finishedManipulation(id: string) {
        this._subjectFinishedManipulation.next(id);
    }

    public getFreeSpaceFromPoint(point: IPoint): Coor {
        return this._coors.getFreeSpaceFromPoint(point);
    }

    private _normalize(dock: IDock): IDock {
        if (typeof dock !== 'object' || dock === null) {
            return null;
        }
        dock.id = typeof dock.id === 'string' ? (dock.id.trim() !== '' ? dock.id : Tools.guid()) : Tools.guid();
        return dock;
    }

    private _onReordered() {
        this._docks.forEach((dock: IDock, id: string) => {
            dock.coor = this._coors.get(id);
            this._docks.set(id, dock);
        });
        this._subjectCoors.next(this._docks);
    }

    private _onResized(coor: Coor) {
        this._subjectResized.next(coor);
    }

    private _onMoved(coor: Coor) {
        this._subjectMoved.next(coor);
    }

}
