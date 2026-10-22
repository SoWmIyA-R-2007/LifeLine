/**
 * Lifeline - Main Application Controller
 * Handles SPA view routing, global search with suggestions, multi-photo handling,
 * multi-photo carousel in detail view, On This Day retrospectives, and genuine reminders.
 */

import { isSupabaseConfigured, configureSupabase, disconnectSupabase, getConfig } from './supabaseClient.js';
import { Auth } from './auth.js';
import { Memories } from './memories.js';
import { Timeline } from './timeline.js';
import { ImageUtils } from './imageUtils.js';

// Application State
export const AppState = {
  currentView: 'timeline', // 'timeline' | 'grid' | 'milestones' | 'favorites' | 'export' | 'settings' | 'about'
  currentCategory: 'All',
  searchQuery: '',
  sortOrder: 'desc',
  memories: [],
  selectedFiles: [], // Array of compressed image objects ready for upload
  existingPhotos: [], // Array of { id, url, path, caption } during edit
  editingMemoryId: null,
  currentUser: null,
  activeDetailMemory: null,
  activePhotoIndex: 0
};

// UI Helper: Toast Notifications
export function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast-item toast-${type}`;

  const iconMap = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
  };

  toast.innerHTML = `
    <span class="toast-icon">${iconMap[type] || 'ℹ'}</span>
    <span class="toast-msg">${message}</span>
  `;

  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('visible'));

  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Modal Controllers
export const Modal = {
  open(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.add('is-active');
      document.body.classList.add('modal-open');
    }
  },
  close(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.remove('is-active');
      if (!document.querySelector('.modal.is-active')) {
        document.body.classList.remove('modal-open');
      }
    }
  },
  closeAll() {
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('is-active'));
    document.body.classList.remove('modal-open');
  }
};

/**
 * Switch Active View (SPA routing)
 * @param {'timeline'|'grid'|'milestones'|'favorites'|'export'|'settings'|'about'} viewName
 */
export async function navigateToView(viewName) {
  AppState.currentView = viewName;

  // Update navigation items active state
  document.querySelectorAll('[data-nav-view]').forEach(link => {
    if (link.getAttribute('data-nav-view') === viewName) {
      link.classList.add('active');
      link.setAttribute('aria-current', 'page');
    } else {
      link.classList.remove('active');
      link.removeAttribute('aria-current');
    }
  });

  // Toggle view containers
  const viewSections = {
    timeline: document.getElementById('view-timeline-container'),
    grid: document.getElementById('view-grid-container'),
    milestones: document.getElementById('view-milestones-container'),
    favorites: document.getElementById('view-favorites-container'),
    export: document.getElementById('view-export-container'),
    settings: document.getElementById('view-settings-container'),
    about: document.getElementById('view-about-container')
  };

  for (const [key, section] of Object.entries(viewSections)) {
    if (section) {
      if (key === viewName) {
        section.classList.remove('hidden');
      } else {
        section.classList.add('hidden');
      }
    }
  }

  // Close mobile nav drawer if open
  const mobileDrawer = document.getElementById('mobile-nav-drawer');
  if (mobileDrawer) mobileDrawer.classList.remove('is-active');

  // Trigger data refresh according to current view
  await refreshActiveView();

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Refresh current active view
 */
export async function refreshActiveView() {
  const isConnected = isSupabaseConfigured();
  updateConnectionBadge();

  try {
    const filterOpts = {
      search: AppState.searchQuery,
      order: AppState.sortOrder
    };

    if (AppState.currentCategory !== 'All') {
      filterOpts.category = AppState.currentCategory;
    }

    if (AppState.currentView === 'milestones') {
      filterOpts.onlyMilestones = true;
    } else if (AppState.currentView === 'favorites') {
      filterOpts.onlyFavorites = true;
    }

    const memories = await Memories.fetchMemories(filterOpts);
    AppState.memories = memories;

    // Update global dashboard statistics
    updateDashboardStats(memories);

    // Check "On This Day"
    checkOnThisDay();

    // Render depending on view
    if (AppState.currentView === 'timeline') {
      const timelineContainer = document.getElementById('timeline-container');
      const scrubberContainer = document.getElementById('year-scrubber-nav');
      Timeline.renderTimeline(timelineContainer, memories);
      Timeline.renderYearScrubber(scrubberContainer, memories);
    } else if (AppState.currentView === 'grid') {
      const gridContainer = document.getElementById('grid-cards-container');
      Timeline.renderPhotoGrid(gridContainer, memories);
    } else if (AppState.currentView === 'milestones') {
      const milestonesContainer = document.getElementById('milestones-timeline-container');
      Timeline.renderTimeline(milestonesContainer, memories);
    } else if (AppState.currentView === 'favorites') {
      const favsContainer = document.getElementById('favorites-feed-container');
      Timeline.renderTimeline(favsContainer, memories);
    }

    // Attach Empty State "Add Memory" trigger if present
    document.querySelectorAll('#btn-add-first-memory').forEach(btn => {
      btn.onclick = () => openMemoryForm();
    });

  } catch (err) {
    console.error('Error refreshing active view:', err);
    showToast(`Error loading memories: ${err.message}`, 'error');
  }
}

/**
 * Check and display "On This Day" banner if matching past memories exist
 */
async function checkOnThisDay() {
  const banner = document.getElementById('on-this-day-banner');
  if (!banner) return;

  try {
    const matches = await Memories.getOnThisDayMemories(new Date());
    if (matches && matches.length > 0) {
      const mem = matches[0];
      const yearsAgo = new Date().getFullYear() - parseInt(mem.date.split('-')[0], 10);
      const yearLabel = yearsAgo === 1 ? '1 year ago today' : `${yearsAgo} years ago today`;

      banner.innerHTML = `
        <div class="on-this-day-content">
          <div class="on-this-day-icon">✨</div>
          <div class="on-this-day-text">
            <span class="on-this-day-tag">ON THIS DAY • ${yearLabel.toUpperCase()}</span>
            <h4 class="on-this-day-title">${Timeline.escapeHtml(mem.title)}</h4>
            <p class="on-this-day-desc">${Timeline.escapeHtml(mem.description)}</p>
          </div>
          <button class="btn-secondary on-this-day-btn" data-action="view-detail" data-id="${mem.id}">
            View Memory
          </button>
        </div>
      `;
      banner.classList.remove('hidden');
    } else {
      banner.classList.add('hidden');
    }
  } catch (err) {
    banner.classList.add('hidden');
  }
}

/**
 * Update Dashboard Statistics
 */
function updateDashboardStats(memories) {
  const totalCountEl = document.getElementById('stat-total-count');
  const yearsSpannedEl = document.getElementById('stat-years-spanned');
  const milestonesCountEl = document.getElementById('stat-milestones-count');

  if (!memories || memories.length === 0) {
    if (totalCountEl) totalCountEl.textContent = '0';
    if (yearsSpannedEl) yearsSpannedEl.textContent = '0';
    if (milestonesCountEl) milestonesCountEl.textContent = '0';
    return;
  }

  if (totalCountEl) totalCountEl.textContent = memories.length.toString();

  const years = new Set(memories.map(m => (m.date ? m.date.split('-')[0] : null)).filter(Boolean));
  if (yearsSpannedEl) yearsSpannedEl.textContent = years.size.toString();

  const milestoneCount = memories.filter(m => m.is_milestone).length;
  if (milestonesCountEl) milestonesCountEl.textContent = milestoneCount.toString();
}

/**
 * Update Supabase status indicator badge
 */
function updateConnectionBadge() {
  const badge = document.getElementById('supabase-status-badge');
  const userMenuBtn = document.getElementById('btn-user-profile');
  const isConnected = isSupabaseConfigured();

  if (badge) {
    if (isConnected) {
      badge.className = 'status-pill status-live';
      badge.innerHTML = '<span class="status-indicator"></span><span class="status-text">Supabase Live</span>';
      badge.title = 'Connected to Supabase cloud database';
    } else {
      badge.className = 'status-pill status-demo';
      badge.innerHTML = '<span class="status-indicator"></span><span class="status-text">Demo Sandbox</span>';
      badge.title = 'Using local browser demo storage. Click to connect Supabase.';
    }
  }

  if (userMenuBtn) {
    const user = AppState.currentUser;
    const name = (user && user.user_metadata?.full_name) || (user && user.email) || 'Alex Morgan';
    userMenuBtn.innerHTML = `
      <div class="user-avatar">${name.charAt(0).toUpperCase()}</div>
      <span class="user-name-label">${name}</span>
    `;
  }
}

/**
 * Open Memory Form Modal (Create or Edit)
 * @param {Object} [existingMemory]
 */
export function openMemoryForm(existingMemory = null) {
  const form = document.getElementById('memory-form');
  const modalTitle = document.getElementById('memory-modal-title');
  const previewsContainer = document.getElementById('multi-image-previews');
  const compressSummary = document.getElementById('compression-stats-summary');

  form.reset();
  AppState.selectedFiles = [];
  AppState.existingPhotos = [];
  AppState.editingMemoryId = existingMemory ? existingMemory.id : null;

  previewsContainer.innerHTML = '';
  compressSummary.textContent = '';

  if (existingMemory) {
    modalTitle.textContent = 'Edit Memory';
    document.getElementById('input-memory-title').value = existingMemory.title || '';
    document.getElementById('input-memory-date').value = existingMemory.date || '';
    document.getElementById('input-memory-category').value = existingMemory.category || 'Personal';
    document.getElementById('input-memory-location').value = existingMemory.location || '';
    document.getElementById('input-memory-importance').value = existingMemory.importance || 3;
    document.getElementById('input-memory-description').value = existingMemory.description || '';
    document.getElementById('input-memory-tags').value = (existingMemory.tags || []).join(', ');
    document.getElementById('input-memory-milestone').checked = Boolean(existingMemory.is_milestone);
    document.getElementById('input-memory-favorite').checked = Boolean(existingMemory.is_favorite);
    document.getElementById('input-memory-privacy').value = existingMemory.privacy || 'private';

    // Populate existing photos
    const existingList = existingMemory.photos && existingMemory.photos.length > 0
      ? existingMemory.photos
      : (existingMemory.media_url ? [{ id: 'legacy', url: existingMemory.media_url, caption: '' }] : []);

    AppState.existingPhotos = [...existingList];
    renderImagePreviews();
  } else {
    modalTitle.textContent = 'Capture New Memory';
    document.getElementById('input-memory-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('input-memory-milestone').checked = false;
    document.getElementById('input-memory-favorite').checked = false;
    document.getElementById('input-memory-privacy').value = 'private';
  }

  Modal.open('memory-modal');
}

/**
 * Render image previews with individual remove buttons in the form
 */
function renderImagePreviews() {
  const container = document.getElementById('multi-image-previews');
  const summaryEl = document.getElementById('compression-stats-summary');
  if (!container) return;

  const totalPhotosCount = AppState.existingPhotos.length + AppState.selectedFiles.length;

  if (totalPhotosCount === 0) {
    container.innerHTML = '';
    if (summaryEl) summaryEl.textContent = '';
    return;
  }

  let html = '';

  // Render existing photos
  AppState.existingPhotos.forEach((photo, idx) => {
    html += `
      <div class="photo-preview-chip">
        <img src="${photo.url}" alt="Photo ${idx + 1}" class="preview-chip-img" />
        <button type="button" class="btn-remove-chip" data-remove-existing="${idx}" title="Remove photo" aria-label="Remove photo">✕</button>
        <span class="chip-badge">Attached</span>
      </div>
    `;
  });

  // Render newly selected compressed photos
  let totalSavedPercent = 0;
  AppState.selectedFiles.forEach((item, idx) => {
    totalSavedPercent += item.savedPercent;
    html += `
      <div class="photo-preview-chip">
        <img src="${item.previewUrl}" alt="Photo ${idx + 1}" class="preview-chip-img" />
        <button type="button" class="btn-remove-chip" data-remove-new="${idx}" title="Remove photo" aria-label="Remove photo">✕</button>
        <span class="chip-badge chip-badge-new">-${item.savedPercent}%</span>
      </div>
    `;
  });

  container.innerHTML = html;

  // Update summary badge
  if (summaryEl) {
    const avgSaved = AppState.selectedFiles.length > 0
      ? Math.round(totalSavedPercent / AppState.selectedFiles.length)
      : 0;

    summaryEl.innerHTML = `
      <span class="badge-saved">📷 ${totalPhotosCount} photo${totalPhotosCount > 1 ? 's' : ''} ready${avgSaved > 0 ? ` (avg ${avgSaved}% compressed)` : ''}</span>
    `;
  }

  // Attach chip remove listeners
  container.querySelectorAll('[data-remove-existing]').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const index = parseInt(btn.getAttribute('data-remove-existing'), 10);
      AppState.existingPhotos.splice(index, 1);
      renderImagePreviews();
    };
  });

  container.querySelectorAll('[data-remove-new]').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const index = parseInt(btn.getAttribute('data-remove-new'), 10);
      AppState.selectedFiles.splice(index, 1);
      renderImagePreviews();
    };
  });
}

/**
 * Setup Multi-File Drag-and-Drop Image Uploader
 */
function setupImageUploadHandlers() {
  const dropZone = document.getElementById('image-dropzone');
  const fileInput = document.getElementById('memory-images-input');
  const summaryEl = document.getElementById('compression-stats-summary');

  if (!dropZone || !fileInput) return;

  dropZone.addEventListener('click', () => fileInput.click());

  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('drag-over');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('drag-over');
    });
  });

  dropZone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files.length > 0) handleFiles(files);
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) handleFiles(fileInput.files);
  });

  async function handleFiles(files) {
    if (summaryEl) {
      summaryEl.innerHTML = '<span class="optimizing-spinner">⚙</span> Compressing photos client-side...';
    }

    try {
      const compressedList = await ImageUtils.compressMultipleImages(
        files,
        { maxWidth: 1600, maxHeight: 1600, quality: 0.82 },
        (done, total) => {
          if (summaryEl) {
            summaryEl.innerHTML = `<span class="optimizing-spinner">⚙</span> Optimizing photo ${done} of ${total}...`;
          }
        }
      );

      AppState.selectedFiles.push(...compressedList);
      renderImagePreviews();
    } catch (err) {
      console.error('Multi-image optimization error:', err);
      showToast(err.message, 'error');
    } finally {
      fileInput.value = '';
    }
  }
}

/**
 * Handle Memory Form Submit (Create or Edit)
 */
function setupMemoryFormSubmit() {
  const form = document.getElementById('memory-form');
  const submitBtn = document.getElementById('btn-submit-memory');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = document.getElementById('input-memory-title').value.trim();
    const date = document.getElementById('input-memory-date').value;
    const category = document.getElementById('input-memory-category').value;
    const location = document.getElementById('input-memory-location').value.trim();
    const importance = parseInt(document.getElementById('input-memory-importance').value, 10);
    const description = document.getElementById('input-memory-description').value.trim();
    const tagsRaw = document.getElementById('input-memory-tags').value;
    const isMilestone = document.getElementById('input-memory-milestone').checked;
    const isFavorite = document.getElementById('input-memory-favorite').checked;
    const privacy = document.getElementById('input-memory-privacy').value;

    if (!title) {
      showToast('Please enter a memory title.', 'warning');
      return;
    }
    if (!date) {
      showToast('Please specify the date of this memory.', 'warning');
      return;
    }

    const payload = {
      title,
      date,
      category,
      location,
      importance,
      description,
      is_milestone: isMilestone,
      is_favorite: isFavorite,
      privacy,
      tags: tagsRaw.split(',').map(t => t.trim().replace(/^#/, '')).filter(Boolean),
      existingPhotos: AppState.existingPhotos
    };

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span> Saving...';

    try {
      const filesToUpload = AppState.selectedFiles.map(f => f.file);

      if (AppState.editingMemoryId) {
        await Memories.updateMemory(
          AppState.editingMemoryId,
          payload,
          filesToUpload,
          AppState.existingPhotos
        );
        showToast('Memory updated successfully!', 'success');
      } else {
        await Memories.createMemory(payload, filesToUpload);
        showToast('New memory preserved in LifeLine!', 'success');
      }

      Modal.close('memory-modal');
      await refreshActiveView();
    } catch (err) {
      console.error('Save memory error:', err);
      showToast(`Failed to save: ${err.message}`, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Save Memory';
    }
  });
}

/**
 * Memory Detail & Lightbox Modal with Multi-Photo Carousel
 */
export function openDetailModal(memory) {
  AppState.activeDetailMemory = memory;
  AppState.activePhotoIndex = 0;

  const theme = Timeline.getCategoryTheme(memory.category);

  document.getElementById('detail-category-badge').innerHTML = `
    <span class="category-pill" style="background: ${theme.bg}; color: ${theme.text}; border-color: ${theme.border};">
      ${theme.icon} ${Timeline.escapeHtml(memory.category)}
    </span>
    ${memory.is_milestone ? '<span class="milestone-ribbon-badge">🏆 Milestone</span>' : ''}
  `;

  document.getElementById('detail-date').textContent = Timeline.formatDate(memory.date);
  document.getElementById('detail-title').textContent = memory.title;
  document.getElementById('detail-desc').textContent = memory.description || 'No written description recorded.';

  const locEl = document.getElementById('detail-location');
  if (memory.location) {
    locEl.innerHTML = `📍 ${Timeline.escapeHtml(memory.location)}`;
    locEl.classList.remove('hidden');
  } else {
    locEl.classList.add('hidden');
  }

  const tagsContainer = document.getElementById('detail-tags');
  if (memory.tags && memory.tags.length > 0) {
    tagsContainer.innerHTML = memory.tags.map(t => `<span class="memory-tag">#${Timeline.escapeHtml(t)}</span>`).join('');
    tagsContainer.classList.remove('hidden');
  } else {
    tagsContainer.classList.add('hidden');
  }

  // Favorite toggle inside modal
  const favBtn = document.getElementById('btn-detail-fav');
  if (favBtn) {
    favBtn.innerHTML = memory.is_favorite ? '❤️ Favorited' : '🤍 Favorite';
    favBtn.onclick = async () => {
      const nextFav = await Memories.toggleFavorite(memory.id);
      memory.is_favorite = nextFav;
      favBtn.innerHTML = nextFav ? '❤️ Favorited' : '🤍 Favorite';
      await refreshActiveView();
    };
  }

  // Edit and Delete buttons inside modal
  const editBtn = document.getElementById('btn-detail-edit');
  if (editBtn) {
    editBtn.onclick = () => {
      Modal.close('detail-modal');
      openMemoryForm(memory);
    };
  }

  const deleteBtn = document.getElementById('btn-detail-delete');
  if (deleteBtn) {
    deleteBtn.onclick = async () => {
      if (confirm(`Are you sure you want to delete "${memory.title}"?`)) {
        await Memories.deleteMemory(memory.id);
        showToast('Memory deleted', 'info');
        Modal.close('detail-modal');
        await refreshActiveView();
      }
    };
  }

  // Render carousel
  renderCarouselPhoto();

  Modal.open('detail-modal');
}

