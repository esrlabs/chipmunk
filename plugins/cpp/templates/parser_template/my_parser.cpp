#include "parse.h"
#include "stdio.h"
#include <string.h>

void exports_chipmunk_parser_parser_get_version(
    exports_chipmunk_parser_parser_version_t *ret) {
  ret->major = 0;
  ret->minor = 1;
  ret->patch = 0;
}

void exports_chipmunk_parser_parser_get_config_schemas(
    exports_chipmunk_parser_parser_list_config_schema_item_t *ret) {
  // TODO AAZ: Temp solution until we are sure that it can be compiled.
  ret->ptr = NULL;
  ret->len = 0;
}

void exports_chipmunk_parser_parser_get_render_options(
    exports_chipmunk_parser_parser_render_options_t *ret) {
  // TODO AAZ: Temp solution until we are sure that it can be compiled.
  ret->columns_options.is_some = false;
}

bool exports_chipmunk_parser_parser_init(
    exports_chipmunk_parser_parser_parser_config_t *general_configs,
    exports_chipmunk_parser_parser_list_config_item_t *plugin_configs,
    exports_chipmunk_parser_parser_init_error_t *err) {
  // TODO AAZ:
  // * Keep track on active log level and send logs only if enabled.

  parse_string_t log_msg;
  parse_string_set(&log_msg, "Initi message called");
  chipmunk_shared_logging_log(CHIPMUNK_SHARED_LOGGING_LEVEL_INFO, &log_msg);

  parse_string_free(&log_msg);

  // Demonstrate printing to stdout.
  printf("Inint function called with log level: %d\n",
         general_configs->log_level);

  printf("Provided configs length: %d\n", (int)plugin_configs->len);

  return true;
}

bool exports_chipmunk_parser_parser_parse(
    parse_list_u8_t *data, uint64_t *maybe_timestamp,
    exports_chipmunk_parser_parser_list_parse_return_t *ret,
    exports_chipmunk_parser_parser_parse_error_t *err) {

  // *** Send log ***
  parse_string_t log_msg;
  parse_string_set(&log_msg, "Parse called");
  // TODO AAZ: Change log level to debug.
  chipmunk_shared_logging_log(CHIPMUNK_SHARED_LOGGING_LEVEL_ERROR, &log_msg);
  // parse_string_free(&log_msg);

  // *** Return length of provided bytes ***
  ret->len = 1;
  auto &item = ret->ptr[0];
  item.consumed = data->len;
  item.value.is_some = true;
  item.value.val.tag = CHIPMUNK_PARSER_PARSE_TYPES_PARSE_YIELD_MESSAGE;
  item.value.val.val.message.tag =
      CHIPMUNK_PARSER_PARSE_TYPES_PARSED_MESSAGE_LINE;

  // TODO AAZ: Std strings are failing to compile.
  // std::string log_line = "Sent bytes length" + std::to_string(data->len);
  // Deliver values with C API (snprintf) temporally:
  char msg_buff[100];
  snprintf(msg_buff, sizeof(msg_buff), "The length of provided bytes: %zu",
           data->len);
  parse_string_set(&item.value.val.val.message.val.line, msg_buff);

  return true;
}
