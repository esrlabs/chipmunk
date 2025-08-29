In addition to search, `chipmunk` provides tools for analyzing metrics and any kind of numerical data. Users can define regular expressions to extract specific values, which are then used to generate charts.

A key advantage of `chipmunk` is its near insensitivity to data volume - it performs equally well when processing a few hundred values or several million.

### Chart creating

To create a chart:

- focus in search input
- enter search condition as regex and group with digits value, for example `cpu=(\d{1,})`
- press "Enter" to activate the condition
- click on the chart icon
- switch to the tab "Charts"

![Creating of charts](assets/charts/charts_filters.gif)

In tab "Charts" also renders a frequency of matches for filters

### Dynamic charts

As soon as the chart has been created, Chipmunk updates values and rebuilds the chart withing new values.

![Charts in stream](assets/charts/charts_dynamic.gif)
