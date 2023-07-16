import { addIcon } from '@iconify/vue'
import { IconifyIcon } from '@iconify/vue/offline'
import outlineChat from '@iconify-icons/ic/outline-chat'
import outlineMail from '@iconify-icons/ic/outline-mail'
import roundPersonOutline from '@iconify-icons/ic/round-person-outline'
import roundPerson from '@iconify-icons/ic/round-person'
import baselineLanguage from '@iconify-icons/ic/baseline-language'
import baselineBrush from '@iconify-icons/ic/baseline-brush'
import baselineEdit from '@iconify-icons/ic/baseline-edit'
import baselineClose from '@iconify-icons/ic/baseline-close'
import baselineArrowDropDown from '@iconify-icons/ic/baseline-arrow-drop-down'
import outlineDelete from '@iconify-icons/ic/outline-delete'
import roundCheck from '@iconify-icons/ic/round-check'
import roundDone from '@iconify-icons/ic/round-done'
import roundDoneAll from '@iconify-icons/ic/round-done-all'
import roundSearch from '@iconify-icons/ic/round-search'
import roundWarning from '@iconify-icons/ic/round-warning'
import roundInfo from '@iconify-icons/ic/round-info'
import roundAddCircleOutline from '@iconify-icons/ic/round-add-circle-outline'
import roundRefresh from '@iconify-icons/ic/round-refresh'
import roundReportGmailErrorred from '@iconify-icons/ic/round-report-gmailerrorred'
import baselineEmoticon from '@iconify-icons/ic/baseline-insert-emoticon'
import baselineAttachFile from '@iconify-icons/ic/baseline-attach-file'
import baselineSend from '@iconify-icons/ic/baseline-send'
import outlineAccountCircle from '@iconify-icons/ic/outline-account-circle'
import baselineSystemUpdateAlt from '@iconify-icons/ic/baseline-system-update-alt'
import outlineCleaningServices from '@iconify-icons/ic/outline-cleaning-services'
import outlineEdit from '@iconify-icons/ic/outline-edit'
import outlineLogout from '@iconify-icons/ic/outline-logout'
import outlineInfo from '@iconify-icons/ic/outline-info'
import baselineReply from '@iconify-icons/ic/baseline-reply'
import roundContentCopy from '@iconify-icons/ic/round-content-copy'
import outlineDownloadForOffline from '@iconify-icons/ic/outline-download-for-offline'

const icons: Record<string, IconifyIcon> = {
  'baseline-close': baselineClose,
  'outline-chat': outlineChat,
  'outline-mail': outlineMail,
  'outline-account-circle':outlineAccountCircle,
  'round-person-outline': roundPersonOutline,
  'round-person': roundPerson,
  'baseline-language': baselineLanguage,
  'baseline-brush': baselineBrush,
  'baseline-edit': baselineEdit,
  'outline-edit': outlineEdit,
  'baseline-arrow-drop-down': baselineArrowDropDown,
  'outline-delete': outlineDelete,
  'round-check': roundCheck,
  'round-done': roundDone,
  'round-done-all': roundDoneAll,
  'round-search': roundSearch,
  'round-warning': roundWarning,
  'round-info': roundInfo,
  'round-add-circle-outline': roundAddCircleOutline,
  'round-refresh': roundRefresh,
  'round-report-gmailerrorred': roundReportGmailErrorred,
  'baseline-emoticon': baselineEmoticon,
  'baseline-attach-file': baselineAttachFile,
  'baseline-send': baselineSend,
  'baseline-system-update-alt': baselineSystemUpdateAlt,
  'outline-cleaning-services': outlineCleaningServices,
  'outline-logout': outlineLogout,
  'outline-info': outlineInfo,
  'baseline-reply': baselineReply,
  'round-content-copy': roundContentCopy,
  'outline-download-for-offline': outlineDownloadForOffline,
}

export function iconsInitialization() {
  console.info('\n--- ICONS INITIALIZATION ---\n')

  Object.keys(icons).forEach(name => {
    addIcon(name, icons[name])
  })
}
