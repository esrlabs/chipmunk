use failure::{Error, format_err, bail};
use std::{
    io::{BufRead, BufReader},
    path::{PathBuf, Path},
    mem,
    fs::File,
    rc::Rc,
};
use quick_xml::{
    events::{BytesStart, attributes::Attributes, Event as XmlEvent},
    Reader as XmlReader,
};
use std::collections::HashMap;
use std::collections::hash_map::Entry;
use derive_more::{Deref, Display};
use crate::dlt::{TypeInfo, TypeInfoKind, TypeLength, StringCoding, FloatWidth};

type Result<T = ()> = std::result::Result<T, Error>;

#[derive(Debug, PartialEq, Clone)]
pub struct FibexMetadata {
    pub(crate) frame_map_with_key: HashMap<(ContextId, ApplicationId, FrameId), Rc<FrameMetadata>>, // TODO: avoid cloning on .get
    pub(crate) frame_map: HashMap<FrameId, Rc<FrameMetadata>>,
}
#[derive(Debug, PartialEq, Clone)]
pub struct FrameMetadata {
    pub short_name: String,
    pub pdus: Vec<Rc<PduMetadata>>,
    pub application_id: Option<ApplicationId>,
    pub context_id: Option<ContextId>,
    pub message_type: Option<String>,
    pub message_info: Option<String>,
}
#[derive(Debug, PartialEq, Clone)]
pub struct PduMetadata {
    pub description: Option<String>,
    pub signal_types: Vec<TypeInfo>,
}

#[derive(Hash, PartialEq, Eq, Clone, Debug, Deref, Display)]
pub struct FrameId(pub String);

#[derive(Hash, PartialEq, Eq, Clone, Debug, Deref, Display)]
pub struct ContextId(pub String);

#[derive(Hash, PartialEq, Eq, Clone, Debug, Deref, Display)]
pub struct ApplicationId(pub String);

fn type_info_for_signal_ref(signal_ref: String) -> TypeInfo {
    match signal_ref.as_ref() {
        "S_BOOL" => TypeInfo {
            kind: TypeInfoKind::Bool,
            coding: StringCoding::ASCII,
            has_variable_info: false,
            has_trace_info: false,
        },
        "S_SINT8" => TypeInfo {
            kind: TypeInfoKind::Signed(TypeLength::BitLength8),
            coding: StringCoding::ASCII,
            has_variable_info: false,
            has_trace_info: false,
        },
        "S_UINT8" => TypeInfo {
            kind: TypeInfoKind::Unsigned(TypeLength::BitLength8),
            coding: StringCoding::ASCII,
            has_variable_info: false,
            has_trace_info: false,
        },
        "S_SINT16" => TypeInfo {
            kind: TypeInfoKind::Signed(TypeLength::BitLength16),
            coding: StringCoding::ASCII,
            has_variable_info: false,
            has_trace_info: false,
        },
        "S_UINT16" => TypeInfo {
            kind: TypeInfoKind::Unsigned(TypeLength::BitLength16),
            coding: StringCoding::ASCII,
            has_variable_info: false,
            has_trace_info: false,
        },
        "S_SINT32" => TypeInfo {
            kind: TypeInfoKind::Signed(TypeLength::BitLength32),
            coding: StringCoding::ASCII,
            has_variable_info: false,
            has_trace_info: false,
        },
        "S_UINT32" => TypeInfo {
            kind: TypeInfoKind::Unsigned(TypeLength::BitLength32),
            coding: StringCoding::ASCII,
            has_variable_info: false,
            has_trace_info: false,
        },
        "S_SINT64" => TypeInfo {
            kind: TypeInfoKind::Signed(TypeLength::BitLength64),
            coding: StringCoding::ASCII,
            has_variable_info: false,
            has_trace_info: false,
        },
        "S_UINT64" => TypeInfo {
            kind: TypeInfoKind::Unsigned(TypeLength::BitLength64),
            coding: StringCoding::ASCII,
            has_variable_info: false,
            has_trace_info: false,
        },
        "S_FLOA16" => unimplemented!("16-bit float not supported"),
        "S_FLOA32" => TypeInfo {
            kind: TypeInfoKind::Float(FloatWidth::Width32),
            coding: StringCoding::ASCII,
            has_variable_info: false,
            has_trace_info: false,
        },
        "S_FLOA64" => TypeInfo {
            kind: TypeInfoKind::Float(FloatWidth::Width64),
            coding: StringCoding::ASCII,
            has_variable_info: false,
            has_trace_info: false,
        },
        "S_STRG_ASCII" => TypeInfo {
            kind: TypeInfoKind::StringType,
            coding: StringCoding::ASCII,
            has_variable_info: false,
            has_trace_info: false,
        },
        "S_STRG_UTF8" => TypeInfo {
            kind: TypeInfoKind::StringType,
            coding: StringCoding::UTF8,
            has_variable_info: false,
            has_trace_info: false,
        },
        "S_RAWD" | "S_RAW" => TypeInfo {
            kind: TypeInfoKind::Raw,
            coding: StringCoding::ASCII,
            has_variable_info: false,
            has_trace_info: false,
        },
        s => unimplemented!("{}", s),
    }
}