/**
 * Render Carousel Photo in Detail Modal
 */
function renderCarouselPhoto() {
  const container = document.getElementById('detail-carousel-container');
  const memory = AppState.activeDetailMemory;
  if (!container || !memory) return;

  const photos = memory.photos && memory.photos.length > 0
    ? memory.photos
    : (memory.media_url ? [{ url: memory.media_url, caption: '' }] : []);

  if (photos.length === 0) {
    container.classList.add('hidden');
    container.innerHTML = '';
    return;
  }

  container.classList.remove('hidden');

  const curIndex = AppState.activePhotoIndex;
  const curPhoto = photos[curIndex] || photos[0];
  const hasMultiple = photos.length > 1;

  container.innerHTML = `
    <div class="carousel-wrapper">
      ${hasMultiple ? `<button type="button" class="carousel-arrow carousel-prev" id="carousel-btn-prev" aria-label="Previous photo">‹</button>` : ''}
      <div class="carousel-main-slide">
        <img src="${curPhoto.url}" alt="${Timeline.escapeHtml(memory.title)}" class="lightbox-img" />
        ${curPhoto.caption ? `<div class="carousel-caption">${Timeline.escapeHtml(curPhoto.caption)}</div>` : ''}
      </div>
      ${hasMultiple ? `<button type="button" class="carousel-arrow carousel-next" id="carousel-btn-next" aria-label="Next photo">›</button>` : ''}
    </div>
    ${hasMultiple ? `
      <div class="carousel-nav-bar">
        <span class="carousel-counter">${curIndex + 1} / ${photos.length}</span>
        <div class="carousel-dots">
          ${photos.map((_, i) => `<span class="carousel-dot ${i === curIndex ? 'active' : ''}" data-goto-index="${i}"></span>`).join('')}
        </div>
      </div>
    ` : ''}
  `;

  // Wire carousel buttons
  const prevBtn = document.getElementById('carousel-btn-prev');
  const nextBtn = document.getElementById('carousel-btn-next');

  if (prevBtn) {
    prevBtn.onclick = (e) => {
      e.stopPropagation();
      AppState.activePhotoIndex = (curIndex - 1 + photos.length) % photos.length;
      renderCarouselPhoto();
    };
  }

  if (nextBtn) {
    nextBtn.onclick = (e) => {
      e.stopPropagation();
      AppState.activePhotoIndex = (curIndex + 1) % photos.length;
      renderCarouselPhoto();
    };
  }

  container.querySelectorAll('[data-goto-index]').forEach(dot => {
    dot.onclick = (e) => {
      e.stopPropagation();
      AppState.activePhotoIndex = parseInt(dot.getAttribute('data-goto-index'), 10);
      renderCarouselPhoto();
    };
  });
}

