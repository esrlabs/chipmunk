import {
    Component,
    Input,
    ChangeDetectorRef,
    AfterContentInit,
    ViewChild,
    ElementRef,
    AfterViewInit,
    OnDestroy,
} from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Filter } from './filter';
import { FilterInput } from './input';

@Component({
    selector: 'app-filter-input',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Initial()
@Ilc()
export class InputFilter
    extends ChangesDetector
    implements AfterContentInit, AfterViewInit, OnDestroy
{
    @Input() public filter!: Filter;
    @ViewChild('filterinput') filterInputRef!: ElementRef<HTMLInputElement>;

    public input!: FilterInput;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngOnDestroy(): void {
        this.filter.destroy();
    }

    public ngAfterContentInit(): void {
        this.input = new FilterInput(this.filter);
    }

    public ngAfterViewInit(): void {
        this.filter.bind(this.filterInputRef.nativeElement);
    }

    public focus(): void {
        if (this.filterInputRef === undefined) {
            return;
        }
        this.filterInputRef.nativeElement.focus();
    }

    public getInputElementRef(): HTMLInputElement | undefined {
        return this.filterInputRef !== undefined ? this.filterInputRef.nativeElement : undefined;
    }
}
export interface InputFilter extends IlcInterface {}
