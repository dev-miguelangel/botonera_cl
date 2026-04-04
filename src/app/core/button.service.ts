import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase';
import { AuthService } from './auth';

export interface Button {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  slug: string;
  press_policy: 'owner_only' | 'subscribers' | 'anyone_with_link';
  rate_limit_seconds: number;
  rate_limit_max_presses: number;
  is_active: boolean;
  last_pressed_at: string | null;
  created_at: string;
}

export interface CreateButtonDto {
  name: string;
  description?: string;
  slug: string;
  press_policy: Button['press_policy'];
  rate_limit_seconds?: number;
  rate_limit_max_presses?: number;
}

@Injectable({ providedIn: 'root' })
export class ButtonService {
  private supabase = inject(SupabaseService).client;
  private auth     = inject(AuthService);

  async getMyButtons(): Promise<Button[]> {
    const { data } = await this.supabase
      .from('buttons')
      .select('*')
      .eq('owner_id', this.auth.user()!.id)
      .order('created_at', { ascending: false });
    return data ?? [];
  }

  async getSubscribedButtons(): Promise<Button[]> {
    const userId = this.auth.user()!.id;
    const { data } = await this.supabase
      .from('subscriptions')
      .select('button_id, buttons(*)')
      .eq('user_id', userId);
    return (data ?? [])
      .map((s: any) => s.buttons)
      .filter((b: Button | null) => b && b.owner_id !== userId) as Button[];
  }

  async getBySlug(slug: string): Promise<Button | null> {
    const { data } = await this.supabase
      .from('buttons')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();
    return data ?? null;
  }

  async create(dto: CreateButtonDto): Promise<Button> {
    const { data, error } = await this.supabase
      .from('buttons')
      .insert({ ...dto, owner_id: this.auth.user()!.id })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  async delete(id: string): Promise<void> {
    await this.supabase.from('buttons').delete().eq('id', id);
  }

  async getSubscribers(buttonId: string) {
    const { data } = await this.supabase
      .from('subscriptions')
      .select('id, user_name, user_email, created_at')
      .eq('button_id', buttonId)
      .order('created_at', { ascending: false });
    return data ?? [];
  }

  async getPressLog(buttonId: string) {
    const { data } = await this.supabase
      .from('press_log')
      .select('id, pressed_at, profiles(display_name)')
      .eq('button_id', buttonId)
      .order('pressed_at', { ascending: false })
      .limit(20);
    return data ?? [];
  }

  async createInvite(buttonId: string): Promise<string> {
    const { data, error } = await this.supabase.rpc('create_invite_link', {
      p_button_id: buttonId,
    });
    if (error) throw new Error(error.message);
    return data as string;
  }

  async useInviteToken(token: string): Promise<{ button_id: string; button_slug: string; button_name: string } | null> {
    const { data, error } = await this.supabase.rpc('use_invite_token', { p_token: token });
    if (error) throw new Error(error.message);
    return data?.[0] ?? null;
  }

  slugify(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
