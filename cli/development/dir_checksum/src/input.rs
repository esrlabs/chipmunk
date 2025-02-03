use std::{
    fs::File,
    io::{self, Read},
    path::Path,
};

use crate::HashError;

pub(crate) enum Input {
    Mmap(io::Cursor<memmap2::Mmap>),
    File(File),
}

impl Input {
    pub(crate) fn open(path: &Path) -> Result<Self, HashError> {
        let file = File::open(path)?;
        if let Some(mmap) = maybe_memmap_file(&file)? {
            log::trace!("File: '{}' will be handled as Mmap file", path.display());

            return Ok(Self::Mmap(io::Cursor::new(mmap)));
        }

        Ok(Self::File(file))
    }

    pub(crate) fn hash(&mut self, base_hasher: &blake3::Hasher) -> Result<blake3::Hash, HashError> {
        let mut hasher = base_hasher.clone();
        match self {
            // The fast path: If we mmapped the file successfully, hash using
            // multiple threads.
            Self::Mmap(cursor) => {
                hasher.update_rayon(cursor.get_ref());
            }
            // The slower paths, for files we didn't/couldn't mmap.
            // This is currently all single-threaded. Doing multi-threaded
            // hashing without memory mapping is tricky, since all your worker
            // threads have to stop every time you refill the buffer, and that
            // ends up being a lot of overhead. To solve that, we need a more
            // complicated double-buffering strategy where a background thread
            // fills one buffer while the worker threads are hashing the other
            // one. We might implement that in the future, but since this is
            // the slow path anyway, it's not high priority.
            Self::File(file) => {
                copy_wide(file, &mut hasher)?;
            }
        }
        Ok(hasher.finalize())
    }
}

// Mmap a file, if it looks like a good idea. Return None in cases where we
// know mmap will fail, or if the file is short enough that mmapping isn't
// worth it. However, if we do try to mmap and it fails, return the error.
fn maybe_memmap_file(file: &File) -> Result<Option<memmap2::Mmap>, HashError> {
    let metadata = file.metadata()?;
    let file_size = metadata.len();
    let map = if !metadata.is_file() {
        // Not a real file.
        None
    } else if file_size > isize::MAX as u64 {
        // Too long to safely map.
        // https://github.com/danburkert/memmap-rs/issues/69
        None
    } else if file_size < 16 * 1024 {
        // Mapping small files is not worth it.
        None
    } else {
        // Explicitly set the length of the memory map, so that file system
        // changes can't race to violate the invariants we just checked.
        //
        //
        // ## Safety
        //
        // All file-backed memory map constructors are marked `unsafe` because of the potential for
        // *Undefined Behavior* using the map if the underlying file is subsequently modified, in or
        // out of process.
        // Memory map will be used here for a very short time only while calculating the hash. It's
        // unlikely that the files will be changed at the same time, and in that case it's the
        // responsibility of the user of this library to unsure that the files aren't changed from
        // different process while calling this methods from this library.
        let map = unsafe {
            memmap2::MmapOptions::new()
                .len(file_size as usize)
                .map(file)?
        };

        Some(map)
    };

    Ok(map)
}

// A 16 KiB buffer is enough to take advantage of all the SIMD instruction sets
// that we support, but `std::io::copy` currently uses 8 KiB. Most platforms
// can support at least 64 KiB, and there's some performance benefit to using
// bigger reads, so that's what we use here.
fn copy_wide(mut reader: impl Read, hasher: &mut blake3::Hasher) -> io::Result<u64> {
    let mut buffer = [0; 65536];
    let mut total = 0;
    loop {
        match reader.read(&mut buffer) {
            Ok(0) => return Ok(total),
            Ok(n) => {
                hasher.update(&buffer[..n]);
                total += n as u64;
            }
            Err(ref e) if e.kind() == io::ErrorKind::Interrupted => continue,
            Err(e) => return Err(e),
        }
    }
}
