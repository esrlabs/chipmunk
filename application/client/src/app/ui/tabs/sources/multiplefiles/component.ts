import { Component, AfterContentInit, Input, HostListener, OnDestroy } from '@angular/core';
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
import { FileDropped } from '@ui/env/directives/dragdrop.file';

@Component({
    selector: 'app-tabs-source-multiple-files',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Initial()
@Ilc()
export class TabSourceMultipleFiles extends Holder implements AfterContentInit, OnDestroy {
    @Input() files!: File[];
    @Input() tab!: TabControls;

    @HostListener('window:keydown', ['$event'])
    handleKeyDown(event: KeyboardEvent) {
        if (this.filter.keyboard(event)) {
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
        this.state.countAndCheck();
    }

    public ngCancel() {
        this.tab.close();
    }

    public ngOnDestroy() {
        this.tab.storage<State>().set(this.state);
    }

    public ngConcat() {
        // TODO - Concatenate files
        // TODO - Close tab - if DLT new Tab
    }

    public ngOnDestination() {
        // TODO - Open file explorer to select path
    }

    public ngOnDrop(files: FileDropped[] | DragEvent) {
        if (files instanceof DragEvent) {
            return;
        }
        this.ilc()
            .services.system.bridge.files()
            .getByPath(files.map((file: FileDropped) => file.path))
            .then((results: File[]) => {
                results.forEach((result: File) => {
                    if (
                        this.state.files.find(
                            (file: FileHolder) => file.filename === result.filename,
                        ) !== undefined
                    ) {
                        return;
                    }
                    this.state.files.push(new FileHolder(this.matcher, result));
                    this.filesUpdate.emit(this.state.files);
                    this.state.countAndCheck();
                });
            })
            .catch((err: Error) => {
                this.log().error(`Fail to get file info: ${err.message}`);
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
                }
            }
        });
        this.tab.close();
    }

    public ngOnContext(event: IContextAction) {
        const files: FileHolder[] | undefined = event.files;
        switch (event.type) {
            case EContextActionType.open:
                if (event.files !== undefined) {
                    this.ngOpenEach(event.files);
                }
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
