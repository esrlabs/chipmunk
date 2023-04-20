import {
    Component,
    Input,
    OnDestroy,
    Inject,
    AfterContentInit,
    ChangeDetectorRef,
} from '@angular/core';
import { Provider as ProviderBase } from '@service/session/dependencies/observing/provider';
import { Mutable } from '@platform/types/unity/mutable';
import { Base } from '../states/state';
import { ChangesDetector } from '@ui/env/extentions/changes';

@Component({
    selector: 'app-observe-list-base',
    template: '',
})
export class ListBase<State extends Base, Provider extends ProviderBase>
    extends ChangesDetector
    implements OnDestroy, AfterContentInit
{
    public readonly state!: State;

    @Input() public provider!: Provider;

    constructor(@Inject('defaults') protected readonly defaults: State, cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        const state = this.provider.session.storage.get<State>(this.defaults.key());
        (this as Mutable<ListBase<State, Provider>>).state =
            state === undefined ? this.defaults : state;
    }

    public ngOnDestroy(): void {
        this.provider.session.storage.set(this.defaults.key(), this.state);
    }
}
