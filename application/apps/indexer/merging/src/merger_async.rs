use crate::merger::{FileLogEntryProducer, FileMergeOptions, IndexOutput};
use crossbeam_channel as cc;
use futures::{
    pin_mut,
    stream::{Peekable, StreamExt},
};
use indexer_base::{
    chunks::ChunkResults, error_reporter::*, progress::IndexingProgress, timedline::*, utils,
};
use processor::parse::lookup_regex_for_format_str;
use std::{
    fs::File,
    iter::Iterator,
    path::{Path, PathBuf},
};
use tokio_util::sync::CancellationToken;

pub(crate) async fn _merge_inputs_with_writer_async(
    parent_dir: Option<&Path>,
    writer: &mut IndexOutput,
    merger_inputs: Vec<FileMergeOptions>,
    update_channel: cc::Sender<ChunkResults>,
    shutdown_token: Option<CancellationToken>,
) -> Result<()> {
    trace!("merge_inputs_with_writer ({} files)", merger_inputs.len());
    let mut lines_with_year_missing = 0usize;
    // create a peekable iterator for all file inputs
    let mut log_entry_streams: Vec<Peekable<FileLogEntryProducer>> = merger_inputs
        .into_iter()
        .map(
            |input: FileMergeOptions| -> Result<Peekable<FileLogEntryProducer>> {
                let file_path = PathBuf::from(input.path);
                let absolute_path = match parent_dir {
                    Some(dir) if !file_path.is_absolute() => PathBuf::from(&dir).join(file_path),
                    _ => file_path,
                };
                let x = FileLogEntryProducer::new(
                    File::open(absolute_path)?,
                    input.tag,
                    lookup_regex_for_format_str(&input.format)?,
                    input.year,
                    input.offset,
                    writer.line_nr,
                )?;
                Ok(x.peekable())
            },
        )
        .filter_map(Result::ok) // TODO better error handling
        .collect();
    let mut stopped = false;
    loop {
        if stopped {
            info!("we where stopped while merging");
            break;
        }
        // keep track of the min timestamp together with the index of the file it belongs to
        // to do this, we peek an entry of each reader and of all those entries we
        // find the minimum timestamp entry
        let mut minimum: Option<(i64, usize)> = None;
        for (i, iter) in log_entry_streams.iter().enumerate() {
            let p: &Peekable<FileLogEntryProducer> = iter;
            pin_mut!(p);
            // if let Some(Ok(Some(entry))) = p.as_mut().peek().await {
            //     match minimum {
            //         Some((t_min, _)) => {
            //             if entry.timestamp < t_min {
            //                 minimum = Some((entry.timestamp, i));
            //             }
            //         }
            //         None => {
            //             minimum = Some((entry.timestamp, i));
            //         }
            //     }
            //     if entry.year_was_missing {
            //         lines_with_year_missing += 1
            //     }
            // }
        }
        if let Some((_, min_index)) = minimum {
            // we found an entry with a minimal timestamp
            if let Some(Ok(Some(line))) = log_entry_streams[min_index].next().await {
                // important: keep track of how many bytes we processed
                let trimmed_len = line.content.len();
                if trimmed_len > 0 {
                    writer.add_to_chunk(&line.content, &line.tag, line.original_length)?;
                    stopped = utils::check_if_stop_was_requested(shutdown_rx, "merger");
                }
            } else {
                break;
            }
        } else {
            break;
        }
    }
    if stopped {
        debug!("sending IndexingProgress::Stopped");
        update_channel.send(Ok(IndexingProgress::Stopped))?;
    } else {
        if lines_with_year_missing > 0 {
            report_warning(format!(
                "year was missing for {} lines",
                lines_with_year_missing
            ));
        }
        writer.write_rest()?;
    }
    update_channel.send(Ok(IndexingProgress::Finished))?;
    Ok(())
}
mod test {

    use futures::{
        executor::block_on,
        pin_mut,
        stream::{self, Peekable, StreamExt},
    };

    #[derive(PartialEq, Debug)]
    pub struct Item {
        num: usize,
    }
    struct ItemIter {
        content: Vec<Item>,
    }
    impl ItemIter {
        fn new(elems: &[usize]) -> Self {
            ItemIter {
                content: elems.iter().map(|&num| Item { num }).collect(),
            }
        }
    }

    impl Iterator for ItemIter {
        type Item = Item;
        fn next(&mut self) -> Option<Item> {
            self.content.pop()
        }
    }
    pub struct ItemProducer {
        item_iterator: ItemIter,
    }

    impl futures::Stream for ItemProducer {
        type Item = Result<Option<Item>>;
        fn poll_next(
            mut self: std::pin::Pin<&mut Self>,
            _cx: &mut std::task::Context,
        ) -> futures::task::Poll<Option<Self::Item>> {
            let next = self.item_iterator.next();
            match next {
                Some(msg) => futures::task::Poll::Ready(Some(Ok(Some(msg)))),
                None => futures::task::Poll::Ready(Some(Err(anyhow!("no more elements")))),
            }
        }
    }
    #[async_std::test]
    async fn peekable() {
        let iter_1 = ItemIter::new(&[1, 3, 5]);
        let iter_2 = ItemIter::new(&[2, 4, 6]);
        let inputs = vec![iter_1, iter_2];
        let mut item_streams: Vec<Peekable<ItemProducer>> = inputs
            .into_iter()
            .map(|input: ItemIter| -> Result<Peekable<ItemProducer>> {
                let x = ItemProducer {
                    item_iterator: input,
                };
                Ok(x.peekable())
            })
            .filter_map(Result::ok)
            .collect();
        for (i, stream) in item_streams.iter().enumerate() {
            let p: &Peekable<ItemProducer> = stream;
            pin_mut!(p);
        }

        // let (a1, a2, a3) = (Item { num: 1 }, Item { num: 2 }, Item { num: 3 });
        // let (a4, a5, a6) = (Item { num: 4 }, Item { num: 5 }, Item { num: 6 });
        // let peekable: Peekable<_> = stream::iter(vec![a1, a2, a3]).peekable();
        // pin_mut!(peekable);
        // assert_eq!(peekable.as_mut().peek().await.unwrap().num, 1);
        // assert_eq!(
        //     peekable.collect::<Vec<Item>>().await,
        //     vec![Item { num: 1 }, Item { num: 2 }, Item { num: 3 }]
        // );
    }
}
