import { File } from '@platform/types/files';
import { Timezone } from '@elements/timezones/timezone';
import { bridge } from '@service/bridge';
import { components } from '@env/decorators/initial';
import { State as Base } from '../../state';
import { Observe } from '@platform/types/observe';

import * as Dlt from '@platform/types/observe/parser/dlt';

export class State extends Base {
    public readonly LOG_LEVELS: { value: Dlt.LogLevel; caption: string }[] = [
        { value: Dlt.LogLevel.Fatal, caption: 'Fatal' },
        { value: Dlt.LogLevel.Error, caption: 'Error' },
        { value: Dlt.LogLevel.Warn, caption: 'Warn' },
        { value: Dlt.LogLevel.Info, caption: 'Info' },
        { value: Dlt.LogLevel.Debug, caption: 'Debug' },
        { value: Dlt.LogLevel.Verbose, caption: 'Verbose' },
    ];
    public fibex: File[] = [];
    public timezone: Timezone | undefined;
    public logLevel: Dlt.LogLevel = Dlt.LogLevel.Verbose;

    constructor(observe: Observe) {
        super(observe);
    }

    public update(): State {
        const conf = this.observe.parser.as<Dlt.Configuration>(Dlt.Configuration);
        if (conf === undefined) {
            return this;
        }
        if (this.fibex.length !== 0) {
            conf.configuration.fibex_file_paths = this.fibex.map((f) => f.filename);
        } else {
            conf.configuration.fibex_file_paths = undefined;
        }
        if (this.logLevel !== Dlt.LogLevel.Verbose) {
            conf.setDefaultsFilterConfig();
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            conf.configuration.filter_config!.min_log_level = this.logLevel;
        }
        return this;
    }

    public addFibexFile() {
        bridge
            .files()
            .select.custom('xml')
            .then((files: File[]) => {
                files = files.filter((added) => {
                    return (
                        this.fibex.find((exist) => exist.filename === added.filename) === undefined
                    );
                });
                this.fibex = this.fibex.concat(files);
            })
            .catch((err: Error) => {
                this.ref.log().error(`Fail to open xml (fibex) file(s): ${err.message}`);
            })
            .finally(() => {
                this.update().ref.detectChanges();
            });
    }

    public removeFibex(file: File) {
        this.fibex = this.fibex.filter((f) => f.filename !== file.filename);
        this.update().ref.detectChanges();
    }

    public timezoneSelect() {
        const subscription = this.ref
            .ilc()
            .services.ui.popup.open({
                component: {
                    factory: components.get('app-elements-timezone-selector'),
                    inputs: {
                        selected: (timezone: Timezone): void => {
                            this.timezone = timezone;
                            this.ref.markChangesForCheck();
                        },
                    },
                },
                closeOnKey: 'Escape',
                width: 350,
                uuid: 'app-elements-timezone-selector',
            })
            .subjects.get()
            .closed.subscribe(() => {
                subscription.unsubscribe();
            });
    }
}
