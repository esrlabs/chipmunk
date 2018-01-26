import {
    Component, Input, ViewChild, AfterContentInit, OnInit, EventEmitter, ViewContainerRef,
    ComponentFactoryResolver, ChangeDetectorRef, OnDestroy, AfterViewChecked
} from '@angular/core';
import { CommonInput                    } from '../../../input/component';
import { SimpleCheckbox                 } from '../../../checkboxes/simple/component';
import { popupController                } from '../../../../common/popup/controller';
import { ProgressBarCircle              } from '../../../../common/progressbar.circle/component';
import { configuration as Configuration } from "../../../../../modules/controller.config";
import { events as Events               } from "../../../../../modules/controller.events";
import { TabController                  } from '../../../../common/tabs/tab/class.tab.controller';
import { CommonSimpleTable              } from '../../../table/simple/component';
import { ButtonFlatText                 } from '../../../buttons/flat-text/component';
import { DomSanitizer, SafeHtml         } from "@angular/platform-browser";
import { serializeStringForReg          } from '../../../../../modules/tools.regexp';
import {SimpleText} from "../../../text/simple/component";

interface SearchMatch{
    request: string,
    matches: Array<SafeHtml>,
    count  : number
}
interface SearchResults {
    file    : string,
    results : Array<SearchMatch>
}

const ALL_FILES = Symbol();
const MAX_LINE_FOR_REQUEST = 100;
const MAX_FILE_SIZE_TO_OPEN = 50 * 1024 * 1024;

@Component({
    selector    : 'dialog-monitor-manager-logs-tab',
    templateUrl : './template.html',
})

export class DialogMonitorManagerLogsTab extends TabController implements OnDestroy, AfterContentInit, OnInit, AfterViewChecked{

    @Input() files              : Array<string> = [];
    @Input() register           : any           = {};

    @Input() getFileContent     : Function      = null;
    @Input() getAllFilesContent : Function      = null;
    @Input() getMatches         : Function      = null;
    @Input() getFilesInfo       : Function      = null;

    @ViewChild('_buttonDownload') _buttonDownload   : ButtonFlatText;
    @ViewChild('_buttonOpen'    ) _buttonOpen       : ButtonFlatText;
    @ViewChild('_search_request') _search_request   : CommonInput;
    @ViewChild('_search_reg'    ) _search_reg       : SimpleCheckbox;

    @ViewChild ('exporturl', { read: ViewContainerRef}) exportURLNode: ViewContainerRef;

    private defaultColumns  : Array<string>         = ['Name', 'Started', 'Updated', 'Size'];
    private columns         : Array<string>         = [];
    private rows            : Array<Array<string>>  = [];
    private selected        : number                = -1;
    private cache           : Object                = {};
    private exportdata      : {
        url         : any,
        filename    : string
    } = {
        url         : null,
        filename    : ''
    };
    private searchResults   : Array<SearchResults> = [];

    constructor(private componentFactoryResolver    : ComponentFactoryResolver,
                private viewContainerRef            : ViewContainerRef,
                private changeDetectorRef           : ChangeDetectorRef,
                private sanitizer                   : DomSanitizer) {
        super();
        this.onDownload         = this.onDownload.bind(this);
        this.onOpen             = this.onOpen.bind(this);
        this.onOpenAll          = this.onOpenAll.bind(this);
        this.onDownloadAll      = this.onDownloadAll.bind(this);
        this.onTabSelected      = this.onTabSelected.bind(this);
        this.onTabDeselected    = this.onTabDeselected.bind(this);

    }

    ngOnInit(){
        this.onSelect   .subscribe(this.onTabSelected);
        this.onDeselect .subscribe(this.onTabDeselected);
    }

    ngOnDestroy(){
        this.onSelect.      unsubscribe();
        this.onDeselect.    unsubscribe();
    }

    ngAfterContentInit(){
        this.updateRows();
    }

    ngAfterViewChecked(){
        if (this.exportdata.url !== null && this.exportURLNode !== null){
            this.exportURLNode.element.nativeElement.click();
            this.exportdata.url         = null;
            this.exportdata.filename    = '';
        }
    }

