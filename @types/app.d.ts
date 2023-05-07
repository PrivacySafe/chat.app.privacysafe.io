/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/ban-types */
type IncomingMessage = web3n.asmail.IncomingMessage
type OutgoingMessage = web3n.asmail.OutgoingMessage
type MsgInfo = web3n.asmail.MsgInfo
type AttachmentsContainer = web3n.asmail.AttachmentsContainer

type FS = web3n.files.FS
type FileW = web3n.files.File
type FileException = web3n.files.FileException

type ReadonlyFS = web3n.files.ReadonlyFS
type WritableFS = web3n.files.WritableFS
type WritableVersionedFS = web3n.files.WritableFS
type FSCollection = web3n.files.FSCollection
type FSItem = web3n.files.FSItem
type ListingEntry = web3n.files.ListingEntry
type ReadonlyFile = web3n.files.ReadonlyFile
type SymLink = web3n.files.SymLink

type ByteSource = web3n.files.FileByteSource
type ByteSink = web3n.files.FileByteSink
type FolderEvent = web3n.files.FolderEvent
type SelectCriteria = web3n.files.SelectCriteria

interface EventBus {
  on: (type: string|symbol, handler: Function) => void;
  off: (type: string|symbol, handler?: Function) => void;
  emit:(type: string|symbol, arguments?: any) => void;
  once: (type: string|symbol, handler: Function) => void;
  clear: () => void;
}

interface UserStatus {
  code: number;
  description: string;
}

type AvailableLanguages = 'en'
type AvailableColorThemes = 'default' | 'dark'

interface AppConfig {
  lang: AvailableLanguages;
  currentTheme: AvailableColorThemes;
  colors: Record<string, string>;
}

interface AppConfigs {
  getCurrentLanguage: () => Promise<AvailableLanguages>;
  getCurrentColorTheme: () => Promise<{currentTheme: AvailableColorThemes, colors: Record<string, string> }>;
  watchConfig(obs: web3n.Observer<AppConfig>): () => void;
}

interface DeliveryServiceData {
  lastReceivedMessageTimestamp: number;
}

interface AppDeliveryService {
  watchIncomingMessages(obs: web3n.Observer<ChatIncomingMessage>): () => void;
  watchOutgoingMessages(obs: web3n.Observer<{id: string, progress: web3n.asmail.DeliveryProgress}>): () => void;
}
