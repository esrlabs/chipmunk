/// The `protocol` crate is a WebAssembly-wrapped version of the `stypes` crate, designed for encoding  
/// and decoding message types used both on the Rust side and the Node.js side (including client-side code).
///
/// Code generation for `wasm_bindgen` is handled by the `gen_encode_decode_fns` macro, which sets up  
/// the necessary encode/decode functions. For example:
///
/// ```
///     gen_encode_decode_fns!(ObserveOptions);
/// ```
///
/// This will generate:
///
/// ```ignore
/// #[wasm_bindgen]
/// #[allow(non_snake_case)]
/// pub fn decodeObserveOptions(buf: &[u8]) -> Result<JsValue, E> {
///     let serializer = Serializer::new()
///         .serialize_missing_as_null(true)
///         .serialize_maps_as_objects(false)
///         .serialize_large_number_types_as_bigints(false);
///
///     ObserveOptions::decode(buf)
///         .map_err(E::CodecDecodeError)?
///         .serialize(&serializer)
///         .map_err(|e| E::DecodeError(e.to_string()))
/// }
///
/// #[wasm_bindgen]
/// #[allow(non_snake_case)]
/// pub fn encodeObserveOptions(val: JsValue) -> Result<Vec<u8>, E> {
///     from_value::<ObserveOptions>(val)?
///         .encode()
///         .map_err(E::DecodeError)
/// }
/// ```
///
/// As a result, on the Node.js side you can directly decode and encode `ObserveOptions`:
///
/// ```ignore
/// import * as protocol from "protocol";
///
/// // Decoding
/// const bytes: Uint8Array = get_bytes();
/// const msg = protocol.decodeObserveOptions(bytes);
///
/// // Encoding
/// const obj: ObserveOptions = ...;
/// cosnt bytes = protocol.encodeObserveOptions(obj);
/// ```
///
/// It's important to note that `wasm_bindgen` does not generate type definitions (`.d.ts` files),  
/// so the decoding function will return `any`, and the encoding function will accept `any`.  
/// Ensuring that the correct types are passed is therefore beyond the scope of this crate.  
/// While supplying an invalid byte sequence (one that doesn't match the expected data type)  
/// will cause an error to be thrown, it is theoretically possible (though unlikely)  
/// that an incorrect byte sequence could decode into a valid but unexpected type.  
/// Therefore, when using this crate, ensure that the expected data type aligns with the chosen
/// decode function.
///
/// ## Adding New Types
/// To add new types, follow the steps below.
///
/// ### Updating `stypes`
/// - Add your new type to the `stypes` crate.
/// - **Important:** Ensure that `proptest` tests are implemented in `stypes` for the new type.
///   This is a mandatory requirement when introducing any new type.
/// - If the type is directly used in `rs-bindings`, add an implementation of the trait `TryIntoJs`. This can
///   be easily done by using the macro `try_into_js`.
/// - Add TypeScript definitions. This step can also be done mostly automatically by adding
///   `#[cfg_attr(test, derive(TS), ts(export, export_to = "module_name.ts"))]` above the
///   definition of your type. Make sure you are using the correct `module_name`. The TypeScript type
///   definition will be placed into `application/apps/indexer/stypes/bindings/module_name.ts`.
///   Writing of types happens by executing tests (`cargo test`).
///   As soon as a new TypeScript definition has been created, you have to manually copy it into
///   `application/platform/types/bindings`.
///   **Important:** Do not remove `application/apps/indexer/stypes/bindings/index.ts`. This file
///   isn't generated and is created manually. If you are introducing a new
///   module along with your type, please add a reference to it in the `index.ts` file.
///
/// ### Updating `protocol`
/// Once the type is added to `stypes`, simply reference it in `protocol`:
/// ```ignore
/// gen_encode_decode_fns!(MyRecentlyAddedType);
/// ```
///
/// ### Updating test in `ts-bindings`
/// As soon as type was added, you have to update map in `application/apps/rustcore/ts-bindings/spec/session.protocol.spec.ts`.
/// Add name of your type and link it to related decode function
///
/// ```
/// const MAP: { [key: string]: (buf: Uint8Array) => any } = {
///     AroundIndexes: protocol.decodeAroundIndexes,
///     ...
///     AttachmentList: protocol.decodeAttachmentList,
/// }
/// ```
///
/// ### Verification
/// To verify your changes, run the `test.sh` script. This test uses `proptest` in `stypes` to
/// randomly generate values for all types, then serialize them as bytes to temporary files. Next,
/// it uses `proptest` within `ts-bindings` to decode all these messages.  
///
/// - If the process fails, `test.sh` will report an error.  
/// - If it succeeds, you can consider the new type successfully integrated.
mod err;
mod gen;

pub(crate) use err::*;
pub(crate) use serde::Serialize;
pub(crate) use serde_wasm_bindgen::{from_value, Serializer};
pub(crate) use stypes::*;
pub(crate) use wasm_bindgen::prelude::*;

