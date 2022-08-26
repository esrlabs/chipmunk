import {
    SetupService,
    Interface,
    Implementation,
    register,
    DependOn,
} from '@platform/entity/service';
import { services } from '@register/services';
import { bridge } from '@service/bridge';
import { Action } from './recent/action';
import { error } from '@platform/env/logger';
import { TargetFileOptions, File } from '@platform/types/files';
import { SourceDefinition } from '@platform/types/transport';
import { IDLTOptions } from '@platform/types/parsers/dlt';

const STORAGE_KEY = 'user_recent_actions';

@DependOn(bridge)
@SetupService(services['recent'])
export class Service extends Implementation {
    public get(): Promise<Action[]> {
        return new Promise((resolve, reject) => {
            bridge
                .entries(STORAGE_KEY)
                .get()
                .then((entries) => {
                    resolve(
                        entries
                            .map((entry) => {
                                try {
                                    return new Action().from().entry(entry);
                                } catch (err) {
                                    this.log().error(`Fail to read action: ${error(err)}`);
                                    return undefined;
                                }
                            })
                            .filter((a) => a !== undefined) as Action[],
                    );
                })
                .catch(reject);
        });
    }

    public append(actions: Action[]): Promise<void> {
        return bridge.entries(STORAGE_KEY).append(actions.map((a) => a.asEntry()));
    }

    public overwrite(actions: Action[]): Promise<void> {
        return bridge.entries(STORAGE_KEY).append(actions.map((a) => a.asEntry()));
    }

    public update(actions: Action[]): Promise<void> {
        return bridge.entries(STORAGE_KEY).update(actions.map((a) => a.asEntry()));
    }

    public delete(uuids: string[]): Promise<void> {
        return bridge.entries(STORAGE_KEY).delete(uuids);
    }

    public add(): {
        file(file: File, options: TargetFileOptions): Promise<void>;
        stream(source: SourceDefinition): {
            dlt(options: IDLTOptions): Promise<void>;
            text(): Promise<void>;
        };
    } {
        return {
            file: (file: File, options: TargetFileOptions): Promise<void> => {
                try {
                    const action = new Action().from().file(file, options);
                    return this.update([action]);
                } catch (err) {
                    return Promise.reject(new Error(error(err)));
                }
            },
            stream: (source: SourceDefinition) => {
                return {
                    dlt: (options: IDLTOptions): Promise<void> => {
                        try {
                            const action = new Action().from().stream(source).dlt(options);
                            return this.update([action]);
                        } catch (err) {
                            return Promise.reject(new Error(error(err)));
                        }
                    },
                    text: (): Promise<void> => {
                        try {
                            const action = new Action().from().stream(source).text();
                            return this.update([action]);
                        } catch (err) {
                            return Promise.reject(new Error(error(err)));
                        }
                    },
                };
            },
        };
    }
}
export interface Service extends Interface {}
export const recent = register(new Service());
