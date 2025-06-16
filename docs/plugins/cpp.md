# Plugins Development in C/C++

## WIT Bindings

The first step for plugins development is to generate the function and types from `WIT` files into C/C++ types. 
To achieve that we can use [wit-bindgen CLI Tool](https://github.com/bytecodealliance/wit-bindgen) by running the command 

```sh
wit-bindgen c {path_to_plugins_api_crate}/wit/v0.1.0/ -w chipmunk:parser/parse
```
This will generate the files `parse.h` and `parse.c`. All generated types and functions from `WIT` files can be referenced and used from `parse.h` file, while `parse.c` file contains all the needed code for glueing all the parts together, the details in this files should be important for the development of the plugin itself.

