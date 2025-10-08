export type Event = {
  id: string;
  name: string;
  description: string;
  dateTime: string; // ISO string
  organizerId: string;
  position: {
    latitude: number;
    longitude: number;
  };
  imageUrl?: string;
  volunteersNeeded: number;
  volunteersIds: string[];
};
