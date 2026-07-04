use std::{env, fs, path::PathBuf};

const RT_ICON: u16 = 3;
const RT_GROUP_ICON: u16 = 14;
const MAIN_ICON_ID: u16 = 1;
const LANGUAGE_EN_US: u16 = 0x0409;
const RESOURCE_FLAGS: u16 = 0x1030;

pub fn embed_app_icon(bin_name: &str, icon_path: &str) {
    println!("cargo:rerun-if-changed={icon_path}");

    if env::var("CARGO_CFG_TARGET_OS").as_deref() != Ok("windows") {
        return;
    }

    let manifest_dir = PathBuf::from(
        env::var_os("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR should be set by Cargo"),
    );
    let out_dir = PathBuf::from(env::var_os("OUT_DIR").expect("OUT_DIR should be set by Cargo"));
    let icon = fs::read(manifest_dir.join(icon_path)).expect("failed to read Windows app icon");
    let resource = windows_icon_resource(&icon).expect("failed to build Windows icon resource");
    let resource_path = out_dir.join("chipmunk.res");

    fs::write(&resource_path, resource).expect("failed to write Windows icon resource");
    println!(
        "cargo:rustc-link-arg-bin={bin_name}={}",
        resource_path.display()
    );
}

fn windows_icon_resource(icon: &[u8]) -> Result<Vec<u8>, String> {
    let entries = parse_icon_entries(icon)?;
    let mut resource = Vec::new();

    write_empty_resource_header(&mut resource);

    let mut group = Vec::with_capacity(6 + entries.len() * 14);
    write_u16(&mut group, 0);
    write_u16(&mut group, 1);
    write_u16(&mut group, entries.len() as u16);

    for entry in entries.iter() {
        resource_record(&mut resource, RT_ICON, entry.id, &icon[entry.image_range()]);

        group.extend_from_slice(&[entry.width, entry.height, entry.color_count, entry.reserved]);
        write_u16(&mut group, entry.planes);
        write_u16(&mut group, entry.bit_count);
        write_u32(&mut group, entry.bytes_in_res);
        write_u16(&mut group, entry.id);
    }

    resource_record(&mut resource, RT_GROUP_ICON, MAIN_ICON_ID, &group);

    Ok(resource)
}

#[derive(Debug)]
struct IconEntry {
    id: u16,
    width: u8,
    height: u8,
    color_count: u8,
    reserved: u8,
    planes: u16,
    bit_count: u16,
    bytes_in_res: u32,
    image_offset: u32,
}

impl IconEntry {
    fn image_range(&self) -> std::ops::Range<usize> {
        let start = self.image_offset as usize;
        let end = start + self.bytes_in_res as usize;
        start..end
    }
}

fn parse_icon_entries(icon: &[u8]) -> Result<Vec<IconEntry>, String> {
    if icon.len() < 6 {
        return Err("icon header is too small".to_string());
    }

    if read_u16(icon, 0) != 0 || read_u16(icon, 2) != 1 {
        return Err("icon file is not an ICO image".to_string());
    }

    let count = read_u16(icon, 4) as usize;
    if count == 0 {
        return Err("icon file does not contain any images".to_string());
    }

    let directory_len = 6 + count * 16;
    if icon.len() < directory_len {
        return Err("icon directory is truncated".to_string());
    }

    let mut entries = Vec::with_capacity(count);
    for index in 0..count {
        let offset = 6 + index * 16;
        let entry = IconEntry {
            id: index as u16 + 1,
            width: icon[offset],
            height: icon[offset + 1],
            color_count: icon[offset + 2],
            reserved: icon[offset + 3],
            planes: read_u16(icon, offset + 4),
            bit_count: read_u16(icon, offset + 6),
            bytes_in_res: read_u32(icon, offset + 8),
            image_offset: read_u32(icon, offset + 12),
        };

        let range = entry.image_range();
        if range.end > icon.len() || range.start >= range.end {
            return Err("icon image data is truncated".to_string());
        }

        entries.push(entry);
    }

    Ok(entries)
}

fn resource_record(resource: &mut Vec<u8>, resource_type: u16, id: u16, data: &[u8]) {
    align_to_4(resource);
    write_u32(resource, data.len() as u32);
    write_u32(resource, 32);
    write_ordinal(resource, resource_type);
    write_ordinal(resource, id);
    write_u32(resource, 0);
    write_u16(resource, RESOURCE_FLAGS);
    write_u16(resource, LANGUAGE_EN_US);
    write_u32(resource, 0);
    write_u32(resource, 0);
    resource.extend_from_slice(data);
    align_to_4(resource);
}

fn write_empty_resource_header(resource: &mut Vec<u8>) {
    write_u32(resource, 0);
    write_u32(resource, 32);
    write_ordinal(resource, 0);
    write_ordinal(resource, 0);
    write_u32(resource, 0);
    write_u16(resource, 0);
    write_u16(resource, 0);
    write_u32(resource, 0);
    write_u32(resource, 0);
}

fn write_ordinal(resource: &mut Vec<u8>, value: u16) {
    write_u16(resource, 0xffff);
    write_u16(resource, value);
}

fn align_to_4(bytes: &mut Vec<u8>) {
    while !bytes.len().is_multiple_of(4) {
        bytes.push(0);
    }
}

fn read_u16(bytes: &[u8], offset: usize) -> u16 {
    u16::from_le_bytes([bytes[offset], bytes[offset + 1]])
}

fn read_u32(bytes: &[u8], offset: usize) -> u32 {
    u32::from_le_bytes([
        bytes[offset],
        bytes[offset + 1],
        bytes[offset + 2],
        bytes[offset + 3],
    ])
}

fn write_u16(bytes: &mut Vec<u8>, value: u16) {
    bytes.extend_from_slice(&value.to_le_bytes());
}

fn write_u32(bytes: &mut Vec<u8>, value: u32) {
    bytes.extend_from_slice(&value.to_le_bytes());
}
