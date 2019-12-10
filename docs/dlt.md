[back to overview](README.md)
# DLT support

The Diagnostic Log and Trace AUTOSAR format is widely used in the automotive industry and is a binary log format. `chipmunk` can understand and process DLT content in large quantities.

![](assets/dlt-support.png)

## Import file

When opening a dlt file, you are prompted with this dialog. Here you can also provide the path to a **FIBEX** file that contains descriptions for you non-verbose messages.

![](assets/open_dlt.png)

This can be expanded so can select what components or loglevels you want to include. Note that you are presented with a statistics of how many log messages exist e.g. for a component with a certain log level.

![](assets/open_dlt2.png)

The columns can be configured by right-clicking in one of the column titles. Then you can filter out columns and adjust colors.

![](assets/dlt_columns.gif)