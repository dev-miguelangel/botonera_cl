import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase';

export interface Button {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  slug: string;
  icon: string;
  color: string;
  press_policy: 'owner_only' | 'subscribers' | 'anyone_with_link';
  rate_limit_seconds: number;
  rate_limit_max_presses: number;
  is_active: boolean;
  is_paused: boolean;
  last_pressed_at: string | null;
  created_at: string;
}

export interface CreateButtonDto {
  name: string;
  description?: string;
  slug: string;
  icon?: string;
  color?: string;
  press_policy: Button['press_policy'];
  rate_limit_seconds?: number;
  rate_limit_max_presses?: number;
}

@Injectable({ providedIn: 'root' })
export class ButtonService {
  private supabase = inject(SupabaseService).client;

  private async getUserId(): Promise<string | null> {
    const { data: { session } } = await this.supabase.auth.getSession();
    return session?.user?.id ?? null;
  }

  async getMyButtons(): Promise<Button[]> {
    const userId = await this.getUserId();
    if (!userId) return [];
    const { data } = await this.supabase
      .from('buttons')
      .select('*')
      .eq('owner_id', userId)
      .order('created_at', { ascending: false });
    return data ?? [];
  }

  async getSubscribedButtons(): Promise<Button[]> {
    const userId = await this.getUserId();
    if (!userId) return [];

    const { data: follows, error: followsError } = await this.supabase
      .from('follows')
      .select('button_id')
      .eq('user_id', userId);

    if (followsError) { console.error('getSubscribedButtons follows error:', followsError); return []; }
    if (!follows || follows.length === 0) return [];

    const ids = [...new Set(follows.map((f: any) => f.button_id as string))];

    const { data: buttons, error: btnsError } = await this.supabase
      .from('buttons')
      .select('*')
      .in('id', ids)
      .eq('is_active', true)
      .neq('owner_id', userId);

    if (btnsError) { console.error('getSubscribedButtons buttons error:', btnsError); return []; }
    return buttons ?? [];
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
    const { data: { session } } = await this.supabase.auth.getSession();
    const userId = session?.user?.id ?? null;
    if (!userId) throw new Error('Sin sesión');

    // Garantizar que el perfil existe antes de insertar (FK buttons -> profiles)
    await this.supabase.from('profiles').upsert({
      id:           userId,
      display_name: session!.user.user_metadata?.['full_name'] ?? session!.user.email ?? '',
      avatar_url:   session!.user.user_metadata?.['avatar_url'] ?? null,
    }, { onConflict: 'id' });

    // Sufijo del userId para garantizar unicidad de slug entre usuarios
    const slugFinal = `${dto.slug}-${userId.slice(0, 6)}`;

    const { data, error } = await this.supabase
      .from('buttons')
      .insert({ ...dto, slug: slugFinal, owner_id: userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  async setPaused(id: string, paused: boolean): Promise<void> {
    const { error } = await this.supabase.from('buttons').update({ is_paused: paused }).eq('id', id);
    if (error) throw new Error(error.message);
  }

  async delete(id: string): Promise<void> {
    await this.supabase.from('buttons').delete().eq('id', id);
  }

  async getFollowerCounts(buttonIds: string[]): Promise<Record<string, number>> {
    if (!buttonIds.length) return {};
    const { data } = await this.supabase
      .from('follows')
      .select('button_id')
      .in('button_id', buttonIds);
    const counts: Record<string, number> = {};
    for (const row of data ?? []) {
      counts[row.button_id] = (counts[row.button_id] ?? 0) + 1;
    }
    return counts;
  }

  async getSubscribers(buttonId: string) {
    const { data } = await this.supabase
      .from('follows')
      .select('id, user_name, user_email, created_at, is_muted')
      .eq('button_id', buttonId)
      .order('created_at', { ascending: false });
    return data ?? [];
  }

  async getPressLog(buttonId: string) {
    const { data } = await this.supabase
      .from('press_log')
      .select('id, pressed_at, pressed_by')
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
