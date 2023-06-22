import { File } from '@platform/types/files';
import { bridge } from '@service/bridge';
import { State as Base } from '../../state';

import * as SomeIp from '@platform/types/observe/parser/someip';

export class State extends Base {
    public fibex: File[] = [];

    public update(): State {
        const conf = this.observe.parser.as<SomeIp.Configuration>(SomeIp.Configuration);
        if (conf === undefined) {
            return this;
        }
        if (this.fibex.length !== 0) {
            conf.configuration.fibex_file_paths = this.fibex.map((f) => f.filename);
        } else {
            conf.configuration.fibex_file_paths = undefined;
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
}
