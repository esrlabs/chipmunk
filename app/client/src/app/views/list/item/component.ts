import {Component, Input, Output, OnDestroy, OnChanges, AfterContentChecked, EventEmitter, ChangeDetectorRef} from '@angular/core';
import {DomSanitizer, SafeHtml} from '@angular/platform-browser';

import { ListItemInterface                          } from './interface';
import { events as Events                           } from '../../../core/modules/controller.events';
import { configuration as Configuration             } from '../../../core/modules/controller.config';
import { ANSIReader                                 } from '../../../core/modules/tools.ansireader';
import { serializeHTML, parseHTML                   } from '../../../core/modules/tools.htmlserialize';
import { serializeStringForReg, safelyCreateRegExp  } from '../../../core/modules/tools.regexp';

const MARKERS = {
    MATCH       : '\uAA86!\uAA87',
    MARKER_LEFT : '\uAA88',
    MARKER_RIGHT: '\uAA89'
};

@Component({
  selector      : 'list-view-item',
  templateUrl   : './template.html'
})

export class ViewControllerListItem implements ListItemInterface, OnDestroy, OnChanges, AfterContentChecked{
    @Input() GUID       : string                = '';
    @Input() val        : string                = '';
    @Input() visibility : boolean               = true;
    @Input() filtered   : boolean               = false;
    @Input() match      : string                = '';
    @Input() matchReg   : boolean               = true;
    @Input() index      : number                = 0;
    @Input() total_rows : number                = 0;
    @Input() selection  : boolean               = false;
    @Input() bookmarked : boolean               = false;
    @Input() markersHash: string                = '';
    @Input() regsCache  : Object                = {};
    @Input() markers    : Array<{
        value           : string,
        backgroundColor : string,
        foregroundColor : string
    }> = [];//Do not bind this <Marker> type, because markers view can be removed
    @Input() highlight  : {
        backgroundColor : string,
        foregroundColor : string
    } = {
        backgroundColor : '',
        foregroundColor : ''
    };

    @Output() selected  : EventEmitter<number>  = new EventEmitter();
    @Output() bookmark  : EventEmitter<number>  = new EventEmitter();

    __index             : string                = '';
    public html         : string                = null;
    public safeHTML     : SafeHtml              = null;
    private _markersHash: string                = '';
    private _match      : string                = '';
    private _matchReg   : boolean               = true;

    ngOnDestroy(){
    }

    constructor(private changeDetectorRef   : ChangeDetectorRef,
                private sanitizer           : DomSanitizer){
        this.changeDetectorRef  = changeDetectorRef;
        this.sanitizer          = sanitizer;
    }

    updateFilledIndex(){
        let total   = this.total_rows.toString(),
            current = this.index.toString();
        this.__index = (total.length - current.length > 0 ? ('0'.repeat(total.length - current.length)) : '') + current;
    }

    getHTML(){
        let matchMatches    = null;
        let markersMatches  : Array<{ mark: string, matches: Array<string>, bg: string, fg: string}> = [];
        this.html = serializeHTML(this.val);
        if (typeof this.match === 'string' && this.match !== null && this.match !== ''){
            let reg = null;
            if (!this.matchReg) {
                this.match = serializeStringForReg(this.match);
                this.regsCache[this.match + '_noReg'] === void 0 && (this.regsCache[this.match + '_noReg'] = safelyCreateRegExp(serializeHTML(this.match), 'g'));
                reg = this.regsCache[this.match + '_noReg'];
            } else {
                this.regsCache[this.match] === void 0 && (this.regsCache[this.match] = safelyCreateRegExp(serializeHTML(this.match), 'gi'));
                reg = this.regsCache[this.match];
            }
            this.regsCache[MARKERS.MATCH] === void 0 && (this.regsCache[MARKERS.MATCH] = safelyCreateRegExp(MARKERS.MATCH, 'gi'));
            if (reg !== null) {
                matchMatches = this.html.match(reg);
                if (matchMatches instanceof Array && matchMatches.length > 0){
                    this.html = this.html.replace(reg, MARKERS.MATCH);
                }
            }
        }
        if (this.markers instanceof Array){
            this.markers.forEach((marker)=>{
                if (marker.value.length > 0) {
                    let matches = null;
                    let mark    = `${MARKERS.MARKER_LEFT}${marker.value}${MARKERS.MARKER_RIGHT}`;
                    this.regsCache[marker.value]    === void 0 && (this.regsCache[marker.value] = safelyCreateRegExp(serializeHTML(serializeStringForReg(marker.value)), 'gi'));
                    this.regsCache[mark]            === void 0 && (this.regsCache[mark]         = safelyCreateRegExp(serializeHTML(serializeStringForReg(mark)), 'gi'));
                    if (this.regsCache[marker.value] !== null){
                        matches = this.html.match(this.regsCache[marker.value]);
                        if (matches instanceof Array && matches.length > 0){
                            this.html = this.html.replace(this.regsCache[marker.value], mark);
                            markersMatches.push({
                                mark    : mark,
                                matches : matches,
                                bg      : marker.backgroundColor,
                                fg      : marker.foregroundColor
                            });
                        }
                    }
                }
            });
        }
        if (matchMatches instanceof Array && matchMatches.length > 0){
            matchMatches.forEach((match)=>{
                this.html = this.html.replace(MARKERS.MATCH, '<span class="match">' + match + '</span>')
            });
        }
        if (markersMatches instanceof Array && markersMatches.length > 0) {
            markersMatches.forEach((marker) => {
                marker.matches.forEach((match)=>{
                    this.html = this.html.replace(marker.mark, `<span class="marker" style="background-color: ${marker.bg};color:${marker.fg};">${match}</span>`)
                });
            });
        }
        this.html = ANSIReader(this.html);
        this.html = parseHTML(this.html);
    }


    createRegExp(str: string): RegExp{
        let result = null;
        try{
            str     = str.replace(/\+/gi, '\\+').replace(/\[/gi, '\\[').replace(/\\]/gi, '\\]');
            result  = safelyCreateRegExp(str, 'gi');
        } catch (e){}
        return result;
    }

    convert(){
        this.safeHTML = this.sanitizer.bypassSecurityTrustHtml(this.html);
    }

    ngAfterContentChecked(){
        this.safeHTML === null && this.ngOnChanges();
    }

    ngOnChanges(){
        this.getHTML();
        this.convert();
        this.updateFilledIndex();
    }

    onSelect(event : MouseEvent){
        this.selected.emit(this.index);
    }

    onUnbookmark(){
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.VIEW_BAR_ADD_FAVORITE_RESPONSE, { GUID: this.GUID, index: this.index });
        this.bookmark.emit(this.index);
    }

    update(params : ListItemInterface){
        Object.keys(params).forEach((key)=>{
            this[key] !== void 0 && (this[key] = params[key]);
        });
        if (this._markersHash !== this.markersHash || this._match !== this.match || this._matchReg !== this.matchReg){
            this._markersHash   = this.markersHash;
            this._match         = this.match;
            this._matchReg      = this.matchReg;
            this.ngOnChanges();
        }
        this.changeDetectorRef.detectChanges();
    }

    onFavorite(){
        this.bookmarked = !this.bookmarked;
        Events.trigger(Configuration.sets.SYSTEM_EVENTS.VIEW_BAR_ADD_FAVORITE_RESPONSE, { GUID: this.GUID, index: this.index });
        this.bookmark.emit(this.index);
    }
}