/**
 * Setup Timeline Card Click Delegation
 */
function setupTimelineInteractions() {
  document.addEventListener('click', async (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;

    const action = target.getAttribute('data-action');
    const memoryId = target.getAttribute('data-id');
    const memory = AppState.memories.find(m => m.id === memoryId);

    if (action === 'toggle-fav' && memoryId) {
      e.preventDefault();
      e.stopPropagation();
      const nextFav = await Memories.toggleFavorite(memoryId);
      if (memory) memory.is_favorite = nextFav;
      showToast(nextFav ? 'Added to Favorites ❤️' : 'Removed from Favorites', 'info');
      await refreshActiveView();
    } else if (action === 'delete' && memoryId) {
      e.preventDefault();
      e.stopPropagation();
      if (confirm(`Are you sure you want to delete "${memory?.title || 'this memory'}"?`)) {
        try {
          await Memories.deleteMemory(memoryId);
          showToast('Memory deleted', 'info');
          await refreshActiveView();
        } catch (err) {
          showToast(`Failed to delete: ${err.message}`, 'error');
        }
      }
    } else if (action === 'edit' && memoryId) {
      e.preventDefault();
      e.stopPropagation();
      if (memory) openMemoryForm(memory);
    } else if (action === 'view-detail' && memoryId) {
      e.preventDefault();
      e.stopPropagation();
      if (memory) openDetailModal(memory);
    }
  });
}

