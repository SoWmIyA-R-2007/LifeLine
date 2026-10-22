/**
 * Lifeline - Timeline Rendering & Photo-Grid Module
 * Handles chronological grouping, card rendering, photo-grid view,
 * milestone highlights, and interactive year scrubber navigation.
 */

export const Timeline = {
  /**
   * Group memories array by year
   * @param {Array<Object>} memories
   * @returns {Object.<string, Array<Object>>} map of year -> memories[]
   */
  groupByYear(memories) {
    const groups = {};
    for (const memory of memories) {
      if (!memory.date) continue;
      const year = memory.date.split('-')[0] || new Date(memory.date).getFullYear().toString();
      if (!groups[year]) {
        groups[year] = [];
      }
      groups[year].push(memory);
    }
    return groups;
  },

  /**
   * Format date into beautiful human-friendly string
   * @param {string} dateString 'YYYY-MM-DD'
   * @returns {string}
   */
  formatDate(dateString) {
    if (!dateString) return '';
    try {
      const [year, month, day] = dateString.split('-');
      if (!year || !month || !day) return dateString;
      const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return dateString;
    }
  },

  /**
   * Calculate time elapsed or relative time ago
   */
  timeAgo(dateString) {
    if (!dateString) return '';
    const parts = dateString.split('-');
    if (parts.length < 3) return '';
    const now = new Date();
    const diffYears = now.getFullYear() - parseInt(parts[0], 10);

    if (diffYears === 0) {
      const diffMonths = (now.getMonth() + 1) - parseInt(parts[1], 10);
      if (diffMonths <= 0) return 'This month';
      return `${diffMonths} mo ago`;
    } else if (diffYears === 1) {
      return '1 year ago';
    } else if (diffYears > 1) {
      return `${diffYears} years ago`;
    }
    return 'Recent';
  },

  /**
   * Get category visual badge attributes
   */
  /**
   * Get category visual badge attributes (theme-aware via CSS variables)
   */
  getCategoryTheme(category) {
    const raw = (category || 'Personal').toLowerCase();
    let key = 'personal';
    let icon = '✨';

    if (raw.includes('milestone')) {
      key = 'milestones';
      icon = '🏆';
    } else if (raw.includes('travel')) {
      key = 'travel';
      icon = '✈️';
    } else if (raw.includes('career') || raw.includes('education')) {
      key = 'career';
      icon = '💼';
    } else if (raw.includes('family') || raw.includes('friend')) {
      key = 'family';
      icon = '❤️';
    } else if (raw.includes('achievement')) {
      key = 'achievements';
      icon = '🎯';
    } else if (raw.includes('everyday')) {
      key = 'everyday';
      icon = '☕';
    }

    return {
      bg: `var(--cat-${key}-bg)`,
      text: `var(--cat-${key}-text)`,
      border: `var(--cat-${key}-border)`,
      icon
    };
  },

  /**
   * Render individual memory card in Timeline view
   * @param {Object} memory
   * @returns {string}
   */
  renderMemoryCard(memory) {
    const theme = this.getCategoryTheme(memory.category);
    const formattedDate = this.formatDate(memory.date);
    const elapsed = this.timeAgo(memory.date);
    const importanceStars = '★'.repeat(memory.importance || 3) + '☆'.repeat(Math.max(0, 5 - (memory.importance || 3)));
    const isFav = Boolean(memory.is_favorite);
    const isMilestone = Boolean(memory.is_milestone);

    // Multiple photos handling
    const photos = memory.photos && memory.photos.length > 0
      ? memory.photos
      : (memory.media_url ? [{ url: memory.media_url, caption: '' }] : []);

    let mediaHtml = '';
    if (photos.length > 0) {
      const primaryPhoto = photos[0];
      const multiBadge = photos.length > 1
        ? `<span class="multi-photos-pill" title="${photos.length} photos in this memory">📷 ${photos.length} photos</span>`
        : '';

      mediaHtml = `
        <div class="memory-media-container" data-action="view-detail" data-id="${memory.id}">
          <img src="${primaryPhoto.url}" alt="${this.escapeHtml(memory.title)}" class="memory-media-img" loading="lazy" />
          <div class="media-overlay">
            <span class="zoom-badge">🔍 Click to view</span>
          </div>
          ${multiBadge}
        </div>
      `;
    }

    const tagsHtml = (memory.tags && memory.tags.length > 0)
      ? `<div class="memory-tags">
          ${memory.tags.map(t => `<span class="memory-tag">#${this.escapeHtml(t)}</span>`).join('')}
         </div>`
      : '';

    const locationHtml = memory.location
      ? `<span class="memory-meta-item location-badge">
           <svg class="meta-icon" viewBox="0 0 20 20" fill="currentColor">
             <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd" />
           </svg>
           ${this.escapeHtml(memory.location)}
         </span>`
      : '';

    const milestoneBadge = isMilestone
      ? `<span class="milestone-ribbon-badge">🏆 Milestone</span>`
      : '';

    const milestoneCardClass = isMilestone ? 'card-milestone-highlight' : '';

    return `
      <article class="timeline-card ${milestoneCardClass}" id="memory-${memory.id}" data-id="${memory.id}">
        <div class="timeline-node ${isMilestone ? 'node-milestone' : ''}">
          <div class="node-dot"></div>
          <div class="node-pulse"></div>
        </div>

        <div class="card-glass-panel">
          <div class="card-header">
            <div class="card-badge-row">
              <span class="category-pill" style="background: ${theme.bg}; color: ${theme.text}; border-color: ${theme.border};">
                <span class="cat-icon">${theme.icon}</span> ${this.escapeHtml(memory.category)}
              </span>
              ${milestoneBadge}
              <span class="time-elapsed-pill">${elapsed}</span>
            </div>

            <div class="card-actions">
              <button class="btn-icon-subtle fav-btn ${isFav ? 'is-fav' : ''}" data-action="toggle-fav" data-id="${memory.id}" title="${isFav ? 'Favorited' : 'Add to Favorites'}" aria-label="Toggle Favorite">
                ${isFav ? '❤️' : '🤍'}
              </button>
              <button class="btn-icon-subtle edit-btn" data-action="edit" data-id="${memory.id}" title="Edit Memory" aria-label="Edit memory">
                <svg viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
              </button>
              <button class="btn-icon-subtle delete-btn" data-action="delete" data-id="${memory.id}" title="Delete Memory" aria-label="Delete memory">
                <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" /></svg>
              </button>
            </div>
          </div>

          ${mediaHtml}

          <div class="card-body">
            <div class="card-meta">
              <span class="memory-meta-item date-badge">
                <svg class="meta-icon" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd" />
                </svg>
                ${formattedDate}
              </span>
              ${locationHtml}
              <span class="importance-stars" title="Significance: ${memory.importance || 3}/5">${importanceStars}</span>
            </div>

            <h3 class="memory-title" data-action="view-detail" data-id="${memory.id}">${this.escapeHtml(memory.title)}</h3>
            <p class="memory-desc">${this.escapeHtml(memory.description)}</p>

            ${tagsHtml}
          </div>
        </div>
      </article>
    `;
  },

  /**
   * Render the entire timeline feed with Year Sections
   * @param {HTMLElement} container
   * @param {Array<Object>} memories
   */
  renderTimeline(container, memories) {
    if (!memories || memories.length === 0) {
      container.innerHTML = `
        <div class="empty-timeline-state">
          <div class="empty-icon-glow">✨</div>
          <h3>Your LifeLine is Ready</h3>
          <p>Every journey begins with a single moment. Capture milestones, travels, and personal memories from your earliest recollections to the present.</p>
          <button class="btn-primary" id="btn-add-first-memory">
            <svg class="btn-icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" /></svg>
            Add Your First Memory
          </button>
        </div>
      `;
      return;
    }

    const grouped = this.groupByYear(memories);
    const sortedYears = Object.keys(grouped).sort((a, b) => Number(b) - Number(a));

    let html = '';

    for (const year of sortedYears) {
      const yearMemories = grouped[year];
      const countLabel = yearMemories.length === 1 ? '1 moment' : `${yearMemories.length} moments`;
      const milestoneCount = yearMemories.filter(m => m.is_milestone).length;
      const milestoneText = milestoneCount > 0 ? ` • 🏆 ${milestoneCount} milestone${milestoneCount > 1 ? 's' : ''}` : '';

      html += `
        <section class="timeline-year-section" id="year-section-${year}" data-year="${year}">
          <div class="year-marker-anchor">
            <div class="year-banner" data-year="${year}">
              <span class="year-title">${year}</span>
              <span class="year-count-badge">${countLabel}${milestoneText}</span>
            </div>
            <div class="year-line-branch"></div>
          </div>

          <div class="year-cards-list">
            ${yearMemories.map(m => this.renderMemoryCard(m)).join('')}
          </div>
        </section>
      `;
    }

    container.innerHTML = html;
  },

  /**
   * Render Photo-Grid / Gallery View (Alternative to Timeline)
   * @param {HTMLElement} container
   * @param {Array<Object>} memories
   */
  renderPhotoGrid(container, memories) {
    if (!memories || memories.length === 0) {
      container.innerHTML = `
        <div class="empty-timeline-state">
          <div class="empty-icon-glow">📷</div>
          <h3>No Photos Found</h3>
          <p>No memories matching your current view or filter. Add new photos to build your visual gallery.</p>
        </div>
      `;
      return;
    }

    const photosList = [];
    memories.forEach(m => {
      const photos = m.photos && m.photos.length > 0
        ? m.photos
        : (m.media_url ? [{ url: m.media_url, caption: '' }] : []);

      photos.forEach((p, idx) => {
        photosList.push({
          memoryId: m.id,
          title: m.title,
          date: m.date,
          category: m.category,
          is_milestone: m.is_milestone,
          is_favorite: m.is_favorite,
          url: p.url,
          caption: p.caption || m.title,
          photoIndex: idx
        });
      });
    });

    if (photosList.length === 0) {
      container.innerHTML = `
        <div class="empty-timeline-state">
          <div class="empty-icon-glow">🖼️</div>
          <h3>No Photos Attached</h3>
          <p>You have memories recorded, but none currently have attached photographs.</p>
        </div>
      `;
      return;
    }

    let html = `<div class="photo-grid-layout">`;
    photosList.forEach(item => {
      const theme = this.getCategoryTheme(item.category);
      html += `
        <div class="photo-grid-item" data-action="view-detail" data-id="${item.memoryId}">
          <img src="${item.url}" alt="${this.escapeHtml(item.title)}" loading="lazy" class="grid-img" />
          <div class="grid-item-overlay">
            <span class="grid-item-date">${this.formatDate(item.date)}</span>
            <h4 class="grid-item-title">${this.escapeHtml(item.title)}</h4>
            <div class="grid-item-badges">
              <span class="category-pill" style="background: ${theme.bg}; color: ${theme.text}; border-color: ${theme.border}; font-size: 0.7rem; padding: 2px 6px;">
                ${theme.icon} ${this.escapeHtml(item.category)}
              </span>
              ${item.is_milestone ? '<span class="milestone-badge-sm">🏆</span>' : ''}
              ${item.is_favorite ? '<span class="fav-badge-sm">❤️</span>' : ''}
            </div>
          </div>
        </div>
      `;
    });
    html += `</div>`;

    container.innerHTML = html;
  },

  /**
   * Render Year Scrubber navigation rail
   * @param {HTMLElement} scrubberContainer
   * @param {Array<Object>} memories
   * @param {Function} onYearSelect
   */
  renderYearScrubber(scrubberContainer, memories, onYearSelect) {
    if (!scrubberContainer) return;

    if (!memories || memories.length === 0) {
      scrubberContainer.innerHTML = '';
      return;
    }

    const grouped = this.groupByYear(memories);
    const sortedYears = Object.keys(grouped).sort((a, b) => Number(b) - Number(a));

    if (sortedYears.length === 0) {
      scrubberContainer.innerHTML = '';
      return;
    }

    let itemsHtml = `
      <div class="scrubber-header">
        <span class="scrubber-label">TIMELINE</span>
        <span class="scrubber-span">${sortedYears[sortedYears.length - 1]} — ${sortedYears[0]}</span>
      </div>
      <div class="scrubber-track">
    `;

    sortedYears.forEach((year, idx) => {
      const count = grouped[year].length;
      const milestoneCount = grouped[year].filter(m => m.is_milestone).length;
      const milestoneDot = milestoneCount > 0 ? '<span class="scrubber-milestone-indicator" title="Contains milestones">★</span>' : '';

      itemsHtml += `
        <button class="scrubber-pill ${idx === 0 ? 'active' : ''}" data-year="${year}" title="${year}: ${count} memories${milestoneCount > 0 ? ` (${milestoneCount} milestones)` : ''}">
          <span class="scrubber-year-text">${year}</span>
          <div class="scrubber-indicators">
            ${milestoneDot}
            <span class="scrubber-dot"></span>
          </div>
          <span class="scrubber-count">${count}</span>
        </button>
      `;
    });

    itemsHtml += `</div>`;
    scrubberContainer.innerHTML = itemsHtml;

    // Attach click handlers
    scrubberContainer.querySelectorAll('.scrubber-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        const year = btn.getAttribute('data-year');
        this.scrollToYear(year);
        if (onYearSelect) onYearSelect(year);
      });
    });

    this.setupScrollSpy(scrubberContainer);
  },

  /**
   * Smoothly scroll to year section
   * @param {string} year
   */
  scrollToYear(year) {
    const el = document.getElementById(`year-section-${year}`);
    if (el) {
      const navOffset = 90;
      const elementPosition = el.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - navOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  },

  /**
   * Setup IntersectionObserver / ScrollSpy to highlight active year
   * @param {HTMLElement} scrubberContainer
   */
  setupScrollSpy(scrubberContainer) {
    const sections = document.querySelectorAll('.timeline-year-section');
    if (!sections.length) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const year = entry.target.getAttribute('data-year');
          scrubberContainer.querySelectorAll('.scrubber-pill').forEach(btn => {
            if (btn.getAttribute('data-year') === year) {
              btn.classList.add('active');
            } else {
              btn.classList.remove('active');
            }
          });
        }
      });
    }, {
      rootMargin: '-100px 0px -60% 0px',
      threshold: 0
    });

    sections.forEach(sec => observer.observe(sec));
  },

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
};
