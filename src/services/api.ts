import axios, { AxiosResponse } from 'axios';
import { Event } from '../types/Event';

export const api = axios.create({
  baseURL: 'http://192.168.1.105:3333',
});

// --- Existing (kept for reference if we  later wire auth) ---
export const authenticateUser = (email: string, password: string): Promise<AxiosResponse> => {
  return api.post(`/login`, { email, password });
};

// --- New endpoints for Part 3 assignment ---
export const getEvents = (): Promise<AxiosResponse<Event[]>> => {
  return api.get('/events');
};

export const createEvent = (payload: Event): Promise<AxiosResponse<Event>> => {
  return api.post('/events', payload);
};
