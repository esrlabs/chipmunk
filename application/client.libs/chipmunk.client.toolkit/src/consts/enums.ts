/**
 * Types of views / injections
 */
export enum EViewsTypes {
    /**
     * Main view
     */
    view                = 'lib-view',
    /**
     * Injection into main output: bottom area
     */
    outputBottom        = 'lib-output-bottom',
    /**
     * Injection into main output: top area
     */
    outputTop           = 'lib-output-top',
    /**
     * Injection into main output: left area
     */
    outputLeft          = 'lib-output-left',
    /**
     * Injection into main output: right area
     */
    outputRight         = 'lib-output-right',
    /**
     * Injection into task bar
     */
    tasksBar            = 'lib-task-bar',
    /**
     * Injection into secondary area (same place where search output)
     */
    sidebarHorizontal   = 'lib-sidebar-hor',
    /**
     * Injection into sidebar
     */
    sidebarVertical     = 'lib-sidebar-ver',
}

/**
 * List of supported custom row's renders
 */
export enum ETypedRowRenders {
    columns = 'columns',
    external = 'external',
}

/**
 * List of theme references
 */
export enum EThemeType {
    dark = 'dark',
    light = 'light',
    undefined = 'undefined',
}
