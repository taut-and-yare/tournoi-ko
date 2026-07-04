import { browser } from '$app/environment';

const KEY = 'tournoi-ko-admin-secret';
let secret = $state(browser ? localStorage.getItem(KEY) ?? '' : '');

export const admin = {
  get isUnlocked() {
    return secret.length > 0;
  },
  get secret() {
    return secret;
  },
  unlock(value: string) {
    secret = value;
    if (browser) localStorage.setItem(KEY, value);
  },
  lock() {
    secret = '';
    if (browser) localStorage.removeItem(KEY);
  },
  headers(): Record<string, string> {
    return secret ? { 'x-admin-secret': secret } : {};
  }
};
