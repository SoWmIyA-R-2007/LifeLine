/**
 * Lifeline - Memories Data & Storage Module
 * Complete CRUD, Multi-photo storage upload, Favorites, Milestones,
 * On This Day retrospectives, Year Summaries, and Data Export.
 */

import { getSupabase, isSupabaseConfigured, DEFAULT_BUCKET } from './supabaseClient.js';
import { Auth } from './auth.js';
import { ImageUtils } from './imageUtils.js';

const DEMO_STORAGE_KEY = 'lifeline_demo_memories_v2';

// Rich, realistic sample memories used ONLY in Demo Sandbox mode
const INITIAL_DEMO_MEMORIES = [
  {
    id: 'demo-mem-001',
    user_id: 'demo-user-001',
    title: 'First Solo Summit: Mount Rainier Sunrise',
    description: 'Broke camp at 2:30 AM in sub-zero wind. Reached Columbia Crest just as golden hour ignited the Pacific Northwest cloud sea. Pure gratitude, exhaustion, and quiet clarity.',
    date: '2026-08-14',
    category: 'Milestones',
    location: 'Mount Rainier, Washington',
    importance: 5,
    is_milestone: true,
    is_favorite: true,
    privacy: 'private',
    media_url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1400&q=80',
    photos: [
      {
        id: 'p-1',
        url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1400&q=80',
        caption: 'Sunrise over the sea of clouds from Columbia Crest summit.',
        display_order: 0
      },
      {
        id: 'p-2',
        url: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1400&q=80',
        caption: 'Early morning alpine glow before the final ridge push.',
        display_order: 1
      }
    ],
    tags: ['Summit', 'Climbing', 'Pacific Northwest', 'Dawn'],
    created_at: '2026-08-14T10:20:00.000Z'
  },
  {
    id: 'demo-mem-002',
    user_id: 'demo-user-001',
    title: 'Launched the Open Source Engine v1.0',
    description: 'After 8 months of midnight commits and architectural refactors, published v1.0 to the world. Trending #1 on GitHub and Hacker News by lunch. Celebrated with wood-fired pizza and the team on the rooftop.',
    date: '2025-04-18',
    category: 'Career and Education',
    location: 'San Francisco, CA',
    importance: 5,
    is_milestone: true,
    is_favorite: true,
    privacy: 'private',
    media_url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1400&q=80',
    photos: [
      {
        id: 'p-3',
        url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1400&q=80',
        caption: 'The launch war room 10 minutes before releasing to GitHub.',
        display_order: 0
      }
    ],
    tags: ['Software', 'Open Source', 'Milestone', 'Team'],
    created_at: '2025-04-18T18:45:00.000Z'
  },
  {
    id: 'demo-mem-003',
    user_id: 'demo-user-001',
    title: 'Kyoto Bamboo Forest in the Rain',
    description: 'The gentlest spring drizzle filtered through the towering stalks of Arashiyama. Drank ceremonial matcha at a 300-year-old tea pavilion while listening to wind chimes and distant temple bells.',
    date: '2023-11-09',
    category: 'Travel',
    location: 'Kyoto, Japan',
    importance: 4,
    is_milestone: false,
    is_favorite: true,
    privacy: 'private',
    media_url: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1400&q=80',
    photos: [
      {
        id: 'p-4',
        url: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1400&q=80',
        caption: 'Morning mist settling over Arashiyama paths.',
        display_order: 0
      },
      {
        id: 'p-5',
        url: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=1400&q=80',
        caption: 'Lanterns lit along the wooden alleys of Gion at twilight.',
        display_order: 1
      }
    ],
    tags: ['Japan', 'Kyoto', 'Zen', 'Travel'],
    created_at: '2023-11-09T14:15:00.000Z'
  },
  {
    id: 'demo-mem-004',
    user_id: 'demo-user-001',
    title: 'Adopted Kiko the Siberian Husky',
    description: 'Visited the shelter just to drop off winter blankets and couldn’t walk away without him. He sat upright like a co-pilot on the entire two-hour drive into the Colorado mountains.',
    date: '2021-06-20',
    category: 'Family and Friends',
    location: 'Denver, Colorado',
    importance: 5,
    is_milestone: true,
    is_favorite: true,
    privacy: 'private',
    media_url: 'https://images.unsplash.com/photo-1537151625747-768eb6cf92b2?auto=format&fit=crop&w=1400&q=80',
    photos: [
      {
        id: 'p-6',
        url: 'https://images.unsplash.com/photo-1537151625747-768eb6cf92b2?auto=format&fit=crop&w=1400&q=80',
        caption: 'First afternoon explore at Red Rocks trail.',
        display_order: 0
      }
    ],
    tags: ['Pets', 'Family', 'Husky', 'Adoption'],
    created_at: '2021-06-20T16:00:00.000Z'
  },
  {
    id: 'demo-mem-005',
    user_id: 'demo-user-001',
    title: 'University Engineering Quad Graduation',
    description: 'Turned the tassel on the sunlit quad surrounded by family, professors, and lifelong friends. A poignant farewell to four intense, transformative years.',
    date: '2019-05-15',
    category: 'Milestones',
    location: 'Ann Arbor, Michigan',
    importance: 5,
    is_milestone: true,
    is_favorite: false,
    privacy: 'private',
    media_url: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=1400&q=80',
    photos: [
      {
        id: 'p-7',
        url: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=1400&q=80',
        caption: 'Cap toss celebration on the Diag quadrangle.',
        display_order: 0
      }
    ],
    tags: ['Graduation', 'College', 'Alumni', 'Milestone'],
    created_at: '2019-05-15T12:00:00.000Z'
  },
  {
    id: 'demo-mem-006',
    user_id: 'demo-user-001',
    title: 'Sunday Morning Artisan Sourdough Batch',
    description: 'Finally perfected the 80% hydration open crumb after months of trial and error. Fresh rosemary and flaked sea salt. Kitchen smelled of warm crust and roasted butter.',
    date: '2024-10-22',
    category: 'Everyday Life',
    location: 'Home Kitchen',
    importance: 3,
    is_milestone: false,
    is_favorite: false,
    privacy: 'private',
    media_url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=1400&q=80',
    photos: [
      {
        id: 'p-8',
        url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=1400&q=80',
        caption: 'Cracking golden crust straight from the Dutch oven.',
        display_order: 0
      }
    ],
    tags: ['Baking', 'Weekend', 'Everyday', 'Comfort'],
    created_at: '2024-10-22T08:30:00.000Z'
  }
];

