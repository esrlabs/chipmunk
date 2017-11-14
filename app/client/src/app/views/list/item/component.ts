import {Component, Input, Output, OnDestroy, OnChanges, AfterContentChecked, EventEmitter, ChangeDetectorRef} from '@angular/core';
import {DomSanitizer, SafeHtml} from '@angular/platform-browser';

import { ListItemInterface                      } from './interface';
import { events as Events                       } from '../../../core/modules/controller.events';
import { configuration as Configuration         } from '../../../core/modules/controller.config';

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
        this.html = this.val;
        if (typeof this.match === 'string' && this.match !== null && this.match !== ''){
            let matches = null,
                mark    = '<@-=!=-@>';
            this.regsCache[this.match]  === void 0 && (this.regsCache[this.match]   = new RegExp(this.match, 'gi'));
            this.regsCache[mark]        === void 0 && (this.regsCache[mark]         = new RegExp(mark, 'gi'));
            matches = this.html.match(this.regsCache[this.match]);
            if (matches instanceof Array && matches.length > 0){
                matches.forEach((match)=>{
                    let _match = match.substr(0,1) + mark + match.substr(1, match.length - 1);
                    this.html = this.html.replace(match, '<span class="match">' + _match + '</span>')
                });
                this.html = this.html.replace(this.regsCache[mark], '');
            }
        }
    }

    addMarkers(){
        if (this.markers instanceof Array){
            this.markers.forEach((marker)=>{
                let matches = null,
                    mark    = '<@-=!=-@>';
                this.regsCache[marker.value]    === void 0 && (this.regsCache[marker.value] = this.createRegExp(marker.value));
                this.regsCache[mark]            === void 0 && (this.regsCache[mark]         = this.createRegExp(mark));
                if (this.regsCache[marker.value] !== null){
                    matches = this.html.match(this.regsCache[marker.value]);
                    if (matches instanceof Array && matches.length > 0){
                        matches.forEach((match)=>{
                            let _match = match.substr(0,1) + mark + match.substr(1, match.length - 1);
                            //this.html = this.html.replace(match, '<span class="marker" style="' + this.sanitizer.bypassSecurityTrustStyle('background-color:' + marker.color) + '">' + _match + '</span>')
                            this.html = this.html.replace(match, '<span class="marker" style="background-color: ' + marker.backgroundColor + ';color:' + marker.foregroundColor+ ';">' + _match + '</span>')
                        });
                        this.html = this.html.replace(this.regsCache[mark], '');
                    }
                }
            });
        }
    }

    createRegExp(str: string): RegExp{
        let result = null;
        try{
            str     = str.replace(/\+/gi, '\\+').replace(/\[/gi, '\[').replace(/\\]/gi, '\\]');
            result  = new RegExp(str, 'gi');
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
        this.addMarkers();
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
        if (this._markersHash !== this.markersHash || this._match !== this.match){
            this._markersHash   = this.markersHash;
            this._match         = this.match;
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
