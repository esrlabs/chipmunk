use std::collections::HashMap;
lazy_static! {
    #[rustfmt::skip]
    pub static ref SERVICE_ID_MAPPING: HashMap<u8, (&'static str, &'static str)> = {
        let mut m = HashMap::new();
        m.insert(0x01, ("set_log_level", "Set the Log Level"));
        m.insert(0x02, ("set_trace_status", "Enable/Disable Trace Messages"));
        m.insert(0x03, ("get_log_info", "Returns the LogLevel for registered applications"));
        m.insert(0x04, ("get_default_log_level", "Returns the LogLevel for wildcards"));
        m.insert(0x05, ("store_configuration", "Stores the current configuration non volatile"));
        m.insert(0x06, ("restore_to_factory_default", "Sets the configuration back to default"));
        m.insert(0x07, ("set_com_interface_status", "SetComInterfaceStatus -- deprecated"));
        m.insert(0x08, ("set_com_interface_max_bandwidth", "SetComInterfaceMaxBandwidth -- deprecated"));
        m.insert(0x09, ("set_verbose_mode", "SetVerboseMode -- deprecated"));
        m.insert(0x10, ("set_use_extended_header", "SetUseExtendedHeader -- deprecated"));
        m.insert(0x0A, ("set_message_filtering", "Enable/Disable message filtering"));
        m.insert(0x0B, ("set_timing_packets", "SetTimingPackets -- deprecated"));
        m.insert(0x0C, ("get_local_time", "GetLocalTime -- deprecated"));
        m.insert(0x0D, ("set_use_ecuid", "SetUseECUID -- deprecated"));
        m.insert(0x0E, ("set_use_session_id", "SetUseSessionID -- deprecated"));
        m.insert(0x0F, ("set_use_timestamp", "SetUseTimestamp -- deprecated"));
        m.insert(0x11, ("set_default_log_level", "Sets the LogLevel for wildcards"));
        m.insert(0x12, ("set_default_trace_status", "Enable/Disable TraceMessages for wildcards"));
        m.insert(0x13, ("get_software_version", "Get the ECU software version"));
        m.insert(0x14, ("message_buffer_overflow", "MessageBufferOverflow -- deprecated"));
        m.insert(0x15, ("get_default_trace_status", "Get the current TraceLevel for wildcards"));
        m.insert(0x16, ("get_com_interfacel_status", "GetComInterfacelStatus -- deprecated"));
        m.insert(0x17, ("get_log_channel_names", "Returns the LogChannel’s name"));
        m.insert(0x18, ("get_com_interface_max_bandwidth", "GetComInterfaceMaxBandwidth -- deprecated"));
        m.insert(0x19, ("get_verbose_mode_status", "GetVerboseModeStatus -- deprecated"));
        m.insert(0x1A, ("get_message_filtering_status", "GetMessageFilteringStatus -- deprecated"));
        m.insert(0x1B, ("get_use_ecuid", "GetUseECUID -- deprecated"));
        m.insert(0x1C, ("get_use_session_id", "GetUseSessionID -- deprecated"));
        m.insert(0x1D, ("get_use_timestamp", "GetUseTimestamp -- deprecated"));
        m.insert(0x1E, ("get_use_extended_header", "GetUseExtendedHeader -- deprecated"));
        m.insert(0x1F, ("get_trace_status", "Returns the current TraceStatus"));
        m.insert(0x20, ("set_log_channel_assignment", "Adds/ Removes the given LogChannel as output path"));
        m.insert(0x21, ("set_log_channel_threshold", "Sets the filter threshold for the given LogChannel"));
        m.insert(0x22, ("get_log_channel_threshold", "Returns the current LogLevel for a given LogChannel"));
        m.insert(0x23, ("buffer_overflow_notification", "Report that a buffer overflow occurred"));
        m
    };
}