/**
 * Setup Global Search with Auto-Suggestions Dropdown
 */
function setupGlobalSearch() {
  const searchInput = document.getElementById('search-memories-input');
  const suggestionsBox = document.getElementById('search-suggestions-dropdown');

  if (!searchInput || !suggestionsBox) return;

  let debounceTimer = null;

  searchInput.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    const val = e.target.value.trim();

    if (!val) {
      suggestionsBox.classList.add('hidden');
      suggestionsBox.innerHTML = '';
      AppState.searchQuery = '';
      refreshActiveView();
      return;
    }

    debounceTimer = setTimeout(async () => {
      AppState.searchQuery = val;
      const allMemories = await Memories.fetchMemories({ search: val });

      if (allMemories.length === 0) {
        suggestionsBox.innerHTML = `<div class="search-no-results">No matching memories found for "${Timeline.escapeHtml(val)}"</div>`;
        suggestionsBox.classList.remove('hidden');
      } else {
        const top5 = allMemories.slice(0, 5);
        suggestionsBox.innerHTML = `
          <div class="search-suggestions-header">Matching Memories (${allMemories.length})</div>
          ${top5.map(m => `
            <div class="suggestion-item" data-id="${m.id}">
              <div class="suggestion-thumb">${m.media_url ? `<img src="${m.media_url}" alt="" />` : '📝'}</div>
              <div class="suggestion-info">
                <span class="suggestion-title">${Timeline.escapeHtml(m.title)}</span>
                <span class="suggestion-date">${Timeline.formatDate(m.date)} • ${m.category}</span>
              </div>
            </div>
          `).join('')}
        `;
        suggestionsBox.classList.remove('hidden');
      }

      refreshActiveView();
    }, 200);
  });

  suggestionsBox.addEventListener('click', (e) => {
    const item = e.target.closest('.suggestion-item');
    if (item) {
      const id = item.getAttribute('data-id');
      const mem = AppState.memories.find(m => m.id === id);
      suggestionsBox.classList.add('hidden');
      if (mem) openDetailModal(mem);
    }
  });

  document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !suggestionsBox.contains(e.target)) {
      suggestionsBox.classList.add('hidden');
    }
  });
}

