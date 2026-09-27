import { Alert } from '../models/types.js';
import { inMemoryStore } from '../database/store.js';
import { getSupabaseAdminClient } from '../database/supabase.client.js';

export class AlertService {
  public async getAlerts(userId: string): Promise<Alert[]> {
    const supabase = getSupabaseAdminClient();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('alerts')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data) {
          return data as Alert[];
        }
      } catch (err) {
        console.warn('[AlertService] Supabase select failed:', err);
      }
    }

    return Array.from(inMemoryStore.alerts.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  public async createAlert(data: {
    userId: string;
    projectId?: string | null;
    title: string;
    message: string;
    alertType: 'CHANGE_DETECTED' | 'VEGETATION_DECREASE' | 'WATER_ANOMALY' | 'URBAN_EXPANSION' | 'THRESHOLD_ALERT';
    severity?: 'low' | 'medium' | 'high' | 'critical';
  }): Promise<Alert> {
    const newAlert: Alert = {
      id: crypto.randomUUID(),
      user_id: data.userId,
      project_id: data.projectId || null,
      title: data.title,
      message: data.message,
      alert_type: data.alertType,
      severity: data.severity || 'medium',
      is_read: false,
      created_at: new Date().toISOString(),
    };

    const supabase = getSupabaseAdminClient();
    if (supabase) {
      try {
        await supabase.from('alerts').insert(newAlert);
      } catch (err) {
        console.warn('[AlertService] Supabase insert failed:', err);
      }
    }

    inMemoryStore.alerts.set(newAlert.id, newAlert);
    return newAlert;
  }

  public async markAsRead(id: string, isRead: boolean = true): Promise<Alert | null> {
    const alert = inMemoryStore.alerts.get(id);
    if (!alert) return null;

    alert.is_read = isRead;

    const supabase = getSupabaseAdminClient();
    if (supabase) {
      try {
        await supabase.from('alerts').update({ is_read: isRead }).eq('id', id);
      } catch (err) {
        console.warn('[AlertService] Supabase update failed:', err);
      }
    }

    inMemoryStore.alerts.set(id, alert);
    return alert;
  }

  public async deleteAlert(id: string): Promise<boolean> {
    const supabase = getSupabaseAdminClient();
    if (supabase) {
      try {
        await supabase.from('alerts').delete().eq('id', id);
      } catch (err) {
        console.warn('[AlertService] Supabase delete failed:', err);
      }
    }
    return inMemoryStore.alerts.delete(id);
  }
}

export const alertService = new AlertService();
