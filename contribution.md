# Contributing

Chipmunk uses [Rust](https://www.rust-lang.org/) for processing the log files while frontend application is built using the [ElectronJS](https://www.electronjs.org/)

## Pre-requisite

To build and run chipmunk on local you will need following languages installed on your system.
1. Rust
2. NodeJS
3. Ruby

To check if you have all the pre-requisite installed or not, chipmunk provides the shell
script for this purpose. After cloning the repo run following command in your preferred terminal.

```
sh developing/check.sh
```

If everything is installed then script should print success messages.
If all pre-requisite are satisfied, [install](#installing-dependencies) dependencies.
Follow steps below for installing the missing dependencies.

### Installing Rust
To install the Rust, use the Rust version manager called **rustup** which will automatically install
the Rust on local. Run following command in the terminal.

```
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

Once command finishes processing, check the installed Rust version using

```
rustc --version
```

which should print the Rust version on terminal.

### Installing NodeJS
To install the NodeJS, install NVM(Node Version Manager). Follow [installation](https://github.com/nvm-sh/nvm)
guide for installing NVM on local. Once NVM in ready on your local, install NodeJS using

```
nvm install --lts
```

which will install latest long term NodeJS version. Check if node is installed or not using

```
node -v
```

which will print the installed NodeJS version on terminal.

### Installing Ruby
You must have latest Ruby installed on your system. Prefer your choice of version manager
either [RBENV](https://github.com/rbenv/rbenv) or [RVM](https://rvm.io/).
Once version manager is ready to use, install Ruby version `>=2.7.7`.

### Installing dependencies
This project uses few dependencies from other languages and to install them run
following command in terminal.

```
sh developing/install.sh
```

We are using [yarn](https://yarnpkg.com/) as a package manager. Installing yarn is simple
as you just have to run following command in the terminal.

```
npm install -g yarn
```

## Build
As mentioned earlier backend is built in Rust which takes care of reading the log files
and frontend app is built using Electron JS.

When you are running application first time on your local it is good idea to clean everything
and build the new application.

```
rake developing:clean_rebuild_all
yarn start electron
```

which will open Chipmunk user interface, Yay!

Most of the day-to-day task are written using Rake from Ruby. You can list all the tasks by

```
rake -T
# or
rake # => Opens interactive shell
```

### Changes made in Rust backend
Everytime you change the Rust code you have to compile the binary and
then start the application using NodeJS script.

```
cd application/holder
rake developing:holder_bindings
yarn start electron
```

### Changes in ElectronJS code
You don't need to update the Rust binary, just run the ElectronJS application.

```
cd application/holder
yarn run electron
```

### Changes in Frontend part
```
cd application/holder
rake build:client_dev
yarn run electron
```

### Changes in both backend and frontend
```
cd application/holder
rake developing:holder_platform_bindings
yarn run electron
```

With this you can take a look at the open issues and open a PR to fix them.

## Creating your first PR
Before opening up the PR please fork the repo and check for code smells or any issues using

```
rake lint:all
rake clippy:all
```

Make sure your changes are covered by valid test cases and check if all test cases are passing
by executing following task

```
rake test:all
```

## Reporting Issues
If you find scope for improvement or any bug in the processing, please log
issue on GitHub.
