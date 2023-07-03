import { ShellProfile } from '@platform/types/shells';
import { bridge } from '@service/bridge';
import { Destroy } from '@platform/types/env/types';
import { Action } from '../../../../../action';

import * as obj from '@platform/env/obj';
import * as Stream from '@platform/types/observe/origin/stream/index';

const ROOTS_STORAGE_KEY = 'user_selected_profile';
const ENTRY_KEY = 'selected_profile_path';

export class State implements Destroy {
    public profiles: {
        all: ShellProfile[] | undefined;
        valid: ShellProfile[] | undefined;
    } = {
        all: undefined,
        valid: undefined,
    };
    // No context envvars
    public envvars: Map<string, string> = new Map();
    public current: ShellProfile | undefined;

    constructor(
        public readonly action: Action,
        public readonly configuration: Stream.Process.Configuration,
    ) {}

    public destroy(): void {
        // Having method "destroy()" is requirement of session's storage
    }

    public setProfiles(profiles: ShellProfile[]): Promise<void> {
        const valid: ShellProfile[] = [];
        profiles.forEach((profile) => {
            valid.find((p) => p.path === profile.path) === undefined &&
                profile.envvars !== undefined &&
                !profile.symlink &&
                valid.push(profile);
        });
        this.profiles.all = profiles;
        this.profiles.valid = valid;
        return this.storage()
            .get()
            .then((path: string | undefined) => {
                this.current = this.profiles.all?.find((p) => p.path === path);
                if (this.current !== undefined && this.current.envvars !== undefined) {
                    this.configuration.configuration.envs = obj.mapToObj(this.current.envvars);
                }
            });
    }

    public isProfilesLoaded(): boolean {
        return this.profiles.all !== undefined;
    }

    public importEnvvarsFromShell(profile: ShellProfile | undefined): Promise<void> {
        if (profile === undefined) {
            this.current = undefined;
            this.configuration.configuration.envs = obj.mapToObj(this.envvars);
            return this.storage().set(undefined);
        } else {
            if (profile.envvars === undefined) {
                return Promise.resolve();
            }
            this.configuration.configuration.envs = obj.mapToObj(profile.envvars);
            this.current = profile;
            return this.storage().set(profile.path);
        }
    }

    public getSelectedEnvs(): Map<string | number | symbol, string> {
        return obj.objToStringMap(this.configuration.configuration.envs);
    }

    public isShellSelected(profile: ShellProfile): boolean {
        return this.current ? profile.path === this.current.path : false;
    }

    protected storage(): {
        get(): Promise<string | undefined>;
        set(path: string | undefined): Promise<void>;
    } {
        return {
            get: (): Promise<string | undefined> => {
                return new Promise((resolve, reject) => {
                    bridge
                        .entries({ key: ROOTS_STORAGE_KEY })
                        .get()
                        .then((entries) => {
                            resolve(entries.length === 0 ? undefined : entries[0].content);
                        })
                        .catch(reject);
                });
            },
            set: (path: string | undefined): Promise<void> => {
                if (path === undefined) {
                    return bridge.entries({ key: ROOTS_STORAGE_KEY }).delete([ENTRY_KEY]);
                } else {
                    return bridge.entries({ key: ROOTS_STORAGE_KEY }).overwrite([
                        {
                            uuid: ENTRY_KEY,
                            content: path,
                        },
                    ]);
                }
            },
        };
    }
}