/**
 * Setup Navigation Links and View Switchers
 */
function setupNavigation() {
  document.querySelectorAll('[data-nav-view]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const view = link.getAttribute('data-nav-view');
      navigateToView(view);
    });
  });

  // Mobile menu toggle
  const mobileToggleBtn = document.getElementById('btn-mobile-menu-toggle');
  const mobileDrawer = document.getElementById('mobile-nav-drawer');

  if (mobileToggleBtn && mobileDrawer) {
    mobileToggleBtn.addEventListener('click', () => {
      mobileDrawer.classList.toggle('is-active');
    });

    const closeDrawerBtn = document.getElementById('btn-close-mobile-drawer');
    if (closeDrawerBtn) {
      closeDrawerBtn.addEventListener('click', () => {
        mobileDrawer.classList.remove('is-active');
      });
    }
  }

  // Category filter pills
  document.querySelectorAll('.filter-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      AppState.currentCategory = pill.getAttribute('data-category');
      refreshActiveView();
    });
  });

  // Sort Toggle
  const sortToggleBtn = document.getElementById('btn-toggle-sort');
  if (sortToggleBtn) {
    sortToggleBtn.addEventListener('click', () => {
      AppState.sortOrder = AppState.sortOrder === 'desc' ? 'asc' : 'desc';
      sortToggleBtn.innerHTML = AppState.sortOrder === 'desc'
        ? `<svg class="icon-sm" viewBox="0 0 20 20" fill="currentColor"><path d="M3 3a1 1 0 000 2h11a1 1 0 100-2H3zM3 7a1 1 0 000 2h7a1 1 0 100-2H3zM3 11a1 1 0 100 2h4a1 1 0 100-2H3zM15 8a1 1 0 10-2 0v5.586l-1.293-1.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L15 13.586V8z"/></svg> <span>Newest First</span>`
        : `<svg class="icon-sm" viewBox="0 0 20 20" fill="currentColor"><path d="M3 3a1 1 0 000 2h11a1 1 0 100-2H3zM3 7a1 1 0 000 2h7a1 1 0 100-2H3zM3 11a1 1 0 100 2h4a1 1 0 100-2H3zM15 16a1 1 0 10-2 0V10.414l-1.293 1.293a1 1 0 01-1.414-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L15 10.414V16z"/></svg> <span>Oldest First</span>`;
      refreshActiveView();
    });
  }
}

