///
/// # Entities:
///
/// * `Range`
/// * `RangeInclusive`
///
pub mod common {
    include!(concat!(env!("OUT_DIR"), "/common.rs"));
}

///
/// # Entities:
///
/// * `AttachmentInfo`
///
pub mod attachment {
    include!(concat!(env!("OUT_DIR"), "/attachment.rs"));
}

///
/// # Entities:
///
/// * `GrabError`
/// * `SearchError`
/// * `NativeErrorKind`
/// * `NativeError`
/// * `Severity`
/// * `ComputationError`
///
pub mod error {
    include!(concat!(env!("OUT_DIR"), "/error.rs"));
}

///
/// # Entities:
///
/// * `GrabbedElement`
/// * `GrabbedElementList`
///
pub mod grabbing {
    include!(concat!(env!("OUT_DIR"), "/grabbing.rs"));
}

///
/// # Entities:
///
/// * `ObserveOptions`
/// * `DltParserSettings`
/// * `DltFilterConfig`
/// * `SomeIpParserSettings`
/// * `ProcessTransportConfig`
/// * `SerialTransportConfig`
/// * `TCPTransportConfig`
/// * `MulticastInfo`
/// * `UDPTransportConfig`
/// * `FileFormat`
/// * `ParserType`
/// * `Transport`
/// * `ObserveOrigin`
///
pub mod observe {
    include!(concat!(env!("OUT_DIR"), "/observe.rs"));
}

///
/// # Entities:
///
/// * `OperationDone`
/// * `Ticks`
/// * `Notification`
/// * `CallbackEvent`
///
pub mod event {
    include!(concat!(env!("OUT_DIR"), "/event.rs"));
}

///
/// # Entities:
///
/// * `SdeRequest`
/// * `SdeResponse`
///
pub mod sde {
    include!(concat!(env!("OUT_DIR"), "/sde.rs"));
}

///
/// # Entities:
///
/// * `LifecycleTransition`
/// * `Ticks`
///
pub mod progress {
    include!(concat!(env!("OUT_DIR"), "/progress.rs"));
}

///
/// # Entities:
///
///
pub mod commands {
    include!(concat!(env!("OUT_DIR"), "/commands.rs"));
}

pub use attachment::*;
pub use commands::*;
pub use common::*;
pub use error::*;
pub use event::*;
pub use grabbing::*;
pub use observe::*;
pub use progress::*;
pub use sde::*;
