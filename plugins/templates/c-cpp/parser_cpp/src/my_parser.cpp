#include "../bindings/parse.h"
#include <iostream>
#include <string>

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

/// Provides the current semantic version of the plugin.
/// This version is for the plugin only and is different from the plugin's API
/// version.
void exports_chipmunk_parser_parser_get_version(
    exports_chipmunk_parser_parser_version_t *ret) {
  ret->major = 0;
  ret->minor = 1;
  ret->patch = 0;
}

/// Provides the schemas for the configurations required by the plugin, which
/// will be specified by the users.
///
/// These schemas define the expected structure, types, and constraints
/// for plugin-specific configurations. The values of these configurations
/// will be passed to the initializing method of the parser.
void exports_chipmunk_parser_parser_get_config_schemas(
    exports_chipmunk_parser_parser_list_config_schema_item_t *ret) {
  ret->ptr = new exports_chipmunk_parser_parser_config_schema_item_t[3];
  ret->len = 3;

  // Boolean configuration item
  auto &bool_item = ret->ptr[0];
  parse_string_dup(&bool_item.id, "bool_id");
  bool_item.description.is_some = true;
  parse_string_dup(&bool_item.title, "Boolean Configuration");
  parse_string_dup(&bool_item.description.val,
                   "Demonstrate a boolean configuration item");
  bool_item.input_type.tag =
      CHIPMUNK_SHARED_SHARED_TYPES_CONFIG_SCHEMA_TYPE_BOOLEAN;
  bool_item.input_type.val.boolean = true;

  // Text configuration item
  auto &text_item = ret->ptr[1];
  parse_string_dup(&text_item.id, "text_id");
  text_item.description.is_some = true;
  parse_string_dup(&text_item.title, "Text Configuration");
  parse_string_dup(&text_item.description.val,
                   "Demonstrate a text configuration item");
  text_item.input_type.tag =
      CHIPMUNK_SHARED_SHARED_TYPES_CONFIG_SCHEMA_TYPE_TEXT;
  parse_string_dup(&text_item.input_type.val.text, "Default text");

  // Files configuration item
  auto &files_item = ret->ptr[2];
  parse_string_dup(&files_item.id, "files_id");
  files_item.description.is_some = true;
  parse_string_dup(&files_item.title, "Files Configuration");
  parse_string_dup(&files_item.description.val,
                   "Demonstrate files configuration item");
  files_item.input_type.tag =
      CHIPMUNK_SHARED_SHARED_TYPES_CONFIG_SCHEMA_TYPE_FILES;
  files_item.input_type.val.files.len = 0;
}

/// Provides the custom render options to be rendered in log view, enabling the
/// users to change the visibility on the log columns when provided. This
/// function can be called before initializing the plugin instance.
void exports_chipmunk_parser_parser_get_render_options(
    exports_chipmunk_parser_parser_render_options_t *ret) {
#if defined(SINGLE_COLUMN_MODE)
  ret->columns_options.is_some = false;

#elif defined(MULTI_COLUMN_MODE)
  ret->columns_options.is_some = true;

  ret->columns_options.val.max_width = 600;
  ret->columns_options.val.min_width = 30;

  auto &columns = ret->columns_options.val.columns;
  columns.ptr = new chipmunk_parser_parse_types_column_info_t[2];
  columns.len = 2;

  auto &first_column = columns.ptr[0];
  parse_string_dup(&first_column.caption, "First Column");
  first_column.width = 110;

  auto &second_column = columns.ptr[1];
  parse_string_dup(&second_column.caption, "Second Column");
  second_column.width = -1;

#endif
}