    updateRows() {
        let byFiles = {};
        this.rows   = [];
        this.columns= [];
        this.columns.push(...this.defaultColumns);
        if (this.searchResults.length > 0){
            this.columns.push(...this.searchResults[0].results.map((results) => {
                return results.request;
            }));
            this.searchResults.forEach((results)=>{
                byFiles[results.file] = results.results;
            });
        }
        if (this.files instanceof Array && typeof this.register === 'object' && this.register !== null) {
            this.files.forEach((file: string) => {
                if (this.parseRegisterEntry(this.register[file])) {
                    let row = [
                        file,
                        this.register[file].opened !== -1 ? this.getDate(this.register[file].opened) : 'no open date',
                        this.register[file].closed !== -1 ? this.getDate(this.register[file].closed) : 'not updated yet',
                        (this.register[file].size / 1024 / 1024).toFixed(2) + ' MB'
                    ];
                    if (byFiles[file] !== void 0){
                        row.push(...byFiles[file].map((results: SearchMatch) => {
                            return results.count;
                        }));
                    }
                    this.rows.push(row);
                }
            });
        }

    }

    forceUpdate(){
        this.changeDetectorRef.detectChanges();
    }

    parseRegisterEntry(entry: any){
        let result = true;
        if (typeof entry === 'object' && entry !== null) {
            entry.opened === void 0 && (result = false);
            entry.closed === void 0 && (result = false);
        } else {
            result = false;
        }
        return result;
    }

    getDate(timestamp: number): string {
        function fillDigits(d: number, c: number): string {
            let res = d + '';
            return (res.length < c ? '0'.repeat(c - res.length): '') + res;
        };
        let result  = '';
        let date    = new Date(timestamp);
        return `${fillDigits(date.getDate(), 2)}.${fillDigits(date.getMonth() + 1, 2)}.${fillDigits(date.getFullYear(), 4)} ${fillDigits(date.getHours(), 2)}:${fillDigits(date.getMinutes(), 2)}:${fillDigits(date.getSeconds(), 2)}:${fillDigits(date.getMilliseconds(), 3)}`;
    }

    onTabSelected(){
        let GUID = this.showProgress('Please wait...');
        this.getFilesInfo((info: any) => {
            popupController.close(GUID);
            info = info !== null ? info : { list: [], register: {} };
            this.files      = info.list;
            this.register   = info.register;
            this.updateRows();
        });
    }

    onTabDeselected(){

    }

    _downloadAllFiles(callback: Function){
        if (this.cache[ALL_FILES] !== void 0) {
            return callback(this.cache[ALL_FILES]);
        }
        let GUID = this.showProgress(`Please wait...`)
        this.getAllFilesContent((text: string) => {
            popupController.close(GUID);
            if (typeof text !== 'string') {
                return callback(null);
            }
            this.cache[ALL_FILES] = text;
            callback(text);
        });
    }

    onOpenAll(){
        this._downloadAllFiles((content: string) => {
            if (content !== null) {
                if (content.length > MAX_FILE_SIZE_TO_OPEN) {
                    return this.showMessage('Too big file', `Unfortunately current version of logviewer cannot open this file. It's too big. Size of file is: ${ Math.round(content.length / 1024 / 1024 )} Mb. Maximum supported file size is: ${MAX_FILE_SIZE_TO_OPEN} Mb.`);
                }
                Events.trigger(Configuration.sets.SYSTEM_EVENTS.DESCRIPTION_OF_STREAM_UPDATED, 'Compilation from all logs files');
                Events.trigger(Configuration.sets.SYSTEM_EVENTS.TXT_DATA_COME, content);
            }
        });
    }

    onDownloadAll(){
        this._downloadAllFiles((content: string) => {
            if (content !== null) {
                this.downloadFile('export_' + (new Date()).getTime() + '.logs', content);
            }
        });
    }

