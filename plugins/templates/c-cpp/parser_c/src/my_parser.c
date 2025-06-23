#include "../bindings/parse.h"
#include "stdio.h"
#include <stdlib.h>
#include <string.h>

// This template demonstrates two modes for the parsed messages:
// - Single column: For log messages which doesn't have structure.
// - Multiple columns: For log messages with structure.

#define SINGLE_COLUMN_MODE
// #define MULTI_COLUMN_MODE

#if (defined(SINGLE_COLUMN_MODE) && defined(MULTI_COLUMN_MODE)) ||             \
    !defined(SINGLE_COLUMN_MODE) && !defined(MULTI_COLUMN_MODE)
#error "Column mode definitions error: Exactly one must be defined."
#endif

// Basic solution to keep track on the current logging level provided by
// Chipmunk host to avoid sending logs to host that won't be logged.
static chipmunk_shared_logging_level_t global_log_level =
    CHIPMUNK_SHARED_LOGGING_LEVEL_ERROR;

void exports_chipmunk_parser_parser_get_version(
    exports_chipmunk_parser_parser_version_t *ret) {
  ret->major = 0;
  ret->minor = 1;
  ret->patch = 0;
}

void exports_chipmunk_parser_parser_get_config_schemas(
    exports_chipmunk_parser_parser_list_config_schema_item_t *ret) {
  ret->ptr = (exports_chipmunk_parser_parser_config_schema_item_t *)calloc(
      3, sizeof(exports_chipmunk_parser_parser_config_schema_item_t));
  ret->len = 3;

  // Boolean configuration item
  parse_string_dup(&ret->ptr[0].id, "bool_id");
  ret->ptr[0].description.is_some = true;
  parse_string_dup(&ret->ptr[0].title, "Boolean Configuration");
  parse_string_dup(&ret->ptr[0].description.val,
                   "Demonstrate a boolean configuration item");
  ret->ptr[0].input_type.tag =
      CHIPMUNK_SHARED_SHARED_TYPES_CONFIG_SCHEMA_TYPE_BOOLEAN;
  ret->ptr[0].input_type.val.boolean = true;

  // Text configuration item
  parse_string_dup(&ret->ptr[1].id, "text_id");
  ret->ptr[1].description.is_some = true;
  parse_string_dup(&ret->ptr[1].title, "Text Configuration");
  parse_string_dup(&ret->ptr[1].description.val,
                   "Demonstrate a text configuration item");
  ret->ptr[1].input_type.tag =
      CHIPMUNK_SHARED_SHARED_TYPES_CONFIG_SCHEMA_TYPE_TEXT;
  parse_string_dup(&ret->ptr[1].input_type.val.text, "Default text");

  // Files configuration item
  parse_string_dup(&ret->ptr[2].id, "files_id");
  ret->ptr[2].description.is_some = true;
  parse_string_dup(&ret->ptr[2].title, "Files Configuration");
  parse_string_dup(&ret->ptr[2].description.val,
                   "Demonstrate files configuration item");
  ret->ptr[2].input_type.tag =
      CHIPMUNK_SHARED_SHARED_TYPES_CONFIG_SCHEMA_TYPE_FILES;
  ret->ptr[2].input_type.val.files.len = 0;
}

void exports_chipmunk_parser_parser_get_render_options(
    exports_chipmunk_parser_parser_render_options_t *ret) {
#if defined(SINGLE_COLUMN_MODE)
  ret->columns_options.is_some = false;

#elif defined(MULTI_COLUMN_MODE)
  ret->columns_options.is_some = true;

  ret->columns_options.val.max_width = 600;
  ret->columns_options.val.min_width = 30;

  ret->columns_options.val.columns.ptr =
      (chipmunk_parser_parse_types_column_info_t *)calloc(
          2, sizeof(chipmunk_parser_parse_types_column_info_t));

  ret->columns_options.val.columns.len = 2;
  parse_string_dup(&ret->columns_options.val.columns.ptr[0].caption,
                   "First Column");
  parse_string_dup(&ret->columns_options.val.columns.ptr[0].description,
                   "First Column Description");
  ret->columns_options.val.columns.ptr[0].width = 110;

  parse_string_dup(&ret->columns_options.val.columns.ptr[1].caption,
                   "Second Column");
  parse_string_dup(&ret->columns_options.val.columns.ptr[1].description,
                   "Second Column Description ");
  ret->columns_options.val.columns.ptr[1].width = -1;

#endif
}