/**
 * Setup Genuine User Configurable Reminders
 */
function setupReminders() {
  const openRemindersBtn = document.getElementById('btn-open-reminders');
  const modal = document.getElementById('reminders-modal');
  const form = document.getElementById('reminders-config-form');

  const STORAGE_KEY = 'lifeline_user_reminders_config';

  const loadRemindersConfig = () => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {
        milestoneAnniversaries: true,
        weeklyDigest: false,
        onThisDayNotifications: true
      };
    } catch {
      return { milestoneAnniversaries: true, weeklyDigest: false, onThisDayNotifications: true };
    }
  };

  const footerRemindersBtn = document.getElementById('footer-btn-reminders');
  const triggerRemindersModal = () => {
    const cfg = loadRemindersConfig();
    document.getElementById('remind-milestones').checked = Boolean(cfg.milestoneAnniversaries);
    document.getElementById('remind-weekly').checked = Boolean(cfg.weeklyDigest);
    document.getElementById('remind-onthisday').checked = Boolean(cfg.onThisDayNotifications);
    Modal.open('reminders-modal');
  };

  if (openRemindersBtn) openRemindersBtn.addEventListener('click', triggerRemindersModal);
  if (footerRemindersBtn) footerRemindersBtn.addEventListener('click', triggerRemindersModal);

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const cfg = {
        milestoneAnniversaries: document.getElementById('remind-milestones').checked,
        weeklyDigest: document.getElementById('remind-weekly').checked,
        onThisDayNotifications: document.getElementById('remind-onthisday').checked,
        updatedAt: new Date().toISOString()
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
      showToast('Reminder preferences saved!', 'success');
      Modal.close('reminders-modal');
    });
  }
}

