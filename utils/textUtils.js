
/**
 * Convert string to multilingual object
 * @param {string|object} text - Text to convert or existing multilingual object
 * @returns {object} Multilingual object with en and nl properties
 */
const toMultilingualText = (text) => {
  // Handle null, undefined, or empty string
  if (!text || (typeof text === 'string' && text.trim() === '')) {
    return {
      en: '',
      nl: ''
    };
  }

  // Handle string input
  if (typeof text === 'string') {
    const trimmedText = text.trim();
    return {
      en: trimmedText,
      nl: trimmedText // Use same value for Dutch, can be translated later
    };
  }

  // Handle object input
  if (typeof text === 'object' && text !== null) {
    // If it's already a multilingual object, ensure both languages exist
    const result = {
      en: text.en || text.nl || '',
      nl: text.nl || text.en || ''
    };
    
    // Ensure at least one language has content
    if (!result.en && !result.nl) {
      result.en = '';
      result.nl = '';
    }
    
    return result;
  }

  // Fallback for other types
  return {
    en: String(text || ''),
    nl: String(text || '')
  };
};

/**
 * Get text in specific language from multilingual object
 * @param {string|object} text - Multilingual text object or string
 * @param {string} language - Language code ('en' or 'nl')
 * @returns {string} Text in specified language
 */
const getLocalizedText = (text, language = 'en') => {
  if (typeof text === 'string') {
    return text;
  }
  if (typeof text === 'object' && text !== null) {
    return text[language] || text.en || '';
  }
  return '';
};

module.exports = {
  toMultilingualText,
  getLocalizedText
};