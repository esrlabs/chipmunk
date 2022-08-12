import * as Errors from './error';

export class State {
    public errors = {
        bindingAddress: new Errors.ErrorState(Errors.Field.bindingAddress),
        bindingPort: new Errors.ErrorState(Errors.Field.bindingPort),
    };
    public bindingAddress: string = '';
    public bindingPort: string = '';
}
