import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import { getAuthOrThrow } from './app';
import { createUserProfile, getUserProfile } from './users';
import { MIN_PASSWORD_LENGTH, USERNAME_EMAIL_DOMAIN, USERNAME_PATTERN } from '../config';

export function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@${USERNAME_EMAIL_DOMAIN}`;
}

/** Devuelve un mensaje de error si el usuario no es válido, o null. */
export function validateUsername(username: string): string | null {
  const u = username.trim();
  if (!u) return 'Escribe un nombre de usuario.';
  if (u.length < 3) return 'El usuario debe tener al menos 3 caracteres.';
  if (u.length > 20) return 'El usuario puede tener máximo 20 caracteres.';
  if (!USERNAME_PATTERN.test(u)) {
    return 'Usa sólo letras, números, punto, guion o guion bajo (sin espacios ni tildes).';
  }
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) return 'Escribe una contraseña.';
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }
  return null;
}

export async function register(username: string, password: string): Promise<User> {
  const auth = getAuthOrThrow();
  const cred = await createUserWithEmailAndPassword(auth, usernameToEmail(username), password);
  await createUserProfile(cred.user.uid, username.trim());
  return cred.user;
}

export async function login(username: string, password: string): Promise<User> {
  const auth = getAuthOrThrow();
  const cred = await signInWithEmailAndPassword(auth, usernameToEmail(username), password);
  // Si el registro se interrumpió antes de crear el perfil, lo creamos ahora.
  const profile = await getUserProfile(cred.user.uid);
  if (!profile) await createUserProfile(cred.user.uid, username.trim());
  return cred.user;
}

export function logout(): Promise<void> {
  return signOut(getAuthOrThrow());
}