/**
 * Setup Data Export Buttons (JSON & Markdown Life-Story)
 */
function setupExportFeatures() {
  const exportJsonBtn = document.getElementById('btn-export-json');
  const exportDocBtn = document.getElementById('btn-export-doc');

  if (exportJsonBtn) {
    exportJsonBtn.addEventListener('click', async () => {
      try {
        const count = await Memories.exportMemoriesAsJSON();
        showToast(`Exported ${count} memories as JSON archive!`, 'success');
      } catch (err) {
        showToast(`Export failed: ${err.message}`, 'error');
      }
    });
  }

  if (exportDocBtn) {
    exportDocBtn.addEventListener('click', async () => {
      try {
        const count = await Memories.exportLifeStoryDocument();
        showToast(`Generated Life-Story chronicle for ${count} memories!`, 'success');
      } catch (err) {
        showToast(`Document generation failed: ${err.message}`, 'error');
      }
    });
  }
}

/**
 * Setup Supabase Connection Modal & SQL Migration
 */
function setupSupabaseModal() {
  const openBtn = document.getElementById('btn-open-settings');
  const badgeBtn = document.getElementById('supabase-status-badge');
  const form = document.getElementById('supabase-config-form');
  const disconnectBtn = document.getElementById('btn-disconnect-supabase');
  const copySqlBtn = document.getElementById('btn-copy-sql');
  const resetDemoBtn = document.getElementById('btn-reset-demo-data');
  const clearDemoBtn = document.getElementById('btn-clear-demo-data');

  const openConfig = () => {
    const config = getConfig();
    document.getElementById('input-supabase-url').value = config.url || '';
    document.getElementById('input-supabase-key').value = config.anonKey || '';
    document.getElementById('input-supabase-bucket').value = config.bucket || 'lifeline-media';
    Modal.open('supabase-modal');
  };

  if (openBtn) openBtn.addEventListener('click', openConfig);
  if (badgeBtn) badgeBtn.addEventListener('click', openConfig);

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const url = document.getElementById('input-supabase-url').value.trim();
      const key = document.getElementById('input-supabase-key').value.trim();
      const bucket = document.getElementById('input-supabase-bucket').value.trim();

      try {
        configureSupabase(url, key, bucket);
        showToast('Supabase connected! Syncing cloud archive...', 'success');
        updateConnectionBadge();
        Modal.close('supabase-modal');
        await refreshActiveView();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  if (disconnectBtn) {
    disconnectBtn.addEventListener('click', async () => {
      disconnectSupabase();
      showToast('Switched to Demo Sandbox mode', 'info');
      updateConnectionBadge();
      Modal.close('supabase-modal');
      await refreshActiveView();
    });
  }

  if (resetDemoBtn) {
    resetDemoBtn.addEventListener('click', async () => {
      Memories.resetDemoData();
      showToast('Demo data reset to showcase moments!', 'success');
      Modal.close('supabase-modal');
      await refreshActiveView();
    });
  }

  if (clearDemoBtn) {
    clearDemoBtn.addEventListener('click', async () => {
      Memories.clearDemoData();
      showToast('Demo data cleared! Enjoy your clean slate.', 'info');
      Modal.close('supabase-modal');
      await refreshActiveView();
    });
  }

  if (copySqlBtn) {
    copySqlBtn.addEventListener('click', () => {
      const sqlCode = document.getElementById('supabase-sql-code').textContent;
      navigator.clipboard.writeText(sqlCode).then(() => {
        showToast('SQL schema copied to clipboard!', 'success');
      }).catch(() => {
        showToast('Please select and copy the SQL code manually.', 'warning');
      });
    });
  }
}

/**
 * Setup Keyboard Shortcuts
 */
function setupKeyboardShortcuts() {
  window.addEventListener('keydown', (e) => {
    // ESC to close active modal
    if (e.key === 'Escape') {
      Modal.closeAll();
    }
    // / to focus search
    else if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
      e.preventDefault();
      const searchInput = document.getElementById('search-memories-input');
      if (searchInput) searchInput.focus();
    }
    // N to create new memory
    else if ((e.key === 'n' || e.key === 'N') && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
      if (!document.querySelector('.modal.is-active')) {
        e.preventDefault();
        openMemoryForm();
      }
    }
    // Arrow keys for photo carousel inside detail modal
    else if (document.getElementById('detail-modal')?.classList.contains('is-active')) {
      if (e.key === 'ArrowLeft') {
        const prev = document.getElementById('carousel-btn-prev');
        if (prev) prev.click();
      } else if (e.key === 'ArrowRight') {
        const next = document.getElementById('carousel-btn-next');
        if (next) next.click();
      }
    }
  });

  // Close modals on clicking backdrop or close buttons
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-backdrop') || e.target.classList.contains('modal-close-btn') || e.target.getAttribute('data-action') === 'close-modal') {
        Modal.close(modal.id);
      }
    });
  });
}

