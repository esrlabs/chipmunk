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
import { error } from '@platform/log/utils';
import { Subject } from '@platform/env/subscription';

import * as $ from '@platform/types/observe';

const STORAGE_KEY = 'user_recent_actions';

@DependOn(bridge)
@SetupService(services['recent'])
export class Service extends Implementation {
    public readonly updated: Subject<void> = new Subject();

    public override destroy(): Promise<void> {
        this.updated.destroy();
        return super.destroy();
    }

    public async get(): Promise<Action[]> {
        const entries = await bridge.entries({ key: STORAGE_KEY }).get();
        const actions = entries
            .map((entry) => {
                const action = Action.from(entry);
                if (action instanceof Error) {
                    this.log().error(`Fail to read action: ${error(action)}`);
                    return undefined;
                } else {
                    return action;
                }
            })
            .filter((a) => a !== undefined) as Action[];
        const invalid = actions.filter((a) => a.compatibility.invalidUuid !== undefined);
        if (invalid.length > 0) {
            await this.delete(invalid.map((a) => a.compatibility.invalidUuid as string))
                .then(() => {
                    this.log().debug(
                        `${invalid.length} actions with invalid UUIDs has been removed`,
                    );
                })
                .catch((err: Error) => {
                    this.log().error(
                        `Fail to remove recent actions with invalid uuid: ${err.message}`,
                    );
                });
        }
        const converted = actions.filter((a) => a.compatibility.converted);
        if (converted.length > 0) {
            await this.update(converted)
                .then(() => {
                    this.log().debug(`${converted.length} converted actions has been updated`);
                })
                .catch((err: Error) => {
                    this.log().error(`Fail to update converted recent actions: ${err.message}`);
                });
        }
        return actions;
    }

    public async update(actions: Action[]): Promise<void> {
        if (actions.length === 0) {
            return;
        }
        const stored = await this.get();
        actions.forEach((action) => {
            const found = stored.find((a) => a.uuid === action.uuid);
            if (found === undefined) {
                return;
            }
            action.merge(found);
        });
        return bridge
            .entries({ key: STORAGE_KEY })
            .update(actions.map((a) => a.entry().to()))
            .then(() => {
                this.updated.emit();
            })
            .catch((err: Error) => {
                this.log().error(`Fail to update recent storage: ${err.message}`);
            });
    }

    public delete(uuids: string[]): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            bridge
                .entries({ key: STORAGE_KEY })
                .delete(uuids)
                .then(() => {
                    this.updated.emit();
                    resolve();
                })
                .catch((err: Error) => {
                    reject(err);
                });
        });
    }

    public add(observe: $.Observe): Promise<void> {
        const action = new Action(observe);
        return this.update([action]);
    }
}
export interface Service extends Interface {}
export const recent = register(new Service());