pub fn read_fibexes(files: Vec<PathBuf>) -> Result<FibexMetadata> {
    let mut frames = vec![];
    let mut frame_map_with_key = HashMap::new();
    let mut frame_map = HashMap::new();
    let mut pdu_by_id = HashMap::new();
    for f in files {
        let mut reader = Reader::from_file(f)?;
        loop {
            match reader.read_event()? {
                Event::PduStart { id } => {
                    let (description, signal_refs) = read_pdu(&mut reader)?;
                    match pdu_by_id.entry(id.clone()) {
                        Entry::Occupied(_) => warn!("duplicate PDU ID {} found in fibexes", id),
                        Entry::Vacant(v) => {
                            v.insert(Rc::new(PduMetadata {
                                description,
                                signal_types: signal_refs
                                    .into_iter()
                                    .map(type_info_for_signal_ref)
                                    .collect(),
                            }));
                        }
                    }
                }
                Event::FrameStart { id } => {
                    frames.push((FrameId(id), read_frame(&mut reader)?));
                }
                Event::Eof => break,
                _ => {}
            }
        }
    }
    for (
        id,
        FrameReadData {
            short_name,
            context_id,
            application_id,
            message_type,
            message_info,
            pdu_refs,
        },
    ) in frames
    {
        let frame = Rc::new(FrameMetadata {
            short_name,
            pdus: pdu_refs
                .into_iter()
                .map(|r| {
                    pdu_by_id
                        .get(&r)
                        .cloned()
                        .ok_or_else(|| format_err!("pdu {} not found", &r))
                })
                .collect::<Result<Vec<_>>>()?,
            application_id,
            context_id,
            message_type,
            message_info,
        });
        if let (Some(context_id), Some(application_id)) =
            (frame.context_id.clone(), frame.application_id.clone())
        {
            let key = (context_id, application_id, id.clone());

            match frame_map_with_key.entry(key.clone()) {
                Entry::Occupied(_) => warn!(
                    "duplicate Frame context_id={} application_id={} id={}",
                    key.0, key.1, key.2
                ),
                Entry::Vacant(_) => {
                    frame_map_with_key.insert(key, frame.clone());
                }
            }
        } // else error?
        match frame_map.entry(id.clone()) {
            Entry::Occupied(_) => warn!("duplicate Frame id={}", id),
            Entry::Vacant(_) => {
                frame_map.insert(id, frame);
            }
        }
    }
    Ok(FibexMetadata {
        frame_map_with_key,
        frame_map,
    })
}

fn read_pdu(reader: &mut Reader<BufReader<File>>) -> Result<(Option<String>, Vec<String>)> {
    let mut signal_refs = vec![];
    loop {
        match reader.read_event()? {
            Event::SignalInstance {
                signal_ref,
                sequence_number,
                ..
            } => {
                signal_refs.push((sequence_number, signal_ref));
            }
            Event::PduEnd { description, .. } => {
                signal_refs.sort_by_key(|s| s.0);
                return Ok((description, signal_refs.into_iter().map(|v| v.1).collect()));
            }
            _ => {}
        }
    }
}