gen_encode_decode_fns!(ObserveOptions);
gen_encode_decode_fns!(MulticastInfo);
gen_encode_decode_fns!(UdpConnectionInfo);
gen_encode_decode_fns!(ParserType);
gen_encode_decode_fns!(DltParserSettings);
gen_encode_decode_fns!(SomeIpParserSettings);
gen_encode_decode_fns!(Transport);
gen_encode_decode_fns!(ProcessTransportConfig);
gen_encode_decode_fns!(SerialTransportConfig);
gen_encode_decode_fns!(TCPTransportConfig);
gen_encode_decode_fns!(UDPTransportConfig);
gen_encode_decode_fns!(FileFormat);
gen_encode_decode_fns!(ObserveOrigin);
gen_encode_decode_fns!(FoldersScanningResult);
gen_encode_decode_fns!(DltStatisticInfo);
gen_encode_decode_fns!(Profile);
gen_encode_decode_fns!(ProfileList);
gen_encode_decode_fns!(PluginParserSettings);
gen_encode_decode_fns!(PluginParserGeneralSettings);
gen_encode_decode_fns!(PluginByteSourceSettings);
gen_encode_decode_fns!(PluginByteSourceGeneralSettings);
gen_encode_decode_fns!(PluginConfigItem);
gen_encode_decode_fns!(PluginConfigValue);
gen_encode_decode_fns!(PluginConfigSchemaType);
gen_encode_decode_fns!(PluginConfigSchemaItem);
gen_encode_decode_fns!(PluginEntity);
gen_encode_decode_fns!(PluginLogLevel);
gen_encode_decode_fns!(PluginLogMessage);
gen_encode_decode_fns!(PluginRunData);
gen_encode_decode_fns!(PluginMetadata);
gen_encode_decode_fns!(PluginType);
gen_encode_decode_fns!(PluginInfo);
gen_encode_decode_fns!(InvalidPluginEntity);
gen_encode_decode_fns!(SemanticVersion);
gen_encode_decode_fns!(RenderOptions);
gen_encode_decode_fns!(ParserRenderOptions);
gen_encode_decode_fns!(ColumnsRenderOptions);
gen_encode_decode_fns!(ColumnInfo);
gen_encode_decode_fns!(PluginProducerSettings);
gen_encode_decode_fns!(PluginProducerGeneralSettings);
gen_encode_decode_fns!(ProducerRenderOptions);
gen_encode_decode_fns!(PluginsList);
gen_encode_decode_fns!(InvalidPluginsList);
gen_encode_decode_fns!(PluginsPathsList);
gen_encode_decode_fns!(CommandOutcome<PluginsList>);
gen_encode_decode_fns!(CommandOutcome<InvalidPluginsList>);
gen_encode_decode_fns!(CommandOutcome<PluginsPathsList>);
gen_encode_decode_fns!(CommandOutcome<Option<PluginEntity>>);
gen_encode_decode_fns!(CommandOutcome<Option<InvalidPluginEntity>>);
gen_encode_decode_fns!(CommandOutcome<Option<PluginRunData>>);
gen_encode_decode_fns!(CommandOutcome<FoldersScanningResult>);
gen_encode_decode_fns!(CommandOutcome<SerialPortsList>);
gen_encode_decode_fns!(CommandOutcome<ProfileList>);
gen_encode_decode_fns!(CommandOutcome<DltStatisticInfo>);
gen_encode_decode_fns!(CommandOutcome<MapKeyValue>);
gen_encode_decode_fns!(CommandOutcome<()>);
gen_encode_decode_fns!(CommandOutcome<i64>);
gen_encode_decode_fns!(CommandOutcome<Option<String>>);
gen_encode_decode_fns!(CommandOutcome<String>);
gen_encode_decode_fns!(CommandOutcome<bool>);
gen_encode_decode_fns!(ComputationError);
gen_encode_decode_fns!(CallbackEvent);
gen_encode_decode_fns!(NativeError);
gen_encode_decode_fns!(NativeErrorKind);
gen_encode_decode_fns!(Severity);
gen_encode_decode_fns!(OperationDone);
gen_encode_decode_fns!(LifecycleTransition);
gen_encode_decode_fns!(AttachmentInfo);
gen_encode_decode_fns!(AttachmentList);
gen_encode_decode_fns!(Notification);
gen_encode_decode_fns!(Progress);
gen_encode_decode_fns!(Ticks);
gen_encode_decode_fns!(Ranges);
gen_encode_decode_fns!(SourceDefinition);
gen_encode_decode_fns!(Sources);
gen_encode_decode_fns!(SdeRequest);
gen_encode_decode_fns!(SdeResponse);
gen_encode_decode_fns!(GrabbedElement);
gen_encode_decode_fns!(GrabbedElementList);
gen_encode_decode_fns!(AroundIndexes);
gen_encode_decode_fns!(FilterMatch);
gen_encode_decode_fns!(FilterMatchList);
gen_encode_decode_fns!(FolderEntity);
gen_encode_decode_fns!(FolderEntityDetails);
gen_encode_decode_fns!(FolderEntityType);
gen_encode_decode_fns!(SerialPortsList);
gen_encode_decode_fns!(ExtractedMatchValue);
gen_encode_decode_fns!(ResultExtractedMatchValues);
gen_encode_decode_fns!(ResultU64);
gen_encode_decode_fns!(ResultBool);
gen_encode_decode_fns!(ResultSleep);
gen_encode_decode_fns!(NearestPosition);
gen_encode_decode_fns!(ResultNearestPosition);
gen_encode_decode_fns!(Point);
gen_encode_decode_fns!(ResultSearchValues);
gen_encode_decode_fns!(ResultScaledDistribution);
gen_encode_decode_fns!(DltLevelDistribution);
