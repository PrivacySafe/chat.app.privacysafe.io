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
export const MSG_REMOVAL_DELAY_MILLIS = 10 * 1000;

export const RTC_STATIC_CONFIG: RTCConfiguration = {
  iceServers: [
    {
      urls: ['stun:t1.3nweb.net:443'],
    },
    {
      urls: ['turns:t1.3nweb.net:443'],
      username: 'chat-app',
      credential: 'WLIvWVDTrxHpy78GknE6tNsNiqjNNFU5mN4qSUU',
    },
  ],
  iceTransportPolicy: 'all',
};