struct FrameReadData {
    short_name: String,
    context_id: Option<ContextId>,
    application_id: Option<ApplicationId>,
    message_type: Option<String>,
    message_info: Option<String>,
    pdu_refs: Vec<String>,
}

fn read_frame(reader: &mut Reader<BufReader<File>>) -> Result<FrameReadData> {
    let mut pdus = vec![];
    let mut frame_context_id = None;
    let mut frame_application_id = None;
    let mut frame_message_type = None;
    let mut frame_message_info = None;
    loop {
        match reader.read_event()? {
            Event::PduInstance {
                pdu_ref,
                sequence_number,
                ..
            } => {
                pdus.push((sequence_number, pdu_ref));
            }
            Event::ManufacturerExtension {
                context_id,
                application_id,
                message_type,
                message_info,
                ..
            } => {
                frame_context_id = context_id.map(ContextId);
                frame_application_id = application_id.map(ApplicationId);
                frame_message_type = message_type;
                frame_message_info = message_info;
            }
            Event::FrameEnd { short_name, .. } => {
                pdus.sort_by_key(|p| p.0);
                return Ok(FrameReadData {
                    short_name,
                    context_id: frame_context_id,
                    application_id: frame_application_id,
                    message_type: frame_message_type,
                    message_info: frame_message_info,
                    pdu_refs: pdus.into_iter().map(|p| p.1).collect(),
                });
            }
            _ => {}
        }
    }
}

const B_SHORT_NAME: &[u8] = b"SHORT-NAME";
const B_ID_REF: &[u8] = b"ID-REF";
const B_ID: &[u8] = b"ID";
const B_XSI_TYPE: &[u8] = b"xsi:type";
const B_PDU: &[u8] = b"PDU";
const B_BYTE_LENGTH: &[u8] = b"BYTE-LENGTH";
const B_PDU_TYPE: &[u8] = b"PDU-TYPE";
const B_DESC: &[u8] = b"DESC";
const B_SIGNAL_INSTANCE: &[u8] = b"SIGNAL-INSTANCE";
const B_SEQUENCE_NUMBER: &[u8] = b"SEQUENCE-NUMBER";
const B_SIGNAL_REF: &[u8] = b"SIGNAL-REF";
const B_FRAME: &[u8] = b"FRAME";
const B_FRAME_TYPE: &[u8] = b"FRAME-TYPE";
const B_PDU_INSTANCE: &[u8] = b"PDU-INSTANCE";
const B_PDU_REF: &[u8] = b"PDU-REF";
const B_MANUFACTURER_EXTENSION: &[u8] = b"MANUFACTURER-EXTENSION";
const B_MESSAGE_TYPE: &[u8] = b"MESSAGE_TYPE";
const B_MESSAGE_INFO: &[u8] = b"MESSAGE_INFO";
const B_APPLICATION_ID: &[u8] = b"APPLICATION_ID";
const B_CONTEXT_ID: &[u8] = b"CONTEXT_ID";

