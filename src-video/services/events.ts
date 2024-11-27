/*
 Copyright (C) 2024 3NSoft Inc.

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

export interface VideoAudioEvents {

  /**
   * Event when peer sends video-audio stream, and it is already available
   * in streams store.
   */
  'va:stream-connected': {
    peerAddr: string;
  };

  /**
   * Event when peer stops video-audio stream, and it is removed from a store.
   */
  'va:disconnected': {
    peerAddr: string;
  };

  'va:peer-ui-state': {
    user: string;
    mic?: 'on' | 'off';
    camera?: 'on' | 'off';
    isInitial?: 'on',
    state?: 'disconnected';
  };

}
