import {
    Component,
    AfterContentInit,
    Input,
    HostListener,
    OnDestroy,
    ViewEncapsulation,
} from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { File, FileType } from '@platform/types/files';
import { FileHolder } from './file.holder';
import { Holder } from '@module/matcher';
import { Subject } from '@platform/env/subscription';
import { State } from './state';
import { Filter } from '@ui/env/entities/filter';
import { TabControls } from '@service/session';
import { EContextActionType, IContextAction } from './structure/component';

@Component({
    selector: 'app-tabs-source-multiple-files',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    encapsulation: ViewEncapsulation.None,
})
@Initial()
@Ilc()
export class TabSourceMultipleFiles extends Holder implements AfterContentInit, OnDestroy {
    @Input() files!: File[];
    @Input() tab!: TabControls;

    @HostListener('window:keydown', ['$event'])
    handleKeyDown(event: KeyboardEvent) {
        if (!this._searchInputFocused && this.filter.keyboard(event)) {
            this.matcher.search(this.filter.value());
            this.filesUpdate.emit(
                this.state.files
                    .sort((a: FileHolder, b: FileHolder) => b.getScore() - a.getScore())
                    .filter((file: FileHolder) => file.getScore() > 0),
            );
        }
    }

    public filter: Filter = new Filter(this.ilc());
    public state: State = new State();
    public filesUpdate: Subject<FileHolder[]> = new Subject();

    private _searchInputFocused: boolean = false;

    constructor() {
        super();
    }

    public ngAfterContentInit() {
        const state = this.tab.storage<State>().get();
        if (state !== undefined) {
            this.state = state;
        } else {
            this.state.files = this.files.map((file: File) => new FileHolder(this.matcher, file));
            this.tab.storage().set(this.state);
        }
        this.state.log = this.log();
        this.state.countAndCheck();
    }

    public ngOnSearchFocus(focused: boolean) {
        this._searchInputFocused = focused;
    }

    public ngCancel() {
        this.tab.close();
    }

    public ngOnDestroy() {
        this.filesUpdate.destroy();
        this.tab.storage<State>().set(this.state);
        this.state.destroy();
    }

    public ngConcat() {
        if (this.files.length === 0) {
            return;
        }
        (() => {
            switch (this.files[0].type) {
                case FileType.Text:
                case FileType.Any:
                    return this.ilc().services.system.opener.concat(this.files).text();
                case FileType.Dlt:
                    return this.ilc().services.system.opener.concat(this.files).dlt();
                case FileType.Pcap:
                    return this.ilc().services.system.opener.concat(this.files).pcap();
                default:
                    return Promise.reject(new Error(`Unsupported type ${this.files[0].type}`));
            }
        })()
            .then(() => {
                this.tab.close();
            })
            .catch((_err: Error) => {
                // TODO: notification about errors
                // this.ilc().services.ui.lockers.lock(
                //     new Locker(true, err.message)
                //         .set()
                //         .message(err.message)
                //         .type(Level.error)
                //         .spinner(false)
                //         .end(),
                //     {
                //         closable: true,
                //     },
                // );
            });
    }

    public ngOnDestination() {
        // TODO - Open file explorer to select path
    }

    public ngOnDrop(files: File[]) {
        files.forEach((result: File) => {
            if (
                this.state.files.find((file: FileHolder) => file.filename === result.filename) !==
                undefined
            ) {
                return;
            }
            this.state.files.push(new FileHolder(this.matcher, result));
            this.filesUpdate.emit(this.state.files);
            this.state.countAndCheck();
        });
    }

    public ngOpenEach(files?: FileHolder[]) {
        (files === undefined ? this.state.files : files).forEach((file: FileHolder) => {
            if (file.selected) {
                switch (file.type) {
                    case FileType.Any:
                    case FileType.Text:
                        this.ilc()
                            .services.system.opener.file(file.filename)
                            .text()
                            .catch((err: Error) => {
                                this.log().error(`Fail to open text file; error: ${err.message}`);
                            });
                        break;
                    case FileType.Dlt:
                        this.ilc()
                            .services.system.opener.file(file.filename)
                            .dlt()
                            .catch((err: Error) => {
                                this.log().error(`Fail to open dlt file; error: ${err.message}`);
                            });
                        break;
                    case FileType.Pcap:
                        this.ilc()
                            .services.system.opener.file(file.filename)
                            .pcap()
                            .catch((err: Error) => {
                                this.log().error(`Fail to open pcap file; error: ${err.message}`);
                            });
                        break;
                }
            }
        });
        this.tab.close();
    }

    public ngOnContext(event: IContextAction) {
        const files: FileHolder[] | undefined = event.files;
        switch (event.type) {
            case EContextActionType.open:
                this.ngOpenEach(files);
                break;
            case EContextActionType.update:
                if (files !== undefined) {
                    this.state.files =
                        files.length === 0
                            ? []
                            : this.state.files.filter((f: FileHolder) => !files.includes(f));
                }
                this.state.countAndCheck();
                break;
        }
    }
}
export interface TabSourceMultipleFiles extends IlcInterface {}