#[derive(Debug)]
pub enum Event {
    PduStart {
        id: String,
    },
    PduEnd {
        short_name: Option<String>,
        description: Option<String>,
        byte_length: usize,
    },
    SignalInstance {
        id: String,
        sequence_number: usize,
        signal_ref: String,
    },
    FrameStart {
        id: String,
    },
    FrameEnd {
        short_name: String,
        byte_length: usize,
    },
    ManufacturerExtension {
        message_type: Option<String>,
        message_info: Option<String>,
        application_id: Option<String>,
        context_id: Option<String>,
    },
    PduInstance {
        id: String,
        pdu_ref: String,
        sequence_number: usize,
    },
    Eof,
}
pub struct XmlReaderWithContext<B: BufRead> {
    xml_reader: XmlReader<B>,
    file_path: PathBuf,
}
impl<B: BufRead> XmlReaderWithContext<B> {
    pub fn buffer_position(&self) -> usize {
        self.xml_reader.buffer_position()
    }
    pub fn read_event<'a>(&mut self, buf: &'a mut Vec<u8>) -> Result<XmlEvent<'a>> {
        Ok(self.xml_reader.read_event(buf)?)
    }
    pub fn read_text(&mut self, tag: &[u8], buf: &mut Vec<u8>) -> Result<String> {
        Ok(self.xml_reader.read_text(tag, buf)?)
    }
    pub fn line_and_column(&self) -> Result<(usize, usize)> {
        let s = std::fs::read_to_string(self.file_path.clone())?;
        let mut line = 1;
        let mut column = 0;
        for c in s.chars().take(self.buffer_position()) {
            if c == '\n' {
                line += 1;
                column = 0;
            } else {
                column += 1;
            }
        }
        Ok((line, column))
    }
    pub fn read_usize(&mut self, e: &BytesStart<'_>) -> Result<usize> {
        Ok(self.read_text_buf(e)?.parse::<usize>().map_err(|e| {
            let (line, column) = self.line_and_column().unwrap_or((0, 0));
            format_err!("can't parse usize at {}:{}: {}", line, column, e)
        })?)
    }
    pub fn read_text_buf(&mut self, e: &BytesStart<'_>) -> Result<String> {
        Ok(self.read_text(e.name(), &mut Vec::new())?)
    }
    pub fn id_ref_attr(&self, e: &BytesStart<'_>, tag: &[u8]) -> Result<String> {
        Ok(self
            .attr_opt(e.attributes(), B_ID_REF)?
            .ok_or_else(|| missing_attr_err(B_ID_REF, tag, self.line_and_column()))?)
    }
    pub fn read_bool(&mut self, e: &BytesStart<'_>) -> Result<bool> {
        match self.read_text_buf(e)?.as_ref() {
            "true" => Ok(true),
            "false" => Ok(false),
            v => {
                let (line, column) = self.line_and_column()?;
                bail!("expected bool value, got {} at {}:{}", v, line, column)
            }
        }
    }
    pub fn attr_opt(&self, attrs: Attributes<'_>, name: &[u8]) -> Result<Option<String>> {
        for attr in attrs {
            let attr = attr?;
            let matches = if attr.key == name {
                true
            } else {
                let name_len = name.len();
                let key_len = attr.key.len();
                if key_len > name_len {
                    // support for namespaced attributes
                    attr.key[key_len - name_len - 1] == b':'
                        && &attr.key[key_len - name_len..] == name
                } else {
                    false
                }
            };
            if matches {
                return Ok(Some(attr.unescape_and_decode_value(&self.xml_reader)?));
            }
        }
        Ok(None)
    }
    pub fn xsi_type_attr(&self, e: &BytesStart<'_>, tag: &[u8]) -> Result<String> {
        self.attr(e, B_XSI_TYPE, tag)
    }
    pub fn attr(&self, e: &BytesStart<'_>, name: &[u8], tag: &[u8]) -> Result<String> {
        Ok(self
            .attr_opt(e.attributes(), name)?
            .ok_or_else(|| missing_attr_err(name, tag, self.line_and_column()))?)
    }
    pub fn id_attr(&self, e: &BytesStart<'_>, tag: &[u8]) -> Result<String> {
        self.attr(e, B_ID, tag)
    }
}
pub struct Reader<B: BufRead> {
    xml_reader: XmlReaderWithContext<B>,
    buf: Vec<u8>,
    buf2: Vec<u8>,
    short_name: Option<String>,
    description: Option<String>,
    byte_length: Option<usize>,
    r#type: Option<String>,
    id: Option<String>,
    sequence_number: Option<usize>,
    r#ref: Option<String>,
    application_id: Option<String>,
    context_id: Option<String>,
    message_type: Option<String>,
    message_info: Option<String>,
}
impl Reader<BufReader<File>> {
    pub fn from_file<P: AsRef<Path>>(path: P) -> Result<Self> {
        Ok(Reader {
            xml_reader: XmlReaderWithContext {
                file_path: path.as_ref().to_owned(),
                xml_reader: XmlReader::from_file(path)?,
            },
            buf: vec![],
            buf2: vec![],
            short_name: None,
            description: None,
            byte_length: None,
            r#type: None,
            id: None,
            sequence_number: None,
            r#ref: None,
            application_id: None,
            context_id: None,
            message_type: None,
            message_info: None,
        })
    }
}
impl<B: BufRead> Reader<B> {
    #[allow(clippy::cognitive_complexity)]
    pub fn read_event(&mut self) -> Result<Event> {
        loop {
            match self.xml_reader.read_event(&mut self.buf)? {
                XmlEvent::Start(ref e) => match e.local_name() {
                    B_PDU => {
                        self.short_name = None;
                        self.byte_length = None;
                        self.r#type = None;
                        self.description = None;
                        return Ok(Event::PduStart {
                            id: self.xml_reader.id_attr(e, B_PDU)?,
                        });
                    }
                    B_SHORT_NAME => {
                        self.short_name =
                            Some(self.xml_reader.read_text(e.name(), &mut self.buf2)?);
                        self.buf2.clear();
                    }
                    B_BYTE_LENGTH => {
                        self.byte_length = Some(self.xml_reader.read_usize(e)?);
                    }
                    B_SIGNAL_INSTANCE => {
                        self.id = Some(self.xml_reader.id_attr(e, B_SIGNAL_INSTANCE)?);
                        self.r#ref = None;
                        self.sequence_number = None;
                    }
                    B_SEQUENCE_NUMBER => {
                        self.sequence_number = Some(self.xml_reader.read_usize(e)?)
                    }
                    B_SIGNAL_REF => {
                        self.r#ref = Some(self.xml_reader.id_ref_attr(e, B_SIGNAL_REF)?)
                    }
                    B_PDU_TYPE => {
                        self.r#type = Some(self.xml_reader.read_text(e.name(), &mut self.buf2)?);
                        self.buf2.clear();
                    }
                    B_FRAME_TYPE => {
                        self.r#type = Some(self.xml_reader.read_text(e.name(), &mut self.buf2)?);
                        self.buf.clear();
                    }
                    B_FRAME => {
                        self.short_name = None;
                        self.byte_length = None;
                        self.r#type = None;
                        return Ok(Event::FrameStart {
                            id: self.xml_reader.id_attr(e, B_PDU)?,
                        });
                    }
                    B_PDU_INSTANCE => {
                        self.id = Some(self.xml_reader.id_attr(e, B_PDU_INSTANCE)?);
                        self.r#ref = None;
                        self.sequence_number = None;
                    }
                    B_PDU_REF => self.r#ref = Some(self.xml_reader.id_ref_attr(e, B_PDU_REF)?),
                    B_MANUFACTURER_EXTENSION => {
                        self.application_id = None;
                        self.context_id = None;
                        self.message_info = None;
                        self.message_type = None;
                    }
                    B_APPLICATION_ID => {
                        self.application_id =
                            Some(self.xml_reader.read_text(e.name(), &mut self.buf2)?);
                    }
                    B_CONTEXT_ID => {
                        self.context_id =
                            Some(self.xml_reader.read_text(e.name(), &mut self.buf2)?);
                    }
                    B_MESSAGE_INFO => {
                        self.message_info =
                            Some(self.xml_reader.read_text(e.name(), &mut self.buf2)?);
                    }
                    B_MESSAGE_TYPE => {
                        self.message_type =
                            Some(self.xml_reader.read_text(e.name(), &mut self.buf2)?);
                    }
                    B_DESC => {
                        self.description =
                            Some(self.xml_reader.read_text(e.name(), &mut self.buf2)?);
                    }
                    _ => {}
                },
                XmlEvent::Empty(ref e) => match e.local_name() {
                    B_SIGNAL_REF => {
                        self.r#ref = Some(self.xml_reader.id_ref_attr(e, B_SIGNAL_REF)?)
                    }
                    B_PDU_REF => self.r#ref = Some(self.xml_reader.id_ref_attr(e, B_PDU_REF)?),
                    _ => {}
                },
                XmlEvent::End(ref e) => match e.local_name() {
                    B_PDU => {
                        return Ok(Event::PduEnd {
                            short_name: mem::replace(&mut self.short_name, None),
                            description: mem::replace(&mut self.description, None),
                            byte_length: mem::replace(&mut self.byte_length, None).ok_or_else(
                                || {
                                    missing_tag_err(
                                        B_BYTE_LENGTH,
                                        B_PDU,
                                        self.xml_reader.line_and_column(),
                                    )
                                },
                            )?,
                        })
                    }
                    B_SIGNAL_INSTANCE => {
                        return Ok(Event::SignalInstance {
                            id: mem::replace(&mut self.id, None).ok_or_else(|| {
                                missing_attr_err(
                                    B_ID,
                                    B_SIGNAL_INSTANCE,
                                    self.xml_reader.line_and_column(),
                                )
                            })?,
                            sequence_number: mem::replace(&mut self.sequence_number, None)
                                .ok_or_else(|| {
                                    missing_tag_err(
                                        B_SEQUENCE_NUMBER,
                                        B_SIGNAL_INSTANCE,
                                        self.xml_reader.line_and_column(),
                                    )
                                })?,
                            signal_ref: mem::replace(&mut self.r#ref, None).ok_or_else(|| {
                                missing_tag_err(
                                    B_SIGNAL_REF,
                                    B_SIGNAL_INSTANCE,
                                    self.xml_reader.line_and_column(),
                                )
                            })?,
                        })
                    }
                    B_FRAME => {
                        return Ok(Event::FrameEnd {
                            short_name: mem::replace(&mut self.short_name, None).ok_or_else(
                                || {
                                    missing_tag_err(
                                        B_SHORT_NAME,
                                        B_FRAME,
                                        self.xml_reader.line_and_column(),
                                    )
                                },
                            )?,
                            byte_length: mem::replace(&mut self.byte_length, None).ok_or_else(
                                || {
                                    missing_tag_err(
                                        B_BYTE_LENGTH,
                                        B_FRAME,
                                        self.xml_reader.line_and_column(),
                                    )
                                },
                            )?,
                        })
                    }
                    B_PDU_INSTANCE => {
                        return Ok(Event::PduInstance {
                            id: mem::replace(&mut self.id, None).ok_or_else(|| {
                                missing_attr_err(
                                    B_ID,
                                    B_PDU_INSTANCE,
                                    self.xml_reader.line_and_column(),
                                )
                            })?,
                            sequence_number: mem::replace(&mut self.sequence_number, None)
                                .ok_or_else(|| {
                                    missing_tag_err(
                                        B_SEQUENCE_NUMBER,
                                        B_PDU_INSTANCE,
                                        self.xml_reader.line_and_column(),
                                    )
                                })?,
                            pdu_ref: mem::replace(&mut self.r#ref, None).ok_or_else(|| {
                                missing_tag_err(
                                    B_PDU_REF,
                                    B_PDU_INSTANCE,
                                    self.xml_reader.line_and_column(),
                                )
                            })?,
                        })
                    }
                    B_MANUFACTURER_EXTENSION => {
                        return Ok(Event::ManufacturerExtension {
                            application_id: mem::replace(&mut self.application_id, None),
                            context_id: mem::replace(&mut self.context_id, None),
                            message_type: mem::replace(&mut self.message_type, None),
                            message_info: mem::replace(&mut self.message_info, None),
                        })
                    }
                    _ => {}
                },
                XmlEvent::Eof => return Ok(Event::Eof),
                _ => {}
            }
            self.buf.clear();
            self.buf2.clear();
        }
    }
}
fn missing_tag_err(tag: &[u8], enclosing_tag: &[u8], line_column: Result<(usize, usize)>) -> Error {
    format_err!(
        "required {} tag is missing for {} at {:?}",
        String::from_utf8_lossy(tag),
        String::from_utf8_lossy(enclosing_tag),
        line_column.unwrap_or((0, 0))
    )
}
fn missing_attr_err(attr: &[u8], tag: &[u8], line_column: Result<(usize, usize)>) -> Error {
    format_err!(
        "required {} attribute is missing for {} at {:?}",
        String::from_utf8_lossy(attr),
        String::from_utf8_lossy(tag),
        line_column.unwrap_or((0, 0))
    )
}
