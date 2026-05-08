export interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: any; // Firestore Timestamp
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'audio';
  isOptimistic?: boolean;
}

export interface Chat {
  id: string;
  participants: string[];
  isSupportChat: boolean;
  lastMessage: string;
  updatedAt: any;
}
