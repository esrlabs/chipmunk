# DLT Parser Plugin.

This is an example for parser plugins accepting raw bytes in DLT format and parsing them returning the messages alongside with the attachments when exist.

## Usage:

After installing the parser in Chipmunk, you can use this parser with the all available byte sources: DLT files or TCP/UDP streams.

## Configurations:

This plugin needs the following 
- **With strage header**: Set if the coming DLT messages have storage headers. Normally only messages stored in files contains storage headers.
- **Log Level**: Determine the minimum log level for messages (Default to Verbose)
- **Fibex files**: Provided needed FIBEX files for the session.

