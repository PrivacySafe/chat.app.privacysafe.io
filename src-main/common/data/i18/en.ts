/*
 Copyright (C) 2026 3NSoft Inc.

 This program is free software: you can redistribute it and/or modify it under
 the terms of the GNU General Public License as published by the Free Software
 Foundation, either version 3 of the License, or (at your option) any later
 version.

 This program is distributed in the hope that it will be useful, but
 WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 See the GNU General Public License for more details.

 You should have received a copy of the GNU General Public License along with
 this program. If not, see <http://www.gnu.org/licenses/>.
*/

export const en = {
  app: {
    title: 'Chat',
    status: {
      label: 'Status',
      connected: {
        online: 'online',
        offline: 'offline',
      },
    },
    exit: 'Exit',
    ok: 'Ok',
    text: {
      new: 'New',
      close: 'Close',
      back: 'Back',
      next: 'Next',
      create: 'Create',
      delete: 'Delete',
      dropzone_default: 'Upload',
      msg_sender: {
        you: 'You',
      },
      send: {
        file: 'file(s) sent',
      },
      receive: {
        file: 'file(s) received',
      },
    },
    notification: {
      new_message: '{sender} sent you a message',
      invite: '{sender} invites you',
    },
  },

  contacts: {
    list: { empty: 'Contact not found' },
  },

  chat: {
    months: 'months',
    days: 'days',
    hours: 'hours',
    minutes: 'minutes',
    seconds: 'seconds',
    total: 'Total',
    creating: {
      attachments: {
        remove: {
          all: 'Remove all attachments',
        },
      },
    },
    action: {
      menu: {
        txt: {
          info: 'Chat Info',
          rename: 'Rename Chat',
          history: {
            export: 'Export History',
            clean: 'Clear History',
          },
          close: 'Close Chat',
          timer: {
            label: 'Auto-delete Messages',
            '0': 'off',
            '1': '1 year',
            '2': '1 month',
            '3': '1 week',
            '4': '1 day',
            '5': '1 hour',
          },
          leave: 'Leave and Delete Chat',
        },
      },
    },
    create: {
      dialog: {
        title: 'Create new',
        selected: {
          contacts: 'Selected Members',
        },
      },
      group: {
        name: {
          label: 'Group Name',
        },
      },
    },
    content: {
      empty: 'Select a Chat to Start Messaging',
    },
    header: {
      info: 'Last post on {date}',
      call: {
        duration: 'Call duration',
      },
      btn: {
        actions: 'Actions',
      },
    },
    dialog: {
      info: {
        title: 'Chat Info',
        auto_delete: {
          off: 'Auto-delete messages is OFF',
          txt: 'Messages in this chat will be automatically deleted after {period} from the date of sending/receiving',
        },
        users: 'Users',
        search_placeholder: 'User name',
        btn: {
          edit_members: 'Edit User List',
          back: 'Back',
          close: 'Close',
          update: 'Update',
        },
        user: {
          pending: 'Pending',
          admin: 'Admin',
        },
      },
      clean_history: {
        title: 'Clear Chat History',
      },
      export: {
        title: 'Export chat history',
      },
      rename: {
        title: 'Rename chat',
        input_placeholder: 'Enter chat name',
        btn: 'Rename',
      },
      delete: {
        title: 'Delete Chat',
        btn: 'Delete',
        text: 'Delete chat {chatName} ?',
      },
    },
    info: {
      user: {
        menu: {
          make_admin: 'Make an Admin',
          remove_admin: 'Remove from Admin',
        },
      },
    },
    app_message: {
      success: {
        export: 'The file {file} is saved.',
      },
      error: {
        export: 'Error on saving file {file}.',
        members_update: 'Error while editing chat member list',
        load_file: 'The file you are downloading may have been deleted or moved.',
      },
    },
    message: {
      dialog: {
        delete: {
          title: 'Delete Message',
          text: 'Delete selected message?',
          additional_text: 'Delete for everyone?',
          error: 'An error occurred while deleting the selected message',
        },
        forward: {
          title: 'Forward Message',
          section: {
            chats: {
              title: 'Chats',
              empty: 'No chats to choose from',
            },
            contacts: {
              title: 'Contacts',
              empty: 'No contacts to choose from',
            },
          },
        },
        attachments_download: {
          title: 'Select a folder for downloading',
        },
        file_download: {
          title: 'Save the file',
        },
        folder_download: {
          title: 'Save the folder',
        },
      },
      input: {
        placeholder: {
          one_to_one: 'Write a message ...',
          group: 'Write a message to Group ...',
        },
      },
      menu: {
        reaction: 'Reaction',
        reply: 'Reply',
        copy: 'Copy',
        forward: 'Forward',
        edit: 'Edit',
        download: 'Download',
        resend: 'Resend',
        select: 'Select',
        info: 'Information',
        delete_message: 'Delete',
        cancel_sending: 'Cancel Sending',
      },
      label: {
        forward: 'Forwarded from',
        edit: 'Edit message:',
        unread: 'Unread messages - {messages}',
        changed: 'changed',
      },
      action_message: {
        success: {
          clipboard_copy: 'The message content was copied to clipboard',
          file_download: 'The files/folders are saved successfully',
        },
        error: {
          delete: 'An error occurred while deleting the selected message',
          file_notfound: 'The file may have been deleted or moved',
          file_download: 'The downloaded files/folders may have been deleted or moved',
        },
      },
      btn: {
        open: {
          file: 'Open file',
          folder: 'Open folder',
        },
      },
      info: {
        autodelete_off: 'This message will not be automatically deleted',
        removeAfter: 'This message will be automatically deleted in {period}',
        removeAfter_mobile: '{period} left until this message is auto-deleted',
        since: 'since',
        between: 'from {from} to {to}',
        section: {
          text: 'Text',
          reactions: 'Reactions',
          errors: 'Errors',
        },
        label: {
          now: 'Now',
          history: 'History',
          state: 'state',
        },
        text: {
          no_changes: 'There are no changes',
          no_body: 'The message does not contain a text',
          no_reactions: 'The message does not contain reactions',
          no_errors: 'The message contains no errors',
        },
        error: {
          unknownRecipient: 'unknown recipient',
          msgTooBig: 'this message is bigger than allowed',
          inboxIsFull: 'mailbox of this recipient is full',
          domainNotFound: 'this domain is not found',
          noServiceRecord: 'this domain does not support 3N',
          recipientPubKeyFailsValidation: 'the public key is not valid',
          connectError: 'cannot connect',
          noDescription: 'No description',
        },
      },
    },
    messages: {
      selected: 'Selected',
      bulk: {
        delete: 'Delete selected messages',
        exit: 'Exit bulk actions mode',
      },
      info_message: {
        autodelete: {
          set_you: 'You have set the auto-delete message timer to {value}',
          set_user: 'The {user} has set the auto-delete message timer to {value}',
          unset_you: 'You have disabled the auto-delete message timer',
          unset_user: 'The {user} has disabled the auto-delete message timer',
        },
      },
    },
    system_message: {
      rename_chat: 'The chat was renamed by',
      member_left: '{member} left this chat',
      you_are_removed: '{admin} has removed you from this chat',
      chat_deleted: '{admin} has removed this chat',
      add_members: '{admin} added {membersToAdd} to this chat, to total of {participantsNum} participants',
      add_admins: '{admin} added {adminsToAdd} to admins in this chat',
      remove_members:
        '{admin} removed {membersToDelete} from this chat, to total of {participantsNum} participants',
      remove_me: '{admin} removed me from this chat',
      remove_admins: '{admin} removed {adminsToDelete} from admins in this chat',
      add_and_remove_members:
        '{admin} removed {membersToDelete} from this chat and added {membersToAdd}, to total of {participantsNum} participants',
      add_and_remove_admins: '{admin} removed {adminsToDelete} from admins in this chat and added {adminsToAdd}',
    },
    invitation: {
      btn: {
        deny: 'Deny',
        accept: 'Accept',
      },
      message: {
        oto: {
          incoming: 'Sender with address {sender} invites you to join chat.',
          accepted: 'Sender with address {sender} invited you to join chat.',
          incoming_from_unknown: 'Unknown sender with address {sender} invites you to join chat.',
          accepted_from_unknown: 'Unknown sender with address {sender} invited you to join chat.',
          sent: 'You initiated this one-to-one chat. Messaging will be possible when other side accepts the invitation.',
        },
        group: {
          incoming: 'Sender with address {sender} invites you to join this group chat.',
          accepted: 'Sender with address {sender} invited you to join this group chat.',
          incoming_from_unknown: 'Unknown sender with address {sender} invites you to join this group chat.',
          accepted_from_unknown: 'Unknown sender with address {sender} invited you to join this group chat.',
          sent: 'You invited {members} to this group chat. Messaging will be possible when at least one of peers accepts the invitation.',
        },
        default: {
          accepted: '{name} accepted invitation to join chat.',
          sent: 'You accepted invitation to join this chat.',
        },
      },
      tooltip: {
        oto: {
          incoming_from_unknown: 'By clicking on the address {address} you will add it to your contact list',
        },
      },
    },
    viewer: {
      btn: {
        download: 'Download file',
        exit: 'Exit viewing',
        pdf: {
          prev: 'Previous page',
          next: 'Next page',
        },
      },
      label: {
        page: 'Page',
      },
      tooltip: {
        play: 'Play',
        pause: 'Pause',
        visual_setting: 'Visualization setting',
      },
    },
  },

  dialog: {
    title: {
      default: '',
    },
    button: {
      default: {
        cancel: 'Cancel',
      },
    },
    text: {
      confirmation: 'Are you sure?',
    },
  },

  validation: {
    text: {
      required: 'This field is required',
      length: 'No more then {length} characters',
      unknownRecipient: '{addr} is unknown address or is not present at the domain',
      inboxIsFull: 'The mailbox of {addr} is full',
      senderNotAllowed: 'An access restricted to address {addr}',
      recipientPubKeyFailsValidation: 'The public key for {addr} is not valid',
      serviceLocating: 'No service for the domain at {addr}',
      unknown: 'A network error for {addr} address',
    },
  },

  va: {
    btn: {
      end_call: 'End Call',
    },
    text: {
      call_in_progress: 'The call is on since',
      call_started: 'The call has started',
      incoming_call: 'The incoming call from {sender}',
      incoming_call_cancelled: 'The incoming call from {sender} was cancelled',
      incoming_call_cancelled_by: 'The incoming call from {sender} was cancelled by {user}',
      incoming_call_not_accepted: `{user} hasn't accepted the current call`,
      missed_incoming_call: 'The missed incoming call from {sender}',
      outgoing_call: 'The outgoing call',
      outgoing_call_cancelled: 'The outgoing call was cancelled',
      outgoing_call_cancelled_by: 'The outgoing call was cancelled by {user}',
      user_left_call: '{user} left the call',
      participants: 'Participants',
    },
    setup: {
      title: 'Call Setup',
      notification: {
        no_cameras: 'No video cameras available',
      },
      tooltip: {
        mute: 'Mute',
        unmute: 'Unmute',
        camera_off: 'Turn off the camera',
        camera_on: 'Turn on the camera',
        camera_select: 'Select WEB-cam',
      },
    },
    presettings: {
      incoming_call: 'Incoming Call from {address}',
      btn: {
        start: 'Start Call',
        join: 'Join',
        decline: 'Decline',
      },
    },
  },

  call: {
    tooltip: {
      fullscreen_mode_enable: 'Enable full-screen mode',
      fullscreen_mode_disable: 'Disable full-screen mode',
      screenshare_mode_row: 'Switch to horizontal view mode',
      screenshare_mode_column: 'Switch to vertical view mode',
      mic_on: 'Turn on the microphone',
      mic_off: 'Turn off the microphone',
      camera_on: 'Turn on the camera',
      camera_off: 'Turn off the camera',
      sharing_on: 'Open screen sharing settings',
      participants_info: 'The call participants info',
    },
    sharing: {
      title: 'Select to Share',
      desktop_sound: 'Desktop sound',
      settings: {
        sound_share: 'Share sound',
        screens_title: 'Screens',
        windows_title: 'Windows',
      },
    },
  },
};