bool exports_chipmunk_parser_parser_init(
    exports_chipmunk_parser_parser_parser_config_t *general_configs,
    exports_chipmunk_parser_parser_list_config_item_t *plugin_configs,
    exports_chipmunk_parser_parser_init_error_t *err) {
  // *** Demonstrate basic logging ***
  global_log_level = general_configs->log_level;
  if (global_log_level >= CHIPMUNK_SHARED_LOGGING_LEVEL_INFO) {
    parse_string_t log_msg;
    parse_string_dup(&log_msg, "Initi message called");
    chipmunk_shared_logging_log(CHIPMUNK_SHARED_LOGGING_LEVEL_INFO, &log_msg);
    parse_string_free(&log_msg);
  }

  // *** Demonstrate printing to stdout ***
  printf("Inint function called with log level: %d\n",
         general_configs->log_level);

  // *** Demonstrate printing to stderr ***
  size_t conf_len = plugin_configs->len;
  fprintf(stderr, "Provided configs length: %zu\n", conf_len);

  // *** Fetching configuration values ***
  for (size_t i = 0; i < conf_len; i++) {
    printf("Configuration item info:\n");
    printf("  Index: %zu\n", i);
    printf("  ID: %s\n", plugin_configs->ptr[i].id.ptr);
    uint8_t val_tag = plugin_configs->ptr[i].value.tag;
    printf("  TAG ID: %d\n", val_tag);
    switch (val_tag) {
    case CHIPMUNK_SHARED_SHARED_TYPES_CONFIG_SCHEMA_TYPE_BOOLEAN:
      printf("  Boolean value: %d\n", plugin_configs->ptr[i].value.val.boolean);
      break;
    case CHIPMUNK_SHARED_SHARED_TYPES_CONFIG_SCHEMA_TYPE_INTEGER:
      printf("  Integer value: %d\n", plugin_configs->ptr[i].value.val.integer);
      break;
    case CHIPMUNK_SHARED_SHARED_TYPES_CONFIG_SCHEMA_TYPE_FLOAT:
      printf("  Float value: %f\n", plugin_configs->ptr[i].value.val.float_);
      break;
    case CHIPMUNK_SHARED_SHARED_TYPES_CONFIG_SCHEMA_TYPE_TEXT:
      printf("  Text value: %s\n", plugin_configs->ptr[i].value.val.text.ptr);
      break;
    case CHIPMUNK_SHARED_SHARED_TYPES_CONFIG_SCHEMA_TYPE_DIRECTORIES: {
      size_t dir_len = plugin_configs->ptr[i].value.val.directories.len;
      printf("  Directories length: %zu\n", dir_len);
      for (size_t dir_idx = 0; dir_idx < dir_len; dir_len++) {
        printf("    Directory path: %s\n",
               plugin_configs->ptr[i].value.val.directories.ptr[dir_idx].ptr);
      }
    } break;
    case CHIPMUNK_SHARED_SHARED_TYPES_CONFIG_SCHEMA_TYPE_FILES: {
      size_t files_len = plugin_configs->ptr[i].value.val.files.len;
      printf("  Files length: %zu\n", files_len);
      for (size_t file_idx = 0; file_idx < files_len; file_idx++) {
        printf("    File path: %s\n",
               plugin_configs->ptr[i].value.val.files.ptr[file_idx].ptr);
      }
    } break;
    case CHIPMUNK_SHARED_SHARED_TYPES_CONFIG_SCHEMA_TYPE_DROPDOWN:
      printf("  Dropdown value: %s\n",
             plugin_configs->ptr[i].value.val.dropdown.ptr);
      break;
    }
  }

  return true;
}

bool exports_chipmunk_parser_parser_parse(
    parse_list_u8_t *data, uint64_t *maybe_timestamp,
    exports_chipmunk_parser_parser_list_parse_return_t *ret,
    exports_chipmunk_parser_parser_parse_error_t *err) {
  // *** Demonstrate basic logging ***
  if (global_log_level >= CHIPMUNK_SHARED_LOGGING_LEVEL_DEBUG) {
    parse_string_t log_msg;
    parse_string_set(&log_msg, "Parse called");
    chipmunk_shared_logging_log(CHIPMUNK_SHARED_LOGGING_LEVEL_DEBUG, &log_msg);
  }

#if defined(SINGLE_COLUMN_MODE)

  // *** Return length of provided bytes ***
  ret->len = 1;
  ret->ptr[0].consumed = data->len;
  ret->ptr[0].value.is_some = true;
  ret->ptr[0].value.val.tag = CHIPMUNK_PARSER_PARSE_TYPES_PARSE_YIELD_MESSAGE;
  ret->ptr[0].value.val.val.message.tag =
      CHIPMUNK_PARSER_PARSE_TYPES_PARSED_MESSAGE_LINE;

  char msg_buff[100];
  snprintf(msg_buff, sizeof(msg_buff), "The length of provided bytes: %zu",
           data->len);
  parse_string_set(&ret->ptr[0].value.val.val.message.val.line, msg_buff);

  return true;
#elif defined(MULTI_COLUMN_MODE)

  // *** Returns two columns ***
  // - The first column contain a static text.
  // - The second columns contains the length of provided bytes.
  ret->len = 1;
  ret->ptr[0].consumed = data->len;
  ret->ptr[0].value.is_some = true;

  ret->ptr[0].value.val.tag = CHIPMUNK_PARSER_PARSE_TYPES_PARSE_YIELD_MESSAGE;
  ret->ptr[0].value.val.val.message.tag =
      CHIPMUNK_PARSER_PARSE_TYPES_PARSED_MESSAGE_COLUMNS;

  ret->ptr[0].value.val.val.message.val.columns.ptr =
      (parse_string_t *)calloc(2, sizeof(parse_string_t));
  ret->ptr[0].value.val.val.message.val.columns.len = 2;
  parse_string_dup(&ret->ptr[0].value.val.val.message.val.columns.ptr[0],
                   "static message");

  char msg_buff[100];
  snprintf(msg_buff, sizeof(msg_buff), "The length of provided bytes: %zu",
           data->len);
  parse_string_dup(&ret->ptr[0].value.val.val.message.val.columns.ptr[1],
                   msg_buff);

  return true;
#endif
}
