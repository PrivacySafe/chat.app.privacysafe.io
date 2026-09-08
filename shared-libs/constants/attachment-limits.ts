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

/**
 * The biggest attachment this app is willing to take.
 *
 * It is also what the background component asks its own server to accept from
 * anonymous senders, so that what we send and what we can be sent agree. The
 * recipient's server has the final say: delivery fails with `msgTooBig` when
 * the message does not fit what that server allows.
 */
export const MAX_ATTACHMENT_SIZE = 200 * 1024 * 1024;

/**
 * Attachments up to this size are copied into the app's file store when the
 * message is sent, and the copy is what goes into the message.
 *
 * Two things follow from the copy. The sender's own message keeps a readable
 * attachment even after they move, rename or delete the file they attached -
 * without it the message record holds a link to nothing. And delivery, which
 * reads attachments lazily and long after the message was queued, reads the
 * copy instead of a file the user is free to change under it.
 *
 * Above this size the file is left where it is and only referenced: duplicating
 * a big file costs more than the risk it removes. Such an attachment is only as
 * good as the user's own file.
 */
export const ATTACHMENT_COPY_THRESHOLD = 20 * 1024 * 1024;
