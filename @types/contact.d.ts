interface PersonView {
  id: string;
  name?: string;
  mail: string;
  avatarMini?: string;
}

interface PersonActivity {
  id: string;
  type: 'chat' | 'mail';
  description: string;
  timestamp: number;
}

interface Person extends PersonView {
  avatar?: string;
  notice?: string;
  phone?: string;
  activities?: string[];
}

type ContactContent = Omit<Person, 'id'|'avatar'|'avatarMini'|'activities'>
