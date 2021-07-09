#[cfg(test)]
mod tests {

    use crate::dlt_net::{DltMessageDecoder, *};
    use dlt_core::{dlt::Message, parse::DltParseError};
    use tokio::net::UdpSocket;
    use tokio_stream::StreamExt;
    use tokio_util::udp::UdpFramed;

    fn message_without_storage_header() -> Vec<u8> {
        #[rustfmt::skip]
        let content: Vec<u8> = vec![
            // --------------- header
            /* header-type       0b0010 0001 */ 0x21,
            /* extended header        | |||^ */
            /* MSBF: 0  little endian | ||^  */
            /* WEID: 0  no ecu id     | |^   */
            /* WSID: 0  sess id       | ^    */
            /* WTMS: 0 no timestamp   ^      */
            /* version nummber 1   ^^^       */
            /* message counter */ 0x0A,
            /* length = 0 */ 0x00, 0x13,
            // --------------- extended header
            0x41, // MSIN 0b0100 0001 => verbose, MST log, ApplicationTraceType::State
            0x01, // arg count
            0x4C, 0x4F, 0x47, 0x00, // app id LOG
            0x54, 0x45, 0x53, 0x32, // context id TES2
            // --------------- payload
            /* type info 0b0001 0000 => type bool */ 0x10, 0x00, 0x00, 0x00,
             0x6F,
        ];
        content
    }

    async fn send_and_receive(content: &[u8]) -> Result<Option<Vec<Message>>, DltParseError> {
        let socket = UdpSocket::bind("127.0.0.1:0")
            .await
            .expect("could not create sockete");
        let local_addr = socket.local_addr().expect("could not get addr of socket");

        let mut message_stream = UdpFramed::new(
            socket,
            DltMessageDecoder {
                filter_config: None,
                fibex_metadata: None,
            },
        );
        let socket2 = UdpSocket::bind("127.0.0.1:0")
            .await
            .expect("could not create socket2");
        socket2
            .connect(local_addr)
            .await
            .expect("could not connect socket2");
        socket2
            .send(content)
            .await
            .expect("could not send on socket2");
        if let Some(Ok((DltEvent::Messages(msgs), _))) = message_stream.next().await {
            println!("send_and_receive: received {:?}", msgs);
            return Ok(Some(msgs));
        }
        Err(DltParseError::Unrecoverable(
            "did not get a message from udp_msg_producer".to_string(),
        ))
    }

    #[tokio::test]
    async fn test_upd_message_producer() {
        let content = message_without_storage_header();
        match send_and_receive(&content).await {
            Ok(Some(msgs)) => {
                assert_eq!(msgs.len(), 1);
            }
            x => panic!("should have been 1 message but was: {:?}", x),
        }
        let mut double_content = message_without_storage_header();
        double_content.extend(content.clone().iter());
        match send_and_receive(&double_content).await {
            Ok(Some(msgs)) => {
                assert_eq!(msgs.len(), 2);
            }
            x => panic!("should have been 2 messages but was: {:?}", x),
        }
    }
}
