#[macro_export]
macro_rules! gen_encode_decode_fns {
    ($element_ref:expr) => {
        paste::item! {
            #[wasm_bindgen]
            #[allow(non_snake_case)]
            pub fn [< decode $element_ref >](buf: &[u8]) -> Result<JsValue, E> {
                let serializer = Serializer::new()
                    .serialize_missing_as_null(true)
                    .serialize_maps_as_objects(true)
                    .serialize_large_number_types_as_bigints(false);
                $element_ref::decode(buf)
                    .map_err(E::DecodeError)?
                    .serialize(&serializer)
                    .map_err(|e| E::DecodeError(e.to_string()))
            }

            #[wasm_bindgen]
            #[allow(non_snake_case)]
            pub fn [< encode $element_ref >](val: JsValue) -> Result<Vec<u8>, E> {
                from_value::<$element_ref>(val)?
                    .encode()
                    .map_err(E::DecodeError)
            }
        }
    };
}
