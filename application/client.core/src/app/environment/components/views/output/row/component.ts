import { Component, Input } from '@angular/core';
import { IStreamPacket } from '../../../../controller/controller.session.stream';

@Component({
    selector: 'app-views-output-row',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class ViewOutputRowComponent {
    @Input() public packet: IStreamPacket | undefined;
}
