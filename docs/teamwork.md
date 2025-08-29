`chipmunk` supports collaborative work on log file analysis. However, it remains a fully standalone application that requires no installation or server infrastructure. Staying true to this philosophy, we use GitHub repositories to enable shared access to data - providing both secure data exchange and access control.

## Before start

## Using GitHub repositories

To share a session's data chipmunk uses GitHub repositories. With each change of the session's data, chipmunk makes commits with the latest state of the session and this data becomes available for other users, who are also "connected" to the same repository.

### Add new repository

To allow sharing of the session's data should be defined a GitHub repository, which will be used as a storage of a session's data. 

- switch to tab "**TEAMWORK**" on  a sidebar;
- press the menu button "**...**" and select "**Add New GitHub Reference**"
- define necessary fields and press "**Save**"

You can add multiple references to repositories and switch between it during work.

### GitHub Personal Token

GitHub REST API requires authorization. To use the teamwork feature you should create a personal token. You have two options:

- *Read-only mode*. Personal token without any writing rights. With this type of token, you will be able to pull a session's data from the GitHub repository, but will not be able to change it.
- *Standard*. Personal token with write rights. With this type of token, any change of any session's data (filters, charts, comments, etc) will be synchronized with a GitHub repository and become available for other users.

Note. Chipmunk uses your GitHub personal token only to communicate with the target repository. In read-only mode, chipmunk makes REST API requests to pull data from a repository. In standard mode, in addition, chipmunk makes commits to the target repository with changes of session's data.

To create the GitHub personal token:

- open your GitHub page
- go to "**Settings**" of your account (not the settings of a repository)
- go to section "**Developer Settings**" (very bottom of left sidebar)
- open the scroll "**Personal Access Tokens**" and select a type of token, which you would like to create. Chipmunk works with both.

## Share your findings

With the teamwork feature, you are able to share between multiple users the session's data like:

- filters;
- charts;
- bookmarks;
- comments;

**Note**. The teamwork feature is available only for files. You cannot share information for any kind of stream (network connections, spawned terminal command, etc).

### Modes

The teamwork feature supports two modes:

- **Read-only mode**. You will be able to pull a session's data from the GitHub repository, but will not be able to change it.

- **Standard**. With this type of token, any change of any session's data (filters, charts, comments, etc) will be synchronized with a GitHub repository and become available for other users.

### Data to share

You can define, which data will be shared and synchronized. For example, you can keep synchronized only comments, but use your local filters/charts and bookmarks.

To define these rules: 

- switch to the tab "**TEAMWORK**" in the sidebar;
- open a scroll "**Sharing Settings**";
- select type of data, which you would like to share
