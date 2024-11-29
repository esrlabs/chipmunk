use proc_macro::TokenStream;
use quote::quote;
use syn::{parse_macro_input, Item};

#[proc_macro_attribute]
pub fn encode_decode(_: TokenStream, input: TokenStream) -> TokenStream {
    let item = parse_macro_input!(input as syn::Item);

    let item_clone = item.clone();

    let (entity_name, generics) = match &item {
        Item::Struct(s) => (&s.ident, &s.generics),
        Item::Enum(e) => (&e.ident, &e.generics),
        _ => {
            return syn::Error::new_spanned(
                &item,
                "encode_decode can be applied only to structs and enums",
            )
            .to_compile_error()
            .into();
        }
    };

    let (impl_generics, ty_generics, where_clause) = generics.split_for_impl();

    TokenStream::from(quote! {

        #item_clone

        impl #impl_generics #entity_name #ty_generics #where_clause {
            pub fn encode(&self) -> Result<Vec<u8>, String> {
                bincode::serialize(self).map_err(|e| e.to_string())
            }

            pub fn decode(buf: &[u8]) -> Result<Self, String> {
                bincode::deserialize(buf).map_err(|e| e.to_string())
            }
        }
    })
}
