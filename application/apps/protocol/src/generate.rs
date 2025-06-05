#[macro_export]
macro_rules! gen_encode_decode_fns {
    // All regular use cases: gen_encode_decode_fns!(ObserveOptions);
    ($type:ident) => {
        paste::item! {
            #[wasm_bindgen]
            #[allow(non_snake_case)]
            pub fn [<decode $type>](buf: &[u8]) -> Result<JsValue, E> {
                let serializer = Serializer::new()
                    .serialize_missing_as_null(true)
                    .serialize_maps_as_objects(false)
                    .serialize_large_number_types_as_bigints(false);
                $type::decode(buf)
                    .map_err(E::CodecDecodeError)?
                    .serialize(&serializer)
                    .map_err(|e| E::DecodeError(e.to_string()))
            }

            #[wasm_bindgen]
            #[allow(non_snake_case)]
            pub fn [<encode $type>](val: JsValue) -> Result<Vec<u8>, E> {
                from_value::<$type>(val)?
                    .encode()
                    .map_err(E::DecodeError)
            }
        }
    };

    // Subtype returns void: gen_encode_decode_fns!(CommandOutcome<()>);
    ($type:ident<()>) => {
        paste::item! {
            #[wasm_bindgen]
            #[allow(non_snake_case)]
            pub fn [<decode $type WithVoid>](buf: &[u8]) -> Result<JsValue, E> {
                let serializer = Serializer::new()
                    .serialize_missing_as_null(true)
                    .serialize_maps_as_objects(false)
                    .serialize_large_number_types_as_bigints(false);
                $type::<()>::decode(buf)
                    .map_err(E::CodecDecodeError)?
                    .serialize(&serializer)
                    .map_err(|e| E::DecodeError(e.to_string()))
            }

            #[wasm_bindgen]
            #[allow(non_snake_case)]
            pub fn [<encode $type WithVoid>](val: JsValue) -> Result<Vec<u8>, E> {
                from_value::<$type::<()>>(val)?
                    .encode()
                    .map_err(E::DecodeError)
            }
        }
    };

    // With subtypes: gen_encode_decode_fns!(CommandOutcome<String>);
    ($type:ident<$generic:ident>) => {
        paste::item! {
            #[wasm_bindgen]
            #[allow(non_snake_case)]
            pub fn [<decode $type With $generic>](buf: &[u8]) -> Result<JsValue, E> {
                let serializer = Serializer::new()
                    .serialize_missing_as_null(true)
                    .serialize_maps_as_objects(false)
                    .serialize_large_number_types_as_bigints(false);
                $type::<$generic>::decode(buf)
                    .map_err(E::CodecDecodeError)?
                    .serialize(&serializer)
                    .map_err(|e| E::DecodeError(e.to_string()))
            }

            #[wasm_bindgen]
            #[allow(non_snake_case)]
            pub fn [<encode $type With $generic>](val: JsValue) -> Result<Vec<u8>, E> {
                from_value::<$type::<$generic>>(val)?
                    .encode()
                    .map_err(E::DecodeError)
            }
        }
    };

    // With nested subtypes: gen_encode_decode_fns!(CommandOutcome<Option<String>>);
    ($type:ident<$generic:ident<$nested:ident>>) => {
        paste::item! {
            #[wasm_bindgen]
            #[allow(non_snake_case)]
            pub fn [<decode $type With $generic $nested>](buf: &[u8]) -> Result<JsValue, E> {
                let serializer = Serializer::new()
                    .serialize_missing_as_null(true)
                    .serialize_maps_as_objects(false)
                    .serialize_large_number_types_as_bigints(false);
                $type::<$generic<$nested>>::decode(buf)
                    .map_err(E::CodecDecodeError)?
                    .serialize(&serializer)
                    .map_err(|e| E::DecodeError(e.to_string()))
            }

            #[wasm_bindgen]
            #[allow(non_snake_case)]
            pub fn [<encode $type With $generic $nested>](val: JsValue) -> Result<Vec<u8>, E> {
                from_value::<$type::<$generic<$nested>>>(val)?
                    .encode()
                    .map_err(E::DecodeError)
            }
        }
    };
}
