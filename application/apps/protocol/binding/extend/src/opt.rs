use syn::{
    parse::{self, Parse, ParseStream},
    punctuated::Punctuated,
    Expr, Token,
};

#[derive(Clone, Debug, Default)]
pub struct Opt {
    pub path: String,
}

impl Opt {
    pub(self) fn new(path: String) -> Self {
        Self { path }
    }
}

impl Parse for Opt {
    fn parse(input: ParseStream) -> parse::Result<Self> {
        let input = Punctuated::<Expr, Token![,]>::parse_terminated(input)?;
        let Some(expr) = input.first() else {
            return Ok(Opt::new(String::new()));
        };
        let Expr::Path(p) = expr else {
            return Err(syn::Error::new_spanned(
                expr,
                "Expecting expr like [key = \"value as String\"] or [key]",
            ));
        };
        let Some(ident) = p.path.get_ident() else {
            return Err(syn::Error::new_spanned(p, "Cannot extract identification"));
        };
        Ok(Opt::new(ident.to_string()))
    }
}