    _downloadSelectedFile(callback: Function){
        if (!~this.selected || this.files[this.selected] === void 0) {
            return callback(null, null);
        }
        let file = this.files[this.selected];
        if (this.cache[file] !== void 0) {
            return callback(file, this.cache[file]);
        }
        let GUID = this.showProgress(`Please wait...`)
        this.getFileContent(file, (text: string) => {
            popupController.close(GUID);
            if (typeof text !== 'string') {
                return callback(null, null);
            }
            this.cache[file] = text;
            callback(file, text);
        });
    }

    onDownload(){
        this._downloadSelectedFile((file: string, content: string) => {
            if (file !== null && content !== null) {
                this.downloadFile(file, content);
            }
        });
    }

    onOpen(){
        this._downloadSelectedFile((file: string, content: string) => {
            if (file !== null && content !== null) {
                Events.trigger(Configuration.sets.SYSTEM_EVENTS.DESCRIPTION_OF_STREAM_UPDATED, file);
                Events.trigger(Configuration.sets.SYSTEM_EVENTS.TXT_DATA_COME, content);
            }
        });
    }

    onSelectFile(index: number){
        this.selected = index;
        if (this.selected !== -1){
            this._buttonDownload.enable();
            this._buttonOpen.enable();
        } else {
            this._buttonDownload.disable();
            this._buttonOpen.disable();
        }
        this.forceUpdate();
    }

    onSearchRequest(){
        function addMarkers(str: string, isReg: boolean, request: string){
            let reg = new RegExp(
                isReg ? request : serializeStringForReg(request),
                'gi'
            );
            let matches = str.match(reg);
            if (matches instanceof Array) {
                matches.forEach((match: string) => {
                    str = str.replace(match, `<span class="match">${match}</span>`)
                });
            }
            return this.sanitizer.bypassSecurityTrustHtml(str);
        };
        let request = this._search_request.getValue();
        let reg     = this._search_reg.getValue();
        if (request.trim() !== '' && this.files.length > 0) {
            request = request.split(';').filter((request: string) => {
                return request.trim() !== '';
            });
            let GUID = this.showProgress(`Please wait...`)
            this.getMatches(reg, request, (result: any) => {
                popupController.close(GUID);
                if (result === null) {
                    return false;
                }
                this.searchResults = [];
                Object.keys(result).forEach((file: string) => {
                    let requests = result[file];
                    let searchResults = {
                        file    : file,
                        results : Object.keys(requests).map((request: string) => {
                            !(requests[request] instanceof Array) && (requests[request] = []);
                            return {
                                request: request,
                                matches: requests[request].map((match: string, index: number) => {
                                    return index < MAX_LINE_FOR_REQUEST ? addMarkers.call(this,typeof match === 'string' ? match : '', reg, request) : false;
                                }).filter((str: SafeHtml) => {
                                    return str !== false;
                                }),
                                count  : requests[request].length
                            }
                        })
                    };
                    this.searchResults.push(searchResults);
                });
                this.updateRows();
                this.forceUpdate();
            });
        }
    }

    showProgress(caption : string){
        let GUID = Symbol();
        popupController.open({
            content : {
                factory     : null,
                component   : ProgressBarCircle,
                params      : {}
            },
            title   : caption,
            settings: {
                move            : false,
                resize          : false,
                width           : '20rem',
                height          : '10rem',
                close           : false,
                addCloseHandle  : false,
                css             : ''
            },
            buttons         : [],
            titlebuttons    : [],
            GUID            : GUID
        });
        return GUID;
    }

    showMessage(title: string, message: string){
        popupController.open({
            content : {
                factory     : null,
                component   : SimpleText,
                params      : {
                    text: message
                }
            },
            title   : title,
            settings: {
                move            : true,
                resize          : true,
                width           : '20rem',
                height          : '10rem',
                close           : true,
                addCloseHandle  : true,
                css             : ''
            },
            buttons         : [],
            titlebuttons    : [],
            GUID            : Symbol()
        });
    }

    downloadFile(file: string, content: string){
        let blob    = new Blob([content], {type: 'text/plain'}),
            url     = URL.createObjectURL(blob);
        this.exportdata.url         = this.sanitizer.bypassSecurityTrustUrl(url);
        this.exportdata.filename    = file;
        this.forceUpdate();
    }

}
