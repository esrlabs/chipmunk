import * as AngularCore from '@angular/core';
import * as AngularCommon from '@angular/common';
import * as AngularForms from '@angular/forms';
import * as AngularPlatformBrowser from '@angular/platform-browser';
import * as AngularMaterialAutocomplete from '@angular/material/autocomplete';
import * as AngularMaterialBadge from '@angular/material/badge';
import * as AngularMaterialBottomSheet from '@angular/material/bottom-sheet';
import * as AngularMaterialButton from '@angular/material/button';
import * as AngularMaterialButtonToggle from '@angular/material/button-toggle';
import * as AngularMaterialCard from '@angular/material/card';
import * as AngularMaterialCheckbox from '@angular/material/checkbox';
import * as AngularMaterialChips from '@angular/material/chips';
import * as AngularMaterialCore from '@angular/material/core';
import * as AngularMaterialDatepicker from '@angular/material/datepicker';
import * as AngularMaterialDialog from '@angular/material/dialog';
import * as AngularMaterialDivider from '@angular/material/divider';
import * as AngularMaterialExpansion from '@angular/material/expansion';
import * as AngularMaterialFormField from '@angular/material/form-field';
import * as AngularMaterialGridList from '@angular/material/grid-list';
import * as AngularMaterialIcon from '@angular/material/icon';
import * as AngularMaterialInput from '@angular/material/input';
import * as AngularMaterialList from '@angular/material/list';
import * as AngularMaterialMenu from '@angular/material/menu';
import * as AngularMaterialPaginator from '@angular/material/paginator';
import * as AngularMaterialProgressBar from '@angular/material/progress-bar';
import * as AngularMaterialProgressSpinner from '@angular/material/progress-spinner';
import * as AngularMaterialRadio from '@angular/material/radio';
import * as AngularMaterialSelect from '@angular/material/select';
import * as AngularMaterialSidenav from '@angular/material/sidenav';
import * as AngularMaterialSlidToggle from '@angular/material/slide-toggle';
import * as AngularMaterialSlider from '@angular/material/slider';
import * as AngularMaterialSnackBar from '@angular/material/snack-bar';
import * as AngularMaterialSort from '@angular/material/sort';
import * as AngularMaterialStepper from '@angular/material/stepper';
import * as AngularMaterialTable from '@angular/material/table';
import * as AngularMaterialTabs from '@angular/material/tabs';
import * as AngularMaterialToolbar from '@angular/material/toolbar';
import * as AngularMaterialTooltip from '@angular/material/tooltip';
import * as AngularMaterialTree from '@angular/material/tree';
import * as AngularCDK from '@angular/cdk';
import * as RXJS from 'rxjs';
import * as LogviewerClientMaterial from 'chipmunk-client-material';
import * as Toolkit from 'chipmunk.client.toolkit';
import * as ChartJS from 'chart.js';

export function getAvailablePluginModules(): { [key: string]: any } {
    return {
        '@angular/core': AngularCore,
        '@angular/common': AngularCommon,
        '@angular/forms': AngularForms,
        '@angular/platform-browser': AngularPlatformBrowser,
        '@angular/material/autocomplete': AngularMaterialAutocomplete,
        '@angular/material/badge': AngularMaterialBadge,
        '@angular/material/bottom-sheet': AngularMaterialBottomSheet,
        '@angular/material/button': AngularMaterialButton,
        '@angular/material/button-toggle': AngularMaterialButtonToggle,
        '@angular/material/card': AngularMaterialCard,
        '@angular/material/checkbox': AngularMaterialCheckbox,
        '@angular/material/chips': AngularMaterialChips,
        '@angular/material/core': AngularMaterialCore,
        '@angular/material/datepicker': AngularMaterialDatepicker,
        '@angular/material/dialog': AngularMaterialDialog,
        '@angular/material/divider': AngularMaterialDivider,
        '@angular/material/expansion': AngularMaterialExpansion,
        '@angular/material/form-field': AngularMaterialFormField,
        '@angular/material/grid-list': AngularMaterialGridList,
        '@angular/material/icon': AngularMaterialIcon,
        '@angular/material/input': AngularMaterialInput,
        '@angular/material/list': AngularMaterialList,
        '@angular/material/menu': AngularMaterialMenu,
        '@angular/material/paginator': AngularMaterialPaginator,
        '@angular/material/progress-bar': AngularMaterialProgressBar,
        '@angular/material/progress-spinner': AngularMaterialProgressSpinner,
        '@angular/material/radio': AngularMaterialRadio,
        '@angular/material/select': AngularMaterialSelect,
        '@angular/material/sidenav': AngularMaterialSidenav,
        '@angular/material/slide-toggle': AngularMaterialSlidToggle,
        '@angular/material/slider': AngularMaterialSlider,
        '@angular/material/snack-bar': AngularMaterialSnackBar,
        '@angular/material/sort': AngularMaterialSort,
        '@angular/material/stepper': AngularMaterialStepper,
        '@angular/material/table': AngularMaterialTable,
        '@angular/material/tabs': AngularMaterialTabs,
        '@angular/material/toolbar': AngularMaterialToolbar,
        '@angular/material/tooltip': AngularMaterialTooltip,
        '@angular/material/tree': AngularMaterialTree,
        '@angular/cdk': AngularCDK,
        rxjs: RXJS,
        'chipmunk-client-material': LogviewerClientMaterial,
        'chipmunk.client.toolkit': Toolkit,
        'chart.js': ChartJS,
    };
}
