use proc_macro::TokenStream;
use quote::quote;
use syn::parse_macro_input;

#[proc_macro_attribute]
pub fn encode_decode(_: TokenStream, input: TokenStream) -> TokenStream {
    let item = parse_macro_input!(input as syn::Item);

    let item_clone = item.clone();

    let entity_name = match &item {
        syn::Item::Struct(s) => &s.ident,
        syn::Item::Enum(e) => &e.ident,
        _ => panic!("encode_decode can be applied only to Struct and Enum"),
    };

    TokenStream::from(quote! {

        #item_clone

        impl #entity_name {
            pub fn encode(&self) -> Result<Vec<u8>, String> {
                bincode::serialize(self).map_err(|e| e.to_string())
            }
            pub fn decode(buf: &[u8]) -> Result<Self, String> {
                bincode::deserialize(buf).map_err(|e| e.to_string())
            }
        }

    })
}
