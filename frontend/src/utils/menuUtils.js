// Utility functions for managing menu configurations across components

/**
 * Creates a menu configuration object that can be exported to header navigation
 * @param {Array} items - Array of menu items with label, section, icon, path, and optional badge
 * @param {string} title - Title for the menu section
 * @param {boolean} showOnMobile - Whether to show this menu on mobile devices
 * @returns {Object} Menu configuration object
 */
export const createMenuConfig = (items, title, showOnMobile = true) => {
  return {
    title,
    items,
    showOnMobile
  };
};

/**
 * Merges multiple menu configurations into a single array for header navigation
 * @param {Array} menuConfigs - Array of menu configuration objects
 * @returns {Array} Flattened array of menu items with section headers
 */
export const mergeMenuConfigs = (menuConfigs) => {
  const mergedItems = [];
  
  menuConfigs.forEach(config => {
    if (config.showOnMobile && config.items.length > 0) {
      // Add section header
      mergedItems.push({
        type: 'header',
        label: config.title,
        key: `header-${config.title.toLowerCase().replace(/\s+/g, '-')}`
      });
      
      // Add menu items
      config.items.forEach(item => {
        mergedItems.push({
          ...item,
          type: 'item',
          key: `item-${item.section || item.path || item.label.toLowerCase().replace(/\s+/g, '-')}`
        });
      });
    }
  });
  
  return mergedItems;
};

/**
 * Filters menu items based on user permissions or other criteria
 * @param {Array} items - Array of menu items
 * @param {Function} filterFn - Filter function that returns true/false for each item
 * @returns {Array} Filtered array of menu items
 */
export const filterMenuItems = (items, filterFn) => {
  return items.filter(filterFn);
};

/**
 * Sorts menu items by a specified property
 * @param {Array} items - Array of menu items
 * @param {string} sortBy - Property to sort by
 * @param {string} order - Sort order ('asc' or 'desc')
 * @returns {Array} Sorted array of menu items
 */
export const sortMenuItems = (items, sortBy = 'label', order = 'asc') => {
  return [...items].sort((a, b) => {
    const aVal = a[sortBy] || '';
    const bVal = b[sortBy] || '';
    
    if (order === 'desc') {
      return bVal.localeCompare(aVal);
    }
    return aVal.localeCompare(bVal);
  });
};
