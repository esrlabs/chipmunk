import { Component, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';

@Component({
    selector: 'app-sidebar-app-parsing',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class SidebarAppCommandComponent {

    // @ViewChild()

    public _ng_command: string;
    public _ng_placeholder: string = 'Type command here';
    public _ng_inputCtrl = new FormControl();

    constructor() {}

    public _ng_onKeyup(event: KeyboardEvent) {
        if (event.key === 'Enter') {
            // Get access to input
            // Run command
            // empty input
        } else if (event.key === 'Tab') {
            // Autocomplete
        }
    }

    public _ng_onRecentSelected(event: MatAutocompleteSelectedEvent) {
        this._ng_inputCtrl.setValue(event.option.viewValue);
        // Special cases for
        // - Enter
        // - Mouseclick
        // - Tab
    }

}
