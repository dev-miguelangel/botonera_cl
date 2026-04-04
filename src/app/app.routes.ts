import { Routes } from '@angular/router';
import { authGuard } from './core/auth-guard';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/landing/landing').then(m => m.Landing) },
  { path: 'login', loadComponent: () => import('./pages/login/login').then(m => m.Login) },
  { path: 'auth/callback', loadComponent: () => import('./pages/auth-callback/auth-callback').then(m => m.AuthCallback) },
  { path: 'dashboard', loadComponent: () => import('./pages/dashboard/dashboard').then(m => m.Dashboard), canActivate: [authGuard] },
  { path: 'create', loadComponent: () => import('./pages/create/create').then(m => m.Create), canActivate: [authGuard] },
  { path: 'button/:slug', loadComponent: () => import('./pages/button/button').then(m => m.ButtonPage), canActivate: [authGuard] },
  { path: 'join/:token', loadComponent: () => import('./pages/join/join').then(m => m.Join), canActivate: [authGuard] },
  { path: '**', redirectTo: '' },
];
