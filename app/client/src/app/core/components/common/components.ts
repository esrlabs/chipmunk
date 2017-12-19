import { NgModule                       } from '@angular/core';
import { CommonModule                   } from '@angular/common';
import { FormsModule                    } from '@angular/forms';

import { CommonInput                    } from './input/component';
import { DropDownMenu                   } from './drop-down-menu/component';
import { Popup                          } from './popup/component';
import { FileLoader                     } from './fileloader/component';
import { ProgressBarCircle              } from './progressbar.circle/component';
import { ProgressBarLine                } from './progressbar.line/component';
import { ProgressBarProgress            } from './progressbar.progress/component';

import { LongListModule                 } from './long-list/module';

import { DialogA                        } from './dialogs/dialog-a/component';
import { ImageDialog                    } from './dialogs/image/component';
import { DialogMessage                  } from './dialogs/dialog-message/component';
import { DialogSerialSettings           } from './dialogs/serial.settings/component';
import { ViewsList                      } from './dialogs/views.list/component';
import { ShortcutsList                  } from './dialogs/shortcuts.list/component';
import { DialogAPISettings              } from './dialogs/api.settings/component';
import { ColorsDialog                   } from './dialogs/colors/component';
import { ColorsCanvasDialog             } from './dialogs/colors.canvas/component';
import { MarkersEditDialog              } from './dialogs/markers.edit/component';
import { ChartEditColorDialog           } from './dialogs/charts.edit.colors/component';
import { ChartEditRulesHooksDialog      } from './dialogs/charts.edit.rules.hooks/component';
import { ChartEditRulesSegmentsDialog   } from './dialogs/charts.edit.rules.segments/component';
import { ChartEditTypeDialog            } from './dialogs/charts.edit.type/component';
import { StateMonitorStateEditDialog        } from './dialogs/statemonitor.state.edit/component';
import { StateMonitorStateEditIconsDialog   } from './dialogs/statemonitor.state.edit.icons/component';
import { DialogStatemonitorIndicateEdit     } from './dialogs/statemonitor.indicate.edit/component';
import { DialogSerialPortsList          } from './dialogs/serialports.list/component';
import { DialogThemesList               } from './dialogs/themes.list/component';
import { DialogUpdate                   } from './dialogs/update/component';
import { DialogADBLogcatStreamSettings  } from './dialogs/adblogcat.settings/component';
import { DialogTerminalStreamOpen       } from './dialogs/terminal.open/component';



import { DialogStatemonitorEditJSON     } from './dialogs/statemonitor.edit/component';

import { ButtonFlatText                 } from './buttons/flat-text/component';

import { SimpleText                     } from './text/simple/component';

import { SimpleList                     } from './lists/simple/component';
import { SimpleDropDownList             } from './lists/simple-drop-down/component';

import { SimpleCheckbox                 } from './checkboxes/simple/component';

import { ConnectionState                } from './other/connection.state/component';

import { CommonTabModule                } from './tabs/module';

@NgModule({
    entryComponents : [ Popup, FileLoader, ProgressBarCircle, DialogTerminalStreamOpen, DialogADBLogcatStreamSettings, DialogUpdate, DialogThemesList, DialogSerialPortsList, ProgressBarLine, ProgressBarProgress, DialogMessage, DialogStatemonitorIndicateEdit, StateMonitorStateEditIconsDialog, StateMonitorStateEditDialog, ImageDialog, DialogA, ButtonFlatText, SimpleText, SimpleList, SimpleDropDownList, DialogSerialSettings, SimpleCheckbox, ViewsList, ShortcutsList, DialogAPISettings, ColorsDialog, ColorsCanvasDialog, ConnectionState, ChartEditTypeDialog, ChartEditRulesSegmentsDialog, ChartEditRulesHooksDialog, ChartEditColorDialog, MarkersEditDialog, DialogStatemonitorEditJSON ],
    imports         : [ CommonModule, FormsModule  ],
    declarations    : [ CommonInput, DropDownMenu, Popup, FileLoader, DialogTerminalStreamOpen, DialogADBLogcatStreamSettings, DialogUpdate, DialogThemesList, DialogSerialPortsList, ProgressBarCircle, ProgressBarLine, ProgressBarProgress, DialogMessage, DialogStatemonitorIndicateEdit, StateMonitorStateEditIconsDialog, StateMonitorStateEditDialog, ImageDialog, DialogA, ButtonFlatText, SimpleText, SimpleList, SimpleDropDownList, DialogSerialSettings, SimpleCheckbox, ViewsList, ShortcutsList, DialogAPISettings, ColorsDialog, ColorsCanvasDialog, ConnectionState, ChartEditTypeDialog, ChartEditRulesSegmentsDialog, ChartEditRulesHooksDialog, ChartEditColorDialog, MarkersEditDialog, DialogStatemonitorEditJSON ],
    exports         : [ CommonInput, DropDownMenu, LongListModule, CommonTabModule, Popup, FileLoader, DialogTerminalStreamOpen, DialogADBLogcatStreamSettings, DialogUpdate, DialogThemesList, DialogSerialPortsList, ProgressBarCircle, ProgressBarLine, ProgressBarProgress, DialogMessage, DialogStatemonitorIndicateEdit, StateMonitorStateEditIconsDialog, StateMonitorStateEditDialog, ImageDialog, DialogA, ButtonFlatText, SimpleText, SimpleList, SimpleDropDownList, DialogSerialSettings, SimpleCheckbox, ViewsList, ShortcutsList, DialogAPISettings, ColorsDialog, ColorsCanvasDialog, ConnectionState, ChartEditTypeDialog, ChartEditRulesSegmentsDialog, ChartEditRulesHooksDialog, ChartEditColorDialog, MarkersEditDialog, DialogStatemonitorEditJSON ]
})


export class Components {
    constructor(){
    }
}