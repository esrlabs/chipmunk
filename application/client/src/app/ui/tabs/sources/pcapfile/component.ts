import {
    Component,
    ChangeDetectorRef,
    AfterViewInit,
    Input,
    AfterContentInit,
} from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { File } from '@platform/types/files';
import { IDLTOptions, EMTIN } from '@platform/types/parsers/dlt';
import { bytesToStr, timestampToUTC } from '@env/str';
import { TabControls } from '@service/session';
import { State } from './state';
import { Timezone } from '@elements/timezones/timezone';
import { components } from '@env/decorators/initial';
import { Action } from '../common/actions/action';

@Component({
    selector: 'app-tabs-source-pcapfile',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Initial()
@Ilc()
export class TabSourcePcapFile extends ChangesDetector implements AfterViewInit, AfterContentInit {
    @Input() done!: (options: IDLTOptions | undefined) => void;
    @Input() files!: File[];
    @Input() options: IDLTOptions | undefined;
    @Input() tab!: TabControls;
    public action: Action = new Action();
    public state: State;
    public logLevels: Array<{ value: string; caption: string }> = [
        { value: EMTIN.DLT_LOG_FATAL, caption: 'Fatal' },
        { value: EMTIN.DLT_LOG_ERROR, caption: 'Error' },
        { value: EMTIN.DLT_LOG_WARN, caption: 'Warnings' },
        { value: EMTIN.DLT_LOG_INFO, caption: 'Info' },
        { value: EMTIN.DLT_LOG_DEBUG, caption: 'Debug' },
        { value: EMTIN.DLT_LOG_VERBOSE, caption: 'Verbose' },
    ];

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
        this.state = new State();
    }

    public ngAfterContentInit(): void {
        const state = this.tab.storage<State>().get();
        if (state !== undefined) {
            this.state = state;
        } else {
            this.tab.storage().set(this.state);
        }
        if (this.options !== undefined) {
            this.state.fromOptions(this.options);
        }
        this.action.setCaption('Open');
        this.env().subscriber.register(
            this.action.subjects.get().applied.subscribe(() => {
                this.done(this.state.asOptions());
                this.tab.close();
            }),
        );
        this.env().subscriber.register(
            this.action.subjects.get().canceled.subscribe(() => {
                this.tab.close();
            }),
        );
    }

    public ngAfterViewInit(): void {
        this.tab.setTitle(
            this.files.length === 1 ? this.files[0].name : `${this.files.length} PcapNG files`,
        );
    }

    public getFilesStat(): {
        size: string;
        name: string;
        created: string | undefined;
        changed: string | undefined;
    } {
        return {
            size: bytesToStr(
                this.files.map((f) => f.stat.size).reduce((partialSum, a) => partialSum + a, 0),
            ),
            name: this.files.length !== 1 ? `${this.files.length} files` : this.files[0].name,
            created:
                this.files.length !== 1 ? undefined : timestampToUTC(this.files[0].stat.ctimeMs),
            changed:
                this.files.length !== 1 ? undefined : timestampToUTC(this.files[0].stat.mtimeMs),
        };
    }

    public ngOnFibexAdd() {
        this.ilc()
            .services.system.bridge.files()
            .select.custom('xml')
            .then((files: File[]) => {
                files = files.filter((added) => {
                    return (
                        this.state.fibex.find((exist) => exist.filename === added.filename) ===
                        undefined
                    );
                });
                this.state.fibex = this.state.fibex.concat(files);
            })
            .catch((err: Error) => {
                this.log().error(`Fail to open xml (fibex) file(s): ${err.message}`);
            });
    }

    public ngOnRemoveFibex(file: File) {
        this.state.fibex = this.state.fibex.filter((f) => f.filename !== file.filename);
    }

    public ngTimezoneSelect() {
        this.ilc().services.ui.popup.open({
            component: {
                factory: components.get('app-elements-timezone-selector'),
                inputs: {
                    selected: (timezone: Timezone): void => {
                        this.state.timezone = timezone;
                    },
                },
            },
            closeOnKey: 'Escape',
            width: 350,
            uuid: 'app-elements-timezone-selector',
        });
    }
}
export interface TabSourcePcapFile extends IlcInterface {}