/**
 * Theme Manager (Light Theme default with Dark Theme toggle)
 */
export function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('lifeline_theme', theme);
  const icon = document.getElementById('theme-toggle-icon');
  if (icon) {
    icon.textContent = theme === 'light' ? '🌙' : '☀️';
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', theme === 'light' ? '#f8fafc' : '#090d16');
  }
}

export function getTheme() {
  return localStorage.getItem('lifeline_theme') || 'light';
}

function setupThemeToggle() {
  const toggleBtn = document.getElementById('btn-theme-toggle');
  const initialTheme = getTheme();
  setTheme(initialTheme);

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const current = getTheme();
      const next = current === 'light' ? 'dark' : 'light';
      setTheme(next);
      showToast(`Switched to ${next === 'light' ? 'Light' : 'Dark'} Theme`, 'info');
    });
  }
}

/**
 * App Bootstrapping
 */
async function initApp() {
  console.log('[LifeLine] Initializing application in Light Theme...');

  // Initialize theme first
  setupThemeToggle();

  // Setup UI components
  setupImageUploadHandlers();
  setupMemoryFormSubmit();
  setupTimelineInteractions();
  setupGlobalSearch();
  setupNavigation();
  setupReminders();
  setupExportFeatures();
  setupSupabaseModal();
  setupKeyboardShortcuts();

  // "New Memory" top button
  const newMemoryBtn = document.getElementById('btn-new-memory');
  if (newMemoryBtn) {
    newMemoryBtn.addEventListener('click', () => openMemoryForm());
  }

  // User Profile / Auth State Listener
  Auth.onAuthStateChange(async (event, session, user) => {
    AppState.currentUser = user;
    updateConnectionBadge();
    await refreshActiveView();
  });

  // Initial load
  updateConnectionBadge();
  await refreshActiveView();
}

document.addEventListener('DOMContentLoaded', initApp);
