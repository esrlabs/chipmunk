import OpenFile from './actions/action.open.file';
import Help from './actions/action.help';

import { Action } from './actions/action';

import * as Bindings from '../../ts-bindings/src/index';

type TResolver = () => void;
type TRejector = (err: Error) => void;

class Executor {
    
    static Actions: Action[] = [Help, OpenFile];

    public run(): Promise<void> {
        return new Promise((resolve, reject) => {
            this._next(process.argv, resolve, reject);
        });
    }

    private _next(args: string[], done: TResolver, fail: TRejector, index: number = -1) {
        index += 1;
        if (index >= Executor.Actions.length) {
            return done();
        }
        const action: Action = Executor.Actions[index];
        action.proceed(args).then((output: string[]) => {
            this._next(output, done, fail, index);
        }).catch((err: Error) => fail(err));
    }

}

const executor: Executor = new Executor();

executor.run().then(() => {
    console.log(`All done`);
}).catch((err: Error) => {
    console.log(`Fail with: ${err.message}`)
});