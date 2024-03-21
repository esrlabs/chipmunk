## Content
- [Before start](./before_start.md)
- [Back](./readme.md)
- [Home](../features.md)

# Adding GitHub repository
To allow sharing of the session's data should be defined a GitHub repository, which will be used as a storage of a session's data. 
- switch to tab "TEAMWORK" on  a sidebar;
- press the menu button "..." and select "Add New GitHub Reference"
- define necessary fields and press "Save"

You can add multiple references to repositories and switch between it during work.

# GitHub Personal Token
GitHub REST API requires authorization. To use the teamwork feature you should create a personal token. You have two options:
- *Read-only mode*. Personal token without any writing rights. With this type of token, you will be able to pull a session's data from the GitHub repository, but will not be able to change it.
- *Standard*. Personal token with write rights. With this type of token, any change of any session's data (filters, charts, comments, etc) will be synchronized with a GitHub repository and become available for other users.

Note. Chipmunk uses your GitHub personal token only to communicate with the target repository. In read-only mode, chipmunk makes REST API requests to pull data from a repository. In standard mode, in addition, chipmunk makes commits to the target repository with changes of session's data.

To create the GitHub personal token:
- open your GitHub page
- go to "Settings" of your account (not the settings of a repository)
- go to section "Developer Settings" (very bottom of left sidebar)
- open the scroll "Personal Access Tokens" and select a type of token, which you would like to create. Chipmunk works with both.