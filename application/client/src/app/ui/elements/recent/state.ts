import { Action } from '@service/recent/action';
import { WrappedAction } from './action';
import { recent } from '@service/recent';
import { Subject } from '@platform/env/subscription';
import { IlcInterface } from '@service/ilc';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Holder } from '@module/matcher';
import { Logger } from '@platform/log';
import { ObserveOperation } from '@service/session/dependencies/stream';

export class State extends Holder {
    public actions: WrappedAction[] = [];

    public readonly update: Subject<void> = new Subject<void>();
    public readonly operation: ObserveOperation | undefined;

    private _logger: Logger;

    constructor(ilc: IlcInterface & ChangesDetector, operation: ObserveOperation) {
        super();
        this.operation = operation;
        this._logger = ilc.log();
        ilc.env().subscriber.register(recent.updated.subscribe(this.reload.bind(this)));
        this.reload();
    }

    public filtering(value: string) {
        this.matcher.search(value);
        if (value.trim() === '') {
            this.actions.sort((a: WrappedAction, b: WrappedAction) =>
                b.action.stat.score().recent() >= a.action.stat.score().recent() ? 1 : -1,
            );
        } else {
            this.actions.sort((a: WrappedAction, b: WrappedAction) => b.getScore() - a.getScore());
        }
        this.update.emit();
    }

    public getFilteredActions(): WrappedAction[] {
        return this.actions.filter((a: WrappedAction) => a.getScore() > 0);
    }

    public remove(uuids: string[]) {
        recent
            .delete(uuids)
            .then(() => {
                this.reload();
            })
            .catch((err: Error) => {
                this._logger.error(`Fail to remove recent action: ${err.message}`);
            });
    }

    public removeAll() {
        recent
            .get()
            .then((actions: Action[]) => {
                this.remove(actions.map((action: Action) => action.hash));
            })
            .catch((err: Error) => {
                this._logger.error(`Fail to remove all recent actions: ${err.message}`);
            });
    }

    public reload(): void {
        console.error(`Not implemented`);
        // recent
        //     .get()
        //     .then((actions: Action[]) => {
        //         this.actions = actions
        //             .filter((action) => action.isSuitable(this.operation))
        //             .map((action) => new WrappedAction(action, this.matcher));
        //         this.actions.sort((a: WrappedAction, b: WrappedAction) => {
        //             return b.action.stat.score().recent() >= a.action.stat.score().recent()
        //                 ? 1
        //                 : -1;
        //         });
        //         this.update.emit();
        //     })
        //     .catch((error: Error) => {
        //         this._logger.error(`Fail to get recent due error: ${error.message}`);
        //     });
    }
}
