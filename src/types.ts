export interface SessionStatus {
  phone: string;
  hasToken: boolean;
  simulationMode: boolean;
}

export interface Place {
  id: number;
  address: string;
  city: string;
  street: string;
  house: string;
  flat: string;
}

export interface Domofon {
  id: number;
  placeId: number;
  name: string;
  hasCamera: boolean;
  cameraUrl: string;
  status: string;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  source: "Yandex" | "Domru" | "System";
  message: string;
  type: "info" | "success" | "error";
}
