mod opt;
use opt::Opt;
use proc_macro::TokenStream;
use quote::quote;
use syn::{parse_macro_input, ItemStruct, Path};

#[proc_macro_attribute]
pub fn extend(args: TokenStream, input: TokenStream) -> TokenStream {
    let opt: Opt = parse_macro_input!(args as Opt);
    let item_struct = parse_macro_input!(input as ItemStruct);
    let proto_path: Path = if opt.path.is_empty() {
        syn::parse_str(&format!("{}", item_struct.ident))
    } else {
        syn::parse_str(&format!("{}::{}", opt.path, item_struct.ident))
    }
    .expect("Path to proto type parsed");
    let struct_name = item_struct.ident.clone();
    TokenStream::from(quote! {

        #[wasm_bindgen]
        #item_struct

        #[wasm_bindgen]
        impl #struct_name {

            #[wasm_bindgen]
            pub fn decode(buf: &[u8]) -> Result<JsValue, E> {
                Ok(to_value(&#proto_path::decode(buf)?)?)
            }

            #[wasm_bindgen]
            pub fn encode(val: JsValue) -> Result<Vec<u8>, E> {
                let val: #proto_path = from_value(val)?;
                let mut buf = Vec::new();
                val.encode(&mut buf)?;
                Ok(buf)
            }
        }
    })
}
