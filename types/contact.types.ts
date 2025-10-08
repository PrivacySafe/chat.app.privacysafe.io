/*
 Copyright (C) 2020-2025 3NSoft Inc.

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

export interface ContactsService {
  isThereContactWithTheMail(mail: string): boolean;
  getContactByMail(mail: string): Person | undefined;
  getContactList(): Promise<PersonView[]>;
  getContact(id: string): Promise<Person|undefined>;
  insertContact(contact: Person): Promise<void | { errorType: string; errorMessage: string }>;
  upsertContact(contact: Person): Promise<void | { errorType: string; errorMessage: string }>;
  watchContactList(obs: web3n.Observer<PersonView[]>): () => void;
}

export interface PersonView {
  id: string;
  name?: string;
  mail: string;
  avatarMini?: string;
}

export interface PersonActivity {
  id: string;
  type: 'chat' | 'mail';
  description: string;
  timestamp: number;
}

export interface ContactsException extends web3n.RuntimeException {
  type: 'contacts';
  contactAlreadyExists?: true;
  invalidValue?: true;
  failASMailCheck?: true;
}

export interface Person extends PersonView {
  avatar?: string;
  notice?: string;
  phone?: string;
  activities?: string[];
}

