
interface StartNewCallParam1 {
	peers: CallPeer[];
	groupChatId?: string;
}

interface CallPeer {
	callRequestId: number;
	name: string;
	address: string;
}
