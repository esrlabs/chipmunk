import { Component, ChangeDetectorRef, Input, AfterContentInit } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { State } from '../../state';
import { State as StreamState } from './transport/setup/state';
import { State as ParserState } from '@ui/tabs/observe/parsers/state';

import * as Streams from '@platform/types/observe/origin/stream/index';
import * as Origins from '@platform/types/observe/origin/index';
import * as Parsers from '@platform/types/observe/parser/index';

@Component({
    selector: 'app-tabs-observe-stream',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Initial()
@Ilc()
export class TabObserveStream extends ChangesDetector implements AfterContentInit {
    @Input() state!: State;

    public stream!: StreamState;
    public parser!: ParserState;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        const origin = this.state.observe.origin.as<Origins.Stream.Configuration>(
            Origins.Stream.Configuration,
        );
        if (origin === undefined) {
            throw new Error(`Current origin isn't a stream`);
        }
        this.stream = new StreamState(this.state.action, origin.instance);
        this.parser = new ParserState(this.state.observe);
        this.env().subscriber.register(
            this.state.updates.get().stream.subscribe(() => {
                const stream = this.state.stream;
                if (stream === undefined) {
                    return;
                }
                this.stream.from({ [stream]: Streams.getByAlias(stream).configuration });
            }),
            this.state.updates.get().parser.subscribe(() => {
                const parser = this.state.parser;
                if (parser === undefined) {
                    return;
                }
                this.state.observe.parser.overwrite({
                    [parser]: Parsers.getByAlias(parser).configuration,
                });
            }),
        );
    }
}
export interface TabObserveStream extends IlcInterface {}