function getDemoStorage() {
  try {
    const raw = localStorage.getItem(DEMO_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(INITIAL_DEMO_MEMORIES));
      return [...INITIAL_DEMO_MEMORIES];
    }
    return JSON.parse(raw);
  } catch (err) {
    console.warn('[Memories] LocalStorage parsing error, using seed:', err);
    return [...INITIAL_DEMO_MEMORIES];
  }
}

function saveDemoStorage(list) {
  try {
    localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(list));
  } catch (err) {
    console.error('[Memories] Failed to save demo memories to localStorage:', err);
  }
}

export const Memories = {
  /**
   * Fetch memories matching given filters
   * @param {Object} [filterOptions]
   * @returns {Promise<Array<Object>>}
   */
  async fetchMemories(filterOptions = {}) {
    const {
      category,
      search,
      onlyFavorites = false,
      onlyMilestones = false,
      year = null,
      startDate = null,
      endDate = null,
      order = 'desc'
    } = filterOptions;

    const client = getSupabase();

    if (!client) {
      // Demo Sandbox Mode
      let list = getDemoStorage();

      if (onlyFavorites) {
        list = list.filter(m => !!m.is_favorite);
      }

      if (onlyMilestones) {
        list = list.filter(m => !!m.is_milestone);
      }

      if (category && category !== 'All') {
        list = list.filter(m => m.category === category);
      }

      if (year) {
        list = list.filter(m => m.date && m.date.startsWith(year.toString()));
      }

      if (startDate) {
        list = list.filter(m => m.date && m.date >= startDate);
      }

      if (endDate) {
        list = list.filter(m => m.date && m.date <= endDate);
      }

      if (search && search.trim()) {
        const q = search.trim().toLowerCase();
        list = list.filter(m =>
          (m.title && m.title.toLowerCase().includes(q)) ||
          (m.description && m.description.toLowerCase().includes(q)) ||
          (m.location && m.location.toLowerCase().includes(q)) ||
          (m.tags && m.tags.some(t => t.toLowerCase().includes(q)))
        );
      }

      list.sort((a, b) => {
        const timeA = new Date(a.date).getTime();
        const timeB = new Date(b.date).getTime();
        return order === 'asc' ? timeA - timeB : timeB - timeA;
      });

      return list;
    }

    // Live Supabase Authenticated Query
    const user = await Auth.getUser();
    if (!user) return [];

    let query = client
      .from('memories')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: order === 'asc' });

    if (onlyFavorites) {
      query = query.eq('is_favorite', true);
    }

    if (onlyMilestones) {
      query = query.eq('is_milestone', true);
    }

    if (category && category !== 'All') {
      query = query.eq('category', category);
    }

    if (startDate) {
      query = query.gte('date', startDate);
    }

    if (endDate) {
      query = query.lte('date', endDate);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[Memories] Supabase query error:', error);
      throw error;
    }

    let results = data || [];

    // Client-side text search across multiple fields
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      results = results.filter(m =>
        (m.title && m.title.toLowerCase().includes(q)) ||
        (m.description && m.description.toLowerCase().includes(q)) ||
        (m.location && m.location.toLowerCase().includes(q)) ||
        (m.tags && Array.isArray(m.tags) && m.tags.some(t => t.toLowerCase().includes(q)))
      );
    }

    if (year) {
      results = results.filter(m => m.date && m.date.startsWith(year.toString()));
    }

    return results;
  },

  /**
   * Upload multiple media files to Supabase Storage
   * @param {Array<File>} files
   * @param {string} userId
   * @returns {Promise<Array<{ id: string, url: string, path: string, caption: string, display_order: number }>>}
   */
  async uploadMultipleMedia(files, userId) {
    if (!files || files.length === 0) return [];
    const client = getSupabase();
    const photos = [];

    for (let idx = 0; idx < files.length; idx++) {
      const file = files[idx];

      if (!client) {
        // Demo sandbox: convert to dataUrl
        const dataUrl = await ImageUtils.fileToDataUrl(file);
        photos.push({
          id: `photo-${Date.now()}-${idx}`,
          url: dataUrl,
          path: `demo/${file.name}`,
          caption: '',
          display_order: idx
        });
        continue;
      }

      const bucket = localStorage.getItem('lifeline_supabase_bucket') || DEFAULT_BUCKET;
      const fileExt = file.name.split('.').pop() || 'webp';
      const filePath = `${userId}/${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;

      const { error: uploadError } = await client.storage
        .from(bucket)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type
        });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        throw uploadError;
      }

      const { data: pubData } = client.storage.from(bucket).getPublicUrl(filePath);
      let mediaUrl = pubData?.publicUrl || '';

      // Try signed URL for private bucket protection
      try {
        const { data: signedData } = await client.storage
          .from(bucket)
          .createSignedUrl(filePath, 60 * 60 * 24 * 365);
        if (signedData?.signedUrl) {
          mediaUrl = signedData.signedUrl;
        }
      } catch {
        // Fallback to public URL
      }

      photos.push({
        id: `photo-${Date.now()}-${idx}`,
        url: mediaUrl,
        path: filePath,
        caption: '',
        display_order: idx
      });
    }

    return photos;
  },

  /**
   * Create a new memory record with multiple photos
   * @param {Object} memoryData
   * @param {Array<File>} [imageFiles=[]]
   * @returns {Promise<Object>}
   */
  async createMemory(memoryData, imageFiles = []) {
    const user = await Auth.getUser();
    if (!user) {
      throw new Error('Authentication required to create a memory');
    }

    let uploadedPhotos = [];
    if (imageFiles && imageFiles.length > 0) {
      uploadedPhotos = await this.uploadMultipleMedia(imageFiles, user.id);
    }

    // Merge existing photos if any passed
    const allPhotos = [...(memoryData.existingPhotos || []), ...uploadedPhotos];
    const primaryUrl = allPhotos.length > 0 ? allPhotos[0].url : (memoryData.media_url || '');

    const record = {
      user_id: user.id,
      title: memoryData.title.trim(),
      description: memoryData.description?.trim() || '',
      date: memoryData.date || new Date().toISOString().split('T')[0],
      category: memoryData.category || 'Personal',
      location: memoryData.location?.trim() || '',
      importance: Number(memoryData.importance) || 3,
      is_milestone: Boolean(memoryData.is_milestone),
      is_favorite: Boolean(memoryData.is_favorite),
      privacy: memoryData.privacy || 'private',
      media_url: primaryUrl,
      media_path: allPhotos.length > 0 ? allPhotos[0].path : null,
      photos: allPhotos,
      tags: Array.isArray(memoryData.tags)
        ? memoryData.tags
        : (memoryData.tags ? memoryData.tags.split(',').map(t => t.trim().replace(/^#/, '')).filter(Boolean) : []),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const client = getSupabase();
    if (!client) {
      record.id = `mem-${Date.now()}`;
      const list = getDemoStorage();
      list.unshift(record);
      saveDemoStorage(list);
      return record;
    }

    const { data, error } = await client
      .from('memories')
      .insert([record])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Update an existing memory
   * @param {string} id
   * @param {Object} updates
   * @param {Array<File>} [newImageFiles=[]]
   * @param {Array<Object>} [retainedPhotos=null]
   */
  async updateMemory(id, updates, newImageFiles = [], retainedPhotos = null) {
    const user = await Auth.getUser();
    if (!user) throw new Error('Authentication required');

    let newPhotos = [];
    if (newImageFiles && newImageFiles.length > 0) {
      newPhotos = await this.uploadMultipleMedia(newImageFiles, user.id);
    }

    const payload = {
      ...updates,
      updated_at: new Date().toISOString()
    };

    if (retainedPhotos !== null) {
      const mergedPhotos = [...retainedPhotos, ...newPhotos];
      payload.photos = mergedPhotos;
      if (mergedPhotos.length > 0) {
        payload.media_url = mergedPhotos[0].url;
        payload.media_path = mergedPhotos[0].path;
      } else {
        payload.media_url = '';
        payload.media_path = null;
      }
    } else if (newPhotos.length > 0) {
      payload.photos = newPhotos;
      payload.media_url = newPhotos[0].url;
      payload.media_path = newPhotos[0].path;
    }

    if (payload.tags && typeof payload.tags === 'string') {
      payload.tags = payload.tags.split(',').map(t => t.trim().replace(/^#/, '')).filter(Boolean);
    }

    const client = getSupabase();
    if (!client) {
      const list = getDemoStorage();
      const index = list.findIndex(m => m.id === id);
      if (index === -1) throw new Error('Memory not found');
      list[index] = { ...list[index], ...payload };
      saveDemoStorage(list);
      return list[index];
    }

    const { data, error } = await client
      .from('memories')
      .update(payload)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Toggle favorite flag quickly on a memory
   * @param {string} id
   */
  async toggleFavorite(id) {
    const client = getSupabase();
    if (!client) {
      const list = getDemoStorage();
      const item = list.find(m => m.id === id);
      if (item) {
        item.is_favorite = !item.is_favorite;
        item.updated_at = new Date().toISOString();
        saveDemoStorage(list);
        return item.is_favorite;
      }
      return false;
    }

    const user = await Auth.getUser();
    if (!user) return false;

    // Get current status
    const { data: cur } = await client.from('memories').select('is_favorite').eq('id', id).single();
    const nextVal = !(cur?.is_favorite);

    const { error } = await client
      .from('memories')
      .update({ is_favorite: nextVal, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;
    return nextVal;
  },

  /**
   * Delete memory
   * @param {string} id
   */
  async deleteMemory(id) {
    const user = await Auth.getUser();
    if (!user) throw new Error('Authentication required');

    const client = getSupabase();
    if (!client) {
      let list = getDemoStorage();
      list = list.filter(m => m.id !== id);
      saveDemoStorage(list);
      return true;
    }

    // Clean up storage photos if available
    try {
      const { data: record } = await client
        .from('memories')
        .select('photos, media_path')
        .eq('id', id)
        .single();

      if (record) {
        const paths = [];
        if (record.media_path) paths.push(record.media_path);
        if (record.photos && Array.isArray(record.photos)) {
          record.photos.forEach(p => { if (p.path) paths.push(p.path); });
        }
        if (paths.length > 0) {
          const bucket = localStorage.getItem('lifeline_supabase_bucket') || DEFAULT_BUCKET;
          await client.storage.from(bucket).remove(paths);
        }
      }
    } catch (e) {
      console.warn('Could not remove file from storage:', e);
    }

    const { error } = await client
      .from('memories')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;
    return true;
  },

  /**
   * On This Day: Returns memories that took place on the same month & day in previous years
   */
  async getOnThisDayMemories(targetDate = new Date()) {
    const all = await this.fetchMemories();
    const targetMonth = targetDate.getMonth() + 1;
    const targetDay = targetDate.getDate();
    const currentYear = targetDate.getFullYear();

    return all.filter(m => {
      if (!m.date) return false;
      const parts = m.date.split('-');
      if (parts.length < 3) return false;
      const mYear = parseInt(parts[0], 10);
      const mMonth = parseInt(parts[1], 10);
      const mDay = parseInt(parts[2], 10);

      // Same month & day, but from a strictly earlier year
      return mMonth === targetMonth && mDay === targetDay && mYear < currentYear;
    });
  },

  /**
   * Year Summary statistics for the specified year
   */
  async getYearSummary(year) {
    const all = await this.fetchMemories();
    const yearMemories = all.filter(m => m.date && m.date.startsWith(year.toString()));
    const milestones = yearMemories.filter(m => m.is_milestone);
    const favorites = yearMemories.filter(m => m.is_favorite);

    const categoryBreakdown = {};
    yearMemories.forEach(m => {
      categoryBreakdown[m.category] = (categoryBreakdown[m.category] || 0) + 1;
    });

    return {
      year,
      totalMemories: yearMemories.length,
      milestonesCount: milestones.length,
      favoritesCount: favorites.length,
      categories: categoryBreakdown,
      memories: yearMemories
    };
  },

  /**
   * Export all memories metadata as a clean JSON file
   */
  async exportMemoriesAsJSON() {
    const list = await this.fetchMemories({ order: 'asc' });
    const payload = {
      exportVersion: '2.0',
      exportedAt: new Date().toISOString(),
      generator: 'LifeLine — Time & Memory Archive',
      memoriesCount: list.length,
      memories: list
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `lifeline_memories_export_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return list.length;
  },

  /**
   * Export a generated life-story chronological Markdown document
   */
  async exportLifeStoryDocument() {
    const list = await this.fetchMemories({ order: 'asc' });
    let md = `# My LifeLine — Personal Memory Archive\n`;
    md += `*Generated on ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}*\n\n`;
    md += `> "Your Life. Your Memories. Your Story."\n\n---\n\n`;

    const groups = {};
    list.forEach(m => {
      const yr = m.date ? m.date.split('-')[0] : 'Undated';
      if (!groups[yr]) groups[yr] = [];
      groups[yr].push(m);
    });

    Object.keys(groups).sort().forEach(yr => {
      md += `## Year ${yr}\n\n`;
      groups[yr].forEach(m => {
        const starStr = '★'.repeat(m.importance || 3);
        const milestoneTag = m.is_milestone ? ' **[🏆 Milestone]**' : '';
        const favTag = m.is_favorite ? ' **[❤️ Favorite]**' : '';
        md += `### ${m.title}${milestoneTag}${favTag}\n`;
        md += `- **Date:** ${m.date}\n`;
        md += `- **Category:** ${m.category}\n`;
        if (m.location) md += `- **Location:** ${m.location}\n`;
        md += `- **Significance:** ${starStr}\n`;
        if (m.tags && m.tags.length) md += `- **Tags:** #${m.tags.join(' #')}\n`;
        if (m.media_url) md += `\n![${m.title}](${m.media_url})\n`;
        if (m.description) md += `\n${m.description}\n`;
        md += `\n---\n\n`;
      });
    });

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `lifeline_story_${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return list.length;
  },

  /**
   * Reset demo data to initial seeds
   */
  resetDemoData() {
    saveDemoStorage(INITIAL_DEMO_MEMORIES);
    return [...INITIAL_DEMO_MEMORIES];
  },

  /**
   * Clear all demo memories for a clean empty test
   */
  clearDemoData() {
    saveDemoStorage([]);
    return [];
  }
};
