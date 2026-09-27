import { Project } from '../models/types.js';
import { inMemoryStore } from '../database/store.js';
import { getSupabaseAdminClient } from '../database/supabase.client.js';

export class ProjectService {
  public async getProjects(userId: string): Promise<Project[]> {
    const supabase = getSupabaseAdminClient();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('projects')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (!error && data) {
          return data as Project[];
        }
      } catch (err) {
        console.warn('[ProjectService] Supabase query failed, falling back to store:', err);
      }
    }

    return Array.from(inMemoryStore.projects.values()).filter(
      (p) => p.user_id === userId || p.user_id === '00000000-0000-0000-0000-000000000001'
    );
  }

  public async getProjectById(id: string, userId: string): Promise<Project | null> {
    const supabase = getSupabaseAdminClient();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('projects')
          .select('*')
          .eq('id', id)
          .single();

        if (!error && data) {
          return data as Project;
        }
      } catch (err) {
        console.warn('[ProjectService] Supabase query failed:', err);
      }
    }

    return inMemoryStore.projects.get(id) || null;
  }

  public async createProject(
    userId: string,
    data: { name: string; description?: string; aoi?: any; tags?: string[] }
  ): Promise<Project> {
    const newProject: Project = {
      id: crypto.randomUUID(),
      user_id: userId,
      name: data.name,
      description: data.description || '',
      aoi: data.aoi || null,
      tags: data.tags || ['Sentinel-2', 'Earth Observation'],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const supabase = getSupabaseAdminClient();
    if (supabase) {
      try {
        const { data: created, error } = await supabase
          .from('projects')
          .insert(newProject)
          .select()
          .single();

        if (!error && created) {
          inMemoryStore.projects.set(created.id, created as Project);
          return created as Project;
        }
      } catch (err) {
        console.warn('[ProjectService] Supabase insert failed:', err);
      }
    }

    inMemoryStore.projects.set(newProject.id, newProject);
    return newProject;
  }

  public async updateProject(
    id: string,
    userId: string,
    updates: Partial<Project>
  ): Promise<Project | null> {
    const project = inMemoryStore.projects.get(id);
    if (!project) return null;

    const updated = {
      ...project,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    const supabase = getSupabaseAdminClient();
    if (supabase) {
      try {
        await supabase.from('projects').update(updated).eq('id', id);
      } catch (err) {
        console.warn('[ProjectService] Supabase update failed:', err);
      }
    }

    inMemoryStore.projects.set(id, updated);
    return updated;
  }

  public async deleteProject(id: string, userId: string): Promise<boolean> {
    const supabase = getSupabaseAdminClient();
    if (supabase) {
      try {
        await supabase.from('projects').delete().eq('id', id);
      } catch (err) {
        console.warn('[ProjectService] Supabase delete failed:', err);
      }
    }

    return inMemoryStore.projects.delete(id);
  }
}

export const projectService = new ProjectService();
