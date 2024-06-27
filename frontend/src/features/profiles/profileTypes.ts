
export interface User {
  id: number;
  username: string;
}


export interface AcceptedCrypto {
  id: number;
  name: string;
  code: string;
  address: string;
}

export interface Profile {
  id: number;
  user: User;
  interests: string;
  profile_description: string;
  timezone: string;
  is_teacher: boolean;
  profile_picture: string | null;
  email_confirmed: boolean;
  green_diamonds: number;
  yellow_diamonds: number;
  purple_diamonds: number;
  blue_diamonds: number;
  cryptos_list: AcceptedCrypto[];
}
