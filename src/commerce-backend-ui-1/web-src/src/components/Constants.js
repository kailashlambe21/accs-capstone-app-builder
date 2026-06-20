/**
 * Must match `extension-manifest.json` `id`.
 * Used by register() and attach() — NOT the App Builder workspace namespace.
 * @see https://developer.adobe.com/commerce/extensibility/admin-ui-sdk/app-review-checklist/
 */
export const extensionId = 'badge_management';

export const menuSectionId = `${extensionId}::apps`;
export const menuItemId = `${extensionId}::main`;