/// Initialize the parser with the given configurations
/// This function will be called upon starting a parsing session.
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
  std::cout << "Inint function called with log level: "
            << std::to_string(general_configs->log_level) << std::endl;

  // *** Demonstrate printing to stderr ***
  size_t conf_len = plugin_configs->len;
  std::cerr << "Provided configs length: " << std::to_string(conf_len)
            << std::endl;

  // *** Fetching configuration values ***
  for (size_t i = 0; i < conf_len; i++) {
    std::cout << "Configuration item info:" << std::endl;
    std::cout << "  Index: " << i << std::endl;
    std::cout << "  ID: " << plugin_configs->ptr[i].id.ptr << std::endl;
    uint8_t val_tag = plugin_configs->ptr[i].value.tag;
    std::cout << "  TAG ID: " << std::to_string(val_tag) << std::endl;
    switch (val_tag) {
    case CHIPMUNK_SHARED_SHARED_TYPES_CONFIG_SCHEMA_TYPE_BOOLEAN:
      std::cout << "  Boolean value: "
                << plugin_configs->ptr[i].value.val.boolean << std::endl;
      break;
    case CHIPMUNK_SHARED_SHARED_TYPES_CONFIG_SCHEMA_TYPE_INTEGER:
      std::cout << "  Integer value: "
                << plugin_configs->ptr[i].value.val.integer << std::endl;
      break;
    case CHIPMUNK_SHARED_SHARED_TYPES_CONFIG_SCHEMA_TYPE_FLOAT:
      std::cout << "  Float value: " << plugin_configs->ptr[i].value.val.float_
                << std::endl;
      break;
    case CHIPMUNK_SHARED_SHARED_TYPES_CONFIG_SCHEMA_TYPE_TEXT:
      std::cout << "  Text value: " << plugin_configs->ptr[i].value.val.text.ptr
                << std::endl;
      break;
    case CHIPMUNK_SHARED_SHARED_TYPES_CONFIG_SCHEMA_TYPE_DIRECTORIES: {
      size_t dir_len = plugin_configs->ptr[i].value.val.directories.len;
      std::cout << "  Directories length: " << std::to_string(dir_len)
                << std::endl;
      for (size_t dir_idx = 0; dir_idx < dir_len; dir_len++) {
        std::cout
            << "    Directory path: "
            << plugin_configs->ptr[i].value.val.directories.ptr[dir_idx].ptr
            << std::endl;
      }
    } break;
    case CHIPMUNK_SHARED_SHARED_TYPES_CONFIG_SCHEMA_TYPE_FILES: {
      size_t files_len = plugin_configs->ptr[i].value.val.files.len;
      std::cout << "  Files length: " << std::to_string(files_len) << std::endl;
      for (size_t file_idx = 0; file_idx < files_len; file_idx++) {
        std::cout << "    File path: "
                  << plugin_configs->ptr[i].value.val.files.ptr[file_idx].ptr
                  << std::endl;
      }
    } break;
    case CHIPMUNK_SHARED_SHARED_TYPES_CONFIG_SCHEMA_TYPE_DROPDOWN:
      std::cout << "  Dropdown value: "
                << plugin_configs->ptr[i].value.val.dropdown.ptr << std::endl;
      break;
    }
  }

  return true;
}

/// Parse the given bytes providing a list of parsed items,
/// or parse error if an error occurred and no item has been parsed.
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
  auto &item = ret->ptr[0];
  item.consumed = data->len;
  item.value.is_some = true;
  item.value.val.tag = CHIPMUNK_PARSER_PARSE_TYPES_PARSE_YIELD_MESSAGE;
  item.value.val.val.message.tag =
      CHIPMUNK_PARSER_PARSE_TYPES_PARSED_MESSAGE_LINE;

  std::string log_line =
      "The length of provided bytes: " + std::to_string(data->len);
  parse_string_set(&item.value.val.val.message.val.line, log_line.c_str());

  return true;

#elif defined(MULTI_COLUMN_MODE)

  // *** Returns two columns ***
  // - The first column contain a static text.
  // - The second columns contains the length of provided bytes.
  ret->len = 1;
  auto &item = ret->ptr[0];
  item.consumed = data->len;
  item.value.is_some = true;

  item.value.val.tag = CHIPMUNK_PARSER_PARSE_TYPES_PARSE_YIELD_MESSAGE;
  item.value.val.val.message.tag =
      CHIPMUNK_PARSER_PARSE_TYPES_PARSED_MESSAGE_COLUMNS;

  auto &columns = item.value.val.val.message.val.columns;
  columns.ptr = new parse_string_t[2];
  columns.len = 2;
  parse_string_dup(&columns.ptr[0], "static message");

  std::string log_line =
      "The length of provided bytes: " + std::to_string(data->len);
  parse_string_dup(&columns.ptr[1], log_line.c_str());

  return true;

#endif
}
