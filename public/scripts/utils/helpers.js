// /public/scripts/utils/helpers.js
// Utility helper functions

/**
 * Create DOM element with options
 */
export function createElement(tag, options = {}) {
  const el = document.createElement(tag);
  if (options.id) el.id = options.id;
  if (options.className) el.className = options.className;
  if (options.text) el.textContent = options.text;
  if (options.html) el.innerHTML = options.html;
  if (options.attributes) {
    Object.entries(options.attributes).forEach(([key, value]) => el.setAttribute(key, value));
  }
  if (options.attrs) {
    Object.entries(options.attrs).forEach(([key, value]) => el.setAttribute(key, value));
  }
  if (options.styles) {
    Object.entries(options.styles).forEach(([key, value]) => el.style[key] = value);
  }
  if (options.parent) options.parent.appendChild(el);
  return el;
}

/**
 * Add lock icon to button element
 */
export function addLockIcon(buttonElement) {
  const lockIcon = createElement('div', {
    className: 'absolute inset-0 flex items-center justify-center bg-gray-400 bg-opacity-90 z-10',
    html: `
      <svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
      </svg>
    `,
    parent: buttonElement
  });
  return lockIcon;
}

/**
 * Debounce function to limit function calls
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Format timestamp to relative time
 */
export function formatRelativeTime(timestamp) {
  if (!timestamp) return 'Never';
  
  const now = Date.now();
  const timeDiff = now - timestamp;
  const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
  const hoursDiff = Math.floor(timeDiff / (1000 * 60 * 60));
  const minutesDiff = Math.floor(timeDiff / (1000 * 60));
  
  if (daysDiff > 0) {
    return daysDiff === 1 ? '1 day ago' : `${daysDiff} days ago`;
  } else if (hoursDiff > 0) {
    return hoursDiff === 1 ? '1 hour ago' : `${hoursDiff} hours ago`;
  } else if (minutesDiff > 0) {
    return minutesDiff === 1 ? '1 minute ago' : `${minutesDiff} minutes ago`;
  } else {
    return 'Just now';
  }
}

/**
 * Safe localStorage operations
 */
export const storage = {
  get(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error(`Error reading from localStorage (${key}):`, error);
      return defaultValue;
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`Error writing to localStorage (${key}):`, error);
      return false;
    }
  },

  remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error(`Error removing from localStorage (${key}):`, error);
      return false;
    }
  }
};
