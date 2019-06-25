import { Component, Input } from '@angular/core';

import { IPopup } from '../../../../services/standalone/service.popups';

@Component({
    selector: 'app-popup',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class PopupComponent {

    @Input() public popup: IPopup = { caption: '', message: '' };
    @Input() public onClose: (...args: any[]) => any = () => {};

}
