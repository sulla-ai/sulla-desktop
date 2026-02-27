// Import all playwright tool registrations
import { clickElementRegistration } from './click_element';
import { setFieldRegistration } from './set_field';
import { getPageTextRegistration } from './get_page_text';
import { scrollToElementRegistration } from './scroll_to_element';
import { getFormValuesRegistration } from './get_form_values';

// Export all playwright tool registrations as an array
export const playwrightToolRegistrations = [
  clickElementRegistration,
  setFieldRegistration,
  getPageTextRegistration,
  scrollToElementRegistration,
  getFormValuesRegistration,
];
