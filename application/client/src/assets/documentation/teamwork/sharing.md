## Content
- [Adding GitHub Repository](./add_new_repository.md)
- [Back](./readme.md)
- [Home](../features.md)

# Sharing session data 

With the teamwork feature, you are able to share between multiple users the session's data like:
- filters;
- charts;
- bookmarks;
- comments;

**Note**. The teamwork feature is available only for files. You cannot share information for any kind of stream (network connections, spawned terminal command, etc).

# Modes

The teamwork feature supports two modes:

- **Read-only mode**. You will be able to pull a session's data from the GitHub repository, but will not be able to change it.

- **Standard**. With this type of token, any change of any session's data (filters, charts, comments, etc) will be synchronized with a GitHub repository and become available for other users.

# Data to share

You can define, which data will be shared and synchronized. For example, you can keep synchronized only comments, but use your local filters/charts and bookmarks.

To define these rules: 
- switch to the tab "TEAMWORK" in the sidebar;
- open a scroll "Sharing Settings";
- select type of data, which you would like to share


# Using GitHub repositories

To share a session's data chipmunk uses GitHub repositories. With each change of the session's data, chipmunk makes commits with the latest state of the session and this data becomes available for other users, who are also "connected" to the same repository.


