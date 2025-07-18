use super::CommonDescriptor;

/// Describes a component in terms of its identity, configuration schema,
/// validation logic, support for lazy-loading configuration, and its type within the system.
///
/// The `ComponentDescriptor` trait serves as an abstraction layer that decouples
/// the core system from concrete component implementations. Instead of referring
/// to component types directly (e.g., a specific parser or source), the application
/// interacts with components through their descriptors.
///
/// This design enables a fully modular architecture where, for example, a session
/// can be created using a parser and source identified solely by their UUIDs.
/// The actual parser and source implementations remain hidden behind the descriptor,
/// making it possible to swap, reconfigure, or isolate components without touching
/// the application core.
pub trait ParserDescriptor: CommonDescriptor {
    fn get_render(&self) -> Option<stypes::OutputRender>;
}
